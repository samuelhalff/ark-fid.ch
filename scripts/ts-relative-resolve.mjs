// Node 22 test helper: lets `node --test` load TypeScript modules whose relative imports omit the
// ".ts" extension (as the Next.js bundler allows). Usage: node --import ./scripts/ts-relative-resolve.mjs --test …
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL?.startsWith("file:")) {
    for (const ext of [".ts", "/index.ts"]) {
      const url = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  return next(specifier, context);
}
`),
);
