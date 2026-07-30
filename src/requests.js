import { findingOwners } from "./rules.js";

const PRIORITY = {
  critical: "P0",
  major: "P1",
  advisory: "P2",
};

export function buildSupplierRequests(dataset, evaluation) {
  const supplierById = new Map(
    dataset.suppliers.map((supplier) => [supplier.supplier_id, supplier]),
  );
  const raw = [];

  for (const finding of evaluation.findings.filter(
    (item) => item.status === "fail" || item.status === "warn",
  )) {
    const details =
      finding.details.length > 0
        ? finding.details
        : findingOwners(finding).map((owner) => ({ owner }));
    const usableDetails =
      details.length > 0 ? details : [{ owner: "internal-product-team" }];

    for (const detail of usableDetails) {
      const owner = detail.owner || "internal-product-team";
      const supplier = supplierById.get(owner);
      const supplierName =
        supplier?.name ||
        (owner === "internal-product-team"
          ? "Internal product team"
          : `Unresolved supplier (${owner})`);
      raw.push({
        supplier_id: owner,
        supplier_name: supplierName,
        contact: supplier?.contact || "",
        priority: PRIORITY[finding.severity] ?? "P2",
        rule_id: finding.id,
        needed_for: finding.title,
        component_id: detail.componentId ?? "",
        evidence_id: detail.evidenceId ?? "",
        missing_field: detail.field ?? "",
        current_value: detail.value ?? "",
        request: finding.remediation,
      });
    }
  }

  const deduplicated = [
    ...new Map(
      raw.map((row) => [
        [
          row.supplier_id,
          row.rule_id,
          row.component_id,
          row.evidence_id,
          row.missing_field,
        ].join("|"),
        row,
      ]),
    ).values(),
  ].sort(
    (left, right) =>
      left.priority.localeCompare(right.priority) ||
      left.supplier_id.localeCompare(right.supplier_id) ||
      left.rule_id.localeCompare(right.rule_id) ||
      left.component_id.localeCompare(right.component_id),
  );

  return deduplicated.map((row, index) => ({
    request_id: `REQ-${String(index + 1).padStart(3, "0")}`,
    ...row,
  }));
}
