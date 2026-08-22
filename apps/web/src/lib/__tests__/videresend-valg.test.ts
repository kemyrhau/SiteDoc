import { describe, it, expect } from "vitest";
import { filtrerVideresendPaaMedlemskap, finnStandardMottaker, type VideresendValg } from "@/lib/videresend-valg";

/**
 * H3 (videresend-rettighet, 2026-07-26): videresend-mottakerlista begrenses til flyter
 * avsenderen selv er medlem av — ikke-admin ser kun egne, admin ser full liste.
 */

function valg(dokumentflytId: string): VideresendValg {
  return {
    key: dokumentflytId,
    faggruppeId: `fg-${dokumentflytId}`,
    faggruppeNavn: `Faggruppe ${dokumentflytId}`,
    dokumentflytId,
    dokumentflytNavn: `Flyt ${dokumentflytId}`,
    visningsnavn: `Faggruppe ${dokumentflytId}`,
    medlemmer: [],
  };
}

const alle = [valg("a"), valg("b"), valg("c")];

describe("filtrerVideresendPaaMedlemskap — medlemskaps-filter", () => {
  it("ikke-admin: kun flyter avsenderen er medlem av", () => {
    const resultat = filtrerVideresendPaaMedlemskap(alle, new Set(["a", "c"]), false);
    expect(resultat.map((v) => v.dokumentflytId)).toEqual(["a", "c"]);
  });

  it("ikke-admin uten medlemskap: tom liste (lekkasjen lukket)", () => {
    expect(filtrerVideresendPaaMedlemskap(alle, new Set(), false)).toEqual([]);
  });

  it("admin: full liste uansett medlemskap (kryssflyt er legitim admin-handling)", () => {
    const resultat = filtrerVideresendPaaMedlemskap(alle, new Set(), true);
    expect(resultat.map((v) => v.dokumentflytId)).toEqual(["a", "b", "c"]);
  });
});

/**
 * finnStandardMottaker — FLYT-BEVISST standard-mottaker for «Besvar» (funn 2026-08-22).
 * To flyter i samme faggruppe (samme mal) → to oppføringer med samme faggruppeId, ulik
 * dokumentflytId. Oppslag på faggruppeId alene (.find = første treff) kunne rute til feil
 * flyts mottaker. Dokumentets EGEN flyt skal avgjøre.
 */
describe("finnStandardMottaker — flyt-bevisst standard-mottaker", () => {
  const v = (dokumentflytId: string, faggruppeId: string, userId: string): VideresendValg => ({
    key: `${faggruppeId}__${dokumentflytId}`,
    faggruppeId,
    faggruppeNavn: faggruppeId,
    dokumentflytId,
    dokumentflytNavn: dokumentflytId,
    visningsnavn: `${faggruppeId}/${dokumentflytId}`,
    mottaker: { userId },
    medlemmer: [],
  });
  // To flyter (A, B) i SAMME faggruppe fg-1, + en annen faggruppe fg-2.
  const valg = [v("flyt-A", "fg-1", "u-A"), v("flyt-B", "fg-1", "u-B"), v("flyt-C", "fg-2", "u-C")];

  it("dokumentets EGEN flyt velger riktig oppføring — IKKE første faggruppe-treff", () => {
    // Dokumentet er i flyt-B (andre oppføring for fg-1). Faggruppe-match ville gitt flyt-A.
    expect(finnStandardMottaker(valg, "flyt-B", "fg-1")?.mottaker?.userId).toBe("u-B");
    expect(finnStandardMottaker(valg, "flyt-A", "fg-1")?.mottaker?.userId).toBe("u-A");
  });

  it("flyt-løst dokument (ingen aktivDokumentflytId) → fallback til faggruppeId (første treff)", () => {
    expect(finnStandardMottaker(valg, undefined, "fg-1")?.dokumentflytId).toBe("flyt-A");
    expect(finnStandardMottaker(valg, undefined, "fg-2")?.mottaker?.userId).toBe("u-C");
  });

  it("ukjent flyt / ingen match → undefined", () => {
    expect(finnStandardMottaker(valg, "flyt-X", "fg-1")).toBeUndefined();
    expect(finnStandardMottaker(valg, undefined, undefined)).toBeUndefined();
  });
});
