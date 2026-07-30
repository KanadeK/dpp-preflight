import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { analyzeProject, verifyBundle } from "../src/package.js";

const ROOT = resolve(import.meta.dirname, "..");
const RULES = join(ROOT, "rules", "espr-core-2026-07.json");
const AS_OF = "2026-07-30T00:00:00.000Z";

test("analysis emits a deterministic, self-verifying complete bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "dpp-package-"));
  const first = join(root, "first");
  const second = join(root, "second");
  const input = join(ROOT, "examples", "northstar-complete");
  const options = { inputDir: input, rulePackPath: RULES, asOf: AS_OF };
  const left = await analyzeProject({ ...options, outputDir: first });
  const right = await analyzeProject({ ...options, outputDir: second });

  assert.equal(left.ready, true);
  assert.equal(left.score, 100);
  assert.deepEqual(
    await readFile(left.archivePath),
    await readFile(right.archivePath),
  );
  assert.equal((await verifyBundle(left.archivePath)).valid, true);
  assert.equal((await verifyBundle(first)).valid, true);
  assert.match(await readFile(join(first, "report.html"), "utf8"), /Northstar Task Lamp/);
  assert.match(await readFile(join(first, "passport-draft.jsonld"), "utf8"), /readiness-draft-not-for-registry-submission/);
});

test("gap analysis produces owner requests and can omit the ZIP", async () => {
  const root = await mkdtemp(join(tmpdir(), "dpp-gaps-"));
  const result = await analyzeProject({
    inputDir: join(ROOT, "examples", "northstar-gaps"),
    outputDir: join(root, "bundle"),
    rulePackPath: RULES,
    asOf: AS_OF,
    createZip: false,
  });
  assert.equal(result.ready, false);
  assert.equal(result.archivePath, null);
  assert.equal(result.requests, 11);
  assert.match(
    await readFile(join(result.outputDir, "supplier-requests.csv"), "utf8"),
    /SUP-UNKNOWN/,
  );
  assert.equal((await verifyBundle(result.outputDir)).valid, true);
});

test("analysis protects inputs and requires force for a named output", async () => {
  const root = await mkdtemp(join(tmpdir(), "dpp-safety-"));
  const input = join(ROOT, "examples", "northstar-complete");
  const output = join(root, "bundle");
  const options = {
    inputDir: input,
    outputDir: output,
    rulePackPath: RULES,
    asOf: AS_OF,
  };
  await analyzeProject(options);
  await assert.rejects(analyzeProject(options), (error) => error.code === "OUTPUT_EXISTS");
  const replaced = await analyzeProject({ ...options, force: true });
  assert.equal(replaced.ready, true);
  await assert.rejects(
    analyzeProject({ ...options, outputDir: input }),
    /unsafe output directory/,
  );
});

test("verification detects changed bytes, checksums, and malformed manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "dpp-verify-"));
  const output = join(root, "bundle");
  await analyzeProject({
    inputDir: join(ROOT, "examples", "northstar-complete"),
    outputDir: output,
    rulePackPath: RULES,
    asOf: AS_OF,
  });

  await writeFile(join(output, "report.json"), "{}\n");
  await assert.rejects(verifyBundle(output), (error) => {
    assert.equal(error.code, "VERIFY_FAILED");
    assert.ok(error.details.some((item) => item.includes("report.json")));
    return true;
  });

  await analyzeProject({
    inputDir: join(ROOT, "examples", "northstar-complete"),
    outputDir: output,
    rulePackPath: RULES,
    asOf: AS_OF,
    force: true,
  });
  await writeFile(join(output, "SHA256SUMS"), "wrong\n");
  await assert.rejects(verifyBundle(output), /verification failed/);

  await writeFile(join(output, "manifest.json"), "{broken");
  await assert.rejects(verifyBundle(output), /not valid JSON/);

  await rm(output, { recursive: true });
  await assert.rejects(verifyBundle(output), /Cannot read bundle target/);
});

test("verification rejects unsupported manifests and a ZIP missing receipts", async () => {
  const root = await mkdtemp(join(tmpdir(), "dpp-bad-bundle-"));
  await writeFile(
    join(root, "manifest.json"),
    JSON.stringify({ schemaVersion: "other", files: [] }),
  );
  await writeFile(join(root, "SHA256SUMS"), "");
  await assert.rejects(verifyBundle(root), /Unsupported or malformed/);

  const { createDeterministicZip } = await import("../src/zip.js");
  const zip = createDeterministicZip([{ name: "readme.txt", bytes: "x" }], {
    timestamp: AS_OF,
  });
  const zipPath = join(root, "missing.zip");
  await writeFile(zipPath, zip);
  await assert.rejects(verifyBundle(zipPath), /lacks manifest/);
});
