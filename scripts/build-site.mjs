import { cp, mkdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SITE = join(ROOT, "site");

async function requirePath(path, hint) {
  try {
    await stat(path);
  } catch {
    throw new Error(`${path} is missing. ${hint}`);
  }
}

await requirePath(
  join(ROOT, "dist", "demo", "report.html"),
  "Run npm run demo first.",
);
await requirePath(
  join(ROOT, "dist", "complete", "report.html"),
  "Run npm run demo:complete first.",
);
await rm(SITE, { recursive: true, force: true });
await mkdir(SITE, { recursive: true });
await cp(join(ROOT, "docs"), SITE, { recursive: true });
await mkdir(join(SITE, "demo"), { recursive: true });
await mkdir(join(SITE, "complete"), { recursive: true });
await cp(join(ROOT, "dist", "demo"), join(SITE, "demo"), { recursive: true });
await cp(join(ROOT, "dist", "complete"), join(SITE, "complete"), {
  recursive: true,
});
process.stdout.write(`Static site assembled at ${SITE}\n`);
