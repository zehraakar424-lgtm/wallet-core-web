import Module from "xendra-wallet-core";
import { COINS, EARN, DAPPS, allSwapTokens } from "./chains.mjs";
import { fetchAllBalances } from "./balances.mjs";
import { openInAppBrowser, wireBrowser, setProviderAddresses } from "./browser.mjs";
import { SWAP_ASSETS, swapAssetById, amountToBaseUnits } from "./swap-config.mjs";
import { fetchLifiQuote, executeLifiQuote } from "./swap-exec.mjs";
import { getActiveMnemonic, loadWalletState } from "./wallets.mjs";
import { wireWalletHub, syncWalletLabel, openWalletHub } from "./wallet-hub.mjs";
import { wireSendSheet, openSendSheet } from "./send-sheet.mjs";
import { wireOnboarding, startOnboarding } from "./onboarding.mjs";
import { lockSession } from "./auth.mjs";
import { apiFetch } from "./api-client.mjs";
import { showToast } from "./ui-toast.mjs";
const SWAP_TOKENS = allSwapTokens();

const $ = (id) => document.getElementById(id);
let core = null;
let CoinType = null;
let prices = {};
let liveBalances = {};
let addressBook = {};
let lastMnemonic = null;
let balanceAnim = null;
let currentTab = "home";
let trendingLoaded = false;
let discoverDappsRendered = false;
let swapUiReady = false;
let lifiQuote = null;
let lifiQuoteTimer = null;
let lifiQuoteSeq = 0;
let lifiQuoteLoading = false;
let lastMarket = null;
let homeTab = "crypto";

function fmtUsd(n) {
  return "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAmt(n, sym) {
  const d = sym === "BTC" ? 6 : sym === "POL" || sym === "ATOM" ? 4 : n < 0.001 ? 6 : 4;
  return n.toLocaleString(undefined, { maximumFractionDigits: d }) + " " + sym;
}

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDG", "DAI", "USDS", "PYUSD"]);

function tokenUsdPrice(asset) {
  if (!asset) return 0;
  const p = (prices[asset.cg] || {}).usd;
  if (p != null && p > 0) return p;
  if (STABLE_SYMBOLS.has(asset.symbol)) return 1;
  return 0;
}

function shortAddr(a) {
  if (!a || a.length < 12) return a || "—";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function coinIcon(coin) {
  if (coin?.icon) return coin.icon;
  const p = prices[coin.cg] || {};
  return p.image || "";
}

function imgHtml(src, fallback) {
  const fb = fallback || src;
  return '<img src="' + src + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + fb + '\'" />';
}

function parseAmount(s) {
  const n = parseFloat(String(s || "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function coinById(id) {
  return SWAP_TOKENS.find(function (c) {
    return c.id === id;
  });
}

function estSwapOut(fromId, toId, amountIn) {
  const from = coinById(fromId);
  const to = coinById(toId);
  if (!from || !to || !amountIn) return 0;
  const pf = (prices[from.cg] || {}).usd || 0;
  const pt = (prices[to.cg] || {}).usd || 0;
  if (!pf || !pt) return 0;
  return (amountIn * pf) / pt;
}

function swapAddressForAsset(asset) {
  if (!asset) return null;
  if (asset.kind === "svm") return addressBook.solana;
  if (asset.kind === "evm") return addressBook.ethereum;
  return null;
}

function swapBalanceForAsset(asset) {
  if (!asset?.balanceCoinId) return null;
  const v = liveBalances[asset.balanceCoinId];
  return v != null ? v : null;
}

async function refreshLifiQuote() {
  const fromEl = $("swap-from");
  const toEl = $("swap-to");
  if (!fromEl || !toEl) return;
  const from = swapAssetById(fromEl.value);
  const to = swapAssetById(toEl.value);
  const amtIn = parseAmount($("swap-amount-in")?.value);
  const routeEl = $("swap-route");
  const outEl = $("swap-amount-out");
  lifiQuote = null;

  if (!from || !to || from.id === to.id || !amtIn) {
    if (routeEl) routeEl.textContent = from && to && from.id === to.id ? "Pick two different tokens" : "Route: enter amount";
    if (outEl && !amtIn) outEl.value = "";
    refreshSwapUiFallback(from, to, amtIn);
    return;
  }

  const fromAddr = swapAddressForAsset(from);
  const toAddr = swapAddressForAsset(to);
  if (!fromAddr || fromAddr === "—" || !toAddr || toAddr === "—") {
    if (routeEl) routeEl.textContent = "Route: wallet address unavailable";
    refreshSwapUiFallback(from, to, amtIn);
    return;
  }

  const slipPct = parseFloat($("swap-slip")?.value || "1");
  const slippage = Number.isFinite(slipPct) ? slipPct / 100 : 0.01;
  const fromAmount = amountToBaseUnits(amtIn, from.decimals);
  if (fromAmount === "0") {
    refreshSwapUiFallback(from, to, amtIn);
    return;
  }

  const seq = ++lifiQuoteSeq;
  lifiQuoteLoading = true;
  if (routeEl) routeEl.textContent = "Route: fetching LI.FI…";
  $("swap-submit")?.setAttribute("disabled", "disabled");

  try {
    const quote = await fetchLifiQuote({
      fromChain: from.lifiChain,
      toChain: to.lifiChain,
      fromToken: from.lifiToken,
      toToken: to.lifiToken,
      fromAmount,
      fromAddress: fromAddr,
      toAddress: toAddr,
      slippage: String(slippage),
    });
    if (seq !== lifiQuoteSeq) return;
    lifiQuote = quote;
    const est = quote.estimate || {};
    const toDec = est.toAmountDecimals != null ? est.toAmountDecimals : to.decimals;
    const outAmt = Number(est.toAmount || 0) / Math.pow(10, toDec);
    if (outEl) {
      const d = to.symbol === "WBTC" || to.symbol === "BTC" ? 6 : outAmt < 0.001 ? 8 : 5;
      outEl.value = outAmt > 0 ? String(Number(outAmt.toFixed(d))) : "";
    }
    const tool = quote.toolDetails?.name || quote.tool || "LI.FI";
    const gas = est.gasCosts?.[0]?.amountUSD;
    if (routeEl) {
      routeEl.textContent =
        "Route: " +
        tool +
        (from.lifiChain !== to.lifiChain ? " · bridge" : "") +
        (gas ? " · gas ≈ $" + Number(gas).toFixed(2) : "");
    }
    const pf = tokenUsdPrice(from);
    const pt = tokenUsdPrice(to);
    const fromUsd =
      est.fromAmountUSD != null && est.fromAmountUSD !== ""
        ? Number(est.fromAmountUSD)
        : amtIn * pf;
    const toUsd =
      est.toAmountUSD != null && est.toAmountUSD !== ""
        ? Number(est.toAmountUSD)
        : outAmt * pt;
    $("swap-from-usd").textContent = "≈ " + fmtUsd(fromUsd);
    $("swap-to-usd").textContent = "≈ " + fmtUsd(toUsd);
    if (outAmt > 0) {
      const rate = amtIn / outAmt;
      $("swap-rate").textContent = "1 " + to.symbol + " ≈ " + rate.toFixed(6) + " " + from.symbol;
    }
  } catch (e) {
    if (seq !== lifiQuoteSeq) return;
    lifiQuote = null;
    if (routeEl) routeEl.textContent = "Route: " + (e.message || "no route");
    refreshSwapUiFallback(from, to, amtIn);
  } finally {
    if (seq === lifiQuoteSeq) {
      lifiQuoteLoading = false;
      $("swap-submit")?.removeAttribute("disabled");
    }
  }
}

function scheduleLifiQuote() {
  if (lifiQuoteTimer) clearTimeout(lifiQuoteTimer);
  lifiQuoteTimer = setTimeout(refreshLifiQuote, 480);
}

function estSwapOutAssets(from, to, amountIn) {
  if (!from || !to || !amountIn) return 0;
  const pf = tokenUsdPrice(from);
  const pt = tokenUsdPrice(to);
  if (!pf || !pt) return 0;
  return (amountIn * pf) / pt;
}

function refreshSwapUiFallback(from, to, amtIn) {
  if (!from || !to) return;
  let amtOut = estSwapOutAssets(from, to, amtIn);
  const slip = parseFloat($("swap-slip")?.value || "1") / 100;
  amtOut *= 1 - slip;
  const outEl = $("swap-amount-out");
  if (outEl && amtIn > 0) {
    const d = to.symbol === "WBTC" ? 6 : 5;
    outEl.value = amtOut > 0 ? String(Number(amtOut.toFixed(d))) : "";
  }
  const pf = tokenUsdPrice(from);
  const pt = tokenUsdPrice(to);
  $("swap-from-usd").textContent = "≈ " + fmtUsd(amtIn * pf);
  $("swap-to-usd").textContent = "≈ " + fmtUsd(amtOut * pt);
  if (pf && pt) {
    $("swap-rate").textContent = "1 " + from.symbol + " ≈ " + (pf / pt).toFixed(6) + " " + to.symbol + " (estimate)";
  } else if (amtOut > 0 && amtIn > 0) {
    $("swap-rate").textContent =
      "1 " + to.symbol + " ≈ " + (amtIn / amtOut).toFixed(6) + " " + from.symbol + " (estimate)";
  }
}

function animateBalance(target) {
  const el = $("balance");
  if (!el) return;
  if (balanceAnim) cancelAnimationFrame(balanceAnim);
  const from = parseAmount(el.textContent.replace(/[^0-9.-]/g, "")) || 0;
  const start = performance.now();
  const dur = 520;
  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmtUsd(from + (target - from) * eased);
    if (t < 1) balanceAnim = requestAnimationFrame(frame);
    else balanceAnim = null;
  }
  balanceAnim = requestAnimationFrame(frame);
}

function toast(msg) {
  showToast(msg);
}

async function loadPrices() {
  try {
    const ids = [...new Set(COINS.concat(SWAP_TOKENS, SWAP_ASSETS).map((c) => c.cg))].filter(Boolean).join(",");
    const r = await apiFetch("/api/market");
    if (r.ok) {
      const m = await r.json();
      if (m.ok && m.core) {
        lastMarket = m;
        m.core.forEach(function (c) {
          prices[c.id] = { usd: c.current_price, usd_24h_change: c.price_change_percentage_24h, image: c.image };
        });
        (m.movers || []).forEach(function (c) {
          if (!prices[c.id]) prices[c.id] = {};
          prices[c.id].usd = c.current_price;
          prices[c.id].usd_24h_change = c.price_change_percentage_24h;
          prices[c.id].image = c.image;
        });
      }
    }
    const r2 = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=" + ids + "&vs_currencies=usd&include_24hr_change=true"
    );
    if (r2.ok) {
      const data = await r2.json();
      Object.keys(data).forEach(function (k) {
        prices[k] = Object.assign(prices[k] || {}, data[k]);
      });
    }
    const imgR = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" + ids + "&per_page=50"
    );
    if (imgR.ok) {
      const markets = await imgR.json();
      markets.forEach(function (m) {
        if (!prices[m.id]) prices[m.id] = {};
        prices[m.id].image = m.image;
        if (m.current_price != null) prices[m.id].usd = m.current_price;
      });
    }
  } catch (e) {}
}

function requireMnemonic() {
  const mnemonic = getActiveMnemonic();
  if (!mnemonic) throw new Error("No wallet — complete setup first.");
  return mnemonic;
}

const COIN_TYPE_KEYS = {
  binance: "smartChain",
  avalanche: "avalancheCChain",
};

function resolveCoinType(coin) {
  const candidates = [coin.coinType, COIN_TYPE_KEYS[coin.id], coin.id].filter(Boolean);
  for (let i = 0; i < candidates.length; i++) {
    const ct = CoinType[candidates[i]];
    if (ct) return ct;
  }
  return null;
}

function getAddressForCoin(wallet, coin) {
  const ct = resolveCoinType(coin);
  if (!ct) return "—";
  try {
    return wallet.getAddressForCoin(ct);
  } catch (e) {
    return "—";
  }
}

function appendCoinRow(root, coin, addr, amt, q) {
  if (q && !coin.title.toLowerCase().includes(q) && !coin.symbol.toLowerCase().includes(q)) return;

  const p = prices[coin.cg] || {};
  const price = p.usd || 0;
  const ch = p.usd_24h_change || 0;
  const usd = (amt || 0) * price;
  const icon = coinIcon(coin);
  const badge = coin.badge
    ? '<img class="tw-asset-badge" src="' + coin.badge + '" alt="" loading="lazy" />'
    : "";

  const row = document.createElement("button");
  row.type = "button";
  row.className = "tw-asset";
  row.dataset.coinId = coin.id;
  row.innerHTML =
    '<div class="tw-asset-icon">' +
    imgHtml(icon, coin.icon || icon) +
    badge +
    '</div><div class="tw-asset-meta"><strong>' +
    coin.title +
    "</strong><span class=\"tw-asset-amt\">" +
    (amt == null ? "…" : fmtAmt(amt, coin.symbol)) +
    "</span><small>" +
    (addr === "—" ? "Address unavailable" : shortAddr(addr)) +
    "</small></div><div class=\"tw-asset-val\"><strong class=\"tw-asset-usd\">" +
    fmtUsd(usd) +
    '</strong><span class="' +
    (ch >= 0 ? "up" : "down") +
    '">' +
    (ch >= 0 ? "+" : "") +
    (ch || 0).toFixed(2) +
    "%</span></div>";

  row.addEventListener("click", function () {
    if (addr === "—") {
      toast("Address unavailable for this chain");
      return;
    }
    navigator.clipboard.writeText(addr).then(
      function () {
        toast("Address copied");
      },
      function () {
        toast(shortAddr(addr));
      }
    );
  });
  if (coin.rpc === "solana" || coin.rpc) {
    row.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      openSendSheet({ coinId: coin.id });
    });
  }
  root.appendChild(row);
  return { usd: usd, weighted: usd * ch };
}

function applyTotals(total, weighted) {
  const change = total > 0 ? weighted / total : 0;
  $("balance").textContent = fmtUsd(total);
  const chEl = $("change");
  chEl.textContent = (change >= 0 ? "+" : "") + change.toFixed(2) + "% (" + fmtUsd(Math.abs(total * (change / 100))) + ")";
  chEl.className = "tw-hero-change " + (change >= 0 ? "up" : "down");
}

async function renderAddresses(mnemonic, opts) {
  opts = opts || {};
  lastMnemonic = mnemonic;
  const root = $("addrs");
  if (!root) return;

  if (opts.resetSearch && $("asset-search")) $("asset-search").value = "";

  root.replaceChildren();
  $("wallet-state").textContent = "Deriving addresses…";

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, "");
  addressBook = {};
  COINS.forEach(function (coin) {
    try {
      addressBook[coin.id] = getAddressForCoin(wallet, coin);
    } catch (e) {
      addressBook[coin.id] = "—";
    }
  });
  setProviderAddresses(addressBook.ethereum, addressBook.solana);

  const q = ($("asset-search")?.value || "").trim().toLowerCase();
  let total = 0;
  let weighted = 0;

  COINS.forEach(function (coin) {
    try {
      const r = appendCoinRow(root, coin, addressBook[coin.id], null, q);
      if (r) {
        total += r.usd;
        weighted += r.weighted;
      }
    } catch (e) {
      console.error("row", coin.id, e);
    }
  });

  applyTotals(total, weighted);
  $("wallet-state").textContent = "Fetching balances · " + COINS.length + " chains";

  wallet.delete();

  try {
    liveBalances = await fetchAllBalances(COINS, function (coin) {
      return addressBook[coin.id];
    });
  } catch (e) {
    liveBalances = liveBalances || {};
  }

  root.replaceChildren();
  total = 0;
  weighted = 0;
  COINS.forEach(function (coin) {
    try {
      const amt = liveBalances[coin.id] || 0;
      const r = appendCoinRow(root, coin, addressBook[coin.id], amt, q);
      if (r) {
        total += r.usd;
        weighted += r.weighted;
      }
    } catch (e) {
      console.error("row", coin.id, e);
    }
  });

  if (opts.animate !== false && !q) animateBalance(total);
  else applyTotals(total, weighted);

  $("wallet-state").textContent =
    COINS.length + " chains · live RPC · tap row to copy address" + (q ? " · filter: " + q : "");

  refreshSwapUi();
  if (homeTab === "nfts") loadNfts();
  if (homeTab === "activity") loadActivity();
}

function setHomeTab(tab) {
  homeTab = tab;
  document.querySelectorAll("[data-home-tab]").forEach(function (b) {
    b.classList.toggle("is-active", b.dataset.homeTab === tab);
    b.disabled = false;
  });
  $("home-pane-crypto").hidden = tab !== "crypto";
  $("home-pane-nfts").hidden = tab !== "nfts";
  $("home-pane-activity").hidden = tab !== "activity";
  $("asset-search").hidden = tab !== "crypto";
  if (tab === "nfts") loadNfts();
  if (tab === "activity") loadActivity();
}

async function loadNfts() {
  const root = $("nfts-list");
  if (!root) return;
  root.replaceChildren();
  const sol = addressBook.solana;
  if (!sol) {
    root.innerHTML = '<p class="tw-page-sub">No Solana address</p>';
    return;
  }
  root.innerHTML = '<p class="tw-page-sub">Loading NFTs…</p>';
  try {
    const r = await apiFetch("/api/nft/solana/" + encodeURIComponent(sol));
    const j = await r.json();
    root.replaceChildren();
    const tokens = j.tokens || [];
    if (!tokens.length) {
      root.innerHTML = '<p class="tw-page-sub">No NFTs on Solana for this wallet.</p>';
      return;
    }
    tokens.forEach(function (t) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tw-asset";
      const img = t.image || t.imageURI || "";
      btn.innerHTML =
        '<div class="tw-asset-icon">' +
        (img ? imgHtml(img, "") : '<span class="tw-nft-ph">NFT</span>') +
        '</div><div class="tw-asset-meta"><strong>' +
        (t.name || "Unknown") +
        "</strong><span>" +
        (t.collection || "Solana") +
        '</span><small>Magic Eden</small></div><div class="tw-asset-val"><strong>—</strong></div>';
      btn.addEventListener("click", function () {
        if (t.mintAddress) openInAppBrowser("magiceden.io", "/item-details/" + t.mintAddress);
      });
      root.appendChild(btn);
    });
  } catch (e) {
    root.innerHTML = '<p class="tw-page-sub">NFT load failed</p>';
  }
}

async function loadActivity() {
  const root = $("activity-list");
  if (!root) return;
  root.replaceChildren();
  root.innerHTML = '<p class="tw-page-sub">Loading activity…</p>';
  const items = [];

  if (addressBook.solana) {
    try {
      const r = await apiFetch("/api/activity/solana/" + encodeURIComponent(addressBook.solana));
      const j = await r.json();
      (j.signatures || []).forEach(function (s) {
        items.push({
          chain: "Solana",
          title: s.err ? "Failed tx" : "Transaction",
          sub: shortAddr(s.signature),
          time: s.blockTime ? new Date(s.blockTime * 1000).toLocaleString() : "",
          url: "https://solscan.io/tx/" + s.signature,
        });
      });
    } catch (e) {}
  }

  for (const coin of COINS.filter(function (c) {
    return c.rpc && c.rpc !== "solana";
  }).slice(0, 3)) {
    const addr = addressBook[coin.id];
    if (!addr) continue;
    try {
      const r = await apiFetch("/api/activity/evm/" + coin.rpc + "/" + encodeURIComponent(addr));
      const j = await r.json();
      (j.items || []).forEach(function (tx) {
        items.push({
          chain: coin.title,
          title: tx.method || "Transfer",
          sub: shortAddr(tx.hash),
          time: tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "",
          url: tx.transaction_url || "",
        });
      });
    } catch (e) {}
  }

  root.replaceChildren();
  if (!items.length) {
    root.innerHTML = '<p class="tw-page-sub">No recent activity found on public indexers.</p>';
    return;
  }
  items.slice(0, 20).forEach(function (it) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tw-asset";
    btn.innerHTML =
      '<div class="tw-asset-icon tw-asset-icon--plain">' +
      it.chain.slice(0, 1) +
      '</div><div class="tw-asset-meta"><strong>' +
      it.title +
      "</strong><span>" +
      it.chain +
      "</span><small>" +
      it.sub +
      (it.time ? " · " + it.time : "") +
      "</small></div>";
    btn.addEventListener("click", function () {
      if (it.url) window.open(it.url, "_blank", "noopener,noreferrer");
    });
    root.appendChild(btn);
  });
}

function setTab(tab) {
  if (tab === currentTab) return;
  currentTab = tab;
  document.querySelectorAll(".tw-panel[data-panel]").forEach(function (p) {
    const on = p.dataset.panel === tab;
    if (on) {
      p.classList.remove("is-active");
      void p.offsetWidth;
      p.classList.add("is-active");
    } else {
      p.classList.remove("is-active");
    }
  });
  document.querySelectorAll("#main-nav [data-tab]").forEach(function (b) {
    b.classList.toggle("is-active", b.dataset.tab === tab);
  });
  if (tab === "trending") loadTrending();
  if (tab === "earn") renderEarn();
  if (tab === "discover") {
    renderDiscover();
    loadBriefings(false);
  }
  if (tab === "swap") refreshSwapUi();
}

function refreshSwapUi() {
  const fromEl = $("swap-from");
  const toEl = $("swap-to");
  if (!fromEl || !toEl) return;
  const from = swapAssetById(fromEl.value);
  const to = swapAssetById(toEl.value);
  if (from) {
    $("swap-from-icon").src = coinIcon(from);
    $("swap-from-sym").textContent = from.symbol;
    const bal = swapBalanceForAsset(from);
    $("swap-from-bal").textContent =
      "Balance: " + (bal != null ? fmtAmt(bal, from.symbol) : "— (ERC20/SPL not tracked yet)");
  }
  if (to) {
    $("swap-to-icon").src = coinIcon(to);
    $("swap-to-sym").textContent = to.symbol;
  }
  scheduleLifiQuote();
}

function initSwapForm() {
  const fromEl = $("swap-from");
  const toEl = $("swap-to");
  if (!fromEl || !toEl || swapUiReady) return;
  swapUiReady = true;
  fromEl.replaceChildren();
  toEl.replaceChildren();
  SWAP_ASSETS.forEach(function (c) {
    const label = c.title === c.symbol ? c.symbol : c.title;
    const o1 = document.createElement("option");
    o1.value = c.id;
    o1.textContent = label;
    fromEl.appendChild(o1);
    const o2 = document.createElement("option");
    o2.value = c.id;
    o2.textContent = label;
    toEl.appendChild(o2);
  });
  fromEl.value = "sol";
  toEl.value = "usdc-sol";

  fromEl.addEventListener("change", refreshSwapUi);
  toEl.addEventListener("change", refreshSwapUi);
  $("swap-slip")?.addEventListener("change", refreshSwapUi);
  $("swap-amount-in")?.addEventListener("input", refreshSwapUi);
  $("swap-max")?.addEventListener("click", function () {
    const from = swapAssetById(fromEl.value);
    if (!from) return;
    const bal = swapBalanceForAsset(from);
    if (bal == null) {
      toast("Balance not tracked for this token");
      return;
    }
    let max = bal;
    if (from.kind === "svm" && from.symbol === "SOL") max = Math.max(0, bal - 0.01);
    if (from.kind === "evm" && from.lifiToken === "0x0000000000000000000000000000000000000000") {
      max = Math.max(0, bal - 0.002);
    }
    $("swap-amount-in").value = max ? String(max) : "";
    refreshSwapUi();
  });
  $("swap-flip")?.addEventListener("click", function () {
    const a = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = a;
    refreshSwapUi();
  });
  refreshSwapUi();
}

function renderEarn() {
  const root = $("earn-list");
  if (!root || root.childElementCount) return;
  EARN.forEach(function (item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tw-card";
    btn.innerHTML =
      '<div class="tw-card-icon">' +
      imgHtml(item.icon, item.fallback) +
      '</div><div class="tw-card-meta"><strong>' +
      item.title +
      "</strong><span>" +
      item.sub +
      '</span></div><span class="tw-card-action">' +
      item.apy +
      "</span>";
    btn.addEventListener("click", function () {
      openInAppBrowser(item.surfHost || new URL(item.url).host);
    });
    root.appendChild(btn);
  });
}

function renderDiscover() {
  const root = $("discover-list");
  if (!root || discoverDappsRendered) return;
  discoverDappsRendered = true;
  DAPPS.forEach(function (item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tw-card";
    btn.innerHTML =
      '<div class="tw-card-icon">' +
      imgHtml(item.icon, item.fallback) +
      '</div><div class="tw-card-meta"><strong>' +
      item.title +
      "</strong><span>" +
      item.sub +
      '</span></div><span class="tw-card-action">Open</span>';
    btn.addEventListener("click", function () {
      openInAppBrowser(item.surfHost || new URL(item.url).host);
    });
    root.appendChild(btn);
  });
}

function briefTime() {
  return new Date().toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function walletHintText() {
  let portCh = 0;
  let portUsd = 0;
  COINS.forEach(function (coin) {
    const p = prices[coin.cg] || {};
    const usd = (liveBalances[coin.id] || 0) * (p.usd || 0);
    portUsd += usd;
    portCh += usd * (p.usd_24h_change || 0);
  });
  const walletCh = portUsd > 0 ? portCh / portUsd : 0;
  return (
    "Your wallet (on-chain) ≈ " +
    fmtUsd(portUsd) +
    ", 24h tilt " +
    (walletCh >= 0 ? "+" : "") +
    walletCh.toFixed(2) +
    "%."
  );
}

async function loadBriefings(composeOnly) {
  const root = $("briefings-list");
  if (!root) return;
  if (!composeOnly) {
    root.replaceChildren();
    const loading = document.createElement("article");
    loading.className = "tw-brief";
    loading.innerHTML = '<span class="tw-brief-tag">Xendra AI</span><p>Loading market brief…</p>';
    root.appendChild(loading);
  }

  try {
    if (!lastMarket) {
      const r = await apiFetch("/api/market");
      lastMarket = await r.json();
    }
    if (!lastMarket?.ok) throw new Error(lastMarket?.error || "market unavailable");

    const byId = {};
    (lastMarket.core || []).forEach(function (c) {
      byId[c.id] = c;
    });
    const btc = byId.bitcoin;
    const eth = byId.ethereum;
    const sol = byId.solana;
    const top = (lastMarket.movers || [])[0];

    root.replaceChildren();
    const autoCards = [];
    if (btc && eth && sol) {
      autoCards.push({
        tag: "Market pulse",
        text:
          "BTC " +
          fmtPct(btc.price_change_percentage_24h) +
          ", ETH " +
          fmtPct(eth.price_change_percentage_24h) +
          ", SOL " +
          fmtPct(sol.price_change_percentage_24h) +
          " over 24h.",
      });
    }
    if (top) {
      autoCards.push({
        tag: "Mover watch",
        text: top.name + " " + fmtPct(top.price_change_percentage_24h) + " — confirm venue depth before size.",
      });
    }
    autoCards.push({ tag: "Your wallet", text: walletHintText() });

    autoCards.forEach(function (c) {
      const el = document.createElement("article");
      el.className = "tw-brief";
      el.innerHTML =
        '<span class="tw-brief-tag">' +
        c.tag +
        '</span><p>' +
        c.text +
        '</p><time>Updated ' +
        briefTime() +
        "</time>";
      root.appendChild(el);
    });

    const custom = $("briefings-custom");
    if (custom && custom.value.trim()) {
      const r = await apiFetch("/api/brief/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: custom.value.trim(),
          market: lastMarket,
          walletHint: walletHintText(),
        }),
      });
      const j = await r.json();
      if (j.ok && j.text) {
        const el = document.createElement("article");
        el.className = "tw-brief tw-brief--custom";
        const tag = document.createElement("span");
        tag.className = "tw-brief-tag";
        tag.textContent = "Your briefing";
        const p = document.createElement("p");
        p.textContent = j.text;
        const time = document.createElement("time");
        time.textContent = "Composed " + briefTime();
        el.append(tag, p, time);
        root.prepend(el);
      }
    }
  } catch (e) {
    root.replaceChildren();
    const el = document.createElement("article");
    el.className = "tw-brief";
    el.innerHTML =
      '<span class="tw-brief-tag">Xendra AI</span><p>Could not load briefings. Run <code>npm run dev</code> (node server) and tap Refresh.</p>';
    root.appendChild(el);
  }
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";
}

async function loadTrending(force) {
  if (trendingLoaded && !force) return;
  const root = $("trending-list");
  if (!root) return;
  root.replaceChildren();
  root.innerHTML = '<p class="tw-page-sub" style="padding:0 20px">Loading…</p>';
  try {
    let m = lastMarket;
    if (!m?.ok || !(m.movers || []).length) {
      const r = await apiFetch("/api/market");
      m = await r.json();
      if (m.ok) lastMarket = m;
    }
    let markets = m.movers || [];
    if (!markets.length && (m.core || []).length) {
      markets = [...m.core].sort(function (a, b) {
        return Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0);
      });
    }
    if (!markets.length) throw new Error(m.error || "empty");
    root.replaceChildren();
    markets.forEach(function (mk) {
      const ch = mk.price_change_percentage_24h || 0;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "tw-asset";
      row.innerHTML =
        '<div class="tw-asset-icon">' +
        imgHtml(mk.image, "") +
        '</div><div class="tw-asset-meta"><strong>' +
        mk.name +
        "</strong><span>" +
        mk.symbol.toUpperCase() +
        '</span></div><div class="tw-asset-val"><strong>' +
        fmtUsd(mk.current_price) +
        '</strong><span class="' +
        (ch >= 0 ? "up" : "down") +
        '">' +
        fmtPct(ch) +
        "</span></div>";
      root.appendChild(row);
    });
    trendingLoaded = true;
  } catch (e) {
    root.innerHTML =
      '<p class="tw-page-sub" style="padding:0 20px">Trending unavailable · CoinGecko rate limit. Retry in a minute or set <code>COINGECKO_API_KEY</code>.</p>';
  }
}

function wireNav() {
  document.querySelectorAll("#main-nav [data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTab(btn.dataset.tab);
    });
  });
  document.querySelectorAll("[data-home-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setHomeTab(btn.dataset.homeTab);
    });
  });
  document.querySelectorAll(".tw-act[data-go]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const go = btn.dataset.go;
      if (go === "swap") setTab("swap");
      else if (go === "buy") openInAppBrowser("buy.moonpay.com");
      else if (go === "send") openSendSheet();
      else if (go === "receive") toast("Tap an asset to copy address");
    });
  });
  $("swap-form")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (lifiQuoteLoading) return;
    const amt = parseAmount($("swap-amount-in")?.value);
    if (!amt) {
      toast("Enter amount");
      return;
    }
    const from = swapAssetById($("swap-from").value);
    const to = swapAssetById($("swap-to").value);
    if (!from || !to || from.id === to.id) {
      toast("Pick two different tokens");
      return;
    }
    if (!lastMnemonic || !core) {
      toast("Wallet not ready");
      return;
    }
    const btn = $("swap-submit");
    if (btn) btn.disabled = true;
    try {
      if (!lifiQuote?.transactionRequest) {
        await refreshLifiQuote();
      }
      if (!lifiQuote?.transactionRequest) {
        toast("No LI.FI route — try another pair or amount");
        return;
      }
      toast("Sign in wallet…");
      const res = await executeLifiQuote(lifiQuote, { core, mnemonic: lastMnemonic });
      const short =
        res.kind === "evm"
          ? res.hash.slice(0, 10) + "…"
          : String(res.hash || "").slice(0, 8) + "…";
      toast("Swap sent · " + short);
      lifiQuote = null;
      await renderAddresses(lastMnemonic, { animate: false });
      refreshSwapUi();
    } catch (err) {
      toast(err.message || "Swap failed");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  $("briefings-refresh")?.addEventListener("click", function () {
    lastMarket = null;
    loadBriefings(false);
    toast("Briefings updated");
  });
  $("brief-compose")?.addEventListener("click", function () {
    loadBriefings(true);
    toast("Brief composed");
  });
}

async function switchWallet(mnemonic) {
  trendingLoaded = false;
  lifiQuote = null;
  await renderAddresses(mnemonic, { resetSearch: false, animate: true });
}

async function bootWalletApp() {
  syncWalletLabel();
  await renderAddresses(requireMnemonic(), { resetSearch: true, animate: true });
}

async function boot() {
  try {
    await loadPrices();
    core = await Module();
    CoinType = core.CoinType;
    loadWalletState();
    wireOnboarding({ core, onComplete: bootWalletApp });
    wireWalletHub({
      core,
      onWalletSwitch: switchWallet,
      onWalletRemoved: async function () {
        lockSession();
        trendingLoaded = false;
        lifiQuote = null;
        lastMnemonic = null;
        liveBalances = {};
        addressBook = {};
        $("app-chrome")?.setAttribute("hidden", "true");
        await startOnboarding({ core, onComplete: bootWalletApp });
      },
      onLock: async function () {
        $("app-chrome")?.setAttribute("hidden", "true");
        await startOnboarding({ core, onComplete: bootWalletApp });
      },
    });
    wireSendSheet({
      core,
      getMnemonic: function () {
        return lastMnemonic;
      },
      getBalances: function () {
        return liveBalances;
      },
      onSent: function () {
        return renderAddresses(lastMnemonic, { animate: false });
      },
    });
    await startOnboarding({ core, onComplete: bootWalletApp });
  } catch (e) {
    console.error(e);
    const st = $("wallet-state");
    if (st) st.textContent = String(e.message || e);
  }
}

$("asset-search")?.addEventListener("input", function () {
  if (lastMnemonic) renderAddresses(lastMnemonic, { animate: false });
});

wireBrowser();
wireNav();
initSwapForm();
setHomeTab("crypto");
boot();
