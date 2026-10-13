const STORAGE = "xendra_tw_mnemonic";

const COINS = [
  { id: "solana", label: "Solana", symbol: "SOL", icon: "https://icons.llamao.fi/icons/chains/rsz_solana.jpg" },
  { id: "ethereum", label: "Ethereum", symbol: "ETH", icon: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg" },
  { id: "bitcoin", label: "Bitcoin", symbol: "BTC", icon: "https://icons.llamao.fi/icons/chains/rsz_bitcoin.jpg" },
  { id: "base", label: "Base", symbol: "ETH", icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg" },
  { id: "arbitrum", label: "Arbitrum", symbol: "ETH", icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg" },
  { id: "polygon", label: "Polygon", symbol: "POL", icon: "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg" },
  { id: "binance", label: "BNB Chain", symbol: "BNB", icon: "https://icons.llamao.fi/icons/chains/rsz_binance.jpg" },
  { id: "cosmos", label: "Cosmos", symbol: "ATOM", icon: "https://icons.llamao.fi/icons/chains/rsz_cosmos.jpg" },
];

const $ = (id) => document.getElementById(id);
let core = null;
let CoinType = null;

function setStatus(text, ready) {
  const el = $("core-status");
  el.textContent = text;
  el.classList.toggle("ready", !!ready);
}

function ensureWallet() {
  let mnemonic = localStorage.getItem(STORAGE);
  if (!mnemonic) {
    const w = core.HDWallet.create(128, "");
    mnemonic = w.mnemonic();
    w.delete();
    localStorage.setItem(STORAGE, mnemonic);
  }
  return mnemonic;
}

function addressFor(wallet, coinName) {
  const ct = CoinType[coinName];
  if (!ct) return "—";
  return wallet.getAddressForCoin(ct);
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function renderAddresses(mnemonic) {
  const root = $("addrs");
  root.replaceChildren();
  if (!core || !mnemonic) return;

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, "");
  $("wallet-state").textContent = "Trust Wallet Core · keys on device only";
  $("balance").textContent = COINS.length + " chains";
  $("change").textContent = "Ready";

  COINS.forEach(({ id, label, icon }) => {
    let addr = "—";
    try {
      addr = addressFor(wallet, id);
    } catch (e) {
      addr = "—";
    }

    const row = document.createElement("div");
    row.className = "xn-token-row";
    row.innerHTML =
      '<div class="xn-token-icon"><img src="' +
      icon +
      '" alt="" loading="lazy" /></div>' +
      '<div class="xn-token-meta"><strong>' +
      label +
      "</strong><span>" +
      addr +
      "</span></div>" +
      '<div class="xn-token-val"><button type="button">Copy</button></div>';
    row.querySelector("button").addEventListener("click", () => copyText(addr));
    root.appendChild(row);
  });

  wallet.delete();
}

async function boot() {
  try {
    let Loader = (await import("./src/vendor/wallet-core.js")).default;
    if (Loader && Loader.default) Loader = Loader.default;
    if (typeof Loader !== "function") throw new Error("wallet-core loader missing");
    core = await Loader({ locateFile: () => "/wallet-core.wasm" });
    CoinType = core.CoinType;
    setStatus("Online", true);
    renderAddresses(ensureWallet());
  } catch (e) {
    console.error(e);
    setStatus("Offline");
    $("wallet-state").textContent = String(e.message || e);
  }
}

$("btn-lock").addEventListener("click", () => {
  localStorage.removeItem(STORAGE);
  const label = document.querySelector(".xn-pill-label");
  label.textContent = "Reset…";
  setTimeout(() => {
    renderAddresses(ensureWallet());
    label.textContent = "Active";
  }, 120);
});

boot();
