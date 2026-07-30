# Contributing

Thank you for improving the operational layer before Digital Product Passport validation.

## Before opening an issue

- Search existing issues.
- Reproduce the problem with the latest tagged release.
- Remove confidential product and supplier data.
- Prefer a minimal fictional four-file fixture.

## Development

```bash
npm ci
npm run test:coverage
npm run release:check
```

Changes to a rule need:

1. A primary-source basis and retrieval date.
2. Stable semantics for the rule ID.
3. A passing and failing test fixture.
4. A source-level remediation message.
5. A note in `CHANGELOG.md`.

Changes to packaging need a determinism test and a tamper-detection test.

## Pull requests

Keep each pull request focused. Explain the user-visible outcome, trust-boundary impact, commands run, and any known limitation. Do not include real supplier evidence.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
