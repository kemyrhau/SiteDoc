import { describe, it, expect } from "vitest";
import {
  UTLEGG_ORDNINGER,
  erGyldigOrdning,
  utledOrdning,
  baeresAvSheetUtlegg,
  krevesBelop,
  kreverKvittering,
  tillaterKvittering,
  eksportRute,
  type UtleggOrdning,
} from "./utleggOrdning";

/**
 * Utleggs-ordningsmodell — frosne forventninger fra spec 2026-08-08.
 * Kjerne-invarianter: overstyring vinner · default ellers · aldri tvetydig ·
 * fakturert når ALDRI penger · utlegg går til refusjon aldri lønnsart.
 */

describe("utledOrdning — overstyring ?? firma-default", () => {
  it("overstyring vinner når den er satt", () => {
    expect(
      utledOrdning({ firmaDefault: "lonnstillegg", prosjektOverstyring: "utlegg" }),
    ).toBe("utlegg");
    expect(
      utledOrdning({ firmaDefault: "utlegg", prosjektOverstyring: "fakturert" }),
    ).toBe("fakturert");
  });

  it("faller til firma-default når overstyring er null/undefined", () => {
    expect(
      utledOrdning({ firmaDefault: "utlegg", prosjektOverstyring: null }),
    ).toBe("utlegg");
    expect(utledOrdning({ firmaDefault: "lonnstillegg" })).toBe("lonnstillegg");
  });

  it("gir alltid nøyaktig én gyldig ordning (aldri tvetydig)", () => {
    for (const firmaDefault of UTLEGG_ORDNINGER) {
      for (const overstyring of [null, ...UTLEGG_ORDNINGER] as const) {
        const resultat = utledOrdning({
          firmaDefault,
          prosjektOverstyring: overstyring,
        });
        expect(UTLEGG_ORDNINGER).toContain(resultat);
        // Determinisme: samme input → samme output.
        expect(
          utledOrdning({ firmaDefault, prosjektOverstyring: overstyring }),
        ).toBe(resultat);
      }
    }
  });
});

describe("erGyldigOrdning", () => {
  it("godtar de tre lovlige verdiene", () => {
    for (const o of UTLEGG_ORDNINGER) {
      expect(erGyldigOrdning(o)).toBe(true);
    }
  });

  it("avviser ukjente verdier og ikke-strenger", () => {
    // «sats» er den gamle verdien (omdøpt til «lonnstillegg» 2026-08-11) → ugyldig nå.
    expect(erGyldigOrdning("sats")).toBe(false);
    expect(erGyldigOrdning("")).toBe(false);
    expect(erGyldigOrdning(null)).toBe(false);
    expect(erGyldigOrdning(undefined)).toBe(false);
    expect(erGyldigOrdning(1)).toBe(false);
  });
});

describe("avledede regler per ordning", () => {
  // Frossen sannhetstabell — én rad per ordning.
  const tabell: Array<{
    ordning: UtleggOrdning;
    bæres: boolean;
    belop: boolean;
    kreverKvit: boolean;
    tillaterKvit: boolean;
    rute: ReturnType<typeof eksportRute>;
  }> = [
    {
      ordning: "lonnstillegg",
      bæres: false,
      belop: true,
      kreverKvit: false,
      tillaterKvit: false,
      rute: "lonnsart",
    },
    {
      ordning: "utlegg",
      bæres: true,
      belop: true,
      kreverKvit: true,
      tillaterKvit: true,
      rute: "refusjon",
    },
    {
      ordning: "fakturert",
      bæres: true,
      belop: false,
      kreverKvit: false,
      tillaterKvit: true,
      rute: "ingen",
    },
  ];

  for (const rad of tabell) {
    it(`${rad.ordning}: bærer/beløp/kvittering/rute`, () => {
      expect(baeresAvSheetUtlegg(rad.ordning)).toBe(rad.bæres);
      expect(krevesBelop(rad.ordning)).toBe(rad.belop);
      expect(kreverKvittering(rad.ordning)).toBe(rad.kreverKvit);
      expect(tillaterKvittering(rad.ordning)).toBe(rad.tillaterKvit);
      expect(eksportRute(rad.ordning)).toBe(rad.rute);
    });
  }

  it("fakturert når ALDRI penger, og krevesBelop speiler CHECK-constrainten", () => {
    // CHECK: (fakturert AND belop IS NULL) OR (<>fakturert AND belop IS NOT NULL)
    expect(krevesBelop("fakturert")).toBe(false);
    expect(krevesBelop("utlegg")).toBe(true);
    expect(eksportRute("fakturert")).toBe("ingen");
  });

  it("utlegg går til refusjon, aldri lønnsart", () => {
    expect(eksportRute("utlegg")).toBe("refusjon");
    expect(eksportRute("utlegg")).not.toBe("lonnsart");
  });
});
