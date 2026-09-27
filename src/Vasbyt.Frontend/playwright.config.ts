import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 90_000,
  use: { baseURL: process.env['DEMO_URL'] ?? 'http://127.0.0.1:5080',
    viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure',
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] } },
});
