import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './fixtures.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TOUR_ORIGIN || 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Record only a local build');
const output = path.resolve('output/tours');
await mkdir(output, { recursive: true });
const plans = [
  { slug: 'live-monitoring', title: 'Live monitoring', steps: [
    ['/app', 'Start with service health, queue backlog, and pending approvals.'],
    ['/app/executions', 'Inspect the execution stream across connected work.'],
    ['/app/executions/tour-checkout', 'Open a failed execution to inspect its completed steps and checkpoint.'],
  ] },
  { slug: 'approved-recovery', title: 'Human-approved recovery', steps: [
    ['/app/approvals', 'Review the recovery request and its configured destination.'],
    ['approve', 'An authorized person approves. Dispatch is queued; success is not yet verified.'],
    ['/app/audit', 'The audit trail records the decision. Linked SDK evidence is required for verification.'],
  ] },
  { slug: 'cost-intelligence', title: 'Cost intelligence', steps: [
    ['/app', 'Start with the cost exposure associated with failed work.'],
    ['/app/cost', 'Separate observed cost from retry waste and estimated avoidable cost.'],
    ['/app/executions', 'Inspect individual execution costs. Estimates are not realized savings.'],
  ] },
  { slug: 'five-layer-integrations', title: 'Five-layer integrations', steps: [
    ['/app/integrations', 'Connect recovery receivers with explicit idempotency-key support.'],
    ['/app/executions', 'Agents, APIs, workflows, tools, and memory feed the same execution system.'],
    ['/app/executions/tour-checkout', 'Use execution lineage and checkpoints to understand what failed.'],
  ] },
];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const plan of plans) {
    let approved = false;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: output, size: { width: 1280, height: 800 } } });
    await context.addInitScript(() => {
      localStorage.setItem('fluxera_session', JSON.stringify({ dashboardToken: 'synthetic-recording-only', workspaceId: 'tour', company: 'Illustrative synthetic data', role: 'approver' }));
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        if (String(input).includes('/api/live?')) {
          let timer;
          const body = new ReadableStream({ start(controller) {
            const send = () => controller.enqueue(new TextEncoder().encode('event: heartbeat\ndata: {}\n\n'));
            send(); timer = setInterval(send, 1000);
            options?.signal?.addEventListener('abort', () => { clearInterval(timer); controller.close(); }, { once: true });
          }, cancel() { clearInterval(timer); } });
          return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
        }
        return originalFetch(input, options);
      };
    });
    await context.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/approve')) { approved = true; await route.fulfill({ json: { recovery_request: { status: 'approved' } } }); return; }
      await route.fulfill({ json: fixture(pathname, approved) });
    });
    const page = await context.newPage();
    const captions = [];
    const begin = Date.now();
    for (let i = 0; i < plan.steps.length; i++) {
      const [destination, caption] = plan.steps[i];
      if (destination === 'approve') await page.getByRole('button', { name: 'Approve', exact: true }).click();
      else {
        if (i === 0) await page.goto(origin + destination);
        else await page.locator(`a[href="${destination}"]`).first().click();
        await page.locator('.site-loader').waitFor({ state: 'detached' });
        await page.locator('.loading-state').waitFor({ state: 'detached' });
        await page.evaluate(({ title, index }) => {
          document.getElementById('recording-label')?.remove();
          const banner = document.createElement('div');
          banner.id = 'recording-label';
          banner.textContent = `${title} · ${index + 1} / 3 — Illustrative synthetic data`;
          banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#111;color:#f3eee3;padding:14px 24px;font:14px system-ui;z-index:10000;border-top:3px solid #d9541e';
          document.body.append(banner);
        }, { title: plan.title, index: i });
      }
      await page.locator('#recording-label').evaluate((banner, label) => { banner.textContent = label; }, `${plan.title} · ${i + 1} / 3 — Illustrative synthetic data`);
      const start = (Date.now() - begin) / 1000;
      captions.push({ start, end: start + 5, text: caption });
      await page.mouse.move(750, 350, { steps: 20 });
      await page.waitForTimeout(5000); // Deliberate reading time in the recorded walkthrough.
      if (i === 0) await page.screenshot({ path: path.join(output, `${plan.slug}.png`) });
    }
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(output, `${plan.slug}.webm`));
    await writeFile(path.join(output, `${plan.slug}.json`), JSON.stringify({ ...plan, captions }, null, 2));
    console.log(`Recorded ${plan.slug}`);
  }
} finally { await browser.close(); }
