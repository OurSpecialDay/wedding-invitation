import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

const localE2eEnvFile = '.env.e2e.local'
if (existsSync(localE2eEnvFile)) loadEnvFile(localE2eEnvFile)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    reducedMotion: 'reduce',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})
