import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { gjenaapneFeilmelding, visSeHeleDagen } from "./gjenaapne";

// ORDRE 2026-11-15 (23): kortskjermen var en blindvei for sendt sedel — ingen
// gjenåpne, ett prosjekt, ingen vei til resten av dagen. Testene under feiler
// hvis gjenåpne eller «Se hele dagen» forsvinner fra kortskjermen, eller hvis
// samlesiden og kortskjermen får hver sin gjenåpne-vei igjen.

const t = (k: string) => `[${k}]`;
const feilMedKode = (code: string, message = "") =>
  Object.assign(new Error(message), { data: { code } });

describe("gjenaapneFeilmelding", () => {
  it("CONFLICT → feilGodkjent", () => {
    expect(gjenaapneFeilmelding(feilMedKode("CONFLICT"), t)).toBe("[timer.gjenaapne.feilGodkjent]");
  });

  it("PRECONDITION_FAILED → laastAttestert", () => {
    expect(gjenaapneFeilmelding(feilMedKode("PRECONDITION_FAILED"), t)).toBe(
      "[timer.gjenaapne.laastAttestert]",
    );
  });

  it("annen kode → serverens melding (f.eks. UNAUTHORIZED ved utløpt innlogging)", () => {
    expect(gjenaapneFeilmelding(feilMedKode("UNAUTHORIZED", "Ikke innlogget"), t)).toBe(
      "Ikke innlogget",
    );
  });

  it("annen kode uten melding → aldri tom streng", () => {
    expect(gjenaapneFeilmelding(feilMedKode("INTERNAL_SERVER_ERROR"), t)).toBe(
      "[timer.gjenaapne.feilNett]",
    );
  });

  it("ingen kode (ingen svar fra serveren) → feilNett", () => {
    expect(gjenaapneFeilmelding(new Error("Network request failed"), t)).toBe(
      "[timer.gjenaapne.feilNett]",
    );
    expect(gjenaapneFeilmelding(null, t)).toBe("[timer.gjenaapne.feilNett]");
  });

  it("negativkontroll: CONFLICT og nettfeil gir ulike tekster", () => {
    expect(gjenaapneFeilmelding(feilMedKode("CONFLICT"), t)).not.toBe(
      gjenaapneFeilmelding(new Error("x"), t),
    );
  });
});

describe("visSeHeleDagen", () => {
  it("flere prosjekter → lenken vises", () => {
    expect(visSeHeleDagen(2)).toBe(true);
    expect(visSeHeleDagen(5)).toBe(true);
  });
  it("negativkontroll: ett eller ingen prosjekt → ingen lenke", () => {
    expect(visSeHeleDagen(1)).toBe(false);
    expect(visSeHeleDagen(0)).toBe(false);
  });
});

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");
const KORTSKJERM = les("../../../../app/timer/[id]/kort/[projectId].tsx");
const SAMLESIDE = les("../../../../app/timer/[id]/prosjektkort.tsx");
const SEDEL_HOOK = les("useProsjektkortSedel.ts");
const DAGSKORT = les("../../../../app/timer/[id].tsx");

describe("ORDRE (23) — vakt: kortskjermen er ikke en blindvei", () => {
  it("negativkontroll: kildene er lest og er de riktige filene", () => {
    expect(KORTSKJERM).toContain("export default function ProsjektkortSkjerm");
    expect(SAMLESIDE).toContain("useProsjektkortSedel");
    expect(DAGSKORT).toContain("gjenaapneDagsseddel");
  });

  it("🔴 kortskjermen har gjenåpne via den delte hooken, med feiltekst", () => {
    expect(KORTSKJERM).toContain("useGjenaapneDagsseddel(sheetId");
    expect(KORTSKJERM).toMatch(/<GjenaapneKnapp[\s\S]*?onGjenaapne=\{gjenaapne\}/);
    expect(KORTSKJERM).toContain("{gjenaapneFeil && <Text");
  });

  it("🔴 kortskjermen har «Se hele dagen» til samlesiden, talt som samlesiden", () => {
    expect(KORTSKJERM).toContain('t("timer.kort.seHeleDagen", { antall: antallProsjekter })');
    expect(KORTSKJERM).toContain("router.dismissTo(`/timer/${sheetId}/prosjektkort`)");
    expect(KORTSKJERM).toMatch(
      /kortProsjektIder\(\s*sedel\.projectId,\s*\[timerRader, maskinRader, tilleggRader, utleggRader\]/,
    );
    expect(SEDEL_HOOK).toMatch(
      /kortProsjektIder\(\s*sedel\.projectId,\s*\[timerRader, maskinRader, tilleggRader, utleggRader\]/,
    );
  });

  it("🔴 samlesiden og kortskjermen deler én gjenåpne-vei (ingen egen mutasjon igjen)", () => {
    expect(SEDEL_HOOK).toContain("useGjenaapneDagsseddel(sheetId");
    expect(SEDEL_HOOK).not.toContain("gjenaapneDagsseddel.useMutation");
    expect(KORTSKJERM).not.toContain("gjenaapneDagsseddel.useMutation");
    expect(SAMLESIDE).toContain("<GjenaapneKnapp");
  });

  it("🔴 dagskortet beholder sin egen gjenåpne og bruker ikke de nye filene", () => {
    expect(DAGSKORT).toContain("gjenaapneDagsseddel.useMutation");
    for (const navn of ["useGjenaapneDagsseddel", "GjenaapneKnapp", "seHeleDagen", "visSeHeleDagen"]) {
      expect(DAGSKORT).not.toContain(navn);
    }
  });
});
