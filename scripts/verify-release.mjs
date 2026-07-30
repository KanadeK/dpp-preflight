import { gunzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { verifyBundle } from "../src/package.js";
import { sha256 } from "../src/util.js";

const ROOT = resolve(import.meta.dirname, "..");
const RELEASE = join(ROOT, "release");
const names = await readdir(RELEASE);
const packageName = names.find((name) => /^dpp-preflight-.*\.tgz$/.test(name));
const expected = [
  "northstar-complete-bundle.zip",
  "northstar-gaps-bundle.zip",
  "RELEASE_SHA256SUMS",
];
if (!packageName) throw new Error("Release directory lacks the npm package archive");
for (const name of expected) {
  if (!names.includes(name)) throw new Error(`Release directory lacks ${name}`);
}

const receiptLines = (await readFile(join(RELEASE, "RELEASE_SHA256SUMS"), "utf8"))
  .trim()
  .split("\n");
for (const line of receiptLines) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
  if (!match) throw new Error(`Malformed release checksum line: ${line}`);
  const actual = sha256(await readFile(join(RELEASE, match[2])));
  if (actual !== match[1]) throw new Error(`Release checksum mismatch: ${match[2]}`);
}

await verifyBundle(join(RELEASE, "northstar-complete-bundle.zip"));
await verifyBundle(join(RELEASE, "northstar-gaps-bundle.zip"));

const tar = gunzipSync(await readFile(join(RELEASE, packageName)));
const members = [];
for (let offset = 0; offset + 512 <= tar.length; ) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every((byte) => byte === 0)) break;
  const name = header
    .subarray(0, 100)
    .toString("utf8")
    .replace(/\0.*$/, "");
  const sizeText = header
    .subarray(124, 136)
    .toString("ascii")
    .replace(/\0.*$/, "")
    .trim();
  const size = Number.parseInt(sizeText || "0", 8);
  members.push(name);
  offset += 512 + Math.ceil(size / 512) * 512;
}
for (const required of [
  "package/src/cli.js",
  "package/rules/espr-core-2026-07.json",
  "package/templates/starter/product.json",
  "package/LICENSE",
]) {
  if (!members.includes(required)) throw new Error(`${basename(packageName)} lacks ${required}`);
}

process.stdout.write(
  `Verified ${receiptLines.length} release hashes, 2 bundles, and ${members.length} package members.\n`,
);
