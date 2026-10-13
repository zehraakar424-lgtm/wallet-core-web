import { apiFetch } from "./api-client.mjs";

async function rpc(chain, method, params) {
  const r = await apiFetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chain, method, params }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "rpc failed");
  return j.result;
}

function hexToBigInt(hex) {
  if (!hex) return 0n;
  return BigInt(hex);
}

function fromUnits(raw, decimals) {
  const n = typeof raw === "bigint" ? raw : BigInt(raw);
  const d = BigInt(10 ** decimals);
  const whole = n / d;
  const frac = n % d;
  return Number(whole) + Number(frac) / Number(d);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (resolve) {
      setTimeout(function () {
        resolve(0);
      }, ms);
    }),
  ]);
}

export async function fetchCoinBalance(coin, address) {
  if (!address || address === "—") return 0;
  try {
    if (coin.balanceApi === "btc") {
      const r = await apiFetch("/api/btc/" + encodeURIComponent(address));
      const j = await r.json();
      if (!j.ok) return 0;
      return fromUnits(j.satoshi, 8);
    }
    if (coin.balanceApi === "cosmos") {
      const r = await apiFetch("/api/cosmos/" + encodeURIComponent(address));
      const j = await r.json();
      if (!j.ok) return 0;
      return fromUnits(j.uatom, 6);
    }
    if (coin.balanceApi === "tron") {
      const r = await apiFetch("/api/tron/" + encodeURIComponent(address));
      const j = await r.json();
      if (!j.ok) return 0;
      return fromUnits(j.sun, 6);
    }
    if (coin.balanceApi === "ltc") {
      const r = await apiFetch("/api/ltc/" + encodeURIComponent(address));
      const j = await r.json();
      if (!j.ok) return 0;
      return fromUnits(j.litoshi, 8);
    }
    if (coin.balanceApi === "doge") {
      const r = await apiFetch("/api/doge/" + encodeURIComponent(address));
      const j = await r.json();
      if (!j.ok) return 0;
      return fromUnits(j.koinu, 8);
    }
    if (coin.balanceApi === "ton") {
      const r = await apiFetch("/api/ton/" + encodeURIComponent(address));
      const j = await r.json();
      if (!j.ok) return 0;
      return fromUnits(j.nanoton, 9);
    }
    if (coin.balanceApi === "sui") {
      const r = await apiFetch("/api/sui/" + encodeURIComponent(address));
      const j = await r.json();
      if (!j.ok) return 0;
      return fromUnits(j.mist, 9);
    }
    if (coin.rpc === "solana") {
      const lamports = await rpc("solana", "getBalance", [address]);
      return fromUnits(lamports, 9);
    }
    if (coin.rpc) {
      const bal = await rpc(coin.rpc, "eth_getBalance", [address, "latest"]);
      return fromUnits(hexToBigInt(bal), coin.decimals || 18);
    }
  } catch (e) {
    console.warn("balance", coin.id, e);
  }
  return 0;
}

export async function fetchAllBalances(coins, getAddress) {
  const out = {};
  await Promise.all(
    coins.map(async function (coin) {
      const addr = getAddress(coin);
      out[coin.id] = await withTimeout(fetchCoinBalance(coin, addr), 9000);
    })
  );
  return out;
}
