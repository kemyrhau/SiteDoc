"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown, X, Settings, FileSearch, Loader2, Search, Filter, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SpecPost {
  id: string;
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: unknown;
  enhetspris: unknown;
  sumAnbud: unknown;
  mengdeDenne?: unknown;
  mengdeTotal?: unknown;
  mengdeForrige?: unknown;
  verdiDenne?: unknown;
  verdiTotal?: unknown;
  verdiForrige?: unknown;
  prosentFerdig?: unknown;
  nsKode: string | null;
  nsTittel: string | null;
  fullNsTekst: string | null;
  eksternNotat: string | null;
  importNotat: string | null;
}

interface SpecPostTabellProps {
  poster: SpecPost[];
  sammenligningPoster?: SpecPost[];
  sammenligningLabel?: string;
  onVelgPost: (postId: string) => void;
  valgtPostId: string | null;
  prosjektId?: string;
  kontraktId?: string | null;
}

// NS 3420-koder: bokstaver + tall/punktum (FH2.21, AM3.861A) eller korte koder (AZA)
const NS_KODE_PAT = /^([A-Z]{1,3}\d[\w.]*[A-Z]?|[A-Z]{2,3})\s/;
const NS_KODE_EKSKLUDER = new Set(["RS", "RG", "RD", "RE", "RF", "IF", "OR", "OK", "NY", "SE", "ER", "EN", "ET", "EL", "DE"]);

function finnNsKode(
  post: SpecPost,
  poster: SpecPost[],
): { nsKode: string; kilde: "egen" | "beskrivelse" | "arvet"; postnr?: string; sub?: string | null } | null {
  if (post.nsKode) return { nsKode: post.nsKode, kilde: "egen", sub: post.nsTittel };
  const egenMatch = post.beskrivelse ? NS_KODE_PAT.exec(post.beskrivelse) : null;
  if (egenMatch && egenMatch[1]!.length <= 15 && !NS_KODE_EKSKLUDER.has(egenMatch[1]!)) {
    return { nsKode: egenMatch[1]!, kilde: "beskrivelse", sub: null };
  }
  const arvet = finnArvetNsKode(post.postnr, poster);
  return arvet ? { nsKode: arvet.nsKode, kilde: "arvet", postnr: arvet.postnr } : null;
}

function finnArvetNsKode(
  postnr: string | null,
  poster: SpecPost[],
): { nsKode: string; postnr: string } | null {
  if (!postnr) return null;
  const deler = postnr.split(".");
  for (let i = deler.length - 1; i >= 2; i--) {
    const parentPostnr = deler.slice(0, i).join(".");
    const forelder = poster.find((p) => p.postnr === parentPostnr);
    if (!forelder) continue;
    if (forelder.nsKode) return { nsKode: forelder.nsKode, postnr: forelder.postnr! };
    const m = forelder.beskrivelse ? NS_KODE_PAT.exec(forelder.beskrivelse) : null;
    if (m && m[1]!.length <= 15 && !NS_KODE_EKSKLUDER.has(m[1]!)) {
      return { nsKode: m[1]!, postnr: forelder.postnr! };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Kolonnedefinisjon
// ---------------------------------------------------------------------------

type Gruppe = "fast" | "mengder" | "verdi";
type KolType = "tekst" | "tall" | "enhet";

interface KolonneDef {
  id: string;
  label: string;
  gruppe: Gruppe;
  type: KolType;
  bredde?: string;
  hentVerdi: (rad: SammenlignetRad) => unknown;
  /** Tilgjengelig selv uten nota-sammenligning */
  alltidSynlig?: boolean;
  synligDefault?: boolean;
}

interface SammenlignetRad {
  budsjett: SpecPost;
  nota: SpecPost | null;
  erSeksjon: boolean;
  mengdeAnbud: number;
  mengdeForrige: number;
  mengdeDenne: number;
  mengdeTotal: number;
  enhetspris: number;
  sumAnbud: number;
  verdiForrige: number;
  verdiDenne: number;
  verdiTotal: number;
  prosentFerdig: number;
  sumAvvik: number;
}

const ALLE_KOLONNER: KolonneDef[] = [
  // Fast
  { id: "postnr", label: "Postnr", gruppe: "fast", type: "tekst", bredde: "min-w-[100px]", alltidSynlig: true, synligDefault: true, hentVerdi: (r) => r.budsjett.postnr },
  { id: "beskrivelse", label: "Beskrivelse", gruppe: "fast", type: "tekst", bredde: "min-w-[200px]", alltidSynlig: true, synligDefault: true, hentVerdi: (r) => r.budsjett.beskrivelse },
  // Mengder (blå)
  { id: "m_anbudet", label: "Anbudet", gruppe: "mengder", type: "tall", bredde: "min-w-[80px]", alltidSynlig: true, synligDefault: true, hentVerdi: (r) => r.mengdeAnbud },
  { id: "m_enh", label: "Enh", gruppe: "mengder", type: "enhet", bredde: "min-w-[45px]", alltidSynlig: true, synligDefault: true, hentVerdi: (r) => r.budsjett.enhet },
  { id: "m_forrige", label: "Tot. forrige", gruppe: "mengder", type: "tall", bredde: "min-w-[80px]", synligDefault: true, hentVerdi: (r) => r.mengdeForrige ?? null },
  { id: "m_denne", label: "Denne per.", gruppe: "mengder", type: "tall", bredde: "min-w-[80px]", synligDefault: true, hentVerdi: (r) => r.mengdeDenne },
  { id: "m_totalt", label: "Totalt", gruppe: "mengder", type: "tall", bredde: "min-w-[80px]", synligDefault: true, hentVerdi: (r) => r.mengdeTotal },
  // Enhetspris (mellom grupper)
  { id: "enhetspris", label: "Enhetspris", gruppe: "fast", type: "tall", bredde: "min-w-[90px]", alltidSynlig: true, synligDefault: true, hentVerdi: (r) => r.enhetspris },
  // Verdi (grønn)
  { id: "v_anbudet", label: "Anbudet", gruppe: "verdi", type: "tall", bredde: "min-w-[90px]", alltidSynlig: true, synligDefault: true, hentVerdi: (r) => r.sumAnbud },
  { id: "v_forrige", label: "Tot. forrige", gruppe: "verdi", type: "tall", bredde: "min-w-[90px]", synligDefault: true, hentVerdi: (r) => r.verdiForrige ?? null },
  { id: "v_denne", label: "Denne per.", gruppe: "verdi", type: "tall", bredde: "min-w-[90px]", synligDefault: true, hentVerdi: (r) => r.verdiDenne },
  { id: "v_totalt", label: "Totalt", gruppe: "verdi", type: "tall", bredde: "min-w-[90px]", synligDefault: true, hentVerdi: (r) => r.verdiTotal },
  { id: "v_prosent", label: "%", gruppe: "verdi", type: "tall", bredde: "min-w-[50px]", synligDefault: true, hentVerdi: (r) => r.prosentFerdig },
];

const GRUPPE_FARGE: Record<Gruppe, string> = {
  fast: "",
  mengder: "border-t-2 border-t-blue-400",
  verdi: "border-t-2 border-t-emerald-400",
};

const GRUPPE_LABEL: Record<Gruppe, string> = {
  fast: "",
  mengder: "Mengder",
  verdi: "Verdi",
};

const GRUPPE_TEKST: Record<Gruppe, string> = {
  fast: "",
  mengder: "text-blue-600",
  verdi: "text-emerald-600",
};

// ---------------------------------------------------------------------------
// Seksjonsoverskrift-deteksjon
// ---------------------------------------------------------------------------

function byggSeksjonsSet(poster: SpecPost[]): Set<string> {
  const sett = new Set<string>();
  const postnrSet = new Set(poster.map((p) => p.postnr).filter(Boolean) as string[]);

  for (const p of poster) {
    if (!p.postnr) continue;
    // Har enhet → er en ekte post
    if (p.enhet && p.enhet.trim()) continue;
    // Har ingen verdi → seksjon
    const harVerdi = Number(p.mengdeAnbud ?? 0) !== 0 || Number(p.sumAnbud ?? 0) !== 0;
    // Sjekk om minst 2 barn finnes
    let barnMedVerdi = 0;
    for (const q of poster) {
      if (q.postnr && q.postnr !== p.postnr && q.postnr.startsWith(p.postnr + ".")) {
        barnMedVerdi++;
        if (barnMedVerdi >= 2) break;
      }
    }
    if (barnMedVerdi >= 2 && !harVerdi) {
      sett.add(p.postnr);
    }
  }
  return sett;
}

// ---------------------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------------------

export function SpecPostTabell({
  poster,
  sammenligningPoster,
  sammenligningLabel,
  onVelgPost,
  valgtPostId,
  prosjektId,
  kontraktId,
}: SpecPostTabellProps) {
  // DEBUG: Minimal rendering for å isolere krasj
  return (
    <div className="p-4 text-sm">
      <div>Poster: {poster.length}</div>
      <div>Sammenligning: {sammenligningPoster?.length ?? "ingen"}</div>
      {poster.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Første post: {String(poster[0]?.postnr)} — {String(poster[0]?.beskrivelse?.substring(0, 50))}
        </div>
      )}
    </div>
  );
  // Sanitiser poster — fjern eventuelle sub-objekter og konverter Decimal til Number
  const sanitiserPost = (p: SpecPost): SpecPost => ({
    id: p.id,
    postnr: p.postnr,
    beskrivelse: p.beskrivelse,
    enhet: p.enhet,
    mengdeAnbud: p.mengdeAnbud != null ? Number(p.mengdeAnbud) : null,
    enhetspris: p.enhetspris != null ? Number(p.enhetspris) : null,
    sumAnbud: p.sumAnbud != null ? Number(p.sumAnbud) : null,
    mengdeDenne: p.mengdeDenne != null ? Number(p.mengdeDenne) : null,
    mengdeTotal: p.mengdeTotal != null ? Number(p.mengdeTotal) : null,
    mengdeForrige: p.mengdeForrige != null ? Number(p.mengdeForrige) : null,
    verdiDenne: p.verdiDenne != null ? Number(p.verdiDenne) : null,
    verdiTotal: p.verdiTotal != null ? Number(p.verdiTotal) : null,
    verdiForrige: p.verdiForrige != null ? Number(p.verdiForrige) : null,
    prosentFerdig: p.prosentFerdig != null ? Number(p.prosentFerdig) : null,
    nsKode: p.nsKode,
    nsTittel: p.nsTittel,
    fullNsTekst: p.fullNsTekst,
    eksternNotat: p.eksternNotat,
    importNotat: p.importNotat,
  });
  poster = poster.map(sanitiserPost);
  if (sammenligningPoster) sammenligningPoster = sammenligningPoster.map(sanitiserPost);

  const harSammenligning = !!sammenligningPoster && sammenligningPoster.length > 0;

  // Kolonne-state
  const [kolonneRekkefølge, setKolonneRekkefølge] = useState<string[]>(() =>
    ALLE_KOLONNER.map((k) => k.id),
  );
  const [synligeKolonner, setSynligeKolonner] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const k of ALLE_KOLONNER) {
      if (k.alltidSynlig || k.synligDefault) s.add(k.id);
    }
    return s;
  });

  // Sortering
  const [sorterKolId, setSorterKolId] = useState("postnr");
  const [sorterRetning, setSorterRetning] = useState<"asc" | "desc">("asc");

  // Søk og filter
  const [globaltSøk, setGlobaltSøk] = useState("");
  const [kolonneFiltre, setKolonneFiltre] = useState<Record<string, string>>({});
  const [aktivtFilter, setAktivtFilter] = useState<string | null>(null);

  // UI
  const [detaljPost, setDetaljPost] = useState<string | null>(null);
  const [visKolonneVelger, setVisKolonneVelger] = useState(false);
  const [overskridelseTerskel, setOverskridelseTerskel] = useState(120);
  const valgtRadRef = useRef<HTMLTableRowElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Lukk filter-dropdown ved klikk utenfor
  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setAktivtFilter(null);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  // NS 3420 dokumentasjon
  const alleNsKoder = useMemo(() => {
    const koder = new Set<string>();
    for (const p of poster) {
      const info = finnNsKode(p, poster);
      if (info) koder.add(info.nsKode);
    }
    return Array.from(koder);
  }, [poster]);

  const { data: nsKoderMedDok } = trpc.ftdSok.nsKoderMedDok.useQuery(
    { projectId: prosjektId!, nsKoder: alleNsKoder },
    { enabled: !!prosjektId && alleNsKoder.length > 0 },
  );
  const nsDocSet = useMemo(() => new Set(nsKoderMedDok ?? []), [nsKoderMedDok]);

  // Seksjonsoverskrifter
  const seksjonsSet = useMemo(() => byggSeksjonsSet(poster), [poster]);

  // Nota-map
  const notaMap = useMemo(() => {
    if (!sammenligningPoster) return new Map<string, SpecPost>();
    const map = new Map<string, SpecPost>();
    for (const p of sammenligningPoster) {
      if (p.postnr) map.set(p.postnr, p);
    }
    return map;
  }, [sammenligningPoster]);

  // Enheter for filter-dropdown
  const enheter = useMemo(() => {
    const s = new Set<string>();
    for (const p of poster) {
      if (p.enhet?.trim()) s.add(p.enhet.trim());
    }
    return Array.from(s).sort();
  }, [poster]);

  // Bygg rader
  const rader: SammenlignetRad[] = useMemo(() => {
    return poster.map((budsjett) => {
      const nota = budsjett.postnr ? (notaMap.get(budsjett.postnr) ?? null) : null;
      const mengdeAnbud = Number(budsjett.mengdeAnbud ?? 0);
      const mengdeDenne = nota ? Number(nota.mengdeDenne ?? 0) : 0;
      const mengdeTotal = nota ? Number(nota.mengdeTotal ?? 0) : 0;
      const mengdeForrige = nota && nota.mengdeForrige != null ? Number(nota.mengdeForrige) : mengdeTotal - mengdeDenne;
      const enhetspris = Number(budsjett.enhetspris ?? 0);
      const sumAnbud = Number(budsjett.sumAnbud ?? 0);
      const verdiDenne = nota ? Number(nota.verdiDenne ?? 0) : 0;
      const verdiTotal = nota ? Number(nota.verdiTotal ?? 0) : 0;
      const verdiForrige = nota && nota.verdiForrige != null ? Number(nota.verdiForrige) : verdiTotal - verdiDenne;
      const prosentFerdig = nota ? Number(nota.prosentFerdig ?? 0) : 0;
      const erSeksjon = !!budsjett.postnr && seksjonsSet.has(budsjett.postnr);

      return {
        budsjett, nota, erSeksjon,
        mengdeAnbud, mengdeForrige, mengdeDenne, mengdeTotal,
        enhetspris, sumAnbud,
        verdiForrige, verdiDenne, verdiTotal,
        prosentFerdig,
        sumAvvik: verdiTotal - sumAnbud,
      };
    });
  }, [poster, notaMap, seksjonsSet]);

  // Aktive kolonner i riktig rekkefølge
  const aktiveKolonner = useMemo(() => {
    return kolonneRekkefølge
      .map((id) => ALLE_KOLONNER.find((k) => k.id === id)!)
      .filter((k) => k && synligeKolonner.has(k.id))
      .filter((k) => {
        // Skjul nota-kolonner hvis ingen sammenligning
        if (!harSammenligning && !k.alltidSynlig) return false;
        return true;
      });
  }, [kolonneRekkefølge, synligeKolonner, harSammenligning]);

  // Filtrering
  const filtrerteRader = useMemo(() => {
    let resultat = rader;

    // Globalt søk
    if (globaltSøk.trim()) {
      const søk = globaltSøk.toLowerCase();
      resultat = resultat.filter((r) => {
        const postnr = (r.budsjett.postnr ?? "").toLowerCase();
        const besk = (r.budsjett.beskrivelse ?? "").toLowerCase();
        return postnr.includes(søk) || besk.includes(søk);
      });
    }

    // Per-kolonne filter
    for (const [kolId, filterVerdi] of Object.entries(kolonneFiltre)) {
      if (!filterVerdi.trim()) continue;
      const kol = ALLE_KOLONNER.find((k) => k.id === kolId);
      if (!kol) continue;

      if (kol.type === "enhet") {
        resultat = resultat.filter((r) => {
          const v = String(kol.hentVerdi(r) ?? "");
          return v === filterVerdi;
        });
      } else if (kol.type === "tekst") {
        const søk = filterVerdi.toLowerCase();
        resultat = resultat.filter((r) => {
          const v = String(kol.hentVerdi(r) ?? "").toLowerCase();
          return v.includes(søk);
        });
      } else {
        // Tall: støtt ">" "<" "min-maks"
        const v = filterVerdi.trim();
        if (v.startsWith(">")) {
          const grense = parseFloat(v.slice(1).replace(",", "."));
          if (!isNaN(grense)) resultat = resultat.filter((r) => Number(kol.hentVerdi(r) ?? 0) > grense);
        } else if (v.startsWith("<")) {
          const grense = parseFloat(v.slice(1).replace(",", "."));
          if (!isNaN(grense)) resultat = resultat.filter((r) => Number(kol.hentVerdi(r) ?? 0) < grense);
        } else if (v.includes("-") && !v.startsWith("-")) {
          const [minS, maksS] = v.split("-");
          const min = parseFloat((minS ?? "").replace(",", "."));
          const maks = parseFloat((maksS ?? "").replace(",", "."));
          if (!isNaN(min) && !isNaN(maks)) {
            resultat = resultat.filter((r) => {
              const n = Number(kol.hentVerdi(r) ?? 0);
              return n >= min && n <= maks;
            });
          }
        }
      }
    }

    return resultat;
  }, [rader, globaltSøk, kolonneFiltre]);

  // Sortering
  const sorterteRader = useMemo(() => {
    const kol = ALLE_KOLONNER.find((k) => k.id === sorterKolId);
    if (!kol) return filtrerteRader;

    return [...filtrerteRader].sort((a, b) => {
      const aVal = kol.hentVerdi(a);
      const bVal = kol.hentVerdi(b);
      if (aVal === null || aVal === undefined || aVal === "") return 1;
      if (bVal === null || bVal === undefined || bVal === "") return -1;

      if (kol.type === "tall") {
        const diff = Number(aVal) - Number(bVal);
        return sorterRetning === "asc" ? diff : -diff;
      }
      const cmp = String(aVal).localeCompare(String(bVal), "nb-NO", { numeric: true });
      return sorterRetning === "asc" ? cmp : -cmp;
    });
  }, [filtrerteRader, sorterKolId, sorterRetning]);

  // Piltast-navigering
  const navigerRad = useCallback(
    (retning: "opp" | "ned") => {
      if (!valgtPostId || !sorterteRader.length) return;
      const idx = sorterteRader.findIndex((r) => r.budsjett.id === valgtPostId);
      if (idx === -1) return;
      const nyIdx = retning === "opp" ? Math.max(0, idx - 1) : Math.min(sorterteRader.length - 1, idx + 1);
      if (nyIdx !== idx) onVelgPost(sorterteRader[nyIdx]!.budsjett.id);
    },
    [valgtPostId, sorterteRader, onVelgPost],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowUp") { e.preventDefault(); navigerRad("opp"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); navigerRad("ned"); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigerRad]);

  useEffect(() => {
    valgtRadRef.current?.scrollIntoView({ block: "nearest" });
  }, [valgtPostId]);

  function toggleSortering(kolId: string) {
    if (sorterKolId === kolId) setSorterRetning((r) => (r === "asc" ? "desc" : "asc"));
    else { setSorterKolId(kolId); setSorterRetning("asc"); }
  }

  function settFilter(kolId: string, verdi: string) {
    setKolonneFiltre((prev) => ({ ...prev, [kolId]: verdi }));
  }

  function toggleKolonne(kolId: string) {
    setSynligeKolonner((prev) => {
      const ny = new Set(prev);
      if (ny.has(kolId)) ny.delete(kolId);
      else ny.add(kolId);
      return ny;
    });
  }

  if (poster.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Ingen poster funnet. Importer anbudsgrunnlag for å komme i gang.
      </div>
    );
  }

  // Totaler (ekskluder seksjonsoverskrifter)
  const totalRader = sorterteRader.filter((r) => !r.erSeksjon);
  const totalBudsjett = totalRader.reduce((s, r) => s + r.sumAnbud, 0);
  const totalVerdiDenne = totalRader.reduce((s, r) => s + r.verdiDenne, 0);
  const totalVerdiTotal = totalRader.reduce((s, r) => s + r.verdiTotal, 0);

  // Grupperte headers for topp-rad
  const gruppeSpan = useMemo(() => {
    const spans: Array<{ gruppe: Gruppe; antall: number }> = [];
    for (const kol of aktiveKolonner) {
      const siste = spans[spans.length - 1];
      if (siste && siste.gruppe === kol.gruppe) {
        siste.antall++;
      } else {
        spans.push({ gruppe: kol.gruppe, antall: 1 });
      }
    }
    return spans;
  }, [aktiveKolonner]);

  return (
    <div className="flex h-full flex-col rounded border overflow-hidden">
      {/* Globalt søk + innstillinger */}
      <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-1.5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={globaltSøk}
            onChange={(e) => setGlobaltSøk(e.target.value)}
            placeholder="Søk postnr / beskrivelse..."
            className="w-full rounded border border-gray-300 bg-white py-1 pl-7 pr-2 text-xs focus:border-sitedoc-primary focus:outline-none"
          />
          {globaltSøk && (
            <button onClick={() => setGlobaltSøk("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          {filtrerteRader.length !== rader.length && (
            <span className="text-blue-600">{filtrerteRader.length} av {rader.length}</span>
          )}
        </div>
        {harSammenligning && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setOverskridelseTerskel((t) => t === 120 ? 100 : 120)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="text-gray-400">{overskridelseTerskel}%</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50">
            {/* Gruppe-header (Mengder / Verdi) */}
            <tr className="border-b">
              <th className="w-[36px] px-1 py-1" />
              {gruppeSpan.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.antall}
                  className={`px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider ${GRUPPE_TEKST[g.gruppe]} ${GRUPPE_FARGE[g.gruppe]}`}
                >
                  {GRUPPE_LABEL[g.gruppe]}
                </th>
              ))}
              <th className="w-[28px] px-0 py-1" />
            </tr>
            {/* Kolonne-headers med sortering og filter */}
            <tr className="border-b">
              <th className="w-[36px] px-1 py-1.5 text-[10px] text-gray-400">#</th>
              {aktiveKolonner.map((kol) => (
                <th
                  key={kol.id}
                  className={`relative px-2 py-1.5 ${kol.bredde ?? ""} ${kol.type === "tall" ? "text-right" : ""}`}
                >
                  <div className="flex items-center gap-0.5">
                    {kol.type === "tall" && <span className="flex-1" />}
                    <button
                      onClick={() => toggleSortering(kol.id)}
                      className={`inline-flex items-center gap-0.5 text-[11px] font-medium uppercase hover:text-gray-700 ${
                        sorterKolId === kol.id ? "text-sitedoc-primary" : "text-gray-500"
                      }`}
                    >
                      {kol.label}
                      {sorterKolId === kol.id ? (
                        sorterRetning === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : null}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAktivtFilter(aktivtFilter === kol.id ? null : kol.id); }}
                      className={`ml-0.5 rounded p-0.5 hover:bg-gray-200 ${
                        kolonneFiltre[kol.id]?.trim() ? "text-blue-600" : "text-gray-300 hover:text-gray-500"
                      }`}
                    >
                      <Filter className="h-3 w-3" />
                    </button>
                  </div>
                  {/* Filter-dropdown */}
                  {aktivtFilter === kol.id && (
                    <div ref={filterRef} className="absolute left-0 top-full z-20 mt-0.5 w-48 rounded-lg border bg-white p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
                      {kol.type === "enhet" ? (
                        <div className="max-h-40 space-y-0.5 overflow-auto">
                          <button
                            onClick={() => { settFilter(kol.id, ""); setAktivtFilter(null); }}
                            className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-50 ${!kolonneFiltre[kol.id] ? "font-medium text-blue-600" : ""}`}
                          >
                            Alle
                          </button>
                          {enheter.map((e) => (
                            <button
                              key={e}
                              onClick={() => { settFilter(kol.id, e); setAktivtFilter(null); }}
                              className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-50 ${kolonneFiltre[kol.id] === e ? "font-medium text-blue-600" : ""}`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      ) : kol.type === "tekst" ? (
                        <input
                          type="text"
                          value={kolonneFiltre[kol.id] ?? ""}
                          onChange={(e) => settFilter(kol.id, e.target.value)}
                          placeholder={`Søk ${kol.label.toLowerCase()}...`}
                          className="w-full rounded border px-2 py-1 text-xs focus:border-sitedoc-primary focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={kolonneFiltre[kol.id] ?? ""}
                            onChange={(e) => settFilter(kol.id, e.target.value)}
                            placeholder=">100  <50  10-200"
                            className="w-full rounded border px-2 py-1 text-xs focus:border-sitedoc-primary focus:outline-none"
                            autoFocus
                          />
                          <div className="text-[10px] text-gray-400">{">"}N, {"<"}N, eller min-maks</div>
                        </div>
                      )}
                      {kolonneFiltre[kol.id]?.trim() && (
                        <button
                          onClick={() => { settFilter(kol.id, ""); setAktivtFilter(null); }}
                          className="mt-1 w-full rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-200"
                        >
                          Fjern filter
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}
              {/* Kolonne-velger */}
              <th className="w-[28px] px-0 py-1.5">
                <div className="relative">
                  <button
                    onClick={() => setVisKolonneVelger(!visKolonneVelger)}
                    className="flex items-center justify-center rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    title="Vis/skjul kolonner"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {visKolonneVelger && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border bg-white py-1 shadow-lg">
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase text-gray-400">Mengder</div>
                      {ALLE_KOLONNER.filter((k) => k.gruppe === "mengder").map((k) => (
                        <label key={k.id} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-xs hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={synligeKolonner.has(k.id)}
                            onChange={() => toggleKolonne(k.id)}
                            className="h-3 w-3 rounded border-gray-300"
                            disabled={k.alltidSynlig}
                          />
                          {k.label}
                        </label>
                      ))}
                      <div className="mt-1 border-t px-3 py-1 text-[10px] font-semibold uppercase text-gray-400">Verdi</div>
                      {ALLE_KOLONNER.filter((k) => k.gruppe === "verdi").map((k) => (
                        <label key={k.id} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-xs hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={synligeKolonner.has(k.id)}
                            onChange={() => toggleKolonne(k.id)}
                            className="h-3 w-3 rounded border-gray-300"
                          />
                          {k.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorterteRader.map((rad, idx) => {
              const p = rad.budsjett;
              const erSeksjon = rad.erSeksjon;
              return (
                <tr
                  key={p.id}
                  ref={valgtPostId === p.id ? valgtRadRef : undefined}
                  onClick={() => onVelgPost(p.id)}
                  onDoubleClick={() => setDetaljPost(p.id)}
                  className={`cursor-pointer border-b transition-colors ${
                    valgtPostId === p.id
                      ? "bg-blue-100 border-l-2 border-l-sitedoc-primary"
                      : erSeksjon
                        ? "bg-gray-50/50"
                        : harSammenligning && rad.nota && rad.prosentFerdig > overskridelseTerskel
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-1 py-1 text-[10px] text-gray-400">{idx + 1}</td>
                  {aktiveKolonner.map((kol) => {
                    const verdi = kol.hentVerdi(rad);

                    // Postnr — spesialformatering med NS-kode prikk og importnotat
                    if (kol.id === "postnr") {
                      const nsInfo = finnNsKode(p, poster);
                      return (
                        <td key={kol.id} className={`px-2 py-1 font-mono whitespace-nowrap ${erSeksjon ? "italic text-gray-400" : ""}`}>
                          {p.importNotat && <span className="mr-1 text-amber-500" title={p.importNotat}>*</span>}
                          {nsInfo && nsDocSet.has(nsInfo.nsKode) && <span className="mr-1 text-amber-400" title={`NS 3420: ${nsInfo.nsKode}`}>●</span>}
                          {p.postnr ?? "—"}
                        </td>
                      );
                    }

                    // Beskrivelse — truncate
                    if (kol.id === "beskrivelse") {
                      return (
                        <td key={kol.id} className={`max-w-xs truncate px-2 py-1 ${erSeksjon ? "italic text-gray-400" : ""}`}>
                          {p.beskrivelse ?? "—"}
                        </td>
                      );
                    }

                    // Enhet
                    if (kol.type === "enhet") {
                      return (
                        <td key={kol.id} className={`px-2 py-1 ${erSeksjon ? "text-gray-400" : ""}`}>
                          {verdi ? String(verdi) : "—"}
                        </td>
                      );
                    }

                    // Tallkolonner — seksjonsoverskrifter viser "—"
                    const erNotaKol = !kol.alltidSynlig;
                    const harNotaData = !!rad.nota;
                    const visStrek = erSeksjon || (erNotaKol && !harNotaData);
                    const numVerdi = Number(verdi ?? 0);

                    // Prosent — spesiell formatering
                    if (kol.id === "v_prosent") {
                      return (
                        <td key={kol.id} className={`px-2 py-1 text-right font-mono ${
                          visStrek ? "text-gray-300" :
                          numVerdi > overskridelseTerskel ? "text-red-600 font-semibold" : "text-emerald-700"
                        }`}>
                          {visStrek ? "—" : fmt(numVerdi, 0)}
                        </td>
                      );
                    }

                    return (
                      <td key={kol.id} className={`px-2 py-1 text-right font-mono ${
                        visStrek ? "text-gray-300" :
                        erNotaKol ? "text-blue-700" : ""
                      }`}>
                        {visStrek ? "—" : fmt(numVerdi)}
                      </td>
                    );
                  })}
                  <td className="w-[28px]" />
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-50 border-t-2">
            <tr className="font-semibold text-xs">
              <td className="px-1 py-2" />
              {aktiveKolonner.map((kol) => {
                if (kol.id === "postnr") return <td key={kol.id} className="px-2 py-2" />;
                if (kol.id === "beskrivelse") return <td key={kol.id} className="px-2 py-2">Totalt ({totalRader.length} poster)</td>;
                if (kol.type !== "tall") return <td key={kol.id} className="px-2 py-2" />;

                // Summer
                if (kol.id === "v_anbudet") return <td key={kol.id} className="px-2 py-2 text-right font-mono">{fmt(totalBudsjett)}</td>;
                if (kol.id === "v_denne") return <td key={kol.id} className="px-2 py-2 text-right font-mono text-blue-700">{harSammenligning ? fmt(totalVerdiDenne) : ""}</td>;
                if (kol.id === "v_totalt") return <td key={kol.id} className="px-2 py-2 text-right font-mono text-blue-700">{harSammenligning ? fmt(totalVerdiTotal) : ""}</td>;
                if (kol.id === "v_forrige") return <td key={kol.id} className="px-2 py-2 text-right font-mono text-blue-700">{harSammenligning ? fmt(totalVerdiTotal - totalVerdiDenne) : ""}</td>;

                // Mengde-totaler
                const mengdeSumIds = ["m_anbudet", "m_denne", "m_totalt", "m_forrige"];
                if (mengdeSumIds.includes(kol.id)) {
                  const sum = totalRader.reduce((s, r) => s + Number(kol.hentVerdi(r) ?? 0), 0);
                  const erNota = !kol.alltidSynlig;
                  return <td key={kol.id} className={`px-2 py-2 text-right font-mono ${erNota ? "text-blue-700" : ""}`}>{sum ? fmt(sum) : ""}</td>;
                }

                return <td key={kol.id} className="px-2 py-2" />;
              })}
              <td className="w-[28px]" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detaljmodal */}
      {detaljPost && (() => {
        const rad = sorterteRader.find((r) => r.budsjett.id === detaljPost);
        if (!rad) return null;
        const p = rad.budsjett;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetaljPost(null)}>
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h2 className="text-base font-semibold">Post {p.postnr}</h2>
                <button onClick={() => setDetaljPost(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-5 space-y-4">
                <div>
                  <div className="mb-1 text-xs font-medium text-gray-500">Beskrivelse</div>
                  <div className="text-sm text-gray-800">{p.beskrivelse ?? "—"}</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Kort label="Mengde" verdi={fmt(p.mengdeAnbud)} />
                  <Kort label="Enhet" verdi={p.enhet ?? "—"} mono={false} />
                  <Kort label="Enhetspris" verdi={fmt(p.enhetspris)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Kort label="Sum anbud" verdi={fmt(p.sumAnbud)} bg="bg-blue-50" />
                  {(() => {
                    const nsInfo = finnNsKode(p, poster);
                    if (!nsInfo) return null;
                    return <Kort
                      label="NS-kode"
                      verdi={nsInfo.nsKode}
                      sub={nsInfo.kilde === "arvet" ? `Videreført fra post ${nsInfo.postnr}` : nsInfo.sub}
                      bg={nsInfo.kilde === "arvet" ? "bg-amber-50/50" : "bg-amber-50"}
                      mono={false}
                    />;
                  })()}
                </div>
                {harSammenligning && rad.nota && (
                  <div className="rounded border border-blue-200 bg-blue-50/50 p-3">
                    <div className="mb-2 text-xs font-medium text-blue-600">{sammenligningLabel}</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <Kort label="Mengde denne" verdi={fmt(rad.mengdeDenne)} compact />
                      <Kort label="Verdi denne" verdi={fmt(rad.verdiDenne)} compact />
                      <Kort label="Mengde totalt" verdi={fmt(rad.mengdeTotal)} compact />
                      <Kort label="Verdi totalt" verdi={fmt(rad.verdiTotal)} compact />
                    </div>
                    <div className={`mt-2 text-xs font-mono ${rad.sumAvvik > 0 ? "text-red-600" : rad.sumAvvik < 0 ? "text-green-600" : "text-gray-500"}`}>
                      Avvik: {fmt(rad.sumAvvik)} ({fmt(rad.prosentFerdig, 0)}% ferdig)
                    </div>
                  </div>
                )}
                {p.fullNsTekst && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">NS-spesifikasjon</div>
                    <div className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">{p.fullNsTekst}</div>
                  </div>
                )}
                {p.importNotat && (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-xs font-medium text-amber-700">Korrigert ved import</div>
                    <div className="text-xs text-amber-600">{p.importNotat}</div>
                  </div>
                )}
                {p.eksternNotat && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">Ekstern merknad</div>
                    <div className="text-sm text-gray-700">{p.eksternNotat}</div>
                  </div>
                )}
                {p.postnr && prosjektId && (() => {
                  const nsInfo = finnNsKode(p, poster);
                  return (
                    <DokumentasjonSeksjon
                      prosjektId={prosjektId}
                      kontraktId={kontraktId ?? null}
                      postnr={p.postnr}
                      nsKode={nsInfo?.nsKode ?? null}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hjelpefunksjoner
// ---------------------------------------------------------------------------

function Kort({ label, verdi, sub, bg, mono = true, compact }: {
  label: string; verdi: string; sub?: string | null; bg?: string; mono?: boolean; compact?: boolean;
}) {
  return (
    <div className={`rounded p-2 ${bg ?? "bg-gray-50"}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`${compact ? "text-xs" : "text-sm"} font-medium ${mono ? "font-mono" : ""}`}>{verdi}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

interface SplitKilde {
  filnavn: string;
  dokumentId: string;
  kildeSider: number[];
  startSide: number;
}

function DokumentasjonSeksjon({
  prosjektId,
  kontraktId,
  postnr,
  nsKode,
}: {
  prosjektId: string;
  kontraktId: string | null;
  postnr: string;
  nsKode: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: splitDok, isLoading } = (trpc.mengde.hentSplitDokumentasjon as any).useQuery(
    { projectId: prosjektId, kontraktId: kontraktId ?? undefined, nsKode: nsKode! },
    { enabled: !!nsKode },
  ) as { data: { id: string; filename: string; fileUrl: string | null; pageCount: number | null; splitSources: unknown } | null | undefined; isLoading: boolean };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kilder: SplitKilde[] = Array.isArray((splitDok as any)?.splitSources) ? (splitDok as any).splitSources : [];

  const apnePdf = (fileUrl: string | null, side?: number) => {
    if (!fileUrl) return;
    const url = side ? `/api${fileUrl}#page=${side}` : `/api${fileUrl}`;
    window.open(url, "_blank");
  };

  function fmtRange(start: number, antall: number): string {
    if (antall === 1) return `s.${start}`;
    return `s.${start}-${start + antall - 1}`;
  }

  function fmtKilde(filnavn: string): string {
    const m = /(\d+)\s*[Mm]ålebrev/i.exec(filnavn) || /a-nota\s*(\d+)/i.exec(filnavn);
    return m ? `A-nota ${m[1]}` : filnavn.replace(/\.pdf$/i, "");
  }

  return (
    <div className="rounded border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <FileSearch className="h-3.5 w-3.5" />
        Dokumentasjon{nsKode ? ` — ${nsKode}` : ` for post ${postnr}`}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Søker...
        </div>
      ) : !splitDok ? (
        <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-600">
          Ingen dokumentasjon funnet.
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => apnePdf(splitDok.fileUrl)}
            className="flex items-center gap-1.5 rounded bg-sitedoc-primary/10 px-2 py-1.5 text-xs font-medium text-sitedoc-primary hover:bg-sitedoc-primary/20 transition-colors"
          >
            <FileSearch className="h-3.5 w-3.5" />
            Åpne dokumentasjon ({splitDok.pageCount} sider)
          </button>
          {kilder.length > 0 && (
            <div className="space-y-1">
              {kilder.map((k, i) => (
                <button
                  key={i}
                  onClick={() => apnePdf(splitDok.fileUrl, k.startSide)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-50 transition-colors"
                  title={`Åpne side ${k.startSide}`}
                >
                  <span className="font-medium text-gray-700">{fmtKilde(k.filnavn)}</span>
                  <span className="font-mono text-gray-500">{fmtRange(k.startSide, k.kildeSider.length)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="text-[10px] text-gray-400">{splitDok.pageCount} sider fra {kilder.length} målebrev</div>
        </div>
      )}
    </div>
  );
}

function fmt(verdi: unknown, desimaler = 2): string {
  if (verdi === null || verdi === undefined) return "—";
  const num = Number(verdi);
  if (isNaN(num)) return "—";
  return num.toLocaleString("nb-NO", { minimumFractionDigits: desimaler, maximumFractionDigits: desimaler });
}
