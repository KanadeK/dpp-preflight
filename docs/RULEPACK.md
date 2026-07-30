# Rule-pack guide

The bundled pack is `rules/espr-core-2026-07.json`. Its identifier, version, snapshot date, source URLs, and disclaimer are copied into every report.

## Rule shape

```json
{
  "id": "FAC-001",
  "kind": "required",
  "path": "product.facility.facilityId",
  "title": "Facility identifier",
  "description": "The production facility must be distinguishable from the legal operator.",
  "severity": "major",
  "weight": 6,
  "owner": "internal-product-team",
  "remediation": "Add a stable facility identifier and reconcile it with supplier records.",
  "basis": ["ESPR Article 10(1)(g)"]
}
```

Required metadata:

- `id`: stable identifier used in CSV exports and CI output.
- `kind`: named evaluator implemented by `src/rules.js`.
- `title` and `description`: human explanation.
- `severity`: `critical`, `major`, or `advisory`.
- `weight`: positive contribution to the readiness score.
- `remediation`: a concrete source-level repair.
- `basis`: one or more concise authority or control references.

## Supported kinds

| Kind | Purpose |
| --- | --- |
| `required` | Require a value at a dotted path |
| `enum` | Require one of a declared set of values |
| `https` | Require a valid HTTPS URI |
| `gtin` | Validate GTIN length and check digit when GTIN is selected |
| `data_carrier` | Check type, HTTPS URI, and GTIN Digital Link path |
| `access_model` | Require public/restricted groups and stakeholder roles |
| `privacy` | Enforce the customer personal-data boundary |
| `bom_presence` | Require at least one component |
| `component_fields` | Check selected fields on every BOM row |
| `supplier_links` | Resolve every BOM supplier ID |
| `evidence_links` | Resolve component evidence references |
| `evidence_files` | Require readable local evidence bytes |
| `evidence_hashes` | Compare optional declared SHA-256 values |
| `evidence_freshness` | Check expiry, future, and malformed dates at `--as-of` |
| `mass_balance` | Compare BOM mass with product net mass |
| `repair_links` | Check repair and spare-part HTTPS links |

Unknown kinds fail closed.

## Scoring and readiness

Skipped checks are removed from the denominator. Every other check contributes its weight only when it passes:

```text
score = passed weight / applicable weight × 100
```

The result is ready for the next validation layer only when no `critical` or `major` check fails. Advisory checks become warnings and do not block readiness.

## Adding a pack

1. Copy the existing JSON to a new dated filename.
2. Change the pack ID, version, and snapshot date.
3. Link primary sources and record their retrieval dates.
4. Add or change rules without reusing an ID for different semantics.
5. Add a minimal test fixture for every new failure mode.
6. Run:

```bash
node src/cli.js analyze --input-dir examples/northstar-complete --out dist/rule-test --rules rules/your-pack.json --force
npm run test:coverage
npm run release:check
```

Do not silently update an old dated rule pack when authority changes. Add a new version so historical bundles stay explainable.
