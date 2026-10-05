import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Generate from the locked PDF.js dependency at install time. Vite serves public
// in development and copies it into dist for Vercel; no external asset CDN.
const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const destination = fileURLToPath(new URL("../public/pdfjs-assets/", import.meta.url));
mkdirSync(destination, { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  cpSync(join(source, directory), join(destination, directory), { recursive: true });
}
console.log("Prepared PDF.js character maps, fonts, and image decoders.");
