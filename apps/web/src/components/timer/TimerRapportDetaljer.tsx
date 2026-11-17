"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  byggDetaljRader,
  grupperDetaljRader,
  flatDetaljRader,
  losTimerKolonner,
  type DetaljRad,
  type DetaljRadType,
  type DetaljSubtotal,
  type Gruppering,
  type TimerKolKey,
  type TimerTabellKolKey,
  TIMER_TABELL_KOL,
} from "@sitedoc/shared";
import {
  type DetaljEksport,
  typeEtikett,
  betegnelse,
  lonnsartTypeEtikett,
  satsEnhetEtikett,
  formaterNorsk,
  byggStatusEtiketter,
} from "@/lib/timer-rapport-eksport";
import { TimerRadTabell, type TimerRadTabellRad } from "@/components/timer/TimerRadTabell";
import { useTabelloppsett } from "@/hooks/useTabelloppsett";

/**
 * Detaljvisning på timer-rapporten — SKJERMENS speiling av det Excel/PDF skriver ut.
 * Tredje konsument av de delte `byggDetaljRader`/`grupperDetaljRader` fra
 * `@sitedoc/shared` (Excel og PDF er de to andre) → «én sannhet»: radene på skjermen
 * ER radene i dokumentet. Kolonnerekkefølge og mottaker-regel (ekstern skjuler
 * Ansattnr + Status, demper maskin-anomalimerker, beholder ↳-innrykk) speiler PDF/Excel
 * via de delte celle-hjelperne (`typeEtikett`/`betegnelse`), ikke en egen skjerm-kopi.
 *
 * Tabellen er den delte `TimerRadTabell` (spec prosjektkort-kortid R1/R19): samme
 * komponent og kolonneliste som attesteringen. Bredden dras i hodet og lagres pr. bruker
 * (liste `timer-rapport-detaljer`); flytting i hodet skriver malens kolonnevalg, samme
 * som «Velg parameter». Ingen sortering eller kolonnefilter her — «Eksporter» skriver ut
 * det skjermen viser, og eksporten kjenner ingen av delene (R19).
 *
 * Radsettet virtualiseres (`@tanstack/react-virtual`) — et stort firma over
 * inneværende måned er tusenvis av rader, og et egendefinert år-spenn titusener.
 * Ingen terskel, ingen stille avkorting: hele radsettet er i DOM-modellen, kun de
 * synlige radene rendres. Radtellingen over tabellen er alltid det fulle antallet.
 */

type Mottaker = "intern" | "ekstern";

const TOM_KILDE: DetaljEksport = {
  timerader: [],
  maskinUtenTimerad: [],
  maskinIkkeEksporterbar: [],
  tillegg: [],
  utlegg: [],
};

type KolKey = TimerKolKey;
const TOM_SETT = new Set<string>();

/** Hvilket subtotal-felt kolonnen summerer (om noen). Overskrift, justering og bredde
 *  leses fra den delte kolonnelista `TIMER_TABELL_KOL` i `TimerRadTabell` (R16). */
const SUB_FELT: Partial<Record<KolKey, keyof DetaljSubtotal>> = {
  timer: "timer",
  maskintimer: "maskintimer",
  antall: "antall",
  belop: "belop",
};

interface Props {
  detalj: DetaljEksport | undefined;
  isLoading: boolean;
  valgteRadTyper: DetaljRadType[];
  mottaker: Mottaker;
  gruppering: Gruppering;
  /** Malens `config.kolonner` — valgt kolonnesett + rekkefølge. Tom → standardsett. */
  valgteKolonner?: string[];
  /** Flytting i hodet: ny kolonnerekkefølge — samme kolonnevalg som «Velg parameter» (R19). */
  onKolonneRekkefolge?: (ny: TimerKolKey[]) => void;
}

export function TimerRapportDetaljer({
  detalj,
  isLoading,
  valgteRadTyper,
  mottaker,
  gruppering,
  valgteKolonner,
  onKolonneRekkefolge,
}: Props) {
  const { t } = useTranslation();
  // Bare bredden lagres her (pr. bruker). Kolonnevalget er malens (`valgteKolonner`).
  const oppsett = useTabelloppsett({ liste: "timer-rapport-detaljer", standardKolonner: TOM_SETT, kanoniskRekkefolge: [] });

  const ekstern = mottaker === "ekstern";
  const statusMap = useMemo(() => byggStatusEtiketter(t), [t]);

  // Bygg radsettet med SAMME delte funksjoner som eksporten, og flat grupperingen
  // til én indeksert liste virtualiseringen kan iterere over.
  const { rader, flate, aktiveKoler } = useMemo(() => {
    const byggeteRader = byggDetaljRader(detalj ?? TOM_KILDE, valgteRadTyper);
    const grupper = grupperDetaljRader(byggeteRader, gruppering);
    const flatListe = flatDetaljRader(grupper);

    // ÉN sannhet med PDF/Excel: malens kolonnevalg styrer settet + rekkefølgen
    // (ordrett, ingen drop-tom); mangler det, dagens dynamiske sett (alltid-kolonner
    // + kolonner med innhold). Ekstern-regelen (Ansattnr/Status) vinner strukturelt.
    const koler = losTimerKolonner(byggeteRader, mottaker, valgteKolonner);

    return { rader: byggeteRader, flate: flatListe, aktiveKoler: koler };
  }, [detalj, valgteRadTyper, gruppering, mottaker, valgteKolonner]);

  function celle(k: KolKey, r: DetaljRad): string {
    switch (k) {
      case "dato":
        return r.dato;
      case "ansatt":
        return r.ansatt;
      case "ansattnr":
        return r.ansattnr ?? "";
      case "prosjekt":
        return r.prosjekt;
      case "byggeplass":
        return r.byggeplass ?? "";
      case "underprosjekt":
        return r.underprosjekt ?? "";
      case "type":
        return typeEtikett(t, r.type);
      case "betegnelse":
        return betegnelse(t, r, ekstern);
      case "aktivitet":
        return r.aktivitet ?? "";
      case "fraTid":
        return r.fraTid ?? "";
      case "tilTid":
        return r.tilTid ?? "";
      case "timer":
        return r.timer !== null ? formaterNorsk(r.timer) : "";
      case "maskintimer":
        return r.maskintimer !== null ? formaterNorsk(r.maskintimer) : "";
      case "antall":
        return r.antall !== null ? String(r.antall) : "";
      case "belop":
        return r.belop !== null ? formaterNorsk(r.belop) : "";
      case "mengde":
        return r.mengde !== null ? formaterNorsk(r.mengde) : "";
      case "enhet":
        return r.enhet ?? "";
      case "lonnsartType":
        return lonnsartTypeEtikett(t, r.lonnsartType);
      case "satsEnhet":
        return satsEnhetEtikett(t, r.satsEnhet);
      case "reise":
        return r.erReise === true
          ? t("timer.eksport.reiseJa")
          : r.erReise === false
            ? t("timer.eksport.reiseNei")
            : "";
      case "retning":
        return r.reiseRetning ? t(`timer.reise.retning.${r.reiseRetning}`) : "";
      case "fraSted":
        return r.fraSted ?? "";
      case "tilSted":
        return r.tilSted ?? "";
      case "avstandKm":
        return r.reiseAvstandM != null ? formaterNorsk(r.reiseAvstandM / 1000) : "";
      case "kjoretidMin":
        return r.reiseKjoretidMin != null ? String(r.reiseKjoretidMin) : "";
      case "reiseKilde":
        return r.reiseKilde ? t(`timer.reise.kilde.${r.reiseKilde}`) : "";
      case "tidKilde":
        return r.tidKilde ? t(`timer.reise.tidKilde.${r.tidKilde}`) : "";
      case "normStatus":
        return r.normStatus ? t(`timer.reise.norm.${r.normStatus}`) : "";
      case "beskrivelse":
        return r.beskrivelse ?? "";
      case "status":
        return statusMap[r.status] ?? r.status;
    }
  }

  function subtotalCelle(k: KolKey, sub: DetaljSubtotal): string {
    const felt = SUB_FELT[k];
    if (!felt) return "";
    const verdi = sub[felt];
    if (verdi === null) return "";
    return felt === "antall" ? String(verdi) : formaterNorsk(verdi);
  }

  // Første tekst-kolonne subtotalen kan henge etiketten sin på (etter dato/ansatt).
  const etikettKol: KolKey = aktiveKoler.includes("betegnelse") ? "betegnelse" : "ansatt";

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        {t("firma.timer.rapport.detaljer.laster")}
      </div>
    );
  }

  if (rader.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        {t("firma.timer.rapport.detaljer.ingenRader")}
      </div>
    );
  }

  const tabellRader: TimerRadTabellRad<DetaljRad>[] = flate.map((rad, i) => {
    if (rad.kind === "header") return { kind: "overskrift", nokkel: `h${i}`, innhold: rad.overskrift };
    if (rad.kind === "rad") return { kind: "linje", nokkel: `r${i}`, data: rad.rad, underlinjer: 1 };
    const erGrand = rad.kind === "grandtotal";
    return {
      kind: "sum",
      nokkel: `s${i}`,
      sterk: erGrand,
      celle: (k: TimerTabellKolKey) =>
        k === etikettKol
          ? erGrand
            ? t("firma.timer.rapport.detaljer.grandTotal")
            : t("firma.timer.rapport.detaljer.subtotal", { navn: rad.kind === "subtotal" ? rad.nokkel : "" })
          : subtotalCelle(k as KolKey, rad.subtotal),
    };
  });

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-gray-500">
        {t("firma.timer.rapport.detaljer.radtelling", { count: rader.length })}
      </div>
      <TimerRadTabell
        kolonner={aktiveKoler}
        rader={tabellRader}
        celle={(k, r) => celle(k as KolKey, r)}
        celleTittel={(k, r) => (TIMER_TABELL_KOL[k].num ? undefined : celle(k as KolKey, r))}
        innrykk={(k, r) => k === "betegnelse" && r.nivaa === 1}
        bredder={oppsett.kolonneBredder}
        onBreddeEndring={oppsett.handleBreddeEndring}
        onRekkefolgeEndring={onKolonneRekkefolge ? (ny) => onKolonneRekkefolge(ny as KolKey[]) : undefined}
      />
    </div>
  );
}
