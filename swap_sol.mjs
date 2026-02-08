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
const SOL_MINT = "So11111111111111111111111111111111111111112";

const connection = new Connection("https://api.mainnet-beta.solana.com");

async function main() {
  const AMOUNT = "2000000"; // $2 USDC

  console.log("Getting quote for $2 USDC → SOL...");
  const quoteRes = await fetch(
    `https://lite-api.jup.ag/swap/v1/quote?inputMint=${USDC_MINT}&outputMint=${SOL_MINT}&amount=${AMOUNT}&slippageBps=300&maxAccounts=20`
  );
  const quote = await quoteRes.json();

  if (quote.error || !quote.outAmount) {
    console.error("Quote error:", quote.error || "No route");
    return;
  }
  console.log(`Swapping $2 USDC for ${(parseInt(quote.outAmount) / 1e9).toFixed(6)} SOL`);

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
    console.error("Error:", instructions.error);
    return;
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
    return;
  }

  console.log("Submitting...");
  const signedTxBytes = Buffer.from(signResult.data.signed_transaction, 'base64');
  const txSig = await connection.sendRawTransaction(signedTxBytes, { skipPreflight: true });
  console.log("SUCCESS:", txSig);
  console.log("https://solscan.io/tx/" + txSig);
}

main().catch(console.error);
