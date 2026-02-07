/**
 * Myfye Agent SDK - Trading Module
 * Handles Jupiter token swaps and Dinari stock trading
 */

import {
  Connection,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  AddressLookupTableAccount,
  Keypair,
} from '@solana/web3.js';
import {
  SwapParams,
  SwapQuote,
  SwapResult,
  StockBuyParams,
  StockSellParams,
  StockOrderResult,
  SDKConfig,
  JupiterQuoteResponse,
  JupiterSwapInstructionsResponse,
  COMMON_TOKENS,
} from './types.js';
import { MarketDataClient } from './market.js';

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_INSTRUCTIONS_API = 'https://lite-api.jup.ag/swap/v1/swap-instructions';

// Dinari API endpoints
const DINARI_API_BASE = 'https://api.dinari.com';
const DINARI_SANDBOX_API = 'https://api-sandbox.dinari.com';

/**
 * Trading client for executing swaps and stock trades
 */
export class TradingClient {
  private config: SDKConfig;
  private connection: Connection;
  private marketClient: MarketDataClient;

  constructor(config: SDKConfig, marketClient?: MarketDataClient) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.marketClient = marketClient || new MarketDataClient(config);
  }

  // ============================================================================
  // Jupiter Token Swap Methods
  // ============================================================================

  /**
   * Get a swap quote from Jupiter
   */
  async getSwapQuote(params: SwapParams): Promise<SwapQuote> {
    const token = await this.marketClient.getToken(params.inputMint);
    if (!token) {
      throw new Error(`Unknown input token: ${params.inputMint}`);
    }

    // Convert amount to raw units
    const decimals = token.decimals;
    const rawAmount = Math.floor(params.amount * Math.pow(10, decimals));

    const url = new URL(JUPITER_QUOTE_API);
    url.searchParams.set('inputMint', params.inputMint);
    url.searchParams.set('outputMint', params.outputMint);
    url.searchParams.set('amount', String(rawAmount));
    url.searchParams.set('slippageBps', String(params.slippageBps || 300));
    url.searchParams.set('maxAccounts', '54');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter quote error: ${response.status} - ${errorText}`);
      }

      const quoteResponse = await response.json() as JupiterQuoteResponse;

      return {
        inAmount: quoteResponse.inAmount,
        outAmount: quoteResponse.outAmount,
        priceImpactPct: quoteResponse.priceImpactPct,
        routePlan: quoteResponse.routePlan,
        raw: quoteResponse,
      };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw error;
    }
  }

  /**
   * Get swap instructions from Jupiter
   */
  async getSwapInstructions(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ): Promise<JupiterSwapInstructionsResponse> {
    try {
      const response = await fetch(JUPITER_SWAP_INSTRUCTIONS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: {
            maxBps: 300,
          },
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 2_000_000,
              priorityLevel: 'medium',
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter swap instructions error: ${response.status} - ${errorText}`);
      }

      return await response.json() as JupiterSwapInstructionsResponse;
    } catch (error) {
      console.error('Error getting swap instructions:', error);
      throw error;
    }
  }

  /**
   * Build a versioned transaction from Jupiter instructions
   */
  async buildSwapTransaction(
    instructions: JupiterSwapInstructionsResponse,
    userPublicKey: PublicKey
  ): Promise<VersionedTransaction> {
    // Deserialize instructions
    const allInstructions: TransactionInstruction[] = [];

    // Add compute budget instructions
    if (instructions.computeBudgetInstructions) {
      for (const ix of instructions.computeBudgetInstructions) {
        allInstructions.push(this.deserializeInstruction(ix));
      }
    }

    // Add setup instructions
    if (instructions.setupInstructions) {
      for (const ix of instructions.setupInstructions) {
        allInstructions.push(this.deserializeInstruction(ix));
      }
    }

    // Add swap instruction
    if (instructions.swapInstruction) {
      allInstructions.push(this.deserializeInstruction(instructions.swapInstruction));
    }

    // Add cleanup instruction
    if (instructions.cleanupInstruction) {
      allInstructions.push(this.deserializeInstruction(instructions.cleanupInstruction));
    }

    // Get address lookup tables
    const addressLookupTables: AddressLookupTableAccount[] = [];
    if (instructions.addressLookupTableAddresses && instructions.addressLookupTableAddresses.length > 0) {
      const lookupTableAccounts = await Promise.all(
        instructions.addressLookupTableAddresses.map(async (address) => {
          const account = await this.connection.getAddressLookupTable(new PublicKey(address));
          return account.value;
        })
      );

      for (const account of lookupTableAccounts) {
        if (account) {
          addressLookupTables.push(account);
        }
      }
    }

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();

    // Build the transaction message
    const messageV0 = new TransactionMessage({
      payerKey: userPublicKey,
      recentBlockhash: blockhash,
      instructions: allInstructions,
    }).compileToV0Message(addressLookupTables);

    return new VersionedTransaction(messageV0);
  }

  /**
   * Deserialize a Jupiter instruction
   */
  private deserializeInstruction(instruction: unknown): TransactionInstruction {
    const ix = instruction as {
      programId: string;
      accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
      data: string;
    };

    return new TransactionInstruction({
      programId: new PublicKey(ix.programId),
      keys: ix.accounts.map((account) => ({
        pubkey: new PublicKey(account.pubkey),
        isSigner: account.isSigner,
        isWritable: account.isWritable,
      })),
      data: Buffer.from(ix.data, 'base64'),
    });
  }

  /**
   * Execute a token swap
   * Note: This requires a signer (keypair) to sign the transaction
   */
  async executeSwap(
    params: SwapParams,
    signer: Keypair
  ): Promise<SwapResult> {
    try {
      // Get quote
      const inputToken = await this.marketClient.getToken(params.inputMint);
      const outputToken = await this.marketClient.getToken(params.outputMint);

      if (!inputToken || !outputToken) {
        throw new Error('Could not resolve token info');
      }

      const quote = await this.getSwapQuote(params);

      // Get swap instructions
      const instructions = await this.getSwapInstructions(
        quote.raw as JupiterQuoteResponse,
        params.userPublicKey
      );

      // Build transaction
      const transaction = await this.buildSwapTransaction(
        instructions,
        new PublicKey(params.userPublicKey)
      );

      // Sign transaction
      transaction.sign([signer]);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      );

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        return {
          signature,
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          inputAmount: params.amount,
          outputAmount: 0,
          status: 'failed',
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        };
      }

      // Calculate output amount
      const outputAmount = Number(quote.outAmount) / Math.pow(10, outputToken.decimals);

      return {
        signature,
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        inputAmount: params.amount,
        outputAmount,
        status: 'success',
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      return {
        signature: '',
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        inputAmount: params.amount,
        outputAmount: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Simulate a swap (get quote and transaction without executing)
   */
  async simulateSwap(params: SwapParams): Promise<{
    quote: SwapQuote;
    estimatedOutputAmount: number;
    priceImpact: number;
  }> {
    const outputToken = await this.marketClient.getToken(params.outputMint);
    if (!outputToken) {
      throw new Error(`Unknown output token: ${params.outputMint}`);
    }

    const quote = await this.getSwapQuote(params);
    const estimatedOutputAmount = Number(quote.outAmount) / Math.pow(10, outputToken.decimals);
    const priceImpact = parseFloat(quote.priceImpactPct);

    return {
      quote,
      estimatedOutputAmount,
      priceImpact,
    };
  }

  // ============================================================================
  // Dinari Stock Trading Methods
  // ============================================================================

  /**
   * Get Dinari API base URL
   */
  private getDinariApiBase(): string {
    return this.config.dinari?.environment === 'sandbox'
      ? DINARI_SANDBOX_API
      : DINARI_API_BASE;
  }

  /**
   * Get Dinari authorization header
   */
  private getDinariAuthHeader(): string {
    if (!this.config.dinari) {
      throw new Error('Dinari configuration required for stock trading');
    }
    return `Bearer ${this.config.dinari.apiKeyId}:${this.config.dinari.apiSecretKey}`;
  }

  /**
   * Prepare a stock buy order with Dinari
   */
  async prepareStockBuy(params: StockBuyParams): Promise<{
    preparedOrderId: string;
    orderData: unknown;
    permitData: unknown;
  }> {
    if (!this.config.dinari) {
      throw new Error('Dinari configuration required for stock trading');
    }

    try {
      // Convert USD to USDC micro units (6 decimals)
      const paymentQuantity = Math.floor(params.amountUsd * 1_000_000);

      const response = await fetch(
        `${this.getDinariApiBase()}/v2/accounts/${params.accountId}/order-requests/stocks/eip155/prepare-proxied-order`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getDinariAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chain_id: 'eip155:8453', // Base chain
            order_side: 'BUY',
            order_tif: 'DAY',
            order_type: params.orderType || 'MARKET',
            stock_id: params.stockId,
            payment_token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
            payment_token_quantity: paymentQuantity,
            ...(params.limitPrice && { limit_price: params.limitPrice }),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(`Failed to prepare order: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const data = await response.json() as {
        id: string;
        order_typed_data: unknown;
        permit_typed_data: unknown;
      };

      return {
        preparedOrderId: data.id,
        orderData: data.order_typed_data,
        permitData: data.permit_typed_data,
      };
    } catch (error) {
      console.error('Error preparing stock buy:', error);
      throw error;
    }
  }

  /**
   * Execute a prepared stock order
   * Note: This requires EVM signing which is typically done client-side
   */
  async executeStockOrder(
    accountId: string,
    preparedOrderId: string,
    orderSignature: string,
    permitSignature: string
  ): Promise<StockOrderResult> {
    if (!this.config.dinari) {
      throw new Error('Dinari configuration required for stock trading');
    }

    try {
      const response = await fetch(
        `${this.getDinariApiBase()}/v2/accounts/${accountId}/order-requests/stocks/eip155/create-proxied-order`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getDinariAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prepared_proxied_order_id: preparedOrderId,
            order_signature: orderSignature,
            permit_signature: permitSignature,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(`Failed to execute order: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const data = await response.json() as {
        id: string;
        stock_id: string;
        stock_symbol: string;
        side: 'BUY' | 'SELL';
        status: string;
        filled_quantity?: number;
        fill_price?: number;
      };

      return {
        orderId: data.id,
        stockId: data.stock_id,
        symbol: data.stock_symbol,
        side: data.side,
        status: data.status === 'FILLED' ? 'filled' :
               data.status === 'CANCELLED' ? 'cancelled' :
               data.status === 'FAILED' ? 'failed' : 'pending',
        filledShares: data.filled_quantity,
        fillPrice: data.fill_price,
      };
    } catch (error) {
      console.error('Error executing stock order:', error);
      return {
        orderId: '',
        stockId: '',
        symbol: '',
        side: 'BUY',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get order status from Dinari
   */
  async getOrderStatus(accountId: string, orderId: string): Promise<StockOrderResult | null> {
    if (!this.config.dinari) {
      throw new Error('Dinari configuration required for stock trading');
    }

    try {
      const response = await fetch(
        `${this.getDinariApiBase()}/v2/accounts/${accountId}/orders/${orderId}`,
        {
          headers: {
            'Authorization': this.getDinariAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get order status: ${response.status}`);
      }

      const data = await response.json() as {
        id: string;
        stock_id: string;
        stock_symbol: string;
        side: 'BUY' | 'SELL';
        status: string;
        filled_quantity?: number;
        fill_price?: number;
      };

      return {
        orderId: data.id,
        stockId: data.stock_id,
        symbol: data.stock_symbol,
        side: data.side,
        status: data.status === 'FILLED' ? 'filled' :
               data.status === 'CANCELLED' ? 'cancelled' :
               data.status === 'FAILED' ? 'failed' : 'pending',
        filledShares: data.filled_quantity,
        fillPrice: data.fill_price,
      };
    } catch (error) {
      console.error('Error getting order status:', error);
      return null;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a token is a stablecoin
   */
  isStablecoin(mint: string): boolean {
    const stablecoins: string[] = [COMMON_TOKENS.USDC, COMMON_TOKENS.USDT];
    return stablecoins.includes(mint);
  }

  /**
   * Get the SOL balance of an account
   */
  async getSolBalance(publicKey: string): Promise<number> {
    const balance = await this.connection.getBalance(new PublicKey(publicKey));
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(signature: string, timeout = 60000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const status = await this.connection.getSignatureStatus(signature);

      if (status.value?.confirmationStatus === 'confirmed' ||
          status.value?.confirmationStatus === 'finalized') {
        return !status.value.err;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new TradingClient instance
 */
export function createTradingClient(config: SDKConfig, marketClient?: MarketDataClient): TradingClient {
  return new TradingClient(config, marketClient);
}
