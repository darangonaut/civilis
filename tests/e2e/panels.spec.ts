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
  await expect(legend.locator('li')).toHaveCount(8);
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

test('prehľad problémov: počet na tlačidle a klik vyberie budovu', async ({ page }) => {
  await openGame(page);
  // Dom bez cesty = problém „Chýba cesta“.
  const spot = await page.evaluate(() => {
    const hook = window.__civilis!;
    const state = hook.getState();
    const w = state.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    for (let d = 4; d < 12; d++)
      for (let x = w.x - d; x <= w.x + d; x++) {
        const tile = { x, y: w.y - d };
        if (hook.canPlace('house', tile)) return hook.tileToClient(tile);
      }
    throw new Error('Žiadne miesto');
  });
  await pickBuilding(page, 'house');
  await page.mouse.click(spot.x, spot.y);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('problem-count')).toHaveText('1');

  await page.getByTestId('open-problems').click();
  const panel = page.getByTestId('problems-panel');
  await expect(panel.locator('[data-problem="no_road"]')).toContainText('Chýba cesta');
  await panel.locator('[data-problem="no_road"] .link-row').click();
  await expect(page.getByTestId('problems-panel')).toBeHidden();
  await expect(page.getByTestId('detail-panel')).toContainText('Chýba cesta');
});

test('mapové vrstvy: výber vrstvy ukáže legendu, pri stavbe služby sa zapne sama', async ({
  page,
}) => {
  await openGame(page);
  await page.getByTestId('open-layers').click();
  await page.getByTestId('layer-water').click();
  await expect(page.getByTestId('layer-legend')).toContainText(/voda/i);
  await page.getByTestId('open-layers').click();
  await page.getByTestId('layer-pollution').click();
  await expect(page.getByTestId('layer-legend')).toContainText(/čistom prostredí/i);
  await page.getByTestId('layer-legend').getByRole('button').click();
  await expect(page.getByTestId('layer-legend')).toBeHidden();

  await pickBuilding(page, 'school');
  await expect(page.getByTestId('layer-legend')).toContainText(/vzdelanie/i);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('layer-legend')).toBeHidden();
});

test('udalosť s voľbou: karta, prijatie prisťahovalcov pridá obyvateľov', async ({ page }) => {
  await openGame(page);
  // Voľné bývanie pre prisťahovalcov: dom pri ceste.
  const spot = await page.evaluate(() => {
    const hook = window.__civilis!;
    for (const road of hook.getState().city.buildings.filter((b) => b.definitionId === 'road')) {
      const tile = { x: road.position.x, y: road.position.y + 1 };
      if (hook.canPlace('house', tile)) return hook.tileToClient(tile);
    }
    throw new Error('Žiadne miesto');
  });
  await pickBuilding(page, 'house');
  await page.mouse.click(spot.x, spot.y);
  await page.keyboard.press('Escape');
  const before = await page.evaluate(() => {
    const hook = window.__civilis!;
    hook.grantForTest({ pendingEvent: { eventId: 'immigrants', day: 0, amount: 5 } });
    return hook.getState().city.population.total;
  });
  const dialog = page.getByTestId('event-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Prisťahovalci');
  await expect(dialog).toContainText('5');
  await dialog.getByTestId('event-choice-accept').click();
  await expect(dialog).toBeHidden();
  const state = await page.evaluate(() => window.__civilis!.getState());
  expect(state.events.pending).toBeNull();
  expect(state.city.population.total).toBeGreaterThan(before);
  await expect(page.getByTestId('active-events')).toContainText('Prisťahovalci');
});

test('hlas ulice: obyvatelia komentujú stav mesta', async ({ page }) => {
  await openGame(page);
  const voice = page.getByTestId('street-voice');
  await expect(voice).toContainText('Odkazy na skale');
  await page.evaluate(() => window.__civilis!.advanceDays(40));
  // Aspoň tri príspevky za 40 dní (každých 6–12 dní).
  await expect(voice.locator('li')).toHaveCount(3);
  // Text príspevku nemá nevyplnené zástupné symboly.
  await expect(voice).not.toContainText('{');
});

test('kolonizačná loď: po dohraní odletí na Mars so zdedenou výhodou', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const hook = window.__civilis!;
    const s = hook.getState();
    const w = s.city.buildings.find((b) => b.definitionId === 'warehouse')!.position;
    let spot = null;
    for (let d = 2; d < 10 && !spot; d++)
      for (let x = w.x - d; x <= w.x + d && !spot; x++)
        if (hook.canPlace('house', { x, y: w.y - d })) spot = { x, y: w.y - d };
    hook.grantForTest({
      finished: true,
      buildings: [{ definitionId: 'space_port', position: spot! }],
      resources: { iron: 500, electronics: 400, tools: 400, food: 300 },
    });
  });
  await page.getByTestId('open-milestones').click();
  await page.getByTestId('milestones-colony').click();
  const dialog = page.getByTestId('colony-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Mars');
  await expect(dialog).toContainText('pozície Pozícia 1');
  const launch = page.getByTestId('colony-launch');
  await expect(launch).toBeDisabled();
  await page.getByTestId('legacy-cargo').click();
  await launch.click();

  await expect(page.getByTestId('new-era')).toContainText('Havarijný tábor');
  const colony = await page.evaluate(() => {
    const s = window.__civilis!.getState();
    return { planet: s.planet, colony: s.colony, bricks: s.city.economy.resources.bricks };
  });
  expect(colony.planet).toBe('mars');
  expect(colony.colony).toMatchObject({ generation: 2, legacyIds: ['cargo'] });
  expect(colony.bricks).toBe(40);
  await page.getByTestId('new-era').getByRole('button').click();
  await expect(page.getByTestId('resource-wood')).toHaveAttribute('title', /Šrot/);

  // Pôvodné mesto zostalo uložené v prvej pozícii.
  await page.getByTestId('open-saves').click();
  await expect(page.getByTestId('slot-load').first()).toBeEnabled();
});

test('finále ságy: na Proxime b sa loď neponúka, kronika ukáže všetky mestá', async ({ page }) => {
  await page.goto('/?seed=7&e2e&paused&planet=proxima');
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() =>
    window.__civilis!.grantForTest({
      finished: true,
      colony: {
        generation: 3,
        history: [
          { city: 'Prvé mesto', planet: 'earth', days: 2500, score: 1000, population: 12000 },
          { city: 'Červené mesto', planet: 'mars', days: 2600, score: 1100, population: 12500 },
        ],
      },
    }),
  );
  await page.getByTestId('open-milestones').click();
  await expect(page.getByTestId('milestones-colony')).toHaveCount(0);
  await page.getByTestId('milestones-saga').click();
  const chronicle = page.getByTestId('saga-chronicle');
  await expect(chronicle).toContainText('Prvé mesto · Zem');
  await expect(chronicle).toContainText('Červené mesto · Mars');
  await expect(chronicle).toContainText('Proxima b');
  await expect(page.getByTestId('victory')).toContainText('Koniec ságy');
  await expect(page.getByTestId('victory-colony')).toHaveCount(0);
});

test('úvodná obrazovka: voľba jazyka a štart hry', async ({ page }) => {
  await page.goto('/?seed=7');
  const screen = page.getByTestId('start-screen');
  await expect(screen).toBeVisible();
  await expect(page.getByTestId('start-play')).toHaveText(/Štart/i);
  await page.getByTestId('start-language-en').click();
  await expect(page.getByTestId('start-play')).toHaveText(/Start/i);
  await expect(page.getByTestId('start-language-en')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('start-play').click();
  await expect(screen).toBeHidden();
  await expect(page.getByTestId('map-view')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('top-bar')).toContainText('Settlement');
});
