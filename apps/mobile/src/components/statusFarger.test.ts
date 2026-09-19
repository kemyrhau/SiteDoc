import { describe, it, expect } from "vitest";
import { DOCUMENT_STATUSES, noeytralEtikett, perspektivEtikett, type BadgeVariant } from "@sitedoc/shared";
import { statusMerkelappInfo, variantKlasse } from "./statusFarger";

/**
 * Paritetsvakt (designnotat-statusfarger-paritet § 3/§ 8): mobil-merkelappen skal
 * gi SAMME farge og etikett som web for hver dokumentstatus. Mobil hadde egne
 * farger — indigo for `received`/`in_progress`, lilla for `responded`, og
 * «Mottatt» på `in_progress` (Runde-2). Denne testen er rød mot den tilstanden:
 * den låser mobil til web-`Badge`s fem farger og til det nøytrale oppslaget.
 *
 * `WEB_BADGE` speiler `packages/ui/src/badge.tsx` NØYAKTIG — kilden mobil skal
 * matche. Endres web-`Badge`, må denne (og `statusFarger.ts`) følge.
 */
const WEB_BADGE: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  primary: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-700",
};

/** Fasit fra ordren § «Fasit», nøytral kolonne (lister/filtre/tidslinjer). */
const NOEYTRAL_FASIT: Record<string, { noekkel: string; variant: BadgeVariant }> = {
  draft: { noekkel: "status.utkast", variant: "default" },
  sent: { noekkel: "status.sendt", variant: "primary" },
  received: { noekkel: "status.mottatt", variant: "primary" },
  in_progress: { noekkel: "status.underArbeid", variant: "primary" },
  responded: { noekkel: "status.besvart", variant: "primary" },
  approved: { noekkel: "status.godkjent", variant: "success" },
  dismissed: { noekkel: "status.avvist", variant: "danger" },
  rejected: { noekkel: "status.avvist", variant: "danger" }, // legacy (F3), dismissed er kanonisk
  closed: { noekkel: "status.lukket", variant: "default" },
  cancelled: { noekkel: "status.avbrutt", variant: "danger" },
};

describe("statusMerkelappInfo — mobil ↔ web fargeparitet (nøytral)", () => {
  for (const status of DOCUMENT_STATUSES) {
    it(`${status}: samme farge og nøkkel som fasiten`, () => {
      const info = statusMerkelappInfo(status);
      const fasit = NOEYTRAL_FASIT[status];
      expect(fasit, `mangler fasit for ${status}`).toBeDefined();
      expect(info.noekkel).toBe(fasit.noekkel);
      // Mobil-klassene skal være NØYAKTIG web-`Badge`s klasser for varianten.
      expect(`${info.bg} ${info.tekstFarge}`).toBe(WEB_BADGE[fasit.variant]);
    });
  }

  it("indigo og lilla finnes ikke lenger noe sted", () => {
    for (const status of DOCUMENT_STATUSES) {
      const info = statusMerkelappInfo(status);
      expect(info.bg).not.toContain("indigo");
      expect(info.bg).not.toContain("purple");
    }
  });

  it("variantKlasse speiler web-Badge for alle fem variantene", () => {
    for (const [variant, klasse] of Object.entries(WEB_BADGE)) {
      const k = variantKlasse(variant as BadgeVariant);
      expect(`${k.bg} ${k.tekstFarge}`).toBe(klasse);
    }
  });
});

/**
 * TEKSTBEVIS (DoD 3) — genereres fra koden. Skriver status → nøkkel + variant for
 * web-liste (= mobil-liste, felles nøytral kilde) og mobil-detalj (aktiv/venter/
 * nøytral). Kjør: `pnpm --filter @sitedoc/mobile test statusFarger` og les output.
 */
describe("tekstbevis: statusfarger web + mobil", () => {
  it("skriver tabellen", () => {
    const seer = {
      aktiv: { rolle: "utforer" as const, harBallen: true },
      venter: { rolle: "utforer" as const, harBallen: false },
      noeytral: { rolle: null, harBallen: false, erAdmin: true },
    };
    const rader = DOCUMENT_STATUSES.map((status) => {
      const liste = noeytralEtikett(status);
      const mobil = statusMerkelappInfo(status);
      const dAktiv = perspektivEtikett(status, seer.aktiv, "sjekkliste");
      const dVenter = perspektivEtikett(status, seer.venter, "sjekkliste");
      const dNoeytral = perspektivEtikett(status, seer.noeytral, "sjekkliste");
      return [
        status.padEnd(12),
        `liste=${liste.variant}/${liste.etikettKey}`.padEnd(34),
        `mobil-liste=${mobil.bg}`.padEnd(28),
        `d.aktiv=${dAktiv.variant}/${dAktiv.etikettKey}`.padEnd(38),
        `d.venter=${dVenter.variant}/${dVenter.etikettKey}`.padEnd(42),
        `d.nøytral=${dNoeytral.variant}/${dNoeytral.etikettKey}`,
      ].join(" | ");
    });
    // eslint-disable-next-line no-console
    console.log("\n" + rader.join("\n") + "\n");
    expect(rader.length).toBe(DOCUMENT_STATUSES.length);
  });
});
