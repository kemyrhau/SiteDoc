"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Plus,
  Trash2,
  Camera,
  Copy,
  Check,
  XCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Konstanter og typer                                                */
/* ------------------------------------------------------------------ */

const DAGSNORM = 7.5;
const OVERTIDSMAT_TERSKEL = 9;

interface Maskinrad { id: string; maskin: string; timer: number; mengde: string; enhet: string }
interface Materialrad { id: string; navn: string; mengde: string; enhet: string }
interface Utleggrad { id: string; kategori: string; belop: string; notat: string; harBilde: boolean }

interface Dagsseddel {
  id: string; dato: string; ansatt: string; prosjekt: string;
  totaltimer: number; normaltid: number; overtid50: number; overtid100: number; reisetid: number;
  overtidsmat: boolean; nattillegg: boolean; helgetillegg: boolean;
  tilleggsarbeid: string | null; maskiner: number; utlegg: number;
  status: "utkast" | "ventende" | "godkjent" | "avvist";
}

/* ------------------------------------------------------------------ */
/*  Demodata                                                           */
/* ------------------------------------------------------------------ */

const DEMO_PROSJEKTER = ["998 Innstifjordbotn", "E6 Kvænangsfjellet"];
const DEMO_MASKINER = ["Gravemaskin CAT 320", "Hjullaster Volvo L90", "Lastebil MAN TGS", "Dumper Volvo A30"];
const DEMO_ENHETER = ["m³", "m²", "m", "tonn", "kg", "stk"];
const DEMO_KATEGORIER = ["Drivstoff", "Parkering", "Diett", "Verktøy", "Annet"];

const DEMO_ENDRINGER = [
  { nr: "E-042", navn: "Utvidet grøft sør", beskrivelse: "Grøften utvides med 2m mot sør pga. kabelføring. Inkluderer graving, masseutskifting og tilbakefylling." },
  { nr: "E-038", navn: "Ekstra drenering nord", beskrivelse: "Ny dreneringslinje langs nordfasaden. 45m rør + 3 kummer." },
  { nr: "E-035", navn: "Fundamentforsterkning", beskrivelse: "Forsterking av fundament B3-B5 med tilleggsjern og utvidet såle." },
  { nr: "G-012", navn: "Endret innkjørsel", beskrivelse: "Innkjørselen flyttes 8m vestover etter krav fra vegvesenet." },
];

const DEMO_SEDLER: Dagsseddel[] = [
  { id: "1", dato: "2026-04-15", ansatt: "Florian Aschwanden - A. Markussen AS", prosjekt: "E6 Kvænangsfjellet", totaltimer: 10, normaltid: 7.5, overtid50: 2.5, overtid100: 0, reisetid: 1, overtidsmat: true, nattillegg: false, helgetillegg: false, tilleggsarbeid: "E-042", maskiner: 2, utlegg: 450, status: "ventende" },
  { id: "2", dato: "2026-04-14", ansatt: "Florian Aschwanden - A. Markussen AS", prosjekt: "998 Innstifjordbotn", totaltimer: 7.5, normaltid: 7.5, overtid50: 0, overtid100: 0, reisetid: 1, overtidsmat: false, nattillegg: false, helgetillegg: false, tilleggsarbeid: null, maskiner: 1, utlegg: 0, status: "godkjent" },
  { id: "3", dato: "2026-04-13", ansatt: "Kenneth Myrhaug", prosjekt: "998 Innstifjordbotn", totaltimer: 7.5, normaltid: 7.5, overtid50: 0, overtid100: 0, reisetid: 0.5, overtidsmat: false, nattillegg: false, helgetillegg: false, tilleggsarbeid: null, maskiner: 0, utlegg: 120, status: "godkjent" },
  { id: "4", dato: "2026-04-12", ansatt: "Kenneth Myrhaug", prosjekt: "998 Innstifjordbotn", totaltimer: 9.5, normaltid: 7.5, overtid50: 2, overtid100: 0, reisetid: 1, overtidsmat: true, nattillegg: false, helgetillegg: true, tilleggsarbeid: "E-038", maskiner: 3, utlegg: 0, status: "ventende" },
  { id: "5", dato: "2026-04-11", ansatt: "Florian Aschwanden - A. Markussen AS", prosjekt: "E6 Kvænangsfjellet", totaltimer: 8, normaltid: 7.5, overtid50: 0.5, overtid100: 0, reisetid: 0, overtidsmat: false, nattillegg: false, helgetillegg: false, tilleggsarbeid: null, maskiner: 1, utlegg: 89, status: "utkast" },
];

// Ukedager — kolonne-headers
const UKEDAGER = [
  { dag: "Man", dato: "14." },
  { dag: "Tir", dato: "15." },
  { dag: "Ons", dato: "16." },
  { dag: "Tor", dato: "17." },
  { dag: "Fre", dato: "18." },
];

// Prosjekt-rader med tilleggsarbeid-underrader
interface UkeProsjekt {
  prosjekt: string;
  timer: (number | null)[]; // index 0=man, 1=tir, ...
  underrader: { label: string; timer: (number | null)[] }[];
}

const DEMO_UKE_PROSJEKTER: UkeProsjekt[] = [
  {
    prosjekt: "998 Innstifjordbotn",
    timer: [7.5, null, null, 8.0, 7.5],
    underrader: [
      { label: "ordinære", timer: [7.5, null, null, 1.0, 7.5] },
      { label: "E-042 Kabelgrøft", timer: [null, null, null, 5.0, null] },
      { label: "E-038 Armering", timer: [null, null, null, 2.0, null] },
    ],
  },
  {
    prosjekt: "E6 Kvænangsfjellet",
    timer: [null, 10.0, 7.5, null, null],
    underrader: [
      { label: "ordinære", timer: [null, 6.0, 7.5, null, null] },
      { label: "E-051 Drenering", timer: [null, 4.0, null, null, null] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Hjelpefunksjoner                                                   */
/* ------------------------------------------------------------------ */

function beregnOvertid(totalt: number) {
  if (totalt <= DAGSNORM) return { normaltid: totalt, overtid50: 0, overtid100: 0 };
  return { normaltid: DAGSNORM, overtid50: Math.min(totalt - DAGSNORM, 3), overtid100: Math.max(0, totalt - DAGSNORM - 3) };
}

function erHelg(dato: string) {
  const d = new Date(dato);
  return d.getDay() === 0 || d.getDay() === 6;
}

let _id = 0;
function genId() { return `tmp-${++_id}`; }

/* ------------------------------------------------------------------ */
/*  Statistikkpanel (delt mellom oversikt og dagsseddel)               */
/* ------------------------------------------------------------------ */

function StatistikkPanel({ t }: { t: (k: string) => string }) {
  // Beregn dagssum og ukesum
  const dagsSummer = UKEDAGER.map((_, i) =>
    DEMO_UKE_PROSJEKTER.reduce<number>((s, p) => s + (p.timer[i] ?? 0), 0)
  );
  const ukeSum = dagsSummer.reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5">
      {/* Denne uken */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Uke 16 — 14.–18. apr</h3>

        {/* Kolonne-header */}
        <div className="flex items-center gap-0 px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          <span className="flex-1"></span>
          {UKEDAGER.map((d) => (
            <span key={d.dag} className="w-9 text-right">{d.dag}</span>
          ))}
          <span className="w-11 text-right">Sum</span>
        </div>

        {/* Prosjekt-rader */}
        <div className="space-y-0">
          {DEMO_UKE_PROSJEKTER.map((p) => {
            const prosjektSum = p.timer.reduce<number>((s, v) => s + (v ?? 0), 0);
            return (
              <div key={p.prosjekt} className="border-t border-gray-100">
                {/* Hovedrad */}
                <div className="flex items-center gap-0 px-1 py-1.5">
                  <span className="flex-1 truncate text-xs font-semibold text-gray-800">{p.prosjekt}</span>
                  {p.timer.map((v, i) => (
                    <span key={i} className={`w-9 text-right text-xs tabular-nums ${v ? "font-semibold text-gray-700" : "text-gray-300"}`}>
                      {v ? `${v}` : "—"}
                    </span>
                  ))}
                  <span className="w-11 text-right text-xs tabular-nums font-semibold text-gray-900">{prosjektSum}t</span>
                </div>
                {/* Underrader */}
                {p.underrader.map((u) => {
                  const underSum = u.timer.reduce<number>((s, v) => s + (v ?? 0), 0);
                  return (
                    <div key={u.label} className="flex items-center gap-0 px-1 py-0.5">
                      <span className="flex-1 truncate text-[11px] italic text-gray-400 pl-2">· {u.label}</span>
                      {u.timer.map((v, i) => (
                        <span key={i} className={`w-9 text-right text-[11px] tabular-nums ${v ? "text-gray-400" : "text-gray-200"}`}>
                          {v ? `${v}` : "—"}
                        </span>
                      ))}
                      <span className="w-11 text-right text-[11px] tabular-nums text-gray-400">{underSum}t</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sumrad */}
        <div className="flex items-center gap-0 border-t-2 border-gray-300 px-1 pt-1.5">
          <span className="flex-1 text-xs font-semibold text-gray-900">Sum</span>
          {dagsSummer.map((v, i) => (
            <span key={i} className={`w-9 text-right text-xs tabular-nums font-semibold ${v > 0 ? "text-gray-900" : "text-gray-300"}`}>
              {v > 0 ? `${v}` : "—"}
            </span>
          ))}
          <span className="w-11 text-right text-xs tabular-nums font-bold text-gray-900">{ukeSum}t</span>
        </div>
      </div>

      {/* Denne måneden */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">April 2026</h3>
        <div className="space-y-1 text-sm">
          <StatRad label={t("timer.normaltid")} verdi="120.0t" />
          <StatRad label={t("timer.overtid50")} verdi="8.5t" />
          <StatRad label={t("timer.overtid100")} verdi="0.0t" />
          <StatRad label={t("timer.reisetid")} verdi="4.5t" />
          <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1.5 font-semibold text-gray-900">
            <span>{t("timer.totalt")}</span>
            <span className="tabular-nums">133.0t</span>
          </div>
        </div>
      </div>

      {/* Hittil i år */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">2026 — hittil</h3>
        <div className="space-y-1 text-sm">
          <StatRad label={t("timer.normaltid")} verdi="487.5t" />
          <StatRad label="Overtid" verdi="32.0t" />
          <StatRad label={t("timer.reisetid")} verdi="18.5t" />
          <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1.5 font-semibold text-gray-900">
            <span>{t("timer.totalt")}</span>
            <span className="tabular-nums">538.0t</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>{t("timer.utlegg")}</span>
            <span className="tabular-nums">4 250 kr</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRad({ label, verdi }: { label: string; verdi: string }) {
  return (
    <div className="flex items-center justify-between text-gray-600">
      <span>{label}</span>
      <span className="tabular-nums">{verdi}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hjelpmodal                                                         */
/* ------------------------------------------------------------------ */

function TimerHjelpKnapp() {
  const [åpen, setÅpen] = useState(false);
  const { t } = useTranslation();
  return (
    <>
      <button onClick={() => setÅpen(true)} className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title={t("hjelp.tittel")}>
        <HelpCircle className="h-5 w-5" />
      </button>
      {åpen && <TimerHjelpModal onLukk={() => setÅpen(false)} />}
    </>
  );
}

function TimerHjelpModal({ onLukk }: { onLukk: () => void }) {
  const [fane, setFane] = useState<"om" | "godkjenning" | "eksport">("om");
  const { t } = useTranslation();
  const faner = [
    { id: "om" as const, label: t("timer.hjelpTittel") },
    { id: "godkjenning" as const, label: t("timer.hjelpGodkjenning") },
    { id: "eksport" as const, label: t("timer.hjelpEksport") },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onLukk}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("hjelp.tittel")}</h2>
          <button onClick={onLukk} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex border-b border-gray-200 px-6">
          {faner.map((f) => (
            <button key={f.id} onClick={() => setFane(f.id)} className={`px-4 py-2.5 text-sm font-medium transition-colors ${fane === f.id ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>{f.label}</button>
          ))}
        </div>
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
          {fane === "om" && (<><p className="text-sm text-gray-600">{t("timer.hjelpBeskrivelse")}</p><div><h3 className="text-sm font-semibold text-gray-900">{t("timer.hjelpDagsseddel")}</h3><p className="mt-1 text-sm text-gray-600">{t("timer.hjelpDagsseddelTekst")}</p></div></>)}
          {fane === "godkjenning" && <p className="text-sm text-gray-600">{t("timer.hjelpGodkjenningTekst")}</p>}
          {fane === "eksport" && <p className="text-sm text-gray-600">{t("timer.hjelpEksportTekst")}</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function TimerSide() {
  const { t } = useTranslation();
  const [visning, setVisning] = useState<"oversikt" | "skjema">("oversikt");
  const [sedler] = useState<Dagsseddel[]>(DEMO_SEDLER);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-sitedoc-primary" />
          <h1 className="text-lg font-semibold text-gray-900">{t("timer.tittel")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVisning("skjema")} className="inline-flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4" />{t("timer.nyDagsseddel")}
          </button>
          <TimerHjelpKnapp />
        </div>
      </div>

      {/* Faner */}
      <div className="flex border-b border-gray-200 px-6">
        {(["oversikt", "skjema"] as const).map((v) => (
          <button key={v} onClick={() => setVisning(v)} className={`px-4 py-2.5 text-sm font-medium transition-colors ${visning === v ? "border-b-2 border-sitedoc-primary text-sitedoc-primary" : "text-gray-500 hover:text-gray-700"}`}>
            {v === "oversikt" ? t("timer.oversikt") : t("timer.dagsseddel")}
          </button>
        ))}
      </div>

      {/* Innhold — to-kolonner på PC */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col md:flex-row">
          {/* Venstre: hovedinnhold */}
          <div className="flex-1 min-w-0">
            {visning === "oversikt" ? (
              <OversiktTabell sedler={sedler} t={t} />
            ) : (
              <DagsseddelSkjema t={t} onTilbake={() => setVisning("oversikt")} />
            )}
          </div>
          {/* Høyre: statistikkpanel (skjult på mobil) */}
          <div className="hidden md:block w-72 lg:w-80 shrink-0 border-l border-gray-200 bg-gray-50/70 p-5 overflow-y-auto">
            <StatistikkPanel t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Oversiktstabell                                                    */
/* ------------------------------------------------------------------ */

function OversiktTabell({ sedler, t }: { sedler: Dagsseddel[]; t: (k: string) => string }) {
  const [prosjektFilter, setProsjektFilter] = useState("");
  const filtrert = prosjektFilter ? sedler.filter((s) => s.prosjekt === prosjektFilter) : sedler;

  const sum = filtrert.reduce((a, s) => ({
    normaltid: a.normaltid + s.normaltid,
    overtid50: a.overtid50 + s.overtid50,
    overtid100: a.overtid100 + s.overtid100,
    reisetid: a.reisetid + s.reisetid,
    utlegg: a.utlegg + s.utlegg,
  }), { normaltid: 0, overtid50: 0, overtid100: 0, reisetid: 0, utlegg: 0 });

  const statusFarge: Record<string, string> = {
    utkast: "bg-gray-100 text-gray-700",
    ventende: "bg-amber-100 text-amber-700",
    godkjent: "bg-green-100 text-green-700",
    avvist: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6">
      {/* Prosjektfilter */}
      <div className="mb-4">
        <select
          value={prosjektFilter}
          onChange={(e) => setProsjektFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
        >
          <option value="">Alle prosjekter</option>
          {DEMO_PROSJEKTER.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="pb-3 pr-3">{t("tabell.dato")}</th>
              <th className="pb-3 pr-3">{t("timer.ansatt")}</th>
              <th className="pb-3 pr-3">{t("label.prosjekt")}</th>
              <th className="pb-3 pr-3 text-right">{t("timer.normaltid")}</th>
              <th className="pb-3 pr-3 text-right">OT50</th>
              <th className="pb-3 pr-3 text-right">OT100</th>
              <th className="pb-3 pr-3 text-right">{t("timer.reisetid")}</th>
              <th className="pb-3 pr-3">{t("timer.tillegg")}</th>
              <th className="pb-3 pr-3">Tilleggsarbeid</th>
              <th className="pb-3 pr-3 text-right">{t("timer.utlegg")}</th>
              <th className="pb-3 pr-3">{t("tabell.status")}</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrert.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-3 font-medium text-gray-900 whitespace-nowrap">{new Date(s.dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}</td>
                <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">{s.ansatt}</td>
                <td className="py-3 pr-3 text-gray-500 text-xs whitespace-nowrap">{s.prosjekt}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{s.normaltid}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{s.overtid50 > 0 ? s.overtid50 : "–"}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{s.overtid100 > 0 ? s.overtid100 : "–"}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{s.reisetid > 0 ? s.reisetid : "–"}</td>
                <td className="py-3 pr-3">
                  <div className="flex gap-1">
                    {s.overtidsmat && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">OTM</span>}
                    {s.nattillegg && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">NATT</span>}
                    {s.helgetillegg && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">HELG</span>}
                    {!s.overtidsmat && !s.nattillegg && !s.helgetillegg && <span className="text-gray-300">–</span>}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  {s.tilleggsarbeid ? (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{s.tilleggsarbeid}</span>
                  ) : <span className="text-gray-300">–</span>}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">{s.utlegg > 0 ? `${s.utlegg} kr` : "–"}</td>
                <td className="py-3 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusFarge[s.status]}`}>{t(`status.${s.status}`)}</span>
                </td>
                <td className="py-3">
                  {s.status === "ventende" && (
                    <div className="flex gap-1">
                      <button className="rounded p-1 text-green-500 hover:bg-green-50" title={t("timer.godkjenn")}><Check className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-red-400 hover:bg-red-50" title={t("timer.avvis")}><XCircle className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Sumrad */}
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
              <td className="py-3 pr-3">Sum</td>
              <td className="pr-3"></td>
              <td className="pr-3"></td>
              <td className="py-3 pr-3 text-right tabular-nums">{sum.normaltid}t</td>
              <td className="py-3 pr-3 text-right tabular-nums">{sum.overtid50 > 0 ? `${sum.overtid50}t` : "–"}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{sum.overtid100 > 0 ? `${sum.overtid100}t` : "–"}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{sum.reisetid > 0 ? `${sum.reisetid}t` : "–"}</td>
              <td className="pr-3"></td>
              <td className="pr-3"></td>
              <td className="py-3 pr-3 text-right tabular-nums">{sum.utlegg > 0 ? `${sum.utlegg} kr` : "–"}</td>
              <td className="pr-3"></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dagsseddel-skjema — to-kolonner på PC                              */
/* ------------------------------------------------------------------ */

function DagsseddelSkjema({ t, onTilbake }: { t: (k: string) => string; onTilbake: () => void }) {
  const [dato, setDato] = useState("2026-04-16");
  const [prosjekt, setProsjekt] = useState(DEMO_PROSJEKTER[0]!);
  const [tilleggsarbeid, setTilleggsarbeid] = useState("");
  const [totaltimer, setTotaltimer] = useState(8);
  const [reisetid, setReisetid] = useState(0);
  const [overtidsmat, setOvertidsmat] = useState(false);
  const [nattillegg, setNattillegg] = useState(false);
  const [helgetillegg, setHelgetillegg] = useState(false);
  const [beskrivelse, setBeskrivelse] = useState("");
  const [maskiner, setMaskiner] = useState<Maskinrad[]>([]);
  const [materialer, setMaterialer] = useState<Materialrad[]>([]);
  const [utlegg, setUtlegg] = useState<Utleggrad[]>([]);
  const [åpneSeksjoner, setÅpneSeksjoner] = useState<Record<string, boolean>>({ maskiner: false, materialer: false, utlegg: false });

  const fordeling = useMemo(() => beregnOvertid(totaltimer), [totaltimer]);
  const autoOvertidsmat = totaltimer > OVERTIDSMAT_TERSKEL;
  const autoHelg = erHelg(dato);
  const valgtEndring = DEMO_ENDRINGER.find((e) => e.nr === tilleggsarbeid);

  useMemo(() => {
    if (autoOvertidsmat && !overtidsmat) setOvertidsmat(true);
    if (autoHelg && !helgetillegg) setHelgetillegg(true);
  }, [autoOvertidsmat, autoHelg]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSeksjon(id: string) {
    setÅpneSeksjoner((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="max-w-[420px] p-6">
      {/* Kopiér forrige dag */}
      <div className="mb-4 flex justify-end">
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Copy className="h-3.5 w-3.5" />{t("timer.kopierForrige")}
        </button>
      </div>

      <div className="space-y-5">
        {/* Dato */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("tabell.dato")}</label>
          <input type="date" value={dato} onChange={(e) => setDato(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary" />
        </div>

        {/* Prosjekt */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("label.prosjekt")}</label>
          <select value={prosjekt} onChange={(e) => setProsjekt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary">
            {DEMO_PROSJEKTER.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Tilleggsarbeid */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tilleggsarbeid</label>
          <select value={tilleggsarbeid} onChange={(e) => setTilleggsarbeid(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary">
            <option value="">Ingen (ordinære timer)</option>
            {DEMO_ENDRINGER.map((e) => <option key={e.nr} value={e.nr}>{e.nr} — {e.navn}</option>)}
          </select>
          {valgtEndring && (
            <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
              <div className="text-xs font-medium text-indigo-700">{valgtEndring.nr} — {valgtEndring.navn}</div>
              <p className="mt-1 text-xs text-indigo-600">{valgtEndring.beskrivelse}</p>
            </div>
          )}
        </div>

        {/* Arbeidstimer */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="mb-3 block text-sm font-medium text-gray-700">{t("timer.arbeidstimer")}</label>
          <div className="mb-3">
            <input type="number" step="0.5" min="0" max="24" value={totaltimer}
              onChange={(e) => setTotaltimer(parseFloat(e.target.value) || 0)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold tabular-nums focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary" />
            <span className="ml-2 text-sm text-gray-500">{t("timer.timer")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 px-2.5 py-2">
              <div className="text-[11px] text-gray-500">{t("timer.normaltid")}</div>
              <div className="text-base font-semibold tabular-nums text-gray-900">{fordeling.normaltid}</div>
            </div>
            <div className="rounded-lg bg-amber-50 px-2.5 py-2">
              <div className="text-[11px] text-amber-600">OT 50%</div>
              <div className="text-base font-semibold tabular-nums text-amber-700">{fordeling.overtid50}</div>
            </div>
            <div className="rounded-lg bg-red-50 px-2.5 py-2">
              <div className="text-[11px] text-red-600">OT 100%</div>
              <div className="text-base font-semibold tabular-nums text-red-700">{fordeling.overtid100}</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">{t("timer.dagsnorm")}: {DAGSNORM}t — {t("timer.autoBeregnet")}</p>
        </div>

        {/* Reisetid */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("timer.reisetid")}</label>
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" min="0" max="24" value={reisetid}
              onChange={(e) => setReisetid(parseFloat(e.target.value) || 0)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary" />
            <span className="text-sm text-gray-500">{t("timer.timer")}</span>
          </div>
        </div>

        {/* Tillegg */}
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">{t("timer.tillegg")}</div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-3 rounded px-2 py-1 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={overtidsmat} onChange={(e) => setOvertidsmat(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary" />
              <span className="text-sm text-gray-700">{t("timer.overtidsmat")}</span>
              {autoOvertidsmat && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">auto</span>}
            </label>
            <label className="flex items-center gap-3 rounded px-2 py-1 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={nattillegg} onChange={(e) => setNattillegg(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary" />
              <span className="text-sm text-gray-700">{t("timer.nattillegg")}</span>
            </label>
            <label className="flex items-center gap-3 rounded px-2 py-1 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={helgetillegg} onChange={(e) => setHelgetillegg(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary" />
              <span className="text-sm text-gray-700">{t("timer.helgetillegg")}</span>
              {autoHelg && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">auto</span>}
            </label>
          </div>
        </div>

        {/* Maskiner */}
        <SammenleggbarSeksjon tittel={t("timer.maskiner")} antall={maskiner.length} åpen={åpneSeksjoner.maskiner ?? false} onToggle={() => toggleSeksjon("maskiner")}>
          {maskiner.map((m, i) => (
            <div key={m.id} className="mb-2 flex flex-wrap items-center gap-2">
              <select value={m.maskin} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, maskin: e.target.value }; setMaskiner(ny); }} className="flex-1 min-w-[140px] rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">{t("timer.maskiner")}...</option>
                {DEMO_MASKINER.map((dm) => <option key={dm} value={dm}>{dm}</option>)}
              </select>
              <input type="number" step="0.5" min="0" value={m.timer} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, timer: parseFloat(e.target.value) || 0 }; setMaskiner(ny); }} className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm tabular-nums" placeholder="t" />
              <input type="text" value={m.mengde} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, mengde: e.target.value }; setMaskiner(ny); }} className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("timer.mengde")} />
              <select value={m.enhet} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, enhet: e.target.value }; setMaskiner(ny); }} className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm">
                {DEMO_ENHETER.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={() => setMaskiner(maskiner.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={() => setMaskiner([...maskiner, { id: genId(), maskin: "", timer: 0, mengde: "", enhet: "m³" }])} className="inline-flex items-center gap-1 text-sm text-sitedoc-secondary hover:text-sitedoc-primary">
            <Plus className="h-3.5 w-3.5" />{t("handling.leggTil")}
          </button>
        </SammenleggbarSeksjon>

        {/* Materialer */}
        <SammenleggbarSeksjon tittel={t("timer.materialer")} antall={materialer.length} åpen={åpneSeksjoner.materialer ?? false} onToggle={() => toggleSeksjon("materialer")}>
          {materialer.map((m, i) => (
            <div key={m.id} className="mb-2 flex flex-wrap items-center gap-2">
              <input type="text" value={m.navn} onChange={(e) => { const ny = [...materialer]; ny[i] = { ...m, navn: e.target.value }; setMaterialer(ny); }} className="flex-1 min-w-[120px] rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("tabell.navn")} />
              <input type="text" value={m.mengde} onChange={(e) => { const ny = [...materialer]; ny[i] = { ...m, mengde: e.target.value }; setMaterialer(ny); }} className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("timer.mengde")} />
              <select value={m.enhet} onChange={(e) => { const ny = [...materialer]; ny[i] = { ...m, enhet: e.target.value }; setMaterialer(ny); }} className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm">
                {DEMO_ENHETER.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={() => setMaterialer(materialer.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={() => setMaterialer([...materialer, { id: genId(), navn: "", mengde: "", enhet: "m³" }])} className="inline-flex items-center gap-1 text-sm text-sitedoc-secondary hover:text-sitedoc-primary">
            <Plus className="h-3.5 w-3.5" />{t("handling.leggTil")}
          </button>
        </SammenleggbarSeksjon>

        {/* Utlegg */}
        <SammenleggbarSeksjon tittel={t("timer.utlegg")} antall={utlegg.length} åpen={åpneSeksjoner.utlegg ?? false} onToggle={() => toggleSeksjon("utlegg")}>
          {utlegg.map((u, i) => (
            <div key={u.id} className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <select value={u.kategori} onChange={(e) => { const ny = [...utlegg]; ny[i] = { ...u, kategori: e.target.value }; setUtlegg(ny); }} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
                  <option value="">{t("timer.kategori")}...</option>
                  {DEMO_KATEGORIER.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input type="number" min="0" value={u.belop} onChange={(e) => { const ny = [...utlegg]; ny[i] = { ...u, belop: e.target.value }; setUtlegg(ny); }} className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm tabular-nums" placeholder="kr" />
                <button onClick={() => setUtlegg(utlegg.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={u.notat} onChange={(e) => { const ny = [...utlegg]; ny[i] = { ...u, notat: e.target.value }; setUtlegg(ny); }} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("timer.notat")} />
                <button className="inline-flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700">
                  <Camera className="h-3.5 w-3.5" />{t("timer.kvittering")}
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setUtlegg([...utlegg, { id: genId(), kategori: "", belop: "", notat: "", harBilde: false }])} className="inline-flex items-center gap-1 text-sm text-sitedoc-secondary hover:text-sitedoc-primary">
            <Plus className="h-3.5 w-3.5" />{t("handling.leggTil")}
          </button>
        </SammenleggbarSeksjon>

        {/* Beskrivelse */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("tabell.beskrivelse")}</label>
          <textarea value={beskrivelse} onChange={(e) => setBeskrivelse(e.target.value)} rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            placeholder="Graving + kantstein langs innkjørselen..." />
        </div>

        {/* Knapper */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <button onClick={onTilbake} className="text-sm text-gray-500 hover:text-gray-700">{t("handling.avbryt")}</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">{t("handling.lagre")}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sammenleggbar seksjon                                              */
/* ------------------------------------------------------------------ */

function SammenleggbarSeksjon({ tittel, antall, åpen, onToggle, children }: {
  tittel: string; antall: number; åpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          {tittel}
          {antall > 0 && <span className="rounded-full bg-sitedoc-primary/10 px-2 py-0.5 text-xs font-medium text-sitedoc-primary">{antall}</span>}
        </div>
        {åpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {åpen && <div className="border-t border-gray-200 px-4 py-3">{children}</div>}
    </div>
  );
}
