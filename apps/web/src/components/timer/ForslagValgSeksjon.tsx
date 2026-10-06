"use client";

// V19-C (C-1) — arbeiderens valg mellom PC-dagskortet og mobilens forslag.
// Speiler mobilens DagskortSammenligning, men bruker den DELTE paringen
// (`parForslagMotSedel`) og input-byggeren (`byggForsonInputFraValg`) fra @sitedoc/shared,
// så web og mobil ALDRI kan velge ulik motpart eller bygge ulik forsoning.
// Kun sedelens eier ser denne (montert fra DagsseddelDetaljSide bak eier-queryen).
//
// Q3(b) (spec § 5): et tidsrom som bare finnes på ÉN side er IKKE et valg — det
// står (forslag-only opprettes ved bekreft, sedel-only beholdes). Bare parede
// tidsrom (begge sider) får radio.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@sitedoc/ui";
import { Check, Smartphone, Monitor } from "lucide-react";
import {
  parForslagMotSedel,
  byggForsonInputFraValg,
  type ForsonRad,
  type ForsonSide,
  type ForsonInput,
  type ForsonGrunn,
} from "@sitedoc/shared";

function tidsrom(r: ForsonRad): string {
  if (!r.fraTid || !r.tilTid) return "—";
  return `${r.fraTid}–${r.tilTid}`;
}

/** Én side (PC eller mobil) i et tidsrom. Trykkbar kun når den er et reelt valg. */
function RadSide({
  etikett,
  ikon,
  rad,
  valgt,
  valgbar,
  slettet = false,
  onVelg,
}: {
  etikett: string;
  ikon: React.ReactNode;
  rad: ForsonRad | null;
  valgt: boolean;
  valgbar: boolean;
  /**
   * V19.9 (C'-1/C'-2): denne siden REPRESENTERER en sletting (PC eller telefon
   * slettet raden). Viser «Slettet» i stedet for rad/«ingen registrering», og er et
   * reelt valgbart alternativ (behold slettet / slett) selv når `rad` er null.
   */
  slettet?: boolean;
  onVelg?: () => void;
}) {
  const { t } = useTranslation();
  const innhold = (
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
          {ikon}
          {etikett}
        </span>
        {valgbar && valgt && <Check className="h-4 w-4 text-sitedoc-primary" />}
      </div>
      {slettet ? (
        <p className="text-sm font-semibold italic text-red-700">
          {t("timer.sammenlign.slettet")}
        </p>
      ) : rad ? (
        <>
          <p className="text-sm font-semibold text-gray-900">
            {tidsrom(rad)} · {t("timer.sammenlign.timer", { timer: rad.timer })}
          </p>
          {rad.beskrivelse ? (
            <p className="line-clamp-2 text-xs text-gray-600">{rad.beskrivelse}</p>
          ) : null}
        </>
      ) : (
        <p className="text-sm italic text-gray-400">
          {t("timer.sammenlign.ingenRegistrering")}
        </p>
      )}
    </div>
  );

  const ramme =
    valgt && valgbar
      ? "border-sitedoc-primary bg-blue-50"
      : "border-gray-200 bg-white";
  // Kun valgbare sider med innhold (rad ELLER slettet-valg) er trykkbare — ingen
  // illusjon av valg på en tom side eller et ensidig tidsrom.
  return valgbar && (rad || slettet) && onVelg ? (
    <button
      type="button"
      onClick={onVelg}
      role="radio"
      aria-checked={valgt}
      className={`flex-1 rounded-lg border p-2.5 text-left ${ramme}`}
    >
      {innhold}
    </button>
  ) : (
    <div className={`flex-1 rounded-lg border p-2.5 ${ramme}`}>{innhold}</div>
  );
}

export function ForslagValgSeksjon({
  sedelRader,
  forslag,
  modus = "velg",
  venterSiden = null,
  bekrefter = false,
  onBekreft,
}: {
  /** Serverens nåværende timer-rader (PC/web), mappet til ForsonRad. */
  sedelRader: readonly ForsonRad[];
  /** Mobilens forslagsrader (SheetTimerForslag), mappet til ForsonRad. */
  forslag: readonly ForsonRad[];
  /**
   * «velg» = arbeiderens flate (C-1): radio + hele-dagen-knapper + Bekreft.
   * «lesevisning» = attestantens flate (C-2): bare lesbar side-om-side, ingen
   * radio, ingen knapper. Serveren blokkerer attestering uansett (A-4).
   */
  modus?: "velg" | "lesevisning";
  /** Lesevisning: tidspunktet konflikten oppstod (konfliktVentendeSiden) → «siden dd.mm». */
  venterSiden?: Date | string | null;
  /** forsonDagskort-mutasjonen pågår — deaktiver knappene (kun «velg»). */
  bekrefter?: boolean;
  /** Anvend valget: bygg input via byggForsonInputFraValg og kall forsonDagskort (kun «velg»). */
  onBekreft?: (input: ForsonInput) => void;
}) {
  const { t } = useTranslation();
  const lesevisning = modus === "lesevisning";

  // Delt paring (samme kilde som byggForsonInputFraValg + mobilens sammenligning).
  const slots = useMemo(
    () => parForslagMotSedel(sedelRader, forslag),
    [sedelRader, forslag],
  );

  // Valg pr. forslagsrad-id. Default «sedel» (behold PC) — konservativt, ingen
  // lønnsdata overskrives uten eksplisitt valg (samme default som helperen).
  const [valg, setValg] = useState<Record<string, ForsonSide>>({});

  const parede = slots.filter((s) => s.valgbar && s.forslag && s.sedel);

  const settAlle = (side: ForsonSide) => {
    const nytt: Record<string, ForsonSide> = {};
    for (const s of parede) nytt[s.forslag!.id] = side;
    setValg(nytt);
  };

  const bekreft = () => {
    onBekreft?.(byggForsonInputFraValg(sedelRader, forslag, valg));
  };

  const venterTekst = venterSiden
    ? t("timer.forslagValg.venterSiden", {
        dato: new Date(venterSiden).toLocaleDateString("no-NB", {
          day: "2-digit",
          month: "2-digit",
        }),
      })
    : t("timer.forslagValg.venter");

  return (
    <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-amber-900">
        {lesevisning ? venterTekst : t("timer.forslagValg.tittel")}
      </h2>
      <p className="mb-4 text-sm text-amber-900">
        {lesevisning
          ? t("timer.forslagValg.lesevisningHjelp")
          : t("timer.forslagValg.innledning")}
      </p>

      <div className="space-y-2">
        {slots.map((slot) => {
          const f = slot.forslag;
          const paret = slot.valgbar;
          // Attestanten (lesevisning) velger aldri — ingen slot er valgbar der.
          const valgbar = !lesevisning && paret;
          // Default: parede uten eksplisitt valg vises som «behold PC» (sedel).
          const sideValgt: ForsonSide = f ? (valg[f.id] ?? "sedel") : "sedel";
          // V19.9 (C'-1/C'-2): slot-typene. «slettet_telefon» → mobil-siden viser
          // «Slettet»; «slettet_pc» → PC-siden viser «Slettet». «endret_begge» →
          // vanlig radio + forklaring. Ren overlapp/uten grunn = uendret.
          const grunn = slot.grunn as ForsonGrunn | null | undefined;
          const mobilSlettet = grunn === "slettet_telefon";
          const pcSlettet = grunn === "slettet_pc";
          const grunnTekst =
            grunn === "endret_begge"
              ? t("timer.sammenlign.grunnEndretBegge")
              : grunn === "slettet_telefon"
                ? t("timer.sammenlign.grunnSlettetTelefon")
                : grunn === "slettet_pc"
                  ? t("timer.sammenlign.grunnSlettetPc")
                  : null;
          return (
            <div key={slot.nokkel} className="rounded-lg border border-amber-200 bg-white/60 p-2">
              {grunnTekst ? (
                <p className="mb-1 px-1 text-xs font-medium text-amber-800">
                  {grunnTekst}
                </p>
              ) : null}
              <div className="flex gap-2" role={valgbar ? "radiogroup" : undefined}>
                <RadSide
                  etikett={t("timer.forslagValg.kolonnePc")}
                  ikon={<Monitor className="h-3.5 w-3.5" />}
                  rad={slot.sedel}
                  valgt={valgbar && sideValgt === "sedel"}
                  valgbar={valgbar}
                  slettet={pcSlettet}
                  onVelg={f ? () => setValg((v) => ({ ...v, [f.id]: "sedel" })) : undefined}
                />
                <RadSide
                  etikett={t("timer.forslagValg.kolonneMobil")}
                  ikon={<Smartphone className="h-3.5 w-3.5" />}
                  rad={f}
                  valgt={valgbar && sideValgt === "forslag"}
                  valgbar={valgbar}
                  slettet={mobilSlettet}
                  onVelg={f ? () => setValg((v) => ({ ...v, [f.id]: "forslag" })) : undefined}
                />
              </div>
              {!paret && (
                <p className="mt-1 px-1 text-xs italic text-gray-500">
                  {t("timer.forslagValg.kunEnSide")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!lesevisning && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {parede.length > 0 && (
            <>
              <Button
                variant="secondary"
                disabled={bekrefter}
                onClick={() => settAlle("sedel")}
              >
                {t("timer.forslagValg.beholdPcDagen")}
              </Button>
              <Button
                variant="secondary"
                disabled={bekrefter}
                onClick={() => settAlle("forslag")}
              >
                {t("timer.forslagValg.brukMobilDagen")}
              </Button>
            </>
          )}
          <Button disabled={bekrefter} onClick={bekreft}>
            {bekrefter ? t("handling.lagrer") : t("timer.forslagValg.bekreft")}
          </Button>
        </div>
      )}
    </section>
  );
}
