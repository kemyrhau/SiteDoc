import { test, expect, listeUrl, authSti } from "../lib/fixtures";

// (1) Innlogging via dev-login-token → dashbord/prosjekt laster.
test.use({ storageState: authSti.firma });

test("innlogging via dev-login-token → dashbord laster", async ({ page, rt }) => {
  await page.goto("/dashbord");
  await expect(page).not.toHaveURL(/logg-inn/);

  // Prosjektets sjekkliste-side: verktøylinja beviser auth + prosjekt-tilgang.
  await page.goto(listeUrl(rt));
  await expect(page.getByTestId("verktoy-ny-sjekkliste")).toBeVisible();
});
