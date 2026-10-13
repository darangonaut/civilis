import type { Locator, Page } from '@playwright/test';

/** Prepne záložky stavebného doku, kým sa neukáže dlaždica budovy, a vráti ju. */
export async function dockTile(page: Page, buildingId: string): Promise<Locator> {
  const catalog = page.getByTestId('building-catalog');
  const tile = catalog.locator(`[data-building-id="${buildingId}"]`);
  if ((await tile.count()) > 0) return tile;
  for (const tab of await catalog.getByRole('tab').all()) {
    await tab.click();
    if ((await tile.count()) > 0) return tile;
  }
  throw new Error(`Budova ${buildingId} nie je v doku`);
}

/** Vyberie budovu v doku (režim výstavby). */
export async function pickBuilding(page: Page, buildingId: string): Promise<void> {
  await (await dockTile(page, buildingId)).click();
}
