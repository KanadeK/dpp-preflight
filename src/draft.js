import { gs1DigitalLink } from "./gtin.js";

export function buildPassportDraft({
  dataset,
  inspectedEvidence,
  evaluation,
  rulePack,
  asOf,
}) {
  const product = dataset.product;
  const carrierUri =
    product.dataCarrier?.uri ||
    (product.identifier?.scheme === "gtin"
      ? gs1DigitalLink(product.identifier?.value)
      : product.passportUrl);

  return {
    "@context": [
      "https://schema.org",
      {
        dpp: "https://example.org/dpp-preflight/vocab/",
        evidenceSha256: "dpp:evidenceSha256",
        identifierGranularity: "dpp:identifierGranularity",
      },
    ],
    type: ["Product", "DigitalProductPassportReadinessDraft"],
    status: "readiness-draft-not-for-registry-submission",
    generatedAt: asOf,
    generatedBy: {
      name: "DPP Preflight",
      rulePack: rulePack.metadata.id,
      rulePackVersion: rulePack.metadata.version,
    },
    identifier: {
      scheme: product.identifier?.scheme ?? null,
      value: product.identifier?.value ?? null,
      granularity: product.identifier?.granularity ?? null,
    },
    name: product.name ?? null,
    categoryCode: product.categoryCode ?? null,
    manufacturer: product.manufacturer ?? null,
    productionFacility: product.facility ?? null,
    countryOfProduction: product.countryOfProduction ?? null,
    netMassG: product.netMassG ?? null,
    dataFormat: product.dataFormat ?? null,
    dataCarrier: {
      type: product.dataCarrier?.type ?? "qr",
      uri: carrierUri ?? null,
    },
    composition: dataset.components.map((component) => ({
      componentId: component.component_id,
      name: component.name,
      quantity: component.quantity,
      unit: component.unit,
      massG: component.massG,
      material: {
        code: component.material_code || null,
        name: component.material_name || null,
        recycledContentPct: component.recycledContentPct,
      },
      supplierId: component.supplier_id || null,
      countryOfOrigin: component.country_of_origin || null,
      evidenceIds: component.evidenceIds,
    })),
    economicOperators: dataset.suppliers.map((supplier) => ({
      id: supplier.supplier_id,
      name: supplier.name,
      operatorId: supplier.operator_id || null,
      facilityId: supplier.facility_id || null,
      country: supplier.country || null,
    })),
    evidence: inspectedEvidence.map((record) => ({
      id: record.id,
      type: record.type,
      issuer: record.issuer,
      issuedOn: record.issuedOn,
      validUntil: record.validUntil,
      supplierId: record.supplierId,
      scope: record.scope,
      file: record.path,
      evidenceSha256: record.sha256,
    })),
    access: product.access ?? null,
    privacy: product.privacy ?? null,
    repair: product.repair ?? null,
    readiness: {
      score: evaluation.score,
      ready: evaluation.ready,
      blockingRuleIds: evaluation.blockingRuleIds,
    },
    disclaimer:
      "This is a readiness draft. Product-specific delegated acts and registry requirements remain authoritative.",
  };
}
