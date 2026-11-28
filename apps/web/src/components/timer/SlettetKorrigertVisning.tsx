"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Spinner } from "@sitedoc/ui";
import { formaterNorsk } from "@/lib/timer-rapport-eksport";
import { korrigertFeltDeler, korrigertTekst, korrigertTid, type KorrigertFelt } from "./KorrigertMerke";
import { SokbarNedtrekk } from "@/components/timer/SokbarNedtrekk";

/**
 * SL2 (plan web-timeføring § 4.18 del B; vedtak-timer-web § Slettet og korrigert punkt 1–3): siden
 * «Slettet og korrigert», bare lesing og utenfor attesteringskortet. Én komponent for attestanten
 * (Attestering) og arbeideren (Mine timer); sidene gir perioden og om ansatt-filteret vises.
 *
 * Kilden er `slettetOgKorrigert` — serveren har alt avgjort omfang, navneskjul og hva som er med.
 */

export type SkLinjetype = "timer" | "reise" | "maskin" | "tillegg" | "vare" | "utlegg";

export type SkHendelse = {
  id: string;
  type: "slettet" | "korrigert";
  linjetype: SkLinjetype;
  fraTid: string | null;
  tilTid: string | null;
  timer: number | null;
  navn: string | null;
  aktivitet: string | null;
  antall: number | null;
  enhet: string | null;
  belop: number | null;
  kommentar: string | null;
  felter: KorrigertFelt[];
  projectId: string | null;
  prosjekt: string | null;
  byggeplass: string | null;
  underprosjekt: string | null;
  avNavn: string | null;
  avEier: boolean;
  ved: Date | string;
  dagenVarReturnert: boolean;
};

export type SkDag = {
  sedelId: string;
  dato: string;
  status: string;
  ansatt: { id: string; navn: string | null };
  hendelser: SkHendelse[];
  antallSlettet: number;
};

type TypeFilter = "alle" | "slettet" | "korrigert";
type T = (k: string, o?: Record<string, unknown>) => string;

/** «tir. 17.11.» */
export function skDagDato(iso: string, sprak: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const to = (n: number) => String(n).padStart(2, "0");
  return `${d.toLocaleDateString(sprak, { weekday: "short" })} ${to(d.getDate())}.${to(d.getMonth() + 1)}.`;
}

/** Linjas innhold på én linje: «07:00–15:00 · Timelønn · 7,50 t», «Parkering · 80,00 kr» … */
export function skInnhold(t: T, h: SkHendelse): string {
  const deler: string[] = [];
  if (h.fraTid && h.tilTid) deler.push(`${h.fraTid}–${h.tilTid}`);
  if (h.navn) deler.push(h.navn);
  if (h.timer !== null) deler.push(t("timer.slettetKorrigert.timerTall", { timer: formaterNorsk(h.timer) }));
  if (h.antall !== null) deler.push(h.enhet ? `${String(h.antall).replace(".", ",")} ${h.enhet}` : String(h.antall).replace(".", ","));
  if (h.belop !== null) deler.push(t("timer.slettetKorrigert.belopKr", { belop: formaterNorsk(h.belop) }));
  return deler.join(" · ");
}

/** «Slettet av Ola Arbeider 18.11. kl. 07:52 · dagen var returnert» / «Korrigert av …». */
export function skHvemNaar(t: T, h: SkHendelse): string {
  if (h.type === "korrigert") return korrigertTekst(t, { avNavn: h.avNavn, ved: h.ved });
  const tid = korrigertTid(t, h.ved);
  const hvem = h.avNavn ? t("timer.slettetKorrigert.slettetAv", { navn: h.avNavn, tid }) : t("timer.slettetKorrigert.slettetUtenNavn", { tid });
  return h.dagenVarReturnert ? `${hvem} · ${t("timer.slettetKorrigert.dagenVarReturnert")}` : hvem;
}

interface Props {
  dager: readonly SkDag[] | undefined;
  laster: boolean;
  /** Periodevelgeren (uke for attestanten, fra–til for arbeideren). */
  periode: ReactNode;
  /** Attestanten: ansatt-filter og ansattens navn på dagen. Arbeideren: bare egne dager, uten. */
  medAnsatt: boolean;
  /** Dagen siden ble åpnet på (merket «N slettet»). */
  dag: string | null;
  onFjernDag: () => void;
  startAnsatt?: string | null;
}

export function SlettetKorrigertVisning({ dager, laster, periode, medAnsatt, dag, onFjernDag, startAnsatt }: Props) {
  const { t, i18n } = useTranslation();
  const [ansatt, setAnsatt] = useState<string>(startAnsatt ?? "");
  const [prosjekt, setProsjekt] = useState<string>("");
  const [type, setType] = useState<TypeFilter>("alle");

  const alle = useMemo(() => dager ?? [], [dager]);
  const ansatte = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of alle) m.set(d.ansatt.id, d.ansatt.navn ?? "—");
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], "nb"));
  }, [alle]);
  const prosjekter = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of alle) for (const h of d.hendelser) if (h.projectId && h.prosjekt) m.set(h.projectId, h.prosjekt);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], "nb"));
  }, [alle]);

  const synlige = useMemo(
    () =>
      alle
        .filter((d) => (!dag || d.dato === dag) && (!medAnsatt || !ansatt || d.ansatt.id === ansatt))
        .map((d) => ({
          ...d,
          hendelser: d.hendelser.filter((h) => (type === "alle" || h.type === type) && (!prosjekt || h.projectId === prosjekt)),
        }))
        .filter((d) => d.hendelser.length > 0),
    [alle, dag, medAnsatt, ansatt, type, prosjekt],
  );
  const antallSynlige = synlige.reduce((n, d) => n + d.hendelser.length, 0);
  const antallIPerioden = alle.reduce((n, d) => n + d.hendelser.length, 0);

  const velg = "rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 hover:bg-gray-50";

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-slettet-korrigert="">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3">
        {periode}
        {dag && (
          <span className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1 text-sm text-blue-800">
            {skDagDato(dag, i18n.language)}
            <button type="button" onClick={onFjernDag} aria-label={t("timer.slettetKorrigert.filter.fjernDag")} title={t("timer.slettetKorrigert.filter.fjernDag")}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        {medAnsatt && (
          <SokbarNedtrekk value={ansatt} onChange={(e) => setAnsatt(e.target.value)} aria-label={t("timer.slettetKorrigert.filter.ansatt")} className={velg}>
            <option value="">{t("timer.slettetKorrigert.filter.alleAnsatte")}</option>
            {ansatte.map(([id, navn]) => (
              <option key={id} value={id}>
                {navn}
              </option>
            ))}
          </SokbarNedtrekk>
        )}
        <SokbarNedtrekk value={prosjekt} onChange={(e) => setProsjekt(e.target.value)} aria-label={t("timer.slettetKorrigert.filter.prosjekt")} className={velg}>
          <option value="">{t("timer.slettetKorrigert.filter.alleProsjekter")}</option>
          {prosjekter.map(([id, navn]) => (
            <option key={id} value={id}>
              {navn}
            </option>
          ))}
        </SokbarNedtrekk>
        <select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label={t("timer.slettetKorrigert.filter.type")} className={velg}>
          <option value="alle">{t("timer.slettetKorrigert.filter.begge")}</option>
          <option value="slettet">{t("timer.slettetKorrigert.type.slettet")}</option>
          <option value="korrigert">{t("timer.slettetKorrigert.type.korrigert")}</option>
        </select>
        {dag && (
          <button type="button" onClick={onFjernDag} className="ml-auto text-sm text-blue-600 hover:underline">
            {t("timer.slettetKorrigert.visHelePerioden")}
          </button>
        )}
      </div>

      {laster ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : synlige.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">{t("timer.slettetKorrigert.ingen")}</p>
      ) : (
        synlige.map((d) => (
          <section key={d.sedelId} data-sk-dag={d.dato} className="border-b border-gray-100 last:border-b-0">
            <div className="flex items-baseline justify-between gap-4 bg-gray-50 px-4 py-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {skDagDato(d.dato, i18n.language)}
                {medAnsatt && d.ansatt.navn ? ` · ${d.ansatt.navn}` : ""}
              </h2>
              <span className="text-xs text-gray-500">{t(`timer.slettetKorrigert.status.${d.status}`)}</span>
            </div>
            <ul>
              {d.hendelser.map((h) => (
                <HendelseLinje key={h.id} h={h} t={t} />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
        <span>
          {t("timer.slettetKorrigert.antallVist", { antall: antallSynlige })}
          {antallSynlige !== antallIPerioden ? ` · ${t("timer.slettetKorrigert.antallIPerioden", { antall: antallIPerioden })}` : ""}
        </span>
        <span>{t("timer.slettetKorrigert.bareLesing")}</span>
      </div>
    </div>
  );
}

function HendelseLinje({ h, t }: { h: SkHendelse; t: T }) {
  const kort = [h.prosjekt ?? (h.projectId ? null : t("timer.slettetKorrigert.utenProsjekt")), h.byggeplass, h.underprosjekt].filter(Boolean).join(" · ");
  return (
    <li data-sk-hendelse={h.type} className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            h.type === "slettet" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
          }`}
        >
          {t(`timer.slettetKorrigert.type.${h.type}`)}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          {t(`timer.slettetKorrigert.linje.${h.linjetype}`)}
        </span>
        <span className="font-medium">{skInnhold(t, h)}</span>
      </div>
      {h.type === "korrigert" && h.felter.length > 0 && (
        <p className="mt-0.5 text-xs text-gray-700">
          {h.felter.map((f, i) => {
            const d = korrigertFeltDeler(t, f);
            return (
              <span key={f.felt}>
                {i > 0 && " · "}
                {d.etikett} <s className="text-gray-400">{d.foer}</s> → {d.etter}
              </span>
            );
          })}
        </p>
      )}
      {kort && <p className="mt-0.5 text-xs text-gray-600">{kort}</p>}
      {h.kommentar && <p className="mt-0.5 text-xs italic text-gray-500">{h.kommentar}</p>}
      <p className="mt-0.5 text-xs text-gray-500">{skHvemNaar(t, h)}</p>
    </li>
  );
}
