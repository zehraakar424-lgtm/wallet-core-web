import { ethers } from "ethers";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { LIFI_CHAIN_TO_RPC, LIFI_CHAIN_NUM } from "./swap-config.mjs";
import { apiFetch } from "./api-client.mjs";

const EVM_RPC = {
  ethereum: "https://ethereum.publicnode.com",
  binance: "https://bsc-dataseed.binance.org",
  polygon: "https://polygon-rpc.com",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  base: "https://mainnet.base.org",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  robinhood: "https://rpc.mainnet.chain.robinhood.com",
};

function bytesToHex(bytes) {
  return (
    "0x" +
    Array.from(bytes)
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

export function openHdWallet(core, mnemonic) {
  return core.HDWallet.createWithMnemonic(mnemonic, "");
}

export function evmSignerFromHd(hdWallet, core, rpcKey) {
  const pk = hdWallet.getKeyForCoin(core.CoinType.ethereum);
  const data = pk.data();
  pk.delete();
  const hex = bytesToHex(data);
  const url = EVM_RPC[rpcKey] || EVM_RPC.ethereum;
  return new ethers.Wallet(hex, new ethers.JsonRpcProvider(url));
}

export function solKeypairFromHd(hdWallet, core) {
  const pk = hdWallet.getKeyForCoin(core.CoinType.solana);
  const data = pk.data();
  pk.delete();
  if (data.length === 64) return Keypair.fromSecretKey(data);
  if (data.length === 32) return Keypair.fromSeed(data);
  throw new Error("Unexpected Solana key length");
}

export async function fetchLifiQuote(params) {
  const qs = new URLSearchParams(params);
  const r = await apiFetch("/api/lifi/quote?" + qs.toString());
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Quote failed");
  return j.quote;
}

function rpcChainForQuote(quote) {
  const tr = quote?.transactionRequest;
  if (!tr) return null;
  if (tr.chainId != null) {
    const n = Number(tr.chainId);
    for (const k of Object.keys(LIFI_CHAIN_NUM)) {
      if (LIFI_CHAIN_NUM[k] === n) return LIFI_CHAIN_TO_RPC[k];
    }
    if (n === 4663) return "robinhood";
    return "ethereum";
  }
  return "solana";
}

function isSolanaTxRequest(tr) {
  return tr && tr.data && !tr.to && tr.chainId == null;
}

export async function sendSolanaRaw(serialized) {
  const b64 = btoa(String.fromCharCode.apply(null, serialized));
  const r = await apiFetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chain: "solana",
      method: "sendTransaction",
      params: [b64, { encoding: "base64", skipPreflight: false, maxRetries: 3 }],
    }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Solana broadcast failed");
  return j.result;
}

function signSolanaPayload(base64Data, keypair) {
  const raw = Uint8Array.from(atob(base64Data), function (c) {
    return c.charCodeAt(0);
  });
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    vtx.sign([keypair]);
    return vtx.serialize();
  } catch (e) {
    const tx = Transaction.from(raw);
    tx.partialSign(keypair);
    return tx.serialize();
  }
}

export async function executeLifiQuote(quote, { core, mnemonic }) {
  const tr = quote?.transactionRequest;
  if (!tr) throw new Error("No transaction in quote");

  const hd = openHdWallet(core, mnemonic);
  try {
    if (isSolanaTxRequest(tr)) {
      const kp = solKeypairFromHd(hd, core);
      const serialized = signSolanaPayload(tr.data, kp);
      const sig = await sendSolanaRaw(serialized);
      return { kind: "solana", hash: sig };
    }

    const rpcKey = rpcChainForQuote(quote) || "ethereum";
    const signer = evmSignerFromHd(hd, core, rpcKey);
    const sent = await signer.sendTransaction({
      to: tr.to,
      data: tr.data,
      value: tr.value ? BigInt(tr.value) : 0n,
      gasLimit: tr.gasLimit ? BigInt(tr.gasLimit) : undefined,
      gasPrice: tr.gasPrice ? BigInt(tr.gasPrice) : undefined,
      maxFeePerGas: tr.maxFeePerGas ? BigInt(tr.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tr.maxPriorityFeePerGas ? BigInt(tr.maxPriorityFeePerGas) : undefined,
      chainId: tr.chainId != null ? Number(tr.chainId) : undefined,
    });
    await sent.wait(1).catch(function () {});
    return { kind: "evm", hash: sent.hash };
  } finally {
    hd.delete();
  }
}
