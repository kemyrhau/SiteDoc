import { describe, it, expect } from "vitest";
import {
  formaterDatoTid,
  formaterDatoTidKort,
  formaterDatoTidPunkt,
  formaterDato,
  formaterDatoKort,
  byggGrenseVerdi,
} from "./hjelpere";
import { genererSluttrapportHtml } from "./sluttrapport";

/**
 * Negativ kontroll for tidssone-buggen (funn 2026-09-02):
 * server-rendrede tidsstempler var 2t bak norsk sommertid fordi formatererne
 * manglet `timeZone`. Testen låser at et kjent UTC-instant rendres i norsk tid
 * UAVHENGIG av serverens default-sone.
 *
 * 🔴 Kjør denne med `TZ=UTC` for å reprodusere serveren (Etc/UTC). På en
 * Oslo-maskin er den grønn både før og etter fiksen og beviser ingenting —
 * derfor MÅ negativ-kontrollen kjøres under UTC. Se ordre-punkt [4].
 *
 * 2026-08-13T11:38:00Z:
 *   sommertid (CEST, UTC+2) → 13:38 den 13.08.2026
 * 2026-01-15T11:38:00Z:
 *   vintertid  (CET,  UTC+1) → 12:38 den 15.01.2026
 */
describe("tidssone — server-rendrede instant-stempler skal vise norsk tid", () => {
  const sommerInstant = "2026-08-13T11:38:00Z";
  const vinterInstant = "2026-01-15T11:38:00Z";

  it("formaterDatoTidKort: sommertid UTC+2", () => {
    expect(formaterDatoTidKort(sommerInstant)).toBe("13.08.2026, 13:38");
  });

  it("formaterDatoTidKort: vintertid UTC+1", () => {
    expect(formaterDatoTidKort(vinterInstant)).toBe("15.01.2026, 12:38");
  });

  it("formaterDatoTidPunkt (logg/signatur/footer-format): sommertid UTC+2", () => {
    expect(formaterDatoTidPunkt(sommerInstant)).toBe("13.08.2026 13:38");
  });

  it("formaterDatoTid (lang): sommertid UTC+2", () => {
    expect(formaterDatoTid(sommerInstant)).toContain("13:38");
  });

  it("formaterDato (dato ved midnatt-UTC): sonekorrekt dag", () => {
    // 22:30 UTC 12. aug = 00:30 Oslo 13. aug → norsk dato er den 13.
    expect(formaterDato("2026-08-12T22:30:00Z")).toBe("13. august 2026");
  });

  it("formaterDatoKort (dato ved midnatt-UTC): sonekorrekt dag", () => {
    expect(formaterDatoKort("2026-08-12T22:30:00Z")).toBe("13.08.2026");
  });
});

/**
 * Sluttrapportens godkjent-dato hadde samme mangel via en annen mekanisme
 * (`getDate()`/`getMonth()` = server-lokal tid, ikke `toLocale*`). Delegerer nå
 * til `formaterDatoKort`. Samme UTC-låste negativ-kontroll: 22:30 UTC 12. aug =
 * 00:30 Oslo 13. aug → norsk dato er den 13. Rød under TZ=UTC før fiks.
 */
describe("tidssone — sluttrapport godkjent-dato skal vise norsk dato", () => {
  it("godkjentDato ved midnatt-UTC rendres som norsk dag i HTML", () => {
    const html = genererSluttrapportHtml({
      kontrollplanNavn: "K",
      byggeplassNavn: "B",
      kontrollomrade: null,
      dato: "2026-08-13",
      punkter: [
        {
          omradeNavn: "Område",
          malNavn: "Mal",
          status: "godkjent",
          faggruppe: "Tømrer",
          godkjentDato: "2026-08-12T22:30:00Z",
          avvikKommentarer: [],
        },
      ],
      prosjekt: { name: "Testprosjekt" },
      innstillinger: null,
    });
    expect(html).toContain("13.08.2026");
    expect(html).not.toContain("12.08.2026");
  });
});

/**
 * Grenseresolver trinn 3 del A — tre tilstander (mockup `PDF Grensekrav Mockup`).
 * «UTENFOR KRAV»-semantikken skal bæres av ORDET, ikke fargen (s/h-print).
 */
describe("byggGrenseVerdi — kravsnapshot i tre tilstander", () => {
  it("innenfor: verdi + dempet «· krav …», ingen brudd-ord", () => {
    const html = byggGrenseVerdi("148 mm", { kravTekst: "140–160 mm", status: "ok" });
    expect(html).toContain("148 mm");
    expect(html).toContain("· krav 140–160 mm");
    expect(html).not.toMatch(/KRAV<|OVER|UNDER|UTENFOR/);
  });

  it("utenfor (over): verdi + «— OVER KRAV» fet amber + dempet «(krav …)»", () => {
    const html = byggGrenseVerdi("14 mm", { kravTekst: "≤ 10 mm", status: "over" });
    expect(html).toContain("14 mm — OVER KRAV");
    expect(html).toContain("(krav ≤ 10 mm)");
    expect(html).toContain("font-weight:700"); // ordet er fett — s/h-trygt
  });

  it("retningen skilles: under → UNDER KRAV, toleranse → UTENFOR TOLERANSE", () => {
    expect(byggGrenseVerdi("93 %", { kravTekst: "≥ 95 %", status: "under" })).toContain("UNDER KRAV");
    expect(byggGrenseVerdi("5 mm", { kravTekst: "± 3 mm", status: "utenfor_toleranse" })).toContain(
      "UTENFOR TOLERANSE",
    );
  });

  it("tom med grense: «Ikke utfylt» + kravet vises likevel (F7)", () => {
    const html = byggGrenseVerdi(null, { kravTekst: "≤ 15 mm", status: null });
    expect(html).toContain("Ikke utfylt");
    expect(html).toContain("(krav ≤ 15 mm)");
  });

  it("uten snapshot: ren verdi (eldre maler uten grense)", () => {
    expect(byggGrenseVerdi("42 mm", undefined)).toBe("42 mm");
    expect(byggGrenseVerdi(null, undefined)).toContain("Ikke utfylt");
  });

  it("kompakt (repeater-celle): behold brudd-ord, dropp kravtekst", () => {
    const html = byggGrenseVerdi("14 mm", { kravTekst: "≤ 10 mm", status: "over" }, { kompakt: true });
    expect(html).toContain("14 mm — OVER KRAV");
    expect(html).not.toContain("(krav");
    // innenfor kompakt → ren verdi, ingen krav-støy i tabellen
    expect(byggGrenseVerdi("148 mm", { kravTekst: "140–160 mm", status: "ok" }, { kompakt: true })).toBe(
      "148 mm",
    );
  });
});
