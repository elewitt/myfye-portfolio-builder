/**
 * Myfye Agent SDK Types
 * Core type definitions for the portfolio builder SDK
 */

// ============================================================================
// Account Types
// ============================================================================

export interface Account {
  /** Unique account identifier */
  id: string;
  /** Solana wallet public key */
  publicKey: string;
  /** Optional EVM address for Dinari stocks (Base chain) */
  evmAddress?: string;
  /** Account creation timestamp */
  createdAt: Date;
  /** Account type */
  type: 'privy' | 'external';
}

export interface AccountConfig {
  /** Privy App ID for embedded wallet creation */
  privyAppId: string;
  /** Privy App Secret */
  privyAppSecret: string;
  /** Email for account association (optional) */
  email?: string;
}

// ============================================================================
// Token Types (Solana SPL Tokens)
// ============================================================================

export interface Token {
  /** Token mint address */
  mint: string;
  /** Token symbol (e.g., "SOL", "USDC") */
  symbol: string;
  /** Token name */
  name: string;
  /** Decimal places */
  decimals: number;
  /** Logo URI (optional) */
  logoURI?: string;
  /** CoinGecko ID for price data */
  coingeckoId?: string;
  /** Token tags (e.g., "stablecoin", "wrapped") */
  tags?: string[];
}

export interface TokenPrice {
  /** Token mint address */
  mint: string;
  /** Token symbol */
  symbol: string;
  /** Price in USD */
  priceUsd: number;
  /** 24h price change percentage */
  change24h?: number;
  /** Price timestamp */
  timestamp: Date;
}

export interface TokenBalance {
  /** Token mint address */
  mint: string;
  /** Token symbol */
  symbol: string;
  /** Raw balance (in smallest units) */
  rawBalance: bigint;
  /** Formatted balance (human-readable) */
  balance: number;
  /** USD value */
  valueUsd: number;
}

// ============================================================================
// Stock Types (Dinari RWA)
// ============================================================================

export interface Stock {
  /** Dinari stock ID */
  id: string;
  /** Stock ticker symbol (e.g., "AAPL", "TSLA") */
  symbol: string;
  /** Company name */
  name: string;
  /** Token address on Base chain */
  tokenAddress?: string;
  /** Stock category */
  category?: 'technology' | 'finance' | 'healthcare' | 'consumer' | 'energy' | 'other';
  /** Is trading enabled */
  tradingEnabled: boolean;
}

export interface StockPrice {
  /** Stock ID */
  id: string;
  /** Stock symbol */
  symbol: string;
  /** Price in USD */
  priceUsd: number;
  /** 24h price change percentage */
  change24h?: number;
  /** Market status */
  marketOpen: boolean;
  /** Price timestamp */
  timestamp: Date;
}

export interface StockBalance {
  /** Stock ID */
  id: string;
  /** Stock symbol */
  symbol: string;
  /** Number of shares (can be fractional) */
  shares: number;
  /** USD value */
  valueUsd: number;
}

// ============================================================================
// Portfolio Types
// ============================================================================

export interface Portfolio {
  /** Account public key */
  accountAddress: string;
  /** Token balances */
  tokens: TokenBalance[];
  /** Stock balances */
  stocks: StockBalance[];
  /** Total portfolio value in USD */
  totalValueUsd: number;
  /** Portfolio breakdown by asset class */
  allocation: PortfolioAllocation;
  /** Last updated timestamp */
  updatedAt: Date;
}

export interface PortfolioAllocation {
  /** Percentage in stablecoins */
  stablecoins: number;
  /** Percentage in SOL */
  sol: number;
  /** Percentage in other tokens */
  otherTokens: number;
  /** Percentage in RWA stocks */
  stocks: number;
}

export interface AllocationTarget {
  /** Target percentage (0-100) */
  percentage: number;
  /** Asset type */
  assetType: 'stablecoin' | 'sol' | 'token' | 'stock';
  /** Specific assets to include (optional) */
  assets?: string[];
}

export interface AllocationStrategy {
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Target allocations */
  targets: AllocationTarget[];
  /** Risk level */
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  /** Total investment amount in USD */
  totalInvestmentUsd: number;
}

// ============================================================================
// Trading Types
// ============================================================================

export interface SwapParams {
  /** Input token mint address */
  inputMint: string;
  /** Output token mint address */
  outputMint: string;
  /** Amount to swap (in input token units, human-readable) */
  amount: number;
  /** Slippage tolerance in basis points (default: 300 = 3%) */
  slippageBps?: number;
  /** User's public key */
  userPublicKey: string;
}

export interface SwapQuote {
  /** Input amount (raw) */
  inAmount: string;
  /** Output amount (raw) */
  outAmount: string;
  /** Price impact percentage */
  priceImpactPct: string;
  /** Route plan */
  routePlan: SwapRoutePlan[];
  /** Quote validity in seconds */
  validitySeconds?: number;
  /** Original quote response */
  raw: unknown;
}

export interface SwapRoutePlan {
  /** Swap info */
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  /** Percentage of the swap routed through this AMM */
  percent: number;
}

export interface SwapResult {
  /** Transaction signature */
  signature: string;
  /** Input token mint */
  inputMint: string;
  /** Output token mint */
  outputMint: string;
  /** Input amount (human-readable) */
  inputAmount: number;
  /** Output amount (human-readable) */
  outputAmount: number;
  /** Transaction status */
  status: 'success' | 'failed' | 'pending';
  /** Error message if failed */
  error?: string;
}

export interface StockBuyParams {
  /** Dinari stock ID */
  stockId: string;
  /** Amount in USD to spend */
  amountUsd: number;
  /** Dinari account ID */
  accountId: string;
  /** Order type */
  orderType?: 'MARKET' | 'LIMIT';
  /** Limit price (required for LIMIT orders) */
  limitPrice?: number;
}

export interface StockSellParams {
  /** Dinari stock ID */
  stockId: string;
  /** Number of shares to sell */
  shares: number;
  /** Dinari account ID */
  accountId: string;
  /** Order type */
  orderType?: 'MARKET' | 'LIMIT';
  /** Limit price (required for LIMIT orders) */
  limitPrice?: number;
}

export interface StockOrderResult {
  /** Order ID */
  orderId: string;
  /** Stock ID */
  stockId: string;
  /** Stock symbol */
  symbol: string;
  /** Order side */
  side: 'BUY' | 'SELL';
  /** Order status */
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  /** Filled shares (may be partial) */
  filledShares?: number;
  /** Fill price */
  fillPrice?: number;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface UserProfile {
  /** Risk tolerance level */
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  /** Investment goals */
  investmentGoals: ('growth' | 'income' | 'preservation' | 'speculation')[];
  /** Investment time horizon */
  timeHorizon: 'short' | 'medium' | 'long';
  /** Preferred asset types (optional) */
  preferredAssets?: string[];
  /** Excluded assets (optional) */
  excludedAssets?: string[];
  /** Total investment amount in USD */
  totalInvestment: number;
}

export interface ExecutionStep {
  /** Step type */
  type: 'swap' | 'stock_buy' | 'stock_sell';
  /** Asset involved */
  asset: string;
  /** Target amount in USD */
  amountUsd: number;
  /** Target percentage of portfolio */
  percentage: number;
  /** Execution status */
  status: 'pending' | 'executing' | 'completed' | 'failed';
  /** Result (if completed) */
  result?: SwapResult | StockOrderResult;
  /** Error message (if failed) */
  error?: string;
}

export interface ExecutionResult {
  /** Overall execution status */
  status: 'success' | 'partial' | 'failed';
  /** Execution steps */
  steps: ExecutionStep[];
  /** Summary of executed trades */
  summary: {
    totalTradesAttempted: number;
    totalTradesCompleted: number;
    totalValueTraded: number;
    errors: string[];
  };
  /** Final portfolio state */
  portfolio?: Portfolio;
}

export interface PortfolioSummary {
  /** Current portfolio state */
  portfolio: Portfolio;
  /** Comparison to target allocation */
  comparisonToTarget?: {
    target: AllocationStrategy;
    deviations: {
      assetType: string;
      targetPct: number;
      actualPct: number;
      deviationPct: number;
    }[];
  };
  /** Rebalancing recommendations */
  recommendations?: string[];
}

// ============================================================================
// SDK Configuration
// ============================================================================

export interface SDKConfig {
  /** Solana RPC URL */
  rpcUrl: string;
  /** Helius API key (for enhanced RPC) */
  heliusApiKey?: string;
  /** Privy configuration */
  privy?: {
    appId: string;
    appSecret: string;
  };
  /** Dinari configuration */
  dinari?: {
    apiKeyId: string;
    apiSecretKey: string;
    environment: 'sandbox' | 'production';
  };
  /** Network (devnet or mainnet) */
  network: 'devnet' | 'mainnet-beta';
}

// ============================================================================
// Common Token Addresses
// ============================================================================

export const COMMON_TOKENS = {
  // Stablecoins
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',

  // Major tokens
  SOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL

  // Wrapped tokens
  WBTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  WETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',

  // DeFi tokens
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',

  // Meme tokens
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
} as const;

// ============================================================================
// Jupiter API Types
// ============================================================================

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  maxAccounts?: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: SwapRoutePlan[];
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapInstructionsResponse {
  tokenLedgerInstruction?: unknown;
  computeBudgetInstructions: unknown[];
  setupInstructions: unknown[];
  swapInstruction: unknown;
  cleanupInstruction?: unknown;
  addressLookupTableAddresses: string[];
}
