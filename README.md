# DPP Preflight

Turn product master data, a bill of materials, supplier records, and local evidence files into an auditable Digital Product Passport readiness bundle.

[Live report demo](https://kanadek.github.io/dpp-preflight/demo/report.html) · [Project site](https://kanadek.github.io/dpp-preflight/) · [中文说明](README.zh-CN.md)

![A fictional task lamp separated into traceable source components](docs/assets/hero-product-evidence.png)

Digital Product Passport work often starts in four disconnected places: a product record, a BOM export, a supplier directory, and a folder of declarations. DPP Preflight joins those sources before downstream schema validation. It tells you which source owner must repair each gap, records evidence hashes, creates a JSON-LD readiness draft and GS1 Digital Link QR, and seals the result in a deterministic offline ZIP.

It does **not** claim legal compliance, replace a product-specific delegated act, certify evidence authenticity, or submit to the EU DPP Registry.

## What it produces

| Output | Practical use |
| --- | --- |
| `report.html` | Portable, accessible review report with gaps first |
| `report.json` | Machine-readable findings and source lineage |
| `gaps.csv` | One row per unresolved field |
| `supplier-requests.csv` | Concrete follow-ups assigned to supplier or internal owner |
| `passport-draft.jsonld` | Explicitly labelled readiness draft for the next mapping layer |
| `data-carrier.svg` | QR encoding the configured persistent URI |
| `source-receipt.json` | SHA-256 receipts for all four inputs and readable evidence files |
| `manifest.json` + `SHA256SUMS` | Offline consistency receipt |
| `dpp-preflight-bundle.zip` | Deterministic, STORE-only archive containing all outputs |

## Quick start

Requirements: Node.js 20 or later.

```bash
git clone https://github.com/KanadeK/dpp-preflight.git
cd dpp-preflight
npm ci

# Inspect a dataset that intentionally contains realistic gaps.
node src/cli.js analyze \
  --input-dir examples/northstar-gaps \
  --out dist/my-first-preflight \
  --as-of 2026-07-30T00:00:00.000Z \
  --allow-gaps

# Verify the portable bundle without the original source directory.
node src/cli.js verify dist/my-first-preflight/dpp-preflight-bundle.zip
```

Expected gap-fixture summary:

```text
Readiness score: 55.5/100
Status: blocking gaps remain
Supplier requests: 11
```

Start with your own copy:

```bash
node src/cli.js init my-product
# Replace the fictional rows and evidence file.
node src/cli.js analyze --input-dir my-product --out dist/my-product
```

The CLI refuses to replace an existing output directory unless that exact target is named with `--force`.

## Input contract

Every input directory has four source files and an evidence folder:

```text
my-product/
├── product.json
├── bom.csv
├── suppliers.csv
├── evidence.csv
└── evidence/
    └── supplier-declaration.pdf
```

Use [`templates/starter`](templates/starter) as the canonical starting shape. CSV fields support RFC 4180-style commas, quotes, CRLF, and embedded line breaks. Evidence paths must stay inside the input directory.

The included `eu-espr-core-readiness-2026-07` rule pack has 23 explainable checks covering identification, data-carrier binding, operator and facility identifiers, access rights, privacy, BOM traceability, evidence files and dates, mass reconciliation, and repair links. Inspect any rule:

```bash
node src/cli.js explain EVD-002
node src/cli.js explain MASS-001 --json
```

See [rule-pack design](docs/RULEPACK.md) for fields, scoring, and how to add a versioned pack.

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Success, ready, or gaps explicitly accepted with `--allow-gaps` |
| `2` | Analysis completed but blocking source gaps remain |
| `3` | Invalid input, rule pack, option, or output target |
| `4` | Bundle verification failed |
| `1` | Unexpected runtime failure |

Exit code `2` is useful in CI: the report is still generated, but a release can be blocked until owners close the gaps.

## GitHub Action

```yaml
- uses: KanadeK/dpp-preflight@v0.1.0
  with:
    input-dir: product-data
    output-dir: dpp-output
    as-of: 2026-07-30T00:00:00.000Z
```

The action uploads nothing by itself. Source files and evidence remain inside the runner unless your workflow explicitly publishes them.

## Acceptance commands

Run the complete local release gate:

```bash
npm ci
npm run release:check
```

The gate performs syntax and secret checks, tests with coverage thresholds, both example analyses, bundle verification, a 10,000-row CSV benchmark, static-site assembly, npm package creation, release checksum generation, and independent package/bundle inspection.

For a focused acceptance pass:

```bash
npm run test:coverage
npm run demo
npm run demo:complete
node src/cli.js verify dist/demo/dpp-preflight-bundle.zip
node src/cli.js verify dist/complete/dpp-preflight-bundle.zip
```

If a command fails, follow the exact symptom-to-repair flow in [Troubleshooting](docs/TROUBLESHOOTING.md). Do not delete source evidence to make a rule pass.

## Why this project is distinct

Existing DPP projects commonly validate a passport that already exists, host a registry, or demonstrate smart contracts. DPP Preflight works one layer earlier: it reconciles messy operational exports and local evidence, identifies the owner of every missing source field, and creates a portable handoff bundle for those downstream tools.

The selection research, alternatives rejected, dated GitHub searches, and authoritative sources are recorded in [Research](docs/RESEARCH.md). The architecture and trust boundaries are in [Architecture](docs/ARCHITECTURE.md).

## Security and trust boundaries

- No network requests occur during `analyze` or `verify`.
- Evidence paths cannot escape the input directory.
- Generated reports escape source text before inserting it into HTML.
- ZIP entries reject traversal names and unsupported compression.
- SHA-256 receipts prove byte consistency, not authorship or trusted time.
- Product data can be commercially sensitive. Review outputs before publishing.

Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Contributing

Issues that include a minimal four-file fixture are especially useful. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before submitting changes.

MIT licensed. Third-party attribution is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
