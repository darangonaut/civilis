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

test('mobil: ťuknutím sa stavia a vyberá budova', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('minimap')).toBeHidden();
  await pickBuilding(page, 'house');
  const { tile, client } = await page.evaluate(() => {
    const hook = window.__civilis!;
    for (const road of hook.getState().city.buildings.filter((b) => b.definitionId === 'road')) {
      const tile = { x: road.position.x, y: road.position.y + 1 };
      if (hook.canPlace('house', tile)) return { tile, client: hook.tileToClient(tile) };
    }
    throw new Error('Žiadne miesto');
  });
  await page.touchscreen.tap(client.x, client.y);
  const placed = await page.evaluate(() => window.__civilis!.getState().city.buildings.at(-1)!);
  expect(placed).toMatchObject({ definitionId: 'house', position: tile });

  await page.getByTestId('cancel-build').tap();
  await page.touchscreen.tap(client.x, client.y);
  await expect(page.getByTestId('detail-panel')).toBeVisible();
  // Kým je otvorený inšpektor, dok je skrytý.
  await expect(page.getByTestId('building-catalog')).toBeHidden();
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
