import { useEffect, useMemo, useState } from "react";
import {
  løsManuellReise,
  manuellReiseForklaringTekst,
  velgOppmotested,
  type ManuellReiseSpor,
  type ReiseRegelsett,
} from "@sitedoc/shared";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import { hentOppmotederLokalt } from "../../services/oppmotestedKatalog";
import { hentMatriseRadLokalt } from "../../services/reisetidMatriseKatalog";
import { hentReiseGrensepunkterLokalt } from "../../services/reiseGrensepunktKatalog";
import { hentLonnsarterLokalt, hentStandardLonnsartLokalt } from "../../services/timerKatalog";
import {
  hentSisteReiseOppmotested,
  lagreSisteReiseOppmotested,
} from "../../lib/reiseOppmotestedLagring";

/* ============================================================================
 *  Ordre 2026-11-14 (9): terskel og avstandsbånd på «+ Reise» (mobil).
 *
 *  Leser regelsett, oppmøtesteder, matrisecelle og bånd fra lokal cache (virker
 *  offline) og kaller den DELTE `klassifiserManuellReise` — samme regel i
 *  prosjektkortet (DagSeksjon) og Bekreft dag manuell modus, siden begge åpner
 *  `TimerRadModal` med `reise.laast`.
 *
 *  Uten cachet regelsett (aldri synket) er `klassifisering` null → modalen
 *  oppfører seg som før (reise-art, erReise fra lønnsarten).
 * ============================================================================ */

export type { ManuellReiseSpor };

/**
 * Grå forklaringslinje — delt med web (ordre (11) A). Beholdt navn for
 * eksisterende kallere.
 */
export const forklaringTekst = manuellReiseForklaringTekst;

function lesRegel(organizationId: string): ReiseRegelsett | null {
  const r = hentOrganizationSettingLokalt(organizationId);
  if (!r) return null;
  return {
    reiseTerskelEnhet: r.reiseTerskelEnhet as ReiseRegelsett["reiseTerskelEnhet"],
    reiseTerskelMin: r.reiseTerskelMin,
    reiseTerskelM: r.reiseTerskelM ?? null,
    reiseUnderTerskelType: r.reiseUnderTerskelType as ReiseRegelsett["reiseUnderTerskelType"],
    reiseOverTerskelType: r.reiseOverTerskelType as ReiseRegelsett["reiseOverTerskelType"],
  };
}

export function useManuellReise({
  aktiv,
  organizationId,
  byggeplassId,
  timer,
  resolverLonnsartId,
}: {
  /** Kun NY rad fra «+ Reise» (`reise.laast && !eksisterendeRad`). */
  aktiv: boolean;
  organizationId: string;
  /** Kortets effektive byggeplass (radens, ellers sedelens). */
  byggeplassId: string | null;
  /** Innførte reisetimer (desimal). */
  timer: number;
  resolverLonnsartId: string | null;
}) {
  const regel = useMemo(() => (aktiv ? lesRegel(organizationId) : null), [aktiv, organizationId]);
  const oppmotesteder = useMemo(
    () => (aktiv ? hentOppmotederLokalt(organizationId) : []),
    [aktiv, organizationId],
  );
  const grensepunkter = useMemo(
    () => (aktiv ? hentReiseGrensepunkterLokalt(organizationId) : []),
    [aktiv, organizationId],
  );
  const standardLonnsartId = useMemo(
    () => (aktiv ? (hentStandardLonnsartLokalt(organizationId)?.id ?? null) : null),
    [aktiv, organizationId],
  );
  const lonnsartNavn = useMemo(() => {
    if (!aktiv) return new Map<string, string>();
    return new Map(hentLonnsarterLokalt(organizationId).map((l) => [l.id, l.navn]));
  }, [aktiv, organizationId]);

  // Siste valg leses asynkront (SecureStore); undefined = ikke lest ennå.
  const [sisteValg, setSisteValg] = useState<string | null | undefined>(undefined);
  const [valgtId, setValgtId] = useState<string | null>(null);
  useEffect(() => {
    if (!aktiv) return;
    let avbrutt = false;
    void hentSisteReiseOppmotested(organizationId).then((id) => {
      if (avbrutt) return;
      setSisteValg(id);
      const v = velgOppmotested(hentOppmotederLokalt(organizationId), id);
      if (v.modus === "velg") setValgtId(v.valgtId);
    });
    return () => {
      avbrutt = true;
    };
  }, [aktiv, organizationId]);

  // Ordre (11) A: oppmøtested-valg, avstand og klassifisering i ÉN delt
  // funksjon — webens «+ Reise» kaller den samme.
  const res = useMemo(
    () =>
      løsManuellReise({
        regel,
        oppmotesteder,
        sisteValgId: sisteValg,
        valgtId,
        byggeplassId,
        avstandFor: (o, b) => hentMatriseRadLokalt(o, b)?.avstandM ?? null,
        reisetimer: timer,
        grensepunkter,
        resolverLonnsartId,
        standardLonnsartId,
      }),
    [regel, oppmotesteder, sisteValg, valgtId, byggeplassId, timer, grensepunkter, resolverLonnsartId, standardLonnsartId],
  );

  function velg(id: string) {
    setValgtId(id);
    void lagreSisteReiseOppmotested(organizationId, id);
  }

  return {
    klassifisering: res.klassifisering,
    spor: res.spor,
    lonnsartNavn: (id: string | null) => (id ? (lonnsartNavn.get(id) ?? null) : null),
    velger: res.visVelger
      ? {
          valgtId,
          steder: oppmotesteder.map((o) => ({ id: o.id, navn: o.navn })),
          velg,
        }
      : null,
  };
}
