# Research and project selection

Snapshot date: 2026-07-30.

## Problem signal

The EU Digital Product Passport is moving from policy design into operating infrastructure. The European Commission announced that the DPP Registry went live on 20 July 2026. Regulation (EU) 2024/1781 Article 10 sets horizontal requirements around data carriers, persistent unique product identifiers, open and interoperable formats, access rights, and operator or facility identifiers. Product-specific delegated acts still determine the exact data set for each product group.

Primary sources:

- [Regulation (EU) 2024/1781](https://eur-lex.europa.eu/eli/reg/2024/1781/eng)
- [European Commission DPP overview](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en)
- [European Commission DPP Registry](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport/dpp-registry_en)
- [Commission announcement: DPP Registry now live](https://single-market-economy.ec.europa.eu/news/digital-product-passport-registry-now-live-2026-07-20_en)
- [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link)

Community discussions repeatedly describe the operational layer as fragmented product, supplier, and documentation data:

- [BuyFromEU discussion about practical DPP data collection](https://www.reddit.com/r/BuyFromEU/comments/1kn0r2g/digital_product_passport_in_eu/)
- [SupplyChainTalks discussion about handling ESPR and DPP work](https://www.reddit.com/r/SupplyChainTalks/comments/1so5ksb/how_are_you_guys_actually_handling_espr_digital/)
- [SustainableFashion discussion about DPP implementation](https://www.reddit.com/r/SustainableFashion/comments/1up7xad/digital_product_passports/)

These discussions are directional community evidence, not legal authority.

## GitHub landscape

GitHub repository and code searches were run on 2026-07-30 using exact phrases and adjacent terms:

- `"digital product passport generator"` returned one small generator repository.
- `dpp validator` surfaced [artiso-ai/dppvalidator](https://github.com/artiso-ai/dppvalidator), which validates already-formed passport JSON against downstream models.
- Registry and protocol demonstrations included [traceaware/open-dpp](https://github.com/traceaware/open-dpp) and [DigitalProductPassport/SmartContracts](https://github.com/DigitalProductPassport/SmartContracts).
- Exact searches for `dpp preflight`, `passport gap`, `supplier evidence dpp`, and `digital product passport csv` returned no substantive matching repositories at the time of the snapshot.

Search results change. These observations establish the selection rationale, not a permanent claim that no similar work can ever exist.

## Chosen wedge

DPP Preflight operates upstream of schema validators, registries, and smart contracts:

```text
product master + BOM + suppliers + evidence files
                         │
                         ▼
                 DPP Preflight
                         │
       gaps + owners + receipts + draft + QR
                         │
                         ▼
       product-specific mapping and validation
                         │
                         ▼
              publication or registry flow
```

The unit of value is not another dashboard. It is a portable evidence handoff:

1. Resolve data ownership before schema mapping.
2. Detect missing files, stale dates, mismatched hashes, unresolved suppliers, and mass imbalance.
3. Preserve source receipts and deterministic outputs for review.
4. Create a draft that clearly states it is not a Registry submission.

## Alternatives rejected

| Candidate | Reason rejected |
| --- | --- |
| Rental move-in evidence app | Mature consumer and property-management products already cover photo inventories and reports. |
| Ingredient-label drift monitor | Useful, but consumer scanning and label-comparison apps are crowded and depend heavily on external product databases. |
| Engineering tolerance stack calculator | Practical, but many established calculators and CAD add-ons already exist. |
| Final DPP validator | Strong existing open-source validators already target formed JSON and formal schemas. |
| DPP registry or blockchain demo | Infrastructure-heavy, narrower adoption path, and already represented by multiple projects. |

## Scope controls

- The bundled rule pack is a dated horizontal readiness snapshot.
- It intentionally avoids product-group claims that require a delegated act.
- Hashes are consistency evidence, not signatures or trusted timestamps.
- The fictional Northstar lamp is example data, not a compliant market product.
- No external service receives the user's source data during analysis.
