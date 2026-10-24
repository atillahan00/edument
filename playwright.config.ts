import { defineConfig } from '@playwright/test';
import './apps/api/src/config';
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'tr-TR',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  timeout: 60000,
});
