import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

export class PreflightError extends Error {
  constructor(message, { code = "PREFLIGHT_ERROR", details = [], cause } = {}) {
    super(message, { cause });
    this.name = "PreflightError";
    this.code = code;
    this.details = details;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value, space = 2) {
  return `${JSON.stringify(stableValue(value), null, space)}\n`;
}

export function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseIso(value, label = "date") {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.valueOf())) {
    throw new PreflightError(`${label} must be a valid ISO 8601 timestamp`, {
      code: "INPUT_INVALID",
      details: [String(value ?? "")],
    });
  }
  return parsed.toISOString();
}

export async function readJson(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new PreflightError(`Cannot read JSON file: ${path}`, {
      code: "INPUT_INVALID",
      cause: error,
    });
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new PreflightError(`Invalid JSON in ${path}: ${error.message}`, {
      code: "INPUT_INVALID",
      cause: error,
    });
  }
}

export async function writeAtomic(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  await writeFile(temporary, value);
  await rename(temporary, absolute);
}

export function getPath(object, dottedPath) {
  return dottedPath
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), object);
}

export function isPresent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function sortedUnique(values) {
  return [...new Set(values.filter(isPresent).map(String))].sort((a, b) =>
    a.localeCompare(b),
  );
}
