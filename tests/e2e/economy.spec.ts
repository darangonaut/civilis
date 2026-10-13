import { expect, test, type Page } from '@playwright/test';
import '../../src/types/testHook';

async function openGame(page: Page, query = '?seed=42&e2e&paused') {
  await page.goto(`/${query}`);
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
}

const day = (page: Page) => page.evaluate(() => window.__civilis!.getState().simulation.day);

test('čas beží pri 1× a medzerník ho pozastaví', async ({ page }) => {
  await openGame(page, '?seed=42&e2e');
  await expect(page.getByTestId('speed-1')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => day(page), { timeout: 5000 }).toBeGreaterThanOrEqual(1);

  await page.keyboard.press(' ');
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  const paused = await day(page);
  await page.waitForTimeout(2500);
  expect(await day(page)).toBe(paused);

  await page.keyboard.press('3');
  await expect(page.getByTestId('speed-4')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => day(page), { timeout: 3000 }).toBeGreaterThan(paused + 1);
});

test('nepripojená budova ukáže „Chýba cesta“, po dostavaní cesty funguje', async ({ page }) => {
  await openGame(page);
  // Dom dva políčka pod cestou (cesta je na y = stred + 1), medzera sa doplní cestou.
  const spot = await page.evaluate(() => {
    const hook = window.__civilis!;
    const state = hook.getState();
    const roads = state.city.buildings.filter((b) => b.definitionId === 'road');
    for (const road of roads) {
      const house = { x: road.position.x, y: road.position.y + 2 };
      const gap = { x: road.position.x, y: road.position.y + 1 };
      if (hook.canPlace('house', house) && hook.canPlace('road', gap)) {
        return { house: hook.tileToClient(house), gap: hook.tileToClient(gap) };
      }
    }
    throw new Error('Nenašlo sa vhodné miesto');
  });

  const catalog = page.getByTestId('building-catalog');
  await catalog.locator('[data-building-id="house"]').click();
  await page.mouse.click(spot.house.x, spot.house.y);
  await page.keyboard.press('Escape');
  await page.mouse.click(spot.house.x, spot.house.y);
  const status = page.getByTestId('building-status');
  await expect(status).toContainText('Chýba cesta');
  await expect(page.getByTestId('top-bar')).toContainText('10 / 10');

  await catalog.locator('[data-building-id="road"]').click();
  await page.mouse.click(spot.gap.x, spot.gap.y);
  await page.keyboard.press('Escape');
  await page.mouse.click(spot.house.x, spot.house.y);
  await expect(status).toContainText('V poriadku');
  await expect(page.getByTestId('top-bar')).toContainText('10 / 20');
});

test('po dni sa v hornej lište zobrazí denná bilancia', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__civilis!.advanceDays(1));
  // 10 obyvateľov zje 2,5 potravín, sklad stojí 1 peniaz denne.
  await expect(page.getByTestId('resource-food')).toContainText('97');
  await expect(page.getByTestId('resource-food')).toContainText('−2,5');
  await expect(page.getByTestId('money')).toContainText('499');
  await expect(page.getByTestId('day')).toContainText('1');
});

test('keď dôjdu potraviny, zobrazí sa upozornenie a spokojnosť klesá', async ({ page }) => {
  await openGame(page);
  // 100 potravín pri spotrebe 2,5 / deň vydrží 40 dní.
  await page.evaluate(() => window.__civilis!.advanceDays(41));
  await expect(page.getByTestId('notice').filter({ hasText: 'hladujú' })).toBeVisible();
  const state = await page.evaluate(() => window.__civilis!.getState().city.population);
  expect(state.happinessFactors.food).toBeLessThan(100);
  expect(state.total).toBeGreaterThanOrEqual(5);
});
