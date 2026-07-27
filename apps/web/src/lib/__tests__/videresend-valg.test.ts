import { describe, it, expect } from "vitest";
import { filtrerVideresendPaaMedlemskap, type VideresendValg } from "@/lib/videresend-valg";

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
