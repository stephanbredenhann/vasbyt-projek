import { test, expect, chromium, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const demoUrl = process.env['DEMO_URL'] ?? 'http://127.0.0.1:5080';
const adminEmail = process.env['DEMO_ADMIN_EMAIL'] ?? 'demo@vasbyt.local';
const adminPassword = process.env['DEMO_ADMIN_PASSWORD'] ?? 'VasbytDemo2027!';
async function admin(page: Page) {
  await page.goto('/teken-aan');
  await page.locator('[name=email]').fill(adminEmail);
  await page.locator('[name=password]').fill(adminPassword);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeEach(async ({ request }) => {
  expect((await (await request.get('/api/config')).json()).demoContent,
    'Run these tests against the isolated demo database with Demo__Enabled=true').toBe(true);
});

test('registration, account passes, uploaded QR, manual fallback, check-in and live camera', async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const email = `browser${Date.now()}@example.test`;
  await page.goto('/registreer');
  const more = page.locator('.route').first().getByRole('button', { name: 'Een meer', exact: true }).first();
  await more.click();
  await more.click();
  await expect(page.locator('.route input.stepper__value').first()).toHaveValue('2');
  await page.getByRole('button', { name: 'Gaan voort', exact: true }).click();
  await page.locator('button.product').first().click();
  await page.getByRole('button', { name: 'Een meer', exact: true }).first().click();
  await page.locator('dialog').getByRole('button', { name: 'Klaar', exact: true }).click();
  await page.getByRole('button', { name: 'Gaan voort', exact: true }).click();
  await page.locator('input[type=number]').fill('100');
  await page.getByRole('button', { name: 'Gaan voort', exact: true }).click();
  for (const [name, value] of Object.entries({ firstName: 'Anna', lastName: 'Demo', email, phone: '0000000000' }))
    await page.locator(`input[name=${name}]`).fill(value);
  const saved = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await page.locator('form button[type=submit]').click();
  const order = await (await saved).json();
  await expect(page.locator('.reference')).toHaveText(order.reference);
  await page.getByRole('button', { name: 'Gaan na betaling', exact: true }).click();
  await expect(page).toHaveURL(/\/registreer\/betaal$/);
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Betaal');
  await page.getByRole('button', { name: 'Betaal nou', exact: true }).click();
  for (const firstName of ['Anna', 'Ben']) {
    await expect(page.locator('form')).toBeVisible();
    for (const [name, value] of Object.entries({ firstName, lastName: 'Demo', idNumber: '9001010000000',
      dateOfBirth: '1990-01-01', email, phone: '0000000000', streetAddress: '1 Voorbeeldstraat',
      town: 'Orania', postalCode: '8752', medicalConditions: 'Voorbeeldallergie',
      emergencyName: 'Celia Demo', emergencyRelationship: 'Familie', emergencyPhone: '0000000000' }))
      await page.locator(`[name=${name}]`).fill(value);
    await page.locator('[name=gender]').selectOption('V');
    await page.locator('[name=shirtSize]').selectOption('M');
    await page.locator('[name=province]').selectOption('Noord-Kaap');
    await page.locator('[name=acceptTerms]').check();
    await page.getByRole('button', { name: 'Stoor deelnemer', exact: true }).click();
    if (firstName === 'Anna') await expect(page).toHaveURL(/\/deelnemer\/2$/);
  }
  await expect(page).toHaveURL(/\/klaar$/);
  await expect(page.locator('vb-qr-pass img')).toHaveCount(2);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Laai QR-kode af', exact: true }).first().click();
  const png = info.outputPath('participant-pass.png');
  await (await download).saveAs(png);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('registration-done.png'), fullPage: true });
  await page.locator('input[name=password]').fill('DemoParticipant2027!');
  await page.getByRole('button', { name: 'Skep rekening', exact: true }).click();
  await page.getByRole('link', { name: 'Gaan na my rekening', exact: true }).click();
  await expect(page.locator('vb-qr-pass img')).toHaveCount(2);
  await expect(page.locator('.status--paid')).toBeVisible();
  const complete = await (await page.request.get(`/api/orders/${order.token}`)).json();
  expect(complete.entrants[0].qrPayload).not.toEqual(complete.entrants[1].qrPayload);
  const anonymous = await browser.newContext();
  expect((await anonymous.request.post(`${demoUrl}/api/admin/scan`, { data: { code: complete.entrants[0].qrPayload } })).status()).toBe(401);
  await anonymous.close();
  const context = await browser.newContext({ baseURL: demoUrl });
  const reception = await context.newPage(); reception.on('pageerror', e => errors.push(e.message));
  await admin(reception);
  await reception.locator('.tabs').getByRole('button', { name: 'Skandeer QR', exact: true }).click();
  await reception.locator('input[type=file]').setInputFiles(png);
  await expect(reception.locator('.participant h2')).toHaveText('Anna Demo');
  await expect(reception.locator('.emergency')).toContainText('Celia Demo');
  await reception.locator('summary').click();
  await expect(reception.getByText('Voorbeeldallergie', { exact: true })).toBeVisible();
  await reception.getByRole('button', { name: 'Teken aankoms aan', exact: true }).click();
  await expect(reception.locator('.arrival')).toContainText('Reeds aangemeld');
  const arrived = await (await reception.request.post('/api/admin/scan', { data: { code: complete.entrants[0].entryNumber } })).json();
  await reception.getByRole('button', { name: 'Volgende deelnemer', exact: true }).click();
  await reception.locator('[name=code]').fill(complete.entrants[0].entryNumber);
  await reception.getByRole('button', { name: 'Vind deelnemer', exact: true }).click();
  await expect(reception.locator('.arrival')).toContainText('Reeds aangemeld');
  const again = await (await reception.request.post(`/api/admin/entrants/${arrived.id}/check-in`)).json();
  expect(again.checkedInUtc).toEqual(arrived.checkedInUtc);
  await reception.locator('[name=code]').fill('VB2027-9999999');
  await reception.getByRole('button', { name: 'Vind deelnemer', exact: true }).click();
  await expect(reception.getByRole('alert')).toBeVisible();
  await expect(reception.locator('.participant')).toHaveCount(0);
  await reception.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
  await reception.getByRole('button', { name: 'Gebruik kamera', exact: true }).click();
  await expect(reception.getByRole('alert')).toContainText('kamera is nie beskikbaar');
  await reception.locator('[name=code]').fill(complete.entrants[1].entryNumber);
  await reception.getByRole('button', { name: 'Vind deelnemer', exact: true }).click();
  await expect(reception.locator('.participant h2')).toHaveText('Ben Demo');
  await reception.evaluate(() => scrollTo(0, 0));
  await reception.screenshot({ path: info.outputPath('admin-scan.png'), fullPage: true });
  await reception.setViewportSize({ width: 390, height: 844 });
  expect(await reception.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await reception.evaluate(() => scrollTo(0, 0));
  await reception.screenshot({ path: info.outputPath('admin-scan-mobile.png'), fullPage: true });
  if (process.env['TEST_CAMERA'] === 'true') {
    const video = info.outputPath('qr-camera.y4m');
    execFileSync('ffmpeg', ['-y', '-loop', '1', '-i', png, '-vf', 'scale=500:500,pad=900:900:200:200:white',
      '-t', '2', '-r', '10', '-pix_fmt', 'yuv420p', video], { stdio: 'ignore' });
    const cameraBrowser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
    const cameraContext = await cameraBrowser.newContext({ baseURL: demoUrl, storageState: await context.storageState() });
    await cameraContext.addInitScript(() => {
      const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (window as any).testStreams = [];
      navigator.mediaDevices.getUserMedia = async constraints => {
        const stream = await get(constraints); (window as any).testStreams.push(stream); return stream;
      };
    });
    const camera = await cameraContext.newPage(); camera.on('pageerror', e => errors.push(e.message));
    await camera.goto('/admin');
    await camera.locator('.tabs').getByRole('button', { name: 'Skandeer QR', exact: true }).click();
    await camera.getByRole('button', { name: 'Gebruik kamera', exact: true }).click();
    await expect(camera.locator('.participant h2')).toHaveText('Anna Demo', { timeout: 20_000 });
    expect(await camera.evaluate(() => (window as any).testStreams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
    await camera.getByRole('button', { name: 'Gebruik kamera', exact: true }).click();
    await camera.locator('.tabs').getByRole('button', { name: 'Program', exact: true }).click();
    await expect(camera.locator('vb-admin-scan')).toHaveCount(0);
    await expect.poll(() => camera.evaluate(() => (window as any).testStreams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
    await cameraBrowser.close();
  }
  await context.close(); expect(errors).toEqual([]);
});

test('programme edits persist bilingually and reordered fields remain separate', async ({ page }) => {
  await admin(page);
  const original = await (await page.request.get('/api/programme')).json();
  try {
    await page.locator('.tabs').getByRole('button', { name: 'Program', exact: true }).click();
    const day = page.locator('.day-editor').first();
    const activities = day.locator('.activity');
    await activities.nth(1).getByRole('button', { name: 'Skuif op', exact: true }).click();
    await expect(activities.nth(0).locator('.field-row input').nth(0)).toHaveValue(original[0].entries[1].titleAf);
    await expect(activities.nth(1).locator('.field-row input').nth(0)).toHaveValue(original[0].entries[0].titleAf);
    await activities.nth(0).locator('.field-row input').nth(0).fill('Demonstrasie-opening');
    await activities.nth(0).locator('.field-row input').nth(1).fill('Demo opening');
    await page.locator('.tabs').getByRole('button', { name: 'Skandeer QR', exact: true }).click();
    await page.locator('.tabs').getByRole('button', { name: 'Program', exact: true }).click();
    await expect(activities.nth(0).locator('.field-row input').nth(0)).toHaveValue('Demonstrasie-opening');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await day.getByRole('button', { name: 'Voeg aktiwiteit by', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stoor program', exact: true })).toBeDisabled();
    await activities.last().getByRole('button', { name: 'Verwyder aktiwiteit', exact: true }).click();
    await page.getByRole('button', { name: 'Stoor program', exact: true }).click();
    await expect(page.locator('.save-bar')).toContainText('Die program is gestoor');
    await page.goto('/program');
    await expect(page.getByText('Demonstrasie-opening', { exact: true }).first()).toBeVisible();
    await page.locator('.hamburger').click();
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
    await expect(page.getByText('Demo opening', { exact: true }).first()).toBeVisible();
    await page.locator('.hamburger').click();
    await page.getByRole('button', { name: 'Skakel na Afrikaans', exact: true }).click();
  } finally {
    expect((await page.request.put('/api/admin/programme', { data: original })).ok()).toBe(true);
  }
});

test('a route card opens the interactive map with a linked height profile', async ({ page }) => {
  await page.goto('/roetes');
  await page.getByRole('button', { name: /Vastrap$/ }).click();
  const dialog = page.locator('dialog.explore');
  await expect(dialog.locator('.leaflet-container')).toBeVisible();
  await dialog.getByRole('tab', { name: /Dag 2/ }).click();
  await expect(dialog.getByRole('tab', { name: /Dag 2/ })).toHaveAttribute('aria-selected', 'true');
  const profile = dialog.locator('vb-elevation-profile svg');
  const box = (await profile.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(dialog.locator('path.leaflet-interactive')).toHaveCount(4); // line, start, finish, marker
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('public pages and demo navigation fit a phone and a desktop', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const width of [390, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/roetes', '/program', '/skenk', '/verblyf', '/borge', '/oor-helpmekaar']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} width ${width}`).toBe(true);
      await page.evaluate(async () => {
        const images = [...document.images]; images.forEach(i => i.loading = 'eager');
        await Promise.all(images.map(i => i.decode().catch(() => {})));
      });
      expect(await page.locator('img').evaluateAll(images => images.filter(i => !(i as HTMLImageElement).naturalWidth).map(i => (i as HTMLImageElement).src))).toEqual([]);
      if (route === '/' || route === '/skenk') await page.screenshot({ path: info.outputPath(`${route === '/' ? 'home' : 'donate'}-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});
