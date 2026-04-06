import { defineConfig, devices } from '@playwright/test';

const webPort = Number(process.env.PW_WEB_PORT ?? 4173);
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: webUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `PW_WEB_PORT=${webPort} node scripts/serve-web-tests.mjs`,
    url: webUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
