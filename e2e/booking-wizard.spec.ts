import { test, expect } from '@playwright/test';

test.describe('Booking Wizard UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('loads initial availability and switches timezones correctly', async ({ page }) => {
    // Check initial title and wizard visibility
    await expect(page.locator('h2')).toContainText('Schedule a Session');

    // Verify timezone dropdown exists and default can be changed
    const timezoneSelect = page.locator('select');
    await expect(timezoneSelect).toBeVisible();
    await timezoneSelect.selectOption('America/New_York');

    // Ensure slot grid updates dynamically
    const availableSlots = page.locator('button:has-text("AM"), button:has-text("PM")');
    await expect(availableSlots.first()).toBeVisible();
  });

  test('completes full booking reservation flow', async ({ page }) => {
    // Select first available time slot
    const firstSlot = page.locator('button:enabled:has-text("AM"), button:enabled:has-text("PM")').first();
    await firstSlot.click();

    // Fill customer contact information
    await page.fill('input[placeholder="Alex Morgan"]', 'Playwright Tester');
    await page.fill('input[placeholder="alex@example.com"]', 'e2e@example.com');

    // Submit reservation
    await page.click('button:has-text("Confirm Reservation")');

    // Validate confirmation screen
    await expect(page.locator('h3')).toContainText('Booking Confirmed');
    await expect(page.locator('text=e2e@example.com')).toBeVisible();
  });
});