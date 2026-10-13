export const LEGACY_STORAGE = "xendra_tw_mnemonic";
export const WALLETS_KEY = "xendra_tw_wallets_v1";
export const ACTIVE_KEY = "xendra_tw_active_v1";

function uid() {
  return "w_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function migrateLegacyWallets() {
  const legacy = localStorage.getItem(LEGACY_STORAGE);
  const existing = readJson(WALLETS_KEY, null);
  if (existing?.wallets?.length) return existing;
  if (!legacy) return { wallets: [], activeId: null };
  const id = uid();
  const state = {
    wallets: [{ id, name: "Main Wallet", mnemonic: legacy, createdAt: Date.now() }],
    activeId: id,
  };
  writeJson(WALLETS_KEY, state);
  localStorage.removeItem(LEGACY_STORAGE);
  return state;
}

export function loadWalletState() {
  const state = migrateLegacyWallets();
  if (!state.wallets.length) return { wallets: [], activeId: null };
  if (!state.activeId || !state.wallets.find((w) => w.id === state.activeId)) {
    state.activeId = state.wallets[0].id;
    saveWalletState(state);
  }
  return state;
}

export function saveWalletState(state) {
  writeJson(WALLETS_KEY, state);
}

export function getActiveWallet(state) {
  state = state || loadWalletState();
  return state.wallets.find((w) => w.id === state.activeId) || null;
}

export function getActiveMnemonic() {
  const w = getActiveWallet();
  return w?.mnemonic || null;
}

export function setActiveWallet(id) {
  const state = loadWalletState();
  if (!state.wallets.some((w) => w.id === id)) throw new Error("Wallet not found");
  state.activeId = id;
  saveWalletState(state);
  return getActiveWallet(state);
}

export function createMnemonic(core) {
  const w = core.HDWallet.create(128, "");
  const mnemonic = w.mnemonic();
  w.delete();
  return mnemonic;
}

export function normalizeMnemonic(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function validateMnemonic(mnemonic, core) {
  const m = normalizeMnemonic(mnemonic);
  if (!m || m.split(" ").length < 12) return false;
  try {
    const w = core.HDWallet.createWithMnemonic(m, "");
    w.delete();
    return true;
  } catch (e) {
    return false;
  }
}

export function addWallet({ name, mnemonic }) {
  const state = loadWalletState();
  const m = normalizeMnemonic(mnemonic);
  const id = uid();
  state.wallets.push({
    id,
    name: (name || "Wallet " + (state.wallets.length + 1)).trim(),
    mnemonic: m,
    createdAt: Date.now(),
  });
  state.activeId = id;
  saveWalletState(state);
  return getActiveWallet(state);
}

export function renameWallet(id, name) {
  const state = loadWalletState();
  const w = state.wallets.find((x) => x.id === id);
  if (!w) throw new Error("Wallet not found");
  w.name = String(name || w.name).trim() || w.name;
  saveWalletState(state);
  return w;
}

export function removeWallet(id) {
  const state = loadWalletState();
  if (!state.wallets.some((w) => w.id === id)) throw new Error("Wallet not found");
  if (state.wallets.length <= 1) {
    const empty = { wallets: [], activeId: null };
    saveWalletState(empty);
    return empty;
  }
  state.wallets = state.wallets.filter((w) => w.id !== id);
  if (state.activeId === id) state.activeId = state.wallets[0]?.id || null;
  saveWalletState(state);
  return state;
}
