/**
 * Delt helper for å bygge "ledd"-rader fra DokumentflytMedlem (mobil).
 * Brukes av Flytlinje (kompakt visuell visning i header + flyt-sheet) og
 * DokumentHandlingslinje (retningsnavn på primærhandling).
 *
 * Fase 4-konsolidering (2026-08-01): sekvenserer på `steg` (= posisjon) via delt
 * `byggPosisjonsLedd` fra @sitedoc/shared — PARITET med web `flyt-ledd.ts`. Regellaget
 * (posisjon/klassifisering/medlemskap) er delt; denne fila legger KUN mobil-visning oppå
 * (navn/farge/full medlemsliste). Aktivt ledd leses fra `aktivPosisjon` (server-fakta).
 * Rolle-rang-heuristikken er fjernet. Antall ledд er dynamisk (2/4/8+).
 *
 * ⚠️ MOBIL-PARITET: hold atferds-identisk med `apps/web/src/lib/flyt-ledd.ts`.
 */

import { byggPosisjonsLedd, ansvarsmerkeKey, type RaFlytMedlem } from "@sitedoc/shared";

export interface FlytMedlem {
  id?: string;
  rolle: string;
  steg: number;
  klassifisering?: string | null;
  kanTerminereUtenBall?: boolean;
  erHovedansvarlig?: boolean;
  faggruppe: { id: string; name: string; color?: string | null } | null;
  projectMember: { id?: string; user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

export interface Ledd {
  /** 1-basert posisjon (= DokumentflytMedlem.steg). */
  posisjon: number;
  steg: number;
  /** Leddets rolle (rettighetsmal bak merket) — internt, ikke brukervendt etikett. */
  rolle: string;
  /** Rutings-klassifisering (kontroll/utfor/orienteres). */
  klassifisering: string;
  /** i18n-nøkkel for ansvarsmerket (§ 2.6). Konsumenten kaller t(). */
  ansvarsmerkeKey: string;
  navn: string;
  aktivNavn: string;
  farge: string | null;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  faggruppeIder: Set<string>;
  medlemmer: FlytMedlem[];
}

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
 * Grupper medlemmer per POSISJON (`steg`) og sekvensér stigende (delt byggPosisjonsLedd).
 * Flere medlemmer på samme steg → ett ledd.
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
      const faggruppeM = medl.find((m) => m.faggruppe);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      const navn = faggruppeM
        ? faggruppeM.faggruppe!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      let aktivNavn = navn;
      const personEllerGruppe = gruppe?.group?.name ?? person?.projectMember?.user?.name;
      const faggruppeNavn = faggruppeM?.faggruppe?.name;
      if (faggruppeNavn && personEllerGruppe && personEllerGruppe !== faggruppeNavn) {
        aktivNavn = `${faggruppeNavn} · ${personEllerGruppe}`;
      }

      const leddRolle = medl[0]?.rolle ?? "";

      return {
        posisjon: pl.posisjon,
        steg: pl.posisjon,
        rolle: leddRolle,
        klassifisering: pl.klassifisering,
        ansvarsmerkeKey: ansvarsmerkeKey(leddRolle, pl.klassifisering),
        navn,
        aktivNavn,
        farge: faggruppeM?.faggruppe?.color ?? null,
        gruppeIder: pl.gruppeIder,
        brukerIder: pl.brukerIder,
        faggruppeIder: pl.faggruppeIder,
        medlemmer: medl,
      };
    });
}

/**
 * Aktiv boks = leddet på dokumentets `aktivPosisjon` (server-fakta). -1 hvis ikke funnet.
 * Terminal-dokument ligger hos sitt terminal-ledd (§ 2.3).
 */
export function finnAktivtIndex(ledd: Ledd[], aktivPosisjon: number | null | undefined): number {
  if (ledd.length === 0 || aktivPosisjon == null) return -1;
  return ledd.findIndex((l) => l.posisjon === aktivPosisjon);
}

export function forkort(tekst: string, maks: number): string {
  return tekst.length > maks ? tekst.slice(0, maks - 1) + "…" : tekst;
}
