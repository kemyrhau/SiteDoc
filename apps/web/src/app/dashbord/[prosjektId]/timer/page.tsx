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

interface Maskinrad {
  id: string;
  maskin: string;
  timer: number;
  mengde: string;
  enhet: string;
}

interface Materialrad {
  id: string;
  navn: string;
  mengde: string;
  enhet: string;
}

interface Utleggrad {
  id: string;
  kategori: string;
  belop: string;
  notat: string;
  harBilde: boolean;
}

interface Dagsseddel {
  id: string;
  dato: string;
  ansatt: string;
  totaltimer: number;
  normaltid: number;
  overtid50: number;
  overtid100: number;
  reisetid: number;
  overtidsmat: boolean;
  nattillegg: boolean;
  helgetillegg: boolean;
  maskiner: number;
  utlegg: number;
  status: "utkast" | "ventende" | "godkjent" | "avvist";
}

/* ------------------------------------------------------------------ */
/*  Demodata                                                           */
/* ------------------------------------------------------------------ */

const DEMO_MASKINER = ["Gravemaskin CAT 320", "Hjullaster Volvo L90", "Lastebil MAN TGS", "Dumper Volvo A30"];
const DEMO_ENHETER = ["m³", "m²", "m", "tonn", "kg", "stk"];
const DEMO_KATEGORIER = ["Drivstoff", "Parkering", "Diett", "Verktøy", "Annet"];

const DEMO_SEDLER: Dagsseddel[] = [
  { id: "1", dato: "2026-04-15", ansatt: "Florian Aschwanden", totaltimer: 10, normaltid: 7.5, overtid50: 2.5, overtid100: 0, reisetid: 1, overtidsmat: true, nattillegg: false, helgetillegg: false, maskiner: 2, utlegg: 450, status: "ventende" },
  { id: "2", dato: "2026-04-14", ansatt: "Florian Aschwanden", totaltimer: 8, normaltid: 7.5, overtid50: 0.5, overtid100: 0, reisetid: 1, overtidsmat: false, nattillegg: false, helgetillegg: false, maskiner: 1, utlegg: 0, status: "godkjent" },
  { id: "3", dato: "2026-04-13", ansatt: "Erik Johansen", totaltimer: 7.5, normaltid: 7.5, overtid50: 0, overtid100: 0, reisetid: 0.5, overtidsmat: false, nattillegg: false, helgetillegg: false, maskiner: 0, utlegg: 120, status: "godkjent" },
  { id: "4", dato: "2026-04-12", ansatt: "Erik Johansen", totaltimer: 9.5, normaltid: 7.5, overtid50: 2, overtid100: 0, reisetid: 1, overtidsmat: true, nattillegg: false, helgetillegg: true, maskiner: 3, utlegg: 0, status: "ventende" },
  { id: "5", dato: "2026-04-11", ansatt: "Morten Berg", totaltimer: 8, normaltid: 7.5, overtid50: 0.5, overtid100: 0, reisetid: 0, overtidsmat: false, nattillegg: false, helgetillegg: false, maskiner: 1, utlegg: 89, status: "utkast" },
];

/* ------------------------------------------------------------------ */
/*  Hjelpefunksjoner                                                   */
/* ------------------------------------------------------------------ */

function beregnOvertid(totalt: number): { normaltid: number; overtid50: number; overtid100: number } {
  if (totalt <= DAGSNORM) return { normaltid: totalt, overtid50: 0, overtid100: 0 };
  return { normaltid: DAGSNORM, overtid50: Math.min(totalt - DAGSNORM, 3), overtid100: Math.max(0, totalt - DAGSNORM - 3) };
}

function erHelg(dato: string): boolean {
  const d = new Date(dato);
  return d.getDay() === 0 || d.getDay() === 6;
}

let _idCounter = 0;
function genId(): string {
  return `tmp-${++_idCounter}`;
}

/* ------------------------------------------------------------------ */
/*  Hjelpmodal                                                         */
/* ------------------------------------------------------------------ */

function TimerHjelpKnapp() {
  const [åpen, setÅpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <button
        onClick={() => setÅpen(true)}
        className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title={t("hjelp.tittel")}
      >
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
          <button onClick={onLukk} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex border-b border-gray-200 px-6">
          {faner.map((f) => (
            <button
              key={f.id}
              onClick={() => setFane(f.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${fane === f.id ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
          {fane === "om" && (
            <>
              <p className="text-sm text-gray-600">{t("timer.hjelpBeskrivelse")}</p>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t("timer.hjelpDagsseddel")}</h3>
                <p className="mt-1 text-sm text-gray-600">{t("timer.hjelpDagsseddelTekst")}</p>
              </div>
            </>
          )}
          {fane === "godkjenning" && (
            <p className="text-sm text-gray-600">{t("timer.hjelpGodkjenningTekst")}</p>
          )}
          {fane === "eksport" && (
            <p className="text-sm text-gray-600">{t("timer.hjelpEksportTekst")}</p>
          )}
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
          <button
            onClick={() => setVisning("skjema")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("timer.nyDagsseddel")}
          </button>
          <TimerHjelpKnapp />
        </div>
      </div>

      {/* Faner */}
      <div className="flex border-b border-gray-200 px-6">
        <button
          onClick={() => setVisning("oversikt")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${visning === "oversikt" ? "border-b-2 border-sitedoc-primary text-sitedoc-primary" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t("timer.oversikt")}
        </button>
        <button
          onClick={() => setVisning("skjema")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${visning === "skjema" ? "border-b-2 border-sitedoc-primary text-sitedoc-primary" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t("timer.dagsseddel")}
        </button>
      </div>

      {/* Innhold */}
      <div className="flex-1 overflow-y-auto">
        {visning === "oversikt" ? (
          <OversiktTabell sedler={sedler} t={t} />
        ) : (
          <DagsseddelSkjema t={t} onTilbake={() => setVisning("oversikt")} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Oversiktstabell                                                    */
/* ------------------------------------------------------------------ */

function OversiktTabell({ sedler, t }: { sedler: Dagsseddel[]; t: (k: string) => string }) {
  const statusFarge: Record<string, string> = {
    utkast: "bg-gray-100 text-gray-700",
    ventende: "bg-amber-100 text-amber-700",
    godkjent: "bg-green-100 text-green-700",
    avvist: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="pb-3 pr-4">{t("tabell.dato")}</th>
            <th className="pb-3 pr-4">{t("timer.ansatt")}</th>
            <th className="pb-3 pr-4 text-right">{t("timer.normaltid")}</th>
            <th className="pb-3 pr-4 text-right">{t("timer.overtid50")}</th>
            <th className="pb-3 pr-4 text-right">{t("timer.overtid100")}</th>
            <th className="pb-3 pr-4 text-right">{t("timer.reisetid")}</th>
            <th className="pb-3 pr-4">{t("timer.tillegg")}</th>
            <th className="pb-3 pr-4 text-right">{t("timer.utlegg")}</th>
            <th className="pb-3">{t("tabell.status")}</th>
            <th className="pb-3"></th>
          </tr>
        </thead>
        <tbody>
          {sedler.map((s) => (
            <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 pr-4 font-medium text-gray-900">{new Date(s.dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}</td>
              <td className="py-3 pr-4 text-gray-700">{s.ansatt}</td>
              <td className="py-3 pr-4 text-right tabular-nums">{s.normaltid}</td>
              <td className="py-3 pr-4 text-right tabular-nums">{s.overtid50 > 0 ? s.overtid50 : "–"}</td>
              <td className="py-3 pr-4 text-right tabular-nums">{s.overtid100 > 0 ? s.overtid100 : "–"}</td>
              <td className="py-3 pr-4 text-right tabular-nums">{s.reisetid > 0 ? s.reisetid : "–"}</td>
              <td className="py-3 pr-4">
                <div className="flex gap-1">
                  {s.overtidsmat && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">OTM</span>}
                  {s.nattillegg && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">NATT</span>}
                  {s.helgetillegg && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">HELG</span>}
                  {!s.overtidsmat && !s.nattillegg && !s.helgetillegg && <span className="text-gray-300">–</span>}
                </div>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">{s.utlegg > 0 ? `${s.utlegg} kr` : "–"}</td>
              <td className="py-3 pr-4">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusFarge[s.status]}`}>
                  {t(`status.${s.status}`)}
                </span>
              </td>
              <td className="py-3">
                {s.status === "ventende" && (
                  <div className="flex gap-1">
                    <button className="rounded p-1 text-green-500 hover:bg-green-50" title={t("timer.godkjenn")}>
                      <Check className="h-4 w-4" />
                    </button>
                    <button className="rounded p-1 text-red-400 hover:bg-red-50" title={t("timer.avvis")}>
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dagsseddel-skjema                                                  */
/* ------------------------------------------------------------------ */

function DagsseddelSkjema({ t, onTilbake }: { t: (k: string) => string; onTilbake: () => void }) {
  const [dato, setDato] = useState(new Date().toISOString().slice(0, 10));
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

  // Auto-beregning
  const fordeling = useMemo(() => beregnOvertid(totaltimer), [totaltimer]);
  const autoOvertidsmat = totaltimer > OVERTIDSMAT_TERSKEL;
  const autoHelg = erHelg(dato);

  // Auto-foreslå tillegg ved endring
  useMemo(() => {
    if (autoOvertidsmat && !overtidsmat) setOvertidsmat(true);
    if (autoHelg && !helgetillegg) setHelgetillegg(true);
  }, [autoOvertidsmat, autoHelg]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSeksjon(id: string) {
    setÅpneSeksjoner((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Kopiér forrige dag */}
      <div className="mb-4 flex justify-end">
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Copy className="h-3.5 w-3.5" />
          {t("timer.kopierForrige")}
        </button>
      </div>

      <div className="space-y-6">
        {/* Dato */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("tabell.dato")}</label>
          <input
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
          />
        </div>

        {/* Arbeidstimer */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="mb-3 block text-sm font-medium text-gray-700">{t("timer.arbeidstimer")}</label>
          <div className="mb-3">
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={totaltimer}
              onChange={(e) => setTotaltimer(parseFloat(e.target.value) || 0)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold tabular-nums focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            />
            <span className="ml-2 text-sm text-gray-500">{t("timer.timer")}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">{t("timer.normaltid")}</div>
              <div className="text-lg font-semibold tabular-nums text-gray-900">{fordeling.normaltid}</div>
              <div className="text-[10px] text-gray-400">{t("timer.autoBeregnet")}</div>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <div className="text-xs text-amber-600">{t("timer.overtid50")}</div>
              <div className="text-lg font-semibold tabular-nums text-amber-700">{fordeling.overtid50}</div>
              <div className="text-[10px] text-amber-400">{t("timer.autoBeregnet")}</div>
            </div>
            <div className="rounded-lg bg-red-50 px-3 py-2">
              <div className="text-xs text-red-600">{t("timer.overtid100")}</div>
              <div className="text-lg font-semibold tabular-nums text-red-700">{fordeling.overtid100}</div>
              <div className="text-[10px] text-red-400">{t("timer.autoBeregnet")}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">{t("timer.dagsnorm")}: {DAGSNORM} {t("timer.timer")}</p>
        </div>

        {/* Reisetid */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("timer.reisetid")}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={reisetid}
              onChange={(e) => setReisetid(parseFloat(e.target.value) || 0)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            />
            <span className="text-sm text-gray-500">{t("timer.timer")}</span>
          </div>
        </div>

        {/* Tillegg */}
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="mb-3 text-sm font-medium text-gray-700">{t("timer.tillegg")}</div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={overtidsmat} onChange={(e) => setOvertidsmat(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary" />
              <span className="text-sm text-gray-700">{t("timer.overtidsmat")}</span>
              {autoOvertidsmat && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">auto: &gt;{OVERTIDSMAT_TERSKEL}t</span>}
            </label>
            <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={nattillegg} onChange={(e) => setNattillegg(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary" />
              <span className="text-sm text-gray-700">{t("timer.nattillegg")}</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={helgetillegg} onChange={(e) => setHelgetillegg(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary" />
              <span className="text-sm text-gray-700">{t("timer.helgetillegg")}</span>
              {autoHelg && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">auto: helg</span>}
            </label>
          </div>
        </div>

        {/* Maskiner (sammenleggbar) */}
        <SammenleggbarSeksjon
          tittel={t("timer.maskiner")}
          antall={maskiner.length}
          åpen={åpneSeksjoner.maskiner ?? false}
          onToggle={() => toggleSeksjon("maskiner")}
        >
          {maskiner.map((m, i) => (
            <div key={m.id} className="mb-2 flex items-center gap-2">
              <select value={m.maskin} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, maskin: e.target.value }; setMaskiner(ny); }} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">{t("timer.maskiner")}...</option>
                {DEMO_MASKINER.map((dm) => <option key={dm} value={dm}>{dm}</option>)}
              </select>
              <input type="number" step="0.5" min="0" value={m.timer} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, timer: parseFloat(e.target.value) || 0 }; setMaskiner(ny); }} className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm tabular-nums" placeholder={t("timer.timer")} />
              <input type="text" value={m.mengde} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, mengde: e.target.value }; setMaskiner(ny); }} className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("timer.mengde")} />
              <select value={m.enhet} onChange={(e) => { const ny = [...maskiner]; ny[i] = { ...m, enhet: e.target.value }; setMaskiner(ny); }} className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm">
                {DEMO_ENHETER.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={() => setMaskiner(maskiner.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={() => setMaskiner([...maskiner, { id: genId(), maskin: "", timer: 0, mengde: "", enhet: "m³" }])} className="inline-flex items-center gap-1 text-sm text-sitedoc-secondary hover:text-sitedoc-primary">
            <Plus className="h-3.5 w-3.5" />{t("handling.leggTil")}
          </button>
        </SammenleggbarSeksjon>

        {/* Materialer (sammenleggbar) */}
        <SammenleggbarSeksjon
          tittel={t("timer.materialer")}
          antall={materialer.length}
          åpen={åpneSeksjoner.materialer ?? false}
          onToggle={() => toggleSeksjon("materialer")}
        >
          {materialer.map((m, i) => (
            <div key={m.id} className="mb-2 flex items-center gap-2">
              <input type="text" value={m.navn} onChange={(e) => { const ny = [...materialer]; ny[i] = { ...m, navn: e.target.value }; setMaterialer(ny); }} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("tabell.navn")} />
              <input type="text" value={m.mengde} onChange={(e) => { const ny = [...materialer]; ny[i] = { ...m, mengde: e.target.value }; setMaterialer(ny); }} className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("timer.mengde")} />
              <select value={m.enhet} onChange={(e) => { const ny = [...materialer]; ny[i] = { ...m, enhet: e.target.value }; setMaterialer(ny); }} className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm">
                {DEMO_ENHETER.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={() => setMaterialer(materialer.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={() => setMaterialer([...materialer, { id: genId(), navn: "", mengde: "", enhet: "m³" }])} className="inline-flex items-center gap-1 text-sm text-sitedoc-secondary hover:text-sitedoc-primary">
            <Plus className="h-3.5 w-3.5" />{t("handling.leggTil")}
          </button>
        </SammenleggbarSeksjon>

        {/* Utlegg (sammenleggbar) */}
        <SammenleggbarSeksjon
          tittel={t("timer.utlegg")}
          antall={utlegg.length}
          åpen={åpneSeksjoner.utlegg ?? false}
          onToggle={() => toggleSeksjon("utlegg")}
        >
          {utlegg.map((u, i) => (
            <div key={u.id} className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <select value={u.kategori} onChange={(e) => { const ny = [...utlegg]; ny[i] = { ...u, kategori: e.target.value }; setUtlegg(ny); }} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
                  <option value="">{t("timer.kategori")}...</option>
                  {DEMO_KATEGORIER.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input type="number" min="0" value={u.belop} onChange={(e) => { const ny = [...utlegg]; ny[i] = { ...u, belop: e.target.value }; setUtlegg(ny); }} className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm tabular-nums" placeholder={t("timer.beloep")} />
                <span className="text-sm text-gray-500">kr</span>
                <button onClick={() => setUtlegg(utlegg.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={u.notat} onChange={(e) => { const ny = [...utlegg]; ny[i] = { ...u, notat: e.target.value }; setUtlegg(ny); }} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t("timer.notat")} />
                <button className="inline-flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700">
                  <Camera className="h-3.5 w-3.5" />
                  {t("timer.kvittering")}
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
          <textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            placeholder="Graving + kantstein langs innkjørselen..."
          />
        </div>

        {/* Knapper */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <button onClick={onTilbake} className="text-sm text-gray-500 hover:text-gray-700">
            {t("handling.avbryt")}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            {t("handling.lagre")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sammenleggbar seksjon                                              */
/* ------------------------------------------------------------------ */

function SammenleggbarSeksjon({
  tittel,
  antall,
  åpen,
  onToggle,
  children,
}: {
  tittel: string;
  antall: number;
  åpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
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
