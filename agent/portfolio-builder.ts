/**
 * Portfolio Builder Agent
 *
 * Autonomous agent that analyzes user profiles, constructs portfolios,
 * and executes trades to achieve target allocations.
 */

import { Keypair } from '@solana/web3.js';
import { MyfyeSDK } from '../sdk/index.js';
import {
  Portfolio,
  SwapParams,
  SwapResult,
  ExecutionStep,
  ExecutionResult,
  SDKConfig,
  COMMON_TOKENS,
} from '../sdk/types.js';
import {
  UserProfile,
  StrategyDefinition,
  PlannedTrade,
  ExecutionPlan,
  PortfolioAnalysis,
  RebalanceResult,
  PortfolioBuilderConfig,
  DEFAULT_CONFIG,
} from './types.js';
import { getStrategy } from './strategies/index.js';

/**
 * Portfolio Builder Agent
 */
export class PortfolioBuilderAgent {
  private sdk: MyfyeSDK;
  private config: PortfolioBuilderConfig;

  constructor(sdkConfig: SDKConfig, builderConfig: Partial<PortfolioBuilderConfig> = {}) {
    this.sdk = new MyfyeSDK(sdkConfig);
    this.config = { ...DEFAULT_CONFIG, ...builderConfig };
  }

  // ============================================================================
  // Profile Analysis
  // ============================================================================

  /**
   * Analyze a user profile and recommend a strategy
   */
  analyzeProfile(profile: UserProfile): StrategyDefinition {
    // Start with the base strategy matching their risk tolerance
    const baseStrategy = getStrategy(profile.riskTolerance);

    // Adjust based on goals and time horizon
    const adjustedStrategy = this.adjustStrategyForProfile(baseStrategy, profile);

    return adjustedStrategy;
  }

  /**
   * Adjust strategy based on specific user preferences
   */
  private adjustStrategyForProfile(
    strategy: StrategyDefinition,
    profile: UserProfile
  ): StrategyDefinition {
    const adjusted = { ...strategy };
    adjusted.allocations = { ...strategy.allocations };

    // Adjust for time horizon
    if (profile.timeHorizon === 'short') {
      // Shorter horizon = more conservative
      adjusted.allocations.stablecoins += 10;
      adjusted.allocations.sol -= 5;
      adjusted.allocations.otherTokens -= 5;
    } else if (profile.timeHorizon === 'long') {
      // Longer horizon = can take more risk
      adjusted.allocations.stablecoins -= 5;
      adjusted.allocations.sol += 5;
    }

    // Adjust for goals
    if (profile.investmentGoals.includes('income')) {
      // Income focus = more stable assets
      adjusted.allocations.stablecoins += 5;
      adjusted.allocations.otherTokens -= 5;
    }

    if (profile.investmentGoals.includes('speculation')) {
      // Speculation = more volatile assets
      adjusted.allocations.otherTokens += 10;
      adjusted.allocations.stablecoins -= 10;
    }

    // Normalize to 100%
    const total = adjusted.allocations.stablecoins +
                  adjusted.allocations.sol +
                  adjusted.allocations.otherTokens +
                  adjusted.allocations.stocks;

    if (total !== 100) {
      const factor = 100 / total;
      adjusted.allocations.stablecoins *= factor;
      adjusted.allocations.sol *= factor;
      adjusted.allocations.otherTokens *= factor;
      adjusted.allocations.stocks *= factor;
    }

    return adjusted;
  }

  // ============================================================================
  // Portfolio Analysis
  // ============================================================================

  /**
   * Analyze current portfolio against a strategy
   */
  async analyzePortfolio(
    accountAddress: string,
    userProfile: UserProfile
  ): Promise<PortfolioAnalysis> {
    // Get current portfolio
    const portfolio = await this.sdk.getPortfolio(accountAddress);

    // Get recommended strategy
    const strategy = this.analyzeProfile(userProfile);

    // Compare allocations
    const comparison = this.sdk.compareToTarget(portfolio, strategy.allocations);

    // Calculate health score
    const healthScore = this.calculateHealthScore(comparison);

    // Generate recommendations
    const recommendations = this.generateRecommendations(comparison, strategy, portfolio);

    return {
      portfolio,
      recommendedStrategy: strategy,
      comparison: comparison.map(c => ({
        assetType: c.assetType,
        currentPct: c.actualPct,
        targetPct: c.targetPct,
        deviationPct: c.deviationPct,
        action: c.deviationPct > 0 ? 'sell' : c.deviationPct < 0 ? 'buy' : 'hold',
      })),
      healthScore,
      recommendations,
    };
  }

  /**
   * Calculate portfolio health score (0-100)
   */
  private calculateHealthScore(
    comparison: Array<{ deviationPct: number }>
  ): number {
    // Perfect allocation = 100, each percent deviation reduces score
    const totalDeviation = comparison.reduce(
      (sum, c) => sum + Math.abs(c.deviationPct),
      0
    );

    // Max deviation would be 200 (100% off in both directions)
    const score = Math.max(0, 100 - (totalDeviation / 2));
    return Math.round(score);
  }

  /**
   * Generate human-readable recommendations
   */
  private generateRecommendations(
    comparison: Array<{ assetType: string; deviationPct: number }>,
    strategy: StrategyDefinition,
    portfolio: Portfolio
  ): string[] {
    const recommendations: string[] = [];

    for (const c of comparison) {
      const absDeviation = Math.abs(c.deviationPct);

      if (absDeviation > this.config.rebalanceThresholdPct) {
        if (c.deviationPct > 0) {
          recommendations.push(
            `Consider selling ${absDeviation.toFixed(1)}% of ${c.assetType} to reach target allocation`
          );
        } else {
          recommendations.push(
            `Consider buying ${absDeviation.toFixed(1)}% more ${c.assetType} to reach target allocation`
          );
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Portfolio is well-balanced. No immediate action needed.');
    }

    return recommendations;
  }

  // ============================================================================
  // Execution Planning
  // ============================================================================

  /**
   * Create an execution plan to achieve target allocation
   */
  async createExecutionPlan(
    accountAddress: string,
    userProfile: UserProfile
  ): Promise<ExecutionPlan> {
    const portfolio = await this.sdk.getPortfolio(accountAddress);
    const strategy = this.analyzeProfile(userProfile);

    const trades: PlannedTrade[] = [];
    const warnings: string[] = [];

    const totalValue = portfolio.totalValueUsd;

    // Calculate target amounts for each category
    const targets = {
      stablecoins: (strategy.allocations.stablecoins / 100) * totalValue,
      sol: (strategy.allocations.sol / 100) * totalValue,
      otherTokens: (strategy.allocations.otherTokens / 100) * totalValue,
      stocks: (strategy.allocations.stocks / 100) * totalValue,
    };

    // Calculate current amounts
    const stablecoinMints: string[] = [COMMON_TOKENS.USDC, COMMON_TOKENS.USDT];
    const current = {
      stablecoins: portfolio.tokens
        .filter(t => stablecoinMints.includes(t.mint))
        .reduce((sum, t) => sum + t.valueUsd, 0),
      sol: portfolio.tokens
        .filter(t => t.mint === COMMON_TOKENS.SOL)
        .reduce((sum, t) => sum + t.valueUsd, 0),
      otherTokens: portfolio.tokens
        .filter(t => !stablecoinMints.includes(t.mint) && t.mint !== COMMON_TOKENS.SOL)
        .reduce((sum, t) => sum + t.valueUsd, 0),
      stocks: portfolio.stocks.reduce((sum, s) => sum + s.valueUsd, 0),
    };

    // Calculate deltas
    const deltas = {
      stablecoins: targets.stablecoins - current.stablecoins,
      sol: targets.sol - current.sol,
      otherTokens: targets.otherTokens - current.otherTokens,
      stocks: targets.stocks - current.stocks,
    };

    // Generate trades for each category that needs adjustment
    let priority = 0;

    // SOL trades
    if (Math.abs(deltas.sol) >= this.config.minTradeSize) {
      if (deltas.sol > 0) {
        // Need to buy SOL - swap from USDC
        trades.push({
          type: 'swap',
          fromAsset: COMMON_TOKENS.USDC,
          toAsset: COMMON_TOKENS.SOL,
          amountUsd: deltas.sol,
          priority: priority++,
          reason: 'Increase SOL allocation',
        });
      } else {
        // Need to sell SOL - swap to USDC
        trades.push({
          type: 'swap',
          fromAsset: COMMON_TOKENS.SOL,
          toAsset: COMMON_TOKENS.USDC,
          amountUsd: Math.abs(deltas.sol),
          priority: priority++,
          reason: 'Decrease SOL allocation',
        });
      }
    }

    // Other tokens trades
    if (Math.abs(deltas.otherTokens) >= this.config.minTradeSize) {
      // For simplicity, we'll use WBTC as the representative "other token"
      if (deltas.otherTokens > 0) {
        trades.push({
          type: 'swap',
          fromAsset: COMMON_TOKENS.USDC,
          toAsset: COMMON_TOKENS.WBTC,
          amountUsd: deltas.otherTokens,
          priority: priority++,
          reason: 'Increase other tokens allocation',
        });
      } else {
        trades.push({
          type: 'swap',
          fromAsset: COMMON_TOKENS.WBTC,
          toAsset: COMMON_TOKENS.USDC,
          amountUsd: Math.abs(deltas.otherTokens),
          priority: priority++,
          reason: 'Decrease other tokens allocation',
        });
      }
    }

    // Stock trades (if enabled and configured)
    if (this.config.includeStocks && Math.abs(deltas.stocks) >= this.config.minTradeSize) {
      if (deltas.stocks > 0) {
        trades.push({
          type: 'stock_buy',
          toAsset: 'AAPL', // Default to AAPL for simplicity
          amountUsd: deltas.stocks,
          priority: priority++,
          reason: 'Increase stocks allocation',
        });
      } else {
        trades.push({
          type: 'stock_sell',
          toAsset: 'AAPL',
          amountUsd: Math.abs(deltas.stocks),
          priority: priority++,
          reason: 'Decrease stocks allocation',
        });
      }
    }

    // Add warnings
    if (!this.config.includeStocks && strategy.allocations.stocks > 0) {
      warnings.push('Stock trading is disabled. Stock allocation target will not be achieved.');
    }

    if (portfolio.totalValueUsd < 100) {
      warnings.push('Portfolio value is very low. Some trades may not be possible due to minimum sizes.');
    }

    // Calculate total trade value and estimated fees
    const totalTradeValueUsd = trades.reduce((sum, t) => sum + t.amountUsd, 0);
    const estimatedFeesUsd = trades.length * 0.5; // Rough estimate: $0.50 per trade

    return {
      strategy,
      currentPortfolio: portfolio,
      trades,
      totalTradeValueUsd,
      estimatedFeesUsd,
      warnings,
    };
  }

  // ============================================================================
  // Trade Execution
  // ============================================================================

  /**
   * Execute an allocation strategy
   */
  async executeAllocation(
    accountAddress: string,
    userProfile: UserProfile,
    signer: Keypair
  ): Promise<ExecutionResult> {
    // Create execution plan
    const plan = await this.createExecutionPlan(accountAddress, userProfile);

    if (plan.trades.length === 0) {
      return {
        status: 'success',
        steps: [],
        summary: {
          totalTradesAttempted: 0,
          totalTradesCompleted: 0,
          totalValueTraded: 0,
          errors: [],
        },
        portfolio: plan.currentPortfolio,
      };
    }

    // Check if dry run
    if (this.config.dryRun) {
      console.log('Dry run mode - trades will not be executed');
      return {
        status: 'success',
        steps: plan.trades.map(t => ({
          type: t.type,
          asset: t.toAsset,
          amountUsd: t.amountUsd,
          percentage: (t.amountUsd / plan.currentPortfolio.totalValueUsd) * 100,
          status: 'pending' as const,
        })),
        summary: {
          totalTradesAttempted: plan.trades.length,
          totalTradesCompleted: 0,
          totalValueTraded: plan.totalTradeValueUsd,
          errors: ['Dry run mode - no trades executed'],
        },
        portfolio: plan.currentPortfolio,
      };
    }

    // Execute trades
    const steps: ExecutionStep[] = [];
    const errors: string[] = [];
    let totalValueTraded = 0;

    // Sort trades by priority
    const sortedTrades = [...plan.trades].sort((a, b) => a.priority - b.priority);

    for (const trade of sortedTrades) {
      const step: ExecutionStep = {
        type: trade.type,
        asset: trade.toAsset,
        amountUsd: trade.amountUsd,
        percentage: (trade.amountUsd / plan.currentPortfolio.totalValueUsd) * 100,
        status: 'executing',
      };

      steps.push(step);

      try {
        if (trade.type === 'swap' && trade.fromAsset) {
          const result = await this.executeSwapTrade(
            accountAddress,
            trade.fromAsset,
            trade.toAsset,
            trade.amountUsd,
            signer
          );

          step.result = result;
          step.status = result.status === 'success' ? 'completed' : 'failed';

          if (result.status === 'success') {
            totalValueTraded += trade.amountUsd;
          } else if (result.error) {
            step.error = result.error;
            errors.push(`${trade.type} failed: ${result.error}`);
          }
        } else if (trade.type === 'stock_buy' || trade.type === 'stock_sell') {
          // Stock trading not implemented in this version
          step.status = 'failed';
          step.error = 'Stock trading not yet implemented';
          errors.push('Stock trading not yet implemented');
        }
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Trade failed: ${step.error}`);
      }
    }

    // Get updated portfolio
    const finalPortfolio = await this.sdk.getPortfolio(accountAddress);

    const completedSteps = steps.filter(s => s.status === 'completed').length;

    return {
      status: completedSteps === steps.length ? 'success' :
              completedSteps > 0 ? 'partial' : 'failed',
      steps,
      summary: {
        totalTradesAttempted: steps.length,
        totalTradesCompleted: completedSteps,
        totalValueTraded,
        errors,
      },
      portfolio: finalPortfolio,
    };
  }

  /**
   * Execute a single swap trade
   */
  private async executeSwapTrade(
    accountAddress: string,
    fromMint: string,
    toMint: string,
    amountUsd: number,
    signer: Keypair
  ): Promise<SwapResult> {
    // Get the price of the input token to calculate amount
    const price = await this.sdk.getTokenPrice(fromMint);
    if (!price) {
      return {
        signature: '',
        inputMint: fromMint,
        outputMint: toMint,
        inputAmount: 0,
        outputAmount: 0,
        status: 'failed',
        error: 'Could not get input token price',
      };
    }

    const amount = amountUsd / price.priceUsd;

    const params: SwapParams = {
      inputMint: fromMint,
      outputMint: toMint,
      amount,
      slippageBps: this.config.maxSlippageBps,
      userPublicKey: accountAddress,
    };

    return this.sdk.executeSwap(params, signer);
  }

  // ============================================================================
  // Rebalancing
  // ============================================================================

  /**
   * Check if portfolio needs rebalancing and optionally execute
   */
  async rebalanceIfNeeded(
    accountAddress: string,
    userProfile: UserProfile,
    signer?: Keypair
  ): Promise<RebalanceResult> {
    const portfolio = await this.sdk.getPortfolio(accountAddress);
    const strategy = this.analyzeProfile(userProfile);

    const needsRebalancing = this.sdk.needsRebalancing(
      portfolio,
      strategy.allocations,
      this.config.rebalanceThresholdPct
    );

    if (!needsRebalancing) {
      return {
        rebalanceNeeded: false,
        before: portfolio,
        summary: 'Portfolio is balanced within threshold. No rebalancing needed.',
      };
    }

    if (!signer || !this.config.autoExecute) {
      return {
        rebalanceNeeded: true,
        before: portfolio,
        summary: 'Portfolio needs rebalancing but auto-execute is disabled or no signer provided.',
      };
    }

    // Execute rebalancing
    const executionResult = await this.executeAllocation(accountAddress, userProfile, signer);

    return {
      rebalanceNeeded: true,
      executionResult,
      before: portfolio,
      after: executionResult.portfolio,
      summary: `Rebalancing ${executionResult.status}. ${executionResult.summary.totalTradesCompleted}/${executionResult.summary.totalTradesAttempted} trades completed.`,
    };
  }

  // ============================================================================
  // Portfolio Summary
  // ============================================================================

  /**
   * Get a comprehensive portfolio summary
   */
  async getPortfolioSummary(
    accountAddress: string,
    userProfile?: UserProfile
  ): Promise<{
    portfolio: Portfolio;
    analysis?: PortfolioAnalysis;
    recommendations: string[];
  }> {
    const portfolio = await this.sdk.getPortfolio(accountAddress);

    if (!userProfile) {
      return {
        portfolio,
        recommendations: [
          'Provide a user profile to get personalized recommendations.',
        ],
      };
    }

    const analysis = await this.analyzePortfolio(accountAddress, userProfile);

    return {
      portfolio,
      analysis,
      recommendations: analysis.recommendations,
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update builder configuration
   */
  updateConfig(config: Partial<PortfolioBuilderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PortfolioBuilderConfig {
    return { ...this.config };
  }

  /**
   * Get the underlying SDK
   */
  getSDK(): MyfyeSDK {
    return this.sdk;
  }
}

/**
 * Create a new PortfolioBuilderAgent instance
 */
export function createPortfolioBuilder(
  sdkConfig: SDKConfig,
  builderConfig?: Partial<PortfolioBuilderConfig>
): PortfolioBuilderAgent {
  return new PortfolioBuilderAgent(sdkConfig, builderConfig);
}
