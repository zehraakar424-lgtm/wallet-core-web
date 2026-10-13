export const PW_KEY = "xendra_tw_app_pw_v1";
const UNLOCK_SESSION = "xendra_tw_unlocked_v1";

async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

export function hasAppPassword() {
  return !!localStorage.getItem(PW_KEY);
}

export async function setAppPassword(password) {
  const h = await hashPassword(password);
  localStorage.setItem(PW_KEY, h);
}

export async function verifyAppPassword(password) {
  const stored = localStorage.getItem(PW_KEY);
  if (!stored) return false;
  const h = await hashPassword(password);
  return h === stored;
}

export function isSessionUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_SESSION) === "1";
  } catch (e) {
    return false;
  }
}

export function setSessionUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_SESSION, "1");
  } catch (e) {}
}

export function lockSession() {
  try {
    sessionStorage.removeItem(UNLOCK_SESSION);
  } catch (e) {}
}
