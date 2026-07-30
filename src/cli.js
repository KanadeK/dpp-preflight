#!/usr/bin/env node

import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject, verifyBundle } from "./package.js";
import { explainRule } from "./rules.js";
import { PreflightError, readJson, stableStringify } from "./util.js";
import { TOOL_NAME, VERSION } from "./version.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_RULE_PACK = resolve(
  PROJECT_ROOT,
  "rules",
  "espr-core-2026-07.json",
);
const STARTER_TEMPLATE = resolve(PROJECT_ROOT, "templates", "starter");

const HELP = `DPP Preflight ${VERSION}

Turn product, BOM, supplier, and evidence files into an auditable DPP readiness bundle.

Usage:
  dpp-preflight analyze --input-dir <dir> --out <dir> [options]
  dpp-preflight verify <bundle.zip|bundle-dir> [--json]
  dpp-preflight init <dir> [--force]
  dpp-preflight explain <rule-id> [--rules <file>] [--json]
  dpp-preflight --version

Analyze options:
  --rules <file>       Rule pack JSON (default: bundled ESPR core snapshot)
  --as-of <ISO time>   Reproducible analysis time (default: current time)
  --force              Replace only the named output directory
  --no-zip             Skip the deterministic ZIP
  --allow-gaps         Return exit code 0 when blocking gaps exist
  --json               Print a machine-readable summary

Exit codes:
  0  command succeeded, or gaps were explicitly allowed
  2  analysis completed and blocking evidence gaps remain
  3  input, rule pack, or output target is invalid
  4  bundle verification failed
  1  unexpected failure
`;

function parseArguments(tokens) {
  const options = {};
  const positional = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const [name, inlineValue] = token.slice(2).split("=", 2);
    if (["force", "no-zip", "allow-gaps", "json", "help"].includes(name)) {
      options[name] = true;
      continue;
    }
    const value = inlineValue ?? tokens[index + 1];
    if (value == null || value.startsWith("--")) {
      throw new PreflightError(`Option --${name} requires a value`, {
        code: "INPUT_INVALID",
      });
    }
    options[name] = value;
    if (inlineValue == null) index += 1;
  }
  return { options, positional };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function print(value, asJson = false) {
  process.stdout.write(
    asJson ? stableStringify(value) : `${String(value).trimEnd()}\n`,
  );
}

async function runAnalyze(tokens) {
  const { options, positional } = parseArguments(tokens);
  if (options.help) return print(HELP);
  const inputDir = options["input-dir"] ?? positional[0];
  const outputDir = options.out;
  if (!inputDir || !outputDir) {
    throw new PreflightError("analyze requires --input-dir and --out", {
      code: "INPUT_INVALID",
    });
  }
  const result = await analyzeProject({
    inputDir,
    outputDir,
    rulePackPath: options.rules ?? DEFAULT_RULE_PACK,
    asOf: options["as-of"] ?? new Date().toISOString(),
    force: Boolean(options.force),
    createZip: !options["no-zip"],
  });
  if (options.json) {
    print(result, true);
  } else {
    print(
      [
        `Readiness score: ${result.score}/100`,
        `Status: ${result.ready ? "ready for the next validation layer" : "blocking gaps remain"}`,
        `Output: ${result.outputDir}`,
        result.archivePath ? `Bundle: ${result.archivePath}` : "Bundle: skipped",
        `Supplier requests: ${result.requests}`,
      ].join("\n"),
    );
  }
  if (!result.ready && !options["allow-gaps"]) process.exitCode = 2;
}

async function runVerify(tokens) {
  const { options, positional } = parseArguments(tokens);
  const target = positional[0];
  if (!target) {
    throw new PreflightError("verify requires a ZIP or bundle directory", {
      code: "INPUT_INVALID",
    });
  }
  const result = await verifyBundle(target);
  const identifier =
    result.productIdentifier && typeof result.productIdentifier === "object"
      ? [
          result.productIdentifier.scheme,
          result.productIdentifier.value,
        ]
          .filter(Boolean)
          .join(":")
      : result.productIdentifier;
  print(
    options.json
      ? result
      : `Verified ${result.files} files for ${identifier || "unknown product"}.\n${result.note}`,
    Boolean(options.json),
  );
}

async function runInit(tokens) {
  const { options, positional } = parseArguments(tokens);
  const destination = resolve(positional[0] ?? "");
  if (!positional[0]) {
    throw new PreflightError("init requires a destination directory", {
      code: "INPUT_INVALID",
    });
  }
  if ((await exists(destination)) && !options.force) {
    throw new PreflightError(`Destination already exists: ${destination}`, {
      code: "OUTPUT_EXISTS",
      details: ["Use --force only when replacing this named starter directory"],
    });
  }
  await mkdir(dirname(destination), { recursive: true });
  await cp(STARTER_TEMPLATE, destination, {
    recursive: true,
    force: Boolean(options.force),
    errorOnExist: !options.force,
  });
  print(`Starter dataset created at ${destination}`);
}

async function runExplain(tokens) {
  const { options, positional } = parseArguments(tokens);
  const ruleId = positional[0];
  if (!ruleId) {
    throw new PreflightError("explain requires a rule ID", {
      code: "INPUT_INVALID",
    });
  }
  const rulePack = await readJson(options.rules ?? DEFAULT_RULE_PACK);
  const rule = explainRule(rulePack, ruleId);
  if (!rule) {
    throw new PreflightError(`Unknown rule ID: ${ruleId}`, {
      code: "INPUT_INVALID",
    });
  }
  print(
    options.json
      ? rule
      : [
          `${rule.id}: ${rule.title}`,
          `${rule.description}`,
          `Severity: ${rule.severity}; weight: ${rule.weight}`,
          `Repair: ${rule.remediation}`,
          ...rule.basis.map((basis) => `Basis: ${basis}`),
        ].join("\n"),
    Boolean(options.json),
  );
}

async function main(argv) {
  const [command, ...tokens] = argv;
  if (!command || ["--help", "-h", "help"].includes(command)) {
    return print(HELP);
  }
  if (["--version", "-v", "version"].includes(command)) {
    return print(`${TOOL_NAME} ${VERSION}`);
  }
  if (command === "analyze") return runAnalyze(tokens);
  if (command === "verify") return runVerify(tokens);
  if (command === "init") return runInit(tokens);
  if (command === "explain") return runExplain(tokens);
  throw new PreflightError(`Unknown command: ${command}`, {
    code: "INPUT_INVALID",
  });
}

main(process.argv.slice(2)).catch((error) => {
  const known = error instanceof PreflightError;
  process.stderr.write(`${known ? error.message : "Unexpected failure"}\n`);
  if (known && error.details.length > 0) {
    for (const detail of error.details) process.stderr.write(`- ${detail}\n`);
  }
  if (!known && process.env.DPP_PREFLIGHT_DEBUG === "1") {
    process.stderr.write(`${error.stack ?? error}\n`);
  }
  process.exitCode =
    error.code === "VERIFY_FAILED" || error.code === "PACKAGE_INVALID"
      ? 4
      : known
        ? 3
        : 1;
});
