import { expect, test } from '@playwright/test';
import '../../src/types/testHook';

test('herná obrazovka: mapa na celú plochu a plávajúce ovládanie', async ({ page }) => {
  await page.goto('/?seed=7&e2e&paused');
  await expect(page.getByTestId('top-bar')).toBeVisible();
  await expect(page.getByTestId('building-catalog')).toBeVisible();
  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.getByTestId('goal-tracker')).toContainText('Založená osada');
  await expect(page.getByTestId('bottom-bar')).toBeVisible();
  await expect(page.getByTestId('minimap')).toBeVisible();
  // Inšpektor sa zobrazí až po výbere budovy.
  await expect(page.getByTestId('detail-panel')).toBeHidden();
  await expect(page.getByTestId('top-bar')).toContainText('10 / 10');
});

test('dok: záložky kategórií a karta s detailom budovy', async ({ page }) => {
  await page.goto('/?seed=7&e2e&paused');
  const catalog = page.getByTestId('building-catalog');
  await expect(catalog.locator('[data-building-id]')).toHaveCount(1);

  await catalog.getByRole('tab', { name: 'Výroba' }).click();
  await expect(catalog.locator('[data-building-id]')).toHaveCount(4);

  await catalog.locator('[data-building-id="farm"]').hover();
  const tooltip = page.getByTestId('dock-tooltip');
  await expect(tooltip).toContainText('Farma');
  await expect(tooltip).toContainText('8 potravín');
  await catalog.locator('[data-building-id="farm"]').click();
  await expect(catalog.locator('[data-building-id="farm"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('vyššie úrovne domov sa dajú postaviť rovno z doku', async ({ page }) => {
  await page.goto('/?seed=7&e2e&paused');
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
  const catalog = page.getByTestId('building-catalog');
  await expect(catalog.locator('[data-building-level="house@2"]')).toHaveCount(0);

  // Murovaný dom: kamenárstvo + studňa v dosahu.
  const spot = await page.evaluate(() => {
    const hook = window.__civilis!;
    hook.grantForTest({
      technologies: ['masonry'],
      resources: { wood: 500, stone: 500, tools: 100 },
    });
    const roads = hook.getState().city.buildings.filter((b) => b.definitionId === 'road');
    for (const road of roads) {
      const well = { x: road.position.x, y: road.position.y - 1 };
      const house = { x: road.position.x + 1, y: road.position.y - 1 };
      if (hook.canPlace('well', well) && hook.canPlace('house', house)) {
        return { well: hook.tileToClient(well), house, houseClient: hook.tileToClient(house) };
      }
    }
    throw new Error('Žiadne miesto');
  });
  await catalog.getByRole('tab', { name: 'Služby' }).click();
  await catalog.locator('[data-building-id="well"]').click();
  await page.mouse.click(spot.well.x, spot.well.y);

  await catalog.getByRole('tab', { name: 'Bývanie' }).click();
  const level2 = catalog.locator('[data-building-level="house@2"]');
  await expect(level2).toBeVisible();
  await level2.click();
  await page.mouse.click(spot.houseClient.x, spot.houseClient.y);
  const placed = await page.evaluate(() => window.__civilis!.getState().city.buildings.at(-1)!);
  expect(placed).toMatchObject({ definitionId: 'house', level: 2, position: spot.house });
});
