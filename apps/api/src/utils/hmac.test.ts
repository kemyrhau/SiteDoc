import { describe, it, expect } from "vitest";
import {
  signerFilSti,
  normaliserFilSti,
  vurderUploadsFilForesporsel,
  signerHvisPrivat,
} from "./hmac";

/**
 * Sikkerhetskontrakt for `/uploads/`-signaturgaten.
 *
 * Sti-traverserings-herding (hastefiks 2026-08-11): gate-hooken sjekket
 * `startsWith` på RÅ url, mens fastifyStatic normaliserte og serverte likevel.
 * `/uploads/./x`, `/uploads//x` og `/uploads/a/../x` slapp forbi gaten.
 *
 * 🔴 S1 Fase 1b (2026-09-24): gaten dekker nå HELE `/uploads/` (default-deny),
 * ikke bare `privat/`. Enhver `/uploads/`-sti uten gyldig signatur → 401.
 */

const KANONISK = "/uploads/privat/abc-123.jpg";

function query(signert: string): string {
  return signert.slice(signert.indexOf("?"));
}

describe("normaliserFilSti — kanonisk-kompatibilitet", () => {
  it("kanonisk sti er en no-op (signerte lenker forblir gyldige)", () => {
    expect(normaliserFilSti(KANONISK)).toBe(KANONISK);
  });

  it("kollapser alle tre omgåelsesformene til kanonisk", () => {
    expect(normaliserFilSti("/uploads//privat/abc-123.jpg")).toBe(KANONISK);
    expect(normaliserFilSti("/uploads/./privat/abc-123.jpg")).toBe(KANONISK);
    expect(normaliserFilSti("/uploads/x/../privat/abc-123.jpg")).toBe(KANONISK);
    expect(normaliserFilSti("/uploads/privat/%2e%2e/privat/abc-123.jpg")).not.toContain("..");
  });
});

describe("vurderUploadsFilForesporsel — gate", () => {
  it("kanonisk lenke med gyldig signatur → ok (compat bevist)", () => {
    const signert = signerFilSti(KANONISK, 60_000);
    expect(vurderUploadsFilForesporsel(signert)).toEqual({ type: "ok" });
  });

  it("cosmetisk /./ på en GYLDIG lenke slipper også gjennom (sjekken KJØRER nå)", () => {
    const q = query(signerFilSti(KANONISK, 60_000));
    expect(vurderUploadsFilForesporsel("/uploads/./privat/abc-123.jpg" + q)).toEqual({ type: "ok" });
  });

  // De tre omgåelsene UTEN gyldig signatur → 401 (var 200 før fiksen).
  it.each([
    ["/uploads//privat/abc-123.jpg"],
    ["/uploads/./privat/abc-123.jpg"],
    ["/uploads/x/../privat/abc-123.jpg"],
  ])("omgåelse uten signatur avvises: %s", (url) => {
    expect(vurderUploadsFilForesporsel(url)).toEqual({ type: "avvist", kode: 401 });
  });

  it("«for alltid»-utnyttelsen: UTLØPT signatur + /./ avvises (var kjernefeilen)", () => {
    // Korrekt signatur, men utløpt (negativ levetid → exp i fortiden).
    const utlopt = signerFilSti(KANONISK, -1000);
    const q = query(utlopt);
    expect(vurderUploadsFilForesporsel("/uploads/./privat/abc-123.jpg" + q)).toEqual({
      type: "avvist",
      kode: 401,
    });
  });

  it("kanonisk uten signatur → 401", () => {
    expect(vurderUploadsFilForesporsel(KANONISK)).toEqual({ type: "avvist", kode: 401 });
  });

  it("🔴 Fase 1b: ikke-privat /uploads/* uten signatur → 401 (var «slipp» i Fase 1)", () => {
    // Kjernen i S1-hullet fra 2026-08-15: offentlig-treet ble servert rått.
    expect(vurderUploadsFilForesporsel("/uploads/offentlig.jpg")).toEqual({
      type: "avvist",
      kode: 401,
    });
  });

  it("🔴 Fase 1b: ikke-privat /uploads/* MED gyldig signatur → ok", () => {
    const signert = signerFilSti("/uploads/offentlig.jpg", 60_000);
    expect(vurderUploadsFilForesporsel(signert)).toEqual({ type: "ok" });
  });

  it("ikke-uploads slippes", () => {
    expect(vurderUploadsFilForesporsel("/api/trpc/noe")).toEqual({ type: "slipp" });
  });

  it("ugyldig prosentkoding → 400 (kaster ikke)", () => {
    expect(vurderUploadsFilForesporsel("/uploads/privat/%ZZ.jpg")).toEqual({
      type: "avvist",
      kode: 400,
    });
  });

  it("dobbeltkodet %252e under /uploads/ → 401 (dekod ÉN gang, men treet er gatet)", () => {
    // `%252e` dekodes ÉN gang → `%2e` (literal tekst, ikke «.»). Gaten dekoder
    // ALDRI mer aggressivt enn fastifyStatic (som også dekoder én gang og slår
    // opp et mappenavn «%2e» som ikke finnes → 404). Stien starter med
    // `/uploads/` → under default-deny KREVES signatur → 401. (I Fase 1, da kun
    // `privat/` var gatet, ga denne «slipp»; nå fanges hele treet.)
    expect(vurderUploadsFilForesporsel("/uploads/%252e/privat/abc-123.jpg")).toEqual({
      type: "avvist",
      kode: 401,
    });
  });
});

describe("signerFilSti — standard-levetid (E = 15 min)", () => {
  it("🔴 default-levetid er ~15 min (E-vedtak 2026-09-24), ikke lenger 5", () => {
    const foer = Date.now();
    const signert = signerFilSti("/uploads/privat/x.jpg");
    const exp = Number(new URLSearchParams(signert.slice(signert.indexOf("?") + 1)).get("exp"));
    const levetidMin = (exp - foer) / 60000;
    expect(levetidMin).toBeGreaterThan(14);
    expect(levetidMin).toBeLessThanOrEqual(15.1);
  });
});

describe("signerHvisPrivat — hele /uploads/ + idempotens (Fase 1b)", () => {
  const erSignert = (u: string) => /\?exp=\d+&sig=/.test(u);

  it("signerer privat-URL (uendret atferd)", () => {
    const ut = signerHvisPrivat("/uploads/privat/x.jpg") as string;
    expect(ut.startsWith("/uploads/privat/x.jpg?")).toBe(true);
    expect(erSignert(ut)).toBe(true);
  });

  it("🔴 signerer nå OGSÅ ikke-privat /uploads/ (var no-op i Fase 1)", () => {
    const ut = signerHvisPrivat("/uploads/offentlig.jpg") as string;
    expect(ut.startsWith("/uploads/offentlig.jpg?")).toBe(true);
    expect(erSignert(ut)).toBe(true);
  });

  it("lar ikke-/uploads/-URL-er stå (tom, ekstern, absolutt)", () => {
    expect(signerHvisPrivat("")).toBe("");
    expect(signerHvisPrivat("https://ekstern/uploads/x.jpg")).toBe("https://ekstern/uploads/x.jpg");
    expect(signerHvisPrivat("/api/annet")).toBe("/api/annet");
    expect(signerHvisPrivat(null)).toBeNull();
    expect(signerHvisPrivat(undefined)).toBeUndefined();
  });

  it("🔴 idempotens: en alt signert URL dobbeltsigneres IKKE", () => {
    const engang = signerHvisPrivat("/uploads/privat/x.jpg") as string;
    const togang = signerHvisPrivat(engang) as string;
    expect(togang).toBe(engang); // uendret — nøyaktig samme streng, ingen andre sig=
    expect((togang.match(/sig=/g) ?? []).length).toBe(1);
  });
});
