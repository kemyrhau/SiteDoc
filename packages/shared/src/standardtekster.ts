/**
 * Gjenkjenning av SEEDET standard produkttekst → i18n (V1+V2, fabel 2026-09-02).
 *
 * Problem: standardmalene i `types/index.ts` (REPORT_OBJECT_TYPE_META + PROSJEKT_MODULER)
 * bærer NORSKE strenger. En polsk arbeider som fyller en RUH ser norske opsjoner.
 * Firmaets EGNE labels skal derimot forbli firmainnhold (Globe on-demand) — de er ikke
 * vår tekst å oversette.
 *
 * Regel: gjenkjennes en streng som en av VÅRE seedede standardstrenger, oversettes den via
 * i18n ved rendering. Ellers returneres null (→ rå streng + eksisterende Globe-flyt).
 *
 * To domener, samme oppslag (`oversettStandardtekst`):
 *  - FELTLABELS: per ReportObjectType (type-default-navnet, f.eks. «Dato og tid»). Fanger KUN
 *    felt som beholder default-navnet; beskrivende seedede labels («Alvorlighetsgrad») dekkes
 *    IKKE i denne runden (bevisst scope, fabel V1).
 *  - OPSJONSSTRENGER: streng-basert, én oppføring per seedet streng, uten type-binding.
 *
 * Lagringsformat (målt): for `list_single`/`list_multi` med rene streng-opsjoner setter
 * `normaliserOpsjon` value=label → LAGRET VERDI er selve den norske strengen. Derfor må
 * gjenkjenningen også kjøre på lagret verdi i lesevisning, ikke bare på valglista.
 * `traffic_light` lagrer value («green»); labelen bor i hardkodede maps i renderne.
 *
 * PLIKT: nye seedede strenger/omdøpinger MÅ føres inn her (aliaser er append-only per nøkkel).
 * Håndheves av `standardtekster.test.ts` — omdøping uten tabellføring gir rød CI.
 * Kildene testen vandrer bor i `packages/shared` (types/index.ts). Seedede strenger i
 * `packages/db`/`apps/api` (seed.ts, seed-bibliotek, PSI-quiz, EMNE_KATEGORIER) ligger UTENFOR
 * shared sin import-graf og kan IKKE håndheves herfra — de trenger egen guard.
 */

import type { ReportObjectType } from "./types";

export interface StandardFeltLabel {
  type: ReportObjectType;
  /** i18n-nøkkel (eksisterende `malbygger.*`) */
  nokkel: string;
  /** Gjeldende norske default-label i REPORT_OBJECT_TYPE_META[type].label */
  gjeldende: string;
  /** Tidligere navn (append-only) — bevarer gjenkjenning etter omdøping */
  aliaser: string[];
}

export interface StandardOpsjon {
  /** i18n-nøkkel (`standardopsjon.*`) */
  nokkel: string;
  /** Gjeldende seedet norsk streng */
  gjeldende: string;
  /** Tidligere strenger (append-only) */
  aliaser: string[];
}

/**
 * `location` er BEVISST utelatt — legacy, avvikles i D8/D9-malryddingen. Å lage en nøkkel for
 * en type vi sletter er arbeid uten mottaker (Kenneth-vedtak 2026-09-02). Testen hopper over den.
 */
export const STANDARD_FELTLABEL_UNNTAK: readonly ReportObjectType[] = ["location"];

export const STANDARD_FELTLABELS: StandardFeltLabel[] = [
  { type: "heading", nokkel: "malbygger.overskrift", gjeldende: "Overskrift", aliaser: [] },
  { type: "subtitle", nokkel: "malbygger.undertittel", gjeldende: "Undertittel", aliaser: [] },
  { type: "text_field", nokkel: "malbygger.tekstfelt", gjeldende: "Tekstfelt", aliaser: [] },
  { type: "list_single", nokkel: "malbygger.enkeltvalg", gjeldende: "Enkeltvalg", aliaser: [] },
  { type: "list_multi", nokkel: "malbygger.flervalg", gjeldende: "Flervalg", aliaser: [] },
  { type: "integer", nokkel: "malbygger.heltall", gjeldende: "Heltall", aliaser: [] },
  { type: "decimal", nokkel: "malbygger.desimaltall", gjeldende: "Desimaltall", aliaser: [] },
  { type: "calculation", nokkel: "malbygger.beregning", gjeldende: "Beregning", aliaser: [] },
  { type: "traffic_light", nokkel: "malbygger.trafikklys", gjeldende: "Trafikklys", aliaser: [] },
  // Felle (fabel): date → malbygger.dato_felt, IKKE malbygger.dato (= «Dato / Tid», kategorihode)
  { type: "date", nokkel: "malbygger.dato_felt", gjeldende: "Dato", aliaser: [] },
  { type: "date_time", nokkel: "malbygger.datoOgTid", gjeldende: "Dato og tid", aliaser: [] },
  // Felle: person → malbygger.personFelt, IKKE malbygger.person (= «Person / Firma», kategorihode)
  { type: "person", nokkel: "malbygger.personFelt", gjeldende: "Person", aliaser: [] },
  { type: "persons", nokkel: "malbygger.flerePersoner", gjeldende: "Flere personer", aliaser: [] },
  { type: "company", nokkel: "malbygger.firma", gjeldende: "Firma", aliaser: [] },
  { type: "attachments", nokkel: "malbygger.vedlegg", gjeldende: "Vedlegg", aliaser: [] },
  { type: "bim_property", nokkel: "malbygger.bimEgenskap", gjeldende: "BIM-egenskap", aliaser: [] },
  { type: "zone_property", nokkel: "malbygger.omrade", gjeldende: "Område", aliaser: [] },
  { type: "room_property", nokkel: "malbygger.rom", gjeldende: "Rom", aliaser: [] },
  { type: "weather", nokkel: "malbygger.vaer", gjeldende: "Vær", aliaser: [] },
  { type: "signature", nokkel: "malbygger.signatur", gjeldende: "Signatur", aliaser: [] },
  { type: "repeater", nokkel: "malbygger.repeater", gjeldende: "Repeater", aliaser: [] },
  { type: "drawing_position", nokkel: "malbygger.posisjonITegning", gjeldende: "Posisjon i tegning", aliaser: [] },
  { type: "info_text", nokkel: "malbygger.lesetekst", gjeldende: "Lesetekst", aliaser: [] },
  { type: "info_image", nokkel: "malbygger.bildeMedTekst", gjeldende: "Bilde med tekst", aliaser: [] },
  { type: "video", nokkel: "malbygger.video", gjeldende: "Video", aliaser: [] },
  { type: "quiz", nokkel: "malbygger.quiz", gjeldende: "Quiz-spørsmål", aliaser: [] },
];

export const STANDARD_OPSJONER: StandardOpsjon[] = [
  // Godkjenning «Type» (types/index.ts:516)
  { nokkel: "standardopsjon.tillegg", gjeldende: "Tillegg", aliaser: [] },
  { nokkel: "standardopsjon.fradrag", gjeldende: "Fradrag", aliaser: [] },
  { nokkel: "standardopsjon.regulering", gjeldende: "Regulering", aliaser: [] },
  { nokkel: "standardopsjon.annet", gjeldende: "Annet", aliaser: [] },
  // HMS-avvik «Alvorlighetsgrad» (types/index.ts:547)
  { nokkel: "standardopsjon.lav", gjeldende: "Lav", aliaser: [] },
  { nokkel: "standardopsjon.middels", gjeldende: "Middels", aliaser: [] },
  { nokkel: "standardopsjon.hoy", gjeldende: "Høy", aliaser: [] },
  { nokkel: "standardopsjon.kritisk", gjeldende: "Kritisk", aliaser: [] },
  // RUH «Type observasjon» (types/index.ts:594) — 🔴 prioritert (polsk arbeider melder nestenulykke)
  { nokkel: "standardopsjon.nestenulykke", gjeldende: "Nestenulykke", aliaser: [] },
  { nokkel: "standardopsjon.farligForhold", gjeldende: "Farlig forhold", aliaser: [] },
  { nokkel: "standardopsjon.risikoobservasjon", gjeldende: "Risikoobservasjon", aliaser: [] },
  { nokkel: "standardopsjon.forbedringsforslag", gjeldende: "Forbedringsforslag", aliaser: [] },
  // traffic_light META-default (types/index.ts:174-177)
  { nokkel: "standardopsjon.godkjent", gjeldende: "Godkjent", aliaser: [] },
  { nokkel: "standardopsjon.anmerkning", gjeldende: "Anmerkning", aliaser: [] },
  { nokkel: "standardopsjon.avvik", gjeldende: "Avvik", aliaser: [] },
  { nokkel: "standardopsjon.ikkeRelevant", gjeldende: "Ikke relevant", aliaser: [] },
  // Godkjenning «Beslutning» (types/index.ts:520) — «Godkjent» delt med META over
  { nokkel: "standardopsjon.delvisGodkjent", gjeldende: "Delvis godkjent", aliaser: [] },
  { nokkel: "standardopsjon.avvist", gjeldende: "Avvist", aliaser: [] },
  { nokkel: "standardopsjon.ikkeBehandlet", gjeldende: "Ikke behandlet", aliaser: [] },
  // HMS-avvik «Status» (types/index.ts:554)
  { nokkel: "standardopsjon.apent", gjeldende: "Åpent", aliaser: [] },
  { nokkel: "standardopsjon.underBehandling", gjeldende: "Under behandling", aliaser: [] },
  { nokkel: "standardopsjon.lukket", gjeldende: "Lukket", aliaser: [] },
];

// Oppslagsstrukturer (bygget én gang ved modul-last)
const labelPerType = new Map<ReportObjectType, StandardFeltLabel>();
for (const l of STANDARD_FELTLABELS) labelPerType.set(l.type, l);

const nokkelPerOpsjonstreng = new Map<string, string>();
for (const o of STANDARD_OPSJONER) {
  nokkelPerOpsjonstreng.set(o.gjeldende, o.nokkel);
  for (const alias of o.aliaser) nokkelPerOpsjonstreng.set(alias, o.nokkel);
}

/**
 * Oversetter en streng HVIS den er en av våre seedede standardtekster, ellers null.
 *
 * @param streng  Rå streng fra data (feltlabel eller opsjonsverdi/-label)
 * @param t       i18n-oversetter (`(key) => string`) fra kall-stedet
 * @param type    Valgfri ReportObjectType — gir presis feltlabel-gjenkjenning
 * @returns       Oversatt streng, eller null når strengen ikke er standardtekst (→ rå + Globe)
 */
export function oversettStandardtekst(
  streng: string | null | undefined,
  t: (key: string) => string,
  type?: ReportObjectType,
): string | null {
  if (!streng) return null;
  // Feltlabel: kun når strengen er type-defaultens gjeldende navn eller et alias
  if (type) {
    const label = labelPerType.get(type);
    if (label && (streng === label.gjeldende || label.aliaser.includes(streng))) {
      return t(label.nokkel);
    }
  }
  // Opsjonsstreng: type-uavhengig streng-oppslag
  const opsjonNokkel = nokkelPerOpsjonstreng.get(streng);
  if (opsjonNokkel) return t(opsjonNokkel);
  return null;
}
