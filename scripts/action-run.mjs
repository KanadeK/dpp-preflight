import { analyzeProject } from "../src/package.js";

const inputDir = process.env.INPUT_INPUT_DIR;
const outputDir = process.env.INPUT_OUTPUT_DIR;
const rulePackPath =
  process.env.INPUT_RULES || new URL("../rules/espr-core-2026-07.json", import.meta.url);
const asOf = process.env.INPUT_AS_OF || new Date().toISOString();
const allowGaps = process.env.INPUT_ALLOW_GAPS === "true";

const result = await analyzeProject({
  inputDir,
  outputDir,
  rulePackPath,
  asOf,
  force: true,
});
process.stdout.write(
  `DPP Preflight: ${result.score}/100; ${result.ready ? "ready" : "blocking gaps remain"}\n`,
);
process.stdout.write(`Report: ${result.outputDir}/report.html\n`);
if (!result.ready && !allowGaps) process.exitCode = 2;
