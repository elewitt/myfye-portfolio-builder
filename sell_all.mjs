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

const connection = new Connection("https://api.mainnet-beta.solana.com");

async function swap(inputMint, amount, label) {
  console.log(`\n${label}: Getting quote...`);
  const quoteRes = await fetch(
    `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${USDC_MINT}&amount=${amount}&slippageBps=300&maxAccounts=20`
  );
  const quote = await quoteRes.json();

  if (quote.error || !quote.outAmount) {
    console.error("Quote error:", quote.error || "No route found");
    return null;
  }
  console.log(`Swapping ${amount} for ${quote.outAmount} USDC`);

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
  console.log("Selling all tokens (except SOL) for USDC...\n");

  // Tokens to sell (from portfolio check)
  const toSell = [
    { mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6', amount: '2549018', name: 'USDY' },
    { mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', amount: '2120937', name: 'EURC' },
    { mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', amount: '361969', name: 'SPYx' },
    { mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ', amount: '407409', name: 'QQQx' },
  ];

  for (const token of toSell) {
    await swap(token.mint, token.amount, `${token.name} → USDC`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\nDone! All tokens converted to USDC.");
}

main().catch(console.error);
