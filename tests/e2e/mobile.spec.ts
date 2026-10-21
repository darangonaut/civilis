import { expect, test, type Page } from '@playwright/test';
import '../../src/types/testHook';
import { pickBuilding } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function openGame(page: Page) {
  await page.goto('/?seed=7&e2e&paused');
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
}

/** Pošle na plátno mapy dotykové pointer udalosti (viac prstov naraz). */
async function touch(page: Page, type: string, id: number, x: number, y: number) {
  await page.evaluate(
    ({ type, id, x, y }) => {
      const canvas = document.querySelector('.map-host canvas')!;
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          bubbles: true,
          isPrimary: id === 1,
        }),
      );
    },
    { type, id, x, y },
  );
}

const scale = (page: Page) =>
  page.evaluate(() => {
    const a = window.__civilis!.tileToClient({ x: 10, y: 10 });
    const b = window.__civilis!.tileToClient({ x: 11, y: 10 });
    return Math.hypot(b.x - a.x, b.y - a.y);
  });

test('mobil: ťuknutím sa označí miesto, stavba sa potvrdí, ťuknutím sa vyberá budova', async ({
  page,
}) => {
  await openGame(page);
  await expect(page.getByTestId('minimap')).toBeHidden();
  // Dok je skrytý, otvára sa tlačidlom Stavať.
  await expect(page.getByTestId('building-catalog')).toBeHidden();
  await page.getByTestId('open-dock').tap();
  await pickBuilding(page, 'house');
  const { tile, client } = await page.evaluate(() => {
    const hook = window.__civilis!;
    for (const road of hook.getState().city.buildings.filter((b) => b.definitionId === 'road')) {
      const tile = { x: road.position.x, y: road.position.y + 1 };
      if (hook.canPlace('house', tile)) return { tile, client: hook.tileToClient(tile) };
    }
    throw new Error('Žiadne miesto');
  });
  const count = () => page.evaluate(() => window.__civilis!.getState().city.buildings.length);
  const before = await count();
  const confirm = page.getByTestId('confirm-build');
  await expect(confirm).toBeDisabled();
  await page.touchscreen.tap(client.x, client.y);
  // Ťuknutie iba označí miesto — stavia sa až po potvrdení.
  expect(await count()).toBe(before);
  await confirm.tap();
  expect(await count()).toBe(before + 1);
  const placed = await page.evaluate(() => window.__civilis!.getState().city.buildings.at(-1)!);
  expect(placed).toMatchObject({ definitionId: 'house', position: tile });

  await page.getByTestId('cancel-build').tap();
  await page.getByTestId('close-dock').tap();
  await page.touchscreen.tap(client.x, client.y);
  await expect(page.getByTestId('detail-panel')).toBeVisible();
  // Kým je otvorený inšpektor, dok je skrytý.
  await expect(page.getByTestId('building-catalog')).toBeHidden();
});

test('mobil: dve ťuknutia vyznačia rad ciest, jeden prst počas stavby posúva mapu', async ({
  page,
}) => {
  await openGame(page);
  await page.evaluate(() => window.__civilis!.grantForTest({ resources: { stone: 50 } }));
  await page.getByTestId('open-dock').tap();
  await pickBuilding(page, 'road');
  const line = await page.evaluate(() => {
    const hook = window.__civilis!;
    const w = hook.getState().city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    for (let y = w.y + 2; y < w.y + 8; y++) {
      const tiles = [0, 1, 2, 3].map((i) => ({ x: w.x - 1 + i, y }));
      if (tiles.every((t) => hook.canPlace('road', t)))
        return { from: hook.tileToClient(tiles[0]!), to: hook.tileToClient(tiles[3]!) };
    }
    throw new Error('Žiadne miesto pre cestu');
  });
  const roads = () =>
    page.evaluate(
      () =>
        window.__civilis!.getState().city.buildings.filter((b) => b.definitionId === 'road').length,
    );
  const before = await roads();
  await page.touchscreen.tap(line.from.x, line.from.y);
  await page.touchscreen.tap(line.to.x, line.to.y);
  await expect(page.getByTestId('confirm-build')).toContainText('(4)');
  await page.getByTestId('confirm-build').tap();
  expect(await roads()).toBe(before + 4);

  // Ťahanie jedným prstom v režime stavby posúva mapu (nič nestavia).
  const at = await page.evaluate(() => window.__civilis!.tileToClient({ x: 48, y: 48 }));
  await touch(page, 'pointerdown', 1, 200, 400);
  await touch(page, 'pointermove', 1, 240, 420);
  await touch(page, 'pointermove', 1, 280, 440);
  await touch(page, 'pointerup', 1, 280, 440);
  const moved = await page.evaluate(() => window.__civilis!.tileToClient({ x: 48, y: 48 }));
  expect(moved.x - at.x).toBeCloseTo(80, 0);
  expect(await roads()).toBe(before + 4);
});

test('mobil: menu otvorí panely a vrstvy', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-menu').tap();
  await expect(page.getByTestId('menu-sheet')).toBeVisible();
  await page.getByTestId('open-research').tap();
  await expect(page.getByTestId('menu-sheet')).toBeHidden();
  await expect(page.getByTestId('research-panel')).toBeVisible();
});

test('mobil: posun jedným prstom a priblíženie dvoma prstami', async ({ page }) => {
  await openGame(page);
  const before = await page.evaluate(() => window.__civilis!.tileToClient({ x: 48, y: 48 }));
  await touch(page, 'pointerdown', 1, 200, 400);
  await touch(page, 'pointermove', 1, 230, 420);
  await touch(page, 'pointermove', 1, 260, 440);
  await touch(page, 'pointerup', 1, 260, 440);
  const after = await page.evaluate(() => window.__civilis!.tileToClient({ x: 48, y: 48 }));
  expect(after.x - before.x).toBeCloseTo(60, 0);
  expect(after.y - before.y).toBeCloseTo(40, 0);

  const zoomBefore = await scale(page);
  await touch(page, 'pointerdown', 1, 180, 400);
  await touch(page, 'pointerdown', 2, 220, 400);
  await touch(page, 'pointermove', 1, 140, 400);
  await touch(page, 'pointermove', 2, 260, 400);
  await touch(page, 'pointerup', 1, 140, 400);
  await touch(page, 'pointerup', 2, 260, 400);
  expect(await scale(page)).toBeGreaterThan(zoomBefore);
  // Gesto nič nepostavilo ani nevybralo.
  await expect(page.getByTestId('detail-panel')).toBeHidden();
});
