import { test, expect } from "@playwright/test"

// Dashboard tests — assumes user is authenticated via Clerk
// Run with: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // In CI, authentication state would be set via storageState or a test Clerk account
    // For local testing, assumes user is already signed in
    await page.goto("/dashboard")
  })

  test("affiche les 4 KPI cards", async ({ page }) => {
    await expect(page.getByText("No-shows cette semaine")).toBeVisible()
    await expect(page.getByText("RDV confirmés")).toBeVisible()
    await expect(page.getByText("Avis Google ce mois")).toBeVisible()
    await expect(page.getByText("Revenus récupérés")).toBeVisible()
  })

  test("affiche la section Aujourd'hui", async ({ page }) => {
    await expect(page.getByText(/Aujourd'hui/i)).toBeVisible()
  })

  test("affiche la section Actions requises", async ({ page }) => {
    await expect(page.getByText("Actions requises")).toBeVisible()
  })

  test("affiche le feed d'activité récente", async ({ page }) => {
    await expect(page.getByText("Activité récente")).toBeVisible()
  })
})
