import { COINS } from "./chains.mjs";
import { sendableCoins, sendNativeTransfer } from "./send-transfer.mjs";

let ctx = { core: null, getMnemonic: null, getBalances: null, onSent: null };

function $(id) {
  return document.getElementById(id);
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.add("show");
  setTimeout(function () {
    el.hidden = true;
    el.classList.remove("show");
  }, 1800);
}

function selectedCoin() {
  const id = $("send-asset")?.value;
  return COINS.find(function (c) {
    return c.id === id;
  });
}

function refreshSendBal() {
  const coin = selectedCoin();
  const el = $("send-bal");
  if (!coin || !el) return;
  const bal = ctx.getBalances?.()[coin.id];
  el.textContent =
    "Balance: " + (bal != null ? bal.toLocaleString(undefined, { maximumFractionDigits: 8 }) + " " + coin.symbol : "—");
}

export function openSendSheet(opts) {
  opts = opts || {};
  const sheet = $("send-sheet");
  if (!sheet) return;
  const sel = $("send-asset");
  if (sel && !sel.options.length) {
    sendableCoins(COINS).forEach(function (c) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.title + " (" + c.symbol + ")";
      sel.appendChild(o);
    });
  }
  if (opts.coinId && sel) sel.value = opts.coinId;
  $("send-to").value = opts.to || "";
  $("send-amount").value = opts.amount || "";
  refreshSendBal();
  sheet.hidden = false;
  sheet.classList.remove("is-open");
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      sheet.classList.add("is-open");
    });
  });
  document.body.classList.add("tw-hub-open");
}

export function closeSendSheet() {
  const sheet = $("send-sheet");
  if (!sheet) return;
  sheet.classList.remove("is-open");
  document.body.classList.remove("tw-hub-open");
  setTimeout(function () {
    sheet.hidden = true;
  }, 520);
}

export function wireSendSheet(options) {
  ctx = options;

  $("send-sheet-backdrop")?.addEventListener("click", closeSendSheet);
  $("send-sheet-close")?.addEventListener("click", closeSendSheet);
  $("send-asset")?.addEventListener("change", refreshSendBal);
  $("send-max")?.addEventListener("click", function () {
    const coin = selectedCoin();
    if (!coin) return;
    const bal = ctx.getBalances?.()[coin.id] || 0;
    let max = bal;
    if (coin.rpc === "solana") max = Math.max(0, bal - 0.01);
    else if (coin.rpc) max = Math.max(0, bal - 0.001);
    $("send-amount").value = max ? String(max) : "";
  });

  $("send-form")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    const coin = selectedCoin();
    const mnemonic = ctx.getMnemonic?.();
    if (!coin || !mnemonic || !ctx.core) {
      toast("Wallet not ready");
      return;
    }
    const btn = $("send-submit");
    if (btn) btn.disabled = true;
    try {
      toast("Sending…");
      const res = await sendNativeTransfer({
        core: ctx.core,
        mnemonic,
        coin,
        to: $("send-to")?.value,
        amount: $("send-amount")?.value,
      });
      const short =
        res.kind === "evm" ? res.hash.slice(0, 12) + "…" : String(res.hash || "").slice(0, 10) + "…";
      toast("Sent · " + short);
      closeSendSheet();
      if (ctx.onSent) await ctx.onSent();
    } catch (err) {
      toast(err.message || "Send failed");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
