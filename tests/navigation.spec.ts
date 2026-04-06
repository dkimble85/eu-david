import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const OFF_SEARCH_PATH = '**/api/v2/search?*';

type OffProduct = {
  code: string;
  product_name: string;
  brands?: string;
  image_url?: string;
  ingredients_text?: string;
  additives_tags?: string[];
  allergens_tags?: string[];
  ingredients_analysis_tags?: string[];
  categories_tags?: string[];
  stores_tags?: string[];
};

async function mockOffSearch(page: Page, resolver: (url: URL) => OffProduct[]) {
  await page.route(OFF_SEARCH_PATH, async (route: Route) => {
    const url = new URL(route.request().url());
    const products = resolver(url);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ products }),
    });
  });
}

test.describe('Tabs Navigation', () => {
  test('all tabs are accessible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Scan a barcode to check EU compliance')).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText(/Sign in to view history|No scans yet/)).toBeVisible();

    await page.getByRole('tab', { name: 'Search' }).click();
    await expect(page.getByText('Search for products')).toBeVisible();

    await page.getByRole('tab', { name: 'Profile' }).click();
    const signedOutState = page.getByText('Not signed in');
    const signedInState = page.getByText('Member since');
    await expect
      .poll(async () => (await signedOutState.isVisible()) || (await signedInState.isVisible()))
      .toBeTruthy();
  });
});

test.describe('Search Features', () => {
  test('shows search empty state and no-results state', async ({ page }) => {
    await mockOffSearch(page, (url) => {
      const searchTerms = url.searchParams.get('search_terms') ?? '';
      if (searchTerms.toLowerCase() === 'unlikely-miss') return [];
      return [];
    });

    await page.goto('/');
    await page.getByRole('tab', { name: 'Search' }).click();

    await expect(page.getByText('Search for products')).toBeVisible();

    const input = page.getByPlaceholder('Search by product name...');
    await input.fill('unlikely-miss');
    await input.press('Enter');

    await expect(page.getByText('No products found')).toBeVisible();
    await expect(page.getByText('Try a different search term.')).toBeVisible();
  });

  test('returns and renders matched products from OFF search', async ({ page }) => {
    await mockOffSearch(page, (url) => {
      const searchTerms = url.searchParams.get('search_terms') ?? '';
      if (searchTerms.toLowerCase() !== 'oreo') return [];

      return [
        {
          code: '1234567890123',
          product_name: 'Oreo Chocolate Sandwich Cookies',
          brands: 'Nabisco',
          stores_tags: ['target'],
          ingredients_text: 'Sugar, wheat flour, palm oil, cocoa processed with alkali',
          additives_tags: [],
          allergens_tags: ['en:gluten'],
        },
      ];
    });

    await page.goto('/');
    await page.getByRole('tab', { name: 'Search' }).click();

    const input = page.getByPlaceholder('Search by product name...');
    await input.fill('oreo');
    await input.press('Enter');

    await expect(page.getByText('Oreo Chocolate Sandwich Cookies')).toBeVisible();
    await expect(page.getByText('Nabisco', { exact: true })).toBeVisible();
  });
});
