import assert from "node:assert/strict";
import test from "node:test";
import {
  crc32,
  createDeterministicZip,
  readDeterministicZip,
} from "../src/zip.js";

const STAMP = "2026-07-30T00:00:00.000Z";

test("ZIP writer is deterministic regardless of entry order", () => {
  const left = createDeterministicZip(
    [
      { name: "b.txt", bytes: "bravo" },
      { name: "a.txt", bytes: Buffer.from("alpha") },
    ],
    { timestamp: STAMP },
  );
  const right = createDeterministicZip(
    [
      { name: "a.txt", bytes: "alpha" },
      { name: "b.txt", bytes: "bravo" },
    ],
    { timestamp: STAMP },
  );
  assert.deepEqual(left, right);
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("ZIP reader recovers stored UTF-8 entries", () => {
  const archive = createDeterministicZip(
    [
      { name: "nested/证据.txt", bytes: "evidence" },
      { name: "manifest.json", bytes: "{}" },
    ],
    { timestamp: STAMP },
  );
  const entries = readDeterministicZip(archive);
  assert.equal(entries.get("nested/证据.txt").toString(), "evidence");
  assert.equal(entries.get("manifest.json").toString(), "{}");
});

test("ZIP utilities reject traversal, malformed records, CRC changes, and compression", () => {
  assert.throws(
    () =>
      createDeterministicZip([{ name: "../escape", bytes: "x" }], {
        timestamp: STAMP,
      }),
    /Unsafe ZIP entry/,
  );
  assert.throws(() => readDeterministicZip(Buffer.from("not a zip")), /end record/);

  const archive = createDeterministicZip([{ name: "a.txt", bytes: "alpha" }], {
    timestamp: STAMP,
  });
  const changed = Buffer.from(archive);
  const contentAt = changed.indexOf(Buffer.from("alpha"));
  changed[contentAt] ^= 1;
  assert.throws(() => readDeterministicZip(changed), /CRC mismatch/);

  const compressed = Buffer.from(archive);
  const central = compressed.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  compressed.writeUInt16LE(8, central + 10);
  assert.throws(() => readDeterministicZip(compressed), /Unsupported compressed/);
});
