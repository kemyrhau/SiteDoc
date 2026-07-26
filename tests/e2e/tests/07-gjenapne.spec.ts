import { test, expect, detaljUrl, authSti } from "../lib/fixtures";
import { opprettSjekkliste, settStatus } from "../lib/flyt";

// (7) Gjenåpne fra Lukket → Utkast (closed → draft).
test.use({ storageState: authSti.firma });

test("Gjenåpne fra Lukket → Utkast", async ({ page, rt, apiFirma }) => {
  const id = await opprettSjekkliste(apiFirma, rt, "gjenapne");
  // Driv til closed via lovlige overganger (admin-driver i oppsett).
  for (const s of ["sent", "responded", "in_progress", "closed"]) {
    await settStatus(apiFirma, id, s);
  }
  await page.goto(detaljUrl(rt, id));

  const badge = page.getByTestId("status-badge").first();
  await expect(badge).toHaveAttribute("data-status", "closed");

  await page.getByTestId("handling-draft").click();
  await expect(badge).toHaveAttribute("data-status", "draft");
});
