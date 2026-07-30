import { htmlEscape } from "./util.js";

function statusLabel(status) {
  return {
    pass: "Pass",
    fail: "Gap",
    warn: "Review",
    skipped: "Skipped",
  }[status] ?? status;
}

function detailText(detail) {
  return [
    detail.componentId ? `component ${detail.componentId}` : null,
    detail.evidenceId ? `evidence ${detail.evidenceId}` : null,
    detail.field ? `field ${detail.field}` : null,
    detail.missing ? `missing ${detail.missing}` : null,
    detail.reason ? detail.reason : null,
    detail.declaredMassG !== undefined
      ? `declared mass ${detail.declaredMassG} g`
      : null,
    detail.componentMassG !== undefined
      ? `BOM mass ${detail.componentMassG} g`
      : null,
    detail.deltaPct !== undefined ? `delta ${detail.deltaPct}%` : null,
    detail.tolerancePct !== undefined
      ? `tolerance ${detail.tolerancePct}%`
      : null,
    detail.value !== undefined && detail.value !== ""
      ? `current ${detail.value}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function renderFindings(findings) {
  return findings
    .map((item) => {
      const details =
        item.details.length > 0
          ? `<ul>${item.details
              .map(
                (detail) =>
                  `<li><strong>${htmlEscape(detail.owner ?? "internal")}</strong>: ${htmlEscape(detailText(detail))}</li>`,
              )
              .join("")}</ul>`
          : "";
      return `<details class="finding finding-${htmlEscape(item.status)}" ${
        item.status === "fail" ? "open" : ""
      }>
        <summary>
          <span class="status">${htmlEscape(statusLabel(item.status))}</span>
          <span><strong>${htmlEscape(item.id)}</strong> ${htmlEscape(item.title)}</span>
          <span class="severity">${htmlEscape(item.severity)}</span>
        </summary>
        <div class="finding-body">
          <p>${htmlEscape(item.message)}</p>
          ${details}
          <p class="repair"><strong>Repair:</strong> ${htmlEscape(item.remediation)}</p>
        </div>
      </details>`;
    })
    .join("\n");
}

function renderEvidence(records) {
  return records
    .map(
      (record) => `<tr>
        <td><code>${htmlEscape(record.id)}</code></td>
        <td>${htmlEscape(record.type)}</td>
        <td>${htmlEscape(record.supplierId ?? "internal")}</td>
        <td>${record.exists ? "Readable" : htmlEscape(record.readError)}</td>
        <td>${record.fresh === false ? "Expired" : record.fresh === true ? "Current" : "No expiry"}</td>
        <td><code>${htmlEscape(record.sha256?.slice(0, 12) ?? "unavailable")}</code></td>
      </tr>`,
    )
    .join("\n");
}

function renderRequests(requests) {
  if (requests.length === 0) {
    return `<p class="empty">No follow-up requests were generated.</p>`;
  }
  return requests
    .slice(0, 12)
    .map(
      (request) => `<article class="request">
        <div>
          <span class="request-id">${htmlEscape(request.request_id)}</span>
          <strong>${htmlEscape(request.supplier_name)}</strong>
        </div>
        <p>${htmlEscape(request.needed_for)}. ${htmlEscape(request.request)}</p>
        <small>${htmlEscape(request.component_id || request.evidence_id || request.missing_field || "product record")}</small>
      </article>`,
    )
    .join("\n");
}

export function renderHtmlReport({
  dataset,
  evaluation,
  inspectedEvidence,
  requests,
  rulePack,
  asOf,
  qrSvg,
}) {
  const product = dataset.product;
  const status = evaluation.ready ? "Ready for the next validation layer" : "Evidence gaps remain";
  const criticalCount = evaluation.findings.filter(
    (item) => item.status === "fail" && item.severity === "critical",
  ).length;
  const componentMass = dataset.components.reduce(
    (sum, component) => sum + component.massG,
    0,
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${htmlEscape(product.name ?? "Product")} DPP readiness report</title>
  <style>
    :root {
      color-scheme: light dark;
      --page: #eef2f1;
      --surface: #f8faf9;
      --surface-strong: #ffffff;
      --ink: #17211f;
      --muted: #53615e;
      --line: #c7d0cd;
      --accent: #087f6a;
      --accent-ink: #ffffff;
      --danger: #9b2c2c;
      --warning: #8a5b00;
      --radius: 14px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --page: #111816;
        --surface: #18211f;
        --surface-strong: #202b28;
        --ink: #edf4f1;
        --muted: #a9b8b3;
        --line: #3c4c47;
        --accent: #4ec7ad;
        --accent-ink: #10201c;
        --danger: #ff9d9d;
        --warning: #f1c46d;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font: 16px/1.55 "Segoe UI", "Noto Sans", Arial, sans-serif;
    }
    a { color: var(--accent); }
    code {
      font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      font-size: .88em;
      overflow-wrap: anywhere;
    }
    .page { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 64px; }
    .masthead {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(220px, .7fr);
      gap: 28px;
      align-items: stretch;
      min-height: 360px;
    }
    .intro, .score, section {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
    }
    .intro { padding: clamp(28px, 5vw, 60px); display: flex; flex-direction: column; justify-content: space-between; }
    .kicker {
      margin: 0 0 18px;
      color: var(--accent);
      font: 700 12px/1.2 "Cascadia Code", Consolas, monospace;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    h1 { margin: 0; max-width: 16ch; font-size: clamp(38px, 6vw, 72px); line-height: .98; letter-spacing: -.045em; }
    .lede { max-width: 62ch; margin: 28px 0 0; color: var(--muted); font-size: 18px; }
    .score { padding: 28px; display: grid; align-content: space-between; }
    .score strong { display: block; font-size: clamp(70px, 11vw, 128px); line-height: .9; letter-spacing: -.07em; }
    .score .unit { color: var(--muted); font-size: 20px; }
    .score p { margin: 22px 0 0; font-weight: 650; }
    .metrics {
      margin: 22px 0 0;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      background: var(--line);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .metric { background: var(--surface); padding: 24px; }
    .metric strong { display: block; font-size: 28px; line-height: 1.1; }
    .metric span { color: var(--muted); font-size: 13px; }
    section { margin-top: 22px; padding: clamp(24px, 4vw, 42px); }
    h2 { margin: 0 0 8px; font-size: clamp(25px, 3vw, 38px); letter-spacing: -.025em; }
    .section-copy { margin: 0 0 24px; color: var(--muted); max-width: 68ch; }
    details.finding { border-top: 1px solid var(--line); }
    details.finding:last-child { border-bottom: 1px solid var(--line); }
    summary {
      cursor: pointer;
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr) 88px;
      gap: 14px;
      align-items: center;
      padding: 17px 4px;
    }
    summary:hover { color: var(--accent); }
    .status, .severity {
      font: 700 11px/1 "Cascadia Code", Consolas, monospace;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .finding-fail .status { color: var(--danger); }
    .finding-warn .status { color: var(--warning); }
    .finding-pass .status { color: var(--accent); }
    .severity { color: var(--muted); text-align: right; }
    .finding-body { padding: 0 100px 18px; color: var(--muted); }
    .finding-body ul { padding-left: 20px; }
    .repair { color: var(--ink); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 13px 15px; text-align: left; border-bottom: 1px solid var(--line); }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    tr:last-child td { border-bottom: 0; }
    .request-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .request { border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; background: var(--surface-strong); }
    .request p { margin: 12px 0; color: var(--muted); }
    .request small { color: var(--muted); }
    .request-id { color: var(--accent); font: 700 11px/1 "Cascadia Code", Consolas, monospace; margin-right: 10px; }
    .carrier { display: grid; grid-template-columns: minmax(180px, 260px) minmax(0, 1fr); gap: 32px; align-items: center; }
    .carrier svg { width: 100%; height: auto; background: #ffffff; border-radius: var(--radius); padding: 10px; }
    .source-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 22px; padding: 0; list-style: none; }
    .source-list li { padding-top: 12px; border-top: 1px solid var(--line); }
    .fine-print { margin-top: 20px; color: var(--muted); font-size: 13px; }
    .empty { color: var(--muted); }
    @media (max-width: 760px) {
      .page { width: min(100% - 20px, 1180px); padding-top: 10px; }
      .masthead, .carrier { grid-template-columns: 1fr; min-height: 0; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .request-grid, .source-list { grid-template-columns: 1fr; }
      summary { grid-template-columns: 68px minmax(0, 1fr); }
      .severity { display: none; }
      .finding-body { padding: 0 4px 16px; }
    }
    @media print {
      :root { --page: #ffffff; --surface: #ffffff; --surface-strong: #ffffff; --ink: #111111; --muted: #444444; --line: #bbbbbb; --accent: #076755; }
      .page { width: 100%; padding: 0; }
      section, .metrics { break-inside: avoid; }
      details > * { display: block; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="masthead">
      <header class="intro">
        <div>
          <p class="kicker">DPP Preflight evidence report</p>
          <h1>${htmlEscape(product.name ?? "Unnamed product")}</h1>
        </div>
        <p class="lede">${htmlEscape(status)}. This report maps source evidence before product-specific compliance validation.</p>
      </header>
      <aside class="score" aria-label="Readiness score">
        <div>
          <strong>${htmlEscape(evaluation.score)}</strong>
          <span class="unit">out of 100</span>
        </div>
        <p>${htmlEscape(status)}</p>
      </aside>
    </div>

    <div class="metrics" aria-label="Report summary">
      <div class="metric"><strong>${htmlEscape(dataset.components.length)}</strong><span>BOM components</span></div>
      <div class="metric"><strong>${htmlEscape(inspectedEvidence.length)}</strong><span>Evidence records</span></div>
      <div class="metric"><strong>${htmlEscape(criticalCount)}</strong><span>Critical gaps</span></div>
      <div class="metric"><strong>${htmlEscape(componentMass)} g</strong><span>Mapped component mass</span></div>
    </div>

    <section>
      <h2>What the rule pack found</h2>
      <p class="section-copy">Failures are ordered first. Open each row for the source owner and a concrete repair action.</p>
      ${renderFindings(evaluation.findings)}
    </section>

    <section>
      <h2>Evidence ledger</h2>
      <p class="section-copy">Hashes are computed from local files. They prove byte consistency, not who authored a document.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Owner</th><th>File</th><th>Date</th><th>SHA-256</th></tr></thead>
          <tbody>${renderEvidence(inspectedEvidence)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Requests by source owner</h2>
      <p class="section-copy">The CSV export contains every request. This view shows the first twelve for rapid triage.</p>
      <div class="request-grid">${renderRequests(requests)}</div>
    </section>

    <section class="carrier">
      <div>${qrSvg}</div>
      <div>
        <h2>Data carrier draft</h2>
        <p class="section-copy">The QR encodes the configured persistent URI. Scan it, then verify resolver behavior before printing packaging.</p>
        <code>${htmlEscape(product.dataCarrier?.uri ?? product.passportUrl ?? "")}</code>
      </div>
    </section>

    <section>
      <h2>Scope and authority</h2>
      <p class="section-copy">${htmlEscape(rulePack.metadata.disclaimer)}</p>
      <ul class="source-list">
        ${rulePack.metadata.sources
          .map(
            (source) =>
              `<li><a href="${htmlEscape(source.url)}">${htmlEscape(source.title)}</a><br><small>${htmlEscape(source.retrieved)}</small></li>`,
          )
          .join("")}
      </ul>
      <p class="fine-print">Rule pack ${htmlEscape(rulePack.metadata.id)} ${htmlEscape(rulePack.metadata.version)}. Analysis timestamp ${htmlEscape(asOf)}.</p>
    </section>
  </main>
</body>
</html>
`;
}
