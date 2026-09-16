import { test, expect, detaljUrl, authSti, klikkFlythandling } from "../lib/fixtures";
import { opprettSjekkliste, settStatus } from "../lib/flyt";

// (5) Besvar → Besvart (utfører) ; Godkjenn → Godkjent (godkjenner).
//     Hver handling utføres av den semantisk korrekte rollen i UI.
//
// MEKANISME-FUNN (2026-09-16, cowork-gate): en tidligere «fix» satte assertionen til
// `received` fordi CI målte received etter et Besvar-klikk. Rotårsaken var IKKE at Besvar
// gir received — modellen er koherent (beregnRuting:176-183 → retning="tilbake";
// avledStatus:232 → responded). Rotårsaken var at Besvar KREVER begrunnelse
// (STATUS_KREVER_BEGRUNNELSE ⊇ "responded"), så handlingsmenyen åpner en begrunnelse-dialog
// i stedet for å fyre mutasjonen (DokumentHandlingsmeny.tsx:570-574). Spec-en klikket bare
// knappen og leste badgen UMIDDELBART — dialogen ble aldri sendt, dokumentet ble stående på
// `received` (tilstanden etter `sent`), og `received`-assertionen var grønn AV FEIL GRUNN.
// Riktig test fullfører Besvar (fyller begrunnelsen + sender) og asserterer `responded`.

test.describe("Besvar (utfører)", () => {
  test.use({ storageState: authSti.arbeider });

  test("Besvar → Besvart", async ({ page, rt, apiFirma }) => {
    const id = await opprettSjekkliste(apiFirma, rt, "besvar");
    await settStatus(apiFirma, id, "sent"); // → received, ballen hos arbeider (utfører)
    await page.goto(detaljUrl(rt, id));

    // Besvar krever begrunnelse → knappen åpner en dialog (fyrer IKKE mutasjonen).
    await klikkFlythandling(page, "responded");
    // Fyll den påkrevde begrunnelsen og send (Enter sender når feltet ikke er tomt,
    // DokumentHandlingsmeny.tsx:645). Uten dette fullføres Besvar aldri.
    const begrunnelse = page.getByPlaceholder("Skriv en begrunnelse...");
    await begrunnelse.fill("e2e besvart");
    await begrunnelse.press("Enter");

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

    await klikkFlythandling(page, "approved");
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", "approved");
  });
});
