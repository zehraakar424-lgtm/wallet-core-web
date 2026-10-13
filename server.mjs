#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8790);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RPC_URL = {
  solana: "https://api.mainnet-beta.solana.com",
  ethereum: "https://ethereum.publicnode.com",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  polygon: "https://polygon-rpc.com",
  binance: "https://bsc-dataseed.binance.org",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  robinhood: "https://rpc.mainnet.chain.robinhood.com",
};

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function sendText(res, code, body, type = "text/plain") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseSurf(pathname) {
  const m = pathname.match(/^\/surf\/([^/]+)(\/.*)?$/);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (!host || /^(localhost|127\.|0\.0\.0\.0)/.test(host)) return null;
  return { host, path: m[2] || "/" };
}

function parseSurfHost(hostHeader) {
  const host = (hostHeader || "").split(":")[0].toLowerCase();
  if (!host.endsWith(".localhost") || host === "localhost") return null;
  const target = host.slice(0, -".localhost".length);
  if (!target || target.includes("/") || /^(127\.|0\.0\.0\.0)/.test(target)) return null;
  return target;
}

function toSurfUrl(absUrl, baseHost) {
  try {
    const u = new URL(absUrl, `https://${baseHost}/`);
    if (u.protocol !== "https:") return null;
    return `/surf/${u.host}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

function rewriteSurfHtml(body, host, walletOrigin) {
  const prefix = walletOrigin + "/surf/" + host;
  if (!/<base\s/i.test(body)) {
    body = body.replace(/<head(\s[^>]*)?>/i, (m) => m + `<base href="${prefix}/">`);
  }
  body = body.replace(/(\s(?:href|src)=["'])\/(?!\/)/gi, (_, g1) => g1 + prefix + "/");
  body = body.replace(/url\(\/(?!\/)/gi, "url(" + prefix + "/");
  const re = new RegExp("https://" + host.replace(/\./g, "\\.") + "/", "gi");
  body = body.replace(re, prefix + "/");
  return body;
}

async function proxySurf(host, urlPath, search, res, injectBase, opts) {
  opts = opts || {};
  const target = `https://${host}${urlPath}${search || ""}`;
  const up = await fetch(target, {
    redirect: "manual",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (up.status >= 300 && up.status < 400) {
    const loc = up.headers.get("location");
    if (loc) {
      const surf = toSurfUrl(loc, host);
      if (surf) {
        res.writeHead(302, { Location: surf, "Cache-Control": "no-store" });
        res.end();
        return;
      }
    }
  }

  const ct = up.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await up.arrayBuffer());

  if (ct.includes("text/html")) {
    let body = buf.toString("utf8");
    body = body.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");
    body = body.replace(/<meta[^>]+http-equiv=["']X-Frame-Options["'][^>]*>/gi, "");
    if (opts.rewriteSurf) body = rewriteSurfHtml(body, host, injectBase);
    else if (opts.localhostBase) {
      const base = `http://${host}.localhost:${PORT}/`;
      if (!/<base\s/i.test(body)) {
        body = body.replace(/<head(\s[^>]*)?>/i, (m) => m + `<base href="${base}">`);
      }
    }
    const injectTag = `<script src="${injectBase}/dapp-inject.js" data-parent="${injectBase}"></script>`;
    if (!body.includes("dapp-inject.js")) {
      body = body.replace(/<head(\s[^>]*)?>/i, (m) => m + injectTag);
    }
    res.writeHead(200, { "Content-Type": ct, "Cache-Control": "no-store" });
    res.end(body);
    return;
  }

  if (ct.includes("javascript") || ct.includes("json")) {
    let text = buf.toString("utf8");
    if (opts.rewriteSurf && text.includes(`"${host}`)) {
      const prefix = injectBase + "/surf/" + host;
      text = text.replace(new RegExp("https://" + host.replace(/\./g, "\\.") + "/", "g"), prefix + "/");
    }
    res.writeHead(up.status >= 200 && up.status < 400 ? 200 : up.status, {
      "Content-Type": ct,
      "Cache-Control": "no-store",
    });
    res.end(text);
    return;
  }

  res.writeHead(up.status >= 200 && up.status < 400 ? 200 : up.status, {
    "Content-Type": ct,
    "Cache-Control": "no-store",
  });
  if (opts.head) res.end();
  else res.end(buf);
}

async function proxyRpc(chain, method, params) {
  const url = RPC_URL[chain];
  if (!url) throw new Error("unknown chain");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params || [] }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}

const MARKET_TTL_MS = 120_000;
let marketCache = null;

const CORE_CG_IDS = ["bitcoin", "ethereum", "solana", "binancecoin", "matic-network", "cosmos"];
const CG_TO_PAPRIKA = {
  bitcoin: "btc-bitcoin",
  ethereum: "eth-ethereum",
  solana: "sol-solana",
  binancecoin: "bnb-binance-coin",
  "matic-network": "matic-polygon",
  cosmos: "atom-cosmos",
};

function cgHeaders() {
  const h = { accept: "application/json", "User-Agent": UA };
  if (process.env.COINGECKO_API_KEY) h["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  return h;
}

function moversFromCore(core) {
  return [...(core || [])]
    .sort(function (a, b) {
      return Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0);
    })
    .slice(0, 8);
}

async function fetchCoinGeckoMarkets(url) {
  const r = await fetch(url, { headers: cgHeaders() });
  if (!r.ok) throw new Error("market " + r.status);
  return r.json();
}

async function fetchMarketCoinPaprika() {
  const r = await fetch("https://api.coinpaprika.com/v1/tickers?quotes=USD", {
    headers: { accept: "application/json", "User-Agent": UA },
  });
  if (!r.ok) throw new Error("coinpaprika " + r.status);
  const all = await r.json();
  const byId = {};
  all.forEach(function (t) {
    byId[t.id] = t;
  });

  const core = CORE_CG_IDS.map(function (cgId) {
    const pk = CG_TO_PAPRIKA[cgId];
    const t = pk ? byId[pk] : null;
    if (!t?.quotes?.USD) return null;
    const q = t.quotes.USD;
    return {
      id: cgId,
      name: t.name,
      symbol: t.symbol,
      current_price: q.price,
      price_change_percentage_24h: q.percent_change_24h,
      image: "https://static.coinpaprika.com/coin/" + t.id + "/logo.png",
    };
  }).filter(Boolean);

  const movers = [...all]
    .filter(function (t) {
      return t.quotes?.USD && t.rank > 0 && t.rank <= 200;
    })
    .sort(function (a, b) {
      return (b.quotes.USD.percent_change_24h || 0) - (a.quotes.USD.percent_change_24h || 0);
    })
    .slice(0, 8)
    .map(function (t) {
      const q = t.quotes.USD;
      return {
        id: t.id,
        name: t.name,
        symbol: t.symbol,
        current_price: q.price,
        price_change_percentage_24h: q.percent_change_24h,
        image: "https://static.coinpaprika.com/coin/" + t.id + "/logo.png",
      };
    });

  return { core, movers, at: Date.now(), source: "coinpaprika" };
}

async function fetchMarketFresh() {
  const ids = CORE_CG_IDS.join(",");
  let core = [];
  let movers = [];
  let source = "coingecko";

  try {
    core = await fetchCoinGeckoMarkets(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" +
        ids +
        "&order=market_cap_desc&sparkline=false&price_change_percentage=24h"
    );
  } catch (e) {
    return fetchMarketCoinPaprika();
  }

  try {
    movers = await fetchCoinGeckoMarkets(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=8&page=1&sparkline=false&price_change_percentage=24h"
    );
  } catch (e) {
    movers = moversFromCore(core);
    source = "coingecko-partial";
  }

  if (!movers.length) movers = moversFromCore(core);
  return { core, movers, at: Date.now(), source };
}

async function fetchMarket() {
  if (marketCache && Date.now() - marketCache.at < MARKET_TTL_MS) {
    return { ...marketCache.data, cached: true };
  }

  try {
    const data = await fetchMarketFresh();
    marketCache = { data, at: Date.now() };
    return data;
  } catch (e) {
    if (marketCache?.data) {
      return { ...marketCache.data, stale: true, error: String(e.message || e) };
    }
    const data = await fetchMarketCoinPaprika();
    marketCache = { data, at: Date.now() };
    return data;
  }
}

function composeBriefText(prompt, market, walletHint) {
  const byId = {};
  (market.core || []).forEach((c) => {
    byId[c.id] = c;
  });
  const btc = byId.bitcoin;
  const eth = byId.ethereum;
  const sol = byId.solana;
  const top = (market.movers || [])[0];
  const focus = (prompt || "").trim() || "general market outlook";
  const lines = [];
  lines.push("Focus: " + focus + ".");
  if (btc && eth && sol) {
    lines.push(
      "Majors 24h: BTC " +
        fmtPct(btc.price_change_percentage_24h) +
        ", ETH " +
        fmtPct(eth.price_change_percentage_24h) +
        ", SOL " +
        fmtPct(sol.price_change_percentage_24h) +
        "."
    );
  }
  if (top) {
    lines.push("Standout mover: " + top.name + " " + fmtPct(top.price_change_percentage_24h) + " — check liquidity and venue before trading.");
  }
  if (walletHint) lines.push(walletHint);
  lines.push("This briefing is auto-generated from public market data · not financial advice.");
  return lines.join("\n\n");
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/market") {
    try {
      const data = await fetchMarket();
      sendJson(res, 200, { ok: true, ...data });
    } catch (e) {
      sendJson(res, 502, { ok: false, error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/rpc") {
    try {
      const body = await readBody(req);
      const chain = body?.chain;
      const method = body?.method;
      const params = body?.params;
      if (!chain || !method) throw new Error("chain and method required");
      const result = await proxyRpc(chain, method, params);
      sendJson(res, 200, { ok: true, result });
    } catch (e) {
      sendJson(res, 502, { ok: false, error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/btc/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/btc/".length));
    try {
      const r = await fetch("https://blockstream.info/api/address/" + encodeURIComponent(addr));
      if (!r.ok) throw new Error("btc " + r.status);
      const j = await r.json();
      const funded = j.chain_stats?.funded_txo_sum || 0;
      const spent = j.chain_stats?.spent_txo_sum || 0;
      sendJson(res, 200, { ok: true, satoshi: Math.max(0, funded - spent) });
    } catch (e) {
      sendJson(res, 502, { ok: false, error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/cosmos/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/cosmos/".length));
    try {
      const r = await fetch(
        "https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances/" + encodeURIComponent(addr)
      );
      if (!r.ok) throw new Error("cosmos " + r.status);
      const j = await r.json();
      let uatom = 0;
      (j.balances || []).forEach((b) => {
        if (b.denom === "uatom") uatom = Number(b.amount || 0);
      });
      sendJson(res, 200, { ok: true, uatom });
    } catch (e) {
      sendJson(res, 502, { ok: false, error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/tron/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/tron/".length));
    try {
      const r = await fetch("https://api.trongrid.io/v1/accounts/" + encodeURIComponent(addr));
      const j = await r.json();
      const sun = j?.data?.[0]?.balance ?? 0;
      sendJson(res, 200, { ok: true, sun: Number(sun) });
    } catch (e) {
      sendJson(res, 200, { ok: true, sun: 0 });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/ltc/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/ltc/".length));
    try {
      const r = await fetch("https://litecoinspace.org/api/address/" + encodeURIComponent(addr));
      if (!r.ok) throw new Error("ltc " + r.status);
      const j = await r.json();
      const funded = j.chain_stats?.funded_txo_sum || 0;
      const spent = j.chain_stats?.spent_txo_sum || 0;
      sendJson(res, 200, { ok: true, litoshi: Math.max(0, funded - spent) });
    } catch (e) {
      sendJson(res, 200, { ok: true, litoshi: 0 });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/doge/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/doge/".length));
    try {
      const r = await fetch("https://api.blockcypher.com/v1/doge/main/addrs/" + encodeURIComponent(addr) + "/balance");
      if (!r.ok) throw new Error("doge " + r.status);
      const j = await r.json();
      sendJson(res, 200, { ok: true, koinu: Number(j.balance || 0) });
    } catch (e) {
      sendJson(res, 200, { ok: true, koinu: 0 });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/ton/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/ton/".length));
    try {
      const r = await fetch(
        "https://toncenter.com/api/v2/getAddressBalance?address=" + encodeURIComponent(addr)
      );
      const j = await r.json();
      sendJson(res, 200, { ok: true, nanoton: Number(j.result || 0) });
    } catch (e) {
      sendJson(res, 200, { ok: true, nanoton: 0 });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/sui/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/sui/".length));
    try {
      const r = await fetch("https://fullnode.mainnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_getBalance",
          params: [addr],
        }),
      });
      const j = await r.json();
      const total = j.result?.totalBalance ?? 0;
      sendJson(res, 200, { ok: true, mist: Number(total) });
    } catch (e) {
      sendJson(res, 200, { ok: true, mist: 0 });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/nft/solana/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/nft/solana/".length));
    try {
      const r = await fetch("https://api-mainnet.magiceden.dev/v2/wallets/" + encodeURIComponent(addr) + "/tokens");
      if (!r.ok) throw new Error("nft " + r.status);
      const j = await r.json();
      sendJson(res, 200, { ok: true, tokens: Array.isArray(j) ? j.slice(0, 40) : [] });
    } catch (e) {
      sendJson(res, 200, { ok: true, tokens: [], error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/activity/solana/")) {
    const addr = decodeURIComponent(url.pathname.slice("/api/activity/solana/".length));
    try {
      const sigs = await proxyRpc("solana", "getSignaturesForAddress", [addr, { limit: 12 }]);
      sendJson(res, 200, { ok: true, signatures: sigs || [] });
    } catch (e) {
      sendJson(res, 200, { ok: true, signatures: [], error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/activity/evm/")) {
    const rest = url.pathname.slice("/api/activity/evm/".length);
    const [chain, addr] = rest.split("/", 2);
    const explorers = {
      ethereum: "https://eth.blockscout.com/api/v2/addresses/",
      base: "https://base.blockscout.com/api/v2/addresses/",
      arbitrum: "https://arbitrum.blockscout.com/api/v2/addresses/",
      polygon: "https://polygon.blockscout.com/api/v2/addresses/",
      binance: "https://bsc.blockscout.com/api/v2/addresses/",
    };
    const base = explorers[chain];
    if (!base || !addr) {
      sendJson(res, 400, { ok: false, error: "bad evm activity request" });
      return true;
    }
    try {
      const r = await fetch(base + encodeURIComponent(addr) + "/transactions");
      if (!r.ok) throw new Error("evm activity " + r.status);
      const j = await r.json();
      sendJson(res, 200, { ok: true, items: (j.items || []).slice(0, 12) });
    } catch (e) {
      sendJson(res, 200, { ok: true, items: [], error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/brief/compose") {
    try {
      const body = await readBody(req);
      const market = body?.market || (await fetchMarket());
      const text = composeBriefText(body?.prompt, market, body?.walletHint);
      sendJson(res, 200, { ok: true, text, at: Date.now() });
    } catch (e) {
      sendJson(res, 502, { ok: false, error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/lifi/quote") {
    try {
      const lifiUrl = new URL("https://li.quest/v1/quote");
      const pass = [
        "fromChain",
        "toChain",
        "fromToken",
        "toToken",
        "fromAmount",
        "fromAddress",
        "toAddress",
        "slippage",
        "integrator",
        "order",
      ];
      pass.forEach(function (k) {
        const v = url.searchParams.get(k);
        if (v) lifiUrl.searchParams.set(k, v);
      });
      if (!lifiUrl.searchParams.get("integrator")) lifiUrl.searchParams.set("integrator", "xendra");
      const headers = { accept: "application/json" };
      if (process.env.LIFI_API_KEY) headers["x-lifi-api-key"] = process.env.LIFI_API_KEY;
      const up = await fetch(lifiUrl.toString(), { headers });
      const body = await up.json();
      if (!up.ok) {
        const msg = body?.message || body?.error || up.statusText || "LI.FI quote failed";
        sendJson(res, up.status >= 400 && up.status < 600 ? up.status : 502, { ok: false, error: String(msg) });
        return true;
      }
      sendJson(res, 200, { ok: true, quote: body });
    } catch (e) {
      sendJson(res, 502, { ok: false, error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/lifi/status") {
    try {
      const lifiUrl = new URL("https://li.quest/v1/status");
      ["txHash", "fromChain", "toChain", "bridge"].forEach(function (k) {
        const v = url.searchParams.get(k);
        if (v) lifiUrl.searchParams.set(k, v);
      });
      const headers = { accept: "application/json" };
      if (process.env.LIFI_API_KEY) headers["x-lifi-api-key"] = process.env.LIFI_API_KEY;
      const up = await fetch(lifiUrl.toString(), { headers });
      const body = await up.json();
      sendJson(res, up.ok ? 200 : 502, { ok: up.ok, status: body });
    } catch (e) {
      sendJson(res, 502, { ok: false, error: String(e.message || e) });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/browse") {
    const u = url.searchParams.get("u") || "";
    try {
      const t = new URL(u);
      res.writeHead(302, { Location: `/surf/${t.host}${t.pathname}${t.search}` });
      res.end();
      return true;
    } catch {
      sendJson(res, 400, { ok: false, error: "bad url" });
      return true;
    }
  }

  return false;
}

const vite = await createViteServer({
  root: __dirname,
  server: { middlewareMode: true },
  appType: "custom",
});

const injectBase = `http://127.0.0.1:${PORT}`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", injectBase);

  if (await handleApi(req, res, url)) return;

  const surfHost = parseSurfHost(req.headers.host);
  const surfMethod = req.method === "GET" || req.method === "HEAD";

  if (surfHost && surfMethod) {
    try {
      await proxySurf(surfHost, url.pathname || "/", url.search, res, injectBase, { localhostBase: true, head: req.method === "HEAD" });
    } catch (e) {
      sendText(res, 502, String(e.message || e));
    }
    return;
  }

  const surf = parseSurf(url.pathname);
  if (surf && surfMethod) {
    try {
      await proxySurf(surf.host, surf.path, url.search, res, injectBase, { rewriteSurf: true, head: req.method === "HEAD" });
    } catch (e) {
      sendText(res, 502, String(e.message || e));
    }
    return;
  }

  vite.middlewares(req, res, async () => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 404, "not found");
      return;
    }
    const p = url.pathname || "/";
    if (/\.\w+$/.test(p) && !p.endsWith(".html")) {
      sendText(res, 404, "not found");
      return;
    }
    try {
      const template = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
      const html = await vite.transformIndexHtml(p + url.search, template);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "HEAD") res.end();
      else res.end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      sendText(res, 500, String(e.message || e));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Xendra wallet-core-web → http://127.0.0.1:" + PORT + "/");
  console.log("In-app browser: http://HOST.localhost:" + PORT + "/ (e.g. jup.ag.localhost:" + PORT + ")");
});
