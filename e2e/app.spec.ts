import { test, expect } from '@playwright/test';

test.describe('NYX Vox App', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    // Wait for the page to be fully loaded
    await expect(page).toHaveTitle(/NYX/i);
  });

  test('page has expected content structure', async ({ page }) => {
    await page.goto('/');
    // Verify the page loads without errors - check for any visible content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors (e.g., Tauri IPC errors in browser)
    const criticalErrors = errors.filter(
      e => !e.includes('tauri') && !e.includes('invoke')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
