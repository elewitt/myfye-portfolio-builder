/**
 * Live Demo: Autonomous Portfolio Manager
 *
 * Run with: node demo.mjs
 */

import { Connection, PublicKey } from '@solana/web3.js';

const WALLET = process.env.WALLET_ADDRESS || "5TXSHinHyL3SCzjnGwTikNyaPpcscY6rF4pj1gE82Xif";
const WALLET_ID = process.env.WALLET_ID || "";
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || "cm4ucmtf8091nkywlgy9os418";
const PRIVY_SECRET = process.env.PRIVY_APP_SECRET || "";

const connection = new Connection("https://api.mainnet-beta.solana.com");

// Token info
const TOKENS = {
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9, priceUsd: 180 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, priceUsd: 1 },
  USDY: { mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6', decimals: 6, priceUsd: 1.12 },
  EURC: { mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', decimals: 6, priceUsd: 1.04 },
};

// Strategies
const STRATEGIES = {
  conservative: { USDC: 50, USDY: 30, SOL: 15, EURC: 5 },
  moderate: { USDC: 25, USDY: 25, SOL: 35, EURC: 15 },
  aggressive: { SOL: 60, USDY: 20, USDC: 15, EURC: 5 },
};

async function getPortfolio() {
  const holdings = [];
  let totalValueUsd = 0;

  // Get SOL balance
  const solBalance = await connection.getBalance(new PublicKey(WALLET));
  const solAmount = solBalance / 1e9;
  const solValueUsd = solAmount * TOKENS.SOL.priceUsd;
  if (solAmount > 0) {
    holdings.push({ symbol: 'SOL', amount: solAmount, valueUsd: solValueUsd, percentage: 0 });
    totalValueUsd += solValueUsd;
  }

  // Get token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(WALLET),
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );

  for (const acc of tokenAccounts.value) {
    const info = acc.account.data.parsed.info;
    const amount = info.tokenAmount.uiAmount || 0;
    if (amount === 0) continue;

    let symbol = 'UNKNOWN';
    let priceUsd = 1;

    for (const [sym, token] of Object.entries(TOKENS)) {
      if (token.mint === info.mint) {
        symbol = sym;
        priceUsd = token.priceUsd;
        break;
      }
    }

    const valueUsd = amount * priceUsd;
    holdings.push({ symbol, amount, valueUsd, percentage: 0 });
    totalValueUsd += valueUsd;
  }

  // Calculate percentages
  for (const h of holdings) {
    h.percentage = (h.valueUsd / totalValueUsd) * 100;
  }

  return { holdings, totalValueUsd };
}

function parseCommand(input) {
  const lower = input.toLowerCase();

  if (lower.includes('conservative')) return { action: 'set_strategy', profile: 'conservative' };
  if (lower.includes('aggressive')) return { action: 'set_strategy', profile: 'aggressive' };
  if (lower.includes('moderate') || lower.includes('balanced')) return { action: 'set_strategy', profile: 'moderate' };
  if (lower.includes('status') || lower.includes('portfolio') || lower.includes('check')) return { action: 'status' };
  if (lower.includes('rebalance')) return { action: 'rebalance' };

  return { action: 'unknown' };
}

async function demo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     MYFYE AUTONOMOUS PORTFOLIO MANAGER - LIVE DEMO         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Wallet: ${WALLET}\n`);

  // Show current portfolio
  console.log('📊 Current Portfolio:\n');
  const portfolio = await getPortfolio();
  console.log(`Total Value: $${portfolio.totalValueUsd.toFixed(2)}\n`);

  for (const h of portfolio.holdings) {
    console.log(`  ${h.symbol}: ${h.amount.toFixed(4)} ($${h.valueUsd.toFixed(2)}) - ${h.percentage.toFixed(1)}%`);
  }
  console.log();

  // Show strategies
  console.log('📋 Available Strategies:\n');
  for (const [name, alloc] of Object.entries(STRATEGIES)) {
    const allocStr = Object.entries(alloc).map(([t, p]) => `${t}:${p}%`).join(', ');
    console.log(`  ${name.toUpperCase()}: ${allocStr}`);
  }
  console.log();

  // Interactive mode
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('💬 Commands: "I want a conservative portfolio", "check status", "rebalance", "quit"\n');

  const prompt = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'quit') {
        console.log('\nGoodbye!');
        rl.close();
        return;
      }

      const parsed = parseCommand(input);

      switch (parsed.action) {
        case 'set_strategy':
          console.log(`\n[Agent] Setting strategy to ${parsed.profile.toUpperCase()}...`);
          const strat = STRATEGIES[parsed.profile];
          console.log(`Target allocation:`);
          for (const [token, pct] of Object.entries(strat)) {
            console.log(`  ${token}: ${pct}%`);
          }
          console.log(`\nSay "rebalance" to execute trades.\n`);
          break;

        case 'status':
          console.log('\n[Agent] Fetching portfolio...\n');
          const p = await getPortfolio();
          console.log(`Total Value: $${p.totalValueUsd.toFixed(2)}`);
          for (const h of p.holdings) {
            console.log(`  ${h.symbol}: ${h.amount.toFixed(4)} ($${h.valueUsd.toFixed(2)}) - ${h.percentage.toFixed(1)}%`);
          }
          console.log();
          break;

        case 'rebalance':
          console.log('\n[Agent] Analyzing portfolio for rebalancing...');
          console.log('[Agent] This would execute trades to match target allocation.');
          console.log('[Agent] (Demo mode - not executing actual trades)\n');
          break;

        default:
          console.log('\n[Agent] I understand natural language! Try:\n');
          console.log('  • "I want a conservative portfolio"');
          console.log('  • "Check my portfolio status"');
          console.log('  • "Rebalance my holdings"\n');
      }

      prompt();
    });
  };

  prompt();
}

demo().catch(console.error);
