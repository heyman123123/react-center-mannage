// scripts/build.mjs
// Plain ESM bundler — no dependencies, just copies source files into ./dist
// preserving the layout expected by manifest.json.

import { promises as fs } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "src");
const dist = resolve(root, "dist");

async function copy(from, to) {
  await fs.mkdir(dirname(to), { recursive: true });
  await fs.copyFile(from, to);
  console.log("copied", relative(root, from), "→", relative(root, to));
}

async function main() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });

  // manifest + assets stay at the root.
  await copy(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
  // assets are optional at build time — copy if present.
  try {
    await fs.mkdir(resolve(dist, "assets"), { recursive: true });
    for (const name of ["icon-16.png", "icon-32.png", "icon-48.png", "icon-128.png"]) {
      await copy(resolve(root, "assets", name), resolve(dist, "assets", name));
    }
  } catch (err) {
    console.warn("assets copy skipped:", err.message);
  }

  // src tree mirrors into dist.
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = resolve(src, entry.name);
    const to = resolve(dist, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await copy(from, to);
    }
  }

  // Content scripts cannot use ES modules. Bundle flow + runner into one classic script.
  const flow = await fs.readFile(resolve(src, "lib/flow.js"), "utf8");
  const runner = await fs.readFile(resolve(src, "content/runner.js"), "utf8");
  const classicFlow = flow.replace(/^export /gm, "");
  const classicRunner = runner.replace(/^import .*;\s*$/gm, "");
  const bundled = `// bundled content script (classic, no import)\n${classicFlow}\n${classicRunner}\n`;
  await fs.writeFile(resolve(dist, "content/runner.js"), bundled);
  console.log("bundled content/runner.js (classic script)");
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = resolve(from, entry.name);
    const dstPath = resolve(to, entry.name);
    if (entry.isDirectory()) await copyDir(srcPath, dstPath);
    else await copy(srcPath, dstPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});