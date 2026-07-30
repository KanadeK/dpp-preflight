import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP = new Set([".git", "node_modules", "dist", "release", "site", "coverage"]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".html",
  ".css",
  ".csv",
  ".txt",
]);
const failures = [];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (TEXT_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = await walk(ROOT);
for (const file of files) {
  const name = relative(ROOT, file).replaceAll("\\", "/");
  const text = await readFile(file, "utf8");
  if (text.includes("\r")) failures.push(`${name}: use LF line endings`);
  if (text.includes("\u0000")) failures.push(`${name}: contains a NUL byte`);
  if (/D:\\我的\\|C:\\Users\\12070/i.test(text)) {
    failures.push(`${name}: leaks a local absolute path`);
  }
  if (/(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/.test(text)) {
    failures.push(`${name}: resembles a GitHub token`);
  }
  if (extname(file) === ".json") {
    try {
      JSON.parse(text);
    } catch (error) {
      failures.push(`${name}: invalid JSON (${error.message})`);
    }
  }
  if ([".js", ".mjs"].includes(extname(file))) {
    const checked = spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    if (checked.status !== 0) {
      failures.push(`${name}: syntax check failed (${checked.stderr.trim()})`);
    }
  }
}

const required = [
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docs/RESEARCH.md",
  "docs/ARCHITECTURE.md",
  "docs/RULEPACK.md",
  "docs/TROUBLESHOOTING.md",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/release.yml",
];
for (const name of required) {
  try {
    if (!(await stat(join(ROOT, name))).isFile()) failures.push(`${name}: not a file`);
  } catch {
    failures.push(`${name}: required file is missing`);
  }
}

const markdownFiles = files.filter((file) => extname(file) === ".md");
for (const file of markdownFiles) {
  const text = await readFile(file, "utf8");
  const links = [...text.matchAll(/\[[^\]]+\]\((?!https?:|#|mailto:)([^)]+)\)/g)];
  for (const match of links) {
    const target = match[1].split("#")[0];
    if (!target || target.startsWith("<")) continue;
    const resolved = resolve(file, "..", decodeURIComponent(target));
    try {
      await stat(resolved);
    } catch {
      failures.push(
        `${relative(ROOT, file).replaceAll("\\", "/")}: broken local link ${target}`,
      );
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`Quality gate failed with ${failures.length} issue(s):\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Quality gate passed for ${files.length} text files.\n`);
}
