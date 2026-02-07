/**
 * Myfye Portfolio Builder Agent
 *
 * An autonomous AI agent that builds and manages investment portfolios on Myfye.
 * Uses the Myfye SDK to interact with Solana and execute trades.
 *
 * @example
 * ```typescript
 * import { createPortfolioBuilder } from 'myfye-portfolio-builder/agent';
 * import { UserProfile } from 'myfye-portfolio-builder/agent';
 *
 * const agent = createPortfolioBuilder({
 *   rpcUrl: 'https://api.devnet.solana.com',
 *   network: 'devnet',
 * });
 *
 * const profile: UserProfile = {
 *   riskTolerance: 'moderate',
 *   investmentGoals: ['growth'],
 *   timeHorizon: 'medium',
 *   totalInvestment: 1000,
 * };
 *
 * // Analyze portfolio
 * const analysis = await agent.analyzePortfolio(walletAddress, profile);
 * console.log('Health Score:', analysis.healthScore);
 * console.log('Recommendations:', analysis.recommendations);
 *
 * // Create execution plan
 * const plan = await agent.createExecutionPlan(walletAddress, profile);
 * console.log('Planned trades:', plan.trades);
 *
 * // Execute (with signer)
 * const result = await agent.executeAllocation(walletAddress, profile, signer);
 * console.log('Execution result:', result.summary);
 * ```
 */

// Main exports
export { PortfolioBuilderAgent, createPortfolioBuilder } from './portfolio-builder.js';

// Types
export * from './types.js';

// Strategies
export {
  conservativeStrategy,
  moderateStrategy,
  aggressiveStrategy,
  getStrategy,
  strategies,
} from './strategies/index.js';
