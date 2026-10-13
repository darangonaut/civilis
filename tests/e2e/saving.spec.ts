import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import '../../src/types/testHook';

async function openGame(page: Page, query = '?seed=42&e2e&paused') {
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto(`/${query}`);
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
}

/** Postaví dom na prvé voľné políčko pod cestou. */
async function buildHouse(page: Page) {
  await page.getByTestId('building-catalog').locator('[data-building-id="house"]').click();
  const client = await page.evaluate(() => {
    const hook = window.__civilis!;
    const roads = hook.getState().city.buildings.filter((b) => b.definitionId === 'road');
    for (const dy of [1, -1]) {
      for (const road of roads) {
        const tile = { x: road.position.x, y: road.position.y + dy };
        if (hook.canPlace('house', tile)) return hook.tileToClient(tile);
      }
    }
    throw new Error('Žiadne miesto pre dom');
  });
  await page.mouse.click(client.x, client.y);
  await page.keyboard.press('Escape');
}

const snapshot = (page: Page) =>
  page.evaluate(() => {
    const s = window.__civilis!.getState();
    return {
      gameId: s.gameId,
      buildings: s.city.buildings,
      resources: s.city.economy.resources,
      day: s.simulation.day,
    };
  });

test('uloženie do pozície a načítanie vráti pôvodný stav', async ({ page }) => {
  await openGame(page);
  await buildHouse(page);
  await page.evaluate(() => window.__civilis!.advanceDays(3));
  const saved = await snapshot(page);

  await page.getByTestId('open-saves').click();
  const slot = page.getByTestId('saves-panel').locator('[data-slot-id="slot-1"]');
  await slot.getByTestId('slot-save').click();
  await expect(
    page.getByTestId('notice').filter({ hasText: 'Hra uložená: Pozícia 1' }),
  ).toBeVisible();
  await expect(slot).toContainText('deň 3');
  await page.keyboard.press('Escape'); // panel prekrýva časť mapy

  await buildHouse(page);
  await page.evaluate(() => window.__civilis!.advanceDays(5));
  expect((await snapshot(page)).buildings.length).toBe(saved.buildings.length + 1);

  await page.getByTestId('open-saves').click();
  await slot.getByTestId('slot-load').click();
  await expect(page.getByTestId('notice').filter({ hasText: 'Načítané' })).toBeVisible();
  expect(await snapshot(page)).toEqual(saved);
});

test('Ctrl+S uloží aj počas pauzy', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Control+s');
  await expect(
    page.getByTestId('notice').filter({ hasText: 'Hra uložená: Pozícia 1' }),
  ).toBeVisible();
  await page.getByTestId('open-saves').click();
  await expect(page.locator('[data-slot-id="slot-1"]')).toContainText('deň 0');
});

test('obnovenie stránky nestratí rozohranú hru', async ({ page }) => {
  await openGame(page, '?e2e&paused');
  await buildHouse(page);
  await page.evaluate(() => window.__civilis!.advanceDays(2));
  const before = await snapshot(page);

  await page.reload();
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByTestId('notice').filter({ hasText: 'obnovená' })).toBeVisible();
});

test('export do JSON a import späť', async ({ page }) => {
  await openGame(page);
  await buildHouse(page);
  await page.evaluate(() => window.__civilis!.advanceDays(4));
  const exported = await snapshot(page);

  await page.getByTestId('open-saves').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('civilis-den-4.json');
  const json = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(json).format).toBe('civilis-save');

  // Nová hra cez nastavenia, potom import pôvodnej.
  await page.getByTestId('open-settings').click();
  await page.getByTestId('seed-input').fill('7');
  await page.getByTestId('new-game').click();
  expect((await snapshot(page)).gameId).not.toBe(exported.gameId);

  await page.getByTestId('open-saves').click();
  await page
    .getByTestId('import-input')
    .setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.getByTestId('notice').filter({ hasText: 'importovaná' })).toBeVisible();
  expect(await snapshot(page)).toEqual(exported);
});

test('poškodený súbor sa neimportuje a hra zostane', async ({ page }) => {
  await openGame(page);
  const before = await snapshot(page);
  await page.getByTestId('open-saves').click();
  await page.getByTestId('import-input').setInputFiles({
    name: 'zly.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"foo": 1}'),
  });
  await expect(page.getByTestId('notice').filter({ hasText: 'Import zlyhal' })).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});

test('automatické uloženie každých 30 herných dní', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-saves').click();
  const autosave = page.locator('[data-slot-id="autosave"]');
  await expect(autosave).toContainText('Prázdna');
  await page.evaluate(() => window.__civilis!.advanceDays(30));
  await expect(autosave).toContainText('deň 30');
});
