import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const extRoot = process.env.XENDRA_EXT_DIR
  ? path.resolve(process.env.XENDRA_EXT_DIR)
  : path.resolve(rootDir, "../ext-git");

export default defineConfig(({ mode }) => ({
  plugins: [wasm(), topLevelAwait()],
  base: mode === "extension" ? "./" : "/",
  build: {
    outDir: mode === "extension" ? path.join(extRoot, "app") : "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: path.resolve(rootDir, "index.html"),
    },
  },
  resolve: {
    alias: {
      "xendra-wallet-core": path.resolve(rootDir, "public/vendor/wallet-core.js"),
    },
  },
  server: {
    port: 8790,
    strictPort: true,
  },
  optimizeDeps: {
    include: ["@trustwallet/wallet-core", "ethers", "@solana/web3.js"],
  },
}));
