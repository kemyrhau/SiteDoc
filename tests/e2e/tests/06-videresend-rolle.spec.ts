import { test, expect, detaljUrl, authSti } from "../lib/fixtures";
import { opprettSjekkliste, settStatus } from "../lib/flyt";
import { BASE_URL } from "../lib/miljo";

// (6) Videresend-synlighet per rolle — regresjonsvern for H3.
//     Prosjektadmin (firma) ser Videresend; menig utfører (arbeider) gjør det ikke.
test.use({ storageState: authSti.firma });

test("videresend synlig for admin, skjult for utfører (H3)", async ({ page, rt, apiFirma, browser }) => {
  const id = await opprettSjekkliste(apiFirma, rt, "videresend");
  await settStatus(apiFirma, id, "sent"); // → received

  // Firma (prosjektadmin): videresend-nedtrekket er synlig.
  await page.goto(detaljUrl(rt, id));
  await expect(page.getByTestId("handling-videresend-nedtrekk")).toBeVisible();

  // Arbeider (utfører, non-admin): Besvar synlig, men INGEN videresend.
  const ctx = await browser.newContext({ storageState: authSti.arbeider, baseURL: BASE_URL });
  try {
    const arbeiderPage = await ctx.newPage();
    await arbeiderPage.goto(detaljUrl(rt, id));
    await expect(arbeiderPage.getByTestId("handling-responded")).toBeVisible();
    await expect(arbeiderPage.getByTestId("handling-videresend-nedtrekk")).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});
