import { Connection, PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const WALLET = process.env.WALLET_ADDRESS;
const WALLET_ID = process.env.WALLET_ID;
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_SECRET = process.env.PRIVY_APP_SECRET;

if (!WALLET || !WALLET_ID || !PRIVY_APP_ID || !PRIVY_SECRET) {
  console.error("Required: WALLET_ADDRESS, WALLET_ID, PRIVY_APP_ID, PRIVY_APP_SECRET");
  process.exit(1);
}

const QQQx_MINT = new PublicKey("Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ");
const RECIPIENT = new PublicKey("B1zAiuxNrv8RTc7dDBoAihXEsu59R7KNywkRkw27J53x");
const DECIMALS = 8; // QQQx has 8 decimals

const connection = new Connection("https://api.mainnet-beta.solana.com");

async function main() {
  // First check actual balance
  const senderPubkey = new PublicKey(WALLET);
  const senderATA = getAssociatedTokenAddressSync(
    QQQx_MINT,
    senderPubkey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const balanceInfo = await connection.getTokenAccountBalance(senderATA);
  const AMOUNT = BigInt(balanceInfo.value.amount);

  console.log("Preparing transfer of QQQx (Token-2022 with transfer_checked)...");
  console.log("From:", WALLET);
  console.log("To:", RECIPIENT.toBase58());
  console.log("Amount:", AMOUNT.toString(), `(${balanceInfo.value.uiAmount} QQQx)`);

  const recipientATA = getAssociatedTokenAddressSync(
    QQQx_MINT,
    RECIPIENT,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("Sender ATA:", senderATA.toBase58());
  console.log("Recipient ATA:", recipientATA.toBase58());

  const instructions = [];

  // Check if recipient ATA exists
  const recipientATAInfo = await connection.getAccountInfo(recipientATA);
  if (!recipientATAInfo) {
    console.log("Creating recipient token account (Token-2022)...");
    instructions.push(
      createAssociatedTokenAccountInstruction(
        senderPubkey,         // payer
        recipientATA,         // ata
        RECIPIENT,            // owner
        QQQx_MINT,            // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Use transfer_checked for Token-2022 tokens
  instructions.push(
    createTransferCheckedInstruction(
      senderATA,            // source
      QQQx_MINT,            // mint
      recipientATA,         // destination
      senderPubkey,         // owner
      AMOUNT,               // amount
      DECIMALS,             // decimals
      [],                   // multiSigners
      TOKEN_2022_PROGRAM_ID
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: senderPubkey,
    recentBlockhash: blockhash,
    instructions: instructions
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  const serializedTx = Buffer.from(tx.serialize()).toString('base64');

  console.log("Signing transaction...");
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

  console.log("Submitting to Solana...");
  const signedTxBytes = Buffer.from(signResult.data.signed_transaction, 'base64');
  const txSig = await connection.sendRawTransaction(signedTxBytes, { skipPreflight: true });
  console.log("SUCCESS:", txSig);
  console.log("https://solscan.io/tx/" + txSig);
}

main().catch(console.error);
