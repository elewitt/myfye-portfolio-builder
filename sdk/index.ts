/**
 * Myfye Agent SDK
 *
 * A TypeScript SDK for building AI-powered portfolio management agents on Myfye.
 * Provides programmatic access to:
 * - Account creation via Privy embedded wallets
 * - Token market data and swaps via Jupiter
 * - RWA stock trading via Dinari
 * - Portfolio tracking and analysis
 *
 * @example
 * ```typescript
 * import { MyfyeSDK } from 'myfye-portfolio-builder/sdk';
 *
 * const sdk = new MyfyeSDK({
 *   rpcUrl: 'https://api.mainnet-beta.solana.com',
 *   network: 'mainnet-beta',
 *   privy: { appId: '...', appSecret: '...' },
 *   dinari: { apiKeyId: '...', apiSecretKey: '...', environment: 'production' },
 * });
 *
 * // Create an account
 * const account = await sdk.createAccount('user@example.com');
 *
 * // Get portfolio
 * const portfolio = await sdk.getPortfolio(account.publicKey);
 *
 * // Get token prices
 * const solPrice = await sdk.getTokenPrice('So11111111111111111111111111111111111111112');
 * ```
 */

import { AccountClient, createAccountClient } from './account.js';
import { MarketDataClient, createMarketDataClient } from './market.js';
import { TradingClient, createTradingClient } from './trading.js';
import { PortfolioClient, createPortfolioClient } from './portfolio.js';
import {
  SDKConfig,
  Account,
  Token,
  TokenPrice,
  Stock,
  StockPrice,
  Portfolio,
  SwapParams,
  SwapQuote,
  SwapResult,
  StockBuyParams,
  StockOrderResult,
  JupiterQuoteParams,
  JupiterQuoteResponse,
  COMMON_TOKENS,
} from './types.js';
import { Keypair } from '@solana/web3.js';

/**
 * Main SDK class that provides a unified interface to all Myfye functionality
 */
export class MyfyeSDK {
  private config: SDKConfig;
  private accountClient: AccountClient;
  private marketClient: MarketDataClient;
  private tradingClient: TradingClient;
  private portfolioClient: PortfolioClient;

  constructor(config: SDKConfig) {
    this.config = config;
    this.accountClient = createAccountClient(config);
    this.marketClient = createMarketDataClient(config);
    this.tradingClient = createTradingClient(config, this.marketClient);
    this.portfolioClient = createPortfolioClient(config, this.marketClient);
  }

  // ============================================================================
  // Account Methods
  // ============================================================================

  /**
   * Create a new self-custodied account with embedded Solana wallet
   */
  async createAccount(email?: string): Promise<Account> {
    return this.accountClient.createAccount(email);
  }

  /**
   * Get account by Privy user ID
   */
  async getAccountById(userId: string): Promise<Account | null> {
    return this.accountClient.getAccountById(userId);
  }

  /**
   * Get account by Solana wallet address
   */
  async getAccountByAddress(address: string): Promise<Account | null> {
    return this.accountClient.getAccountByAddress(address);
  }

  /**
   * Create an account wrapper for an external wallet
   */
  createExternalAccount(publicKey: string, evmAddress?: string): Account {
    return this.accountClient.createExternalAccount(publicKey, evmAddress);
  }

  // ============================================================================
  // Market Data Methods
  // ============================================================================

  /**
   * Get list of verified tokens
   */
  async getAvailableTokens(): Promise<Token[]> {
    return this.marketClient.getAvailableTokens();
  }

  /**
   * Get token info by mint address
   */
  async getToken(mint: string): Promise<Token | null> {
    return this.marketClient.getToken(mint);
  }

  /**
   * Get token price
   */
  async getTokenPrice(mint: string): Promise<TokenPrice | null> {
    return this.marketClient.getTokenPrice(mint);
  }

  /**
   * Get prices for multiple tokens
   */
  async getTokenPrices(mints: string[]): Promise<Map<string, TokenPrice>> {
    return this.marketClient.getTokenPrices(mints);
  }

  /**
   * Get available stocks (RWA)
   */
  async getAvailableStocks(): Promise<Stock[]> {
    return this.marketClient.getAvailableStocks();
  }

  /**
   * Get stock price
   */
  async getStockPrice(stockId: string): Promise<StockPrice | null> {
    return this.marketClient.getStockPrice(stockId);
  }

  /**
   * Get a swap quote from Jupiter
   */
  async getSwapQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse> {
    return this.marketClient.getSwapQuote(params);
  }

  // ============================================================================
  // Trading Methods
  // ============================================================================

  /**
   * Get a detailed swap quote
   */
  async getDetailedSwapQuote(params: SwapParams): Promise<SwapQuote> {
    return this.tradingClient.getSwapQuote(params);
  }

  /**
   * Simulate a swap (get quote without executing)
   */
  async simulateSwap(params: SwapParams): Promise<{
    quote: SwapQuote;
    estimatedOutputAmount: number;
    priceImpact: number;
  }> {
    return this.tradingClient.simulateSwap(params);
  }

  /**
   * Execute a token swap
   */
  async executeSwap(params: SwapParams, signer: Keypair): Promise<SwapResult> {
    return this.tradingClient.executeSwap(params, signer);
  }

  /**
   * Prepare a stock buy order
   */
  async prepareStockBuy(params: StockBuyParams): Promise<{
    preparedOrderId: string;
    orderData: unknown;
    permitData: unknown;
  }> {
    return this.tradingClient.prepareStockBuy(params);
  }

  /**
   * Execute a prepared stock order
   */
  async executeStockOrder(
    accountId: string,
    preparedOrderId: string,
    orderSignature: string,
    permitSignature: string
  ): Promise<StockOrderResult> {
    return this.tradingClient.executeStockOrder(accountId, preparedOrderId, orderSignature, permitSignature);
  }

  /**
   * Get stock order status
   */
  async getOrderStatus(accountId: string, orderId: string): Promise<StockOrderResult | null> {
    return this.tradingClient.getOrderStatus(accountId, orderId);
  }

  // ============================================================================
  // Portfolio Methods
  // ============================================================================

  /**
   * Get full portfolio for an account
   */
  async getPortfolio(accountAddress: string): Promise<Portfolio> {
    return this.portfolioClient.getPortfolio(accountAddress);
  }

  /**
   * Get token balances for an account
   */
  async getTokenBalances(accountAddress: string): Promise<import('./types.js').TokenBalance[]> {
    return this.portfolioClient.getTokenBalances(accountAddress);
  }

  /**
   * Get a specific token balance
   */
  async getTokenBalance(accountAddress: string, mint: string): Promise<import('./types.js').TokenBalance | null> {
    return this.portfolioClient.getTokenBalance(accountAddress, mint);
  }

  /**
   * Get total portfolio value in USD
   */
  async getTotalValueUsd(accountAddress: string): Promise<number> {
    return this.portfolioClient.getTotalValueUsd(accountAddress);
  }

  /**
   * Check if portfolio needs rebalancing
   */
  needsRebalancing(
    portfolio: Portfolio,
    targetAllocations: { stablecoins: number; sol: number; otherTokens: number; stocks: number },
    thresholdPct?: number
  ): boolean {
    return this.portfolioClient.needsRebalancing(portfolio, targetAllocations, thresholdPct);
  }

  /**
   * Compare portfolio to target allocation
   */
  compareToTarget(
    portfolio: Portfolio,
    targetAllocations: { stablecoins: number; sol: number; otherTokens: number; stocks: number }
  ): Array<{ assetType: string; targetPct: number; actualPct: number; deviationPct: number }> {
    return this.portfolioClient.compareToTarget(portfolio, targetAllocations);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the SDK configuration
   */
  getConfig(): SDKConfig {
    return { ...this.config };
  }

  /**
   * Get direct access to sub-clients for advanced usage
   */
  getClients() {
    return {
      account: this.accountClient,
      market: this.marketClient,
      trading: this.tradingClient,
      portfolio: this.portfolioClient,
    };
  }
}

// ============================================================================
// Re-exports
// ============================================================================

// Types
export * from './types.js';

// Individual clients
export { AccountClient, createAccountClient } from './account.js';
export { MarketDataClient, createMarketDataClient } from './market.js';
export { TradingClient, createTradingClient } from './trading.js';
export { PortfolioClient, createPortfolioClient } from './portfolio.js';

// Agent Wallet - Simple interface for AI agents
export { AgentWallet, createAgentWallet, TOKENS } from './agent-wallet.js';
export type { AgentWalletConfig, Wallet, SwapResult as AgentSwapResult, TokenBalance as AgentTokenBalance, Portfolio as AgentPortfolio } from './agent-wallet.js';

// Convenience exports
export { COMMON_TOKENS };

/**
 * Create a new MyfyeSDK instance
 */
export function createMyfyeSDK(config: SDKConfig): MyfyeSDK {
  return new MyfyeSDK(config);
}
