import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = join(ROOT, "src", "cli.js");

function cli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

test("CLI prints help, version, and rule explanations", () => {
  assert.match(cli(["--help"]).stdout, /Exit codes/);
  assert.match(cli(["--version"]).stdout, /0\.1\.0/);
  assert.match(cli(["explain", "EVD-002"]).stdout, /Readable evidence files/);
  assert.equal(cli(["explain", "NOPE"]).status, 3);
  assert.match(cli(["unknown"]).stderr, /Unknown command/);
});

test("CLI init creates a usable starter and refuses accidental replacement", async () => {
  const root = await mkdtemp(join(tmpdir(), "dpp-cli-"));
  const starter = join(root, "starter");
  assert.equal(cli(["init", starter]).status, 0);
  assert.equal((await stat(join(starter, "product.json"))).isFile(), true);
  assert.equal(cli(["init", starter]).status, 3);
  assert.equal(cli(["init", starter, "--force"]).status, 0);
});

test("CLI uses distinct exit codes for gaps and verification failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "dpp-cli-out-"));
  const output = join(root, "gaps");
  const analyzed = cli([
    "analyze",
    "--input-dir",
    "examples/northstar-gaps",
    "--out",
    output,
    "--as-of",
    "2026-07-30T00:00:00.000Z",
    "--json",
  ]);
  assert.equal(analyzed.status, 2);
  assert.match(analyzed.stdout, /"ready": false/);
  assert.equal(cli(["verify", join(output, "dpp-preflight-bundle.zip")]).status, 0);
  assert.equal(cli(["verify", join(root, "missing.zip")]).status, 4);
  assert.equal(cli(["analyze"]).status, 3);
});
