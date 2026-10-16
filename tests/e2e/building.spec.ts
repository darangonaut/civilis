import { expect, test, type Page } from '@playwright/test';
import type { Position } from '../../src/types';
import '../../src/types/testHook';
import { pickBuilding } from './helpers';

async function openGame(page: Page) {
  await page.goto('/?seed=7&e2e&paused');
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

/** Ťahanie ľavým tlačidlom myši z jedného bodu okna do druhého. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

test('postaví dom kliknutím na mapu a odpočíta drevo', async ({ page }) => {
  await openGame(page);
  const before = await buildingCount(page);
  await expect(page.getByTestId('resource-wood')).toContainText('80');

  await pickBuilding(page, 'house');
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

  await pickBuilding(page, 'road');
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
  await expect(detail.getByRole('heading', { name: 'Dom', exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();

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

test('pravé tlačidlo posúva mapu aj v režime stavby', async ({ page }) => {
  await openGame(page);
  const before = await buildingCount(page);
  await pickBuilding(page, 'road');
  const { tile, client } = await findPlaceableTile(page, 'road');

  await page.mouse.move(client.x, client.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(client.x + 120, client.y + 60, { steps: 5 });
  await page.mouse.up({ button: 'right' });

  expect(await buildingCount(page)).toBe(before);
  const moved = await page.evaluate((t) => window.__civilis!.tileToClient(t), tile);
  expect(moved.x).toBeCloseTo(client.x + 120, 0);
  expect(moved.y).toBeCloseTo(client.y + 60, 0);
});

test('ťahaním sa postaví celá cesta naraz', async ({ page }) => {
  await openGame(page);
  // Nájde 5 voľných políčok v rade.
  const row = await page.evaluate(() => {
    const hook = window.__civilis!;
    const s = hook.getState();
    const w = s.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    for (let y = w.y - 6; y <= w.y + 6; y++) {
      for (let x = w.x - 8; x <= w.x + 4; x++) {
        const tiles = [0, 1, 2, 3, 4].map((d) => ({ x: x + d, y }));
        if (tiles.every((t) => hook.canPlace('road', t))) {
          return { tiles, from: hook.tileToClient(tiles[0]!), to: hook.tileToClient(tiles[4]!) };
        }
      }
    }
    throw new Error('Žiadny voľný rad');
  });
  const before = await buildingCount(page);
  await pickBuilding(page, 'road');
  await page.mouse.move(row.from.x, row.from.y);
  await page.mouse.down();
  await page.mouse.move(row.to.x, row.to.y, { steps: 8 });
  await page.mouse.up();

  expect(await buildingCount(page)).toBe(before + 5);
  const roads = await page.evaluate(() =>
    window
      .__civilis!.getState()
      .city.buildings.filter((b) => b.definitionId === 'road')
      .map((b) => b.position),
  );
  for (const tile of row.tiles) expect(roads).toContainEqual(tile);
});

test('ťahaním sa vyplní obdĺžnik budov a pri nedostatku surovín sa zobrazí zhrnutie', async ({
  page,
}) => {
  await openGame(page);
  const area = await page.evaluate(() => {
    const hook = window.__civilis!;
    const s = hook.getState();
    const w = s.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    for (let y = w.y - 8; y <= w.y + 6; y++) {
      for (let x = w.x - 8; x <= w.x + 6; x++) {
        const tiles = [0, 1, 2].flatMap((dy) => [0, 1, 2].map((dx) => ({ x: x + dx, y: y + dy })));
        if (tiles.every((t) => hook.canPlace('house', t))) {
          return { from: hook.tileToClient(tiles[0]!), to: hook.tileToClient(tiles[8]!) };
        }
      }
    }
    throw new Error('Žiadna voľná plocha 3 × 3');
  });
  const before = await buildingCount(page);
  await pickBuilding(page, 'house');
  await page.mouse.move(area.from.x, area.from.y);
  await page.mouse.down();
  await page.mouse.move(area.to.x, area.to.y, { steps: 8 });
  await page.mouse.up();

  // 80 dreva = 8 domov z 9.
  expect(await buildingCount(page)).toBe(before + 8);
  await expect(page.getByTestId('notice').filter({ hasText: 'Postavené: 8' })).toBeVisible();
});

test('vylepšenie všetkých rovnakých budov naraz (blok fariem)', async ({ page }) => {
  await openGame(page);
  const row = await page.evaluate(() => {
    const hook = window.__civilis!;
    hook.grantForTest({
      technologies: ['crop_rotation'],
      resources: { wood: 500, stone: 500, bricks: 200, tools: 100 },
    });
    for (const road of hook.getState().city.buildings.filter((b) => b.definitionId === 'road')) {
      const tiles = [0, 1, 2].map((d) => ({ x: road.position.x + d, y: road.position.y + 1 }));
      if (tiles.every((t) => hook.canPlace('farm', t)))
        return tiles.map((t) => ({ tile: t, client: hook.tileToClient(t) }));
    }
    throw new Error('Žiadne miesto pre farmy');
  });
  await pickBuilding(page, 'farm');
  for (const { client } of row) await page.mouse.click(client.x, client.y);
  await page.keyboard.press('Escape');

  await page.mouse.click(row[0]!.client.x, row[0]!.client.y);
  const upgradeAll = page.getByTestId('upgrade-all');
  await expect(upgradeAll).toContainText('3');
  await upgradeAll.click();
  await expect(page.getByTestId('notice').filter({ hasText: '3' })).toBeVisible();
  const levels = await page.evaluate(() =>
    window
      .__civilis!.getState()
      .city.buildings.filter((b) => b.definitionId === 'farm')
      .map((b) => b.level),
  );
  expect(levels).toEqual([2, 2, 2]);
});

test('div sveta: pyramída na 2 × 2 políčka, druhá sa už postaviť nedá', async ({ page }) => {
  await openGame(page);
  const spot = await page.evaluate(() => {
    const hook = window.__civilis!;
    hook.grantForTest({
      technologies: ['architecture'],
      // Splnená Osada → Starovek, kde sa pyramída objaví v doku.
      milestones: [
        'settlement_founded',
        'self_sufficient_village',
        'educated_society',
        'prosperous_town',
        'birth_of_civilization',
      ],
      // Pyramída stojí viac, než sa zmestí do skladu na začiatku hry — test hook zásoby nezastropuje.
      resources: { wood: 300, stone: 700, bricks: 400, tools: 100 },
    });
    const state = hook.getState();
    const w = state.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    for (let d = 2; d < 12; d++)
      for (let y = w.y - d; y <= w.y + d; y++)
        for (let x = w.x - d; x <= w.x + d; x++) {
          const tile = { x, y };
          if (hook.canPlace('pyramid', tile)) return { tile, client: hook.tileToClient(tile) };
        }
    throw new Error('Žiadne miesto pre pyramídu');
  });
  await pickBuilding(page, 'pyramid');
  await page.mouse.click(spot.client.x, spot.client.y);
  const pyramid = await page.evaluate(() =>
    window.__civilis!.getState().city.buildings.find((b) => b.definitionId === 'pyramid'),
  );
  expect(pyramid?.position).toEqual(spot.tile);
  await expect(
    page.getByTestId('building-catalog').locator('[data-building-id="pyramid"]'),
  ).toBeDisabled();
});

test('režim búrania: ťahaním sa po potvrdení zbúra obdĺžnik budov, Escape dialóg zruší', async ({
  page,
}) => {
  // Štyri ťahania myšou — pri plnom paralelnom behu Chromium nestíha štandardný limit.
  test.slow();
  await openGame(page);
  const area = await page.evaluate(() => {
    const hook = window.__civilis!;
    const s = hook.getState();
    const w = s.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    for (let y = w.y - 8; y <= w.y + 6; y++) {
      for (let x = w.x - 8; x <= w.x + 6; x++) {
        const tiles = [0, 1].flatMap((dy) => [0, 1].map((dx) => ({ x: x + dx, y: y + dy })));
        if (tiles.every((t) => hook.canPlace('house', t))) {
          return { from: hook.tileToClient(tiles[0]!), to: hook.tileToClient(tiles[3]!) };
        }
      }
    }
    throw new Error('Žiadna voľná plocha 2 × 2');
  });
  const before = await buildingCount(page);
  await pickBuilding(page, 'house');
  await drag(page, area.from, area.to);
  expect(await buildingCount(page)).toBe(before + 4);
  await expect(page.getByTestId('resource-wood')).toContainText('40');

  const toggle = page.getByTestId('demolish-mode');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  const dialog = page.getByTestId('demolish-dialog');
  await drag(page, area.from, area.to);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('(4)');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await buildingCount(page)).toBe(before + 4);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await drag(page, area.from, area.to);
  await page.getByTestId('demolish-confirm').click();
  expect(await buildingCount(page)).toBe(before);
  await expect(page.getByTestId('notice').filter({ hasText: 'Zbúrané budovy: 4' })).toBeVisible();
  // Vráti sa polovica stavby: 4 × 5 dreva.
  await expect(page.getByTestId('resource-wood')).toContainText('60');
});

test('režim búrania: klik zbúra jednu budovu bez potvrdenia, posledný sklad nie', async ({
  page,
}) => {
  await openGame(page);
  const { house, warehouse } = await page.evaluate(() => {
    const hook = window.__civilis!;
    const buildings = hook.getState().city.buildings;
    const h = buildings.find((b) => b.definitionId === 'house')!;
    const w = buildings.find((b) => b.definitionId === 'warehouse')!;
    return {
      house: { id: h.id, client: hook.tileToClient(h.position) },
      warehouse: { id: w.id, client: hook.tileToClient(w.position) },
    };
  });
  const exists = (id: string) =>
    page.evaluate((i) => window.__civilis!.getState().city.buildings.some((b) => b.id === i), id);
  const toggle = page.getByTestId('demolish-mode');

  await toggle.click();
  await page.mouse.click(house.client.x, house.client.y);
  await expect(page.getByTestId('demolish-dialog')).toBeHidden();
  expect(await exists(house.id)).toBe(false);

  await page.mouse.click(warehouse.client.x, warehouse.client.y);
  await expect(
    page.getByTestId('notice').filter({ hasText: 'Mesto musí mať aspoň jeden sklad.' }),
  ).toBeVisible();
  expect(await exists(warehouse.id)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
