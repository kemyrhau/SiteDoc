/**
 * Delte hjelpefunksjoner for PDF-generering.
 * Null avhengigheter — kun TypeScript-strenger.
 */

import type { GrenseSnapshot, TilfoyelsePdf } from "./typer";

/**
 * Fast tidssone for alle instant→tekst-formaterere her.
 *
 * 🔴 Hvorfor hardkodet: disse er rene strengfunksjoner uten firma-kontekst
 * (pakken importerer bevisst ingenting, jf. @sitedoc/pdf CLAUDE.md), så de kan
 * ikke lese `OrganizationSetting.timezone`. UTEN `timeZone` bruker de serverens
 * default-sone — som er `Etc/UTC` på api-serveren — og alle stempler ble 2t bak
 * norsk sommertid / 1t bak vintertid (funn 2026-09-02). «Europe/Oslo» stopper
 * blødningen. Prosjekt-styrt sone (Kenneths regel) er en senere redesign, ikke
 * denne runden. `fraTid`/`tilTid` er sonefrie veggur-strenger og går IKKE via
 * disse funksjonene — de er urørt.
 */
const PDF_TIDSSONE = "Europe/Oslo";

/** HTML-escape for sikker innbygging i HTML-strenger */
export function esc(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Status → arkiv-ord (grenseresolver trinn 3). 🔴 S/h-trygt: ordet bærer semantikken,
 * ikke fargen — arkiv-PDF-er printes i s/h. Retningen skilles (under/over/utenfor toleranse).
 */
const GRENSE_STATUSORD: Record<"under" | "over" | "utenfor_toleranse", string> = {
  under: "UNDER KRAV",
  over: "OVER KRAV",
  utenfor_toleranse: "UTENFOR TOLERANSE",
};

/**
 * Verdi + kravsnapshot → HTML (grenseresolver trinn 3 del A). Tre tilstander, mockup-fasit
 * `PDF Grensekrav Mockup`:
 * - innenfor: `148 mm · krav 140–160 mm` (kravet dempet)
 * - utenfor:  `14 mm — OVER KRAV (krav ≤ 10 mm)` (verdi+ord fet amber, kravet dempet)
 * - tom:      `Ikke utfylt (krav ≤ 15 mm)` — kravet vises likevel (F7)
 *
 * `verdiTekst === null` = tomt felt. `kompakt` (repeater-celle): behold brudd-ordet, men dropp
 * kravteksten ved innenfor/tom så tabellkolonnen holder seg smal. Regner ingenting — snapshotet
 * er ferdig beregnet (server ved lagring / rekonstruert i sammenstilling.ts).
 */
export function byggGrenseVerdi(
  verdiTekst: string | null,
  snapshot: GrenseSnapshot | undefined,
  opts?: { kompakt?: boolean },
): string {
  const kravTekst = snapshot?.kravTekst;
  const status = snapshot?.status ?? null;
  const kompakt = opts?.kompakt ?? false;
  const dempet = (s: string): string => `<span style="color:#6b7280;font-weight:400">${s}</span>`;

  if (verdiTekst === null) {
    const tomHtml = `<span class="tom">Ikke utfylt</span>`;
    if (!kravTekst || kompakt) return tomHtml;
    return `${tomHtml} ${dempet(`(krav ${esc(kravTekst)})`)}`;
  }
  const v = esc(verdiTekst);
  if (kravTekst && status && status !== "ok") {
    const kravDel = kompakt ? "" : ` ${dempet(`(krav ${esc(kravTekst)})`)}`;
    return `<span style="color:#b45309;font-weight:700">${v} — ${GRENSE_STATUSORD[status]}</span>${kravDel}`;
  }
  if (kravTekst && !kompakt) {
    return `${v} ${dempet(`· krav ${esc(kravTekst)}`)}`;
  }
  return v;
}

/**
 * Kanonisk JSON-streng: rekursiv nøkkelsortering, uendret array-rekkefølge.
 * To verdier med samme innhold men ulik nøkkelrekkefølge gir samme streng —
 * så JSON-streng-sammenligning fanger ekte likhet (endringslogg punkt 1).
 * Array-rekkefølge BEVARES (repeater-rad-rekkefølge er betydningsbærende).
 */
export function kanonisk(v: unknown): string {
  return JSON.stringify(sorterNøkler(v));
}

function sorterNøkler(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorterNøkler);
  if (v != null && typeof v === "object") {
    const ut: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      ut[k] = sorterNøkler((v as Record<string, unknown>)[k]);
    }
    return ut;
  }
  return v;
}

/**
 * En label er MENINGSFULL når den har minst ett alfanumerisk tegn. Malbyggeren
 * lagrer en tom feltlabel som en ren plassholder («_»), og `"_".trim()` er ikke
 * tom — så en trim-sjekk alene slipper den gjennom og PDF-en viser en naken
 * understrek som feltnavn (funn 2026-09-04). Endringsdiffen har brukt samme regel
 * for kolonneoverskrifter; nå er den ÉN kilde, delt av radkortet og diffen.
 */
export function harMeningsfullLabel(label: string | null | undefined): boolean {
  return !!label && /[\p{L}\p{N}]/u.test(label);
}

/**
 * Normaliser opsjon — SPEIL av @sitedoc/shared `normaliserOpsjon`. `packages/pdf`
 * er null-avhengigheter og kan ikke importere shared; drift voktes av paritetstest
 * i `apps/web/src/__tests__/pdf-shared-tvilling-paritet.test.ts`. Endres denne,
 * endres speilet — og omvendt.
 */
export function normaliserOpsjon(raw: unknown): { value: string; label: string } {
  if (typeof raw === "string") return { value: raw, label: raw };
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const value = typeof obj.value === "string" ? obj.value : String(obj.value ?? "");
    const label = typeof obj.label === "string" ? obj.label : value;
    return { value, label };
  }
  return { value: String(raw), label: String(raw) };
}

/** Formater dato på norsk (f.eks. "3. april 2026") */
export function formaterDato(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    return new Date(v).toLocaleDateString("nb-NO", {
      timeZone: PDF_TIDSSONE,
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

/** Formater dato+tid på norsk (f.eks. "3. apr. 2026, 14:30") */
export function formaterDatoTid(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    return new Date(v).toLocaleString("nb-NO", {
      timeZone: PDF_TIDSSONE,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

/** Formater dato+tid kort (f.eks. "03.04.2026, 14:30") */
export function formaterDatoTidKort(v: unknown): string {
  if (!v) return "";
  try {
    return new Date(String(v)).toLocaleString("nb-NO", {
      timeZone: PDF_TIDSSONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

/**
 * Dato+tid «dd.mm.yyyy hh:mm» UTEN komma — arkivmalens mockup-format
 * («07.08.2026 09:41»). `formaterDatoTidKort` (delt med de eldre malene) gir
 * «07.08.2026, 14:52» via `toLocaleString`; her strippes komma-skilletegnet.
 */
export function formaterDatoTidPunkt(v: unknown): string {
  return formaterDatoTidKort(v).replace(", ", " ");
}

/** Overskrift på tilføyelses-blokka — hardkodet nb (arkiv-PDF har intet locale-lag). */
const TILFOYELSE_OVERSKRIFT = "Også registrert — feltet hadde allerede verdien over";

/** En tapt verdis tekst → lesbar streng (aldri base64-dump / rå JSON i dokumentet). */
function formaterTilfoyelseVerdi(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(tom verdi)";
  if (typeof v === "string") return esc(v);
  if (Array.isArray(v)) {
    const deler = (v as unknown[]).map((x) =>
      typeof x === "string"
        ? x
        : x && typeof x === "object" && "filnavn" in x
          ? String((x as { filnavn: unknown }).filnavn)
          : "(kompleks verdi)",
    );
    return esc(deler.join(", "));
  }
  // Defensivt: tapende celleverdi er nå en skalar (repeater-kollisjon festes pr. celle).
  // Skulle et objekt likevel nå hit, vis lesbar markør — aldri rå JSON i arkiv-dokumentet.
  if (v && typeof v === "object") {
    const o = v as { verdi?: unknown; filnavn?: unknown };
    if (o.verdi != null && typeof o.verdi !== "object") return esc(String(o.verdi));
    if (typeof o.filnavn === "string") return esc(o.filnavn);
    return esc("(kompleks verdi)");
  }
  return esc(String(v));
}

/**
 * Tilføyelses-blokk: verdier som tapte en offline-kollisjon, bevart på feltet
 * (kollisjonsmerge). Rendres MELLOM `verdi` og `kommentar` — feltets gjeldende verdi
 * står over, tilføyelsene under; rekkefølgen bærer at notatet er et tillegg, ikke en
 * erstatning. Hver rad: verdien + hvem + når (sporet er verdiløst uten navn/tid).
 *
 * Robust mot eldre/halve rader: manglende `brukerNavn` → «Ukjent bruker», manglende
 * `tidspunkt` → utelatt. Tom/ingen liste → "" (aldri en tom boks). Delt av `felt.ts`
 * (topp-nivå + frossen mobil-repeater via renderFelt) og `repeater.ts` (arkiv-tabellcelle).
 */
export function byggTilfoyelser(tilfoyelser: TilfoyelsePdf[] | undefined): string {
  if (!Array.isArray(tilfoyelser) || tilfoyelser.length === 0) return "";
  const rader = tilfoyelser
    .map((t) => {
      const navn = t?.brukerNavn?.trim() ? esc(t.brukerNavn) : "Ukjent bruker";
      const tid = t?.tidspunkt ? formaterDatoTidPunkt(t.tidspunkt) : "";
      const meta = tid ? `${navn}, ${esc(tid)}` : navn;
      return `<div class="tilfoyelse-rad"><div class="tilfoyelse-verdi">${formaterTilfoyelseVerdi(t?.verdi)}</div><div class="tilfoyelse-meta">${meta}</div></div>`;
    })
    .join("");
  return `<div class="tilfoyelse"><div class="tilfoyelse-overskrift">${esc(TILFOYELSE_OVERSKRIFT)}</div>${rader}</div>`;
}

/**
 * Bildetekstens tidsdel: OPPTAKS-tidspunkt (når bildet ble tatt), ikke innleggings-
 * tidspunkt. Tre tilstander styrt av `opptakTidspunkt` (se Vedlegg-typen):
 *   - nøkkel finnes ikke (`undefined`) ⇒ vedlegg lagd før feltet (2026-09-04) ⇒
 *     vis historisk `opprettet` uendret, så arkiverte dokumenter ser like ut.
 *   - `null`/"" ⇒ nytt bilde uten EXIF-tid ⇒ ærlig «Tidspunkt ikke tilgjengelig»
 *     (aldri innleggingstid — et tomt felt er sant, et feil felt er verre).
 *   - ISO-streng ⇒ opptakstidspunktet.
 * Tom retur = ingen tidsdel i bildeteksten (vedlegg helt uten tidsinfo).
 * Strengen er norsk (arkiv-PDF er nb-only for disse etikettene, jf. «Bilder»/«Bilde»).
 */
export function bildeOpptakTid(b: { opptakTidspunkt?: string | null; opprettet?: string }): string {
  if (b.opptakTidspunkt === undefined) {
    return b.opprettet ? formaterDatoTidPunkt(b.opprettet) : "";
  }
  if (b.opptakTidspunkt === null || b.opptakTidspunkt === "") {
    return "Tidspunkt ikke tilgjengelig";
  }
  return formaterDatoTidPunkt(b.opptakTidspunkt);
}

/** Formater dato kort (f.eks. "03.04.2026") */
export function formaterDatoKort(v: unknown): string {
  if (!v) return "";
  try {
    return new Date(String(v)).toLocaleDateString("nb-NO", {
      timeZone: PDF_TIDSSONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

/**
 * Signaturfelt-lesning + meta-linje — SPEIL av @sitedoc/shared
 * `lesSignaturVerdi`/`formaterSignaturLinje`. packages/pdf importerer bevisst
 * ingenting (null-avhengigheter, jf. CLAUDE.md + felt.ts:90), så den delte leseren
 * dupliseres her. Kanonisk kilde: `packages/shared/src/utils/signaturVerdi.ts` —
 * endres den, endres denne.
 *
 * Legacy: rå data-URL-streng (pre 2026-09-05) → bildet uten meta-linje. Nytt format:
 * objekt med snapshot av hvem/når. Tidspunktet parses DIREKTE fra ISO-strengen
 * (lokal-ISO med offset fra `signaturTidspunktNaa`), så veggklokken vises likt som
 * på web/mobil selv når PDF rendres på en UTC-server — derfor IKKE via PDF_TIDSSONE.
 */
interface SignaturVerdiPdf {
  dataUrl: string;
  navn: string | null;
  tidspunkt: string | null;
}

export function lesSignaturVerdiPdf(verdi: unknown): SignaturVerdiPdf | null {
  if (typeof verdi === "string") {
    return verdi.startsWith("data:") ? { dataUrl: verdi, navn: null, tidspunkt: null } : null;
  }
  if (verdi && typeof verdi === "object" && !Array.isArray(verdi)) {
    const o = verdi as Record<string, unknown>;
    const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : null;
    if (!dataUrl || !dataUrl.startsWith("data:")) return null;
    return {
      dataUrl,
      navn: typeof o.navn === "string" ? o.navn : null,
      tidspunkt: typeof o.tidspunkt === "string" ? o.tidspunkt : null,
    };
  }
  return null;
}

/** Meta-linjen «navn ?? Ukjent · dd.mm.åååå kl. hh:mm». `null` for legacy (ingen linje). */
export function formaterSignaturLinjePdf(sig: SignaturVerdiPdf): string | null {
  if (!sig.tidspunkt) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(sig.tidspunkt);
  if (!m) return null;
  const [, aar, maaned, dag, time, minutt] = m;
  return `${sig.navn ?? "Ukjent"} · ${dag}.${maaned}.${aar} kl. ${time}:${minutt}`;
}

/**
 * Formatér et signeringstidspunkt (lokal ISO-8601 med offset) til
 * «dd.mm.åååå kl. hh:mm». Speiler @sitedoc/shared formaterSignaturTidspunkt —
 * parser veggklokka DIREKTE fra strengen, tz-uavhengig av render-miljøet.
 * Brukes av signaturliste-renderer (SJA/HMS-runder). `null` for manglende tid.
 */
export function formaterSignaturTidspunktPdf(tidspunkt: string | null): string | null {
  if (!tidspunkt) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(tidspunkt);
  if (!m) return null;
  const [, aar, maaned, dag, time, minutt] = m;
  return `${dag}.${maaned}.${aar} kl. ${time}:${minutt}`;
}

/** Gjør relativ bilde-URL om til full URL basert på bildeBaseUrl */
export function fullBildeUrl(url: string, bildeBaseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) return `${bildeBaseUrl}${url}`;
  if (url.startsWith("/")) return `${bildeBaseUrl}${url}`;
  return url;
}

/** Formater sjekkliste/oppgave-nummer med prefiks (f.eks. "SJK-001") */
export function formaterNummer(nummer: number | null | undefined, prefix: string | null | undefined): string | null {
  if (nummer == null) return null;
  const pad = String(nummer).padStart(3, "0");
  return prefix ? `${prefix}-${pad}` : pad;
}
