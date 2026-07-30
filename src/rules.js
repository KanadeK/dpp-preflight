import { gs1DigitalLink, validateGtin } from "./gtin.js";
import { getPath, isPresent, sortedUnique } from "./util.js";

const STATUS_RANK = { fail: 0, warn: 1, skipped: 2, pass: 3 };

function finding(rule, status, message, details = []) {
  return {
    id: rule.id,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    weight: rule.weight,
    status,
    message,
    remediation: rule.remediation,
    basis: rule.basis ?? [],
    details,
  };
}

function failed(rule, message, details = []) {
  return finding(rule, rule.severity === "advisory" ? "warn" : "fail", message, details);
}

function passed(rule, message, details = []) {
  return finding(rule, "pass", message, details);
}

function skipped(rule, message) {
  return finding(rule, "skipped", message);
}

function isHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function required(rule, context) {
  const value = getPath(context, rule.path);
  return isPresent(value)
    ? passed(rule, `${rule.path} is present`)
    : failed(rule, `${rule.path} is missing`, [
        { owner: rule.owner ?? "internal-product-team", field: rule.path },
      ]);
}

function enumeration(rule, context) {
  const value = getPath(context, rule.path);
  if (!isPresent(value)) {
    return failed(rule, `${rule.path} is missing`, [
      { owner: rule.owner ?? "internal-product-team", field: rule.path },
    ]);
  }
  return rule.allowed.includes(value)
    ? passed(rule, `${rule.path} uses an allowed value`)
    : failed(rule, `${rule.path} must be one of: ${rule.allowed.join(", ")}`, [
        {
          owner: rule.owner ?? "internal-product-team",
          field: rule.path,
          value,
        },
      ]);
}

function httpsUri(rule, context) {
  const value = getPath(context, rule.path);
  return isHttps(value)
    ? passed(rule, `${rule.path} is an HTTPS URI`)
    : failed(rule, `${rule.path} must be a valid HTTPS URI`, [
        { owner: rule.owner ?? "internal-product-team", field: rule.path, value },
      ]);
}

function gtin(rule, context) {
  if (context.product.identifier?.scheme !== "gtin") {
    return skipped(rule, "Identifier scheme is not GTIN");
  }
  const result = validateGtin(context.product.identifier?.value);
  return result.valid
    ? passed(rule, `GTIN ${result.normalized} has a valid check digit`)
    : failed(rule, result.reason, [
        {
          owner: "internal-product-team",
          field: "product.identifier.value",
          value: result.normalized,
        },
      ]);
}

function dataCarrier(rule, context) {
  const carrier = context.product.dataCarrier ?? {};
  const details = [];
  if (!rule.allowedTypes.includes(carrier.type)) {
    details.push({
      owner: "internal-product-team",
      field: "product.dataCarrier.type",
      value: carrier.type,
    });
  }
  if (!isHttps(carrier.uri)) {
    details.push({
      owner: "internal-product-team",
      field: "product.dataCarrier.uri",
      value: carrier.uri,
    });
  }
  if (context.product.identifier?.scheme === "gtin" && carrier.uri) {
    const expected = gs1DigitalLink(context.product.identifier.value);
    let actualPath = null;
    let expectedPath = null;
    try {
      actualPath = new URL(carrier.uri).pathname.replace(/\/+$/, "");
      expectedPath = new URL(expected).pathname;
    } catch {
      // The invalid URI is already represented above.
    }
    if (expectedPath && actualPath !== expectedPath) {
      details.push({
        owner: "internal-product-team",
        field: "product.dataCarrier.uri",
        value: carrier.uri,
        expectedPath,
      });
    }
  }
  return details.length === 0
    ? passed(rule, "Data carrier has a supported type and persistent URI")
    : failed(rule, "Data carrier is incomplete or does not match the identifier", details);
}

function accessModel(rule, context) {
  const access = context.product.access ?? {};
  const missingRoles = rule.requiredRoles.filter(
    (role) => !Array.isArray(access.roles) || !access.roles.includes(role),
  );
  const details = missingRoles.map((role) => ({
    owner: "internal-product-team",
    field: "product.access.roles",
    missing: role,
  }));
  if (!Array.isArray(access.public) || access.public.length === 0) {
    details.push({
      owner: "internal-product-team",
      field: "product.access.public",
      missing: "at least one public data group",
    });
  }
  if (!Array.isArray(access.restricted)) {
    details.push({
      owner: "internal-product-team",
      field: "product.access.restricted",
      missing: "an explicit restricted data group list",
    });
  }
  return details.length === 0
    ? passed(rule, "Access groups and stakeholder roles are explicit")
    : failed(rule, "Access model is incomplete", details);
}

function privacy(rule, context) {
  const value = context.product.privacy?.containsCustomerPersonalData;
  return value === false
    ? passed(rule, "Passport declares no customer personal data")
    : failed(rule, "Customer personal data must not be included without explicit consent", [
        {
          owner: "internal-product-team",
          field: "product.privacy.containsCustomerPersonalData",
          value,
        },
      ]);
}

function bomPresence(rule, context) {
  return context.components.length > 0
    ? passed(rule, `${context.components.length} BOM components loaded`)
    : failed(rule, "BOM has no components", [
        { owner: "internal-product-team", field: "bom.csv" },
      ]);
}

function componentFields(rule, context) {
  const details = [];
  for (const component of context.components) {
    for (const field of rule.fields) {
      if (!isPresent(component[field])) {
        details.push({
          owner: component.supplier_id || "internal-product-team",
          componentId: component.component_id,
          field,
        });
      }
    }
  }
  return details.length === 0
    ? passed(rule, "Every component has the minimum traceability fields")
    : failed(rule, `${details.length} component fields are missing`, details);
}

function supplierLinks(rule, context) {
  const supplierIds = new Set(context.suppliers.map((supplier) => supplier.supplier_id));
  const details = context.components
    .filter(
      (component) =>
        !component.supplier_id || !supplierIds.has(component.supplier_id),
    )
    .map((component) => ({
      owner: component.supplier_id || "internal-product-team",
      componentId: component.component_id,
      field: "supplier_id",
      value: component.supplier_id,
    }));
  return details.length === 0
    ? passed(rule, "Every component resolves to a known supplier")
    : failed(rule, `${details.length} components have unresolved suppliers`, details);
}

function evidenceLinks(rule, context) {
  const evidenceIds = new Set(context.evidence.map((record) => record.evidence_id));
  const details = [];
  for (const component of context.components) {
    if (component.evidenceIds.length === 0) {
      details.push({
        owner: component.supplier_id || "internal-product-team",
        componentId: component.component_id,
        field: "evidence_ids",
        missing: "at least one evidence ID",
      });
      continue;
    }
    for (const evidenceId of component.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        details.push({
          owner: component.supplier_id || "internal-product-team",
          componentId: component.component_id,
          field: "evidence_ids",
          value: evidenceId,
        });
      }
    }
  }
  return details.length === 0
    ? passed(rule, "Every component has resolvable evidence")
    : failed(rule, `${details.length} component evidence links are incomplete`, details);
}

function evidenceFiles(rule, context) {
  const details = context.inspectedEvidence
    .filter((record) => !record.exists)
    .map((record) => ({
      owner: record.supplierId || "internal-product-team",
      evidenceId: record.id,
      field: "path",
      value: record.path,
      reason: record.readError,
    }));
  return details.length === 0
    ? passed(rule, "Every declared evidence file can be read")
    : failed(rule, `${details.length} evidence files cannot be read`, details);
}

function evidenceHashes(rule, context) {
  const details = context.inspectedEvidence
    .filter((record) => record.hashMatches === false)
    .map((record) => ({
      owner: record.supplierId || "internal-product-team",
      evidenceId: record.id,
      field: "declared_sha256",
      expected: record.declaredSha256,
      actual: record.sha256,
    }));
  return details.length === 0
    ? passed(rule, "Declared evidence hashes match computed SHA-256 values")
    : failed(rule, `${details.length} declared evidence hashes do not match`, details);
}

function evidenceFreshness(rule, context) {
  const details = [];
  for (const record of context.inspectedEvidence) {
    if (record.validUntil && record.fresh === false) {
      details.push({
        owner: record.supplierId || "internal-product-team",
        evidenceId: record.id,
        field: "valid_until",
        value: record.validUntil,
        reason: "expired",
      });
    }
    if (record.issuedOn && record.issuedInFuture === true) {
      details.push({
        owner: record.supplierId || "internal-product-team",
        evidenceId: record.id,
        field: "issued_on",
        value: record.issuedOn,
        reason: "issued after analysis timestamp",
      });
    }
    if (
      (record.validUntil && record.fresh === null) ||
      (record.issuedOn && record.issuedInFuture === null)
    ) {
      details.push({
        owner: record.supplierId || "internal-product-team",
        evidenceId: record.id,
        field: "date",
        reason: "invalid date",
      });
    }
  }
  return details.length === 0
    ? passed(rule, "Evidence dates are valid at the analysis timestamp")
    : failed(rule, `${details.length} evidence date issues need review`, details);
}

function massBalance(rule, context) {
  const declared = Number(context.product.netMassG);
  if (!Number.isFinite(declared) || declared <= 0) {
    return failed(rule, "product.netMassG must be a positive number", [
      {
        owner: "internal-product-team",
        field: "product.netMassG",
        value: context.product.netMassG,
      },
    ]);
  }
  const componentMass = context.components.reduce(
    (sum, component) => sum + component.massG,
    0,
  );
  const deltaPct = Math.abs(componentMass - declared) / declared * 100;
  const detail = {
    owner: "internal-product-team",
    declaredMassG: declared,
    componentMassG: componentMass,
    deltaPct: Math.round(deltaPct * 100) / 100,
    tolerancePct: rule.tolerancePct,
  };
  return deltaPct <= rule.tolerancePct
    ? passed(rule, "BOM mass is within the configured tolerance", [detail])
    : failed(rule, "BOM mass does not reconcile with product net mass", [detail]);
}

function repairLinks(rule, context) {
  const details = rule.paths
    .filter((path) => !isHttps(getPath(context, path)))
    .map((path) => ({
      owner: "internal-product-team",
      field: path,
      value: getPath(context, path),
    }));
  return details.length === 0
    ? passed(rule, "Repair and spare-part links are present")
    : failed(rule, `${details.length} repair links are missing or invalid`, details);
}

const HANDLERS = {
  required,
  enum: enumeration,
  https: httpsUri,
  gtin,
  data_carrier: dataCarrier,
  access_model: accessModel,
  privacy,
  bom_presence: bomPresence,
  component_fields: componentFields,
  supplier_links: supplierLinks,
  evidence_links: evidenceLinks,
  evidence_files: evidenceFiles,
  evidence_hashes: evidenceHashes,
  evidence_freshness: evidenceFreshness,
  mass_balance: massBalance,
  repair_links: repairLinks,
};

export function evaluateRules(dataset, inspectedEvidence, rulePack) {
  const context = { ...dataset, inspectedEvidence };
  const findings = rulePack.checks
    .map((rule) => {
      const handler = HANDLERS[rule.kind];
      if (!handler) {
        return failed(rule, `Unsupported rule kind: ${rule.kind}`);
      }
      return handler(rule, context);
    })
    .sort(
      (left, right) =>
        STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
        left.id.localeCompare(right.id),
    );

  const scored = findings.filter((item) => item.status !== "skipped");
  const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
  const passedWeight = scored
    .filter((item) => item.status === "pass")
    .reduce((sum, item) => sum + item.weight, 0);
  const score =
    totalWeight === 0 ? 0 : Math.round((passedWeight / totalWeight) * 1000) / 10;
  const blocking = findings.filter(
    (item) =>
      item.status === "fail" && ["critical", "major"].includes(item.severity),
  );

  return {
    score,
    ready: blocking.length === 0,
    counts: {
      pass: findings.filter((item) => item.status === "pass").length,
      fail: findings.filter((item) => item.status === "fail").length,
      warn: findings.filter((item) => item.status === "warn").length,
      skipped: findings.filter((item) => item.status === "skipped").length,
    },
    blockingRuleIds: blocking.map((item) => item.id).sort(),
    findings,
  };
}

export function explainRule(rulePack, ruleId) {
  return rulePack.checks.find(
    (rule) => rule.id.toLowerCase() === String(ruleId).toLowerCase(),
  );
}

export function findingOwners(finding) {
  return sortedUnique(finding.details.map((detail) => detail.owner));
}
