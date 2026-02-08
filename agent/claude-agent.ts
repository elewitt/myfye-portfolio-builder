/**
 * Claude-Powered Portfolio Agent
 *
 * An AI agent that uses Claude to understand natural language investment
 * commands and autonomously manage portfolios on Solana.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Connection, PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';

// Token registry
const TOKENS: Record<string, { mint: string; decimals: number; type: 'stablecoin' | 'crypto' | 'stock' }> = {
  // Stablecoins
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, type: 'stablecoin' },
  USDY: { mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6', decimals: 6, type: 'stablecoin' },
  EURC: { mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', decimals: 6, type: 'stablecoin' },
  // Crypto
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9, type: 'crypto' },
  // xStocks - ETFs
  SPYx: { mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', decimals: 8, type: 'stock' },
  QQQx: { mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ', decimals: 8, type: 'stock' },
  GLDx: { mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re', decimals: 8, type: 'stock' },
  // xStocks - Tech
  AAPLx: { mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', decimals: 8, type: 'stock' },
  MSFTx: { mint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX', decimals: 8, type: 'stock' },
  GOOGLx: { mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN', decimals: 8, type: 'stock' },
  AMZNx: { mint: 'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg', decimals: 8, type: 'stock' },
  METAx: { mint: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu', decimals: 8, type: 'stock' },
  NVDAx: { mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', decimals: 8, type: 'stock' },
  TSLAx: { mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', decimals: 8, type: 'stock' },
  // xStocks - Crypto-related
  COINx: { mint: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu', decimals: 8, type: 'stock' },
  MSTRx: { mint: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ', decimals: 8, type: 'stock' },
  HOODx: { mint: 'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg', decimals: 8, type: 'stock' },
};

export interface AgentConfig {
  anthropicApiKey: string;
  privyAppId: string;
  privyAppSecret: string;
  walletId: string;
  walletAddress: string;
  rpcUrl?: string;
}

interface PortfolioHolding {
  symbol: string;
  amount: number;
  rawAmount: string;
  valueUsd: number;
  percentage: number;
}

interface Portfolio {
  holdings: PortfolioHolding[];
  totalValueUsd: number;
}

interface SwapAction {
  type: 'swap';
  fromToken: string;
  toToken: string;
  amount: string;
  reason: string;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// API response types
interface JupiterQuoteResponse {
  error?: string;
  outAmount?: string;
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

interface JupiterSwapResponse {
  error?: string;
  computeBudgetInstructions?: JupiterInstruction[];
  setupInstructions?: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction?: JupiterInstruction;
}

interface PrivySignResponse {
  error?: unknown;
  data?: {
    signed_transaction: string;
  };
}

// Approximate prices (in production, fetch from API)
const PRICES: Record<string, number> = {
  SOL: 87,
  USDC: 1,
  USDY: 1.12,
  EURC: 1.04,
  SPYx: 690,
  QQQx: 612,
  GLDx: 285,
  AAPLx: 248,
  MSFTx: 455,
  GOOGLx: 202,
  AMZNx: 233,
  METAx: 725,
  NVDAx: 185,
  TSLAx: 410,
  COINx: 165,
  MSTRx: 133,
  HOODx: 56,
};

export class ClaudePortfolioAgent {
  private anthropic: Anthropic;
  private config: AgentConfig;
  private connection: Connection;
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    this.connection = new Connection(config.rpcUrl || 'https://api.mainnet-beta.solana.com');
  }

  private getSystemPrompt(): string {
    return `You are an autonomous AI portfolio manager for Solana. You help users manage their crypto and tokenized stock portfolios.

AVAILABLE TOKENS:
Stablecoins: USDC, USDY, EURC
Crypto: SOL
Tokenized Stocks (xStocks): SPYx (S&P 500), QQQx (NASDAQ), GLDx (Gold), AAPLx (Apple), MSFTx (Microsoft), GOOGLx (Google), AMZNx (Amazon), METAx (Meta), NVDAx (NVIDIA), TSLAx (Tesla), COINx (Coinbase), MSTRx (MicroStrategy), HOODx (Robinhood)

INVESTMENT STRATEGIES:
- Conservative: Focus on stablecoins (60-70%), some SOL (10-15%), blue-chip stocks like SPYx, AAPLx, MSFTx (20-25%)
- Moderate: Balanced mix of stablecoins (30-40%), SOL (20-30%), diversified stocks (30-40%)
- Aggressive: Heavy on volatile assets - TSLAx, NVDAx, MSTRx, COINx, more SOL (60%+), minimal stablecoins

PORTFOLIO BUILDING PRINCIPLES:
- For retirement/long-term: More conservative, dividend-paying stocks, index funds (SPYx, QQQx)
- For growth: Tech stocks (NVDAx, TSLAx, METAx), crypto exposure (SOL, COINx, MSTRx)
- For income: Stablecoins (USDY pays yield), stable stocks
- For speculation: High-volatility picks (MSTRx, TSLAx, COINx, HOODx)

When the user asks you to build a portfolio or make trades:
1. Analyze their request and risk profile
2. Decide on the allocation
3. Call the appropriate tools to execute trades
4. Explain your reasoning

Always be helpful, explain your investment thesis, and warn about risks when appropriate.`;
  }

  private getTools(): Anthropic.Tool[] {
    return [
      {
        name: 'get_portfolio',
        description: 'Get the current portfolio holdings and their values',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'swap_tokens',
        description: 'Swap one token for another. Use this to rebalance the portfolio or buy/sell tokens.',
        input_schema: {
          type: 'object' as const,
          properties: {
            from_token: {
              type: 'string',
              description: 'The token symbol to sell (e.g., USDC, SOL, TSLAx)',
            },
            to_token: {
              type: 'string',
              description: 'The token symbol to buy (e.g., USDC, SOL, TSLAx)',
            },
            amount_usd: {
              type: 'number',
              description: 'The approximate USD value to swap',
            },
          },
          required: ['from_token', 'to_token', 'amount_usd'],
        },
      },
      {
        name: 'get_available_tokens',
        description: 'Get a list of all available tokens that can be traded',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
    ];
  }

  async getPortfolio(): Promise<Portfolio> {
    const holdings: PortfolioHolding[] = [];
    let totalValueUsd = 0;

    // Get SOL balance
    const solBalance = await this.connection.getBalance(new PublicKey(this.config.walletAddress));
    const solAmount = solBalance / 1e9;
    if (solAmount > 0.001) {
      const solValue = solAmount * PRICES.SOL;
      holdings.push({
        symbol: 'SOL',
        amount: solAmount,
        rawAmount: solBalance.toString(),
        valueUsd: solValue,
        percentage: 0,
      });
      totalValueUsd += solValue;
    }

    // Get SPL token balances
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      new PublicKey(this.config.walletAddress),
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    // Get Token-2022 balances (for xStocks)
    const token2022Accounts = await this.connection.getParsedTokenAccountsByOwner(
      new PublicKey(this.config.walletAddress),
      { programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') }
    );

    const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];

    for (const acc of allAccounts) {
      const info = acc.account.data.parsed.info;
      const amount = info.tokenAmount.uiAmount || 0;
      if (amount === 0) continue;

      // Find token symbol
      let symbol = 'UNKNOWN';
      for (const [sym, token] of Object.entries(TOKENS)) {
        if (token.mint === info.mint) {
          symbol = sym;
          break;
        }
      }

      const price = PRICES[symbol] || 1;
      const valueUsd = amount * price;

      holdings.push({
        symbol,
        amount,
        rawAmount: info.tokenAmount.amount,
        valueUsd,
        percentage: 0,
      });
      totalValueUsd += valueUsd;
    }

    // Calculate percentages
    for (const h of holdings) {
      h.percentage = totalValueUsd > 0 ? (h.valueUsd / totalValueUsd) * 100 : 0;
    }

    // Sort by value
    holdings.sort((a, b) => b.valueUsd - a.valueUsd);

    return { holdings, totalValueUsd };
  }

  async executeSwap(fromToken: string, toToken: string, amountUsd: number): Promise<ToolResult> {
    const fromTokenInfo = TOKENS[fromToken];
    const toTokenInfo = TOKENS[toToken];

    if (!fromTokenInfo || !toTokenInfo) {
      return { success: false, error: `Unknown token: ${!fromTokenInfo ? fromToken : toToken}` };
    }

    // Calculate raw amount based on USD value
    const fromPrice = PRICES[fromToken] || 1;
    const tokenAmount = amountUsd / fromPrice;
    const rawAmount = Math.floor(tokenAmount * Math.pow(10, fromTokenInfo.decimals)).toString();

    try {
      // Get quote
      const quoteRes = await fetch(
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${fromTokenInfo.mint}&outputMint=${toTokenInfo.mint}&amount=${rawAmount}&slippageBps=300&maxAccounts=20`
      );
      const quote = await quoteRes.json() as JupiterQuoteResponse;

      if (quote.error || !quote.outAmount) {
        return { success: false, error: quote.error || 'No route found' };
      }

      // Get swap instructions
      const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: this.config.walletAddress,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: { maxBps: 300 },
        }),
      });
      const instructions = await swapRes.json() as JupiterSwapResponse;

      if (instructions.error) {
        return { success: false, error: instructions.error };
      }

      // Build transaction
      const allInstructions: TransactionInstruction[] = [];

      for (const ix of instructions.computeBudgetInstructions || []) {
        allInstructions.push(new TransactionInstruction({
          programId: new PublicKey(ix.programId),
          keys: ix.accounts.map((a: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
            pubkey: new PublicKey(a.pubkey),
            isSigner: a.isSigner,
            isWritable: a.isWritable,
          })),
          data: Buffer.from(ix.data, 'base64'),
        }));
      }

      for (const ix of instructions.setupInstructions || []) {
        allInstructions.push(new TransactionInstruction({
          programId: new PublicKey(ix.programId),
          keys: ix.accounts.map((a: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
            pubkey: new PublicKey(a.pubkey),
            isSigner: a.isSigner,
            isWritable: a.isWritable,
          })),
          data: Buffer.from(ix.data, 'base64'),
        }));
      }

      allInstructions.push(new TransactionInstruction({
        programId: new PublicKey(instructions.swapInstruction.programId),
        keys: instructions.swapInstruction.accounts.map((a: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable,
        })),
        data: Buffer.from(instructions.swapInstruction.data, 'base64'),
      }));

      if (instructions.cleanupInstruction) {
        allInstructions.push(new TransactionInstruction({
          programId: new PublicKey(instructions.cleanupInstruction.programId),
          keys: instructions.cleanupInstruction.accounts.map((a: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
            pubkey: new PublicKey(a.pubkey),
            isSigner: a.isSigner,
            isWritable: a.isWritable,
          })),
          data: Buffer.from(instructions.cleanupInstruction.data, 'base64'),
        }));
      }

      // Create and sign transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: new PublicKey(this.config.walletAddress),
        recentBlockhash: blockhash,
        instructions: allInstructions,
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);
      const serializedTx = Buffer.from(tx.serialize()).toString('base64');

      // Sign with Privy
      const authHeader = Buffer.from(`${this.config.privyAppId}:${this.config.privyAppSecret}`).toString('base64');
      const signRes = await fetch(`https://api.privy.io/v1/wallets/${this.config.walletId}/rpc`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'privy-app-id': this.config.privyAppId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'signTransaction',
          params: { transaction: serializedTx, encoding: 'base64' },
        }),
      });

      const signResult = await signRes.json() as PrivySignResponse;
      if (signResult.error) {
        return { success: false, error: JSON.stringify(signResult.error) };
      }

      // Submit to Solana
      const signedTxBytes = Buffer.from(signResult.data!.signed_transaction, 'base64');
      const txSignature = await this.connection.sendRawTransaction(signedTxBytes, { skipPreflight: true });

      return {
        success: true,
        data: {
          txSignature,
          fromToken,
          toToken,
          amountUsd,
          explorerUrl: `https://solscan.io/tx/${txSignature}`,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async handleToolCall(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'get_portfolio': {
        const portfolio = await this.getPortfolio();
        let result = `Portfolio Value: $${portfolio.totalValueUsd.toFixed(2)}\n\nHoldings:\n`;
        for (const h of portfolio.holdings) {
          result += `- ${h.symbol}: ${h.amount.toFixed(6)} ($${h.valueUsd.toFixed(2)}) - ${h.percentage.toFixed(1)}%\n`;
        }
        return result;
      }

      case 'swap_tokens': {
        const fromToken = input.from_token as string;
        const toToken = input.to_token as string;
        const amountUsd = input.amount_usd as number;

        console.log(`\n[Executing swap: $${amountUsd} ${fromToken} → ${toToken}]`);
        const result = await this.executeSwap(fromToken, toToken, amountUsd);

        if (result.success) {
          const data = result.data as { txSignature: string; explorerUrl: string };
          console.log(`[Success: ${data.explorerUrl}]`);
          return `Swap executed successfully!\nTransaction: ${data.explorerUrl}`;
        } else {
          console.log(`[Failed: ${result.error}]`);
          return `Swap failed: ${result.error}`;
        }
      }

      case 'get_available_tokens': {
        let result = 'Available tokens:\n\n';
        result += 'STABLECOINS:\n- USDC, USDY, EURC\n\n';
        result += 'CRYPTO:\n- SOL\n\n';
        result += 'TOKENIZED STOCKS (xStocks):\n';
        result += '- ETFs: SPYx (S&P 500), QQQx (NASDAQ), GLDx (Gold)\n';
        result += '- Tech: AAPLx, MSFTx, GOOGLx, AMZNx, METAx, NVDAx, TSLAx\n';
        result += '- Crypto-related: COINx, MSTRx, HOODx\n';
        return result;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    let response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      tools: this.getTools(),
      messages: this.conversationHistory,
    });

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await this.handleToolCall(toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add assistant response and tool results to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      this.conversationHistory.push({
        role: 'user',
        content: toolResults,
      });

      // Continue the conversation
      response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        tools: this.getTools(),
        messages: this.conversationHistory,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const finalResponse = textBlocks.map(b => b.text).join('\n');

    // Add final response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return finalResponse;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}

export function createClaudeAgent(config: AgentConfig): ClaudePortfolioAgent {
  return new ClaudePortfolioAgent(config);
}
