import { describe, it, expect } from "vitest";
import {
  grupperØkter,
  tellFeltendringer,
  finnSistEndret,
  byggArkivLogg,
  oppsummerLoggverdi,
  avledHandling,
  tolkInnstillinger,
  type HendelseRad,
  type RåEndring,
} from "@sitedoc/pdf";

/**
 * Rent lag — arkivmal-combineren. Ingen DB, ingen mocks: bare determinismen
 * i gruppering, kryssreferanse-halens intervall-kanter og innstillings-tolken.
 */

const h = (tidspunkt: string, aktor = "A"): HendelseRad => ({
  tidspunkt,
  aktor,
  handling: "Sendt",
  kilde: "transfer",
  antallFeltendringer: 0,
});

const e = (userId: string, tidspunkt: string, felt = "F"): RåEndring => ({
  userId,
  aktor: userId,
  tidspunkt,
  felt,
  fraVerdi: null,
  tilVerdi: "x",
});

describe("grupperØkter — økt = (person, dag)", () => {
  it("to endringer samme dag+person → én økt, selv med timer imellom", () => {
    const økter = grupperØkter([
      e("u1", "2026-08-10T08:00:00.000Z"),
      e("u1", "2026-08-10T15:00:00.000Z"),
    ]);
    expect(økter).toHaveLength(1);
    expect(økter[0]!.rader).toHaveLength(2);
    expect(økter[0]!.dato).toBe("2026-08-10");
  });

  it("samme person ulik dag → to økter", () => {
    const økter = grupperØkter([
      e("u1", "2026-08-10T23:00:00.000Z"),
      e("u1", "2026-08-11T01:00:00.000Z"),
    ]);
    expect(økter).toHaveLength(2);
  });

  it("ulik person samme dag → to økter", () => {
    const økter = grupperØkter([
      e("u1", "2026-08-10T10:00:00.000Z"),
      e("u2", "2026-08-10T10:00:00.000Z"),
    ]);
    expect(økter).toHaveLength(2);
  });

  it("økter sorteres etter første endring; rader kronologisk innad", () => {
    const økter = grupperØkter([
      e("u2", "2026-08-11T09:00:00.000Z", "sen"),
      e("u1", "2026-08-10T12:00:00.000Z", "b"),
      e("u1", "2026-08-10T09:00:00.000Z", "a"),
    ]);
    expect(økter[0]!.userId).toBe("u1");
    expect(økter[0]!.rader.map((r) => r.felt)).toEqual(["a", "b"]);
    expect(økter[1]!.userId).toBe("u2");
  });
});

describe("tellFeltendringer — intervall (forrige, denne], øvre inklusiv", () => {
  it("endring i SAMME sekund som en hendelse hører til den hendelsen (øvre-inklusiv)", () => {
    const ut = tellFeltendringer(
      [h("2026-08-10T10:00:00.000Z"), h("2026-08-10T12:00:00.000Z")],
      [e("u1", "2026-08-10T12:00:00.000Z")],
    );
    expect(ut[0]!.antallFeltendringer).toBe(0);
    expect(ut[1]!.antallFeltendringer).toBe(1);
  });

  it("endringer før første hendelse fanges av første (-∞, første]", () => {
    const ut = tellFeltendringer(
      [h("2026-08-10T12:00:00.000Z")],
      [e("u1", "2026-08-10T08:00:00.000Z"), e("u1", "2026-08-10T09:00:00.000Z")],
    );
    expect(ut[0]!.antallFeltendringer).toBe(2);
  });

  it("endringer mellom to hendelser hører til den ETTERFØLGENDE", () => {
    const ut = tellFeltendringer(
      [h("2026-08-10T10:00:00.000Z"), h("2026-08-10T14:00:00.000Z")],
      [e("u1", "2026-08-10T12:00:00.000Z")],
    );
    expect(ut[0]!.antallFeltendringer).toBe(0);
    expect(ut[1]!.antallFeltendringer).toBe(1);
  });

  it("endringer etter siste hendelse er foreldreløse — telles ikke", () => {
    const ut = tellFeltendringer(
      [h("2026-08-10T10:00:00.000Z")],
      [e("u1", "2026-08-10T18:00:00.000Z")],
    );
    expect(ut[0]!.antallFeltendringer).toBe(0);
  });

  it("muterer ikke input", () => {
    const inn = [h("2026-08-10T10:00:00.000Z")];
    tellFeltendringer(inn, [e("u1", "2026-08-10T09:00:00.000Z")]);
    expect(inn[0]!.antallFeltendringer).toBe(0);
  });
});

describe("byggArkivLogg — endringslogg av/på", () => {
  it("av → ingen økter, ingen haler, men hendelser + sistEndret består", () => {
    const logg = byggArkivLogg({
      hendelser: [h("2026-08-10T10:00:00.000Z", "Ola")],
      endringer: [e("u1", "2026-08-10T09:00:00.000Z")],
      endringsloggAktivert: false,
    });
    expect(logg.økter).toHaveLength(0);
    expect(logg.hendelser?.[0]?.antallFeltendringer).toBe(0);
    expect(logg.sistEndret).toEqual({ navn: "Ola", dato: "2026-08-10T10:00:00.000Z" });
  });

  it("på → økter + haler + sistEndret = seneste på tvers", () => {
    const logg = byggArkivLogg({
      hendelser: [h("2026-08-10T10:00:00.000Z")],
      endringer: [e("u1", "2026-08-10T09:00:00.000Z"), e("u1", "2026-08-11T09:00:00.000Z", "sen")],
      endringsloggAktivert: true,
    });
    expect(logg.økter).toHaveLength(2);
    // 09:00 fanges av hendelsen 10:00; 11.aug er foreldreløs (etter siste hendelse)
    expect(logg.hendelser?.[0]?.antallFeltendringer).toBe(1);
    expect(logg.sistEndret?.dato).toBe("2026-08-11T09:00:00.000Z");
  });
});

describe("oppsummerLoggverdi — funn 6: ingen rå repeater-JSON i loggen", () => {
  const repeaterJson = JSON.stringify([
    { "cfa02a84-uuid": { verdi: "Rad 1", kommentar: "", vedlegg: [] },
      "c3eaa1ef-uuid": { verdi: [{ id: "x", type: "bilde", url: "/uploads/abc.png", filnavn: "annotert.png" }], kommentar: "", vedlegg: [] } },
    { "cfa02a84-uuid": { verdi: "Rad 2", kommentar: "", vedlegg: [] },
      "c3eaa1ef-uuid": { verdi: [{ id: "y", type: "bilde", url: "/uploads/def.jpg", filnavn: "IMG.jpg" }], kommentar: "", vedlegg: [] } },
  ]);

  it("repeater-verdi → «N rader (M bilder)», aldri UUID/uploads-sti", () => {
    const ut = oppsummerLoggverdi(repeaterJson);
    expect(ut).toBe("2 rader (2 bilder)");
    expect(ut).not.toContain("uuid");
    expect(ut).not.toContain("/uploads");
  });

  it("én rad uten bilde → «1 rad»", () => {
    expect(oppsummerLoggverdi(JSON.stringify([{ f: { verdi: "x" } }]))).toBe("1 rad");
  });

  it("primitiv verdi passerer uendret (vanlig feltendring)", () => {
    expect(oppsummerLoggverdi("OK")).toBe("OK");
    expect(oppsummerLoggverdi("Ikke OK")).toBe("Ikke OK");
  });

  it("array av primitiver (list_multi) passerer uendret", () => {
    expect(oppsummerLoggverdi('["OK","Delvis"]')).toBe('["OK","Delvis"]');
  });

  it("tom array + null + tom streng → null («Ikke utfylt»)", () => {
    expect(oppsummerLoggverdi("[]")).toBeNull();
    expect(oppsummerLoggverdi(null)).toBeNull();
    expect(oppsummerLoggverdi("")).toBeNull();
  });

  it("ugyldig JSON passerer uendret (ingen kast)", () => {
    expect(oppsummerLoggverdi("[ikke json")).toBe("[ikke json");
  });

  it("byggArkivLogg oppsummerer repeater-endring i øktene (ingen rå JSON)", () => {
    const e: RåEndring = {
      userId: "u", aktor: "A", tidspunkt: "2026-08-15T09:00:00.000Z",
      felt: "Kontrollpunkter", fraVerdi: null, tilVerdi: repeaterJson,
    };
    const logg = byggArkivLogg({ hendelser: [], endringer: [e], endringsloggAktivert: true });
    const rad = logg.økter?.[0]?.rader?.[0];
    expect(rad?.tilVerdi).toBe("2 rader (2 bilder)");
    expect(JSON.stringify(logg)).not.toContain("/uploads");
  });
});

describe("finnSistEndret", () => {
  it("tom → null", () => {
    expect(finnSistEndret([])).toBeNull();
  });
});

describe("avledHandling — gjenbruker status-modellen", () => {
  it.each([
    ["draft", "sent", "Sendt"],
    ["sent", "received", "Mottatt"],
    ["received", "responded", "Besvart"],
    ["responded", "approved", "Godkjent"],
    ["received", "rejected", "Avvist"],
    ["approved", "draft", "Gjenåpnet"],
    ["received", "draft", "Trukket tilbake"],
  ])("%s → %s = %s", (fra, til, forventet) => {
    expect(avledHandling(fra, til)).toBe(forventet);
  });
});

describe("tolkInnstillinger — default true + sporbarhetsminimum", () => {
  it("uspesifisert → alle presentasjons-nøkler true", () => {
    const i = tolkInnstillinger(null);
    expect(i.logo).toBe(true);
    expect(i.vaer).toBe(true);
  });

  it("eksplisitt false respekteres for presentasjon", () => {
    const i = tolkInnstillinger({ logo: false, vaer: false });
    expect(i.logo).toBe(false);
    expect(i.vaer).toBe(false);
  });

  it("sporbarhetsminimum er alltid på", () => {
    const i = tolkInnstillinger({ logo: false });
    expect(i.statusblokk).toBe(true);
    expect(i.signaturblokk).toBe(true);
    expect(i.generertStempel).toBe(true);
    expect(i.dokumentnummer).toBe(true);
  });

  it("eksport tvinger sidetall på uansett", () => {
    expect(tolkInnstillinger(null, { eksport: true, visSidenummer: false }).visSidenummer).toBe(true);
    expect(tolkInnstillinger(null, { visSidenummer: false }).visSidenummer).toBe(false);
  });
});
