/** @returns {boolean} */
export function isExtensionContext() {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

function apiBase() {
  const b = globalThis.__XENDRA_API_BASE__;
  if (b && typeof b === "string") return b.replace(/\/$/, "");
  return "";
}

function extensionApiFetch(path, init) {
  return new Promise(function (resolve, reject) {
    const headers = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach(function (v, k) {
          headers[k] = v;
        });
      } else {
        Object.assign(headers, init.headers);
      }
    }
    let body = init?.body;
    if (body != null && typeof body !== "string") body = JSON.stringify(body);

    chrome.runtime.sendMessage(
      {
        type: "xendra-api",
        path: path,
        method: init?.method || "GET",
        headers: headers,
        body: body || null,
      },
      function (resp) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Extension API bridge failed"));
          return;
        }
        if (!resp) {
          reject(new Error("No response from extension background"));
          return;
        }
        if (!resp.ok) {
          reject(new Error(resp.error || "API error " + resp.status));
          return;
        }
        resolve(
          new Response(resp.body, {
            status: resp.status || 200,
            headers: { "Content-Type": resp.contentType || "application/json" },
          })
        );
      }
    );
  });
}

/**
 * @param {string} path e.g. "/api/market"
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init) {
  const p = path.startsWith("/") ? path : "/" + path;
  if (isExtensionContext()) return extensionApiFetch(p, init);
  const base = apiBase();
  return fetch(base + p, init);
}

export async function apiJson(path, init) {
  const r = await apiFetch(path, init);
  const j = await r.json();
  return j;
}
