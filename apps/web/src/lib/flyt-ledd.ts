/**
 * Delt kilde for flyt-ledd (web). Fase 4-konsolidering (2026-08-01).
 *
 * Bygger visnings-«ledd»-rader fra dokumentets FAKTISKE flyt. Regellaget (posisjon,
 * klassifisering, hvem-kan-holde-ballen) delegeres til `@sitedoc/shared`
 * (`byggPosisjonsLedd`); denne fila legger KUN visning oppå (navn/hover/ansvarsmerke).
 *
 * Sekvensering: på `steg` (= posisjon), IKKE lenger rolle-rang. Fase 1a/2 populerte
 * distinkt `steg`, så den interim rolle-rang-heuristikken + `forventetRolleKandidater`
 * er fjernet. Aktivt ledd leses fra dokumentets `aktivPosisjon` (server-fakta), aldri
 * gjettet fra status/recipient. Antall ledd er dynamisk (2, 4, 8, …) — ingen grense.
 *
 * ⚠️ MOBIL-PARITET (lærdom 2026-07-30): mobil har en PARALLELL kopi
 * `apps/mobile/src/utils/dokumentflyt-ledd.ts` som MÅ holde samme logikk. Endres denne,
 * MÅ mobil-kopien oppdateres i SAMME runde.
 */

import { byggPosisjonsLedd, ansvarsmerkeKey, type RaFlytMedlem } from "@sitedoc/shared";

export interface FlytMedlem {
  id: string;
  rolle: string;
  steg: number;
  klassifisering?: string | null;
  kanTerminereUtenBall?: boolean;
  erHovedansvarlig?: boolean;
  faggruppe: { id: string; name: string } | null;
  projectMember: { user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

/** Ett medlem i et ledd — for medlems-hover (navn + rolle). */
export interface LeddMedlem {
  navn: string;
  rolle: string;
}

export interface Ledd {
  /** 1-basert posisjon (= DokumentflytMedlem.steg). */
  posisjon: number;
  /** Kort visningsnavn (faggruppe, ellers gruppe, ellers person). */
  navn: string;
  /** Detaljert aktiv-visning: faggruppe · person/gruppe. */
  aktivNavn: string;
  /** Leddets rolle (rettighetsmal bak merket) — beholdt internt, ikke lenger brukervendt etikett. */
  rolle: string;
  /** Rutings-klassifisering (kontroll/utfor/orienteres). */
  klassifisering: string;
  /** i18n-nøkkel for ansvarsmerket (brukervendt etikett, § 2.6). Konsumenten kaller t(). */
  ansvarsmerkeKey: string;
  /** Alle medlemmer i leddet (navn + rolle) for hover-listing. */
  medlemmer: LeddMedlem[];
  /** @deprecated bruk `posisjon`; beholdt for kompatibilitet. */
  steg: number;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  faggruppeIder: Set<string>;
}

/** Normaliser klient-FlytMedlem → shared RaFlytMedlem (for regellaget). */
function tilRaMedlem(m: FlytMedlem): RaFlytMedlem {
  return {
    steg: m.steg,
    klassifisering: m.klassifisering ?? null,
    kanTerminereUtenBall: m.kanTerminereUtenBall ?? false,
    erHovedansvarlig: m.erHovedansvarlig ?? false,
    brukerId: m.projectMember?.user?.id ?? null,
    gruppeId: m.group?.id ?? null,
    faggruppeId: m.faggruppe?.id ?? null,
  };
}

/**
 * Grupper medlemmer per POSISJON (`steg`) og sekvensér stigende. Regellaget
 * (klassifisering + medlemskap) fra delt `byggPosisjonsLedd`; visning (navn/hover)
 * legges oppå her. Flere medlemmer på samme steg → ett ledd (hover ramser opp alle).
 */
export function byggLedd(medlemmer: FlytMedlem[]): Ledd[] {
  const posLedd = byggPosisjonsLedd(medlemmer.map(tilRaMedlem));
  const perSteg = new Map<number, FlytMedlem[]>();
  for (const m of medlemmer) {
    const liste = perSteg.get(m.steg) ?? [];
    liste.push(m);
    perSteg.set(m.steg, liste);
  }

  return posLedd
    .slice()
    .sort((a, b) => a.posisjon - b.posisjon)
    .map((pl) => {
      const medl = perSteg.get(pl.posisjon) ?? [];
      const faggruppe = medl.find((m) => m.faggruppe);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      const navn = faggruppe
        ? faggruppe.faggruppe!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      let aktivNavn = navn;
      const personEllerGruppe = gruppe?.group?.name ?? person?.projectMember?.user?.name;
      const faggruppeNavn = faggruppe?.faggruppe?.name;
      if (faggruppeNavn && personEllerGruppe && personEllerGruppe !== faggruppeNavn) {
        aktivNavn = `${faggruppeNavn} · ${personEllerGruppe}`;
      }

      const leddMedlemmer: LeddMedlem[] = medl.map((m) => ({
        navn: m.projectMember?.user?.name ?? m.group?.name ?? m.faggruppe?.name ?? "?",
        rolle: m.rolle,
      }));

      // Ansvarsmerket bæres av leddets rolle + klassifisering (§ 2.6).
      const leddRolle = medl[0]?.rolle ?? "";

      return {
        posisjon: pl.posisjon,
        navn,
        aktivNavn,
        rolle: leddRolle,
        klassifisering: pl.klassifisering,
        ansvarsmerkeKey: ansvarsmerkeKey(leddRolle, pl.klassifisering),
        medlemmer: leddMedlemmer,
        steg: pl.posisjon,
        gruppeIder: pl.gruppeIder,
        brukerIder: pl.brukerIder,
        faggruppeIder: pl.faggruppeIder,
      };
    });
}

/**
 * Aktiv boks = leddet på dokumentets `aktivPosisjon` (server-fakta). Returnerer array-
 * indeks, eller -1 hvis posisjonen ikke finnes / mangler. Terminal-dokumenter ligger
 * hos sitt terminal-ledd (§ 2.3) — highlightes der, ikke som «alle passert».
 */
export function finnAktivtIndex(ledd: Ledd[], aktivPosisjon: number | null | undefined): number {
  if (ledd.length === 0 || aktivPosisjon == null) return -1;
  return ledd.findIndex((l) => l.posisjon === aktivPosisjon);
}

/** Hent flyt-tekst (aktiv boks' navn) for filtrering/sortering i tabeller. */
export function hentFlytLedd(
  medlemmer: FlytMedlem[],
  aktivPosisjon: number | null | undefined,
): string {
  const ledd = byggLedd(medlemmer);
  if (ledd.length === 0) return "";
  const aktivtIndex = finnAktivtIndex(ledd, aktivPosisjon);
  if (aktivtIndex === -1) return "";
  return ledd[aktivtIndex]?.aktivNavn ?? "";
}

/** Filtrer til aktiv boks + én nabo på hver side (kompakt/kollaps-modus). */
export function filtrerNaboer(
  ledd: Ledd[],
  aktivtIndex: number,
): Array<{ ledd: Ledd; originalIndex: number }> {
  // Ubestembar aktiv (-1): vis de to siste.
  if (aktivtIndex === -1) {
    return ledd.slice(-2).map((l, i) => ({ ledd: l, originalIndex: ledd.length - 2 + i }));
  }

  const resultat: Array<{ ledd: Ledd; originalIndex: number }> = [];
  const start = Math.max(0, aktivtIndex - 1);
  const slutt = Math.min(ledd.length - 1, aktivtIndex + 1);
  for (let i = start; i <= slutt; i++) {
    const l = ledd[i];
    if (l) resultat.push({ ledd: l, originalIndex: i });
  }
  return resultat;
}
