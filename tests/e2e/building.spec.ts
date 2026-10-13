import { expect, test, type Page } from '@playwright/test';
import type { Position } from '../../src/types';
import '../../src/types/testHook';

async function openGame(page: Page) {
  await page.goto('/?seed=42&e2e&paused');
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
}

/** Nájde najbližšie políčko pri sklade, kde sa dá budova postaviť, a vráti jeho polohu v okne. */
async function findPlaceableTile(page: Page, buildingId: string) {
  return page.evaluate((id) => {
    const hook = window.__civilis!;
    const state = hook.getState();
    const origin = state.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    for (let d = 1; d < 8; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          const tile: Position = { x: origin.x + dx, y: origin.y + dy };
          if (hook.canPlace(id, tile)) return { tile, client: hook.tileToClient(tile) };
        }
      }
    }
    throw new Error(`Žiadne voľné políčko pre ${id}`);
  }, buildingId);
}

const buildingCount = (page: Page) =>
  page.evaluate(() => window.__civilis!.getState().city.buildings.length);

test('postaví dom kliknutím na mapu a odpočíta drevo', async ({ page }) => {
  await openGame(page);
  const before = await buildingCount(page);
  await expect(page.getByTestId('resource-wood')).toContainText('80');

  await page.getByTestId('building-catalog').locator('[data-building-id="house"]').click();
  // Políčko hneď pod počiatočnou cestou, aby bol dom pripojený.
  const { tile, client } = await page.evaluate(() => {
    const hook = window.__civilis!;
    for (const road of hook.getState().city.buildings.filter((b) => b.definitionId === 'road')) {
      const tile = { x: road.position.x, y: road.position.y + 1 };
      if (hook.canPlace('house', tile)) return { tile, client: hook.tileToClient(tile) };
    }
    throw new Error('Žiadne voľné políčko pri ceste');
  });
  await page.mouse.click(client.x, client.y);

  expect(await buildingCount(page)).toBe(before + 1);
  await expect(page.getByTestId('resource-wood')).toContainText('70');
  await expect(page.getByTestId('top-bar')).toContainText('10 / 20');
  const placed = await page.evaluate(() => window.__civilis!.getState().city.buildings.at(-1)!);
  expect(placed).toMatchObject({ definitionId: 'house', position: tile });
});

test('neplatné umiestnenie zobrazí dôvod a nezmení stav', async ({ page }) => {
  await openGame(page);
  const before = await buildingCount(page);
  const warehouse = await page.evaluate(() => {
    const hook = window.__civilis!;
    const position = hook
      .getState()
      .city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    return hook.tileToClient(position);
  });

  await page.getByTestId('building-catalog').locator('[data-building-id="road"]').click();
  await page.mouse.click(warehouse.x, warehouse.y);

  await expect(page.getByTestId('notice')).toContainText('Políčko je obsadené');
  expect(await buildingCount(page)).toBe(before);
});

test('výber budovy na mape, zbúranie a Escape', async ({ page }) => {
  await openGame(page);
  const house = await page.evaluate(() => {
    const hook = window.__civilis!;
    const building = hook.getState().city.buildings.find((b) => b.definitionId === 'house')!;
    return { id: building.id, client: hook.tileToClient(building.position) };
  });

  await page.mouse.click(house.client.x, house.client.y);
  const detail = page.getByTestId('detail-panel');
  await expect(detail.getByRole('heading', { name: 'Dom' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(detail).toContainText('Vyber budovu');

  await page.mouse.click(house.client.x, house.client.y);
  await detail.getByTestId('demolish').click();
  await expect(page.getByTestId('notice')).toContainText('zbúraná');
  const exists = await page.evaluate(
    (id) => window.__civilis!.getState().city.buildings.some((b) => b.id === id),
    house.id,
  );
  expect(exists).toBe(false);
  await expect(page.getByTestId('top-bar')).toContainText('10 / 0');
});

test('ťahanie myšou posúva mapu bez umiestnenia budovy', async ({ page }) => {
  await openGame(page);
  const before = await buildingCount(page);
  await page.getByTestId('building-catalog').locator('[data-building-id="road"]').click();
  const { tile, client } = await findPlaceableTile(page, 'road');

  await page.mouse.move(client.x, client.y);
  await page.mouse.down();
  await page.mouse.move(client.x + 120, client.y + 60, { steps: 5 });
  await page.mouse.up();

  expect(await buildingCount(page)).toBe(before);
  const moved = await page.evaluate((t) => window.__civilis!.tileToClient(t), tile);
  expect(moved.x).toBeCloseTo(client.x + 120, 0);
  expect(moved.y).toBeCloseTo(client.y + 60, 0);
});
