import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import {
  klassifiserManuellReise,
  tilManuellReiseSpor,
  velgOppmotested,
  type ManuellReiseKlassifisering,
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

/** Grå forklaringslinje: «Under terskel (30 min) — føres som arbeidstid» o.l. */
export function forklaringTekst(
  t: TFunction,
  k: ManuellReiseKlassifisering,
  lonnsartNavn: string | null,
): string {
  const f = k.forklaring;
  if (f.type === "ukjentAvstand") return t("timer.reiseTerskel.ukjentAvstand");
  const terskel =
    f.enhet === "km"
      ? t("timer.reiseTerskel.km", { km: (f.terskelM / 1000).toLocaleString("nb-NO") })
      : t("timer.reiseTerskel.min", { min: f.terskelMin });
  if (!k.erReise) return t("timer.reiseTerskel.underArbeid", { terskel });
  return k.reiseRegel.grensepunktTreff && lonnsartNavn
    ? t("timer.reiseTerskel.overBand", { terskel, art: lonnsartNavn })
    : t("timer.reiseTerskel.over", { terskel });
}

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

  const valg = useMemo(() => velgOppmotested(oppmotesteder, sisteValg), [oppmotesteder, sisteValg]);
  // Nedtrekket vises kun når terskelen måles i km og firmaet har flere steder.
  const visVelger = !!regel && regel.reiseTerskelEnhet === "km" && valg.modus === "velg";
  const oppmotestedId =
    valg.modus === "auto" ? valg.oppmotestedId : visVelger ? valgtId : null;

  const avstandM = useMemo(() => {
    if (!oppmotestedId || !byggeplassId) return null;
    return hentMatriseRadLokalt(oppmotestedId, byggeplassId)?.avstandM ?? null;
  }, [oppmotestedId, byggeplassId]);

  const klassifisering = useMemo(
    () =>
      regel
        ? klassifiserManuellReise({
            regel,
            reisetimer: timer,
            avstandM,
            grensepunkter,
            resolverLonnsartId,
            standardLonnsartId,
          })
        : null,
    [regel, timer, avstandM, grensepunkter, resolverLonnsartId, standardLonnsartId],
  );

  function velg(id: string) {
    setValgtId(id);
    void lagreSisteReiseOppmotested(organizationId, id);
  }

  return {
    klassifisering,
    spor: klassifisering ? tilManuellReiseSpor(klassifisering, oppmotestedId) : null,
    lonnsartNavn: (id: string | null) => (id ? (lonnsartNavn.get(id) ?? null) : null),
    velger: visVelger
      ? {
          valgtId,
          steder: oppmotesteder.map((o) => ({ id: o.id, navn: o.navn })),
          velg,
        }
      : null,
  };
}
