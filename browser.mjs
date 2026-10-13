import { isExtensionContext } from "./api-client.mjs";

let providerState = { evm: null, sol: null };

export function setProviderAddresses(evmAddr, solAddr) {
  providerState.evm = evmAddr;
  providerState.sol = solAddr;
}

export function surfUrl(surfHost, path) {
  const host = surfHost.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  let p = path || "/";
  if (!p.startsWith("/")) p = "/" + p;
  return { host, url: window.location.origin + "/surf/" + host + p };
}

export function openInAppBrowser(surfHost, path) {
  const { host, url } = surfUrl(surfHost, path);
  if (isExtensionContext()) {
    const p = path && path.startsWith("/") ? path : path ? "/" + path : "/";
    window.open("https://" + host + p, "_blank", "noopener,noreferrer");
    return;
  }
  const shell = document.getElementById("dapp-browser");
  const frame = document.getElementById("browser-frame");
  const title = document.getElementById("browser-title");
  const status = document.getElementById("browser-status");
  if (!shell || !frame) {
    window.open("https://" + host + (path || "/"), "_blank", "noopener,noreferrer");
    return;
  }
  title.textContent = host;
  if (status) status.textContent = "Loading…";
  shell.hidden = false;
  document.body.classList.add("tw-browser-open");
  frame.src = url;
}

export function wireBrowser() {
  const shell = document.getElementById("dapp-browser");
  const frame = document.getElementById("browser-frame");
  const status = document.getElementById("browser-status");

  $("browser-close")?.addEventListener("click", function () {
    shell.hidden = true;
    frame.src = "about:blank";
    document.body.classList.remove("tw-browser-open");
  });
  $("browser-back")?.addEventListener("click", function () {
    try {
      frame.contentWindow.history.back();
    } catch (e) {}
  });
  $("browser-reload")?.addEventListener("click", function () {
    try {
      frame.contentWindow.location.reload();
    } catch (e) {
      frame.src = frame.src;
    }
  });
  $("browser-open-ext")?.addEventListener("click", function () {
    const src = frame.src;
    if (!src || src === "about:blank") return;
    try {
      const u = new URL(src);
      const m = u.pathname.match(/^\/surf\/([^/]+)/);
      const host = m ? m[1] : u.hostname.replace(/\.localhost$/, "");
      window.open("https://" + host + u.pathname.replace(/^\/surf\/[^/]+/, "") + u.search, "_blank", "noopener,noreferrer");
    } catch (e) {}
  });

  frame?.addEventListener("load", function () {
    if (status) status.textContent = frame.src === "about:blank" ? "" : "Ready";
  });

  window.addEventListener("message", async function (ev) {
    const d = ev.data;
    if (!d || d.source !== "xendra-dapp" || !d.id) return;
    const reply = function (result, error) {
      if (!frame.contentWindow) return;
      frame.contentWindow.postMessage(
        { source: "xendra-parent", id: d.id, result, error: error ? { message: error } : null },
        "*"
      );
    };
    try {
      if (d.chain === "evm") {
        if (d.method === "eth_requestAccounts" || d.method === "eth_accounts") {
          reply(providerState.evm ? [providerState.evm] : []);
          return;
        }
        if (d.method === "eth_chainId") {
          reply("0x1");
          return;
        }
        reply(null, "Method not supported in preview: " + d.method);
        return;
      }
      if (d.chain === "solana") {
        if (d.method === "connect") {
          if (!providerState.sol) reply(null, "No Solana address");
          else reply(providerState.sol);
          return;
        }
        reply(null, "Solana method not supported yet: " + d.method);
        return;
      }
      reply(null, "Unknown chain");
    } catch (e) {
      reply(null, String(e.message || e));
    }
  });
}

function $(id) {
  return document.getElementById(id);
}
