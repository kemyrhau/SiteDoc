import { useMemo } from "react";
import {
  utledMinRolle,
  byggPosisjonsLedd,
  harBallenPosisjon,
  type FlytMedlemInfo,
  type RaFlytMedlem,
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
  minRolle: DokumentflytRolle | null | undefined;
  flytRettighet: "redigerer" | "leser" | undefined;
  flytMedlemmer: FlytMedlem[];
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

  // Steg 3 (Fase 4): POSISJON-basert har-ballen (Q2, divergens-test-referanse). Erstatter
  // recipient-baserte beregnHarBallen — ball = medlemskap av leddet på aktivPosisjon.
  const harBallen = useMemo<boolean>(() => {
    if (!minFlytInfo || aktivPosisjon == null || !dokumentflytId || !dokumentflyterRå) return false;
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
    if (!flyt) return false;
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
    return harBallenPosisjon(ledd, aktivPosisjon, {
      userId: minFlytInfo.userId,
      gruppeIder: minFlytInfo.gruppeIder,
      faggruppeIder: minFlytInfo.faggruppeIder,
      erAdmin: minFlytInfo.erAdmin,
    });
  }, [minFlytInfo, aktivPosisjon, dokumentflytId, dokumentflyterRå]);

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

  return { harBallen, minRolle, flytRettighet, flytMedlemmer, aktivPosisjon, rettighetInput };
}
