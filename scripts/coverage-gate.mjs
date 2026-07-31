import { spawnSync } from "node:child_process";

const major = Number(process.versions.node.split(".")[0]);
const arguments_ = ["--test", "--experimental-test-coverage"];
if (major >= 24) arguments_.push("--test-coverage-exclude=src/cli.js");

const result = spawnSync(process.execPath, arguments_, {
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
  env: process.env,
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const summary = /all files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/.exec(
  result.stdout,
);
if (!summary) {
  throw new Error("Could not parse the Node test coverage summary");
}

const actual = {
  lines: Number(summary[1]),
  branches: Number(summary[2]),
  functions: Number(summary[3]),
};
const minimum = { lines: 85, branches: 75, functions: 85 };
const failures = Object.entries(minimum)
  .filter(([name, threshold]) => actual[name] < threshold)
  .map(
    ([name, threshold]) =>
      `${name}: ${actual[name].toFixed(2)}% is below ${threshold.toFixed(2)}%`,
  );
if (failures.length > 0) {
  process.stderr.write("Coverage gate failed:\n");
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Coverage gate passed: lines ${actual.lines.toFixed(2)}%, branches ${actual.branches.toFixed(2)}%, functions ${actual.functions.toFixed(2)}%.\n`,
  );
}
