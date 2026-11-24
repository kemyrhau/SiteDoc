import { describe, it, expect } from "vitest";
import {
  arbeidsraderForMaskin,
  erArbeidsradForMaskin,
  forvalgtTimeradId,
  timeradSperre,
  type TimeradKandidat,
} from "./maskinTimerad";

// Kort-id d2c-2 (R24, H15 = A): rene regler for maskinvinduets «Timerad».
// Samme utfall som PC (d2c-1, `MaskinRadDialog`).

const rad = (id: string, over: Partial<TimeradKandidat> = {}): TimeradKandidat => ({
  id,
  projectId: "p1",
  kortId: "k1",
  timer: 4,
  erReise: false,
  fraTid: "07:00",
  tilTid: "11:00",
  ...over,
});

describe("erArbeidsradForMaskin", () => {
  it("arbeidsrad med timer er gyldig", () => expect(erArbeidsradForMaskin(rad("a"))).toBe(true));
  it("reise er ikke arbeidsrad", () => expect(erArbeidsradForMaskin(rad("a", { erReise: true }))).toBe(false));
  it("0 timer er ikke arbeidsrad", () => expect(erArbeidsradForMaskin(rad("a", { timer: 0 }))).toBe(false));
  it("fravær uten prosjekt er ikke arbeidsrad", () =>
    expect(erArbeidsradForMaskin(rad("a", { projectId: null }))).toBe(false));
});

describe("arbeidsraderForMaskin", () => {
  it("filtrerer bort ugyldige og sorterer på fra-tid, uten tid sist", () => {
    const ut = arbeidsraderForMaskin([
      rad("uten-tid", { fraTid: null, tilTid: null }),
      rad("sen", { fraTid: "12:00" }),
      rad("reise", { erReise: true }),
      rad("tidlig", { fraTid: "06:00" }),
    ]);
    expect(ut.map((r) => r.id)).toEqual(["tidlig", "sen", "uten-tid"]);
  });
});

describe("forvalgtTimeradId", () => {
  it("maskinens egen kobling vinner når den er blant kandidatene", () =>
    expect(forvalgtTimeradId("b", [rad("a"), rad("b")])).toBe("b"));
  it("én arbeidsrad er forvalgt", () => expect(forvalgtTimeradId(null, [rad("a")])).toBe("a"));
  it("flere arbeidsrader: ingen forvalg", () => expect(forvalgtTimeradId(null, [rad("a"), rad("b")])).toBeNull());
  it("kobling som ikke lenger er kandidat faller til forvalget", () =>
    expect(forvalgtTimeradId("borte", [rad("a")])).toBe("a"));
});

describe("timeradSperre", () => {
  it("timepris uten valgt rad: «velg» når det finnes arbeidsrader", () =>
    expect(timeradSperre("time", null, [rad("a"), rad("b")])).toBe("velg"));
  it("timepris uten arbeidsrader: «ingenArbeidsrad»", () => expect(timeradSperre("time", null, [])).toBe("ingenArbeidsrad"));
  it("ukjent enhet krever timerad (H15 = A)", () => expect(timeradSperre(null, null, [])).toBe("ingenArbeidsrad"));
  it("gyldig valg slipper gjennom", () => expect(timeradSperre("time", "a", [rad("a")])).toBeNull());
  it("døgn-maskin kan stå uten timerad", () => expect(timeradSperre("doegn", null, [])).toBeNull());
  it("døgn-maskin med ugyldig valg avvises (som serveren)", () =>
    expect(timeradSperre("doegn", "borte", [rad("a")])).toBe("velg"));
});
