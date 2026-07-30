import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { analyzeProject } from "../src/package.js";
import { sha256 } from "../src/util.js";

const ROOT = resolve(import.meta.dirname, "..");
const RELEASE = join(ROOT, "release");
const RULES = join(ROOT, "rules", "espr-core-2026-07.json");
const AS_OF = "2026-07-30T00:00:00.000Z";
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error("npm_execpath is unavailable. Run this script through npm run package:release.");
}

await rm(RELEASE, { recursive: true, force: true });
await mkdir(RELEASE, { recursive: true });

for (const [fixture, name] of [
  ["northstar-complete", "northstar-complete-bundle.zip"],
  ["northstar-gaps", "northstar-gaps-bundle.zip"],
]) {
  const output = join(ROOT, "dist", `release-${fixture}`);
  const result = await analyzeProject({
    inputDir: join(ROOT, "examples", fixture),
    outputDir: output,
    rulePackPath: RULES,
    asOf: AS_OF,
    force: true,
  });
  await copyFile(result.archivePath, join(RELEASE, name));
}

const packed = spawnSync(
  process.execPath,
  [npmCli, "pack", "--json", "--pack-destination", RELEASE],
  {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: join(ROOT, ".npm-cache"),
    },
  },
);
if (packed.status !== 0) {
  throw new Error(`npm pack failed:\n${packed.stderr || packed.stdout}`);
}

const artifactNames = (await readdir(RELEASE))
  .filter((name) => name !== "RELEASE_SHA256SUMS")
  .sort((left, right) => left.localeCompare(right));
const receipts = [];
for (const name of artifactNames) {
  receipts.push(`${sha256(await readFile(join(RELEASE, name)))}  ${name}`);
}
await writeFile(
  join(RELEASE, "RELEASE_SHA256SUMS"),
  `${receipts.join("\n")}\n`,
);
process.stdout.write(`Created ${artifactNames.length} release artifacts in ${RELEASE}\n`);
