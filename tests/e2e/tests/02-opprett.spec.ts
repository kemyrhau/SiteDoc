import { test, expect, listeUrl, authSti } from "../lib/fixtures";
import { E2E_MAL_NAVN } from "../lib/flyt";

// (2) Opprett sjekkliste via UI (registrator, standard flyt) → status Utkast.
test.use({ storageState: authSti.firma });

test("opprett sjekkliste (UI) → Utkast", async ({ page, rt }) => {
  await page.goto(listeUrl(rt));

  await page.getByTestId("verktoy-ny-sjekkliste").click();
  // Steg 1: velg mal (selekteres på navn — data vi styrer, språk-uavhengig).
  await page.getByRole("button", { name: E2E_MAL_NAVN }).click();

  // Enkelt-flyt → opprettes direkte. Faller flyt-velger-steget inn, bekreft.
  const bekreft = page.getByTestId("opprett-flyt-bekreft");
  if (await bekreft.isVisible().catch(() => false)) await bekreft.click();

  await expect(page).toHaveURL(/\/sjekklister\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", "draft");
});
