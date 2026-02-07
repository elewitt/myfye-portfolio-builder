/**
 * Example: Build a Portfolio with the Myfye Agent
 *
 * This example demonstrates the full flow:
 * 1. Create an account (or use existing)
 * 2. Analyze the user's investment profile
 * 3. Get portfolio recommendations
 * 4. Create and optionally execute a portfolio allocation
 */

import { createPortfolioBuilder, UserProfile } from '../agent/index.js';
import { Keypair } from '@solana/web3.js';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const NETWORK = 'devnet' as const;

async function main() {
  console.log('=== Myfye Portfolio Builder Example ===\n');

  // Create the portfolio builder agent
  const agent = createPortfolioBuilder(
    {
      rpcUrl: RPC_URL,
      network: NETWORK,
      // Add Privy config for account creation:
      // privy: { appId: '...', appSecret: '...' },
      // Add Dinari config for stock trading:
      // dinari: { apiKeyId: '...', apiSecretKey: '...', environment: 'sandbox' },
    },
    {
      dryRun: true, // Set to false to execute real trades
      includeStocks: false, // Set to true if Dinari is configured
      minTradeSize: 10, // Minimum $10 per trade
      rebalanceThresholdPct: 5, // Rebalance if >5% off target
    }
  );

  // Example user profile
  const userProfile: UserProfile = {
    riskTolerance: 'moderate',
    investmentGoals: ['growth', 'preservation'],
    timeHorizon: 'medium',
    totalInvestment: 1000, // $1000 starting capital
  };

  console.log('User Profile:');
  console.log(`  Risk Tolerance: ${userProfile.riskTolerance}`);
  console.log(`  Goals: ${userProfile.investmentGoals.join(', ')}`);
  console.log(`  Time Horizon: ${userProfile.timeHorizon}`);
  console.log(`  Investment: $${userProfile.totalInvestment}`);
  console.log();

  // Step 1: Analyze the profile and get recommended strategy
  console.log('Step 1: Analyzing profile...');
  const strategy = agent.analyzeProfile(userProfile);
  console.log(`  Recommended Strategy: ${strategy.name}`);
  console.log(`  Description: ${strategy.description}`);
  console.log('  Target Allocation:');
  console.log(`    - Stablecoins: ${strategy.allocations.stablecoins}%`);
  console.log(`    - SOL: ${strategy.allocations.sol}%`);
  console.log(`    - Other Tokens: ${strategy.allocations.otherTokens}%`);
  console.log(`    - Stocks: ${strategy.allocations.stocks}%`);
  console.log();

  // For demo purposes, generate a random wallet
  const demoWallet = Keypair.generate();
  const walletAddress = demoWallet.publicKey.toString();
  console.log(`Demo Wallet: ${walletAddress}`);
  console.log('(Note: This is an empty wallet for demonstration)\n');

  // Step 2: Get portfolio summary
  console.log('Step 2: Getting portfolio summary...');
  try {
    const summary = await agent.getPortfolioSummary(walletAddress, userProfile);
    console.log(`  Total Value: $${summary.portfolio.totalValueUsd.toFixed(2)}`);
    console.log('  Current Allocation:');
    console.log(`    - Stablecoins: ${summary.portfolio.allocation.stablecoins.toFixed(1)}%`);
    console.log(`    - SOL: ${summary.portfolio.allocation.sol.toFixed(1)}%`);
    console.log(`    - Other Tokens: ${summary.portfolio.allocation.otherTokens.toFixed(1)}%`);
    console.log(`    - Stocks: ${summary.portfolio.allocation.stocks.toFixed(1)}%`);
    console.log();

    if (summary.analysis) {
      console.log(`  Health Score: ${summary.analysis.healthScore}/100`);
      console.log('  Recommendations:');
      for (const rec of summary.recommendations) {
        console.log(`    - ${rec}`);
      }
    }
  } catch (error) {
    console.log('  (Wallet is empty or not connected to RPC)');
  }
  console.log();

  // Step 3: Create execution plan
  console.log('Step 3: Creating execution plan...');
  try {
    const plan = await agent.createExecutionPlan(walletAddress, userProfile);

    if (plan.trades.length === 0) {
      console.log('  No trades needed - portfolio is balanced!');
    } else {
      console.log(`  Planned Trades (${plan.trades.length}):`)
      for (const trade of plan.trades) {
        console.log(`    - ${trade.type}: $${trade.amountUsd.toFixed(2)} (${trade.reason})`);
      }
      console.log(`  Total Trade Value: $${plan.totalTradeValueUsd.toFixed(2)}`);
      console.log(`  Estimated Fees: $${plan.estimatedFeesUsd.toFixed(2)}`);
    }

    if (plan.warnings.length > 0) {
      console.log('  Warnings:');
      for (const warning of plan.warnings) {
        console.log(`    ⚠️  ${warning}`);
      }
    }
  } catch (error) {
    console.log('  (Could not create plan for empty wallet)');
  }
  console.log();

  // Step 4: Execute (in dry run mode)
  console.log('Step 4: Executing allocation (DRY RUN)...');
  try {
    const result = await agent.executeAllocation(walletAddress, userProfile, demoWallet);
    console.log(`  Status: ${result.status}`);
    console.log(`  Trades Attempted: ${result.summary.totalTradesAttempted}`);
    console.log(`  Trades Completed: ${result.summary.totalTradesCompleted}`);
    console.log(`  Total Value Traded: $${result.summary.totalValueTraded.toFixed(2)}`);

    if (result.summary.errors.length > 0) {
      console.log('  Notes:');
      for (const error of result.summary.errors) {
        console.log(`    - ${error}`);
      }
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  console.log('=== Example Complete ===');
  console.log('\nTo use with real funds:');
  console.log('1. Configure Privy credentials for account creation');
  console.log('2. Fund the wallet with SOL for gas and USDC for trading');
  console.log('3. Set dryRun: false in the configuration');
  console.log('4. Provide a real Keypair signer');
}

main().catch(console.error);
