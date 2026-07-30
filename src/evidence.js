import { readFile } from "node:fs/promises";
import { sha256 } from "./util.js";

export async function inspectEvidence(dataset, asOf) {
  const asOfTime = new Date(asOf).valueOf();
  const inspected = [];

  for (const record of dataset.evidence) {
    let bytes = null;
    let readError = null;
    if (record.absolutePath) {
      try {
        bytes = await readFile(record.absolutePath);
      } catch (error) {
        readError = error.code === "ENOENT" ? "file not found" : error.message;
      }
    } else {
      readError = "path is empty";
    }

    const actualSha256 = bytes ? sha256(bytes) : null;
    const declaredSha256 = record.declared_sha256?.toLowerCase() || null;
    const validUntilTime = record.valid_until
      ? new Date(record.valid_until).valueOf()
      : null;
    const issuedOnTime = record.issued_on ? new Date(record.issued_on).valueOf() : null;

    inspected.push({
      id: record.evidence_id,
      type: record.type,
      path: record.path,
      issuer: record.issuer,
      issuedOn: record.issued_on || null,
      validUntil: record.valid_until || null,
      supplierId: record.supplier_id || null,
      scope: record.scope || null,
      exists: Boolean(bytes),
      readError,
      size: bytes?.length ?? null,
      sha256: actualSha256,
      declaredSha256,
      hashMatches: declaredSha256 ? declaredSha256 === actualSha256 : null,
      fresh:
        validUntilTime == null || Number.isNaN(validUntilTime)
          ? null
          : validUntilTime >= asOfTime,
      issuedInFuture:
        issuedOnTime == null || Number.isNaN(issuedOnTime)
          ? null
          : issuedOnTime > asOfTime,
    });
  }
  return inspected;
}
