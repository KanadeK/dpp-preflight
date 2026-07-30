import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectEvidence } from "../src/evidence.js";
import { loadDataset, safeDatasetPath } from "../src/model.js";
import { buildSupplierRequests } from "../src/requests.js";
import { evaluateRules, explainRule, findingOwners } from "../src/rules.js";
import { readJson } from "../src/util.js";

const ROOT = resolve(import.meta.dirname, "..");
const RULES = join(ROOT, "rules", "espr-core-2026-07.json");

test("complete fixture loads, inspects, and passes every rule", async () => {
  const dataset = await loadDataset(join(ROOT, "examples", "northstar-complete"));
  const evidence = await inspectEvidence(dataset, "2026-07-30T00:00:00.000Z");
  const rulePack = await readJson(RULES);
  const result = evaluateRules(dataset, evidence, rulePack);
  assert.equal(dataset.components.length, 4);
  assert.equal(evidence.every((record) => record.exists), true);
  assert.equal(result.ready, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.counts, { pass: 23, fail: 0, warn: 0, skipped: 0 });
  assert.deepEqual(buildSupplierRequests(dataset, result), []);
  assert.equal(explainRule(rulePack, "evd-002").id, "EVD-002");
  assert.equal(explainRule(rulePack, "unknown"), undefined);
});

test("gap fixture links failures to suppliers and internal owners", async () => {
  const dataset = await loadDataset(join(ROOT, "examples", "northstar-gaps"));
  const evidence = await inspectEvidence(dataset, "2026-07-30T00:00:00.000Z");
  const rulePack = await readJson(RULES);
  const result = evaluateRules(dataset, evidence, rulePack);
  const requests = buildSupplierRequests(dataset, result);
  assert.equal(result.ready, false);
  assert.equal(result.score, 55.5);
  assert.ok(result.blockingRuleIds.includes("EVD-002"));
  assert.ok(requests.some((row) => row.supplier_id === "SUP-UNKNOWN"));
  assert.ok(
    requests.some(
      (row) =>
        row.supplier_id === "SUP-UNKNOWN" &&
        row.supplier_name === "Unresolved supplier (SUP-UNKNOWN)",
    ),
  );
  assert.ok(requests.some((row) => row.supplier_id === "internal-product-team"));
  const finding = result.findings.find((item) => item.id === "BOM-002");
  assert.deepEqual(findingOwners(finding), ["SUP-ELEC", "SUP-UNKNOWN"]);
});

test("custom identifiers skip GTIN while unsupported rule kinds fail closed", async () => {
  const dataset = await loadDataset(join(ROOT, "examples", "northstar-complete"));
  dataset.product.identifier.scheme = "custom";
  dataset.product.identifier.value = "NORTHSTAR-MODEL-01";
  const evidence = await inspectEvidence(dataset, "2026-07-30T00:00:00.000Z");
  const pack = {
    metadata: { id: "test", version: "1", snapshotDate: "2026-07-30" },
    checks: [
      {
        id: "GTIN",
        kind: "gtin",
        title: "GTIN",
        description: "",
        severity: "major",
        weight: 1,
        remediation: "fix",
      },
      {
        id: "UNKNOWN",
        kind: "future_kind",
        title: "Unknown",
        description: "",
        severity: "critical",
        weight: 1,
        remediation: "upgrade",
      },
    ],
  };
  const result = evaluateRules(dataset, evidence, pack);
  assert.equal(result.findings.find((item) => item.id === "GTIN").status, "skipped");
  assert.equal(result.findings.find((item) => item.id === "UNKNOWN").status, "fail");
  assert.equal(result.score, 0);
});

test("dataset loader rejects path escapes, duplicate IDs, and invalid numbers", async () => {
  assert.throws(() => safeDatasetPath(ROOT, "../outside.txt"), /escapes/);
  assert.equal(
    safeDatasetPath(ROOT, "examples/northstar-complete/product.json"),
    join(ROOT, "examples", "northstar-complete", "product.json"),
  );

  const temp = await mkdtemp(join(tmpdir(), "dpp-model-"));
  const source = join(ROOT, "templates", "starter");
  const { cp } = await import("node:fs/promises");
  await cp(source, temp, { recursive: true });

  const bom = await readFile(join(temp, "bom.csv"), "utf8");
  await writeFile(join(temp, "bom.csv"), `${bom}${bom.split("\n")[1]}\n`);
  await assert.rejects(loadDataset(temp), /duplicate component_id/);

  await cp(source, temp, { recursive: true, force: true });
  await writeFile(
    join(temp, "bom.csv"),
    bom.replace(",100,MAT-001", ",not-a-number,MAT-001"),
  );
  await assert.rejects(loadDataset(temp), /mass_g must be numeric/);
});

test("evidence inspection represents absent paths and malformed dates", async () => {
  const dataset = await loadDataset(join(ROOT, "examples", "northstar-gaps"));
  dataset.evidence.push({
    evidence_id: "EMPTY",
    type: "other",
    path: "",
    absolutePath: null,
    issued_on: "bad-date",
    valid_until: "bad-date",
    supplier_id: "",
    scope: "",
  });
  const evidence = await inspectEvidence(dataset, "2026-07-30T00:00:00.000Z");
  const empty = evidence.find((record) => record.id === "EMPTY");
  assert.equal(empty.exists, false);
  assert.equal(empty.readError, "path is empty");
  assert.equal(empty.fresh, null);
  assert.equal(empty.issuedInFuture, null);
});
