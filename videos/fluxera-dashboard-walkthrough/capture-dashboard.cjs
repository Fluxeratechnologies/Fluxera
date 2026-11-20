const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const out = path.join(__dirname, 'capture');
mkdirSync(out, { recursive: true });

(async () => {
  const fixture = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/playground/simulator.js')).href);
  let state = fixture.simulator(fixture.initialState(), { type: 'start' });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('fluxera_session', JSON.stringify({ dashboardToken: 'illustrative-session', workspaceId: 'synthetic-workspace', company: 'Acme Pilot', role: 'admin' }));
    localStorage.setItem('fluxera_analytics_consent', 'denied');
    localStorage.setItem('fluxera-theme', 'light');
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      if (new URL(typeof input === 'string' ? input : input.url, location.href).pathname === '/api/live') {
        return Promise.resolve(new Response(new ReadableStream({
          start(controller) { controller.enqueue(new TextEncoder().encode('event: heartbeat\ndata: {}\n\n')); },
        }), { status: 200, headers: { 'content-type': 'text/event-stream' } }));
      }
      return originalFetch(input, options);
    };
  });
  await context.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/live') return route.fulfill({ contentType: 'text/event-stream', body: 'event: heartbeat\ndata: {}\n\n' });
    const data = fixture.snapshot(state);
    let response = data;
    if (pathname === '/api/operations') response = data.operations;
    else if (pathname === '/api/recovery-requests') response = { recovery_requests: data.recovery_requests };
    else if (pathname.endsWith('/approve')) {
      state = fixture.simulator(state, { type: 'decide', decision: 'approve' });
      response = { recovery_request: fixture.snapshot(state).recovery_requests[0] };
    } else if (pathname === '/api/console/executions') response = { executions: data.executions };
    else if (pathname.startsWith('/api/console/executions/')) response = fixture.executionDetail(state, pathname.split('/').at(-1));
    else if (pathname === '/api/console/cost') response = { cost: data.cost };
    else if (pathname === '/api/console/audit') response = { events: data.events };
    else if (pathname === '/api/integrations') response = { integrations: [{ id: 'synthetic-receiver', name: 'Acme recovery receiver', webhook_url: 'https://example.invalid/fluxera/recovery', supports_idempotency_key: true, active: true }] };
    else if (pathname === '/api/console/settings') response = { settings: { interrupt_after_minutes: 15 } };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });
  const page = await context.newPage();
  const shot = async (name, route) => {
    await page.goto(`http://127.0.0.1:5173${route}`);
    await page.locator('.site-loader').waitFor({ state: 'detached', timeout: 12000 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(name, route);
  };
  await shot('01-command-center', '/app');
  await shot('02-executions', '/app/executions');
  await shot('03-execution-detail', '/app/executions/demo-workflow');
  await shot('04-approval-inbox', '/app/approvals');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, '05-approved.png') });
  state = fixture.simulator(state, { type: 'advance', from: 'approved' });
  state = fixture.simulator(state, { type: 'advance', from: 'dispatching' });
  await shot('06-recovery-dispatched', '/app/recoveries');
  state = fixture.simulator(state, { type: 'advance', from: 'dispatched' });
  await shot('07-verified', '/app/recoveries');
  await shot('08-audit', '/app/audit');
  await shot('09-cost', '/app/cost');
  await shot('10-integrations', '/app/integrations');
  await shot('11-final-command', '/app');
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
