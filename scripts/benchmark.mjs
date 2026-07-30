import { performance } from "node:perf_hooks";
import { parseCsv, stringifyCsv } from "../src/csv.js";
import { evaluateRules } from "../src/rules.js";
import { readJson } from "../src/util.js";

const ROWS = 10_000;
const source = Array.from({ length: ROWS }, (_, index) => ({
  component_id: `CMP-${String(index).padStart(5, "0")}`,
  name: `Component ${index}`,
  quantity: 1,
  unit: "each",
  mass_g: 1,
  material_code: "MAT-001",
  material_name: "Demonstration material",
  recycled_content_pct: "",
  supplier_id: "SUP-001",
  country_of_origin: "CZ",
  evidence_ids: "EVD-001",
}));

const start = performance.now();
const csv = stringifyCsv(source);
const parsed = parseCsv(csv);
const elapsedMs = Math.round((performance.now() - start) * 10) / 10;
if (parsed.length !== ROWS) throw new Error(`Expected ${ROWS} rows, received ${parsed.length}`);
if (elapsedMs > 10_000) {
  throw new Error(`CSV benchmark took ${elapsedMs} ms, above the 10,000 ms guardrail`);
}

const rulePack = await readJson(
  new URL("../rules/espr-core-2026-07.json", import.meta.url),
);
const smoke = evaluateRules(
  {
    product: {},
    components: [],
    suppliers: [],
    evidence: [],
  },
  [],
  rulePack,
);
if (smoke.ready) throw new Error("An empty product must fail closed");

process.stdout.write(
  `${JSON.stringify({ rows: ROWS, csvBytes: Buffer.byteLength(csv), elapsedMs })}\n`,
);
