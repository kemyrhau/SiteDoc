import { useMemo } from "react";
import { trpc } from "../lib/trpc";
import { useFirma } from "../kontekst/FirmaKontekst";
import { useNettverk } from "../providers/NettverkProvider";
import { hentProsjekterLokalt, hentGjesteprosjekterLokalt } from "../services/prosjektKatalog";
import {
  mineAnsattFirmaIder,
  serverGjesteprosjekter,
  utenGjesteprosjekter,
  velgerGjesteprosjekter,
  type GjesteprosjektRad,
} from "../utils/gjesteprosjektListe";
import {
  erAdminIFremmedFirma,
  velgHjemProsjektVisning,
  type HjemProsjektVisning,
} from "@sitedoc/shared";

/* ============================================================================
 *  useProsjektListe — ÉN delt kilde for `prosjekt.hentMine` + offline-fallback.
 *
 *  Feltfunn 2026-10-04: mobilen kalte `prosjekt.hentMine.useQuery` tre steder
 *  (Hjem, prosjektvelgeren, «Ny dagsseddel») — alle nett-only. Uten nett ga de
 *  tom liste / feilside, og stengte veien til de offline-lagrede dokumentene.
 *  Denne hooken samler de tre: server når autoritativt, ellers `prosjekt_local`
 *  (fylt av TimerSyncProvider steg 1), med SAMME pause-regel som fase 2
 *  (`velgHjemProsjektVisning` i @sitedoc/shared). Ingen skriving uten nett.
 *
 *  ⚠️ Lokal cache dekker KUN firmaprosjekter (`organizationId`). En standalone-
 *  bruker uten firma (`valgtFirmaId == null`) har ingen lokale prosjekter →
 *  `visning = "feil"` uten nett. Timer er en firmamodul, så «Ny dagsseddel»
 *  rammes ikke; Hjem/standalone gjør, og flaten viser da feilsiden (målt,
 *  ikke en regresjon fra denne runden — cachingen bor i TimerSyncProvider).
 * ========================================================================== */

export interface ProsjektRad {
  id: string;
  name: string;
  projectNumber: string | null;
}

export interface ProsjektListeResultat {
  visning: HjemProsjektVisning;
  prosjekter: ProsjektRad[];
  /**
   * (15) Prosjekter i andre firma: medlem, men eid av et firma brukeren ikke er
   * ansatt i. Egen gruppe i velgeren — tatt ut av `prosjekter`.
   */
  gjesteprosjekter: GjesteprosjektRad[];
  /** Viser lokale data uten nett → flaten skal vise «Frakoblet»-banneret. */
  erFrakoblet: boolean;
  erPaaNettet: boolean;
  /** Server-feilmelding (for feil-visning på nett). */
  feilmelding: string | null;
  refetch: () => void;
}

export function useProsjektListe(): ProsjektListeResultat {
  const { erPaaNettet } = useNettverk();
  const { valgtFirmaId, firmaer, lasterFirmaer, erAnsattIFirma, erAnsattIValgtFirma } = useFirma();
  // ADMIN-GJEST (Kenneth 2026-11-25): rolle som i DagsseddelListe (TILLEGG (14)).
  const minBruker = trpc.bruker.hentMin.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const adminIFremmedFirma = erAdminIFremmedFirma({
    rolle: minBruker.data?.role,
    erAnsattIValgtFirma,
  });

  const query = trpc.prosjekt.hentMine.useQuery(
    { organizationId: valgtFirmaId ?? undefined },
    // Aktiv ved valgt firma ELLER standalone (ingen firmaer) — ellers henger
    // queryen disabled som isLoading. Samme gate som de tre kallestedene hadde.
    { enabled: !!valgtFirmaId || (!lasterFirmaer && firmaer.length === 0) },
  );

  // Lokal cache for valgt firma. Re-les når firma endres eller server-svaret settler.
  const lokale = useMemo(
    () => (valgtFirmaId ? hentProsjekterLokalt(valgtFirmaId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valgtFirmaId, query.status],
  );

  // (15) Gjesteprosjekter: server når på nett, ellers utledet fra prosjekt_local.
  const gjesteQuery = trpc.prosjekt.hentGjesteprosjekter.useQuery();
  const mineFirmaIder = useMemo(
    () => mineAnsattFirmaIder(firmaer, (id) => erAnsattIFirma(id)),
    [firmaer, erAnsattIFirma],
  );
  const lokaleGjester = useMemo(
    () => hentGjesteprosjekterLokalt(mineFirmaIder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mineFirmaIder, query.status],
  );

  const visning = velgHjemProsjektVisning({
    erPaaNettet,
    serverBekreftet: query.isSuccess,
    erFeilet: query.isError,
    erPauset: query.fetchStatus === "paused",
    harLokaleProsjekter: lokale.length > 0 || lokaleGjester.length > 0,
  });

  // (16): gruppen tar bare prosjekter der eier-firmaet ≠ valgt firma — det valgte firmaets
  // egne prosjekter står i hovedlista selv om brukeren ikke er ansatt der.
  const gjesteprosjekter = useMemo<GjesteprosjektRad[]>(() => {
    // Lean cast som hovedlista (TS2589-vern).
    const data = gjesteQuery.data as unknown as Parameters<typeof serverGjesteprosjekter>[0] | undefined;
    return velgerGjesteprosjekter({
      visning,
      server: data ? serverGjesteprosjekter(data) : [],
      lokale: lokaleGjester,
      valgtFirmaId: valgtFirmaId ?? null,
      adminIFremmedFirma,
    });
  }, [visning, gjesteQuery.data, lokaleGjester, valgtFirmaId, adminIFremmedFirma]);

  const prosjekter = useMemo<ProsjektRad[]>(() => {
    if (visning === "server") {
      // Lean cast: tRPC-output drar med dyp config-Json (TS2589 på videre bruk).
      const data = (query.data as unknown as ProsjektRad[] | undefined) ?? [];
      return utenGjesteprosjekter(
        data.map((p) => ({ id: p.id, name: p.name, projectNumber: p.projectNumber ?? null })),
        gjesteprosjekter,
      );
    }
    if (visning === "lokal") {
      return utenGjesteprosjekter(
        lokale.map((p) => ({ id: p.id, name: p.name, projectNumber: p.projectNumber ?? null })),
        gjesteprosjekter,
      );
    }
    return [];
  }, [visning, query.data, lokale, gjesteprosjekter]);

  return {
    visning,
    prosjekter,
    gjesteprosjekter,
    erFrakoblet: visning === "lokal",
    erPaaNettet,
    feilmelding: query.error?.message ?? null,
    refetch: () => {
      query.refetch();
      gjesteQuery.refetch();
    },
  };
}
