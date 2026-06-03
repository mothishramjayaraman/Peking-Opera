import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// load .env so OPENAI_API_KEY is available to auto-playwright
config();

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
});
