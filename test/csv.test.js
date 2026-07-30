import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv, stringifyCsv } from "../src/csv.js";

test("CSV parser handles BOM, CRLF, quotes, commas, and embedded lines", () => {
  const rows = parseCsv(
    '\uFEFFid,note,value\r\nA,"one, two",3\r\nB,"line 1\nline 2","a ""quote"""\r\n',
  );
  assert.deepEqual(rows, [
    { id: "A", note: "one, two", value: "3" },
    { id: "B", note: "line 1\nline 2", value: 'a "quote"' },
  ]);
});

test("CSV parser fills short rows and ignores empty lines", () => {
  assert.deepEqual(parseCsv("a,b\n1\n\n2,3\n"), [
    { a: "1", b: "" },
    { a: "2", b: "3" },
  ]);
  assert.deepEqual(parseCsv(""), []);
});

test("CSV parser rejects malformed headers and rows", () => {
  assert.throws(() => parseCsv("a,a\n1,2\n"), /duplicate headers/);
  assert.throws(() => parseCsv("a,\n1,2\n"), /empty header/);
  assert.throws(() => parseCsv("a\n1,2\n"), /has 2 fields/);
  assert.throws(() => parseCsv('a\n"open\n'), /unclosed quoted field/);
});

test("CSV stringifier has deterministic columns and round trips values", () => {
  const text = stringifyCsv([
    { z: "plain", a: 'quote " and comma,', empty: null },
    { a: "line\nbreak", z: 2, empty: "" },
  ]);
  assert.equal(
    text,
    'a,empty,z\n"quote "" and comma,",,plain\n"line\nbreak",,2\n',
  );
  assert.deepEqual(parseCsv(text), [
    { a: 'quote " and comma,', empty: "", z: "plain" },
    { a: "line\nbreak", empty: "", z: "2" },
  ]);
});
