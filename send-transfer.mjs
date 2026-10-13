import { ethers } from "ethers";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { openHdWallet, evmSignerFromHd, solKeypairFromHd, sendSolanaRaw } from "./swap-exec.mjs";

const SOL_RPC = "https://api.mainnet-beta.solana.com";

export function sendableCoins(coins) {
  return coins.filter(function (c) {
    return c.rpc === "solana" || (c.rpc && c.rpc !== "solana");
  });
}

function parseHumanAmount(amount, decimals) {
  const s = String(amount || "").trim().replace(",", ".");
  if (!s || !/^\d*\.?\d+$/.test(s)) throw new Error("Invalid amount");
  return ethers.parseUnits(s, decimals);
}

export async function sendNativeTransfer({ core, mnemonic, coin, to, amount }) {
  const toAddr = String(to || "").trim();
  if (!toAddr || toAddr.length < 8) throw new Error("Invalid address");

  const hd = openHdWallet(core, mnemonic);
  try {
    if (coin.rpc === "solana") {
      let dest;
      try {
        dest = new PublicKey(toAddr);
      } catch (e) {
        throw new Error("Invalid Solana address");
      }
      const kp = solKeypairFromHd(hd, core);
      const lamports = parseHumanAmount(amount, coin.decimals);
      if (lamports <= 0n) throw new Error("Amount must be > 0");
      const conn = new Connection(SOL_RPC, "confirmed");
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: kp.publicKey,
          toPubkey: dest,
          lamports: Number(lamports),
        })
      );
      const bh = await conn.getLatestBlockhash();
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = kp.publicKey;
      tx.sign(kp);
      const sig = await sendSolanaRaw(tx.serialize());
      return { kind: "solana", hash: sig };
    }

    if (coin.rpc) {
      if (!ethers.isAddress(toAddr)) throw new Error("Invalid EVM address");
      const signer = evmSignerFromHd(hd, core, coin.rpc);
      const value = parseHumanAmount(amount, coin.decimals);
      if (value <= 0n) throw new Error("Amount must be > 0");
      const sent = await signer.sendTransaction({ to: toAddr, value });
      await sent.wait(1).catch(function () {});
      return { kind: "evm", hash: sent.hash };
    }

    throw new Error("Send not supported for " + coin.title);
  } finally {
    hd.delete();
  }
}
