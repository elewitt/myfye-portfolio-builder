/**
 * Example: Simple Trading Agent
 *
 * Shows how easy it is for an AI agent to create a wallet and trade on Solana.
 */

import { createAgentWallet, TOKENS } from '../sdk/agent-wallet.js';

// Configuration (use environment variables in production)
const agent = createAgentWallet({
  privyAppId: process.env.PRIVY_APP_ID!,
  privyAppSecret: process.env.PRIVY_APP_SECRET!,
  rpcUrl: 'https://api.mainnet-beta.solana.com',
});

async function main() {
  console.log('=== Myfye Agent Wallet Demo ===\n');

  // 1. Create a new wallet (or load existing)
  console.log('Creating wallet...');
  const wallet = await agent.createWallet();
  console.log(`Wallet created: ${wallet.address}\n`);

  // 2. Check portfolio
  console.log('Checking portfolio...');
  const portfolio = await agent.getPortfolio();
  console.log(`SOL: ${portfolio.solBalance}`);
  for (const token of portfolio.tokens) {
    console.log(`${token.symbol || token.mint.slice(0, 8)}: ${token.amount}`);
  }
  console.log();

  // 3. Get a swap quote
  console.log('Getting quote: 0.01 SOL → USDC...');
  try {
    const quote = await agent.getQuote(TOKENS.SOL, TOKENS.USDC, '10000000'); // 0.01 SOL
    console.log(`Would receive: ${parseInt(quote.outAmount) / 1e6} USDC\n`);
  } catch (e) {
    console.log('Quote failed (need SOL balance)\n');
  }

  // 4. Execute a swap (uncomment when funded)
  // console.log('Executing swap...');
  // const result = await agent.swap(TOKENS.USDC, TOKENS.SOL, '1000000'); // 1 USDC
  // if (result.success) {
  //   console.log(`Swap successful: ${result.txSignature}`);
  // } else {
  //   console.log(`Swap failed: ${result.error}`);
  // }

  console.log('=== Demo Complete ===');
  console.log(`\nTo trade, send SOL to: ${wallet.address}`);
}

main().catch(console.error);
