"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@sitedoc/ui";
import {
  finnOverlappendeTidsrom,
  klokkeTilMin,
  manuellReiseForklaringTekst,
  medOverforingPeriodeId,
  periodeDatoFraOverforing,
  type ReiseKortNaar,
  type ReiseKortSperre,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { KnappMedForklaring } from "@/components/KnappMedForklaring";
import { RadByggeplassFelt, useRadByggeplass } from "@/components/timer/RadByggeplassFelt";
import { byggeplasserForProsjekt, velgStandardByggeplass, type ByggeplassValg } from "@/lib/timerByggeplass";
import {
  reiseHavnerI,
  useManuellReiseWeb,
  type ReiseHavnerRad,
  type ReiseKortValg,
} from "@/hooks/useManuellReiseWeb";

/* ============================================================================
 *  POST 2026-11-15 (13) L2 § 7 C: reise-kortet («+ Reise») på web.
 *
 *  Erstatter `TimerRadDialog` med låst reise-lønnsart for NY reise-rad — samme
 *  kort som mobilens `ReiseKort`: Tur / Retur (+ overføringen første/siste dag
 *  i en periode, forhåndsvalgt), oppmøtestedet som tekst (bare når firmaet har
 *  flere), én resultatlinje og underprosjekt. Tid, kjøretid, lønnsart og
 *  aktivitet utledes — den ansatte velger aldri oppmøtested.
 *
 *  Lagre sperres (KnappMedForklaring) når resultatet har en sperre, når
 *  oppslagene ikke er lastet, eller når sedelen mangler aktivitet.
 *
 *  Del B (POST 2026-11-15 (13)): «Overføring til annet kontor» (≥ 2 aktive
 *  kontorer) setter et midlertidig oppmøtested — `oppmotePeriode.overforing`
 *  kalles FØR raden, så raden bærer periodens id. Valg av eget faste kontor
 *  avslutter det. Kortlinjen «Midlertidig: X fra dd.mm · Avslutt» angrer.
 *
 *  w15b (B42 A, presiseringen 2026-11-21): systemet foreslår, arbeideren retter.
 *  «Hvor kjørte du til?» (prosjekt + byggeplass, eller kontor), «Når kjørte du?»
 *  (kontorvalget), «Start kl.» og «Slutt kl.» fylt ut av forslaget og rettbare.
 *  Retter han starten, følger slutten (start + kjøretid); en rettet slutt står.
 *  Bytter han valg, prosjekt, byggeplass eller «Når», regnes forslaget på nytt.
 *  Linja «havner i» regner kortet før lagring (`reiseHavnerI`). Overlapp med en
 *  annen rad og slutt før start sperrer Lagre (serveren avviser overlapp uansett).
 * ============================================================================ */

/** w15b: en rad på sedelen — dagsrammen, overlapp-sperren og linja «havner i». */
export type ReiseKortDagsrad = ReiseHavnerRad & { tilTid: string | null; erOverforing?: boolean };

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
  resolverLonnsartId,
  skjulOverforingRetninger,
  erFirmaAdmin,
  forvalgtByggeplassId,
  forvalgtEcoId,
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
  resolverLonnsartId: string | null;
  /** Retninger sedelen alt har en overføringsrad for — tilbys ikke igjen. */
  skjulOverforingRetninger: ReadonlyArray<"ut" | "retur">;
  /** Firmaadmin får lenke til reise-regelsettet ved manglende art. */
  erFirmaAdmin: boolean;
  /** w3a (S6 A, B34 B): «+ Reise» fra en jobb — jobbens byggeplass og underprosjekt er
   *  forvalgt. Feltene står og kan endres. Utelatt = som før. */
  forvalgtByggeplassId?: string | null;
  forvalgtEcoId?: string | null;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [valg, setValg] = useState<ReiseKortValg | null>(null);
  const [ecoId, setEcoId] = useState<string | null>(forvalgtEcoId ?? null);
  const [feil, setFeil] = useState<string | null>(null);
  // w15b: «Hvor kjørte du til?» — fylt ut fra jobben, kan byttes.
  const [prosjektId, setProsjektId] = useState(projectId);
  // w15b: «Når kjørte du?» og arbeiderens rettede tider. null = forslaget.
  const [naar, setNaar] = useState<ReiseKortNaar | null>(null);
  const [rettetStart, setRettetStart] = useState<string | null>(null);
  const [rettetSlutt, setRettetSlutt] = useState<string | null>(null);
  const nullstillTider = () => {
    setRettetStart(null);
    setRettetSlutt(null);
  };
  // Kontorreisen føres på jobbens prosjekt; prosjektvalget gjelder byggeplass-reisen.
  const kontorValgt = valg?.type === "kontor";
  const reiseProsjektId = kontorValgt ? projectId : prosjektId;

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
    byggeplasser: byggeplasser ?? [],
    prosjektNavn,
    dagsrader,
    resolverLonnsartId,
    valg,
    skjulOverforingRetninger,
    naar: kontorValgt ? naar : null,
    startTid: rettetStart,
    sluttTid: rettetSlutt,
  });
  const { overforingValg, aktivtValg, resultat, oppmotestedNavn, regelStatus } = reise;
  const erOverforing = aktivtValg.type === "overforing";
  const overforing = erOverforing ? reise.overforinger[aktivtValg.indeks] : undefined;
  const erKontor = aktivtValg.type === "kontor";
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
  const lagretByggeplassId = erKontor
    ? null
    : erOverforing
      ? (overforing?.byggeplassId ?? bp.byggeplassId)
      : bp.byggeplassId;

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
          sedelByggeplass,
          reise: {
            projectId: reiseProsjektId,
            ecoId,
            byggeplassId: lagretByggeplassId,
            retning: resultat.spor.reiseRetning,
            fraTid: resultat.fraTid,
            erReise: resultat.spor.erReise,
            reiseKilde: resultat.spor.reiseKilde,
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
      : t("timer.reiseKort.havnerEget", { prosjekt: prosjektNavn(havner.projectId) });

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
    if (erKontor && kontorKall) {
      // Perioden skrives FØR raden, så raden bærer periodens id i reiseRegel.
      try {
        const r = await overforingMut.mutateAsync({
          id: crypto.randomUUID(),
          organizationId,
          handling: kontorKall.handling,
          ...(kontorKall.oppmotestedId ? { oppmotestedId: kontorKall.oppmotestedId } : {}),
          dato: kontorKall.dato,
        });
        // Ny ved «opprettet», lukket ved «lukket», åpen ved «ingen», null ved «slettet».
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
          setValg(null);
          nullstillTider();
        },
        onError: (e: { message: string }) => setFeil(e.message),
      },
    );
  }

  // w15b: forslaget regnes på nytt når valget endres — rettede tider forkastes.
  function velg(v: ReiseKortValg) {
    setValg(v);
    setNaar(null);
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
    // Kontorvalget er én knapp; kontoret velges i «Hvor kjørte du til?».
    const aktiv =
      v.type === aktivtValg.type &&
      (v.type !== "overforing" || (aktivtValg.type === "overforing" && v.indeks === aktivtValg.indeks));
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
          {/* w15b: kontorene står i «Hvor kjørte du til?»; forvalgt første andre kontor. */}
          {kontorOppsett &&
            kontorOppsett.andre.length > 0 &&
            valgKnapp(
              { type: "kontor", oppmotestedId: kontorOppsett.andre[0]! },
              t("timer.reiseKort.tilAnnetKontor"),
              "kontor",
            )}
        </div>
        {overforingValg.length > 0 && (
          <div className="flex flex-col items-start gap-2">
            {overforingValg.map(({ o, indeks }) =>
              valgKnapp(
                { type: "overforing", indeks },
                t("timer.reiseKort.overforing", { fra: o.fraNavn, til: o.tilNavn }),
                `ovf-${indeks}`,
              ),
            )}
          </div>
        )}

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

        {!erOverforing && !erKontor && oppmotestedNavn && (
          <p className="text-sm text-gray-700">{t("timer.reiseKort.fraOppmotested", { navn: oppmotestedNavn })}</p>
        )}

        {/* w15b: «Hvor kjørte du til?» — prosjekt og byggeplass, eller kontoret. */}
        {!erOverforing && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">
              {aktivtValg.type === "retur" ? t("timer.reiseKort.hvorFra") : t("timer.reiseKort.hvorTil")}
            </p>
            {erKontor && kontorOppsett && aktivtValg.type === "kontor" ? (
              kontorOppsett.andre.length === 1 ? (
                <p className="text-sm text-gray-900">{reise.kontorNavn(aktivtValg.oppmotestedId)}</p>
              ) : (
                <select
                  aria-label={t("timer.reiseKort.hvorTil")}
                  value={aktivtValg.oppmotestedId}
                  onChange={(e) => velg({ type: "kontor", oppmotestedId: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {kontorOppsett.andre.map((id) => (
                    <option key={id} value={id}>
                      {reise.kontorNavn(id)}
                    </option>
                  ))}
                </select>
              )
            ) : (
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
            )}
          </div>
        )}

        {/* w15b (B42 A): «Når kjørte du?» for kontorvalget. */}
        {erKontor && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">{t("timer.reiseKort.naar")}</p>
            <div className="flex flex-wrap gap-2">
              {(["forArbeid", "etterArbeid"] as const).map((n) => {
                const gjeldende = naar ?? (reise.kontorKall?.handling === "slutt" ? "etterArbeid" : "forArbeid");
                const aktiv = gjeldende === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={aktiv}
                    onClick={() => {
                      if (aktiv) return;
                      setNaar(n);
                      nullstillTider();
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      aktiv
                        ? "border-blue-600 bg-blue-50 font-medium text-blue-800"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {t(`timer.reiseKort.${n}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
                    setRettetStart(e.target.value || null);
                    // Slutten følger starten (start + kjøretid) til den rettes igjen.
                    setRettetSlutt(null);
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
                  onChange={(e) => setRettetSlutt(e.target.value || null)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

        {/* Forslaget: firmaets kjøretid, deretter hvorfor arbeid/reise. */}
        {regelStatus === "klar" && resultat.kjoretidMin != null && (
          <div>
            <p className="text-sm text-gray-700">{t("timer.reiseKort.forslag", { min: resultat.kjoretidMin })}</p>
            {resultat.klassifisering && resultat.klassifisering.lonnsartId != null && (
              <p className="mt-1 text-xs text-gray-500">
                {manuellReiseForklaringTekst(
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
