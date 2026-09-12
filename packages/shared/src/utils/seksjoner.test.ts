import { describe, it, expect } from "vitest";
import {
  grupperMedOverskrift,
  beregnSeksjonUtfylling,
  kanSlasSammen,
  nesteKollapsTilstand,
  type SeksjonTilstand,
} from "./seksjoner";

type O = { id: string; type: string; parentId?: string | null };
const o = (id: string, type: string, parentId: string | null = null): O => ({ id, type, parentId });

describe("grupperMedOverskrift", () => {
  it("felter før første heading blir ledende seksjon (overskrift null)", () => {
    const s = grupperMedOverskrift([o("1", "location"), o("2", "text_field")]);
    expect(s).toHaveLength(1);
    expect(s[0]!.overskrift).toBeNull();
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["1", "2"]);
  });

  it("hver rot-heading starter ny seksjon, felter til neste heading", () => {
    const s = grupperMedOverskrift([
      o("h1", "heading"),
      o("a", "decimal"),
      o("b", "text_field"),
      o("h2", "heading"),
      o("c", "integer"),
    ]);
    expect(s).toHaveLength(2);
    expect(s[0]!.overskrift?.id).toBe("h1");
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["a", "b"]);
    expect(s[1]!.overskrift?.id).toBe("h2");
    expect(s[1]!.felter.map((f) => f.id)).toEqual(["c"]);
  });

  it("ledende felter + påfølgende heading-seksjon", () => {
    const s = grupperMedOverskrift([o("loc", "location"), o("h1", "heading"), o("a", "decimal")]);
    expect(s).toHaveLength(2);
    expect(s[0]!.overskrift).toBeNull();
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["loc"]);
    expect(s[1]!.overskrift?.id).toBe("h1");
  });

  it("nestet heading (har parentId) er IKKE seksjonsgrense — forblir inline-felt", () => {
    const s = grupperMedOverskrift([
      o("h1", "heading"),
      o("rep", "repeater"),
      o("nested", "heading", "rep"), // barn-heading
      o("a", "decimal"),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]!.overskrift?.id).toBe("h1");
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["rep", "nested", "a"]);
  });

  it("tom liste → ingen seksjoner", () => {
    expect(grupperMedOverskrift([])).toEqual([]);
  });

  // Krav 3 (runde 91): undertittel er også en rot-seksjonsgrense (flat, samme nivå).
  it("rot-undertittel starter ny seksjon, felter til neste grense", () => {
    const s = grupperMedOverskrift([
      o("s1", "subtitle"),
      o("a", "decimal"),
      o("s2", "subtitle"),
      o("b", "integer"),
    ]);
    expect(s).toHaveLength(2);
    expect(s[0]!.overskrift?.id).toBe("s1");
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["a"]);
    expect(s[1]!.overskrift?.id).toBe("s2");
    expect(s[1]!.felter.map((f) => f.id)).toEqual(["b"]);
  });

  it("undertittel slutter ved neste undertittel OG ved neste overskrift", () => {
    const s = grupperMedOverskrift([
      o("h1", "heading"),
      o("a", "decimal"),
      o("s1", "subtitle"),
      o("b", "text_field"),
      o("h2", "heading"), // overskrift lukker undertittel-seksjonen
      o("c", "integer"),
    ]);
    expect(s.map((x) => x.overskrift?.id)).toEqual(["h1", "s1", "h2"]);
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["a"]);
    expect(s[1]!.felter.map((f) => f.id)).toEqual(["b"]);
    expect(s[2]!.felter.map((f) => f.id)).toEqual(["c"]);
  });

  it("nestet undertittel (har parentId) er IKKE seksjonsgrense", () => {
    const s = grupperMedOverskrift([
      o("h1", "heading"),
      o("rep", "repeater"),
      o("nested", "subtitle", "rep"),
      o("a", "decimal"),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]!.overskrift?.id).toBe("h1");
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["rep", "nested", "a"]);
  });
});

describe("kanSlasSammen (Krav 2 — standard er PÅ)", () => {
  it("mangler feltet i config → foldbar (standard true)", () => {
    expect(kanSlasSammen({})).toBe(true);
    expect(kanSlasSammen(undefined)).toBe(true);
    expect(kanSlasSammen(null)).toBe(true);
    expect(kanSlasSammen({ helpText: "x" })).toBe(true);
  });

  it("kun eksplisitt false slår folding av", () => {
    expect(kanSlasSammen({ kanSlasSammen: false })).toBe(false);
    expect(kanSlasSammen({ kanSlasSammen: true })).toBe(true);
  });

  // NEGATIV KONTROLL (Krav 2): en overskrift UTEN feltet i config skal forbli foldbar.
  // Snus standardverdien (fravær → false), FEILER denne. Vaktposten mot regresjon.
  it("negativ kontroll: en overskrift uten config-flagg er foldbar", () => {
    const overskriftUtenFlagg = { type: "heading", config: {} as Record<string, unknown> };
    expect(kanSlasSammen(overskriftUtenFlagg.config)).toBe(true);
  });
});

describe("nesteKollapsTilstand (Krav 1 — auto-kollaps ved fullført)", () => {
  const s = (id: string, tilstand: SeksjonTilstand, kanFoldes = true) => ({ id, tilstand, kanFoldes });

  it("overgang TIL komplett folder seksjonen", () => {
    const neste = nesteKollapsTilstand(
      [s("a", "komplett")],
      new Map<string, SeksjonTilstand>([["a", "delvis"]]),
      new Set(),
    );
    expect(neste.has("a")).toBe(true);
  });

  it("fyrer bare på overgangen — allerede komplett + åpnet av bruker forblir åpen", () => {
    // forrige = komplett, nå = komplett → ingen overgang → kollaps-settet uendret.
    const neste = nesteKollapsTilstand(
      [s("a", "komplett")],
      new Map<string, SeksjonTilstand>([["a", "komplett"]]),
      new Set(), // brukeren har åpnet den igjen
    );
    expect(neste.has("a")).toBe(false);
  });

  it("et tømt felt (komplett → delvis) åpner seksjonen igjen", () => {
    const neste = nesteKollapsTilstand(
      [s("a", "delvis")],
      new Map<string, SeksjonTilstand>([["a", "komplett"]]),
      new Set(["a"]),
    );
    expect(neste.has("a")).toBe(false);
  });

  it("tom folder ALDRI", () => {
    const neste = nesteKollapsTilstand(
      [s("a", "tom")],
      new Map<string, SeksjonTilstand>([["a", "urort"]]),
      new Set(),
    );
    expect(neste.has("a")).toBe(false);
  });

  it("ikke-foldbar seksjon holdes alltid åpen", () => {
    const neste = nesteKollapsTilstand(
      [s("a", "komplett", false)],
      new Map<string, SeksjonTilstand>([["a", "delvis"]]),
      new Set(["a"]),
    );
    expect(neste.has("a")).toBe(false);
  });

  it("første måling (ingen forrige) folder ingenting", () => {
    const neste = nesteKollapsTilstand(
      [s("a", "komplett")],
      new Map<string, SeksjonTilstand>(),
      new Set(),
    );
    expect(neste.has("a")).toBe(false);
  });
});

describe("beregnSeksjonUtfylling", () => {
  // Default: alle felt synlige, ingen verdi. Overstyr per test via `verdier`/`skjult`.
  const status =
    (verdier: Set<string> = new Set(), skjult: Set<string> = new Set()) =>
    (felt: O) =>
      skjult.has(felt.id)
        ? { synlig: false, harVerdi: false }
        : { synlig: true, harVerdi: verdier.has(felt.id) };

  it("urørt: tellbare felt uten verdi → 0 av N, tilstand urort", () => {
    const r = beregnSeksjonUtfylling([o("a", "decimal"), o("b", "text_field")], status());
    expect(r).toEqual({ utfylt: 0, totalt: 2, tilstand: "urort" });
  });

  it("delvis: noen verdier", () => {
    const r = beregnSeksjonUtfylling(
      [o("a", "decimal"), o("b", "text_field"), o("c", "integer")],
      status(new Set(["a"])),
    );
    expect(r).toEqual({ utfylt: 1, totalt: 3, tilstand: "delvis" });
  });

  it("komplett: alle synlige felt har verdi", () => {
    const r = beregnSeksjonUtfylling(
      [o("a", "decimal"), o("b", "text_field")],
      status(new Set(["a", "b"])),
    );
    expect(r).toEqual({ utfylt: 2, totalt: 2, tilstand: "komplett" });
  });

  it("display-/visnings-typer teller ikke (heading/subtitle/calculation/info_text/video)", () => {
    const r = beregnSeksjonUtfylling(
      [
        o("h", "heading"),
        o("s", "subtitle"),
        o("calc", "calculation"),
        o("info", "info_text"),
        o("img", "info_image"),
        o("vid", "video"),
        o("loc", "location"),
        o("pos", "drawing_position"),
        o("a", "decimal"),
      ],
      status(new Set(["a"])),
    );
    expect(r).toEqual({ utfylt: 1, totalt: 1, tilstand: "komplett" });
  });

  it("betinget skjulte felt teller ikke i nevneren", () => {
    // b er skjult → nevner = 1 (kun a). a har verdi → komplett, ikke «1 av 2».
    const r = beregnSeksjonUtfylling(
      [o("a", "decimal"), o("b", "text_field")],
      status(new Set(["a"]), new Set(["b"])),
    );
    expect(r).toEqual({ utfylt: 1, totalt: 1, tilstand: "komplett" });
  });

  it("felt som returnerer null (repeater-barn) teller ikke", () => {
    const r = beregnSeksjonUtfylling(
      [o("rep", "repeater"), o("barn", "text_field", "rep")],
      (felt) => (felt.parentId ? null : { synlig: true, harVerdi: false }),
    );
    expect(r).toEqual({ utfylt: 0, totalt: 1, tilstand: "urort" });
  });

  it("kun display-felt → totalt 0, tilstand tom (ingen badge)", () => {
    const r = beregnSeksjonUtfylling([o("h", "heading"), o("info", "info_text")], status());
    expect(r).toEqual({ utfylt: 0, totalt: 0, tilstand: "tom" });
  });
});
