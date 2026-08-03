import { useMemo } from "react";
import {
  utledMinRolle,
  byggPosisjonsLedd,
  harBallenPosisjon,
  erAvsenderledd,
  erMedlemAvFlyt,
  retningsrettigheter,
  type FlytMedlemInfo,
  type RaFlytMedlem,
  type FlytBruker,
  type DokumentflytRolle,
} from "@sitedoc/shared";
import type { FlytMedlem } from "@/components/FlytIndikator";

/**
 * Flyt-kontekst for dokument-detaljsidene (sjekkliste + oppgave).
 *
 * Ekstrahert fra `sjekklister/[sjekklisteId]/page.tsx` (2026-08-01, TS2589-avlastning):
 * de fire tunge tRPC-type-konsumerende memoene (harBallen/minRolle/flytRettighet/
 * flytMedlemmer) lå inline i en 970-linjers mega-fil og tippet TypeScripts
 * instansierings-budsjett. Ved å ta rå-outputene som `unknown` her, vides de dype
 * tRPC-typene ut ved kall-grensa — dybden bor i denne fila (frisk budsjett), ikke i sida.
 *
 * Ren utflytting — identisk logikk. Deles av begge detaljsider (samme mønster).
 */

/** Minimalt utsnitt av `hentMinFlytInfo` som utledningene trenger. */
export interface MinFlytInfoUtsnitt {
  userId: string;
  gruppeIder: string[];
  faggruppeIder: string[];
  projectMemberId: string;
  erAdmin: boolean;
  adminNiva: "sitedoc" | "prosjekt" | null;
}

export interface FlytKontekst {
  harBallen: boolean;
  /** § 2.4: medlem av avsenderleddet (forrigeBallLedд = «den som sendte») — for «Trekk tilbake». */
  erAvsender: boolean;
  /** § 2.4: medlem av NOEN ledд i flyten — for «Gjenåpne» (terminal→draft). */
  erMedlemAvFlyt: boolean;
  /** Posisjon-baserte retningsrettigheter — klient-handlingsfilter = server (steg 4b). */
  retningsrett: { kanSende: boolean; kanBesvare: boolean; kanVideresende: boolean; kanTerminere: boolean };
  minRolle: DokumentflytRolle | null | undefined;
  flytRettighet: "redigerer" | "leser" | undefined;
  flytMedlemmer: FlytMedlem[];
  /** Runde-2 (#7/#8): dokumentflytens navn (f.eks. «Sitedoc Ansatte») for sheet-tittel + flytlinje-caption. */
  flytNavn: string | null;
  aktivPosisjon: number | null | undefined;
  rettighetInput:
    | {
        erAdmin: boolean;
        minRolle: DokumentflytRolle | null | undefined;
        tillatelser: Set<string>;
        harBallen: boolean;
        flytRettighet: "redigerer" | "leser" | undefined;
      }
    | undefined;
}

export function useFlytKontekst(input: {
  /** Rå `hentMedId`-output (fullSjekklisteRå / fullOppgaveRå). Widenes til unknown her. */
  fullDokRå: unknown;
  /** Rå `dokumentflyt.hentForProsjekt`-output. */
  dokumentflyterRå: unknown;
  minFlytInfo: MinFlytInfoUtsnitt | undefined;
  mineTillatelser: Set<string>;
}): FlytKontekst {
  const { fullDokRå, dokumentflyterRå, minFlytInfo, mineTillatelser } = input;

  const dok = fullDokRå as
    | {
        dokumentflytId?: string | null;
        aktivPosisjon?: number | null;
        bestillerFaggruppe?: { id: string };
        utforerFaggruppe?: { id: string };
      }
    | undefined;
  const dokumentflytId = dok?.dokumentflytId ?? null;
  const aktivPosisjon = dok?.aktivPosisjon;

  // Steg 3+4b (Fase 4): POSISJON-baserte rettigheter (Q2, divergens-referanse). Bygger ledд-
  // posisjonene én gang → harBallen (medlemskap av aktivPosisjon-leddet), erAvsender/erMedlemAvFlyt (§ 2.4 avsender-
  // siden, for trekk tilbake) + retningsrettigheter (Send/Besvar/Terminere/Videresende). Klient=server.
  const posisjonRett = useMemo(() => {
    const tom = {
      harBallen: false,
      erAvsender: false,
      erMedlemAvFlyt: false,
      retningsrett: { kanSende: false, kanBesvare: false, kanVideresende: false, kanTerminere: false },
    };
    if (!minFlytInfo || aktivPosisjon == null || !dokumentflytId || !dokumentflyterRå) return tom;
    const rå = dokumentflyterRå as Array<{
      id: string;
      medlemmer: Array<{
        steg: number;
        klassifisering?: string | null;
        kanTerminereUtenBall?: boolean;
        erHovedansvarlig?: boolean;
        projectMember?: { user?: { id: string } } | null;
        groupId?: string | null;
        faggruppeId?: string | null;
      }>;
    }>;
    const flyt = rå.find((df) => df.id === dokumentflytId);
    if (!flyt) return tom;
    const ledd = byggPosisjonsLedd(
      flyt.medlemmer.map(
        (m): RaFlytMedlem => ({
          steg: m.steg,
          klassifisering: m.klassifisering ?? null,
          kanTerminereUtenBall: m.kanTerminereUtenBall ?? false,
          erHovedansvarlig: m.erHovedansvarlig ?? false,
          brukerId: m.projectMember?.user?.id ?? null,
          gruppeId: m.groupId ?? null,
          faggruppeId: m.faggruppeId ?? null,
        }),
      ),
    );
    const bruker: FlytBruker = {
      userId: minFlytInfo.userId,
      gruppeIder: minFlytInfo.gruppeIder,
      faggruppeIder: minFlytInfo.faggruppeIder,
      erAdmin: minFlytInfo.erAdmin,
    };
    const erMedlemAv = (l: (typeof ledd)[number]): boolean =>
      l.brukerIder.has(bruker.userId) ||
      bruker.gruppeIder.some((g) => l.gruppeIder.has(g)) ||
      bruker.faggruppeIder.some((f) => l.faggruppeIder.has(f));
    const harBallen = harBallenPosisjon(ledd, aktivPosisjon, bruker);
    const seerLedd = ledd.find((l) => erMedlemAv(l) && l.kanTerminereUtenBall) ?? ledd.find(erMedlemAv) ?? null;
    const retningsrett = retningsrettigheter({ harBallen, seerLedd, kanVideresende: minFlytInfo.erAdmin });
    // § 2.4-guards: erAvsender (avsenderleddet, for trekk tilbake) + erMedlemAvFlyt (for gjenåpne).
    return {
      harBallen,
      erAvsender: erAvsenderledd(ledd, aktivPosisjon, bruker),
      erMedlemAvFlyt: erMedlemAvFlyt(ledd, bruker),
      retningsrett,
    };
  }, [minFlytInfo, aktivPosisjon, dokumentflytId, dokumentflyterRå]);
  const harBallen = posisjonRett.harBallen;

  const minRolle = useMemo<DokumentflytRolle | null | undefined>(() => {
    if (!minFlytInfo || !dokumentflytId || !dokumentflyterRå) return undefined;
    const rå = dokumentflyterRå as Array<{
      id: string;
      medlemmer: Array<{
        rolle: string;
        faggruppeId?: string | null;
        projectMemberId?: string | null;
        groupId?: string | null;
      }>;
    }>;
    const flyt = rå.find((df) => df.id === dokumentflytId);
    if (!flyt) return null;
    const medlemmer = flyt.medlemmer.map((m): FlytMedlemInfo => ({
      rolle: m.rolle,
      faggruppeId: m.faggruppeId ?? null,
      projectMemberId: m.projectMemberId ?? null,
      groupId: m.groupId ?? null,
    }));
    return utledMinRolle(
      // Kloss 2: rolle-utledning følger adminNiva (firma-admin = adminNiva:null → vanlig
      // rolle/lesevisning). sitedoc/prosjekt → admin.
      { ...minFlytInfo, userId: "", erAdmin: minFlytInfo.adminNiva !== null },
      medlemmer,
      {
        bestillerFaggruppeId: dok?.bestillerFaggruppe?.id ?? "",
        utforerFaggruppeId: dok?.utforerFaggruppe?.id ?? "",
      },
    );
  }, [minFlytInfo, dokumentflytId, dokumentflyterRå, dok]);

  const flytRettighet = useMemo<"redigerer" | "leser" | undefined>(() => {
    if (!minFlytInfo || !dokumentflytId || !dokumentflyterRå) return undefined;
    const rå = dokumentflyterRå as Array<{
      id: string;
      medlemmer: Array<{
        kanRedigere: boolean;
        projectMemberId?: string | null;
        groupId?: string | null;
      }>;
    }>;
    const flyt = rå.find((df) => df.id === dokumentflytId);
    if (!flyt) return undefined;
    for (const m of flyt.medlemmer) {
      if (m.projectMemberId && m.projectMemberId === minFlytInfo.projectMemberId) return m.kanRedigere ? "redigerer" : "leser";
      if (m.groupId && minFlytInfo.gruppeIder.includes(m.groupId)) return m.kanRedigere ? "redigerer" : "leser";
    }
    return undefined;
  }, [minFlytInfo, dokumentflytId, dokumentflyterRå]);

  const flytMedlemmer = useMemo<FlytMedlem[]>(() => {
    if (!dokumentflytId || !dokumentflyterRå) return [];
    const rå = dokumentflyterRå as Array<{ id: string; medlemmer: FlytMedlem[] }>;
    const flyt = rå.find((df) => df.id === dokumentflytId);
    return flyt?.medlemmer ?? [];
  }, [dokumentflytId, dokumentflyterRå]);

  // Runde-2 (#7/#8): flyt-navnet er alt lastet via `dokumentflyt.hentForProsjekt` (projeksjon, ingen
  // ny query) — plukkes ut her for sheet-tittel + flytlinje-caption på detalj.
  const flytNavn = useMemo<string | null>(() => {
    if (!dokumentflytId || !dokumentflyterRå) return null;
    const rå = dokumentflyterRå as Array<{ id: string; name?: string | null }>;
    return rå.find((df) => df.id === dokumentflytId)?.name ?? null;
  }, [dokumentflytId, dokumentflyterRå]);

  const rettighetInput = useMemo<FlytKontekst["rettighetInput"]>(() => {
    if (!minFlytInfo) return undefined;
    return {
      erAdmin: minFlytInfo.erAdmin,
      minRolle,
      tillatelser: mineTillatelser,
      harBallen,
      flytRettighet,
    };
  }, [minFlytInfo, minRolle, mineTillatelser, harBallen, flytRettighet]);

  return {
    harBallen,
    erAvsender: posisjonRett.erAvsender,
    erMedlemAvFlyt: posisjonRett.erMedlemAvFlyt,
    retningsrett: posisjonRett.retningsrett,
    minRolle,
    flytRettighet,
    flytMedlemmer,
    flytNavn,
    aktivPosisjon,
    rettighetInput,
  };
}
