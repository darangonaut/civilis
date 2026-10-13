import { expect, test } from '@playwright/test';

test('herná obrazovka obsahuje všetkých päť častí', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('top-bar')).toBeVisible();
  await expect(page.getByTestId('building-catalog')).toBeVisible();
  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.getByTestId('detail-panel')).toBeVisible();
  await expect(page.getByTestId('bottom-bar')).toBeVisible();
  await expect(page.getByTestId('top-bar')).toContainText('Populácia');
});

test('katalóg filtruje podľa kategórie a zobrazí detail budovy', async ({ page }) => {
  await page.goto('/');
  const catalog = page.getByTestId('building-catalog');
  await expect(catalog.locator('[data-building-id]')).toHaveCount(10);

  await catalog.getByRole('tab', { name: 'Výroba' }).click();
  await expect(catalog.locator('[data-building-id]')).toHaveCount(4);

  await catalog.locator('[data-building-id="farm"]').click();
  const detail = page.getByTestId('detail-panel');
  await expect(detail.getByRole('heading', { name: 'Farma' })).toBeVisible();
  await expect(detail).toContainText('Potraviny: 8');
});
