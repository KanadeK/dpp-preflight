import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, parse, resolve } from "node:path";
import { stringifyCsv } from "./csv.js";
import { buildPassportDraft } from "./draft.js";
import { inspectEvidence } from "./evidence.js";
import { loadDataset } from "./model.js";
import { renderQrSvg } from "./qr.js";
import { renderHtmlReport } from "./report.js";
import { buildSupplierRequests } from "./requests.js";
import { evaluateRules } from "./rules.js";
import {
  PreflightError,
  parseIso,
  readJson,
  sha256,
  stableStringify,
  writeAtomic,
} from "./util.js";
import { createDeterministicZip, readDeterministicZip } from "./zip.js";
import { TOOL_NAME, VERSION } from "./version.js";

const INPUT_FILES = ["product.json", "bom.csv", "suppliers.csv", "evidence.csv"];
const GAP_COLUMNS = [
  "rule_id",
  "status",
  "severity",
  "title",
  "message",
  "owner",
  "component_id",
  "evidence_id",
  "field",
  "remediation",
];
const REQUEST_COLUMNS = [
  "request_id",
  "supplier_id",
  "supplier_name",
  "contact",
  "priority",
  "rule_id",
  "needed_for",
  "component_id",
  "evidence_id",
  "missing_field",
  "current_value",
  "request",
];

function gapRows(evaluation) {
  return evaluation.findings
    .filter((finding) => finding.status === "fail" || finding.status === "warn")
    .flatMap((finding) => {
      const details =
        finding.details.length > 0 ? finding.details : [{ owner: "internal-product-team" }];
      return details.map((detail) => ({
        rule_id: finding.id,
        status: finding.status,
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        owner: detail.owner ?? "internal-product-team",
        component_id: detail.componentId ?? "",
        evidence_id: detail.evidenceId ?? "",
        field: detail.field ?? "",
        remediation: finding.remediation,
      }));
    });
}

function outputReadme({ ready, score }) {
  return `DPP Preflight bundle

Readiness: ${ready ? "ready for the next validation layer" : "gaps remain"}
Score: ${score}/100

Files:
- report.html: human-readable evidence report
- report.json: machine-readable result
- gaps.csv: one row per unresolved source field
- supplier-requests.csv: follow-up requests grouped by owner
- passport-draft.jsonld: readiness draft, not a registry submission
- data-carrier.svg: QR for the configured persistent URI
- source-receipt.json: hashes of source files
- manifest.json and SHA256SUMS: offline consistency receipt

Verify:
  dpp-preflight verify dpp-preflight-bundle.zip

Important:
Internal hashes detect byte changes. They do not provide an independent trusted timestamp or prove legal authenticity.
`;
}

async function sourceReceipt(inputDir, dataset, inspectedEvidence, asOf) {
  const files = [];
  for (const name of INPUT_FILES) {
    const bytes = await readFile(resolve(inputDir, name));
    files.push({ path: name, size: bytes.length, sha256: sha256(bytes) });
  }
  for (const record of inspectedEvidence.filter((item) => item.exists)) {
    files.push({
      path: record.path,
      size: record.size,
      sha256: record.sha256,
      evidenceId: record.id,
    });
  }
  return {
    schemaVersion: "dpp-preflight-source-receipt/1",
    capturedAt: asOf,
    productIdentifier: dataset.product.identifier ?? null,
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function analysisRecord({
  dataset,
  inspectedEvidence,
  evaluation,
  requests,
  rulePack,
  asOf,
}) {
  return {
    schemaVersion: "dpp-preflight-report/1",
    tool: { name: TOOL_NAME, version: VERSION },
    analyzedAt: asOf,
    rulePack: {
      id: rulePack.metadata.id,
      version: rulePack.metadata.version,
      snapshotDate: rulePack.metadata.snapshotDate,
    },
    product: dataset.product,
    summary: {
      score: evaluation.score,
      ready: evaluation.ready,
      counts: evaluation.counts,
      blockingRuleIds: evaluation.blockingRuleIds,
      components: dataset.components.length,
      suppliers: dataset.suppliers.length,
      evidenceRecords: inspectedEvidence.length,
      requests: requests.length,
    },
    findings: evaluation.findings,
    evidence: inspectedEvidence,
  };
}

function assertSafeOutput(outputDir, inputDir) {
  const output = resolve(outputDir);
  const input = resolve(inputDir);
  const root = parse(output).root;
  if (output === root || output === resolve(".") || output === input) {
    throw new PreflightError(`Refusing unsafe output directory: ${output}`, {
      code: "INPUT_INVALID",
    });
  }
  return output;
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function checksumText(files, manifestBytes) {
  return [
    ...files.map((file) => `${file.sha256}  ${file.path}`),
    `${sha256(manifestBytes)}  manifest.json`,
  ]
    .sort((left, right) => left.localeCompare(right))
    .join("\n") + "\n";
}

export async function analyzeProject({
  inputDir,
  outputDir,
  rulePackPath,
  asOf,
  force = false,
  createZip = true,
}) {
  const analysisTime = parseIso(asOf, "as-of");
  const output = assertSafeOutput(outputDir, inputDir);
  if ((await pathExists(output)) && !force) {
    throw new PreflightError(`Output directory already exists: ${output}`, {
      code: "OUTPUT_EXISTS",
      details: ["Use --force to replace this specific output directory"],
    });
  }

  const rulePack = await readJson(rulePackPath);
  const dataset = await loadDataset(inputDir);
  const inspectedEvidence = await inspectEvidence(dataset, analysisTime);
  const evaluation = evaluateRules(dataset, inspectedEvidence, rulePack);
  const requests = buildSupplierRequests(dataset, evaluation);
  const draft = buildPassportDraft({
    dataset,
    inspectedEvidence,
    evaluation,
    rulePack,
    asOf: analysisTime,
  });
  const carrierUri =
    dataset.product.dataCarrier?.uri ||
    dataset.product.passportUrl ||
    "https://example.invalid/dpp-not-configured";
  const qrSvg = renderQrSvg(carrierUri);
  const receipt = await sourceReceipt(inputDir, dataset, inspectedEvidence, analysisTime);
  const report = analysisRecord({
    dataset,
    inspectedEvidence,
    evaluation,
    requests,
    rulePack,
    asOf: analysisTime,
  });

  const content = new Map([
    ["README.txt", Buffer.from(outputReadme(evaluation))],
    ["data-carrier.svg", Buffer.from(qrSvg)],
    ["gaps.csv", Buffer.from(stringifyCsv(gapRows(evaluation), GAP_COLUMNS))],
    ["passport-draft.jsonld", Buffer.from(stableStringify(draft))],
    [
      "report.html",
      Buffer.from(
        renderHtmlReport({
          dataset,
          evaluation,
          inspectedEvidence,
          requests,
          rulePack,
          asOf: analysisTime,
          qrSvg,
        }),
      ),
    ],
    ["report.json", Buffer.from(stableStringify(report))],
    ["source-receipt.json", Buffer.from(stableStringify(receipt))],
    [
      "supplier-requests.csv",
      Buffer.from(stringifyCsv(requests, REQUEST_COLUMNS)),
    ],
  ]);

  const fileReceipts = [...content.entries()]
    .map(([path, bytes]) => ({ path, size: bytes.length, sha256: sha256(bytes) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const rulePackBytes = await readFile(rulePackPath);
  const manifest = {
    schemaVersion: "dpp-preflight-manifest/1",
    tool: { name: TOOL_NAME, version: VERSION },
    createdAt: analysisTime,
    productIdentifier: dataset.product.identifier ?? null,
    rulePack: {
      id: rulePack.metadata.id,
      version: rulePack.metadata.version,
      sha256: sha256(rulePackBytes),
    },
    files: fileReceipts,
  };
  const manifestBytes = Buffer.from(stableStringify(manifest));
  const checksums = Buffer.from(checksumText(fileReceipts, manifestBytes));
  const archiveEntries = [
    ...[...content.entries()].map(([name, bytes]) => ({ name, bytes })),
    { name: "manifest.json", bytes: manifestBytes },
    { name: "SHA256SUMS", bytes: checksums },
  ];
  const archive = createZip
    ? createDeterministicZip(archiveEntries, { timestamp: analysisTime })
    : null;

  const staging = `${output}.staging-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    for (const [name, bytes] of content) {
      await writeAtomic(resolve(staging, name), bytes);
    }
    await writeAtomic(resolve(staging, "manifest.json"), manifestBytes);
    await writeAtomic(resolve(staging, "SHA256SUMS"), checksums);
    if (archive) {
      await writeAtomic(resolve(staging, "dpp-preflight-bundle.zip"), archive);
    }
    if (await pathExists(output)) {
      await rm(output, { recursive: true, force: false });
    }
    await mkdir(dirname(output), { recursive: true });
    await rename(staging, output);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }

  return {
    outputDir: output,
    archivePath: archive ? resolve(output, "dpp-preflight-bundle.zip") : null,
    score: evaluation.score,
    ready: evaluation.ready,
    counts: evaluation.counts,
    requests: requests.length,
  };
}

async function entriesForTarget(target) {
  const info = await stat(target).catch((error) => {
    throw new PreflightError(`Cannot read bundle target: ${target}`, {
      code: "VERIFY_FAILED",
      cause: error,
    });
  });
  if (info.isDirectory()) {
    const manifestBytes = await readFile(resolve(target, "manifest.json"));
    const entries = new Map([
      ["manifest.json", manifestBytes],
      ["SHA256SUMS", await readFile(resolve(target, "SHA256SUMS"))],
    ]);
    let manifest;
    try {
      manifest = JSON.parse(manifestBytes.toString("utf8"));
    } catch {
      return entries;
    }
    for (const file of Array.isArray(manifest.files) ? manifest.files : []) {
      try {
        entries.set(file.path, await readFile(resolve(target, file.path)));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return entries;
  }
  return readDeterministicZip(await readFile(target));
}

export async function verifyBundle(target) {
  const entries = await entriesForTarget(resolve(target));
  const manifestBytes = entries.get("manifest.json");
  const checksumBytes = entries.get("SHA256SUMS");
  if (!manifestBytes || !checksumBytes) {
    throw new PreflightError("Bundle lacks manifest.json or SHA256SUMS", {
      code: "VERIFY_FAILED",
    });
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (error) {
    throw new PreflightError("manifest.json is not valid JSON", {
      code: "VERIFY_FAILED",
      cause: error,
    });
  }
  if (
    manifest.schemaVersion !== "dpp-preflight-manifest/1" ||
    !Array.isArray(manifest.files)
  ) {
    throw new PreflightError("Unsupported or malformed bundle manifest", {
      code: "VERIFY_FAILED",
    });
  }

  const failures = [];
  for (const file of manifest.files) {
    const bytes = entries.get(file.path);
    if (!bytes) {
      failures.push(`${file.path}: missing`);
      continue;
    }
    const actual = sha256(bytes);
    if (actual !== file.sha256) {
      failures.push(`${file.path}: SHA-256 mismatch`);
    }
    if (bytes.length !== file.size) {
      failures.push(`${file.path}: size mismatch`);
    }
  }
  const expectedChecksums = checksumText(manifest.files, manifestBytes);
  if (checksumBytes.toString("utf8") !== expectedChecksums) {
    failures.push("SHA256SUMS: content mismatch");
  }
  if (failures.length > 0) {
    throw new PreflightError("Bundle verification failed", {
      code: "VERIFY_FAILED",
      details: failures,
    });
  }
  return {
    valid: true,
    files: manifest.files.length,
    productIdentifier: manifest.productIdentifier,
    createdAt: manifest.createdAt,
    note:
      "Internal consistency verified. Independent authenticity and trusted time are outside this bundle.",
  };
}
