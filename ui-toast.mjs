let toastTimer = null;

export function showToast(msg, ms) {
  ms = ms || 1600;
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    el.hidden = true;
    el.classList.remove("show");
  }, ms);
}
