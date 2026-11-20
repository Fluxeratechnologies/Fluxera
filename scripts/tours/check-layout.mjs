import { mkdir, writeFile } from 'node:fs/promises';
import { fixture } from './fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('fluxera_session', JSON.stringify({dashboardToken:'layout-fixture',workspaceId:'tour',company:'Layout fixture',role:'viewer'})));
  await context.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ json: pathname === '/api/live' ? {} : fixture(pathname, false) });
  });
  const page = await context.newPage();
  for (const width of [320, 390, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const pathname of ['/app', '/app/approvals', '/app/executions', '/app/integrations', '/app/cost', '/tours']) {
      await page.goto('http://127.0.0.1:5173' + pathname);
      await page.locator('.site-loader').waitFor({state:'detached'});
      await page.locator('.loading-state').waitFor({state:'detached'});
      results.push(await page.evaluate(() => ({ path: location.pathname, width: innerWidth, actual: document.documentElement.scrollWidth })));
    }
  }
  await mkdir('output/playwright', {recursive:true});
  await writeFile('output/playwright/responsive-console.json', JSON.stringify(results,null,2));
  const failures = results.filter(r => r.actual > r.width);
  console.log(JSON.stringify({ checks:results.length, failures }));
  if (failures.length) process.exitCode = 1;
} finally { await browser.close(); }
