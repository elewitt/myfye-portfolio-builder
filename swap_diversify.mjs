import { Connection, PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';

const WALLET = process.env.WALLET_ADDRESS;
const WALLET_ID = process.env.WALLET_ID;
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_SECRET = process.env.PRIVY_APP_SECRET;

if (!WALLET || !WALLET_ID || !PRIVY_APP_ID || !PRIVY_SECRET) {
  console.error("Required: WALLET_ADDRESS, WALLET_ID, PRIVY_APP_ID, PRIVY_APP_SECRET");
  process.exit(1);
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDY_MINT = "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6";
const SPYx_MINT = "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W";
const QQQx_MINT = "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ";
const EURC_MINT = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";

const connection = new Connection("https://api.mainnet-beta.solana.com");

async function swap(inputMint, outputMint, amount, label) {
  console.log(`\n${label}: Getting quote...`);
  const quoteRes = await fetch(
    `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=300&maxAccounts=20`
  );
  const quote = await quoteRes.json();

  if (quote.error || !quote.outAmount) {
    console.error("Quote error:", quote.error || "No route found");
    return null;
  }
  console.log(`Swapping ${amount} for ${quote.outAmount}`);

  const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap-instructions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: WALLET,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: { maxBps: 300 }
    })
  });
  const instructions = await swapRes.json();

  if (instructions.error) {
    console.error("Swap instructions error:", instructions.error);
    return null;
  }

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

  console.log("Signing...");
  const authHeader = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_SECRET}`).toString('base64');
  const signRes = await fetch(`https://api.privy.io/v1/wallets/${WALLET_ID}/rpc`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "privy-app-id": PRIVY_APP_ID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      method: "signTransaction",
      params: { transaction: serializedTx, encoding: "base64" }
    })
  });

  const signResult = await signRes.json();
  if (signResult.error) {
    console.error("Sign error:", JSON.stringify(signResult.error));
    return null;
  }

  console.log("Submitting...");
  const signedTxBytes = Buffer.from(signResult.data.signed_transaction, 'base64');
  const txSig = await connection.sendRawTransaction(signedTxBytes, { skipPreflight: true });
  console.log("SUCCESS:", txSig);
  return txSig;
}

async function main() {
  // 10 USDC = 10,000,000 raw units (6 decimals)
  // Split into 4 equal parts: 2,500,000 each
  const portion = "2500000";

  console.log("Diversifying 10 USDC into 4 equal portions...\n");

  // Swap 1: USDC → USDY
  await swap(USDC_MINT, USDY_MINT, portion, "USDC → USDY ($2.50)");
  await new Promise(r => setTimeout(r, 1500));

  // Swap 2: USDC → SPYx
  await swap(USDC_MINT, SPYx_MINT, portion, "USDC → SPYx ($2.50)");
  await new Promise(r => setTimeout(r, 1500));

  // Swap 3: USDC → QQQx
  await swap(USDC_MINT, QQQx_MINT, portion, "USDC → QQQx ($2.50)");
  await new Promise(r => setTimeout(r, 1500));

  // Swap 4: USDC → EURC
  await swap(USDC_MINT, EURC_MINT, portion, "USDC → EURC ($2.50)");

  console.log("\nDone! Portfolio diversified.");
}

main().catch(console.error);
