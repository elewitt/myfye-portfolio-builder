/**
 * Claude Portfolio Agent - Interactive Demo
 *
 * An AI-powered portfolio manager that understands natural language.
 * Run with: ANTHROPIC_API_KEY=your_key node claude-demo.mjs
 */

import Anthropic from '@anthropic-ai/sdk';
import { Connection, PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';
import * as readline from 'readline';

// Configuration - all from environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WALLET = process.env.WALLET_ADDRESS;
const WALLET_ID = process.env.WALLET_ID;
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_SECRET = process.env.PRIVY_APP_SECRET;

if (!ANTHROPIC_API_KEY || !WALLET || !WALLET_ID || !PRIVY_APP_ID || !PRIVY_SECRET) {
  console.error("Required environment variables:");
  console.error("  ANTHROPIC_API_KEY, WALLET_ADDRESS, WALLET_ID, PRIVY_APP_ID, PRIVY_APP_SECRET");
  process.exit(1);
}

// Token registry
const TOKENS = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, type: 'stablecoin' },
  USDY: { mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6', decimals: 6, type: 'stablecoin' },
  EURC: { mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', decimals: 6, type: 'stablecoin' },
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9, type: 'crypto' },
  SPYx: { mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', decimals: 8, type: 'stock' },
  QQQx: { mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ', decimals: 8, type: 'stock' },
  GLDx: { mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re', decimals: 8, type: 'stock' },
  AAPLx: { mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', decimals: 8, type: 'stock' },
  MSFTx: { mint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX', decimals: 8, type: 'stock' },
  GOOGLx: { mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN', decimals: 8, type: 'stock' },
  AMZNx: { mint: 'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg', decimals: 8, type: 'stock' },
  METAx: { mint: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu', decimals: 8, type: 'stock' },
  NVDAx: { mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', decimals: 8, type: 'stock' },
  TSLAx: { mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', decimals: 8, type: 'stock' },
  COINx: { mint: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu', decimals: 8, type: 'stock' },
  MSTRx: { mint: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ', decimals: 8, type: 'stock' },
  HOODx: { mint: 'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg', decimals: 8, type: 'stock' },
};

// Approximate prices
const PRICES = {
  SOL: 87, USDC: 1, USDY: 1.12, EURC: 1.04,
  SPYx: 690, QQQx: 612, GLDx: 285, AAPLx: 248, MSFTx: 455,
  GOOGLx: 202, AMZNx: 233, METAx: 725, NVDAx: 185, TSLAx: 410,
  COINx: 165, MSTRx: 133, HOODx: 56,
};

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const connection = new Connection("https://api.mainnet-beta.solana.com");
let conversationHistory = [];

const SYSTEM_PROMPT = `You are an autonomous AI portfolio manager for Solana. You help users manage their crypto and tokenized stock portfolios.

AVAILABLE TOKENS:
Stablecoins: USDC, USDY, EURC
Crypto: SOL
Tokenized Stocks (xStocks): SPYx (S&P 500), QQQx (NASDAQ), GLDx (Gold), AAPLx (Apple), MSFTx (Microsoft), GOOGLx (Google), AMZNx (Amazon), METAx (Meta), NVDAx (NVIDIA), TSLAx (Tesla), COINx (Coinbase), MSTRx (MicroStrategy), HOODx (Robinhood)

INVESTMENT STRATEGIES:
- Conservative: Focus on stablecoins (60-70%), some SOL (10-15%), blue-chip stocks like SPYx, AAPLx, MSFTx (20-25%)
- Moderate: Balanced mix of stablecoins (30-40%), SOL (20-30%), diversified stocks (30-40%)
- Aggressive: Heavy on volatile assets - TSLAx, NVDAx, MSTRx, COINx, more SOL (60%+), minimal stablecoins

PORTFOLIO BUILDING PRINCIPLES:
- For retirement/long-term: More conservative, index funds (SPYx, QQQx), stable blue chips
- For growth: Tech stocks (NVDAx, TSLAx, METAx), crypto exposure (SOL, COINx, MSTRx)
- For income: Stablecoins (USDY pays yield), stable dividend stocks
- For speculation: High-volatility picks (MSTRx, TSLAx, COINx, HOODx)

When the user asks you to build a portfolio or make trades:
1. First call get_portfolio to see current holdings
2. Analyze their request and risk profile
3. Decide on the allocation
4. Execute trades using swap_tokens
5. Explain your reasoning and warn about risks

Be conversational, explain your investment thesis, and make the user feel confident in your decisions.`;

const TOOLS = [
  {
    name: "get_portfolio",
    description: "Get the current portfolio holdings and their USD values",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "swap_tokens",
    description: "Swap one token for another to rebalance the portfolio",
    input_schema: {
      type: "object",
      properties: {
        from_token: { type: "string", description: "Token to sell (e.g., USDC, SOL, TSLAx)" },
        to_token: { type: "string", description: "Token to buy (e.g., USDC, SOL, TSLAx)" },
        amount_usd: { type: "number", description: "USD value to swap" }
      },
      required: ["from_token", "to_token", "amount_usd"]
    }
  },
  {
    name: "get_available_tokens",
    description: "List all available tokens for trading",
    input_schema: { type: "object", properties: {}, required: [] }
  }
];

async function getPortfolio() {
  const holdings = [];
  let totalValueUsd = 0;

  // SOL balance
  const solBalance = await connection.getBalance(new PublicKey(WALLET));
  const solAmount = solBalance / 1e9;
  if (solAmount > 0.001) {
    const solValue = solAmount * PRICES.SOL;
    holdings.push({ symbol: 'SOL', amount: solAmount, valueUsd: solValue, percentage: 0 });
    totalValueUsd += solValue;
  }

  // SPL tokens
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(WALLET),
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );

  // Token-2022
  const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(WALLET),
    { programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') }
  );

  for (const acc of [...tokenAccounts.value, ...token2022Accounts.value]) {
    const info = acc.account.data.parsed.info;
    const amount = info.tokenAmount.uiAmount || 0;
    if (amount === 0) continue;

    let symbol = 'UNKNOWN';
    for (const [sym, token] of Object.entries(TOKENS)) {
      if (token.mint === info.mint) { symbol = sym; break; }
    }

    const price = PRICES[symbol] || 1;
    const valueUsd = amount * price;
    holdings.push({ symbol, amount, rawAmount: info.tokenAmount.amount, valueUsd, percentage: 0 });
    totalValueUsd += valueUsd;
  }

  for (const h of holdings) h.percentage = totalValueUsd > 0 ? (h.valueUsd / totalValueUsd) * 100 : 0;
  holdings.sort((a, b) => b.valueUsd - a.valueUsd);

  return { holdings, totalValueUsd };
}

async function executeSwap(fromToken, toToken, amountUsd) {
  const fromInfo = TOKENS[fromToken];
  const toInfo = TOKENS[toToken];

  if (!fromInfo || !toInfo) return { success: false, error: `Unknown token` };

  const fromPrice = PRICES[fromToken] || 1;
  const tokenAmount = amountUsd / fromPrice;
  const rawAmount = Math.floor(tokenAmount * Math.pow(10, fromInfo.decimals)).toString();

  try {
    // Get quote
    const quoteRes = await fetch(
      `https://lite-api.jup.ag/swap/v1/quote?inputMint=${fromInfo.mint}&outputMint=${toInfo.mint}&amount=${rawAmount}&slippageBps=300&maxAccounts=20`
    );
    const quote = await quoteRes.json();
    if (quote.error || !quote.outAmount) return { success: false, error: quote.error || 'No route' };

    // Get instructions
    const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap-instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: WALLET,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: { maxBps: 300 }
      })
    });
    const instructions = await swapRes.json();
    if (instructions.error) return { success: false, error: instructions.error };

    // Build transaction
    const allInstructions = [];
    for (const ix of instructions.computeBudgetInstructions || []) {
      allInstructions.push(new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.accounts.map(a => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
        data: Buffer.from(ix.data, 'base64')
      }));
    }
    for (const ix of instructions.setupInstructions || []) {
      allInstructions.push(new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.accounts.map(a => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
        data: Buffer.from(ix.data, 'base64')
      }));
    }
    allInstructions.push(new TransactionInstruction({
      programId: new PublicKey(instructions.swapInstruction.programId),
      keys: instructions.swapInstruction.accounts.map(a => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
      data: Buffer.from(instructions.swapInstruction.data, 'base64')
    }));
    if (instructions.cleanupInstruction) {
      allInstructions.push(new TransactionInstruction({
        programId: new PublicKey(instructions.cleanupInstruction.programId),
        keys: instructions.cleanupInstruction.accounts.map(a => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
        data: Buffer.from(instructions.cleanupInstruction.data, 'base64')
      }));
    }

    const { blockhash } = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: new PublicKey(WALLET),
      recentBlockhash: blockhash,
      instructions: allInstructions
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    const serializedTx = Buffer.from(tx.serialize()).toString('base64');

    // Sign with Privy
    const authHeader = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_SECRET}`).toString('base64');
    const signRes = await fetch(`https://api.privy.io/v1/wallets/${WALLET_ID}/rpc`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'privy-app-id': PRIVY_APP_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ method: 'signTransaction', params: { transaction: serializedTx, encoding: 'base64' } })
    });

    const signResult = await signRes.json();
    if (signResult.error) return { success: false, error: JSON.stringify(signResult.error) };

    // Submit
    const signedTxBytes = Buffer.from(signResult.data.signed_transaction, 'base64');
    const txSig = await connection.sendRawTransaction(signedTxBytes, { skipPreflight: true });

    return { success: true, txSignature: txSig, url: `https://solscan.io/tx/${txSig}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleToolCall(name, input) {
  switch (name) {
    case 'get_portfolio': {
      const p = await getPortfolio();
      let result = `Portfolio Value: $${p.totalValueUsd.toFixed(2)}\n\nHoldings:\n`;
      for (const h of p.holdings) {
        result += `- ${h.symbol}: ${h.amount.toFixed(6)} ($${h.valueUsd.toFixed(2)}) - ${h.percentage.toFixed(1)}%\n`;
      }
      return result;
    }
    case 'swap_tokens': {
      console.log(`\n  [Executing: $${input.amount_usd} ${input.from_token} → ${input.to_token}]`);
      const result = await executeSwap(input.from_token, input.to_token, input.amount_usd);
      if (result.success) {
        console.log(`  [Success: ${result.url}]\n`);
        return `Swap executed! TX: ${result.url}`;
      } else {
        console.log(`  [Failed: ${result.error}]\n`);
        return `Swap failed: ${result.error}`;
      }
    }
    case 'get_available_tokens': {
      return `Available tokens:\n\nSTABLECOINS: USDC, USDY, EURC\nCRYPTO: SOL\nxSTOCKS:\n- ETFs: SPYx (S&P 500), QQQx (NASDAQ), GLDx (Gold)\n- Tech: AAPLx, MSFTx, GOOGLx, AMZNx, METAx, NVDAx, TSLAx\n- Crypto: COINx, MSTRx, HOODx`;
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

async function chat(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: conversationHistory
  });

  // Handle tool calls
  while (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const tool of toolUses) {
      const result = await handleToolCall(tool.name, tool.input);
      toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result });
    }

    conversationHistory.push({ role: 'assistant', content: response.content });
    conversationHistory.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: conversationHistory
    });
  }

  const textBlocks = response.content.filter(b => b.type === 'text');
  const finalResponse = textBlocks.map(b => b.text).join('\n');
  conversationHistory.push({ role: 'assistant', content: response.content });

  return finalResponse;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     CLAUDE PORTFOLIO AGENT - AI-Powered Portfolio Manager      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`Wallet: ${WALLET}\n`);
  console.log('Talk to me naturally about your portfolio. Examples:');
  console.log('  • "Show me my portfolio"');
  console.log('  • "I want to build a retirement portfolio"');
  console.log('  • "Make my portfolio more aggressive"');
  console.log('  • "Buy $2 worth of Tesla stock"');
  console.log('  • "I\'m feeling risky, what do you suggest?"');
  console.log('\nType "quit" to exit.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'quit') {
        console.log('\nGoodbye!');
        rl.close();
        return;
      }

      try {
        console.log('\nAgent: (thinking...)\n');
        const response = await chat(input);
        console.log(`Agent: ${response}\n`);
      } catch (error) {
        console.error('Error:', error.message, '\n');
      }

      prompt();
    });
  };

  prompt();
}

main();
