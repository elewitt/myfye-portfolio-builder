/**
 * Myfye Agent Wallet SDK
 *
 * Simple interface for AI agents to create wallets and execute trades on Solana.
 * Uses Privy server wallets + Jupiter for swaps.
 */

import { Connection, PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';

export interface AgentWalletConfig {
  privyAppId: string;
  privyAppSecret: string;
  rpcUrl?: string;
}

export interface Wallet {
  id: string;
  address: string;
  chainType: string;
}

export interface SwapResult {
  success: boolean;
  txSignature?: string;
  error?: string;
  inputAmount: string;
  outputAmount: string;
}

export interface TokenBalance {
  mint: string;
  symbol?: string;
  amount: number;
  decimals: number;
}

export interface Portfolio {
  solBalance: number;
  tokens: TokenBalance[];
}

// Common token mints
export const TOKENS = {
  // Native & Stablecoins
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  USDY: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
  EURC: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
  // DeFi tokens
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  // xStocks (Tokenized Stocks by Backed Finance)
  SPYx: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',   // S&P 500 ETF
  QQQx: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ',   // NASDAQ 100 ETF
  TSLAx: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',  // Tesla
  AAPLx: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp',  // Apple
  NVDAx: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',  // NVIDIA
  GOOGLx: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN', // Google
  AMZNx: 'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg',  // Amazon
} as const;

// API response types
interface PrivyWalletResponse {
  id: string;
  address: string;
  chain_type: string;
}

interface PrivyErrorResponse {
  error?: string;
}

interface JupiterQuoteResponse {
  inAmount: string;
  outAmount: string;
  error?: string;
}

interface JupiterInstructionAccount {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

interface JupiterInstruction {
  programId: string;
  accounts: JupiterInstructionAccount[];
  data: string;
}

interface JupiterSwapInstructionsResponse {
  error?: string;
  computeBudgetInstructions?: JupiterInstruction[];
  setupInstructions?: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction?: JupiterInstruction;
}

interface PrivySignResponse {
  error?: string;
  data?: {
    signed_transaction: string;
  };
}

/**
 * AgentWallet - Simple wallet management and trading for AI agents
 */
export class AgentWallet {
  private config: AgentWalletConfig;
  private connection: Connection;
  private walletId: string | null = null;
  private walletAddress: string | null = null;

  constructor(config: AgentWalletConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl || 'https://api.mainnet-beta.solana.com');
  }

  private getAuthHeader(): string {
    return Buffer.from(`${this.config.privyAppId}:${this.config.privyAppSecret}`).toString('base64');
  }

  /**
   * Create a new server wallet for this agent
   */
  async createWallet(): Promise<Wallet> {
    const response = await fetch('https://api.privy.io/v1/wallets', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'privy-app-id': this.config.privyAppId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chain_type: 'solana' }),
    });

    if (!response.ok) {
      const error = await response.json() as PrivyErrorResponse;
      throw new Error(`Failed to create wallet: ${error.error || response.statusText}`);
    }

    const wallet = await response.json() as PrivyWalletResponse;
    this.walletId = wallet.id;
    this.walletAddress = wallet.address;

    return {
      id: wallet.id,
      address: wallet.address,
      chainType: wallet.chain_type,
    };
  }

  /**
   * Load an existing wallet by ID
   */
  async loadWallet(walletId: string): Promise<Wallet> {
    const response = await fetch(`https://api.privy.io/v1/wallets/${walletId}`, {
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'privy-app-id': this.config.privyAppId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load wallet: ${response.statusText}`);
    }

    const wallet = await response.json() as PrivyWalletResponse;
    this.walletId = wallet.id;
    this.walletAddress = wallet.address;

    return {
      id: wallet.id,
      address: wallet.address,
      chainType: wallet.chain_type,
    };
  }

  /**
   * Get current wallet address
   */
  getAddress(): string {
    if (!this.walletAddress) {
      throw new Error('No wallet loaded. Call createWallet() or loadWallet() first.');
    }
    return this.walletAddress;
  }

  /**
   * Get portfolio (SOL + token balances)
   */
  async getPortfolio(): Promise<Portfolio> {
    const address = this.getAddress();

    // Get SOL balance
    const solBalance = await this.connection.getBalance(new PublicKey(address));

    // Get token accounts
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      new PublicKey(address),
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    const tokens: TokenBalance[] = tokenAccounts.value
      .map(acc => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: info.tokenAmount.uiAmount || 0,
          decimals: info.tokenAmount.decimals,
        };
      })
      .filter(t => t.amount > 0);

    // Add symbol names for known tokens
    for (const token of tokens) {
      for (const [symbol, mint] of Object.entries(TOKENS)) {
        if (token.mint === mint) {
          token.symbol = symbol;
          break;
        }
      }
    }

    return {
      solBalance: solBalance / 1e9,
      tokens,
    };
  }

  /**
   * Get a swap quote from Jupiter
   */
  async getQuote(inputMint: string, outputMint: string, amount: string, slippageBps = 300): Promise<JupiterQuoteResponse> {
    const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&maxAccounts=20`;

    const response = await fetch(url);
    const quote = await response.json() as JupiterQuoteResponse;

    if (quote.error || !quote.outAmount) {
      throw new Error(quote.error || 'No route found for this swap');
    }

    return quote;
  }

  /**
   * Execute a swap
   */
  async swap(inputMint: string, outputMint: string, amount: string, slippageBps = 300): Promise<SwapResult> {
    if (!this.walletId || !this.walletAddress) {
      throw new Error('No wallet loaded. Call createWallet() or loadWallet() first.');
    }

    try {
      // 1. Get quote
      const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);

      // 2. Get swap instructions
      const swapResponse = await fetch('https://lite-api.jup.ag/swap/v1/swap-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: this.walletAddress,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: { maxBps: slippageBps },
        }),
      });

      const instructions = await swapResponse.json() as JupiterSwapInstructionsResponse;
      if (instructions.error) {
        throw new Error(instructions.error);
      }

      // 3. Build transaction
      const allInstructions: TransactionInstruction[] = [];

      for (const ix of instructions.computeBudgetInstructions || []) {
        allInstructions.push(new TransactionInstruction({
          programId: new PublicKey(ix.programId),
          keys: ix.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
          data: Buffer.from(ix.data, 'base64'),
        }));
      }

      for (const ix of instructions.setupInstructions || []) {
        allInstructions.push(new TransactionInstruction({
          programId: new PublicKey(ix.programId),
          keys: ix.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
          data: Buffer.from(ix.data, 'base64'),
        }));
      }

      allInstructions.push(new TransactionInstruction({
        programId: new PublicKey(instructions.swapInstruction.programId),
        keys: instructions.swapInstruction.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
        data: Buffer.from(instructions.swapInstruction.data, 'base64'),
      }));

      if (instructions.cleanupInstruction) {
        allInstructions.push(new TransactionInstruction({
          programId: new PublicKey(instructions.cleanupInstruction.programId),
          keys: instructions.cleanupInstruction.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
          data: Buffer.from(instructions.cleanupInstruction.data, 'base64'),
        }));
      }

      // 4. Create versioned transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: new PublicKey(this.walletAddress),
        recentBlockhash: blockhash,
        instructions: allInstructions,
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);

      // 5. Sign with Privy
      const serializedTx = Buffer.from(tx.serialize()).toString('base64');
      const signResponse = await fetch(`https://api.privy.io/v1/wallets/${this.walletId}/rpc`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getAuthHeader()}`,
          'privy-app-id': this.config.privyAppId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'signTransaction',
          params: { transaction: serializedTx, encoding: 'base64' },
        }),
      });

      const signResult = await signResponse.json() as PrivySignResponse;
      if (signResult.error) {
        throw new Error(signResult.error);
      }

      // 6. Submit to Solana
      const signedTxBytes = Buffer.from(signResult.data!.signed_transaction, 'base64');
      const txSignature = await this.connection.sendRawTransaction(signedTxBytes, { skipPreflight: true });

      return {
        success: true,
        txSignature,
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        inputAmount: amount,
        outputAmount: '0',
      };
    }
  }

  /**
   * Convenience method: Swap SOL for a token
   */
  async buyToken(tokenMint: string, solAmount: number): Promise<SwapResult> {
    const lamports = Math.floor(solAmount * 1e9).toString();
    return this.swap(TOKENS.SOL, tokenMint, lamports);
  }

  /**
   * Convenience method: Swap a token for SOL
   */
  async sellToken(tokenMint: string, amount: number, decimals: number): Promise<SwapResult> {
    const rawAmount = Math.floor(amount * Math.pow(10, decimals)).toString();
    return this.swap(tokenMint, TOKENS.SOL, rawAmount);
  }
}

/**
 * Create a new agent wallet instance
 */
export function createAgentWallet(config: AgentWalletConfig): AgentWallet {
  return new AgentWallet(config);
}
