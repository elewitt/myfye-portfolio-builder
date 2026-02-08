/**
 * Autonomous Portfolio Manager Demo
 *
 * Shows the AI agent understanding natural language and managing a portfolio.
 */

import { createPortfolioManager } from '../agent/autonomous-manager.js';
import * as readline from 'readline';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID || 'cm4ucmtf8091nkywlgy9os418';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';
const EXISTING_WALLET_ID = process.env.WALLET_ID; // Optional: reuse existing wallet

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     MYFYE AUTONOMOUS PORTFOLIO MANAGER                     ║');
  console.log('║     An AI agent that manages your crypto portfolio         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Create the manager
  const manager = createPortfolioManager({
    privyAppId: PRIVY_APP_ID,
    privyAppSecret: PRIVY_APP_SECRET,
    rebalanceThresholdPct: 5,
    minTradeUsd: 0.50,
  });

  // Initialize wallet
  console.log('[Agent] Initializing wallet...');
  const initResult = await manager.initialize(EXISTING_WALLET_ID);
  console.log(initResult);
  console.log();

  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Talk to me naturally. Examples:');
  console.log('  • "Create a conservative portfolio"');
  console.log('  • "I want an aggressive strategy"');
  console.log('  • "Check my portfolio"');
  console.log('  • "Rebalance"');
  console.log('  • "Swap 1 USDC to SOL"');
  console.log('  • "start monitoring" (auto-rebalance)');
  console.log('  • "quit" to exit\n');

  const prompt = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
        console.log('\n[Agent] Goodbye!');
        manager.stopMonitoring();
        rl.close();
        process.exit(0);
      }

      if (input.toLowerCase().includes('start monitor')) {
        manager.startMonitoring(30000); // Check every 30 seconds
        console.log('\n[Agent] Autonomous monitoring started. I\'ll rebalance when drift exceeds threshold.\n');
        prompt();
        return;
      }

      if (input.toLowerCase().includes('stop monitor')) {
        manager.stopMonitoring();
        console.log('\n[Agent] Monitoring stopped.\n');
        prompt();
        return;
      }

      try {
        const response = await manager.processCommand(input);
        console.log(`\n[Agent] ${response}\n`);
      } catch (error) {
        console.error('\n[Agent] Error:', error instanceof Error ? error.message : error, '\n');
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
