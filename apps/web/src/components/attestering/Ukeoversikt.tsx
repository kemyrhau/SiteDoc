"use client";

import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formaterNorsk } from "@/lib/timer-rapport-eksport";
import { HoverKort } from "./DagsKort";
import { UkevarselMerker, type UkeoversiktApi } from "./AttesteringTabell";
import type { AttUke } from "./ukelinje";
import { byggUkeoversikt, type AttDag, type UkeRad } from "./attestering-tabell";

/**
 * Ukeoversikten over tabellen (spec prosjektkort-kortid § 12.2 R12, R18; d2b-2).
 * Erstatter pivotene «Per prosjekt» / «Per ansatt»: tallene er summen av tabellens
 * timerlinjer (T45), og klikk på en dag filtrerer tabellen til den dagen. Hover-dagskortet
 * står på cellene med prosjektet i hodet (§ 12.5) og leser samme modell som tabellen (T35).
 */

const UTEN_PROSJEKT = "uten-prosjekt";

function ukedager(ukestart: Date): { iso: string; kortnavn: string; erHelg: boolean }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ukestart);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, kortnavn: d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric" }), erHelg: i >= 5 };
  });
}

interface Props {
  api: UkeoversiktApi;
  ukestart: Date;
  /** «ansatt»: ansatte med prosjektene under. «prosjekt»: prosjekter med de ansatte under. */
  akse: "ansatt" | "prosjekt";
  /**
   * A4: ukas regnestykke pr. ansatt fra serveren — normkolonnen viser samme ukevarsel som
   * ukelinja (B85). Cellene er fortsatt ført tid pr. dag (T45), med reise.
   */
  ukeFor?: (ansattId: string) => AttUke | null;
}

export function Ukeoversikt({ api, ukestart, akse, ukeFor }: Props) {
  const { t } = useTranslation();
  const dager = useMemo(() => ukedager(ukestart), [ukestart]);
  const rader = useMemo(() => byggUkeoversikt(api.dager, akse), [api.dager, akse]);
  const [apne, setApne] = useState<Set<string>>(new Set());
  const visNorm = akse === "ansatt" && !!ukeFor;

  if (rader.length === 0) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{t("timer.attestering.pivot.ingenData")}</div>;
  }

  const sumPrDag = (iso: string) => rader.reduce((s, r) => s + (r.perDag[iso] ?? 0), 0);

  function celle(r: UkeRad, iso: string, prosjektId: string | null | undefined) {
    const timer = r.perDag[iso] ?? 0;
    if (timer === 0) return <span className="text-gray-300">–</span>;
    const knapp = (
      <button type="button" onClick={() => api.velgDato(iso)} className="tabular-nums hover:text-blue-700 hover:underline" title={t("timer.attestering.uke.filtrerDag")}>
        {formaterNorsk(timer)}
      </button>
    );
    return <HoverKort kort={<DagKort dager={r.dagerPrDato[iso] ?? []} prosjektId={prosjektId} />}>{knapp}</HoverKort>;
  }

  // Prosjektraden viser bare prosjektets kort i hover-kortet; ansattraden hele dagen.
  const prosjektAv = (r: UkeRad): string | null | undefined =>
    r.ansattId !== null ? undefined : r.nokkel === UTEN_PROSJEKT ? null : r.nokkel;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t(akse === "ansatt" ? "timer.attestering.pivot.ansatt" : "timer.attestering.pivot.prosjekt")}</th>
            {dager.map((d) => (
              <th key={d.iso} className={`px-2 py-2 text-right font-medium ${d.erHelg ? "text-gray-400" : ""}`}>
                <button
                  type="button"
                  onClick={() => api.velgDato(d.iso)}
                  aria-pressed={api.valgtDato === d.iso}
                  className={`rounded px-1 ${api.valgtDato === d.iso ? "bg-blue-100 text-blue-800" : "hover:text-blue-700"}`}
                >
                  {d.kortnavn}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">{t("timer.attestering.pivot.sum")}</th>
            {visNorm && <th className="px-3 py-2 text-left font-medium">{t("timer.attestering.pivot.norm")}</th>}
          </tr>
        </thead>
        <tbody>
          {rader.map((r) => {
            const apen = apne.has(r.nokkel);
            const uke = visNorm && r.ansattId ? ukeFor!(r.ansattId) : null;
            return (
              <Fragment key={r.nokkel}>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => setApne((s) => { const ny = new Set(s); if (apen) ny.delete(r.nokkel); else ny.add(r.nokkel); return ny; })}
                      aria-expanded={apen}
                      className="inline-flex items-center gap-1 text-left font-medium text-gray-900"
                    >
                      {apen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {r.navn}
                    </button>
                  </td>
                  {dager.map((d) => <td key={d.iso} className="px-2 py-1.5 text-right">{celle(r, d.iso, prosjektAv(r))}</td>)}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formaterNorsk(r.sum)}</td>
                  {visNorm && <td className="px-3 py-1.5">{uke && <UkevarselMerker uke={uke} />}</td>}
                </tr>
                {apen &&
                  r.under.map((u) => (
                    <tr key={`${r.nokkel}:${u.nokkel}`} className="bg-gray-50/60 text-gray-700">
                      <td className="py-1 pl-9 pr-3 text-xs">{u.navn}</td>
                      {dager.map((d) => (
                        <td key={d.iso} className="px-2 py-1 text-right text-xs">
                          {/* Underraden er motsatt akse: prosjektet står enten på raden eller på overraden. */}
                          {celle(u, d.iso, akse === "ansatt" ? prosjektAv(u) : prosjektAv(r))}
                        </td>
                      ))}
                      <td className="px-3 py-1 text-right text-xs tabular-nums">{formaterNorsk(u.sum)}</td>
                      {visNorm && <td />}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
          <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-1.5">{t("timer.attestering.pivot.sum")}</td>
            {dager.map((d) => {
              const s = sumPrDag(d.iso);
              return <td key={d.iso} className="px-2 py-1.5 text-right tabular-nums">{s > 0 ? formaterNorsk(s) : ""}</td>;
            })}
            <td className="px-3 py-1.5 text-right tabular-nums">{formaterNorsk(rader.reduce((s, r) => s + r.sum, 0))}</td>
            {visNorm && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Hover-dagskortet (§ 12.5, B1): én dag, kort for kort med prosjektet i hodet, og
 * linjene fra tabellens modell (`grupperPaaKort` via `byggAttesteringModell`, T35) —
 * ingen egen gruppering. `prosjektId` (satt) begrenser til det prosjektets kort.
 */
export function DagKort({ dager, prosjektId }: { dager: AttDag[]; prosjektId?: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="w-80 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
      {dager.map((d) => {
        const kort = prosjektId === undefined ? d.kort : d.kort.filter((k) => k.projectId === prosjektId);
        return (
          <div key={d.sedel.id} className="mb-2 last:mb-0">
            <div className="mb-1 font-semibold text-gray-900">{d.ansatt} · {d.dato}</div>
            {kort.map((k) => (
              <div key={k.nokkel} className="mb-1.5 rounded border border-gray-100 p-1.5 last:mb-0">
                <div className="mb-0.5 font-medium text-gray-800">
                  {[k.prosjektnummer, k.prosjekt].filter(Boolean).join(" ")}
                  {k.underprosjekt && <span className="font-normal text-gray-500"> · {k.underprosjekt}</span>}
                </div>
                {k.linjer.map((l) => (
                  <div key={l.nokkel} className="text-gray-700">
                    <div className="flex justify-between gap-2">
                      <span className="truncate">
                        {l.linje.betegnelse || t(`timer.attestering.tabell.type.${l.linje.type}`)}
                        {l.linje.aktivitet && <span className="text-gray-500"> · {l.linje.aktivitet}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {l.linje.timer != null ? formaterNorsk(l.linje.timer) :
                          l.linje.belop != null ? t("timer.attestering.dagskort.kr", { belop: formaterNorsk(l.linje.belop) }) :
                          l.linje.antall != null ? formaterNorsk(l.linje.antall) : ""}
                      </span>
                    </div>
                    {l.linje.maskiner.map((m, i) => (
                      <div key={i} className="pl-3 text-gray-500">{[m.navn, m.timer != null ? formaterNorsk(m.timer) : null].filter(Boolean).join(" · ")}</div>
                    ))}
                    {l.linje.varer.map((v, i) => (
                      <div key={i} className="pl-3 text-gray-500">{[v.navn, v.mengde != null ? formaterNorsk(v.mengde) : null, v.enhet].filter(Boolean).join(" ")}</div>
                    ))}
                    {l.linje.beskrivelse && <div className="whitespace-normal pl-3 italic text-gray-500">{l.linje.beskrivelse}</div>}
                    {l.linje.avvik.length > 0 && <div className="whitespace-normal pl-3 text-amber-700">{l.linje.avvik.join(" · ")}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
