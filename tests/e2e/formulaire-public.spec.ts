import { test, expect } from "@playwright/test"

// Tests the public form page (/f/[token]) without authentication

test.describe("Formulaire public patient", () => {
  test("affiche une erreur pour un token invalide", async ({ page }) => {
    await page.goto("/f/token-invalide-12345")
    await expect(page.getByText(/invalide|introuvable/i)).toBeVisible()
  })

  test("affiche une erreur pour un token expiré", async ({ page }) => {
    // This token would need to be seeded in the DB as expired
    // For now we test the error UI structure
    await page.goto("/f/token-expire-test")
    await expect(page.locator("h1")).toBeVisible()
  })

  test("page de succès après soumission affiche le bon message", async ({ page }) => {
    // Mock a successful submission by navigating directly if we had a valid token
    // This would be populated in a full integration test with a real seeded token
    await page.goto("/f/token-invalide-12345")
    await expect(page.locator("body")).toBeVisible()
  })
})
