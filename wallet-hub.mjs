import {
  loadWalletState,
  getActiveWallet,
  setActiveWallet,
  addWallet,
  renameWallet,
  removeWallet,
  validateMnemonic,
  normalizeMnemonic,
} from "./wallets.mjs";
import { showToast } from "./ui-toast.mjs";
import { lockSession } from "./auth.mjs";

let hubCore = null;
let onSwitch = null;
let onWalletRemoved = null;
let hubView = "main";
let settingsWalletId = null;

function $(id) {
  return document.getElementById(id);
}

function shortWords(mnemonic, n) {
  const parts = normalizeMnemonic(mnemonic).split(" ");
  if (parts.length <= n) return parts.join(" ");
  return parts.slice(0, 3).join(" ") + " … " + parts.slice(-2).join(" ");
}

function setHubView(view) {
  hubView = view;
  $("wallet-hub-main")?.toggleAttribute("hidden", view !== "main");
  $("wallet-hub-backup")?.toggleAttribute("hidden", view !== "backup");
  $("wallet-hub-import")?.toggleAttribute("hidden", view !== "import");
  $("wallet-hub-rename")?.toggleAttribute("hidden", view !== "rename");
  $("wallet-hub-remove")?.toggleAttribute("hidden", view !== "remove");
  const titles = {
    main: "Wallets",
    backup: "Secret recovery phrase",
    import: "Import wallet",
    rename: "Rename wallet",
    remove: "Remove wallet",
  };
  const t = $("wallet-hub-title");
  if (t) t.textContent = titles[view] || "Wallets";
  const back = $("wallet-hub-back");
  if (back) back.hidden = view === "main";
}

export function openWalletHub() {
  renderWalletList();
  setHubView("main");
  settingsWalletId = getActiveWallet()?.id || null;
  const hub = $("wallet-hub");
  if (!hub) return;
  hub.hidden = false;
  hub.classList.remove("is-open");
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      hub.classList.add("is-open");
    });
  });
  document.body.classList.add("tw-hub-open");
}

export function closeWalletHub() {
  const hub = $("wallet-hub");
  if (!hub) return;
  hub.classList.remove("is-open");
  document.body.classList.remove("tw-hub-open");
  const done = function () {
    hub.hidden = true;
    setHubView("main");
  };
  const panel = hub.querySelector(".tw-wallet-hub-panel");
  let closed = false;
  const finish = function () {
    if (closed) return;
    closed = true;
    done();
  };
  if (panel) {
    panel.addEventListener("transitionend", function onEnd(e) {
      if (e.propertyName !== "transform") return;
      panel.removeEventListener("transitionend", onEnd);
      finish();
    });
  }
  setTimeout(finish, 560);
}

function renderWalletList() {
  const root = $("wallet-list");
  if (!root) return;
  const state = loadWalletState();
  root.replaceChildren();
  state.wallets.forEach(function (w) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tw-wallet-row" + (w.id === state.activeId ? " is-active" : "");
    btn.innerHTML =
      '<span class="tw-wallet-row-ico" aria-hidden="true">◆</span>' +
      '<span class="tw-wallet-row-meta"><strong>' +
      w.name +
      "</strong><span>" +
      shortWords(w.mnemonic, 4) +
      '</span></span><span class="tw-wallet-row-check">' +
      (w.id === state.activeId ? "✓" : "") +
      "</span>";
    btn.addEventListener("click", async function () {
      if (w.id === state.activeId) return;
      setActiveWallet(w.id);
      syncWalletLabel();
      renderWalletList();
      if (onSwitch) await onSwitch(w.mnemonic);
    });
    root.appendChild(btn);
  });
}

function openWalletSettings(id) {
  settingsWalletId = id;
  const w = loadWalletState().wallets.find((x) => x.id === id);
  if (!w) return;
  $("wallet-backup-phrase")?.replaceChildren();
  $("wallet-backup-phrase")?.setAttribute("hidden", "");
  $("wallet-backup-reveal")?.removeAttribute("hidden");
  $("wallet-backup-confirm")?.removeAttribute("hidden");
  const chk = $("wallet-backup-risk");
  if (chk) chk.checked = false;
  setHubView("backup");
}

export function syncWalletLabel() {
  const w = getActiveWallet();
  document.querySelectorAll(".tw-wallet-name").forEach(function (el) {
    el.textContent = w?.name || "Wallet";
  });
}

export function wireWalletHub({ core, onWalletSwitch, onWalletRemoved: onRemoved, onLock }) {
  hubCore = core;
  onSwitch = onWalletSwitch;
  onWalletRemoved = onRemoved;
  syncWalletLabel();

  $("wallet-picker-btn")?.addEventListener("click", openWalletHub);
  $("wallet-hub-backdrop")?.addEventListener("click", closeWalletHub);
  $("wallet-hub-close")?.addEventListener("click", closeWalletHub);
  $("wallet-hub-back")?.addEventListener("click", function () {
    setHubView("main");
  });

  $("wallet-action-import")?.addEventListener("click", function () {
    $("wallet-import-name").value = "Imported wallet";
    $("wallet-import-phrase").value = "";
    setHubView("import");
  });

  $("wallet-import-submit")?.addEventListener("click", async function () {
    const phrase = $("wallet-import-phrase")?.value || "";
    const name = $("wallet-import-name")?.value || "Imported wallet";
    if (!validateMnemonic(phrase, hubCore)) {
      toast("Invalid recovery phrase");
      return;
    }
    addWallet({ name, mnemonic: phrase });
    syncWalletLabel();
    closeWalletHub();
    toast("Wallet imported");
    if (onSwitch) await onSwitch(normalizeMnemonic(phrase));
  });

  $("wallet-backup-reveal")?.addEventListener("click", function () {
    if (!$("wallet-backup-risk")?.checked) {
      toast("Confirm you understand the risks");
      return;
    }
    const w = loadWalletState().wallets.find((x) => x.id === settingsWalletId);
    if (!w) return;
    const box = $("wallet-backup-phrase");
    if (!box) return;
    box.removeAttribute("hidden");
    box.textContent = w.mnemonic;
    $("wallet-backup-reveal")?.setAttribute("hidden", "");
  });

  $("wallet-backup-copy")?.addEventListener("click", function () {
    const w = loadWalletState().wallets.find((x) => x.id === settingsWalletId);
    if (!w) return;
    navigator.clipboard.writeText(w.mnemonic).then(
      function () {
        toast("Phrase copied");
      },
      function () {
        toast("Copy failed");
      }
    );
  });

  $("wallet-action-rename")?.addEventListener("click", function () {
    const w = getActiveWallet();
    if (!w) return;
    settingsWalletId = w.id;
    $("wallet-rename-input").value = w.name;
    setHubView("rename");
  });

  $("wallet-rename-save")?.addEventListener("click", function () {
    const name = $("wallet-rename-input")?.value?.trim();
    if (!settingsWalletId || !name) {
      toast("Enter a name");
      return;
    }
    renameWallet(settingsWalletId, name);
    syncWalletLabel();
    renderWalletList();
    toast("Renamed");
    setHubView("main");
  });

  $("wallet-action-backup")?.addEventListener("click", function () {
    settingsWalletId = getActiveWallet()?.id;
    if (settingsWalletId) openWalletSettings(settingsWalletId);
  });

  $("wallet-action-lock")?.addEventListener("click", async function () {
    lockSession();
    closeWalletHub();
    showToast("Wallet locked");
    if (onLock) await onLock();
  });

  $("wallet-action-remove")?.addEventListener("click", function () {
    settingsWalletId = getActiveWallet()?.id;
    if (!settingsWalletId) {
      toast("No active wallet");
      return;
    }
    setHubView("remove");
  });

  $("wallet-remove-cancel")?.addEventListener("click", function () {
    setHubView("main");
  });

  $("wallet-remove-confirm")?.addEventListener("click", async function () {
    const id = settingsWalletId || getActiveWallet()?.id;
    if (!id) return;
    const state = removeWallet(id);
    if (!state.wallets.length) {
      closeWalletHub();
      toast("Wallet removed from device");
      if (onWalletRemoved) await onWalletRemoved();
      return;
    }
    const next = state.wallets.find((w) => w.id === state.activeId);
    syncWalletLabel();
    renderWalletList();
    closeWalletHub();
    toast("Wallet removed");
    if (next && onSwitch) await onSwitch(next.mnemonic);
  });
}

function toast(msg) {
  showToast(msg);
}
