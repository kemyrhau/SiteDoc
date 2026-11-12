import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// V21 RETUR punkt 1 — overtidsforslagets to deler skal få SAMME byggeplass.
//
// Overtid-delen lagres alltid som ny rad (`tilfoy`), og må derfor sende
// dialogens byggeplass (`bp.byggeplassId`). Uendret felt → den er lik radens
// egen; endret felt → den nye, akkurat som normal-delen får via
// `byggeplassPayload(bp)`. Vakten FEILER hvis overtid-delen igjen leser
// `rad.byggeplassId` (gammel byggeplass når brukeren byttet i samme dialog).
// Komponenten trenger tRPC + kontekst, så vi vokter kilden som de andre
// timer-vaktene i stedet for å rendre dialogen.

const KILDE = readFileSync(
  new URL("../app/dashbord/timer/[id]/page.tsx", import.meta.url),
  "utf-8",
);

/** `brukOvertidForslag` (indre funksjon i TimerRadDialog), kollapset til én linje. */
function brukOvertidForslagSlice(): string {
  const start = KILDE.indexOf("async function brukOvertidForslag(");
  if (start === -1) throw new Error("Fant ikke brukOvertidForslag");
  const slutt = KILDE.indexOf("function validerSkjema(", start);
  if (slutt === -1) throw new Error("Fant ikke slutten på brukOvertidForslag");
  return KILDE.slice(start, slutt).replace(/\s+/g, " ");
}

describe("V21 — overtid-delen får dialogens byggeplass", () => {
  const slice = brukOvertidForslagSlice();

  it("overtid-delen leser aldri radens lagrede byggeplass", () => {
    expect(slice).not.toMatch(/rad\.byggeplassId/);
  });

  it("overtid-tilfoy sender bp.byggeplassId sammen med overtid-lønnsarten", () => {
    expect(slice).toMatch(
      /lonnsartId: f\.overtidLonnsart\.id, \.\.\.f\.overtid, (?:\/\/[^,]*?\. )?byggeplassId: bp\.byggeplassId,/,
    );
  });
});
