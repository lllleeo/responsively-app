import {test, expect} from '../fixtures/electron-app';

test('mobile browser controls resize the guest without replacing it, including nested scrolling', async ({
  app,
  testServerUrl,
}) => {
  await app.dismissModals();
  await app.page.locator('[data-testid="layout-FLEX"]').click();
  await app.navigateTo(`${testServerUrl}/test-page.html`);
  const screen = app.page
    .locator('[data-scaled-frame]')
    .filter({has: app.page.locator('[data-browser-chrome="safari"]')})
    .first();
  const webview = screen.locator('webview');
  const bottom = screen.locator('.device-browser-bottom');
  // Reference extension's iPhone 12 Pro system header: 35px, 14px bold,
  // centered 27% side regions, Safari gray background and 10px solid glyphs.
  const status = screen.locator('.device-browser-status');
  await expect(status).toHaveCSS('height', '35px');
  await expect(status).toHaveCSS('font-size', '14px');
  await expect(status).toHaveCSS('font-weight', '700');
  await expect(screen.locator('.device-browser-top')).toHaveCSS(
    'background-color',
    'rgb(249, 249, 249)'
  );
  await expect(status.locator('svg').first()).toHaveCSS('height', '10px');
  await expect(bottom).toHaveAttribute('data-collapsed', 'false');
  const tablet = app.page.locator('[data-browser-profile="safari-tablet"]').first();
  await expect(tablet.locator('.device-browser-top')).toHaveCSS('height', '76px');
  await expect(tablet.locator('.device-browser-bottom')).toHaveCSS('height', '0px');
  await expect(
    tablet.locator('.device-browser-top').getByRole('button', {name: 'Go back in preview'})
  ).toBeVisible();
  const id = await webview.evaluate((el: Electron.WebviewTag) => el.getWebContentsId());
  const guest = (script: string) =>
    webview.evaluate((el: Electron.WebviewTag, code) => el.executeJavaScript(code), script);
  await expect.poll(() => guest('document.readyState')).toBe('complete');
  await expect.poll(() => guest('location.href')).toBe(`${testServerUrl}/test-page.html`);
  const initialHeight = await guest('window.innerHeight');
  const outerHeight = await screen.evaluate((el) => el.getBoundingClientRect().height);
  await guest('window.scrollTo(0, 500)');
  await expect(bottom).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(() => guest('window.innerHeight')).toBe(initialHeight + 110);
  expect(await screen.evaluate((el) => el.getBoundingClientRect().height)).toBe(outerHeight);
  expect(await webview.evaluate((el: Electron.WebviewTag) => el.getWebContentsId())).toBe(id);

  // One upward scroll after the resize must immediately restore the controls.
  await guest('window.scrollTo(0, 300)');
  await expect(bottom).toHaveAttribute('data-collapsed', 'false');
  await expect.poll(() => guest('window.innerHeight')).toBe(initialHeight);

  // At the page bottom the larger viewport clamps scrollTop. It must stay
  // collapsed instead of repeatedly expanding and collapsing itself.
  await guest('window.scrollTo(0, document.body.scrollHeight)');
  await expect(bottom).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(() => guest('window.innerHeight')).toBe(initialHeight + 110);
  await screen.getByRole('button', {name: 'Expand browser controls'}).click();
  await expect(bottom).toHaveAttribute('data-collapsed', 'false');
  await expect.poll(() => guest('window.innerHeight')).toBe(initialHeight);

  await guest(`window.scrollTo(0, 0);
    const container = document.createElement('div');
    container.id = 'nested-scroll';
    container.style.cssText = 'height:200px;overflow:auto';
    container.innerHTML = '<div style="height:2000px">Nested content</div>';
    document.body.prepend(container);`);
  await guest("document.getElementById('nested-scroll').scrollTop = 300");
  await expect(bottom).toHaveAttribute('data-collapsed', 'true');
  expect(await guest('window.scrollY')).toBe(0);
  await expect.poll(() => guest('window.innerHeight')).toBe(initialHeight + 110);
  await guest("document.getElementById('nested-scroll').scrollTop = 100");
  await expect(bottom).toHaveAttribute('data-collapsed', 'false');

  // Real navigation updates the per-device URL and history controls.
  const previousUrl = await guest('location.href');
  await webview.evaluate((el: Electron.WebviewTag) =>
    el.executeJavaScript("document.getElementById('nav-link').click()", true)
  );
  await expect.poll(() => guest('location.pathname')).toBe('/test-page-2.html');
  const back = screen.getByRole('button', {name: 'Go back in preview'});
  await expect(back).toBeEnabled();
  await back.click();
  await expect.poll(() => guest('location.href')).toBe(previousUrl);
  const forward = screen.getByRole('button', {name: 'Go forward in preview'});
  await expect(forward).toBeEnabled();
  await forward.click();
  await expect.poll(() => guest('location.pathname')).toBe('/test-page-2.html');
  await back.click();
  await expect.poll(() => guest('location.href')).toBe(previousUrl);

  // Rotation retains the same guest and keeps the page between the two bars.
  await app.page.locator('button[title="Rotate Devices"]').click();
  await expect.poll(() => guest('innerWidth > innerHeight')).toBe(true);
  expect(await webview.evaluate((el: Electron.WebviewTag) => el.getWebContentsId())).toBe(id);
  await app.page.locator('button[title="Rotate Devices"]').click();
  await expect.poll(() => guest('window.innerHeight')).toBe(initialHeight);
  await app.page.locator('[data-testid="layout-CANVAS"]').click();
  await expect.poll(() => guest('document.readyState')).toBe('complete');
  await guest('window.scrollTo(0, 0)');
  await expect(bottom).toHaveAttribute('data-collapsed', 'false');
  expect(await screen.evaluate((el) => el.scrollTop)).toBe(0);
  expect(await status.evaluate((el) => el.getBoundingClientRect().top)).toBeCloseTo(
    await screen.evaluate((el) => el.getBoundingClientRect().top),
    0
  );
  await app.page.screenshot({path: 'e2e/test-results/browser-chrome-expanded.png'});
  await guest('window.scrollTo(0, 500)');
  await expect(bottom).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(() => guest('window.innerHeight')).toBe(initialHeight + 110);
  await expect.poll(() => bottom.evaluate((el) => el.clientHeight)).toBe(0);
  await app.page.screenshot({path: 'e2e/test-results/browser-chrome-collapsed.png'});
  await app.page.screenshot({path: 'e2e/test-results/browser-chrome-canvas.png'});
});

test('Android, modern Safari and glass Safari use their own chrome and scroll geometry', async ({
  app,
  testServerUrl,
}) => {
  test.setTimeout(120_000);
  await app.dismissModals();
  await app.page.locator('[data-testid="layout-FLEX"]').click();
  // Select the new device before removing previous members: suites cannot be empty.
  await app.openDeviceManager();
  const selected = app.page.locator('[data-testid^="device-card-"][aria-pressed="true"]');
  const selectedIds = await selected.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid')!)
  );
  await app.closeDeviceManager();

  for (const profile of [
    {id: '20013', name: 'Pixel 5', family: 'chrome', status: 42, bottom: 0, gain: 53},
    {
      id: '10010',
      name: 'iPhone 14 Pro Max',
      family: 'safari-modern',
      status: 932 * 0.07,
      bottom: 128,
      gain: 80,
    },
    {
      id: '10019',
      name: 'iPhone 15',
      family: 'safari-glass',
      status: 852 * 0.066,
      bottom: 90,
      gain: 35,
    },
  ]) {
    await app.openDeviceManager();
    const search = app.page.locator('input[placeholder="Search devices…"]');
    await search.fill(profile.name);
    const card = app.page.locator(`[data-testid="device-card-${profile.id}"]`);
    await card.click();
    await search.fill('');
    const others = await app.page
      .locator('[data-testid^="device-card-"][aria-pressed="true"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!));
    for (const id of others.filter((id) => id !== `device-card-${profile.id}`))
      await app.page.locator(`[data-testid="${id}"]`).click();
    await app.closeDeviceManager();
    await app.page.locator('[data-testid="layout-CANVAS"]').click();
    await app.navigateTo(`${testServerUrl}/test-page.html`);
    const chrome = app.page.locator(`[data-browser-profile="${profile.family}"]`);
    const screen = app.page.locator('[data-scaled-frame]').filter({has: chrome});
    const guest = (script: string) =>
      screen
        .locator('webview')
        .evaluate((el: Electron.WebviewTag, code) => el.executeJavaScript(code), script);
    await expect.poll(() => guest('document.readyState')).toBe('complete');
    await expect.poll(() => guest('location.href')).toBe(`${testServerUrl}/test-page.html`);
    await expect.poll(() => guest('!!document.getElementById("nav-link")')).toBe(true);
    await guest('scrollTo(0, 0)');
    await expect.poll(() => guest('scrollY')).toBe(0);
    expect(
      await chrome
        .locator('.device-browser-status')
        .evaluate((el) => parseFloat(getComputedStyle(el).height))
    ).toBeCloseTo(profile.status, 1);
    await expect(chrome.locator('.device-browser-bottom')).toHaveCSS(
      'height',
      `${profile.bottom}px`
    );
    const initialHeight = await guest('innerHeight');
    await app.page.screenshot({path: `e2e/test-results/browser-chrome-${profile.family}.png`});
    await guest('scrollTo(0, 500)');
    await expect(chrome).toHaveAttribute('data-compact', 'true');
    await expect.poll(() => guest('innerHeight')).toBe(initialHeight + profile.gain);
    await app.page.screenshot({
      path: `e2e/test-results/browser-chrome-${profile.family}-collapsed.png`,
    });
    await guest('scrollTo(0, 200)');
    await expect(chrome).toHaveAttribute('data-compact', 'false');
    await expect.poll(() => guest('innerHeight')).toBe(initialHeight);
  }
  await app.openDeviceManager();
  for (const id of selectedIds) await app.page.locator(`[data-testid="${id}"]`).click();
  await app.page.locator('[data-testid="device-card-10019"]').click();
  await app.closeDeviceManager();
});

test('iPhone Duo folded and unfolded presets retain their guest through scrolling and rotation', async ({
  app,
  testServerUrl,
}) => {
  test.setTimeout(120_000);
  await app.dismissModals();
  await app.openDeviceManager();
  const selectedIds = await app.page
    .locator('[data-testid^="device-card-"][aria-pressed="true"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!));
  await app.closeDeviceManager();
  for (const variant of ['folded', 'unfolded'] as const) {
    const folded = variant === 'folded';
    const id = folded ? '10034' : '10035';
    await app.openDeviceManager();
    const search = app.page.locator('input[placeholder="Search devices…"]');
    await search.fill('iPhone Duo');
    await expect(app.page.locator('[data-testid="device-card-10034"]')).toBeVisible();
    await expect(app.page.locator('[data-testid="device-card-10035"]')).toBeVisible();
    await app.page.locator(`[data-testid="device-card-${id}"]`).click();
    await search.fill('');
    const others = await app.page
      .locator('[data-testid^="device-card-"][aria-pressed="true"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!));
    for (const other of others.filter((other) => other !== `device-card-${id}`))
      await app.page.locator(`[data-testid="${other}"]`).click();
    await app.closeDeviceManager();
    await app.page.locator('[data-testid="layout-CANVAS"]').click();
    await app.navigateTo(`${testServerUrl}/test-page.html`);
    const chrome = app.page.locator(`[data-browser-profile="safari-duo-${variant}"]`);
    const screen = app.page.locator('[data-scaled-frame]').filter({has: chrome});
    const webview = screen.locator('webview');
    const guest = (script: string) =>
      webview.evaluate((el: Electron.WebviewTag, code) => el.executeJavaScript(code), script);
    await expect.poll(() => guest('!!document.getElementById("nav-link")')).toBe(true);
    await guest('scrollTo(0, 0)');
    await expect.poll(() => guest('innerWidth')).toBe(folded ? 382 : 890);
    await expect.poll(() => guest('innerHeight')).toBe(folded ? 588 : 549);
    await expect
      .poll(() => guest('navigator.userAgent'))
      .toContain(folded ? 'iPhone OS 27_0' : 'Macintosh');
    const guestId = await webview.evaluate((el: Electron.WebviewTag) => el.getWebContentsId());
    await expect(app.page.locator(`[data-device-frame="iphone-duo-${variant}"]`)).toBeVisible();
    await app.page.screenshot({path: `e2e/test-results/iphone-duo-${variant}.png`});
    await guest('scrollTo(0, 400)');
    await expect(chrome).toHaveAttribute('data-compact', String(folded));
    await expect.poll(() => guest('innerHeight')).toBe(folded ? 623 : 549);
    await app.page.screenshot({path: `e2e/test-results/iphone-duo-${variant}-scrolled.png`});
    await guest('scrollTo(0, 0)');
    await expect.poll(() => guest('innerHeight')).toBe(folded ? 588 : 549);
    await app.page.locator('button[title="Rotate Devices"]').click();
    await expect.poll(() => guest('innerWidth')).toBe(folded ? 594 : 626);
    await expect.poll(() => guest('innerHeight')).toBe(folded ? 376 : 813);
    if (folded) {
      await expect(chrome).toHaveAttribute('data-rail-side', 'left');
      await expect(chrome.locator('.device-duo-rail')).toHaveCSS('width', '84px');
      await expect(screen.locator('[data-duo-camera]')).toBeVisible();
    }
    expect(await webview.evaluate((el: Electron.WebviewTag) => el.getWebContentsId())).toBe(
      guestId
    );
    await app.page.screenshot({path: `e2e/test-results/iphone-duo-${variant}-rotated.png`});
    await app.page.locator('button[title="Rotate Devices"]').click();
    await expect.poll(() => guest('innerWidth')).toBe(folded ? 382 : 890);
  }
  await app.openDeviceManager();
  for (const id of selectedIds) await app.page.locator(`[data-testid="${id}"]`).click();
  await app.page.locator('[data-testid="device-card-10035"]').click();
  await app.closeDeviceManager();
});

test('iPhone 18 presets have matching islands and preserve the viewport through scrolling and rotation', async ({
  app,
  testServerUrl,
}) => {
  test.setTimeout(120_000);
  await app.dismissModals();
  await app.openDeviceManager();
  const selectedIds = await app.page
    .locator('[data-testid^="device-card-"][aria-pressed="true"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!));
  await app.closeDeviceManager();
  for (const model of [
    {id: '10036', frame: 'iphone-18-pro', width: 402, height: 873},
    {id: '10037', frame: 'iphone-18-pro-max', width: 440, height: 956},
  ]) {
    await app.openDeviceManager();
    const search = app.page.locator('input[placeholder="Search devices…"]');
    await search.fill('iPhone 18');
    await expect(app.page.locator('[data-testid="device-card-10036"]')).toBeVisible();
    await expect(app.page.locator('[data-testid="device-card-10037"]')).toBeVisible();
    await app.page.locator(`[data-testid="device-card-${model.id}"]`).click();
    await search.fill('');
    const others = await app.page
      .locator('[data-testid^="device-card-"][aria-pressed="true"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!));
    for (const id of others.filter((id) => id !== `device-card-${model.id}`))
      await app.page.locator(`[data-testid="${id}"]`).click();
    await app.closeDeviceManager();
    await app.page.locator('[data-testid="layout-CANVAS"]').click();
    await app.navigateTo(`${testServerUrl}/test-page.html`);
    const frame = app.page.locator(`[data-device-frame="${model.frame}"]`);
    const chrome = frame.locator('[data-browser-profile="safari-glass"]');
    const webview = frame.locator('webview');
    const guest = (script: string) =>
      webview.evaluate((el: Electron.WebviewTag, code) => el.executeJavaScript(code), script);
    await expect.poll(() => guest('!!document.getElementById("nav-link")')).toBe(true);
    await guest('scrollTo(0, 0)');
    await expect.poll(() => guest('innerWidth')).toBe(model.width);
    const initialHeight = await guest('innerHeight');
    expect(Math.abs(initialHeight - (model.height * 0.925 - 90))).toBeLessThan(1);
    await expect.poll(() => guest('navigator.userAgent')).toContain('iPhone OS 26_0');
    const id = await webview.evaluate((el: Electron.WebviewTag) => el.getWebContentsId());
    await expect(frame.locator('[data-device-island]')).toBeVisible();
    await app.page.screenshot({path: `e2e/test-results/${model.frame}.png`});
    await guest('scrollTo(0, 400)');
    await expect(chrome).toHaveAttribute('data-compact', 'true');
    await expect.poll(() => guest('innerHeight')).toBe(initialHeight + 35);
    await guest('scrollTo(0, 0)');
    await expect.poll(() => guest('innerHeight')).toBe(initialHeight);
    await app.page.locator('button[title="Rotate Devices"]').click();
    await expect
      .poll(async () => Math.abs((await guest('innerWidth')) - model.height * 0.88))
      .toBeLessThan(1);
    await expect
      .poll(async () => Math.abs((await guest('innerHeight')) - (model.width - 25.8 - 90)))
      .toBeLessThan(1);
    // The website must begin to the right of the rotated island.
    const island = await frame.locator('[data-device-island]').boundingBox();
    const viewport = await webview.boundingBox();
    expect(viewport!.x).toBeGreaterThan(island!.x + island!.width);
    expect(await webview.evaluate((el: Electron.WebviewTag) => el.getWebContentsId())).toBe(id);
    await app.page.screenshot({path: `e2e/test-results/${model.frame}-rotated.png`});
    await app.page.locator('button[title="Rotate Devices"]').click();
    await expect.poll(() => guest('innerWidth')).toBe(model.width);
  }
  await app.openDeviceManager();
  for (const id of selectedIds) await app.page.locator(`[data-testid="${id}"]`).click();
  await app.page.locator('[data-testid="device-card-10037"]').click();
  await app.closeDeviceManager();
});
