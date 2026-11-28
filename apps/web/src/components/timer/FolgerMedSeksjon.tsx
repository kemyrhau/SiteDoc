"use client";

// Runde 8 timer (Kenneth 2026-11-27/28 «Ja, begge»): «Følger med» i arbeiderens «Del opp» av
// en timerad. Maskin og vare: tall pr. del (forslag forholdsmessig etter timene). Tillegg,
// utlegg og reise: nedtrekk «Hører til» / «Reise hører til». Regelen er
// `delOppTimerad.ts` i @sitedoc/shared — samme som serveren og mobilen.

import { useTranslation } from "react-i18next";
import {
  beregnDelOppFordeling,
  type DelOppDel,
  type DelOppFeil,
  type DelOppFordeling,
  type DelOppKoblet,
} from "@sitedoc/shared";
import { formaterBelop, formaterTimer } from "@/lib/tallformat";

export type FolgerMedData = {
  projectId: string | null;
  maskiner: { id: string; navn: string; timer: number }[];
  varer: { id: string; navn: string; enhet: string; antall: number }[];
  tillegg: { id: string; navn: string; antall: number }[];
  utlegg: { id: string; navn: string; belop: number }[];
  reiser: { id: string; retning: string | null; fraTid: string | null; tilTid: string | null }[];
};

export function harFolgerMed(data: FolgerMedData | undefined): boolean {
  if (!data) return false;
  return data.maskiner.length + data.varer.length + data.tillegg.length + data.utlegg.length + data.reiser.length > 0;
}

function somKoblet(data: FolgerMedData): DelOppKoblet {
  return {
    maskiner: data.maskiner,
    varer: data.varer,
    tillegg: data.tillegg,
    utlegg: data.utlegg,
    reiser: data.reiser.map((r) => ({ id: r.id, retning: r.retning, fraTid: r.fraTid })),
  };
}

/** Fordelingen vinduet viser og sender — regelen er `beregnDelOppFordeling` i @sitedoc/shared. */
export function beregnFolgerMed(
  deler: readonly DelOppDel[],
  data: FolgerMedData,
  valg: Partial<DelOppFordeling>,
): { fordeling: DelOppFordeling; feil: DelOppFeil[] } {
  return beregnDelOppFordeling(deler, somKoblet(data), data.projectId, valg);
}

type Props = {
  deler: readonly DelOppDel[];
  data: FolgerMedData;
  fordeling: DelOppFordeling;
  feil: DelOppFeil[];
  onEndre: (valg: Partial<DelOppFordeling>) => void;
  valg: Partial<DelOppFordeling>;
};

export function FolgerMedSeksjon({ deler, data, fordeling, feil, onEndre, valg }: Props) {
  const { t } = useTranslation();
  const delNavn = (i: number) => {
    const d = deler[i]!;
    const tid = d.fraTid && d.tilTid ? ` (${d.fraTid}–${d.tilTid})` : "";
    return `${t("timer.splitt.del", { nr: i + 1 })}${tid}`;
  };
  const erstatt = <T extends { id: string }>(liste: T[] | undefined, ny: T): T[] => [
    ...(liste ?? []).filter((x) => x.id !== ny.id),
    ny,
  ];
  const settTall = (type: "maskiner" | "varer", id: string, i: number, verdi: number) => {
    if (type === "maskiner") {
      const naa = fordeling.maskiner.find((m) => m.id === id)!.timer.map((x, j) => (j === i ? verdi : x));
      onEndre({ ...valg, maskiner: erstatt(valg.maskiner, { id, timer: naa }) });
    } else {
      const naa = fordeling.varer.find((v) => v.id === id)!.antall.map((x, j) => (j === i ? verdi : x));
      onEndre({ ...valg, varer: erstatt(valg.varer, { id, antall: naa }) });
    }
  };
  const settDel = (type: "tillegg" | "utlegg" | "reiser", id: string, del: number) =>
    onEndre({ ...valg, [type]: erstatt(valg[type], { id, del }) });
  const feilFor = (id: string) => feil.filter((f) => f.id === id);
  const feilTekst = (id: string, skal: number, sum: number[]): string | null => {
    const f = feilFor(id);
    if (f.some((x) => x.type === "maskinAnnetProsjekt" || x.type === "vareAnnetProsjekt")) {
      return t("timer.splitt.folgerMed.annetProsjekt");
    }
    if (f.some((x) => x.type === "maskinSum" || x.type === "vareSum")) {
      const s = sum.reduce((a, b) => a + b, 0);
      return t("timer.splitt.folgerMed.sumFeil", { sum: formaterTimer(s), skal: formaterTimer(skal) });
    }
    return null;
  };

  const tallRad = (type: "maskiner" | "varer", id: string, etikett: string, skal: number, tall: number[]) => {
    const tekst = feilTekst(id, skal, tall);
    return (
      <li key={id} className="space-y-1">
        <p className="text-sm text-gray-800">{etikett}</p>
        <div className="flex flex-wrap gap-2">
          {deler.map((_, i) => (
            <label key={i} className="flex items-center gap-1 text-xs text-gray-600">
              {delNavn(i)}
              <input
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                aria-label={`${etikett} — ${delNavn(i)}`}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                value={tall[i] ?? 0}
                onChange={(e) => settTall(type, id, i, Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          ))}
        </div>
        {tekst && <p className="text-xs text-red-600">{tekst}</p>}
      </li>
    );
  };

  const delValg = (type: "tillegg" | "utlegg" | "reiser", id: string, etikett: string, del: number, horerTil: string) => (
    <li key={id} className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-gray-800">{etikett}</span>
      <label className="flex items-center gap-1 text-xs text-gray-600">
        {horerTil}
        <select
          aria-label={`${etikett} — ${horerTil}`}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={del}
          onChange={(e) => settDel(type, id, Number(e.target.value))}
        >
          {deler.map((_, i) => (
            <option key={i} value={i}>
              {delNavn(i)}
            </option>
          ))}
        </select>
      </label>
    </li>
  );

  const reiseEtikett = (r: FolgerMedData["reiser"][number]) => {
    const p = { fra: r.fraTid ?? "—", til: r.tilTid ?? "—" };
    if (r.retning === "ut") return t("timer.splitt.folgerMed.reiseUt", p);
    if (r.retning === "retur") return t("timer.splitt.folgerMed.reiseHjem", p);
    return t("timer.splitt.folgerMed.reise", p);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3" aria-label={t("timer.splitt.folgerMed.tittel")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{t("timer.splitt.folgerMed.tittel")}</p>
      <p className="mb-2 text-xs text-gray-500">{t("timer.splitt.folgerMed.hjelp")}</p>
      <ul className="space-y-3">
        {data.maskiner.map((m) =>
          tallRad(
            "maskiner",
            m.id,
            `${t("timer.splitt.folgerMed.maskin")}: ${m.navn} · ${formaterTimer(m.timer)} t`,
            m.timer,
            fordeling.maskiner.find((f) => f.id === m.id)?.timer ?? [],
          ),
        )}
        {data.varer.map((v) =>
          tallRad(
            "varer",
            v.id,
            `${t("timer.splitt.folgerMed.vare")}: ${v.navn} · ${formaterTimer(v.antall)} ${v.enhet}`,
            v.antall,
            fordeling.varer.find((f) => f.id === v.id)?.antall ?? [],
          ),
        )}
        {data.tillegg.map((r) =>
          delValg(
            "tillegg",
            r.id,
            `${t("timer.splitt.folgerMed.tillegg")}: ${r.navn} · ${formaterTimer(r.antall)}`,
            fordeling.tillegg.find((f) => f.id === r.id)?.del ?? 0,
            t("timer.splitt.folgerMed.horerTil"),
          ),
        )}
        {data.utlegg.map((r) =>
          delValg(
            "utlegg",
            r.id,
            `${t("timer.splitt.folgerMed.utlegg")}: ${r.navn} · ${formaterBelop(r.belop)} kr`,
            fordeling.utlegg.find((f) => f.id === r.id)?.del ?? 0,
            t("timer.splitt.folgerMed.horerTil"),
          ),
        )}
        {data.reiser.map((r) =>
          delValg(
            "reiser",
            r.id,
            reiseEtikett(r),
            fordeling.reiser.find((f) => f.id === r.id)?.del ?? 0,
            t("timer.splitt.folgerMed.reiseHorerTil"),
          ),
        )}
      </ul>
    </section>
  );
}
