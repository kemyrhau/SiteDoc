import { test, expect, detaljUrl, authSti } from "../lib/fixtures";
import { opprettSjekkliste, settStatus } from "../lib/flyt";

// (4) Flytposisjon-headeren rendrer FULL ledd-rad — regresjonsvern for byggLedd.
//     Antall bokser = flytens distinkte roller; aktiv boks matcher ball-holderen.
test.use({ storageState: authSti.firma });

test("flytposisjon-header: full ledd-rad med korrekt aktiv boks", async ({ page, rt, apiFirma }) => {
  const id = await opprettSjekkliste(apiFirma, rt, "flyt");
  await settStatus(apiFirma, id, "sent"); // → received, ballen hos utfører
  await page.goto(detaljUrl(rt, id));

  // Desktop-varianten (sm:block) er synlig; mobil-kompakt er skjult.
  const fi = page.locator('[data-testid="flyt-indikator"]:visible');
  await expect(fi).toHaveAttribute("data-antall-ledd", String(rt.antallLedd));

  const ledd = fi.getByTestId("flyt-ledd");
  await expect(ledd).toHaveCount(rt.antallLedd);
  await expect(fi.locator('[data-testid="flyt-ledd"][data-rolle="registrator"]')).toHaveCount(1);
  await expect(fi.locator('[data-testid="flyt-ledd"][data-rolle="utforer"]')).toHaveCount(1);
  await expect(fi.locator('[data-testid="flyt-ledd"][data-rolle="godkjenner"]')).toHaveCount(1);

  // Nøyaktig én aktiv boks, og den matcher ball-holderen (utfører ved received).
  await expect(fi.locator('[data-testid="flyt-ledd"][data-aktiv="true"]')).toHaveCount(1);
  await expect(
    fi.locator('[data-testid="flyt-ledd"][data-aktiv="true"][data-rolle="utforer"]'),
  ).toHaveCount(1);

  // «Venter på»-chippen bekrefter ball-holderen i headeren.
  await expect(page.getByTestId("venter-paa")).toBeVisible();
});
