// backend/email/templates.js
// The email IS the product.
// Clean, urgent, credible. One number. One cause. One fix.

function buildEmailHTML(report, customer) {
  const name = customer.company || customer.email.split('@')[0]
  const topEndpoint = report.primary_cause

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fluxera Revenue Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; }
  .header { background: #09090b; padding: 28px 36px; }
  .logo { color: #ffffff; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; }
  .logo span { color: #ff3b3b; }
  .hero { background: #09090b; padding: 40px 36px 48px; border-top: 1px solid #1c1c1e; }
  .hero-label { font-size: 11px; color: #6b6b8a; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 16px; font-family: 'Courier New', monospace; }
  .hero-amount { font-size: 64px; font-weight: 800; color: #ff3b3b; line-height: 1; letter-spacing: -0.03em; }
  .hero-sub { font-size: 13px; color: #6b6b8a; margin-top: 12px; font-family: 'Courier New', monospace; }
  .section { padding: 32px 36px; border-bottom: 1px solid #f0f0f0; }
  .section-label { font-size: 10px; font-weight: 600; color: #a0a0a0; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 16px; font-family: 'Courier New', monospace; }
  .section-title { font-size: 18px; font-weight: 700; color: #09090b; margin-bottom: 8px; }
  .section-body { font-size: 14px; color: #52525b; line-height: 1.7; }
  .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f5; }
  .stat-label { font-size: 13px; color: #71717a; }
  .stat-value { font-size: 13px; font-weight: 600; color: #09090b; font-family: 'Courier New', monospace; }
  .stat-value.red { color: #ff3b3b; }
  .endpoint-row { background: #fafafa; border: 1px solid #f0f0f0; padding: 16px 20px; margin-bottom: 8px; }
  .ep-name { font-size: 13px; font-weight: 600; color: #09090b; font-family: 'Courier New', monospace; margin-bottom: 6px; }
  .ep-stats { display: flex; gap: 20px; }
  .ep-stat { font-size: 12px; color: #71717a; }
  .ep-stat span { font-weight: 600; color: #09090b; }
  .ep-stat span.red { color: #ff3b3b; }
  .fix-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 3px solid #22c55e; padding: 20px 24px; }
  .fix-label { font-size: 10px; font-weight: 600; color: #16a34a; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px; font-family: 'Courier New', monospace; }
  .fix-action { font-size: 14px; color: #166534; line-height: 1.6; margin-bottom: 10px; }
  .fix-recovery { font-size: 13px; color: #16a34a; font-weight: 600; }
  .math-box { background: #fafafa; border: 1px solid #e4e4e7; padding: 16px 20px; font-family: 'Courier New', monospace; }
  .math-line { font-size: 12px; color: #71717a; line-height: 2; }
  .math-line.result { color: #ff3b3b; font-weight: 600; font-size: 13px; border-top: 1px solid #e4e4e7; padding-top: 8px; margin-top: 4px; }
  .footer { padding: 24px 36px; background: #fafafa; }
  .footer-text { font-size: 11px; color: #a1a1aa; line-height: 1.7; }
  .footer-link { color: #3b82f6; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="logo">FLUXERA <span>TECHNOLOGIES</span></div>
  </div>

  <!-- HERO — THE NUMBER -->
  <div class="hero">
    <div class="hero-label">// Revenue lost — last 24 hours</div>
    <div class="hero-amount">${report.revenue_lost_formatted}</div>
    <div class="hero-sub">
      ${report.failed_requests.toLocaleString()} failed requests ×
      ${report.transparency.avg_price} avg price
    </div>
  </div>

  <!-- PRIMARY CAUSE -->
  ${topEndpoint ? `
  <div class="section">
    <div class="section-label">// Primary Cause</div>
    <div class="section-title">${topEndpoint.pct_of_total}% of loss from ${topEndpoint.endpoint}</div>
    <div class="section-body">
      ${topEndpoint.failed.toLocaleString()} failed requests
      ${topEndpoint.top_error ? `· Issue: <strong>${topEndpoint.top_error}</strong>` : ''}
      · ${topEndpoint.failure_rate}% failure rate
    </div>
  </div>
  ` : ''}

  <!-- STATS -->
  <div class="section">
    <div class="section-label">// 24h Summary</div>
    <div class="stat-row">
      <div class="stat-label">Total requests</div>
      <div class="stat-value">${report.total_requests.toLocaleString()}</div>
    </div>
    <div class="stat-row">
      <div class="stat-label">Failed requests</div>
      <div class="stat-value red">${report.failed_requests.toLocaleString()}</div>
    </div>
    <div class="stat-row">
      <div class="stat-label">Failure rate</div>
      <div class="stat-value red">${report.failure_rate}%</div>
    </div>
    <div class="stat-row">
      <div class="stat-label">Revenue lost (24h)</div>
      <div class="stat-value red">${report.revenue_lost_formatted}</div>
    </div>
    <div class="stat-row" style="border-bottom:none">
      <div class="stat-label">Projected monthly loss</div>
      <div class="stat-value red">${report.monthly_projection}</div>
    </div>
  </div>

  <!-- ENDPOINTS -->
  <div class="section">
    <div class="section-label">// Breakdown by endpoint</div>
    ${report.endpoints.map(ep => `
    <div class="endpoint-row">
      <div class="ep-name">${ep.name}</div>
      <div class="ep-stats">
        <div class="ep-stat">Failed: <span class="red">${ep.failed.toLocaleString()}</span></div>
        <div class="ep-stat">Rate: <span class="red">${ep.failure_rate}%</span></div>
        <div class="ep-stat">Lost: <span class="red">${ep.lost}</span></div>
      </div>
    </div>
    `).join('')}
  </div>

  <!-- THE FIX -->
  ${report.fix ? `
  <div class="section">
    <div class="section-label">// Recommended Fix</div>
    <div class="fix-box">
      <div class="fix-label">⚡ Action</div>
      <div class="fix-action">${report.fix.action}</div>
      <div class="fix-recovery">Potential recovery: ${report.fix.recoverable}/day</div>
    </div>
  </div>
  ` : ''}

  <!-- TRANSPARENCY — THE MATH -->
  <div class="section">
    <div class="section-label">// How we calculated this</div>
    <div class="math-box">
      <div class="math-line">formula:   ${report.transparency.formula}</div>
      <div class="math-line">failures:  ${report.transparency.failed_requests.toLocaleString()}</div>
      <div class="math-line">avg_price: ${report.transparency.avg_price}</div>
      <div class="math-line result">result:    ${report.transparency.result}</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-text">
      This report was generated by Fluxera Technologies for ${name}.<br>
      fluxeratechnologies.ai · <a href="mailto:support@fluxeratechnologies.ai" class="footer-link">support@fluxeratechnologies.ai</a><br><br>
      You're receiving this because you installed the Fluxera SDK.
      <a href="#" class="footer-link">Unsubscribe</a>
    </div>
  </div>

</div>
</body>
</html>`
}

function buildEmailText(report, customer) {
  const name = customer.company || customer.email
  const top  = report.primary_cause

  return `
FLUXERA TECHNOLOGIES — DAILY REVENUE REPORT
============================================

${name} · ${new Date().toDateString()}

REVENUE LOST (LAST 24H): ${report.revenue_lost_formatted}
Projected monthly: ${report.monthly_projection}

${top ? `PRIMARY CAUSE
${top.pct_of_total}% of loss from ${top.endpoint}
Failed requests: ${top.failed.toLocaleString()}${top.top_error ? ` · Error: ${top.top_error}` : ''}
Failure rate: ${top.failure_rate}%` : ''}

24H SUMMARY
Total requests:   ${report.total_requests.toLocaleString()}
Failed requests:  ${report.failed_requests.toLocaleString()}
Failure rate:     ${report.failure_rate}%
Revenue lost:     ${report.revenue_lost_formatted}

ENDPOINTS
${report.endpoints.map(ep => `${ep.name} — ${ep.failed} failed (${ep.failure_rate}%) — ${ep.lost} lost`).join('\n')}

${report.fix ? `RECOMMENDED FIX
${report.fix.action}
Potential recovery: ${report.fix.recoverable}/day` : ''}

HOW WE CALCULATED THIS
Formula: ${report.transparency.formula}
Failed requests: ${report.transparency.failed_requests.toLocaleString()}
Avg price: ${report.transparency.avg_price}
Result: ${report.transparency.result}

---
Fluxera Technologies — fluxeratechnologies.ai
`.trim()
}

module.exports = { buildEmailHTML, buildEmailText }
