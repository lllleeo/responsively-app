import {test, expect} from '../fixtures/electron-app';
import type {ResponsivelyApp} from '../models/app';

const visualOrder = (app: ResponsivelyApp) =>
  app.page
    .locator('[data-grid-item]')
    .evaluateAll((items) =>
      items
        .sort(
          (a, b) => Number((a as HTMLElement).style.order) - Number((b as HTMLElement).style.order)
        )
        .map((item) => item.getAttribute('data-grid-item'))
    );

const guestState = (app: ResponsivelyApp) =>
  app.electronApp.evaluate(async ({webContents}) =>
    Promise.all(
      webContents
        .getAllWebContents()
        .filter((wc) => (wc as unknown as {getType(): string}).getType() === 'webview')
        .sort((a, b) => a.id - b.id)
        .map(async (wc) => ({
          id: wc.id,
          marker: await wc.executeJavaScript('window.__gridProbe ??= Math.random()'),
        }))
    )
  );

test.describe('Preview Layout', () => {
  test('default layout is applied on launch', async ({app}) => {
    await app.dismissModals();

    // The previewer container should have a flex layout by default (COLUMN layout)
    const previewContainer = app.page.locator('.flex.gap-4.overflow-auto.p-4').first();
    await expect(previewContainer).toBeVisible({timeout: 10_000});
  });

  test('selecting "Flex" layout changes the previewer container class', async ({app}) => {
    await app.dismissModals();

    // Click the Flex layout button (inside ButtonGroup)
    const flexBtn = app.page.locator('[data-testid="layout-FLEX"]');
    await flexBtn.click();
    await app.page.waitForTimeout(300);

    // The container should now have flex-wrap class
    const previewContainer = app.page.locator('.flex.gap-4.overflow-auto.p-4.flex-wrap').first();
    await expect(previewContainer).toBeVisible({timeout: 5_000});
  });

  test('selecting "Column" layout stacks devices horizontally', async ({app}) => {
    await app.dismissModals();

    // Click the Column layout button
    const columnBtn = app.page.locator('[data-testid="layout-COLUMN"]');
    await columnBtn.click();
    await app.page.waitForTimeout(300);

    // The container should have flex without flex-wrap
    const previewContainer = app.page.locator('.flex.gap-4.overflow-auto.p-4').first();
    await expect(previewContainer).toBeVisible({timeout: 5_000});
  });

  test('keyboard shortcut Cmd/Ctrl+Shift+L cycles through layouts', async ({app}) => {
    await app.dismissModals();

    // Press the shortcut to cycle layout
    await app.page.keyboard.press(`${app.modifier}+Shift+l`);
    await app.page.waitForTimeout(500);

    // The layout should have changed — verify a previewer container still exists
    await expect(app.firstWebview).toBeAttached({timeout: 10_000});

    // Cycle back to column layout by pressing multiple times
    await app.page.keyboard.press(`${app.modifier}+Shift+l`);
    await app.page.waitForTimeout(300);
    await app.page.keyboard.press(`${app.modifier}+Shift+l`);
    await app.page.waitForTimeout(300);
    await app.page.keyboard.press(`${app.modifier}+Shift+l`);
    await app.page.waitForTimeout(300);
  });

  test('layout persists after navigating to a new URL', async ({app, testServerUrl}) => {
    await app.dismissModals();

    // Set layout to Flex

    const flexBtn = app.page.locator('[data-testid="layout-FLEX"]');
    await flexBtn.click();
    await app.page.waitForTimeout(300);

    // Navigate to a new URL
    await app.navigateTo(`${testServerUrl}/test-page.html`);

    // Verify flex-wrap is still present (Flex layout persisted)
    const previewContainer = app.page.locator('.flex.gap-4.overflow-auto.p-4.flex-wrap').first();
    await expect(previewContainer).toBeVisible({timeout: 5_000});

    // Reset to column layout
    const columnBtn = app.page.locator('[data-testid="layout-COLUMN"]');
    await columnBtn.click();
  });

  test('grid drag reorders devices, keeps guests alive and restores the saved order after reload', async ({
    app,
  }) => {
    await app.dismissModals();
    await app.page.getByTestId('layout-FLEX').click();
    const items = app.page.locator('[data-grid-item]');
    const original = await visualOrder(app);
    const guests = await guestState(app);
    const source = (await items.nth(0).locator('[data-grid-drag-handle]').boundingBox())!;
    const destination = (await items.nth(1).locator('[data-device-label]').boundingBox())!;
    await app.page.mouse.move(source.x + 8, source.y + 8);
    await app.page.mouse.down();
    await app.page.mouse.move(destination.x + destination.width - 15, destination.y + 10, {
      steps: 8,
    });
    await expect(app.page.getByTestId('grid-drop-indicator')).toHaveAttribute(
      'data-placement',
      'after'
    );
    await app.page.screenshot({path: 'e2e/test-results/grid-reorder.png'});
    await app.page.mouse.up();
    const reordered = [original[1], original[0], ...original.slice(2)];
    expect(await visualOrder(app)).toEqual(reordered);
    expect(await guestState(app)).toEqual(guests);
    // DOM order stays stable, including which guest is the primary device.
    expect(
      await items.evaluateAll((elements) => elements.map((el) => el.getAttribute('data-grid-item')))
    ).toEqual(original);
    await app.page.getByTestId('layout-CANVAS').click();
    await app.page.getByTestId('layout-FLEX').click();
    expect(await visualOrder(app)).toEqual(reordered);
    expect(await guestState(app)).toEqual(guests);
    await app.page.reload();
    await expect(app.page.getByTestId('grid-world')).toBeVisible();
    expect(await visualOrder(app)).toEqual(reordered);
    await app.page.getByTitle('Reset grid order', {exact: true}).click();
    expect(await visualOrder(app)).toEqual(original);
  });

  test('grid supports dragging across wrapped rows, cancellation and keyboard reordering', async ({
    app,
  }) => {
    await app.dismissModals();
    await app.page.getByTestId('layout-FLEX').click();
    await app.electronApp.evaluate(({BrowserWindow}) => {
      BrowserWindow.getAllWindows()[0].setBounds({width: 900, height: 900});
    });
    try {
      const original = await visualOrder(app);
      const items = app.page.locator('[data-grid-item]');
      const source = (await items.nth(0).locator('[data-device-label]').boundingBox())!;
      const destination = (await items.nth(2).locator('[data-device-label]').boundingBox())!;
      expect(destination.y).toBeGreaterThan(source.y + source.height);
      const startDrag = async () => {
        await app.page.mouse.move(source.x + 40, source.y + 10);
        await app.page.mouse.down();
        await app.page.mouse.move(destination.x + destination.width - 15, destination.y + 10, {
          steps: 10,
        });
        await expect(app.page.getByTestId('grid-drop-indicator')).toHaveAttribute(
          'data-placement',
          'after'
        );
      };
      await startDrag();
      await app.page.keyboard.press('Escape');
      await app.page.mouse.up();
      await expect(app.page.getByTestId('grid-drop-indicator')).toHaveCount(0);
      expect(await visualOrder(app)).toEqual(original);
      await startDrag();
      await app.page.mouse.up();
      expect(await visualOrder(app)).toEqual([...original.slice(1), original[0]]);
      await items.nth(0).locator('[data-grid-drag-handle]').focus();
      await app.page.keyboard.press('ArrowLeft');
      expect(await visualOrder(app)).toEqual([original[1], original[0], ...original.slice(2)]);
      await app.page.getByTitle('Reset grid order', {exact: true}).click();
    } finally {
      await app.electronApp.evaluate(({BrowserWindow}) => {
        BrowserWindow.getAllWindows()[0].setBounds({width: 1500, height: 900});
      });
    }
  });
});
