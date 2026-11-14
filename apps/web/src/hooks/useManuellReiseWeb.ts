"use client";

import { useEffect, useMemo, useState } from "react";
import {
  løsManuellReise,
  velgOppmotested,
  type ReiseRegelsett,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

/* ============================================================================
 *  Ordre 2026-11-14 (11) A: terskel og avstandsbånd på web-«+ Reise».
 *
 *  Samme delte regel som mobilens `useManuellReise`: `løsManuellReise` velger
 *  oppmøtested, slår opp avstand og klassifiserer (under terskel → standard
 *  ordinær art, erReise false; over → båndets art eller resolverens). Ingen
 *  egen web-logikk — kun datakilden er en annen (tRPC i stedet for lokal cache).
 *
 *  Siste oppmøtested huskes pr. firma i localStorage med SAMME nøkkel som
 *  mobil-web (`reiseOppmotestedLagring.ts`).
 * ============================================================================ */

function noekkel(organizationId: string): string {
  return `sitedoc_reise_oppmotested_${organizationId}`;
}

function lesSiste(organizationId: string): string | null {
  try {
    return localStorage.getItem(noekkel(organizationId));
  } catch {
    return null;
  }
}

function lagreSiste(organizationId: string, id: string): void {
  try {
    localStorage.setItem(noekkel(organizationId), id);
  } catch {
    // Ikke kritisk: neste gang er ingenting forhåndsvalgt.
  }
}

export function useManuellReiseWeb({
  aktiv,
  organizationId,
  byggeplassId,
  timer,
  resolverLonnsartId,
}: {
  /** Kun NY rad fra «+ Reise». */
  aktiv: boolean;
  organizationId: string;
  byggeplassId: string | null;
  /** Innførte reisetimer (desimal). */
  timer: number;
  resolverLonnsartId: string | null;
}) {
  const aktivert = aktiv && !!organizationId;
  const defaultsQ = trpc.organisasjon.hentArbeidstidDefaults.useQuery(
    { organizationId },
    { enabled: aktivert },
  );
  const stederQ = trpc.oppmotested.hentForFirma.useQuery(
    { organizationId },
    { enabled: aktivert },
  );
  const matriseQ = trpc.oppmotested.hentMatriseForFirma.useQuery(
    { organizationId },
    { enabled: aktivert },
  );
  const lonnsarterQ = trpc.timer.lonnsart.list.useQuery(
    { organizationId },
    { enabled: aktivert },
  );
  const defaults = defaultsQ.data;
  const steder = stederQ.data;
  const matrise = matriseQ.data;
  const lonnsarter = lonnsarterQ.data;

  // RETUR (11) vilkår 1 (lønn): klassifiseringen er bare gyldig når ALT den
  // bygger på er lastet. Mens et oppslag laster eller har feilet, er
  // `regel`/avstand/standardart ukjent, og «som før» (resolverens reise-art)
  // ville stille ført en under-terskel-rad som reise. Kalleren sperrer Lagre
  // til status er «klar» — aldri stille tilbakefall.
  const oppslag = [defaultsQ, stederQ, matriseQ, lonnsarterQ];
  const regelStatus: "klar" | "laster" | "feilet" = !aktivert
    ? "klar"
    : oppslag.some((q) => q.isError)
      ? "feilet"
      : oppslag.every((q) => q.data !== undefined)
        ? "klar"
        : "laster";

  const regel = useMemo<ReiseRegelsett | null>(() => {
    if (!aktivert || !defaults) return null;
    return {
      reiseTerskelEnhet: defaults.reiseTerskelEnhet as ReiseRegelsett["reiseTerskelEnhet"],
      reiseTerskelMin: defaults.reiseTerskelMin,
      reiseTerskelM: defaults.reiseTerskelM ?? null,
      reiseUnderTerskelType:
        defaults.reiseUnderTerskelType as ReiseRegelsett["reiseUnderTerskelType"],
      reiseOverTerskelType:
        defaults.reiseOverTerskelType as ReiseRegelsett["reiseOverTerskelType"],
    };
  }, [aktivert, defaults]);
  const oppmotesteder = useMemo(() => (aktivert ? (steder ?? []) : []), [aktivert, steder]);
  const grensepunkter = useMemo(
    () =>
      (defaults?.reiseGrenser ?? []).map((g) => ({ grenseM: g.grenseM, lonnsartId: g.lonnsartId })),
    [defaults],
  );
  // Samme definisjon som mobilens `hentStandardLonnsartLokalt`: aktiv + erStandardvalg.
  const standardLonnsartId = useMemo(
    () => (lonnsarter ?? []).find((l) => l.aktiv && l.erStandardvalg)?.id ?? null,
    [lonnsarter],
  );
  const navn = useMemo(
    () => new Map((lonnsarter ?? []).map((l) => [l.id, l.navn])),
    [lonnsarter],
  );
  const avstand = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const c of matrise ?? []) m.set(`${c.oppmotestedId}|${c.byggeplassId}`, c.avstandM ?? null);
    return m;
  }, [matrise]);

  // Siste valg leses etter mount (localStorage); undefined = ikke lest ennå.
  const [sisteValg, setSisteValg] = useState<string | null | undefined>(undefined);
  const [valgtId, setValgtId] = useState<string | null>(null);
  useEffect(() => {
    if (!aktivert || !steder) return;
    const id = lesSiste(organizationId);
    setSisteValg(id);
    const v = velgOppmotested(steder, id);
    if (v.modus === "velg") setValgtId((f) => f ?? v.valgtId);
  }, [aktivert, organizationId, steder]);

  const res = useMemo(
    () =>
      løsManuellReise({
        regel,
        oppmotesteder,
        sisteValgId: sisteValg,
        valgtId,
        byggeplassId,
        avstandFor: (o, b) => avstand.get(`${o}|${b}`) ?? null,
        reisetimer: timer,
        grensepunkter,
        resolverLonnsartId,
        standardLonnsartId,
      }),
    [regel, oppmotesteder, sisteValg, valgtId, byggeplassId, avstand, timer, grensepunkter, resolverLonnsartId, standardLonnsartId],
  );

  function velg(id: string) {
    setValgtId(id);
    lagreSiste(organizationId, id);
  }

  return {
    regelStatus,
    klassifisering: res.klassifisering,
    spor: res.spor,
    lonnsartNavn: (id: string | null) => (id ? (navn.get(id) ?? null) : null),
    velger: res.visVelger
      ? {
          valgtId,
          steder: oppmotesteder.map((o) => ({ id: o.id, navn: o.navn })),
          velg,
        }
      : null,
  };
}
