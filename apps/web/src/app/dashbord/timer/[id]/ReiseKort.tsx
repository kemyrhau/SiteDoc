"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@sitedoc/ui";
import {
  finnOverlappendeTidsrom,
  klokkeTilMin,
  manuellReiseForklaringTekst,
  manuellReiseTerskelTekst,
  medOverforingPeriodeId,
  periodeDatoFraOverforing,
  tilFraAntall,
  fraFraTilOgAntall,
  type ReiseKategori,
  type ReiseKortSperre,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { KnappMedForklaring } from "@/components/KnappMedForklaring";
import { RadByggeplassFelt, useRadByggeplass } from "@/components/timer/RadByggeplassFelt";
import { byggeplasserForProsjekt, velgStandardByggeplass, type ByggeplassValg } from "@/lib/timerByggeplass";
import {
  reiseHavnerI,
  useManuellReiseWeb,
  type ReiseHavnerAnnenRad,
  type ReiseHavnerRad,
  type ReiseKortValg,
} from "@/hooks/useManuellReiseWeb";

/* ============================================================================
 *  POST 2026-11-15 (13) L2 § 7 C: reise-kortet («+ Reise») på web.
 *
 *  Erstatter `TimerRadDialog` med låst reise-lønnsart for NY reise-rad — samme
 *  kort som mobilens `ReiseKort`: Tur / Retur, oppmøtestedet som tekst (bare når
 *  firmaet har flere), én resultatlinje og underprosjekt. Tid, kjøretid, lønnsart og
 *  aktivitet utledes — den ansatte velger aldri oppmøtested.
 *
 *  Lagre sperres (KnappMedForklaring) når resultatet har en sperre, når
 *  oppslagene ikke er lastet, eller når sedelen mangler aktivitet.
 *
 *  § 8.22 punkt 2 (Kenneth 2026-11-21, svar 1A): ingen egen kontorreise. Ved
 *  oppmøtestedet kan arbeideren velge «Fra et annet kontor fra i dag» (≥ 2 aktive
 *  kontorer): `oppmotePeriode.overforing` setter perioden fra sedeldatoen FØR raden,
 *  og reisen lagres som vanlig reise fra det kontoret. Kortlinjen «Midlertidig: X fra
 *  dd.mm · Avslutt» avslutter perioden.
 *
 *  w15b (B42 A, presiseringen 2026-11-21): systemet foreslår, arbeideren retter.
 *  «Hvor kjørte du til?» (prosjekt + byggeplass), «Start kl.» og «Slutt kl.» fylt
 *  ut av forslaget og rettbare.
 *  Retter han starten, følger slutten (start + kjøretid); en rettet slutt står.
 *  Bytter han valg, kontor, prosjekt eller byggeplass, regnes forslaget på nytt.
 *  Linja «havner i» regner kortet før lagring (`reiseHavnerI`). Overlapp med en
 *  annen rad og slutt før start sperrer Lagre (serveren avviser overlapp uansett).
 * ============================================================================ */

/** w15b: en rad på sedelen — dagsrammen, overlapp-sperren og linja «havner i». */
export type ReiseKortDagsrad = ReiseHavnerRad & { tilTid: string | null };

/** O1 TILLEGG: «1», «1,5», «0.75» → timer; tomt, 0 eller ugyldig → null. */
function tolkAntall(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : null;
}

/**
 * O6 (§ 8.22): «Antall timer» følger retningen. «Til byggeplass»: slutten (ankomsten, altså
 * jobbstart) står fast, og Start = Slutt − antall. «Fra byggeplass»: Start står fast, og
 * Slutt = Start + antall. Reise bærer aldri matpausen (pause 0). Klemmes ved døgnkanten
 * som før (00:00 / 23:59). null = tiden som skal stå fast, mangler.
 */
export function reiseTiderFraAntall(
  retning: "tur" | "retur",
  fra: string | null,
  til: string | null,
  antall: number,
): { start: string; slutt: string } | null {
  if (retning === "tur") return til ? { start: fraFraTilOgAntall(til, antall), slutt: til } : null;
  return fra ? { start: fra, slutt: tilFraAntall(fra, antall, fra, 0) } : null;
}

/** YYYY-MM-DD → dd.mm */
function kortDato(d: string): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
}

export const SPERRE_NOKKEL: Record<ReiseKortSperre, string> = {
  byggeplassPeriode: "timer.reiseKort.sperre.byggeplassPeriode",
  oppmoteIkkeValgt: "timer.reiseKort.sperre.oppmoteIkkeValgt",
  manglerKjoretid: "timer.reiseKort.sperre.manglerKjoretid",
  manglerDagstid: "timer.reiseKort.sperre.manglerDagstid",
  utenforDognet: "timer.reiseKort.sperre.utenforDognet",
  manglerArt: "timer.reiseTerskel.manglerArt",
  manglerRegel: "timer.reiseKort.sperre.manglerRegel",
};

export function ReiseKort({
  sheetId,
  organizationId,
  dato,
  projectId,
  prosjekter,
  sedelByggeplassId,
  byggeplasser,
  prosjektNavn,
  aktivitetId,
  dagsrader,
  andreRader,
  eierId,
  resolverLonnsartId,
  erFirmaAdmin,
  forvalgtByggeplassId,
  forvalgtEcoId,
  jobbKortId,
  onLukk,
}: {
  sheetId: string;
  organizationId: string;
  /** Sedelens dato (YYYY-MM-DD). */
  dato: string;
  projectId: string;
  /** w15b: prosjektene arbeideren kan føre timer på («Hvor kjørte du til?»). */
  prosjekter: readonly { id: string }[];
  /** w15b: sedelens byggeplass — jobbenes effektive byggeplass i linja «havner i». */
  sedelByggeplassId: string | null;
  /** Firmaets byggeplasser (alle prosjekter). */
  byggeplasser: readonly ByggeplassValg[] | undefined;
  prosjektNavn: (projectId: string) => string;
  /** Sedelens aktivitet — reise-raden får den automatisk. null → Lagre sperret. */
  aktivitetId: string | null;
  dagsrader: readonly ReiseKortDagsrad[];
  /** w15f (F55): maskin, tillegg og utlegg på sedelen — linja «havner i» ser kort uten arbeid. */
  andreRader?: readonly ReiseHavnerAnnenRad[];
  /** w15f (F55): sedelens eier — reisens egen kort-id regnes som på serveren. */
  eierId?: string;
  resolverLonnsartId: string | null;
  /** Firmaadmin får lenke til reise-regelsettet ved manglende art. */
  erFirmaAdmin: boolean;
  /** w3a (S6 A, B34 B): «+ Reise» fra en jobb — jobbens byggeplass og underprosjekt er
   *  forvalgt. Feltene står og kan endres. Utelatt = som før. */
  forvalgtByggeplassId?: string | null;
  forvalgtEcoId?: string | null;
  /** O1 (§ 8.22): kort-id-en til jobben vinduet ble åpnet fra. Under terskel føres turen
   *  som arbeid i DEN jobben når nøkkelen er lik. Utelatt = som før (serveren velger). */
  jobbKortId?: string | null;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [valg, setValg] = useState<ReiseKortValg | null>(null);
  const [ecoId, setEcoId] = useState<string | null>(forvalgtEcoId ?? null);
  const [feil, setFeil] = useState<string | null>(null);
  // w15b: «Hvor kjørte du til?» — fylt ut fra jobben, kan byttes.
  const [prosjektId, setProsjektId] = useState(projectId);
  // § 8.22 (svar 1A): «Fra et annet kontor fra i dag». null = oppmøtestedet perioden gir.
  const [annetKontorId, setAnnetKontorId] = useState<string | null>(null);
  // w15b: arbeiderens rettede tider. null = forslaget.
  const [rettetStart, setRettetStart] = useState<string | null>(null);
  const [rettetSlutt, setRettetSlutt] = useState<string | null>(null);
  // O1 TILLEGG: arbeiderens valg reisetid/arbeidstid (null = terskelen foreslår) og
  // «Antall timer» slik han skrev det (null = vises fra start og slutt).
  const [kategoriValg, setKategoriValg] = useState<ReiseKategori | null>(null);
  const [antallTekst, setAntallTekst] = useState<string | null>(null);
  const nullstillTider = () => {
    setRettetStart(null);
    setRettetSlutt(null);
    setAntallTekst(null);
    setKategoriValg(null);
  };
  const reiseProsjektId = prosjektId;

  // Forvalgt byggeplass fra jobben erstatter auto-forslaget (jobben er stedet).
  const bp = useRadByggeplass({
    byggeplasser,
    projectId: prosjektId,
    rad: forvalgtByggeplassId !== undefined ? { byggeplassId: forvalgtByggeplassId } : undefined,
  });
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({ projectId: reiseProsjektId, organizationId });

  const reise = useManuellReiseWeb({
    organizationId,
    dato,
    projectId: reiseProsjektId,
    byggeplassId: bp.byggeplassId,
    dagsrader,
    resolverLonnsartId,
    valg,
    annetKontorId,
    startTid: rettetStart,
    sluttTid: rettetSlutt,
    kategoriValg,
  });
  const { aktivtValg, resultat, oppmotestedNavn, regelStatus } = reise;
  const { kontorOppsett, kontorKall, kontorKonflikt, apenOverforing } = reise;

  const overforingMut = trpc.oppmotePeriode.overforing.useMutation({
    onSettled: () => utils.oppmotePeriode.hentMine.invalidate(),
  });

  const tilfoy = trpc.timer.dagsseddel.tilfoyTimerRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const sperre = regelStatus === "klar" ? resultat.sperre : null;
  const lagretByggeplassId = bp.byggeplassId;

  // w15b: slutt før start, og overlapp med en annen rad på sedelen (samme delte regel som
  // timerad-vinduet; serveren avviser overlapp i `tilfoyTimerRad`).
  const fraMin = klokkeTilMin(resultat.fraTid);
  const tilMin = klokkeTilMin(resultat.tilTid);
  const sluttForStart = fraMin != null && tilMin != null && tilMin <= fraMin;
  const overlapp = sluttForStart ? null : finnOverlappendeTidsrom(resultat.fraTid, resultat.tilTid, dagsrader);
  const tidSperre = sluttForStart
    ? t("timer.feil.sluttForStart")
    : overlapp
      ? overlapp.projectId
        ? t("timer.feil.overlappKort", {
            fra: resultat.fraTid,
            til: resultat.tilTid,
            annenFra: overlapp.fraTid,
            annenTil: overlapp.tilTid,
            kort: prosjektNavn(overlapp.projectId),
          })
        : t("timer.feil.overlapp", {
            fra: resultat.fraTid,
            til: resultat.tilTid,
            annenFra: overlapp.fraTid,
            annenTil: overlapp.tilTid,
          })
      : null;

  // w15b: hvilket kort reisen havner i — samme regel serveren kjører etter lagring.
  const sedelByggeplass = sedelByggeplassId
    ? ((byggeplasser ?? []).find((b) => b.id === sedelByggeplassId) ?? null)
    : null;
  const havner =
    regelStatus === "klar" && resultat.spor && resultat.fraTid
      ? reiseHavnerI({
          rader: dagsrader,
          andreRader,
          eier: eierId ? { userId: eierId, dato } : null,
          sedelByggeplass,
          jobbKortId,
          reise: {
            projectId: reiseProsjektId,
            ecoId,
            byggeplassId: lagretByggeplassId,
            retning: resultat.spor.reiseRetning,
            fraTid: resultat.fraTid,
            erReise: resultat.spor.erReise,
          },
        })
      : null;
  const havnerTekst = !havner
    ? null
    : havner.type === "jobb"
      ? t("timer.reiseKort.havnerJobb", {
          sted:
            (havner.byggeplassId && (byggeplasser ?? []).find((b) => b.id === havner.byggeplassId)?.name) ||
            prosjektNavn(havner.projectId),
        })
      : havner.type === "kort"
        ? t("timer.reiseKort.havnerKort", {
            sted:
              (havner.byggeplassId && (byggeplasser ?? []).find((b) => b.id === havner.byggeplassId)?.name) ||
              prosjektNavn(havner.projectId),
          })
        : t("timer.reiseKort.havnerEget", { prosjekt: prosjektNavn(havner.projectId) });

  // O1 (§ 8.22): under terskel er turen arbeid — den står i jobben vinduet ble åpnet fra
  // (regel 1) når linja «havner i» peker dit, altså når nøkkelen er lik. Ellers ingen kort-id.
  const arbeidKortId =
    jobbKortId && resultat.spor && !resultat.spor.erReise && havner?.type === "jobb" && havner.kortId === jobbKortId
      ? jobbKortId
      : null;

  const kanLagre =
    regelStatus === "klar" &&
    sperre == null &&
    tidSperre == null &&
    resultat.timer > 0 &&
    !kontorKonflikt &&
    !overforingMut.isPending &&
    !!aktivitetId &&
    !!resultat.spor &&
    !!resultat.klassifisering?.lonnsartId &&
    !!resultat.fraTid &&
    !!resultat.tilTid;

  const forklaring =
    regelStatus === "feilet"
      ? t("sperret.reiseRegelFeilet")
      : regelStatus === "laster"
        ? t("sperret.reiseRegelLaster")
        : sperre === "manglerArt" && erFirmaAdmin
          ? t("timer.reiseTerskel.manglerStandardArt")
          : sperre
          ? t(SPERRE_NOKKEL[sperre])
          : tidSperre
          ? tidSperre
          : kontorKonflikt
            ? t("timer.reiseKort.sperre.adminMidlertidig")
            : !aktivitetId
            ? t("timer.feil.aktivitetPaakrevd")
            : "";

  async function lagre() {
    if (!kanLagre || !aktivitetId || !resultat.spor || !resultat.klassifisering?.lonnsartId) return;
    setFeil(null);
    let s = resultat.spor;
    if (kontorKall) {
      // Perioden skrives FØR raden, så raden bærer periodens id i reiseRegel.
      try {
        const r = await overforingMut.mutateAsync({
          id: crypto.randomUUID(),
          organizationId,
          handling: kontorKall.handling,
          oppmotestedId: kontorKall.oppmotestedId,
          dato: kontorKall.dato,
        });
        // Ny ved «opprettet», åpen ved «ingen».
        s = medOverforingPeriodeId(s, r.periode?.id ?? null);
      } catch (e) {
        setFeil(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    tilfoy.mutate({
      sheetId,
      projectId: reiseProsjektId,
      lonnsartId: resultat.klassifisering.lonnsartId,
      aktivitetId,
      timer: resultat.timer,
      externalCostObjectId: ecoId,
      vehicleId: null,
      beskrivelse: null,
      fraTid: resultat.fraTid,
      tilTid: resultat.tilTid,
      // Reise bærer aldri matpausen (pauseFraForRad hopper over erReise).
      pauseMin: 0,
      byggeplassId: lagretByggeplassId,
      ...(arbeidKortId ? { kortId: arbeidKortId } : {}),
      // Sporet kun når regelen sier reise; under terskel er raden ordinær
      // (reiseKilde null → serveren nuller sporet).
      ...(s.erReise && s.reiseKilde
        ? {
            reiseKilde: s.reiseKilde,
            reiseRetning: s.reiseRetning,
            reiseOppmotestedId: s.reiseOppmotestedId,
            reiseKjoretidMin: s.reiseKjoretidMin,
            reiseAvstandM: s.reiseAvstandM,
            reiseRegel: s.reiseRegel as unknown as Record<string, unknown> | null,
          }
        : {}),
    });
  }

  /** Avslutt uten reise: perioden slutter dagen før sedeldatoen (slettes om den startet i dag). */
  function avsluttOverforing() {
    setFeil(null);
    overforingMut.mutate(
      {
        id: crypto.randomUUID(),
        organizationId,
        handling: "slutt",
        dato: periodeDatoFraOverforing(dato, "00:00", "retur"),
      },
      {
        onSuccess: () => {
          setAnnetKontorId(null);
          nullstillTider();
        },
        onError: (e: { message: string }) => setFeil(e.message),
      },
    );
  }

  // w15b: forslaget regnes på nytt når valget endres — rettede tider forkastes.
  function velg(v: ReiseKortValg) {
    setValg(v);
    nullstillTider();
  }
  function byttProsjekt(id: string) {
    setProsjektId(id);
    // Underprosjektet hører til prosjektet; byggeplassen foreslås på nytt for det nye.
    setEcoId(null);
    bp.setByggeplassId(
      velgStandardByggeplass({ gjeldende: null, kandidater: byggeplasserForProsjekt(byggeplasser, id), toppbar: null }),
    );
    nullstillTider();
  }

  const valgKnapp = (v: ReiseKortValg, tekst: string, key: string) => {
    const aktiv = v.type === aktivtValg.type;
    return (
      <button
        key={key}
        type="button"
        onClick={() => {
          if (!aktiv) velg(v);
        }}
        aria-pressed={aktiv}
        className={`rounded-lg border px-3 py-2 text-sm ${
          aktiv ? "border-blue-600 bg-blue-50 font-medium text-blue-800" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
        }`}
      >
        {tekst}
      </button>
    );
  };

  return (
    <Modal open={true} onClose={onLukk} title={t("timer.reiseKort.tittel")}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {valgKnapp({ type: "tur" }, t("timer.reiseKort.tur"), "tur")}
          {valgKnapp({ type: "retur" }, t("timer.reiseKort.retur"), "retur")}
        </div>

        {apenOverforing && apenOverforing.oppmotestedId && (
          <p className="text-sm text-gray-700">
            {t("timer.reiseKort.midlertidigLinje", {
              navn: reise.kontorNavn(apenOverforing.oppmotestedId),
              dato: kortDato(apenOverforing.fraDato),
            })}
            <span className="mx-1 text-gray-400">·</span>
            <button
              type="button"
              onClick={avsluttOverforing}
              disabled={overforingMut.isPending}
              className="font-medium text-blue-700 hover:underline disabled:opacity-50"
            >
              {t("timer.reiseKort.avslutt")}
            </button>
          </p>
        )}

        {oppmotestedNavn && (
          <p className="text-sm text-gray-700">{t("timer.reiseKort.fraOppmotested", { navn: oppmotestedNavn })}</p>
        )}

        {/* § 8.22 (svar 1A): midlertidig oppmøtested satt av arbeideren selv — reisen
            regnes fra kontoret, perioden gjelder fra i dag. */}
        {kontorOppsett && kontorOppsett.andre.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-annet-kontor">
              {t("timer.reiseKort.annetKontorFraIDag")}
            </label>
            <select
              id="reise-annet-kontor"
              value={annetKontorId ?? ""}
              onChange={(e) => {
                setAnnetKontorId(e.target.value || null);
                nullstillTider();
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {kontorOppsett.andre.map((id) => (
                <option key={id} value={id}>
                  {reise.kontorNavn(id)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* w15b: «Hvor kjørte du til?» — prosjekt og byggeplass. */}
        <div>
            <p className="mb-2 text-sm font-medium text-gray-900">
              {aktivtValg.type === "retur" ? t("timer.reiseKort.hvorFra") : t("timer.reiseKort.hvorTil")}
            </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-prosjekt">
                    {t("timer.felt.prosjekt")}
                  </label>
                  <select
                    id="reise-prosjekt"
                    value={prosjektId}
                    onChange={(e) => byttProsjekt(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    {!prosjekter.some((p) => p.id === prosjektId) && (
                      <option value={prosjektId}>{prosjektNavn(prosjektId)}</option>
                    )}
                    {prosjekter.map((p) => (
                      <option key={p.id} value={p.id}>
                        {prosjektNavn(p.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <RadByggeplassFelt
                  kandidater={bp.kandidater}
                  verdi={bp.byggeplassId}
                  onEndre={(id) => {
                    bp.setByggeplassId(id);
                    nullstillTider();
                  }}
                />
              </div>
          </div>

        {/* w15b: start og slutt er forslaget og kan rettes. Skjult bare når det ikke finnes
            noe å foreslå fra (byggeplass-periode, oppmøtested ikke valgt, kjøretid mangler). */}
        {regelStatus === "klar" &&
          sperre !== "byggeplassPeriode" &&
          sperre !== "oppmoteIkkeValgt" &&
          sperre !== "manglerKjoretid" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-start">
                  {t("timer.reiseKort.startKl")}
                </label>
                <input
                  id="reise-start"
                  type="time"
                  value={rettetStart ?? resultat.fraTid ?? ""}
                  onChange={(e) => {
                    const start = e.target.value || null;
                    setRettetStart(start);
                    // Slutten følger starten: start + skrevet antall timer, ellers
                    // start + kjøretid, til den rettes igjen.
                    const antall = tolkAntall(antallTekst);
                    setRettetSlutt(start && antall != null ? tilFraAntall(start, antall, start, 0) : null);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-slutt">
                  {t("timer.reiseKort.sluttKl")}
                </label>
                <input
                  id="reise-slutt"
                  type="time"
                  value={rettetSlutt ?? resultat.tilTid ?? ""}
                  onChange={(e) => {
                    setRettetSlutt(e.target.value || null);
                    // Rettet slutt → antall timer regnes av start og slutt.
                    setAntallTekst(null);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {/* O1 TILLEGG: antall timer regner tiden ut (og omvendt). O6: retningen avgjør
                  hvilken ende som står fast — se `reiseTiderFraAntall`. */}
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-antall">
                  {t("timer.felt.antallTimer")}
                </label>
                <input
                  id="reise-antall"
                  type="number"
                  step="0.25"
                  min={0}
                  max={24}
                  value={antallTekst ?? (resultat.fraTid && resultat.tilTid ? String(Math.round(resultat.timer * 100) / 100) : "")}
                  onChange={(e) => {
                    setAntallTekst(e.target.value);
                    const antall = tolkAntall(e.target.value);
                    const tider =
                      antall != null
                        ? reiseTiderFraAntall(aktivtValg.type, resultat.fraTid, resultat.tilTid, antall)
                        : null;
                    if (tider) {
                      // O6: «Til byggeplass» flytter Start; «Fra byggeplass» flytter Slutt.
                      if (aktivtValg.type === "tur") setRettetStart(tider.start);
                      setRettetSlutt(tider.slutt);
                      // Gate (136) vilkår 1: klemmes tiden ved døgnkanten (00:00 / 23:59),
                      // viser feltet det som faktisk lagres (`resultat.timer`), ikke det skrevne.
                      const s = klokkeTilMin(tider.start);
                      const e = klokkeTilMin(tider.slutt);
                      if (s != null && e != null && Math.abs(e - s - antall * 60) > 0.5) setAntallTekst(null);
                    }
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

        {/* O1 TILLEGG (§ 8.22): terskelen foreslår, arbeideren velger reisetid eller arbeidstid. */}
        {regelStatus === "klar" && resultat.klassifisering && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">{t("timer.reiseKort.foresSom")}</p>
            <div className="flex flex-wrap gap-2">
              {(["reisetid", "arbeidstid"] as const).map((k) => {
                const aktiv = resultat.klassifisering!.kategori === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKategoriValg(k)}
                    aria-pressed={aktiv}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      aktiv
                        ? "border-blue-600 bg-blue-50 font-medium text-blue-800"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {t(k === "reisetid" ? "timer.reisetid" : "timer.reiseKort.arbeidstid")}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Forslaget: firmaets kjøretid, deretter hvorfor arbeid/reise. */}
        {regelStatus === "klar" && resultat.kjoretidMin != null && (
          <div>
            <p className="text-sm text-gray-700">{t("timer.reiseKort.forslag", { min: resultat.kjoretidMin })}</p>
            {resultat.klassifisering && resultat.klassifisering.lonnsartId != null && (
              <p className="mt-1 text-xs text-gray-500">
                {/* O1: turen føres som arbeid i jobben vinduet ble åpnet fra — si det. */}
                {arbeidKortId && resultat.klassifisering.forklaring.type !== "ukjentAvstand"
                  ? t(
                      resultat.klassifisering.forklaring.type === "under"
                        ? "timer.reiseKort.underTerskelPaaJobb"
                        : "timer.reiseKort.overTerskelPaaJobb",
                      {
                        terskel: manuellReiseTerskelTekst(t, resultat.klassifisering.forklaring),
                        art: reise.lonnsartNavn(resultat.klassifisering.lonnsartId) ?? "",
                      },
                    )
                  : manuellReiseForklaringTekst(
                      t,
                      resultat.klassifisering,
                      reise.lonnsartNavn(resultat.klassifisering.lonnsartId),
                    )}
              </p>
            )}
          </div>
        )}

        {/* Ordre (11) C: mangler lønnsart → rød tekst; firmaadmin får lenke til
            reise-regelsettet (firmaadmin skal ikke bes om å spørre firmaadmin). */}
        {sperre === "manglerArt" && (
          <p className="text-xs font-medium text-red-700">
            {erFirmaAdmin ? t("timer.reiseTerskel.manglerStandardArt") : t("timer.reiseTerskel.manglerArt")}
            {erFirmaAdmin && (
              <>
                {" "}
                <Link href="/dashbord/firma/innstillinger#reise-regelsett" className="underline hover:text-red-900">
                  {t("timer.reiseTerskel.settStandardArt")}
                </Link>
              </>
            )}
          </p>
        )}
        {/* Øvrige sperrer (mangler kjøretid, utenfor døgnet …) vises synlig i
            kortet — tooltipen alene når ikke berøringsskjerm og havner bak modalen. */}
        {sperre && sperre !== "manglerArt" && forklaring && (
          <p className="text-xs font-medium text-red-700">{forklaring}</p>
        )}
        {!sperre && tidSperre && <p className="text-xs font-medium text-red-700">{tidSperre}</p>}
        {!sperre && !tidSperre && kontorKonflikt && (
          <p className="text-xs font-medium text-red-700">{t("timer.reiseKort.sperre.adminMidlertidig")}</p>
        )}

        {ecoer && ecoer.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.underprosjekt")}{" "}
              <span className="text-xs text-gray-400">({t("label.valgfritt")})</span>
            </label>
            <select
              value={ecoId ?? ""}
              onChange={(e) => setEcoId(e.target.value || null)}
              aria-label={t("timer.felt.underprosjekt")}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {ecoer.map((eco) => (
                <option key={eco.id} value={eco.id}>
                  {eco.proAdmId} — {eco.kortNavn}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* w15b: hvor reisen havner før han lagrer — samme regel som serveren. */}
        {havnerTekst && (
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">{havnerTekst}</p>
        )}

        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <KnappMedForklaring sperret={!kanLagre && !tilfoy.isPending} forklaring={forklaring}>
            <Button type="button" onClick={() => void lagre()} disabled={!kanLagre || tilfoy.isPending}>
              {tilfoy.isPending || overforingMut.isPending ? t("handling.lagrer") : t("handling.lagre")}
            </Button>
          </KnappMedForklaring>
        </div>
      </div>
    </Modal>
  );
}
