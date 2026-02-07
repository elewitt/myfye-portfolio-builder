/**
 * Portfolio Builder Agent Types
 * Types specific to the autonomous portfolio builder
 */

import { AllocationStrategy, Portfolio, ExecutionResult } from '../sdk/types.js';

/**
 * User investment profile
 */
export interface UserProfile {
  /** Risk tolerance level */
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  /** Investment goals */
  investmentGoals: ('growth' | 'income' | 'preservation' | 'speculation')[];
  /** Investment time horizon */
  timeHorizon: 'short' | 'medium' | 'long';
  /** Preferred assets (optional) */
  preferredAssets?: string[];
  /** Assets to exclude (optional) */
  excludedAssets?: string[];
  /** Total investment amount in USD */
  totalInvestment: number;
}

/**
 * Asset allocation target
 */
export interface AllocationTarget {
  /** Asset type category */
  assetType: 'stablecoin' | 'sol' | 'token' | 'stock';
  /** Target percentage of portfolio (0-100) */
  percentage: number;
  /** Specific assets within this category */
  assets: AssetAllocation[];
}

/**
 * Individual asset allocation
 */
export interface AssetAllocation {
  /** Asset identifier (mint address for tokens, stock ID for stocks) */
  id: string;
  /** Asset symbol */
  symbol: string;
  /** Target percentage within the category */
  percentageOfCategory: number;
  /** Target amount in USD */
  targetAmountUsd?: number;
}

/**
 * Strategy definition
 */
export interface StrategyDefinition {
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Risk level */
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  /** Target allocations */
  allocations: {
    stablecoins: number;
    sol: number;
    otherTokens: number;
    stocks: number;
  };
  /** Recommended tokens for each category */
  recommendedAssets: {
    stablecoins: AssetAllocation[];
    tokens: AssetAllocation[];
    stocks: AssetAllocation[];
  };
}

/**
 * Trade to execute
 */
export interface PlannedTrade {
  /** Trade type */
  type: 'swap' | 'stock_buy' | 'stock_sell';
  /** Source asset (for swaps) */
  fromAsset?: string;
  /** Destination asset */
  toAsset: string;
  /** Amount in USD */
  amountUsd: number;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Reason for the trade */
  reason: string;
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  /** Strategy being executed */
  strategy: StrategyDefinition;
  /** Current portfolio state */
  currentPortfolio: Portfolio;
  /** Planned trades */
  trades: PlannedTrade[];
  /** Total USD value to trade */
  totalTradeValueUsd: number;
  /** Estimated gas/fees in USD */
  estimatedFeesUsd: number;
  /** Warnings or notes */
  warnings: string[];
}

/**
 * Portfolio analysis result
 */
export interface PortfolioAnalysis {
  /** Current portfolio */
  portfolio: Portfolio;
  /** Recommended strategy based on user profile */
  recommendedStrategy: StrategyDefinition;
  /** Current vs target comparison */
  comparison: {
    assetType: string;
    currentPct: number;
    targetPct: number;
    deviationPct: number;
    action: 'buy' | 'sell' | 'hold';
  }[];
  /** Overall health score (0-100) */
  healthScore: number;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Rebalancing result
 */
export interface RebalanceResult {
  /** Whether rebalancing was needed */
  rebalanceNeeded: boolean;
  /** Execution result (if rebalanced) */
  executionResult?: ExecutionResult;
  /** Before portfolio */
  before: Portfolio;
  /** After portfolio (if rebalanced) */
  after?: Portfolio;
  /** Summary */
  summary: string;
}

/**
 * Portfolio builder configuration
 */
export interface PortfolioBuilderConfig {
  /** Minimum trade size in USD (skip smaller trades) */
  minTradeSize: number;
  /** Maximum slippage tolerance in basis points */
  maxSlippageBps: number;
  /** Rebalance threshold percentage */
  rebalanceThresholdPct: number;
  /** Whether to execute trades automatically */
  autoExecute: boolean;
  /** Whether to include stocks (requires Dinari) */
  includeStocks: boolean;
  /** Dry run mode (simulate only) */
  dryRun: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: PortfolioBuilderConfig = {
  minTradeSize: 10, // $10 minimum
  maxSlippageBps: 300, // 3%
  rebalanceThresholdPct: 5, // 5% deviation triggers rebalance
  autoExecute: false,
  includeStocks: false,
  dryRun: true,
};
