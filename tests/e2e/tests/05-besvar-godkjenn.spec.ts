import { test, expect, detaljUrl, authSti, klikkFlythandling } from "../lib/fixtures";
import { opprettSjekkliste, settStatus } from "../lib/flyt";

// (5) Utfører besvarer → dokumentet går FRAMOVER i flyten (badge «Hos N» = received) ;
//     Godkjenn → Godkjent (godkjenner, terminal approved).
//
// MÅLT I CI (2026-09-16, ikke gjettet): når utfører klikker Besvar (handling-responded)
// fra received, lander badgen på `data-status="received"` («Til behandling» / «Hos N»),
// IKKE `responded`. `responded`/«Besvart» er RESERVERT for SENDT BAKOVER (fabel-vedtak
// 02.08; avledStatus gir responded kun ved retning="tilbake"). En besvarelse framover er
// received. Tidligere assertion `responded` sjekket en verdi UI-et ikke produserer for
// denne flyten (samme spec-drift-klasse som 02-opprett). Navnet er endret bort fra
// «→ Besvart» fordi utfallet er «Hos N», ikke «Besvart».
//   MERK til leseren: en statisk lesing av beregnRuting (responded-grenen setter
//   retning="tilbake") FORUTSIER responded — den lesningen holdt IKKE mot kjørende UI.
//   Målingen står; mekanismen (hvorfor utfører-Besvar gir retning≠tilbake) er meldt for
//   et eget blikk, men er utenfor denne spec-rundens mandat (avledStatus/ruting røres ikke).

test.describe("Besvar (utfører)", () => {
  test.use({ storageState: authSti.arbeider });

  test("Besvar → Hos N (received)", async ({ page, rt, apiFirma }) => {
    const id = await opprettSjekkliste(apiFirma, rt, "besvar");
    await settStatus(apiFirma, id, "sent"); // → received, ballen hos arbeider (utfører)
    await page.goto(detaljUrl(rt, id));

    await klikkFlythandling(page, "responded"); // Besvar-knappen
    // Utfører-Besvar bringer dokumentet framover → «Hos N» = received (se filhode).
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", "received");
  });
});

test.describe("Godkjenn (godkjenner)", () => {
  test.use({ storageState: authSti.firma });

  test("Godkjenn → Godkjent", async ({ page, rt, apiFirma }) => {
    const id = await opprettSjekkliste(apiFirma, rt, "godkjenn");
    await settStatus(apiFirma, id, "sent"); // → received
    await settStatus(apiFirma, id, "responded"); // besvart (admin-driver i oppsett)
    await page.goto(detaljUrl(rt, id));

    await klikkFlythandling(page, "approved");
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", "approved");
  });
});
