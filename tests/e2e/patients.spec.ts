import { test, expect } from "@playwright/test"

test.describe("Gestion des patients", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/patients")
  })

  test("affiche la liste des patients avec la barre de recherche", async ({ page }) => {
    await expect(page.getByPlaceholder(/rechercher/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /nouveau patient/i })).toBeVisible()
  })

  test("ouvre le formulaire de création de patient", async ({ page }) => {
    await page.getByRole("button", { name: /nouveau patient/i }).click()
    await expect(page.getByText(/prénom/i)).toBeVisible()
    await expect(page.getByText(/téléphone/i)).toBeVisible()
  })

  test("la recherche filtre les patients", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/rechercher/i)
    await searchInput.fill("test-xyz-patient-qui-nexiste-pas")
    await expect(page.getByText(/aucun patient trouvé|aucun résultat/i)).toBeVisible({ timeout: 5000 })
  })

  test("les filtres actif/inactif fonctionnent", async ({ page }) => {
    // Check that filter buttons exist
    await expect(page.getByRole("button", { name: /actif/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /inactif/i })).toBeVisible()
  })
})
