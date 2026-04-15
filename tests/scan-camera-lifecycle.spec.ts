import { expect, test } from '@playwright/test';
import { readCameraState, stubAuthAndCamera } from './e2e-helpers';

test.describe('Scan Camera Lifecycle', () => {
  test('releases the camera after leaving the Scan route via another tab', async ({ page }) => {
    await stubAuthAndCamera(page);

    await page.goto('/');
    await page.getByRole('tab', { name: 'Scan' }).click();

    await expect(page.getByText('Align barcode within the frame')).toBeVisible();
    await expect
      .poll(async () => (await readCameraState(page))?.getUserMediaCalls ?? 0)
      .toBeGreaterThan(0);

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText(/Sign in to view history|No scans yet/)).toBeVisible();

    await expect.poll(async () => (await readCameraState(page))?.stopCalls ?? 0).toBeGreaterThan(0);
  });

  test('releases the camera after closing the Scan screen with the X button', async ({ page }) => {
    await stubAuthAndCamera(page);

    await page.goto('/');
    await page.getByRole('tab', { name: 'Scan' }).click();

    await expect(page.getByText('Align barcode within the frame')).toBeVisible();
    await expect
      .poll(async () => (await readCameraState(page))?.getUserMediaCalls ?? 0)
      .toBeGreaterThan(0);

    await page.getByLabel('Close scanner').click();
    await expect(page.getByText(/Sign in to view history|No scans yet/)).toBeVisible();

    await expect.poll(async () => (await readCameraState(page))?.stopCalls ?? 0).toBeGreaterThan(0);
  });
});
