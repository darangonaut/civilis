import { expect, test, type Page } from '@playwright/test';
import '../../src/types/testHook';
import { dockTile, pickBuilding } from './helpers';

async function openGame(page: Page) {
  await page.goto('/?seed=7&e2e&paused');
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
}

test('výskum: spustenie technológie a stav zamknutých technológií', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-research').click();
  const panel = page.getByTestId('research-panel');
  await expect(panel).toContainText('Nič sa neskúma');
  await expect(panel.locator('[data-tech-id="labor_organization"]')).toHaveAttribute(
    'data-status',
    'locked',
  );

  await panel.locator('[data-tech-id="woodworking"]').getByRole('button').click();
  await expect(panel.locator('[data-tech-id="woodworking"]')).toHaveAttribute(
    'data-status',
    'active',
  );
  await expect(panel).toContainText('Skúma sa: Spracovanie dreva');
  await expect(page.getByTestId('open-research')).toHaveAttribute('title', /Spracovanie dreva/);
  const research = await page.evaluate(() => window.__civilis!.getState().research);
  expect(research.activeTechnologyId).toBe('woodworking');

  // Prepnutie na inú technológiu.
  await panel
    .locator('[data-tech-id="masonry"]')
    .getByRole('button', { name: 'Prepnúť sem' })
    .click();
  await expect(panel.locator('[data-tech-id="masonry"]')).toHaveAttribute('data-status', 'active');
  await expect(panel.locator('[data-tech-id="woodworking"]')).toHaveAttribute(
    'data-status',
    'available',
  );
});

test('míľniky: aktuálny cieľ s priebehom podmienok', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-milestones').click();
  const current = page
    .getByTestId('milestones-panel')
    .locator('[data-milestone-id="settlement_founded"]');
  await expect(current).toHaveClass(/current/);
  const conditions = current.getByTestId('milestone-condition');
  await expect(conditions).toHaveCount(3);
  await expect(conditions.first()).toContainText('Obyvatelia');
  await expect(conditions.first()).toContainText('10 / 20');
  await expect(current).toContainText('Peniaze +100');
});

test('štatistiky ukazujú populáciu, spokojnosť a bilanciu', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__civilis!.advanceDays(1));
  await page.getByTestId('open-statistics').click();
  const panel = page.getByTestId('statistics-panel');
  await expect(panel).toContainText('Obyvateľstvo');
  await expect(panel).toContainText('−2,5');
  await expect(panel).toContainText('Kapacita skladu: 300');
});

test('Escape a opätovný klik panel zatvoria', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-statistics').click();
  await expect(page.getByTestId('statistics-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('statistics-panel')).toBeHidden();
  await page.getByTestId('open-research').click();
  await page.getByTestId('open-research').click();
  await expect(page.getByTestId('research-panel')).toBeHidden();
});

test('katalóg ukazuje cenu a nedostupnosť pri nedostatku surovín', async ({ page }) => {
  await openGame(page);
  const school = await dockTile(page, 'school');
  await expect(school).toContainText('30');
  await expect(school).toHaveAttribute('data-available', 'true');

  // Škola stojí 20 kameňa z 30, druhá sa už nedá zaplatiť.
  await pickBuilding(page, 'school');
  const spot = await page.evaluate(() => {
    const hook = window.__civilis!;
    for (const road of hook.getState().city.buildings.filter((b) => b.definitionId === 'road')) {
      const tile = { x: road.position.x, y: road.position.y + 1 };
      if (hook.canPlace('school', tile)) return hook.tileToClient(tile);
    }
    throw new Error('Žiadne miesto pre školu');
  });
  await page.mouse.click(spot.x, spot.y);
  await expect(school).toHaveAttribute('data-available', 'false');
});

test('nastavenia obsahujú legendu značiek', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  const legend = page.getByTestId('marker-legend');
  await expect(legend.locator('li')).toHaveCount(7);
  await expect(legend).toContainText('Chýba cesta');
  await expect(legend).toContainText('vylepšiť');
});

test('éry: aktuálna éra v lište, budúce technológie a budovy sú zamknuté', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('era-name')).toHaveText('Osada');
  // Budovy Staroveku sa v doku Osady nezobrazujú v žiadnej kategórii.
  await expect(dockTile(page, 'brickworks')).rejects.toThrow();
  await page.getByTestId('open-research').click();
  const panel = page.getByTestId('research-panel');
  const antiquity = panel.locator('[data-era-id="antiquity"]');
  await expect(antiquity).toBeDisabled();
  await expect(antiquity).toHaveAttribute('title', /Odomkne sa/);
  await expect(panel.locator('[data-tech-id="masonry"]')).toBeVisible();
  await expect(panel.locator('[data-tech-id="pottery"]')).toHaveCount(0);
  await page.getByTestId('open-milestones').click();
  await expect(
    page.getByTestId('milestones-panel').locator('[data-era-id="middle_ages"]'),
  ).toContainText('Zlatý vek');
});

test('nastavenia zobrazenia: animácie a deň/noc sa dajú vypnúť a pamätajú si to', async ({
  page,
}) => {
  await openGame(page);
  // Dom na začiatku má okná, takže má aj svetlá na noc.
  expect((await page.evaluate(() => window.__civilis!.effectsStats())).lights).toBeGreaterThan(0);

  await page.getByTestId('open-settings').click();
  const animations = page.getByTestId('toggle-animations');
  const dayNight = page.getByTestId('toggle-daynight');
  await expect(animations).toBeChecked();
  await expect(dayNight).toBeChecked();
  await dayNight.uncheck();
  await animations.uncheck();

  await page.reload();
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('toggle-animations')).not.toBeChecked();
  await expect(page.getByTestId('toggle-daynight')).not.toBeChecked();
  const stats = await page.evaluate(() => window.__civilis!.effectsStats());
  expect(stats.walkers).toBe(0);
  expect(stats.night).toBe(0);
});

test('jazyk: prepnutie na češtinu a angličtinu, voľba sa pamätá', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('era-name')).toHaveText('Osada');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('language-en').click();
  await expect(page.getByTestId('era-name')).toHaveText('Settlement');
  await expect(page.getByTestId('goal-tracker')).toContainText('Settlement Founded');
  await expect(page.getByTestId('settings-panel')).toContainText('Language');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByTestId('language-cs').click();
  await expect(page.getByTestId('building-catalog')).toContainText('Bydlení');
  await page.reload();
  await expect(page.getByTestId('era-name')).toHaveText('Osada');
  await expect(page.getByTestId('building-catalog')).toContainText('Bydlení');
});

test('obchod: bez trhoviska zamknutý, s trhoviskom predaj a automatický predaj', async ({
  page,
}) => {
  await openGame(page);
  await page.getByTestId('open-trade').click();
  await expect(page.getByTestId('trade-unavailable')).toBeVisible();

  const spot = await page.evaluate(() => {
    const hook = window.__civilis!;
    for (const road of hook.getState().city.buildings.filter((b) => b.definitionId === 'road')) {
      const tile = { x: road.position.x, y: road.position.y + 1 };
      if (hook.canPlace('market', tile)) return hook.tileToClient(tile);
    }
    throw new Error('Žiadne miesto pre trhovisko');
  });
  await page.keyboard.press('Escape');
  await pickBuilding(page, 'market');
  await page.mouse.click(spot.x, spot.y);
  await page.keyboard.press('Escape');

  await page.getByTestId('open-trade').click();
  const panel = page.getByTestId('trade-panel');
  const moneyBefore = await page.evaluate(() => window.__civilis!.getState().city.economy.money);
  await panel.getByTestId('sell-all-wood').click();
  await expect(page.getByTestId('notice').filter({ hasText: 'Predané' })).toBeVisible();
  const after = await page.evaluate(() => window.__civilis!.getState());
  expect(after.city.economy.resources.wood).toBeLessThan(1);
  expect(after.city.economy.money).toBeGreaterThan(moneyBefore);

  await panel.getByTestId('auto-sell-stone').check();
  expect(await page.evaluate(() => window.__civilis!.getState().trade.autoSell)).toEqual(['stone']);
});
