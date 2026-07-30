import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { parseCsv } from "./csv.js";
import { PreflightError, readJson } from "./util.js";

const FILES = {
  product: "product.json",
  components: "bom.csv",
  suppliers: "suppliers.csv",
  evidence: "evidence.csv",
};

function numeric(value, label, { optional = false } = {}) {
  if (value === "" && optional) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new PreflightError(`${label} must be numeric`, {
      code: "INPUT_INVALID",
      details: [String(value)],
    });
  }
  return parsed;
}

function assertUnique(rows, field, source) {
  const seen = new Set();
  for (const row of rows) {
    const value = row[field];
    if (!value) {
      throw new PreflightError(`${source} requires ${field} on every row`, {
        code: "INPUT_INVALID",
      });
    }
    if (seen.has(value)) {
      throw new PreflightError(`${source} contains duplicate ${field}: ${value}`, {
        code: "INPUT_INVALID",
      });
    }
    seen.add(value);
  }
}

export function safeDatasetPath(root, candidate) {
  const rootPath = resolve(root);
  const fullPath = resolve(rootPath, candidate);
  const relation = relative(rootPath, fullPath);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new PreflightError(`Evidence path escapes the input directory: ${candidate}`, {
      code: "INPUT_INVALID",
    });
  }
  return fullPath;
}

async function readCsv(path, label) {
  try {
    return parseCsv(await readFile(path, "utf8"), { source: label });
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    throw new PreflightError(`Cannot read ${label}: ${path}`, {
      code: "INPUT_INVALID",
      cause: error,
    });
  }
}

export async function loadDataset(inputDir) {
  const root = resolve(inputDir);
  const productEnvelope = await readJson(resolve(root, FILES.product));
  if (
    !productEnvelope ||
    typeof productEnvelope !== "object" ||
    !productEnvelope.product ||
    typeof productEnvelope.product !== "object"
  ) {
    throw new PreflightError("product.json must contain a product object", {
      code: "INPUT_INVALID",
    });
  }

  const componentRows = await readCsv(resolve(root, FILES.components), "bom.csv");
  const supplierRows = await readCsv(resolve(root, FILES.suppliers), "suppliers.csv");
  const evidenceRows = await readCsv(resolve(root, FILES.evidence), "evidence.csv");

  const components = componentRows.map((row, index) => ({
    ...row,
    quantity: numeric(row.quantity, `bom.csv row ${index + 2} quantity`),
    massG: numeric(row.mass_g, `bom.csv row ${index + 2} mass_g`),
    recycledContentPct: numeric(
      row.recycled_content_pct,
      `bom.csv row ${index + 2} recycled_content_pct`,
      { optional: true },
    ),
    evidenceIds: row.evidence_ids
      ? row.evidence_ids
          .split("|")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
  }));
  const suppliers = supplierRows.map((row) => ({ ...row }));
  const evidence = evidenceRows.map((row) => ({
    ...row,
    absolutePath: row.path ? safeDatasetPath(root, row.path) : null,
  }));

  assertUnique(components, "component_id", "bom.csv");
  assertUnique(suppliers, "supplier_id", "suppliers.csv");
  assertUnique(evidence, "evidence_id", "evidence.csv");

  return {
    root,
    schemaVersion: productEnvelope.schemaVersion ?? "dpp-preflight-product/1",
    snapshotAt: productEnvelope.snapshotAt ?? null,
    product: productEnvelope.product,
    components: components.sort((a, b) => a.component_id.localeCompare(b.component_id)),
    suppliers: suppliers.sort((a, b) => a.supplier_id.localeCompare(b.supplier_id)),
    evidence: evidence.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id)),
  };
}
