import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extRoot = process.env.XENDRA_EXT_DIR
  ? path.resolve(process.env.XENDRA_EXT_DIR)
  : path.resolve(root, "../ext-git");
const appDir = path.join(extRoot, "app");
const logoSrc = path.join(root, "public/xendra-logo.png");
const logoDst = path.join(extRoot, "icons/icon128.png");

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

if (!fs.existsSync(appDir)) {
  console.error("Missing extension app build at", appDir);
  process.exit(1);
}

copyFile(logoSrc, logoDst);
copyFile(logoSrc, path.join(extRoot, "icons/icon48.png"));
copyFile(logoSrc, path.join(extRoot, "icons/icon16.png"));

console.log("Extension bundle ready:", extRoot);
