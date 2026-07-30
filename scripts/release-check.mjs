import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is unavailable. Run this script through npm run release:check.");
}

const tasks = [
  "lint",
  "test:coverage",
  "demo",
  "demo:complete",
  "verify:demo",
  "benchmark",
  "site",
  "package:release",
  "verify:release",
];

for (const task of tasks) {
  process.stdout.write(`\n[release-check] npm run ${task}\n`);
  const result = spawnSync(process.execPath, [npmCli, "run", task], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.stderr.write(
      `\nRelease check stopped at "${task}". See docs/TROUBLESHOOTING.md for repair commands.\n`,
    );
    process.exit(result.status ?? 1);
  }
}

process.stdout.write("\nRelease check passed. Artifacts are ready for independent verification.\n");
