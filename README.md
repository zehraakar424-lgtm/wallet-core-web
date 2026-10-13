# Xendra Wallet (web app)

Multi-chain wallet UI on [Trust Wallet Core](https://github.com/trustwallet/wallet-core) WASM.

## Run locally

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:8790** — `server.mjs` serves the UI and `/api/*` (RPC, LI.FI, market, surf browser).

Production static build:

```bash
npm run build
npm run preview
```

## Chrome extension (separate repository)

The extension ships from [zehraakar424-lgtm/extension](https://github.com/zehraakar424-lgtm/extension). Build the UI bundle into that repo:

```bash
npm run dev          # local API for the extension
npm run build:ext    # default output: ../ext-git/app (override with XENDRA_EXT_DIR)
```

Production API URL for the extension:

```js
chrome.storage.sync.set({ apiBase: "https://your-wallet-host" });
```

## Security notes

- Recovery phrases are stored in **localStorage** (dev / extension prototype — not hardware-grade).
- Use **Lock wallet** in settings to require the device password again.
