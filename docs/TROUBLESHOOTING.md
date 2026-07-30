# Troubleshooting and repair flow

Start with the command that failed. Keep the original input directory and generated report until the cause is understood.

## Repair sequence

1. Record the command, exit code, Node version, and first error line.
2. Run the smallest reproducer from the table below.
3. Repair the source field or code defect, not the generated output.
4. Re-run the focused command.
5. Re-run `npm run release:check` before publishing.
6. Compare the new `source-receipt.json` and `gaps.csv` with the previous run.

## Symptoms

| Symptom | Focused check | Repair |
| --- | --- | --- |
| `Cannot read JSON file` | `node -e "JSON.parse(require('fs').readFileSync('product.json'))"` | Restore the named file and validate its JSON syntax. |
| `CSV ... unclosed quoted field` | Open the reported CSV row in a text editor that shows line endings. | Close the quote or double embedded quotes. Do not replace commas by hand across the whole file. |
| `quantity` or `mass_g must be numeric` | Inspect the exact row named by the error. | Export a plain decimal value without unit text; keep the unit in the `unit` column. |
| `Evidence path escapes` | Inspect `evidence.csv` `path`. | Copy the evidence inside the dataset and use a relative path such as `evidence/file.pdf`. |
| Exit `2` | Open `report.html` or filter `gaps.csv` by `severity`. | Send `supplier-requests.csv` to the listed owners, update the source inputs, then analyze again. |
| `GTIN check digit should be ...` | `node src/cli.js explain ID-003` | Correct the governed GTIN. Do not edit only the QR URI. |
| `BOM mass does not reconcile` | Sum `mass_g` and compare with `product.netMassG`. | Resolve scope, excluded parts, unit conversion, or stale product mass. Do not widen tolerance without documented authority. |
| Evidence hash mismatch | Hash the authoritative file independently with `sha256sum` or `Get-FileHash`. | Investigate which bytes are authoritative, then update the file or declared digest at source. |
| `Output directory already exists` | Confirm the exact path in the error. | Choose a new output path, or use `--force` only for that reviewed target. |
| Exit `4` or `Bundle verification failed` | `node src/cli.js verify path/to/bundle.zip --json` | Recreate the bundle from unchanged authoritative inputs. Never patch files inside the ZIP. |
| Coverage below threshold | Read the uncovered file/line table printed by Node. | Add behavior-level tests for the missing branch; do not lower thresholds as the first response. |
| Benchmark above 10 seconds | `npm run benchmark` twice on an idle machine. | Check CSV growth, accidental quadratic loops, security software interference, or a constrained runner. |
| `npm_execpath is unavailable` | Check whether the script was run directly. | Use `npm run package:release` or `npm run release:check`, not `node scripts/package-release.mjs`. |
| Pages workflow fails | Run `npm run demo && npm run demo:complete && npm run site`. | Repair missing generated reports or broken static assets, then rerun the Pages job. |
| Release checksum mismatch | Re-run `npm run package:release` and `npm run verify:release`. | Upload the newly verified artifacts together. Do not mix files from separate builds. |

## Windows npm note

If PowerShell blocks `npm.ps1`, invoke the npm CLI through Node without changing machine policy:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run release:check
```

## Recovery after an interrupted analysis

Analysis writes to a process-specific staging directory and renames it only after all outputs are complete. A later run removes only its own staging target. If a process was killed:

1. Preserve the input directory.
2. Inspect any `<output>.staging-<pid>` directory before removal.
3. Run again with a new output path.
4. Verify the new ZIP.
5. Remove the abandoned staging directory only after confirming it is not active and contains no unique source file.

## Reporting a reproducible bug

Create a minimal fictional fixture with the same four source files, remove confidential evidence, and include:

- Node version and operating system.
- Full command and exit code.
- Expected and actual behavior.
- The smallest sanitized input that reproduces it.
- Whether `npm run release:check` fails on the same commit.
