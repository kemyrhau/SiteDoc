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
  const renePoster = poster.map(sanitiserPost);
  // @ts-ignore TS2589
  const reneSammenligningPoster: SpecPost[] | undefined = sammenligningPoster ? sammenligningPoster.map(sanitiserPost) : undefined;

  // @ts-ignore
  const harSammenligning = !!reneSammenligningPoster && reneSammenligningPoster.length > 0;

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
    for (const p of renePoster) {
      const info = finnNsKode(p, renePoster);
      if (info) koder.add(info.nsKode);
    }
    return Array.from(koder);
  }, [renePoster]);

  const { data: nsKoderMedDok } = trpc.ftdSok.nsKoderMedDok.useQuery(
    { projectId: prosjektId!, nsKoder: alleNsKoder },
    { enabled: !!prosjektId && alleNsKoder.length > 0 },
  );
  const nsDocSet = useMemo(() => new Set(nsKoderMedDok ?? []), [nsKoderMedDok]);

  // Seksjonsoverskrifter
  const seksjonsSet = useMemo(() => byggSeksjonsSet(renePoster), [renePoster]);

  // Nota-map
  const notaMap = useMemo(() => {
    // @ts-ignore
    if (!reneSammenligningPoster) return new Map<string, SpecPost>();
    const map = new Map<string, SpecPost>();
    for (const p of reneSammenligningPoster) {
      if (p.postnr) map.set(p.postnr, p);
    }
    return map;
  }, [reneSammenligningPoster]);

  // Enheter for filter-dropdown
  const enheter = useMemo(() => {
    const s = new Set<string>();
    for (const p of renePoster) {
      if (p.enhet?.trim()) s.add(p.enhet.trim());
    }
    return Array.from(s).sort();
  }, [renePoster]);

  // Bygg rader
  const rader: SammenlignetRad[] = useMemo(() => {
    return renePoster.map((budsjett) => {
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
  }, [renePoster, notaMap, seksjonsSet]);

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

  // Grupperte headers for topp-rad (MÅ være før early return for å unngå hooks-order-feil)
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

  if (renePoster.length === 0) {
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

  // DEBUG: Komplett tabell med sikker rendering — alle verdier via String()
  return (
    <div className="flex h-full flex-col rounded border overflow-hidden">
      <div className="border-b bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
        {sorterteRader.length} poster | {aktiveKolonner.length} kolonner
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="border-b">
              <th className="px-1 py-1 text-[10px]">#</th>
              {aktiveKolonner.map(k => <th key={k.id} className="px-2 py-1 text-[10px] font-medium">{k.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorterteRader.map((rad, idx) => (
              <tr key={rad.budsjett.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => onVelgPost(rad.budsjett.id)}>
                <td className="px-1 py-0.5 text-[10px] text-gray-400">{idx + 1}</td>
                {aktiveKolonner.map(kol => {
                  const v = kol.hentVerdi(rad);
                  return <td key={kol.id} className={`px-2 py-0.5 ${kol.type === "tall" ? "text-right font-mono" : ""}`}>
                    {v === null || v === undefined ? "—" : String(v)}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
