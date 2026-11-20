"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@sitedoc/ui";
import {
  manuellReiseForklaringTekst,
  medOverforingPeriodeId,
  periodeDatoFraOverforing,
  type ReiseKortSperre,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { KnappMedForklaring } from "@/components/KnappMedForklaring";
import { RadByggeplassFelt, useRadByggeplass } from "@/components/timer/RadByggeplassFelt";
import type { ByggeplassValg } from "@/lib/timerByggeplass";
import { useManuellReiseWeb, type ReiseKortValg } from "@/hooks/useManuellReiseWeb";

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
 * ============================================================================ */

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
  /** Firmaets byggeplasser (alle prosjekter). */
  byggeplasser: readonly ByggeplassValg[] | undefined;
  prosjektNavn: (projectId: string) => string;
  /** Sedelens aktivitet — reise-raden får den automatisk. null → Lagre sperret. */
  aktivitetId: string | null;
  dagsrader: readonly { fraTid: string | null; tilTid: string | null; erReise: boolean; erOverforing?: boolean }[];
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

  // Forvalgt byggeplass fra jobben erstatter auto-forslaget (jobben er stedet).
  const bp = useRadByggeplass({
    byggeplasser,
    projectId,
    rad: forvalgtByggeplassId !== undefined ? { byggeplassId: forvalgtByggeplassId } : undefined,
  });
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({ projectId, organizationId });

  const reise = useManuellReiseWeb({
    organizationId,
    dato,
    projectId,
    byggeplassId: bp.byggeplassId,
    byggeplasser: byggeplasser ?? [],
    prosjektNavn,
    dagsrader,
    resolverLonnsartId,
    valg,
    skjulOverforingRetninger,
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
  const kanLagre =
    regelStatus === "klar" &&
    sperre == null &&
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
      projectId,
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
      byggeplassId: erKontor
        ? null
        : erOverforing
          ? (overforing?.byggeplassId ?? bp.byggeplassId)
          : bp.byggeplassId,
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
        onSuccess: () => setValg(null),
        onError: (e: { message: string }) => setFeil(e.message),
      },
    );
  }

  const valgKnapp = (v: ReiseKortValg, tekst: string, key: string) => {
    const aktiv =
      v.type === aktivtValg.type &&
      (v.type !== "overforing" || (aktivtValg.type === "overforing" && v.indeks === aktivtValg.indeks)) &&
      (v.type !== "kontor" || (aktivtValg.type === "kontor" && v.oppmotestedId === aktivtValg.oppmotestedId));
    return (
      <button
        key={key}
        type="button"
        onClick={() => setValg(v)}
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

        {kontorOppsett && kontorOppsett.andre.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">{t("timer.reiseKort.annetKontor")}</p>
            <div className="flex flex-wrap gap-2">
              {kontorOppsett.andre.map((id) =>
                valgKnapp(
                  { type: "kontor", oppmotestedId: id },
                  t("timer.reiseKort.tilKontor", { navn: reise.kontorNavn(id) }),
                  `kontor-${id}`,
                ),
              )}
            </div>
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

        {!erOverforing && !erKontor && (
          <RadByggeplassFelt kandidater={bp.kandidater} verdi={bp.byggeplassId} onEndre={bp.setByggeplassId} />
        )}

        {/* Resultatlinjen: tid og kjøretid, deretter hvorfor arbeid/reise. */}
        {regelStatus === "klar" && resultat.fraTid && resultat.tilTid && resultat.kjoretidMin != null && (
          <div>
            <p className="text-sm font-medium text-gray-900">
              {t("timer.reiseKort.resultat", {
                fraTid: resultat.fraTid,
                tilTid: resultat.tilTid,
                min: resultat.kjoretidMin,
              })}
            </p>
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
        {!sperre && kontorKonflikt && (
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
