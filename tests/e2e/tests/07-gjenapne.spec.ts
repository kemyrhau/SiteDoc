import { test, expect, detaljUrl, authSti, klikkFlythandling } from "../lib/fixtures";
import { opprettSjekkliste, settStatus } from "../lib/flyt";

// (7) Gjenåpne fra Lukket. Handlingen er `handling-draft` (Gjenåpne-knappen sender
//     endreStatus med nyStatus="draft"), MEN badgen lander på «Hos N» = received, IKKE
//     «Utkast». Målt mot modellen (ikke gjettet):
//       beregnRuting (flytFakta.ts:184-209): en åpner-drevet draft-overgang setter
//       sendt=true + retning="frem" (gjenåpnet er en tidslinjehendelse, ingen statusfakta),
//       og terminal ryddes → avledStatus (flytPosisjon.ts:225): terminal=null, sendt=true,
//       retning≠"tilbake" → status="received", visning="hos".
//     Et gjenåpnet dokument er tilbake i flyten hos noen — «Hos N» er korrekt oppførsel.
//     Dette er SPEC-DRIFT (spec fulgte den gamle closed→«Utkast»-lesningen), ikke en
//     modellfeil. Tidligere assertion `data-status="draft"` sjekket en verdi modellen
//     sluttet å produsere ved gjenåpning (samme klasse som 02-opprett).
test.use({ storageState: authSti.firma });

test("Gjenåpne fra Lukket → Hos N (received)", async ({ page, rt, apiFirma }) => {
  const id = await opprettSjekkliste(apiFirma, rt, "gjenapne");
  // Driv til closed via lovlige overganger (admin-driver i oppsett).
  for (const s of ["sent", "responded", "approved", "closed"]) {
    await settStatus(apiFirma, id, s);
  }
  await page.goto(detaljUrl(rt, id));

  const badge = page.getByTestId("status-badge").first();
  await expect(badge).toHaveAttribute("data-status", "closed");

  await klikkFlythandling(page, "draft");
  // Gjenåpning gir «Hos N» (received), ikke «Utkast» — se filhode.
  await expect(badge).toHaveAttribute("data-status", "received");
});
