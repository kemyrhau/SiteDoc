import { describe, it, expect, vi } from "vitest";
import { fullforVedleggUrl, type VedleggFullforingSteg } from "./vedleggFullforing";

/**
 * Oppfølger RETUR svart gjenåpning (Kontrollør-gate 483e7057): `publiserFullfort` gjorde skjemaet
 * rått FØR `patchVedleggUrl` var ferdig → en annotering åpnet i vinduet kunne refetche før serveren
 * hadde stien, og fornyelsen fant ingen signert URL. Nå publiseres det etter patchen.
 * Rød før: rekkefølgen lå inline i OpplastingsKoProvider (publiser → patch).
 */

function steg(over: Partial<VedleggFullforingSteg> = {}) {
  const logg: string[] = [];
  const s: VedleggFullforingSteg = {
    harDokument: true,
    oppdaterSqlite: () => (logg.push("sqlite"), true),
    patchServer: async () => (logg.push("patch"), true),
    publiser: () => void logg.push("publiser"),
    slettLokal: async () => void logg.push("slett"),
    beholdLokal: () => void logg.push("behold"),
    ...over,
  };
  return { s, logg };
}

describe("fullforVedleggUrl — skjemaet blir rått først når serveren har stien", () => {
  it("publiser kommer ETTER at server-patchen er ferdig", async () => {
    let slipp: (v: boolean) => void = () => {};
    const publiser = vi.fn();
    const { s } = steg({ patchServer: () => new Promise<boolean>((r) => (slipp = r)), publiser });
    const ferdig = fullforVedleggUrl(s);
    await Promise.resolve();
    expect(publiser).not.toHaveBeenCalled(); // patchen er fortsatt i flukt
    slipp(true);
    await ferdig;
    expect(publiser).toHaveBeenCalledTimes(1);
  });

  it("rekkefølge: sqlite → patch → publiser → slett", async () => {
    const { s, logg } = steg();
    await fullforVedleggUrl(s);
    expect(logg).toEqual(["sqlite", "patch", "publiser", "slett"]);
  });

  it("patch feiler/kaster → publiserer likevel (SQLite har URL-en), sletter fordi SQLite er ok", async () => {
    const { s, logg } = steg({ patchServer: async () => { logg.push("patch"); throw new Error("nett"); } });
    expect(await fullforVedleggUrl(s)).toEqual({ sqliteOk: true, serverOk: false });
    expect(logg).toEqual(["sqlite", "patch", "publiser", "slett"]);
  });

  it("verken SQLite eller server → lokalfila beholdes", async () => {
    const { s, logg } = steg({ oppdaterSqlite: () => (logg.push("sqlite"), false), patchServer: async () => (logg.push("patch"), false) });
    await fullforVedleggUrl(s);
    expect(logg).toEqual(["sqlite", "patch", "publiser", "behold"]);
  });

  it("uten dokument-id: ingen patch", async () => {
    const { s, logg } = steg({ harDokument: false });
    await fullforVedleggUrl(s);
    expect(logg).toEqual(["sqlite", "publiser", "slett"]);
  });
});
