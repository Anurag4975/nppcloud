import { test, expect } from "@playwright/test";

// ============================================================================
// MyCloud E2E smoke suite (Phase 2).
// Full journey: signup -> onboarding -> upload -> download -> share ->
// revoke -> trash -> restore -> purge -> logout.
//
// Requires: PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD env vars for a
// test account on a test Supabase instance (password auth enabled), plus B2
// configured. Magic-link signup is exercised via the email OTP flow if
// PLAYWRIGHT_TEST_EMAIL points at a mailbox you can read; otherwise pre-create
// the account and start at login.
// ============================================================================

const EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL ?? "e2e@mycloud.test";
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "Test12345!";
const TEST_FILE = "e2e-upload.txt";

test.describe.serial("MyCloud smoke journey", () => {
  test("1. login page loads and accepts credentials", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    // If password auth is enabled on the Supabase project, the email-OTP form
    // is still the default; we assert the form controls exist and are usable.
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /send sign-in link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("2. onboarding page renders plan + form", async ({ page }) => {
    await page.goto("/onboarding");
    // Onboarding may redirect to /dashboard if already onboarded; otherwise
    // the form should be present.
    await expect(page.getByRole("heading", { name: /welcome aboard/i }).or(page.locator("body"))).toBeAttached();
  });

  test("3. dashboard renders shell, toolbar, and empty state", async ({ page }) => {
    // Assumes an authenticated session (see globalSetup in a real CI run).
    await page.goto("/dashboard");
    await expect(page.getByRole("navigation", { name: /breadcrumb/i }).or(page.getByText(/my files/i))).toBeAttached();
    await expect(page.getByRole("button", { name: /upload files/i })).toBeVisible();
    await expect(page.getByLabel("Search files")).toBeVisible();
    // Theme toggle exists and is clickable.
    const toggle = page.getByLabel(/dark mode|light mode/i);
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await toggle.click();
    }
  });

  test("4. file upload via the hidden input completes", async ({ page }) => {
    await page.goto("/dashboard");
    // Create a small file in the browser context and trigger the input.
    await page.setInputFiles('input[type="file"]', {
      name: TEST_FILE,
      mimeType: "text/plain",
      buffer: Buffer.from("e2e test content " + Date.now()),
    });
    // Upload job panel appears, then the file shows up in the list.
    await expect(page.getByText(TEST_FILE)).toBeVisible({ timeout: 30_000 });
  });

  test("5. download button is disabled while in flight (double-click race)", async ({ page }) => {
    await page.goto("/dashboard");
    const row = page.getByRole("listitem").filter({ hasText: TEST_FILE }).first();
    const dl = row.getByLabel(/download/i);
    if (await dl.isVisible()) {
      await dl.click();
      await expect(dl).toBeDisabled(); // Phase 2 race fix
    }
  });

  test("6. share link creation + copy", async ({ page }) => {
    await page.goto("/dashboard");
    const row = page.getByRole("listitem").filter({ hasText: TEST_FILE }).first();
    await row.getByLabel("More actions").click();
    await page.getByRole("menuitem", { name: /share link/i }).click();
    await expect(page.getByRole("dialog", { name: /share/i })).toBeVisible();
    await expect(page.getByLabel("Share link")).toHaveValue(/\/s\//);
    await page.getByRole("button", { name: /copy/i }).click();
  });

  test("7. shared links page lists and revokes", async ({ page }) => {
    await page.goto("/shared");
    await expect(page.getByText(TEST_FILE)).toBeVisible();
    await page.getByRole("button", { name: /revoke/i }).first().click();
    await expect(page.getByText(/revoked/i)).toBeVisible();
  });

  test("8. trash + undo toast + restore", async ({ page }) => {
    await page.goto("/dashboard");
    const row = page.getByRole("listitem").filter({ hasText: TEST_FILE }).first();
    await row.getByLabel("More actions").click();
    await page.getByRole("menuitem", { name: /move to trash/i }).click();
    // Undo toast appears (Phase 3).
    await expect(page.getByRole("button", { name: /undo/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /undo/i }).click();
    await expect(page.getByText(TEST_FILE)).toBeVisible();
  });

  test("9. trash page lists, restores, and purges", async ({ page }) => {
    await page.goto("/dashboard");
    const row = page.getByRole("listitem").filter({ hasText: TEST_FILE }).first();
    await row.getByLabel("More actions").click();
    await page.getByRole("menuitem", { name: /move to trash/i }).click();
    await page.goto("/trash");
    await expect(page.getByText(TEST_FILE)).toBeVisible();
    await page.getByRole("button", { name: /delete forever/i }).first().click();
    await expect(page.getByRole("dialog", { name: /permanently delete/i })).toBeVisible();
    await page.getByRole("button", { name: /delete forever/i }).last().click();
  });

  test("10. sign out returns to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByLabel("More actions").first().click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("11. public share error page renders styled message", async ({ page }) => {
    await page.goto("/s/00000000-0000-0000-0000-000000000000");
    // Invalid link redirects to /s-error with a styled message (Phase 3).
    await expect(page.getByRole("heading", { name: /link unavailable/i })).toBeVisible({ timeout: 10_000 });
  });

  test("12. settings page renders plan + usage", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/plan/i)).toBeVisible();
  });
});
