import { test, expect, detaljUrl, authSti } from "../lib/fixtures";
import { opprettSjekkliste, settStatus } from "../lib/flyt";

// (5) Besvar → Besvart (utfører) ; Godkjenn → Godkjent (godkjenner).
//     Hver handling utføres av den semantisk korrekte rollen i UI.

test.describe("Besvar (utfører)", () => {
  test.use({ storageState: authSti.arbeider });

  test("Besvar → Besvart", async ({ page, rt, apiFirma }) => {
    const id = await opprettSjekkliste(apiFirma, rt, "besvar");
    await settStatus(apiFirma, id, "sent"); // → received, ballen hos arbeider (utfører)
    await page.goto(detaljUrl(rt, id));

    await page.getByTestId("handling-responded").click();
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", "responded");
  });
});

test.describe("Godkjenn (godkjenner)", () => {
  test.use({ storageState: authSti.firma });

  test("Godkjenn → Godkjent", async ({ page, rt, apiFirma }) => {
    const id = await opprettSjekkliste(apiFirma, rt, "godkjenn");
    await settStatus(apiFirma, id, "sent"); // → received
    await settStatus(apiFirma, id, "responded"); // besvart (admin-driver i oppsett)
    await page.goto(detaljUrl(rt, id));

    await page.getByTestId("handling-approved").click();
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", "approved");
  });
});
