"use client";

import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  byggDetaljRader,
  grupperDetaljRader,
  flatDetaljRader,
  losTimerKolonner,
  TIMER_KOL_BREDDE,
  type DetaljRad,
  type DetaljRadType,
  type DetaljSubtotal,
  type Gruppering,
  type TimerKolKey,
} from "@sitedoc/shared";
import {
  type DetaljEksport,
  typeEtikett,
  betegnelse,
  kolTekst,
  formaterNorsk,
  byggStatusEtiketter,
} from "@/lib/timer-rapport-eksport";

/**
 * Detaljvisning på timer-rapporten — SKJERMENS speiling av det Excel/PDF skriver ut.
 * Tredje konsument av de delte `byggDetaljRader`/`grupperDetaljRader` fra
 * `@sitedoc/shared` (Excel og PDF er de to andre) → «én sannhet»: radene på skjermen
 * ER radene i dokumentet. Kolonnerekkefølge og mottaker-regel (ekstern skjuler
 * Ansattnr + Status, demper maskin-anomalimerker, beholder ↳-innrykk) speiler PDF/Excel
 * via de delte celle-hjelperne (`typeEtikett`/`betegnelse`), ikke en egen skjerm-kopi.
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

/** i18n-nøkkel (delt med Excel via `kolTekst`), høyrejustering (tall), og hvilket
 *  subtotal-felt kolonnen summerer (om noen). Kolonnebredden bor IKKE her — den
 *  leses fra den delte `TIMER_KOL_BREDDE` (@sitedoc/shared), samme kilde som PDF og
 *  Excel arver, så flatene ikke driver fra hverandre (flateparitet 2026-09-01). */
const KOL_META: Record<KolKey, { i18n: string; num?: boolean; sub?: keyof DetaljSubtotal }> = {
  dato: { i18n: "kolDato" },
  ansatt: { i18n: "kolAnsatt" },
  ansattnr: { i18n: "kolAnsattnr" },
  prosjekt: { i18n: "kolProsjekt" },
  type: { i18n: "kolType" },
  betegnelse: { i18n: "kolBetegnelse" },
  aktivitet: { i18n: "kolAktivitet" },
  fraTid: { i18n: "kolFra" },
  tilTid: { i18n: "kolTil" },
  timer: { i18n: "kolTimer", num: true, sub: "timer" },
  maskintimer: { i18n: "kolMaskintimer", num: true, sub: "maskintimer" },
  antall: { i18n: "kolAntall", num: true, sub: "antall" },
  belop: { i18n: "kolBelop", num: true, sub: "belop" },
  mengde: { i18n: "kolMengde", num: true },
  enhet: { i18n: "kolEnhet" },
  beskrivelse: { i18n: "kolBeskrivelse" },
  status: { i18n: "kolStatus" },
};

interface Props {
  detalj: DetaljEksport | undefined;
  isLoading: boolean;
  valgteRadTyper: DetaljRadType[];
  mottaker: Mottaker;
  gruppering: Gruppering;
  /** Malens `config.kolonner` — valgt kolonnesett + rekkefølge. Tom → standardsett. */
  valgteKolonner?: string[];
}

export function TimerRapportDetaljer({
  detalj,
  isLoading,
  valgteRadTyper,
  mottaker,
  gruppering,
  valgteKolonner,
}: Props) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const ekstern = mottaker === "ekstern";
  const statusMap = useMemo(() => byggStatusEtiketter(t), [t]);
  const kol = useMemo(() => kolTekst(t), [t]);

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

  // Bredden følger innholdstypen (delt `TIMER_KOL_BREDDE`): faste kolonner (vekt 0 —
  // dato/klokkeslett/koder/tall) står på sin min-bredde; fritekst-kolonner
  // (Beskrivelse/Betegnelse/Aktivitet/navn) deler ledig plass etter vekt via
  // `minmax(min, vekt·fr)`. Grid-en fyller containeren når det er rom, og scroller
  // horisontalt først når den kommer under summen av min-breddene. `truncate` er da
  // et sikkerhetsnett, ikke normaltilstand (Kenneth 2026-09-01).
  const gridTemplate = aktiveKoler
    .map((k) => {
      const b = TIMER_KOL_BREDDE[k];
      return b.vekt === 0 ? `${b.min}px` : `minmax(${b.min}px, ${b.vekt}fr)`;
    })
    .join(" ");
  const totalBredde = aktiveKoler.reduce((s, k) => s + TIMER_KOL_BREDDE[k].min, 0);

  const virtualizer = useVirtualizer({
    count: flate.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 12,
  });

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
      case "beskrivelse":
        return r.beskrivelse ?? "";
      case "status":
        return statusMap[r.status] ?? r.status;
    }
  }

  function subtotalCelle(k: KolKey, sub: DetaljSubtotal): string {
    const felt = KOL_META[k].sub;
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

  const virtuelle = virtualizer.getVirtualItems();

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-gray-500">
        {t("firma.timer.rapport.detaljer.radtelling", { count: rader.length })}
      </div>
      <div
        ref={parentRef}
        className="max-h-[70vh] overflow-auto rounded-lg border border-gray-200 bg-white"
      >
        {/* Kolonneoverskrift — sticky topp, følger horisontal scroll */}
        <div
          className="sticky top-0 z-10 grid border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"
          style={{ gridTemplateColumns: gridTemplate, minWidth: totalBredde }}
        >
          {aktiveKoler.map((k) => (
            <div
              key={k}
              className={`px-2 py-2 ${KOL_META[k].num ? "text-right" : "text-left"}`}
            >
              {kol(KOL_META[k].i18n)}
            </div>
          ))}
        </div>

        {/* Virtualisert kropp */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            minWidth: totalBredde,
            position: "relative",
          }}
        >
          {virtuelle.map((vi) => {
            const rad = flate[vi.index];
            if (!rad) return null;
            const felles = {
              "data-index": vi.index,
              ref: virtualizer.measureElement,
              style: {
                position: "absolute" as const,
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              },
            };

            if (rad.kind === "header") {
              return (
                <div
                  key={vi.key}
                  {...felles}
                  className="flex items-center border-b border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  {rad.overskrift}
                </div>
              );
            }

            if (rad.kind === "rad") {
              const r = rad.rad;
              return (
                <div
                  key={vi.key}
                  {...felles}
                  className="grid border-b border-gray-100 text-sm text-gray-800"
                  style={{ ...felles.style, gridTemplateColumns: gridTemplate }}
                >
                  {aktiveKoler.map((k) => {
                    const nøsting = k === "betegnelse" && r.nivaa === 1;
                    return (
                      <div
                        key={k}
                        className={`min-w-0 px-2 py-1.5 ${KOL_META[k].num ? "text-right tabular-nums" : "text-left"} ${
                          k === "beskrivelse" ? "whitespace-pre-wrap break-words" : "truncate"
                        } ${nøsting ? "pl-5 text-gray-500" : ""}`}
                        title={KOL_META[k].num ? undefined : celle(k, r)}
                      >
                        {celle(k, r)}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // subtotal / grandtotal — samme grid, tall justert under sine kolonner
            const erGrand = rad.kind === "grandtotal";
            return (
              <div
                key={vi.key}
                {...felles}
                className={`grid text-sm ${
                  erGrand
                    ? "border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900"
                    : "border-t border-gray-200 bg-gray-50/60 font-medium text-gray-700"
                }`}
                style={{ ...felles.style, gridTemplateColumns: gridTemplate }}
              >
                {aktiveKoler.map((k) => {
                  if (k === etikettKol) {
                    return (
                      <div key={k} className="truncate px-2 py-1.5 text-left">
                        {erGrand
                          ? t("firma.timer.rapport.detaljer.grandTotal")
                          : t("firma.timer.rapport.detaljer.subtotal", {
                              navn: rad.kind === "subtotal" ? rad.nokkel : "",
                            })}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={k}
                      className={`px-2 py-1.5 ${KOL_META[k].num ? "text-right tabular-nums" : ""}`}
                    >
                      {subtotalCelle(k, rad.subtotal)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
