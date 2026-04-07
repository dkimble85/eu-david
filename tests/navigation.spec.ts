import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { stubSignedInAuth } from './e2e-helpers';

const OFF_SEARCH_PATH = '**/api/v2/search?*';
const OBF_SEARCH_PATH = '**://world.openbeautyfacts.org/api/v2/search?*';
const OPF_SEARCH_PATH = '**://world.openproductsfacts.org/api/v2/search?*';
const USDA_SEARCH_PATH = '**://api.nal.usda.gov/fdc/v1/foods/search?*';

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

async function mockNonOffSearchSourcesEmpty(page: Page) {
  await page.route(OBF_SEARCH_PATH, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ products: [] }),
    });
  });

  await page.route(OPF_SEARCH_PATH, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ products: [] }),
    });
  });

  await page.route(USDA_SEARCH_PATH, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ foods: [] }),
    });
  });
}

test.describe('Tabs Navigation', () => {
  test('all tabs are accessible', async ({ page }) => {
    await stubSignedInAuth(page);
    await page.goto('/');

    await expect(page.getByLabel('Close scanner')).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText('History')).toBeVisible();

    await page.getByRole('tab', { name: 'Search' }).click();
    await expect(page.getByText('Search for products')).toBeVisible();

    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByText('Member since')).toBeVisible();
  });
});

test.describe('Search Features', () => {
  test('shows search empty state and no-results state', async ({ page }) => {
    await stubSignedInAuth(page);
    await mockNonOffSearchSourcesEmpty(page);
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
    await stubSignedInAuth(page);
    await mockNonOffSearchSourcesEmpty(page);
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
