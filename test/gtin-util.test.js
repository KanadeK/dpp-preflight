import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  calculateGtinCheckDigit,
  gs1DigitalLink,
  normalizeGtin,
  toGtin14,
  validateGtin,
} from "../src/gtin.js";
import {
  PreflightError,
  getPath,
  htmlEscape,
  isPresent,
  parseIso,
  readJson,
  sha256,
  sortedUnique,
  stableStringify,
  writeAtomic,
} from "../src/util.js";

test("GTIN helpers normalize, validate, pad, and create a Digital Link", () => {
  assert.equal(normalizeGtin("0 9506-0001 34352"), "09506000134352");
  assert.equal(calculateGtinCheckDigit("0950600013435"), "2");
  assert.equal(calculateGtinCheckDigit("abc"), null);
  assert.deepEqual(validateGtin("09506000134352"), {
    valid: true,
    normalized: "09506000134352",
    reason: null,
  });
  assert.equal(toGtin14("12345670"), "00000012345670");
  assert.equal(
    gs1DigitalLink("09506000134352", "https://resolver.example///"),
    "https://resolver.example/01/09506000134352",
  );
});

test("GTIN helpers explain invalid length and check digit", () => {
  assert.match(validateGtin("123").reason, /8, 12, 13, or 14/);
  assert.match(validateGtin("09506000134353").reason, /check digit/);
  assert.equal(toGtin14("bad"), null);
  assert.equal(gs1DigitalLink("bad"), null);
});

test("utility functions are stable and escape untrusted report text", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(
    stableStringify({ z: 1, a: { y: 2, x: [3, { b: 2, a: 1 }] } }),
    '{\n  "a": {\n    "x": [\n      3,\n      {\n        "a": 1,\n        "b": 2\n      }\n    ],\n    "y": 2\n  },\n  "z": 1\n}\n',
  );
  assert.equal(htmlEscape(`<a x="y">'&`), "&lt;a x=&quot;y&quot;&gt;&#39;&amp;");
  assert.equal(getPath({ a: { b: 2 } }, "a.b"), 2);
  assert.equal(getPath({ a: null }, "a.b"), undefined);
  assert.equal(isPresent("  "), false);
  assert.equal(isPresent([]), false);
  assert.equal(isPresent(0), true);
  assert.deepEqual(sortedUnique(["b", "", "a", "b", null]), ["a", "b"]);
});

test("ISO parsing and JSON IO return actionable errors", async () => {
  assert.equal(parseIso("2026-07-30", "snapshot"), "2026-07-30T00:00:00.000Z");
  assert.throws(() => parseIso("not-a-date", "snapshot"), (error) => {
    assert.equal(error.code, "INPUT_INVALID");
    return /snapshot/.test(error.message);
  });

  const root = await mkdtemp(join(tmpdir(), "dpp-util-"));
  const target = join(root, "nested", "record.json");
  await writeAtomic(target, stableStringify({ answer: 42 }));
  assert.deepEqual(await readJson(target), { answer: 42 });
  assert.match(await readFile(target, "utf8"), /"answer": 42/);
  await assert.rejects(readJson(join(root, "missing.json")), /Cannot read JSON/);
  await writeAtomic(target, "{broken");
  await assert.rejects(readJson(target), /Invalid JSON/);
});

test("PreflightError preserves machine code and details", () => {
  const cause = new Error("root");
  const error = new PreflightError("bad input", {
    code: "INPUT_INVALID",
    details: ["row 2"],
    cause,
  });
  assert.equal(error.name, "PreflightError");
  assert.equal(error.code, "INPUT_INVALID");
  assert.deepEqual(error.details, ["row 2"]);
  assert.equal(error.cause, cause);
});
