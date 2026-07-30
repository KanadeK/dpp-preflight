# Security policy

## Supported versions

Security fixes target the latest tagged release.

## Reporting

Do not open a public issue for a vulnerability that could expose product data, read files outside the selected dataset, inject active report content, or bypass bundle verification.

Use GitHub's private vulnerability reporting for this repository:

1. Open the repository **Security** tab.
2. Choose **Report a vulnerability**.
3. Include the affected version, operating system, proof of concept, impact, and any safe mitigation.

You should receive an acknowledgement within seven days. Please allow a coordinated fix before public disclosure.

## Data handling

DPP Preflight analyzes files locally and makes no network request in its `analyze` or `verify` paths. Generated bundles may contain sensitive product metadata, supplier contacts, paths relative to the dataset, and evidence hashes. Review a bundle before sharing it.

The tool does not encrypt outputs. Store and transmit them according to your organization's data classification.
