/**
 * Genererer et syntetisk arkiv-dokument (HTML) som viser grenseresolver trinn 3:
 * tallfelt innenfor/over/under/utenfor-toleranse/tomt krav + ett utløst avviksfelt.
 * Underlag for fabels designgate — kjører den EKTE PDF-veien (byggArkivDokument +
 * injiserGrenseSnapshot), ikke en håndlaget etterligning.
 *
 *   pnpm dlx tsx scripts/underlag-grensekrav.ts   (fra apps/api)
 */
import { writeFileSync } from "node:fs";
import { byggArkivDokument, byggInnhold, type TreObjekt, type FeltVerdi } from "@sitedoc/pdf";
import { injiserGrenseSnapshot } from "../src/services/arkiv/grensesnapshot";

const obj = (
  id: string,
  type: string,
  label: string,
  config: Record<string, unknown>,
  sortOrder: number,
  children: TreObjekt[] = [],
  parentId: string | null = null,
): TreObjekt =>
  ({ id, type, label, required: false, config, sortOrder, parentId, children }) as TreObjekt;

const fv = (verdi: unknown): FeltVerdi => ({ verdi, kommentar: "", vedlegg: [] });

// Avviksfelt-barn på f3 (utløst «utenfor krav»)
const arsak = obj("f3a", "list_single", "Årsak til avvik", { options: ["Setning i underlag", "Feil komprimering", "Værforhold"] }, 4, [], "f3");
const tiltak = obj("f3b", "text_field", "Tiltak", {}, 5, [], "f3");

const tre: TreObjekt[] = [
  obj("h1", "heading", "3.2 Komprimering og toleranser", {}, 0),
  obj("f1", "decimal", "Lagtykkelse etter komprimering", { min: 140, maks: 160, enhet: "mm", kravType: "mellom", desimaler: 0 }, 1),
  obj("f2", "decimal", "Komprimeringsgrad", { min: 95, enhet: "%", kravType: "minst", desimaler: 0 }, 2),
  obj("f3", "decimal", "Avvik fra prosjektert høyde", { maks: 10, enhet: "mm", kravType: "hoyst", desimaler: 0, conditionActive: true, conditionType: "utenfor_krav" }, 3, [arsak, tiltak]),
  obj("f4", "decimal", "Planhet (rettholt 2 m)", { toleranse: 3, enhet: "mm", kravType: "toleranse", desimaler: 0 }, 6),
  obj("f5", "decimal", "Fall mot sluk", { toleranse: 3, enhet: "mm", kravType: "toleranse", desimaler: 0 }, 7),
];

const data: Record<string, FeltVerdi> = {
  f1: fv(148), // 140–160 → innenfor
  f2: fv(93), // ≥ 95 → UNDER KRAV
  f3: fv(14), // ≤ 10 → OVER KRAV + avviksfelt utløst
  f3a: fv("Setning i underlag"),
  f3b: fv("Reetablert og komprimert på nytt"),
  f4: fv(5), // ± 3 → UTENFOR TOLERANSE
  f5: fv(null), // tomt → «Ikke utfylt (krav ± 3 mm)»
};

// Injiser kravsnapshot slik sammenstilling.ts gjør (samme funksjon).
injiserGrenseSnapshot(tre, data);

const innholdHtml = byggInnhold(tre, data, { bildeBaseUrl: "", visTommeStrukturer: true });

const html = byggArkivDokument({
  firma: { navn: "SiteDoc AS", orgnr: "923 456 789" },
  meta: { kategori: "sjekkliste", dokumenttype: "Sjekkliste", dokumentnavn: "Underbygning — komprimering", dokumentnummer: "SJ-042", dokumentId: "underlag", status: "approved" },
  prosjektblokk: { prosjekt: "E6 Kvål–Melhus", byggeplass: "Parsell 3", byggherre: "Nye Veier AS" },
  statusCeller: [{ etikett: "Status", verdi: "Godkjent", farge: "#15803d" }],
  innholdHtml,
  logg: { hendelser: [], endringsloggAktivert: false, sistEndret: null },
  signaturer: [],
  generertTekst: "06.09.2026 22:10",
});

const ut = process.argv[2] ?? "/tmp/underlag-grensekrav.html";
writeFileSync(ut, html, "utf8");
console.log(`Skrev ${ut} (${html.length} tegn)`);
