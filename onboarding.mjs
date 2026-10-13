import {
  hasAppPassword,
  setAppPassword,
  verifyAppPassword,
  isSessionUnlocked,
  setSessionUnlocked,
} from "./auth.mjs";
import {
  loadWalletState,
  addWallet,
  validateMnemonic,
  normalizeMnemonic,
} from "./wallets.mjs";

const STEP_MS = 420;

function $(id) {
  return document.getElementById(id);
}

function hasWallet() {
  return loadWalletState().wallets.length > 0;
}

function wordCount(text) {
  const m = normalizeMnemonic(text);
  if (!m) return 0;
  return m.split(" ").filter(Boolean).length;
}

function replaySplashAnim() {
  const splash = document.querySelector('[data-ob-step="splash"]');
  if (!splash) return;
  splash.classList.remove("ob-splash-play");
  void splash.offsetWidth;
  splash.classList.add("ob-splash-play");
}

function replaySetupAnim() {
  document.querySelectorAll('[data-ob-step="setup"] .ob-anim-in').forEach(function (el) {
    el.classList.remove("ob-anim-run");
    void el.offsetWidth;
    el.classList.add("ob-anim-run");
  });
}

function showObStep(name, dir) {
  dir = dir || "forward";
  const from = document.querySelector("[data-ob-step].ob-step-visible");
  const to = document.querySelector('[data-ob-step="' + name + '"]');
  if (!to) return;
  if (from === to) return;

  function activateStep() {
    document.querySelectorAll("[data-ob-step]").forEach(function (el) {
      const on = el === to;
      el.hidden = !on;
      el.classList.toggle("ob-step-visible", on);
      el.style.pointerEvents = on ? "auto" : "none";
    });
    if (name === "splash") replaySplashAnim();
    if (name === "setup") replaySetupAnim();
  }

  if (!from) {
    activateStep();
    return;
  }

  const leaveClass = dir === "back" ? "ob-leave-back" : "ob-leave-forward";
  const enterClass = dir === "back" ? "ob-enter-back" : "ob-enter-forward";

  from.classList.add(leaveClass, "ob-step-leaving");
  from.style.pointerEvents = "none";
  to.hidden = false;
  to.classList.add("ob-step-visible", enterClass);
  to.style.pointerEvents = "auto";

  requestAnimationFrame(function () {
    from.classList.add("ob-leave-active");
    to.classList.add("ob-enter-active");
  });

  window.setTimeout(function () {
    from.hidden = true;
    from.style.pointerEvents = "";
    from.classList.remove(
      "ob-step-visible",
      "ob-step-leaving",
      leaveClass,
      "ob-leave-active",
      "ob-leave-forward",
      "ob-leave-back"
    );
    to.classList.remove(enterClass, "ob-enter-active");
    to.style.pointerEvents = "";
    document.querySelectorAll("[data-ob-step]").forEach(function (el) {
      if (el !== to) el.hidden = true;
    });
    if (name === "splash") replaySplashAnim();
    if (name === "setup") replaySetupAnim();
  }, STEP_MS);
}

function finish(onComplete) {
  setSessionUnlocked();
  $("onboarding")?.setAttribute("hidden", "true");
  $("app-chrome")?.removeAttribute("hidden");
  document.body.classList.remove("tw-onboarding");
  if (onComplete) return onComplete();
}

export function wireOnboarding(ctx) {
  const core = ctx.core;

  function goPassword(mode, dir) {
    const title = $("ob-pw-title");
    const sub = $("ob-pw-sub");
    const input = $("ob-password");
    if (mode === "unlock") {
      if (title) title.textContent = "Welcome back.";
      if (sub) sub.textContent = "Enter your password to continue.";
    } else {
      if (title) title.textContent = "Secure this device.";
      if (sub) sub.textContent = "Create a password to unlock your wallet.";
    }
    if (input) {
      input.value = "";
      input.dataset.mode = mode;
    }
    $("ob-password-back")?.toggleAttribute("hidden", mode === "unlock");
    showObStep("password", dir || "forward");
    window.setTimeout(function () {
      input?.focus();
    }, STEP_MS + 40);
  }

  $("ob-splash-continue")?.addEventListener("click", function () {
    showObStep("setup", "forward");
  });

  $("ob-setup-continue")?.addEventListener("click", function () {
    goPassword("create", "forward");
  });

  $("ob-setup-back")?.addEventListener("click", function () {
    showObStep("splash", "back");
  });

  $("ob-password-back")?.addEventListener("click", function () {
    if (hasWallet()) return;
    showObStep("setup", "back");
  });

  $("ob-password-continue")?.addEventListener("click", async function () {
    const input = $("ob-password");
    const pw = input?.value || "";
    if (pw.length < 4) {
      $("ob-password-err").textContent = "Use at least 4 characters.";
      return;
    }
    $("ob-password-err").textContent = "";
    const mode = input?.dataset.mode || "create";

    if (mode === "unlock") {
      if (!(await verifyAppPassword(pw))) {
        $("ob-password-err").textContent = "Wrong password. Try again.";
        return;
      }
      if (hasWallet()) finish(ctx.onComplete);
      else showObStep("import", "forward");
      return;
    }

    await setAppPassword(pw);
    if (hasWallet()) {
      finish(ctx.onComplete);
      return;
    }
    showObStep("import", "forward");
  });

  $("ob-import-back")?.addEventListener("click", function () {
    goPassword("create", "back");
  });

  $("ob-import-phrase")?.addEventListener("input", function () {
    const n = wordCount($("ob-import-phrase")?.value);
    const el = $("ob-word-count");
    if (el) el.textContent = n + (n === 1 ? " word" : " words");
  });

  $("ob-import-submit")?.addEventListener("click", function () {
    const phrase = $("ob-import-phrase")?.value || "";
    const n = wordCount(phrase);
    if (n !== 12 && n !== 24) {
      $("ob-import-err").textContent = "Enter exactly 12 or 24 words.";
      return;
    }
    if (!validateMnemonic(phrase, core)) {
      $("ob-import-err").textContent = "Invalid recovery phrase. Check the words.";
      return;
    }
    $("ob-import-err").textContent = "";
    addWallet({ name: "Main Wallet", mnemonic: phrase });
    finish(ctx.onComplete);
  });

  $("ob-password")?.addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("ob-password-continue")?.click();
  });
}

function goPasswordUnlockOnly() {
  const title = $("ob-pw-title");
  const sub = $("ob-pw-sub");
  if (title) title.textContent = "Welcome back.";
  if (sub) sub.textContent = "Enter your password to continue.";
  const input = $("ob-password");
  if (input) input.dataset.mode = "unlock";
  $("ob-password-back")?.setAttribute("hidden", "true");
  document.querySelectorAll("[data-ob-step]").forEach(function (el) {
    const on = el.dataset.obStep === "password";
    el.hidden = !on;
    el.classList.toggle("ob-step-visible", on);
  });
  requestAnimationFrame(function () {
    input?.focus();
  });
}

export async function startOnboarding(ctx) {
  if (isSessionUnlocked() && hasWallet()) {
    $("onboarding")?.setAttribute("hidden", "true");
    $("app-chrome")?.removeAttribute("hidden");
    return ctx.onComplete();
  }

  document.body.classList.add("tw-onboarding");
  $("app-chrome")?.setAttribute("hidden", "true");
  $("onboarding")?.removeAttribute("hidden");

  if (hasWallet() && hasAppPassword()) {
    goPasswordUnlockOnly();
    return;
  }

  if (hasWallet() && !hasAppPassword()) {
    showObStep("setup", "forward");
    return;
  }

  showObStep("splash", "forward");
}
