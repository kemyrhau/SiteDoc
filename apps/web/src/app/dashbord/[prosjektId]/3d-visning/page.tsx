"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import {
  Upload,
  Box,
  Waypoints,
  Loader2,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronDown,
  Trash2,
  Scissors,
  Palette,
  Layers,
  BarChart3,
  Mountain,
  FileUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

type Fane = "3d-modell" | "overflater" | "kutt-fyll";

interface TegningRad {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  ifcMetadata: unknown;
  building: { id: string; name: string } | null;
}

interface EgenskapVerdi {
  value: unknown;
  type?: string;
}

interface EgenskapGruppe {
  navn: string;
  egenskaper: Record<string, EgenskapVerdi>;
}

interface ValgtObjekt {
  localId: number;
  kategori: string | null;
  attributter: Record<string, EgenskapVerdi>;
  relasjoner: EgenskapGruppe[];
}

interface TreNode {
  category: string | null;
  localId: number | null;
  children?: TreNode[];
  utvidet?: boolean;
}

interface PunktSkyRad {
  id: string;
  name: string;
  fileType: string;
  pointCount: number | null;
  conversionStatus: string;
  conversionError: string | null;
  potreeUrl: string | null;
  hasClassification: boolean;
  hasRgb: boolean;
  classifications: unknown;
  boundingBox: unknown;
  building: { id: string; name: string } | null;
}

interface KlassifiseringRad {
  kode: number;
  navn: string;
  antall: number;
}

type Fargemodus = "klassifisering" | "rgb" | "intensitet" | "hoyde";

interface OverflateData {
  id: string;
  navn: string;
  kilde: "landxml" | "punktsky";
  vertices: Float64Array;
  triangles: Uint32Array;
  bbox: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
}

/* ------------------------------------------------------------------ */
/*  Klassifiseringskoder og farger (ASPRS)                              */
/* ------------------------------------------------------------------ */

const KLASSE_FARGER: Record<number, string> = {
  0: "#999999", 1: "#cccccc", 2: "#8B4513", 3: "#90EE90",
  4: "#32CD32", 5: "#006400", 6: "#FF0000", 7: "#FF69B4",
  8: "#FFD700", 9: "#0000FF", 10: "#808080", 11: "#A9A9A9",
  12: "#DDA0DD", 13: "#FFA500", 14: "#FF8C00", 15: "#8B0000",
  16: "#FF4500", 17: "#696969", 18: "#FF1493",
};

const KLASSE_NAVN: Record<number, string> = {
  0: "Aldri klassifisert", 1: "Uklassifisert", 2: "Bakke",
  3: "Lav vegetasjon", 4: "Middels vegetasjon", 5: "Høy vegetasjon",
  6: "Bygning", 7: "Støy (lav)", 8: "Nøkkelpunkt",
  9: "Vann", 10: "Jernbane", 11: "Veioverflate",
  12: "Overlapp", 13: "Ledning (vern)", 14: "Ledning (leder)",
  15: "Sendemast", 16: "Ledningskobling", 17: "Bro", 18: "Støy (høy)",
};

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

/** Hjelpefunksjon for å parse LandXML og opprette OverflateData */
async function parseLandXMLFil(fil: File): Promise<OverflateData> {
  const tekst = await fil.text();
  const { parseLandXML } = await import("@/lib/landxml-parser");
  const tin = await parseLandXML(tekst);

  return {
    id: crypto.randomUUID(),
    navn: tin.navn ?? fil.name.replace(/\.[^.]+$/, ""),
    kilde: "landxml",
    vertices: tin.vertices,
    triangles: tin.triangles,
    bbox: tin.bbox,
  };
}

export default function TreDVisning() {
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const [aktivFane, setAktivFane] = useState<Fane>("3d-modell");

  // Delt overflate-state mellom fane 2 og 3
  const [overflater, setOverflater] = useState<OverflateData[]>([]);

  const leggTilOverflate = useCallback((o: OverflateData) => {
    setOverflater((prev) => [...prev, o]);
  }, []);

  const fjernOverflate = useCallback((id: string) => {
    setOverflater((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const faner: { id: Fane; label: string; ikon: JSX.Element }[] = [
    { id: "3d-modell", label: "3D-modell", ikon: <Box className="h-4 w-4" /> },
    { id: "overflater", label: "Overflater", ikon: <Mountain className="h-4 w-4" /> },
    { id: "kutt-fyll", label: "Kutt/fyll", ikon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Fane-bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-4">
        {faner.map((fane) => (
          <button
            key={fane.id}
            onClick={() => setAktivFane(fane.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              aktivFane === fane.id
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {fane.ikon}
            {fane.label}
          </button>
        ))}
      </div>

      {/* Fane-innhold */}
      <div className="flex flex-1 overflow-hidden">
        {aktivFane === "3d-modell" && <Fane3DModell prosjektId={prosjektId!} />}
        {aktivFane === "overflater" && (
          <FaneOverflater
            prosjektId={prosjektId!}
            overflater={overflater}
            onLeggTil={leggTilOverflate}
            onFjern={fjernOverflate}
          />
        )}
        {aktivFane === "kutt-fyll" && (
          <FaneKuttFyll
            prosjektId={prosjektId!}
            overflater={overflater}
            onLeggTil={leggTilOverflate}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FANE 1: 3D-modell (IFC sammenslått + punktsky)                     */
/* ================================================================== */

interface ModellStatus {
  id: string;
  synlig: boolean;
  laster: boolean;
  feil: string | null;
}

function Fane3DModell({ prosjektId }: { prosjektId: string }) {
  const utils = trpc.useUtils();

  // IFC-modeller
  const { data: _tegninger, isLoading: lasterTegninger } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );
  const tegninger = (_tegninger as TegningRad[] | undefined)?.filter(
    (t) => t.fileType?.toLowerCase() === "ifc",
  );

  // Punktskyer
  const { data: _punktskyer, isLoading: lasterPunktskyer } = trpc.punktsky.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );
  const punktskyer = (_punktskyer as PunktSkyRad[] | undefined)?.filter(
    (ps) => ps.conversionStatus === "done" && ps.potreeUrl,
  );

  const [valgtObjekt, setValgtObjekt] = useState<ValgtObjekt | null>(null);
  const [lasterOpp, setLasterOpp] = useState(false);
  const [klippModus, setKlippModus] = useState(false);
  const [modellStatuser, setModellStatuser] = useState<ModellStatus[]>([]);

  // Referanse til sammenslått viewer
  const viewerRef = useRef<{
    toggleModell: (tegningId: string, synlig: boolean) => void;
    fjernAlleKlippeplan: () => void;
    settKlipperSynlig: (synlig: boolean) => void;
  } | null>(null);

  const opprettMutation = trpc.tegning.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  async function handleFilValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil || !prosjektId) return;

    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Opplasting feilet");
        return;
      }
      const data = await res.json();
      opprettMutation.mutate({
        projectId: prosjektId,
        name: fil.name.replace(/\.[^.]+$/, ""),
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
      });
    } catch {
      alert("Kunne ikke laste opp filen");
    } finally {
      setLasterOpp(false);
      e.target.value = "";
    }
  }

  function toggleSynlighet(id: string) {
    setModellStatuser((prev) => {
      const oppdatert = prev.map((m) =>
        m.id === id ? { ...m, synlig: !m.synlig } : m,
      );
      const modell = oppdatert.find((m) => m.id === id);
      if (modell) {
        viewerRef.current?.toggleModell(id, modell.synlig);
      }
      return oppdatert;
    });
  }

  function oppdaterModellStatus(id: string, status: Partial<ModellStatus>) {
    setModellStatuser((prev) => {
      const finnes = prev.find((m) => m.id === id);
      if (finnes) {
        return prev.map((m) => (m.id === id ? { ...m, ...status } : m));
      }
      return [...prev, { id, synlig: true, laster: false, feil: null, ...status }];
    });
  }

  if (lasterTegninger || lasterPunktskyer) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const harModeller = tegninger && tegninger.length > 0;

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel */}
      <div className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Modeller</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".ifc"
              onChange={handleFilValgt}
              className="hidden"
              disabled={lasterOpp}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterOpp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Last opp
            </span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!harModeller && (!punktskyer || punktskyer.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Layers className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">Ingen 3D-data</p>
              <p className="text-xs text-gray-400">Last opp IFC-modeller</p>
            </div>
          )}

          {/* IFC-modeller med avkrysning */}
          {tegninger?.map((t) => {
            const status = modellStatuser.find((m) => m.id === t.id);
            return (
              <label
                key={t.id}
                className="flex w-full cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={status?.synlig ?? true}
                  onChange={() => toggleSynlighet(t.id)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                />
                <Box className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {status?.laster ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" /> Laster...
                      </span>
                    ) : status?.feil ? (
                      <span className="text-red-500" title={status.feil}>Feilet</span>
                    ) : (
                      "IFC"
                    )}
                  </p>
                </div>
              </label>
            );
          })}

          {/* Punktskyer */}
          {punktskyer && punktskyer.length > 0 && (
            <>
              <div className="border-t border-gray-200 px-4 py-2">
                <span className="text-xs font-semibold uppercase text-gray-500">Punktskyer</span>
              </div>
              {punktskyer.map((ps) => (
                <div
                  key={ps.id}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-2 text-left"
                >
                  <Waypoints className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700">{ps.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {ps.pointCount ? `${(ps.pointCount / 1_000_000).toFixed(1)}M pkt` : ps.fileType}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Hovedinnhold: sammenslått viewer */}
      <div className="relative flex flex-1 flex-col bg-gray-100">
        {!harModeller ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <Box className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">Last opp IFC-modeller for 3D-visning</p>
            </div>
          </div>
        ) : (
          <SammenslattIfcViewer
            tegninger={tegninger!}
            viewerRef={viewerRef}
            klippModus={klippModus}
            onKlippModusEndret={setKlippModus}
            onObjektValgt={setValgtObjekt}
            onModellStatus={oppdaterModellStatus}
          />
        )}

        {/* Flytende egenskapspanel */}
        {valgtObjekt && (
          <EgenskapsPopup objekt={valgtObjekt} onLukk={() => setValgtObjekt(null)} />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FANE 2: Overflatemodeller                                          */
/* ================================================================== */

function FaneOverflater({
  prosjektId,
  overflater,
  onLeggTil,
  onFjern,
}: {
  prosjektId: string;
  overflater: OverflateData[];
  onLeggTil: (o: OverflateData) => void;
  onFjern: (id: string) => void;
}) {
  const [valgtOverflateId, setValgtOverflateId] = useState<string | null>(null);
  const [lasterInn, setLasterInn] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function handleLandXMLValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil) return;

    setLasterInn(true);
    setFeil(null);
    try {
      const nyOverflate = await parseLandXMLFil(fil);
      onLeggTil(nyOverflate);
      setValgtOverflateId(nyOverflate.id);
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Kunne ikke parse LandXML");
    } finally {
      setLasterInn(false);
      e.target.value = "";
    }
  }

  function fjernOverflate(id: string) {
    onFjern(id);
    if (valgtOverflateId === id) setValgtOverflateId(null);
  }

  const valgt = overflater.find((o) => o.id === valgtOverflateId) ?? null;

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel */}
      <div className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Overflater</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xml,.landxml"
              onChange={handleLandXMLValgt}
              className="hidden"
              disabled={lasterInn}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterInn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              LandXML
            </span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {overflater.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Mountain className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">Ingen overflater</p>
              <p className="text-xs text-gray-400">Last opp LandXML-filer</p>
            </div>
          )}

          {overflater.map((o) => (
            <button
              key={o.id}
              onClick={() => setValgtOverflateId(o.id)}
              className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                valgtOverflateId === o.id ? "bg-blue-50" : ""
              }`}
            >
              <Mountain className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{o.navn}</p>
                <p className="text-xs text-gray-500">
                  {o.kilde === "landxml" ? "LandXML" : "Punktsky"} — {(o.triangles.length / 3).toLocaleString()} trekanter
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); fjernOverflate(o.id); }}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </button>
          ))}
        </div>

        {feil && (
          <div className="border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-red-500">{feil}</p>
          </div>
        )}
      </div>

      {/* 3D-visning */}
      <div className="flex flex-1 flex-col bg-gray-100">
        {!valgt ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <Mountain className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">Last opp en LandXML-fil for å vise overflaten</p>
            </div>
          </div>
        ) : (
          <OverflateViewer overflate={valgt} />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FANE 3: Kutt/fyll-analyse                                          */
/* ================================================================== */

interface KuttFyllResultatType {
  kuttVolum: number;
  fyllVolum: number;
  netto: number;
  diffGrid: Float32Array;
  gridBredde: number;
  gridHoyde: number;
  origoX: number;
  origoY: number;
  celleStr: number;
  minDiff: number;
  maxDiff: number;
}

function FaneKuttFyll({
  prosjektId,
  overflater,
  onLeggTil,
}: {
  prosjektId: string;
  overflater: OverflateData[];
  onLeggTil: (o: OverflateData) => void;
}) {
  const [toppId, setToppId] = useState<string | null>(null);
  const [bunnId, setBunnId] = useState<string | null>(null);
  const [celleStr, setCelleStr] = useState(1.0);
  const [resultat, setResultat] = useState<KuttFyllResultatType | null>(null);
  const [beregner, setBeregner] = useState(false);
  const [lasterInn, setLasterInn] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  // Auto-sett topp/bunn når overflater legges til
  useEffect(() => {
    if (overflater.length >= 1 && !bunnId) {
      setBunnId(overflater[0]!.id);
    }
    if (overflater.length >= 2 && !toppId) {
      setToppId(overflater[1]!.id);
    }
  }, [overflater, bunnId, toppId]);

  async function handleLandXMLValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil) return;

    setLasterInn(true);
    setFeil(null);
    try {
      const nyOverflate = await parseLandXMLFil(fil);
      onLeggTil(nyOverflate);
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Kunne ikke parse LandXML");
    } finally {
      setLasterInn(false);
      e.target.value = "";
    }
  }

  async function beregnAnalyse() {
    const topp = overflater.find((o) => o.id === toppId);
    const bunn = overflater.find((o) => o.id === bunnId);
    if (!topp || !bunn) return;

    setBeregner(true);
    setFeil(null);
    try {
      const { beregnKuttFyll } = await import("@/lib/kutt-fyll");
      const res = beregnKuttFyll(topp, bunn, celleStr);
      setResultat(res);
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Beregning feilet");
    } finally {
      setBeregner(false);
    }
  }

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel */}
      <div className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Kutt/fyll</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xml,.landxml"
              onChange={handleLandXMLValgt}
              className="hidden"
              disabled={lasterInn}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterInn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              LandXML
            </span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Overflatevalg */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Toppflate (nyeste)</label>
              <select
                value={toppId ?? ""}
                onChange={(e) => setToppId(e.target.value || null)}
                className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="">Velg overflate...</option>
                {overflater.map((o) => (
                  <option key={o.id} value={o.id}>{o.navn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Bunnflate (eldste)</label>
              <select
                value={bunnId ?? ""}
                onChange={(e) => setBunnId(e.target.value || null)}
                className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="">Velg overflate...</option>
                {overflater.map((o) => (
                  <option key={o.id} value={o.id}>{o.navn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Rutenett-oppløsning</label>
              <select
                value={celleStr}
                onChange={(e) => setCelleStr(parseFloat(e.target.value))}
                className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="0.5">0.5m (fin)</option>
                <option value="1">1m (standard)</option>
                <option value="2">2m (grov)</option>
                <option value="5">5m (rask)</option>
              </select>
            </div>

            <button
              onClick={beregnAnalyse}
              disabled={!toppId || !bunnId || toppId === bunnId || beregner}
              className="flex w-full items-center justify-center gap-2 rounded bg-sitedoc-primary px-3 py-2 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
            >
              {beregner ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BarChart3 className="h-3.5 w-3.5" />
              )}
              Beregn kutt/fyll
            </button>
          </div>

          {/* Resultat */}
          {resultat && (
            <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-semibold uppercase text-gray-500">Resultat</h3>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
                    Kutt (fjernet)
                  </span>
                  <span className="text-xs font-semibold text-gray-900">
                    {resultat.kuttVolum.toFixed(1)} m³
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                    Fyll (tilført)
                  </span>
                  <span className="text-xs font-semibold text-gray-900">
                    {resultat.fyllVolum.toFixed(1)} m³
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                  <span className="text-xs font-medium text-gray-600">Netto</span>
                  <span className={`text-xs font-semibold ${resultat.netto > 0 ? "text-red-600" : resultat.netto < 0 ? "text-blue-600" : "text-gray-600"}`}>
                    {resultat.netto > 0 ? "+" : ""}{resultat.netto.toFixed(1)} m³
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-[10px] text-gray-400">
                <p>Oppløsning: {resultat.celleStr}m × {resultat.celleStr}m</p>
                <p>Rutenett: {resultat.gridBredde} × {resultat.gridHoyde} celler</p>
                <p>ΔZ: {resultat.minDiff.toFixed(2)}m til {resultat.maxDiff.toFixed(2)}m</p>
              </div>
            </div>
          )}

          {feil && (
            <div className="mt-3 rounded bg-red-50 px-3 py-2">
              <p className="text-xs text-red-600">{feil}</p>
            </div>
          )}

          {/* Fargeskala-forklaring */}
          {resultat && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-semibold uppercase text-gray-500">Fargeskala</h3>
              <div className="mt-2 flex h-3 w-full rounded overflow-hidden">
                <div className="flex-1 bg-gradient-to-r from-blue-600 to-blue-200" />
                <div className="w-px bg-gray-300" />
                <div className="flex-1 bg-gradient-to-r from-red-200 to-red-600" />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>Kutt</span>
                <span>0</span>
                <span>Fyll</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3D-visning */}
      <div className="flex flex-1 flex-col bg-gray-100">
        {!resultat ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <BarChart3 className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">Last opp to overflater og kjør analyse</p>
              <p className="mt-1 text-xs text-gray-400">
                Blå = kutt (terreng fjernet), Rød = fyll (masse tilført)
              </p>
            </div>
          </div>
        ) : (
          <KuttFyllViewer resultat={resultat} />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Overflate-viewer (Three.js)                                        */
/* ================================================================== */

function OverflateViewer({ overflate }: { overflate: OverflateData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renset = false;

    import("three").then((THREE) => {
      if (renset) return;

      const bredde = container.clientWidth;
      const hoyde = container.clientHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);

      const kamera = new THREE.PerspectiveCamera(60, bredde / hoyde, 0.1, 100000);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(bredde, hoyde);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      // Bygg mesh fra TIN
      const geometry = new THREE.BufferGeometry();
      const { vertices, triangles, bbox } = overflate;

      // Sentrer geometrien
      const cx = (bbox.minX + bbox.maxX) / 2;
      const cy = (bbox.minY + bbox.maxY) / 2;
      const cz = (bbox.minZ + bbox.maxZ) / 2;

      const positions = new Float32Array(vertices.length);
      for (let i = 0; i < vertices.length / 3; i++) {
        positions[i * 3] = (vertices[i * 3] ?? 0) - cx;
        positions[i * 3 + 1] = (vertices[i * 3 + 2] ?? 0) - cz; // Z → Y (opp)
        positions[i * 3 + 2] = (vertices[i * 3 + 1] ?? 0) - cy;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triangles), 1));
      geometry.computeVertexNormals();

      // Fargelegg etter høyde
      const colors = new Float32Array(positions.length);
      const zMin = bbox.minZ;
      const zRange = Math.max(bbox.maxZ - bbox.minZ, 0.01);
      for (let i = 0; i < positions.length / 3; i++) {
        const t = ((vertices[i * 3 + 2] ?? 0) - zMin) / zRange;
        // Grønn → brun gradient
        colors[i * 3] = 0.2 + 0.5 * t;
        colors[i * 3 + 1] = 0.6 - 0.3 * t;
        colors[i * 3 + 2] = 0.1;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      // Wireframe overlay
      const wireframe = new THREE.WireframeGeometry(geometry);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.05, transparent: true });
      scene.add(new THREE.LineSegments(wireframe, lineMat));

      // Lys
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(1, 2, 1);
      scene.add(dirLight);

      // Kamera posisjon
      const størrelse = new THREE.Vector3(
        bbox.maxX - bbox.minX,
        bbox.maxZ - bbox.minZ,
        bbox.maxY - bbox.minY,
      );
      const maxDim = størrelse.length();
      kamera.position.set(maxDim * 0.5, maxDim * 0.5, maxDim * 0.5);
      kamera.lookAt(0, 0, 0);

      setLaster(false);

      // Orbit-kontroller
      let isDragging = false;
      let prevX = 0;
      let prevY = 0;
      let rotX = Math.PI / 6;
      let rotY = Math.PI / 4;
      let avstand = maxDim * 0.8;
      const lookAt = new THREE.Vector3(0, 0, 0);

      function oppdaterKamera() {
        kamera.position.x = lookAt.x + avstand * Math.sin(rotY) * Math.cos(rotX);
        kamera.position.y = lookAt.y + avstand * Math.sin(rotX);
        kamera.position.z = lookAt.z + avstand * Math.cos(rotY) * Math.cos(rotX);
        kamera.lookAt(lookAt);
      }
      oppdaterKamera();

      renderer.domElement.addEventListener("mousedown", (e) => {
        isDragging = true;
        prevX = e.clientX;
        prevY = e.clientY;
      });

      renderer.domElement.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        rotY += (e.clientX - prevX) * 0.005;
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX + (e.clientY - prevY) * 0.005));
        prevX = e.clientX;
        prevY = e.clientY;
        oppdaterKamera();
      });

      window.addEventListener("mouseup", () => { isDragging = false; });

      renderer.domElement.addEventListener("wheel", (e) => {
        e.preventDefault();
        avstand *= e.deltaY > 0 ? 1.1 : 0.9;
        avstand = Math.max(1, Math.min(100000, avstand));
        oppdaterKamera();
      });

      // Render-løkke
      let animId: number;
      function animate() {
        animId = requestAnimationFrame(animate);
        renderer.render(scene, kamera);
      }
      animate();

      // Resize
      const resizeObserver = new ResizeObserver(() => {
        const b = container.clientWidth;
        const h = container.clientHeight;
        kamera.aspect = b / h;
        kamera.updateProjectionMatrix();
        renderer.setSize(b, h);
      });
      resizeObserver.observe(container);

      // Cleanup
      const cleanup = () => {
        renset = true;
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };

      // Lagre cleanup for return
      (container as unknown as { _cleanup: () => void })._cleanup = cleanup;
    });

    return () => {
      renset = true;
      const cleanup = (container as unknown as { _cleanup?: () => void })._cleanup;
      if (cleanup) cleanup();
    };
  }, [overflate]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Mountain className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">{overflate.navn}</span>
        <span className="text-xs text-gray-500">
          {(overflate.triangles.length / 3).toLocaleString()} trekanter
        </span>
      </div>
      <div ref={containerRef} className="relative flex-1">
        {laster && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
            <Loader2 className="h-8 w-8 animate-spin text-sitedoc-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Kutt/fyll-viewer (Three.js)                                        */
/* ================================================================== */

function KuttFyllViewer({ resultat }: { resultat: KuttFyllResultatType }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renset = false;

    Promise.all([
      import("three"),
      import("@/lib/kutt-fyll"),
    ]).then(([THREE, { genererDiffMesh }]) => {
      if (renset) return;

      const bredde = container.clientWidth;
      const hoyde = container.clientHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);

      const kamera = new THREE.PerspectiveCamera(60, bredde / hoyde, 0.1, 100000);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(bredde, hoyde);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      // Generer mesh-data
      const { positions, colors, indices } = genererDiffMesh(resultat);

      // Sentrer
      const cx = resultat.origoX + (resultat.gridBredde * resultat.celleStr) / 2;
      const cy = resultat.origoY + (resultat.gridHoyde * resultat.celleStr) / 2;

      const centeredPositions = new Float32Array(positions.length);
      for (let i = 0; i < positions.length / 3; i++) {
        centeredPositions[i * 3] = (positions[i * 3] ?? 0) - cx;
        centeredPositions[i * 3 + 1] = positions[i * 3 + 2] ?? 0; // Z → Y
        centeredPositions[i * 3 + 2] = (positions[i * 3 + 1] ?? 0) - cy;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(centeredPositions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();

      const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      // Lys
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(1, 2, 1);
      scene.add(dirLight);

      // Grid-hjelpelinje
      const gridSize = Math.max(
        resultat.gridBredde * resultat.celleStr,
        resultat.gridHoyde * resultat.celleStr,
      );
      const gridHelper = new THREE.GridHelper(gridSize, 20, 0xcccccc, 0xe0e0e0);
      gridHelper.position.y = -0.1;
      scene.add(gridHelper);

      // Kamera
      const avstandInit = gridSize * 0.8;
      let avstand = avstandInit;
      let rotX = Math.PI / 5;
      let rotY = Math.PI / 4;
      const lookAt = new THREE.Vector3(0, 0, 0);

      function oppdaterKamera() {
        kamera.position.x = lookAt.x + avstand * Math.sin(rotY) * Math.cos(rotX);
        kamera.position.y = lookAt.y + avstand * Math.sin(rotX);
        kamera.position.z = lookAt.z + avstand * Math.cos(rotY) * Math.cos(rotX);
        kamera.lookAt(lookAt);
      }
      oppdaterKamera();

      setLaster(false);

      // Orbit-kontroller
      let isDragging = false;
      let prevX = 0;
      let prevY = 0;

      renderer.domElement.addEventListener("mousedown", (e) => {
        isDragging = true;
        prevX = e.clientX;
        prevY = e.clientY;
      });

      renderer.domElement.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        rotY += (e.clientX - prevX) * 0.005;
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX + (e.clientY - prevY) * 0.005));
        prevX = e.clientX;
        prevY = e.clientY;
        oppdaterKamera();
      });

      window.addEventListener("mouseup", () => { isDragging = false; });

      renderer.domElement.addEventListener("wheel", (e) => {
        e.preventDefault();
        avstand *= e.deltaY > 0 ? 1.1 : 0.9;
        avstand = Math.max(1, Math.min(100000, avstand));
        oppdaterKamera();
      });

      // Render-løkke
      let animId: number;
      function animate() {
        animId = requestAnimationFrame(animate);
        renderer.render(scene, kamera);
      }
      animate();

      // Resize
      const resizeObserver = new ResizeObserver(() => {
        const b = container.clientWidth;
        const h = container.clientHeight;
        kamera.aspect = b / h;
        kamera.updateProjectionMatrix();
        renderer.setSize(b, h);
      });
      resizeObserver.observe(container);

      (container as unknown as { _cleanup: () => void })._cleanup = () => {
        renset = true;
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    });

    return () => {
      renset = true;
      const cleanup = (container as unknown as { _cleanup?: () => void })._cleanup;
      if (cleanup) cleanup();
    };
  }, [resultat]);

  return (
    <div ref={containerRef} className="relative flex-1">
      {laster && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-sitedoc-primary" />
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Gjenbrukte komponenter fra modeller/page.tsx                       */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/*  Objekttre-komponent                                                 */
/* ------------------------------------------------------------------ */

function ObjektTre({
  node,
  nivaa,
  onKlikk,
  valgtLocalId,
}: {
  node: TreNode;
  nivaa: number;
  onKlikk: (localId: number) => void;
  valgtLocalId: number | null;
}) {
  const [utvidet, setUtvidet] = useState(nivaa < 2);
  const harBarn = node.children && node.children.length > 0;
  const erValgt = node.localId !== null && node.localId === valgtLocalId;

  if (!node.category) return null;

  const visNavn = node.category.replace(/^Ifc/, "");

  return (
    <div>
      <button
        onClick={() => {
          if (harBarn) setUtvidet(!utvidet);
          if (node.localId !== null) onKlikk(node.localId);
        }}
        className={`flex w-full items-center gap-1 px-2 py-1 text-left text-xs hover:bg-gray-50 ${
          erValgt ? "bg-blue-50 text-blue-700" : "text-gray-700"
        }`}
        style={{ paddingLeft: `${nivaa * 12 + 8}px` }}
      >
        {harBarn ? (
          utvidet ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate">{visNavn}</span>
      </button>
      {utvidet &&
        node.children?.map((barn, i) => (
          <ObjektTre
            key={`${barn.localId ?? i}`}
            node={barn}
            nivaa={nivaa + 1}
            onKlikk={onKlikk}
            valgtLocalId={valgtLocalId}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flytende egenskapspanel                                             */
/* ------------------------------------------------------------------ */

function EgenskapsPopup({
  objekt,
  onLukk,
}: {
  objekt: ValgtObjekt;
  onLukk: () => void;
}) {
  const kategoriNavn = objekt.kategori?.replace(/^Ifc/, "") ?? "Ukjent";

  return (
    <div className="absolute right-4 top-14 z-10 w-[320px] max-h-[calc(100%-72px)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{kategoriNavn}</h3>
          {objekt.attributter["Name"] && (
            <p className="text-xs text-gray-500">
              {String(objekt.attributter["Name"].value)}
            </p>
          )}
        </div>
        <button
          onClick={onLukk}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-gray-100 px-4 py-2">
        <table className="w-full text-xs">
          <tbody>
            {Object.entries(objekt.attributter)
              .filter(([k]) => k !== "Name" && k !== "type")
              .map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-2 text-gray-500">{k}</td>
                  <td className="py-0.5 font-medium text-gray-900">
                    {formaterVerdi(v.value)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {objekt.relasjoner.map((gruppe) => (
        <EgenskapsGruppeVis key={gruppe.navn} gruppe={gruppe} />
      ))}
    </div>
  );
}

function EgenskapsGruppeVis({ gruppe }: { gruppe: EgenskapGruppe }) {
  const [utvidet, setUtvidet] = useState(true);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setUtvidet(!utvidet)}
        className="flex w-full items-center gap-1 px-4 py-2 text-left hover:bg-gray-50"
      >
        {utvidet ? (
          <ChevronDown className="h-3 w-3 text-gray-400" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-400" />
        )}
        <span className="text-xs font-semibold text-gray-700">{gruppe.navn}</span>
      </button>
      {utvidet && (
        <div className="px-4 pb-2">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(gruppe.egenskaper).map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-2 text-gray-500">{k}</td>
                  <td className="py-0.5 font-medium text-gray-900">
                    {formaterVerdi(v.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formaterVerdi(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "boolean") return v ? "Ja" : "Nei";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

/* ------------------------------------------------------------------ */
/*  IFC Viewer — @thatopen/components                                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Sammenslått IFC-viewer — alle modeller i samme scene                */
/* ------------------------------------------------------------------ */

function trekkUtEgenskaper(
  dataArray: Record<string, unknown>[],
): EgenskapGruppe[] {
  const grupper: EgenskapGruppe[] = [];
  for (const item of dataArray) {
    const navn =
      item["Name"] && typeof item["Name"] === "object" && "value" in (item["Name"] as Record<string, unknown>)
        ? String((item["Name"] as { value: unknown }).value)
        : "Egenskaper";
    const egenskaper: Record<string, EgenskapVerdi> = {};
    for (const [k, v] of Object.entries(item)) {
      if (k === "Name" || k === "type") continue;
      if (Array.isArray(v)) {
        const barnGrupper = trekkUtEgenskaper(v as Record<string, unknown>[]);
        grupper.push(...barnGrupper);
      } else if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
        egenskaper[k] = v as EgenskapVerdi;
      }
    }
    if (Object.keys(egenskaper).length > 0) {
      grupper.push({ navn, egenskaper });
    }
  }
  return grupper;
}

interface SammenslattIfcViewerProps {
  tegninger: TegningRad[];
  viewerRef: React.MutableRefObject<{
    toggleModell: (tegningId: string, synlig: boolean) => void;
    fjernAlleKlippeplan: () => void;
    settKlipperSynlig: (synlig: boolean) => void;
  } | null>;
  klippModus: boolean;
  onKlippModusEndret: (aktiv: boolean) => void;
  onObjektValgt: (obj: ValgtObjekt | null) => void;
  onModellStatus: (id: string, status: Partial<ModellStatus>) => void;
}

function SammenslattIfcViewer({
  tegninger,
  viewerRef,
  klippModus,
  onKlippModusEndret,
  onObjektValgt,
  onModellStatus,
}: SammenslattIfcViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);
  const [antallLastet, setAntallLastet] = useState(0);
  const [lasterNavn, setLasterNavn] = useState<string | null>(null);

  const onObjektValgtRef = useRef(onObjektValgt);
  onObjektValgtRef.current = onObjektValgt;
  const onModellStatusRef = useRef(onModellStatus);
  onModellStatusRef.current = onModellStatus;

  // Stabil referanse til tegninger-IDs for å unngå unødvendig re-mount
  const tegningerIds = tegninger.map((t) => t.id).join(",");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || tegninger.length === 0) return;

    let renset = false;
    let componentsRef: unknown = null;

    Promise.all([
      import("@thatopen/components"),
      import("three"),
    ])
      .then(async ([OBC, THREE]) => {
        if (renset) return;

        const components = new OBC.Components();
        componentsRef = components;

        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();

        const simpleScene = new OBC.SimpleScene(components);
        world.scene = simpleScene;
        (simpleScene as unknown as { setup: (c: unknown) => void }).setup({
          backgroundColor: new THREE.Color(0xf0f0f0),
          ambientLight: { color: new THREE.Color("white"), intensity: 1 },
          directionalLight: { color: new THREE.Color("white"), intensity: 1.5, position: new THREE.Vector3(5, 10, 3) },
        });
        const scene = world.scene.three;

        world.renderer = new OBC.SimpleRenderer(components, container);
        world.camera = new OBC.SimpleCamera(components);
        world.camera.controls?.setLookAt(20, 20, 20, 0, 0, 0);

        components.init();

        // Initialiser FragmentsManager med worker (påkrevd før lasting)
        const fragmentsManager = components.get(OBC.FragmentsManager);
        fragmentsManager.init("/fragments-worker.mjs");

        const grids = components.get(OBC.Grids);
        grids.create(world);

        const clipper = components.get(OBC.Clipper);
        clipper.setup();
        clipper.enabled = false;

        const ifcLoader = components.get(OBC.IfcLoader);
        ifcLoader.settings.autoSetWasm = false;
        ifcLoader.settings.wasm = {
          path: "/",
          absolute: true,
        };
        await ifcLoader.setup();

        if (renset) return;

        const threeCamera = (world.camera as unknown as { three: InstanceType<typeof THREE.PerspectiveCamera> }).three;

        // Last alle IFC-modeller inn i samme scene
        const modellMap = new Map<string, unknown>();
        const totalBbox = new THREE.Box3();
        let lastet = 0;

        // Parallell nedlasting av alle filer (nettverks-I/O)
        for (const tegning of tegninger) {
          onModellStatusRef.current(tegning.id, { laster: true, feil: null });
        }

        const nedlastinger = await Promise.all(
          tegninger.map(async (tegning) => {
            try {
              const fileUrl = tegning.fileUrl.startsWith("/api")
                ? tegning.fileUrl
                : `/api${tegning.fileUrl}`;
              const response = await fetch(fileUrl);
              if (!response.ok) throw new Error("Kunne ikke hente fil");
              const buffer = await response.arrayBuffer();
              return { tegning, data: new Uint8Array(buffer), feil: null };
            } catch (err) {
              return { tegning, data: null, feil: err instanceof Error ? err.message : String(err) };
            }
          }),
        );

        if (renset) return;

        // Sekvensiell WASM-parsing (web-ifc er enkelttrådet)
        for (const { tegning, data, feil } of nedlastinger) {
          if (renset) return;

          if (!data || feil) {
            console.error(`Kunne ikke laste ${tegning.name}:`, feil);
            onModellStatusRef.current(tegning.id, { laster: false, feil: feil ?? "Ukjent feil" });
            continue;
          }

          setLasterNavn(tegning.name);

          try {
            const model = await ifcLoader.load(data, true, tegning.name, {
              instanceCallback: (importer) => {
                importer.addAllAttributes();
                importer.addAllRelations();
              },
            });

            // Legg modellens 3D-objekt til scenen og koble kamera for tile-lasting
            scene.add(model.object);
            model.useCamera(threeCamera);

            modellMap.set(tegning.id, model);
            totalBbox.union(model.box);

            lastet++;
            setAntallLastet(lastet);
            onModellStatusRef.current(tegning.id, { laster: false, synlig: true });
          } catch (err) {
            console.error(`Kunne ikke laste ${tegning.name}:`, err);
            const feilmelding = err instanceof Error ? err.message : String(err);
            onModellStatusRef.current(tegning.id, {
              laster: false,
              feil: feilmelding,
            });
          }
        }
        setLasterNavn(null);

        if (renset) return;

        // Tilpass kamera til samlet bounding box
        if (!totalBbox.isEmpty()) {
          const center = totalBbox.getCenter(new THREE.Vector3());
          const size = totalBbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          world.camera.controls?.setLookAt(
            center.x + maxDim,
            center.y + maxDim * 0.7,
            center.z + maxDim,
            center.x,
            center.y,
            center.z,
          );
        }

        // Start update-løkke for tile-lasting
        let animFrameId: number | null = null;
        function updateLoop() {
          if (renset) return;
          fragmentsManager.core.update();
          animFrameId = requestAnimationFrame(updateLoop);
        }
        updateLoop();

        // Raycasting for objektvelging
        const rendererDom = (world.renderer as unknown as { three: { domElement: HTMLCanvasElement } }).three.domElement;

        const highlightMaterial = {
          color: new THREE.Color(0x3b82f6),
          renderedFaces: 1 as unknown as import("@thatopen/fragments").RenderedFaces,
          opacity: 0.6,
          transparent: true,
        };

        let currentHighlight: { modelId: string; localIds: number[] } | null = null;

        async function resetHighlight() {
          if (!currentHighlight) return;
          try {
            const prevModel = fragmentsManager.list.get(currentHighlight.modelId);
            if (prevModel) {
              await prevModel.resetHighlight(currentHighlight.localIds);
            }
          } catch {
            // Ignorer
          }
          currentHighlight = null;
        }

        async function handleKlikk(event: MouseEvent) {
          if (renset) return;

          const rect = rendererDom.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          await resetHighlight();

          try {
            const hitResult = await fragmentsManager.raycast({
              camera: threeCamera,
              mouse: new THREE.Vector2(x, y),
              dom: rendererDom,
            });

            if (!hitResult) {
              onObjektValgtRef.current(null);
              return;
            }

            const { localId, fragments: hitModel } = hitResult;

            // Highlight valgt objekt
            try {
              await hitModel.highlight([localId], highlightMaterial);
              currentHighlight = { modelId: hitModel.modelId, localIds: [localId] };
            } catch {
              // Highlight kan feile men er ikke kritisk
            }

            // Hent egenskaper med relasjoner (lazy — kun for klikket objekt)
            const attributter: Record<string, EgenskapVerdi> = {};
            const relasjoner: EgenskapGruppe[] = [];
            let kategori: string | null = null;

            try {
              const itemsData = await hitModel.getItemsData([localId], {
                attributesDefault: true,
                relationsDefault: { attributes: true, relations: true },
              });
              if (itemsData.length > 0) {
                const item = itemsData[0] as Record<string, unknown>;
                for (const [k, v] of Object.entries(item)) {
                  if (Array.isArray(v)) {
                    relasjoner.push(...trekkUtEgenskaper(v as Record<string, unknown>[]));
                  } else if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
                    attributter[k] = v as EgenskapVerdi;
                  }
                }
              }
            } catch {
              // Egenskaper kan mangle for noen objekter
            }

            try {
              const categories = await hitModel.getCategories();
              for (const cat of categories) {
                const items = await hitModel.getItemsOfCategories([new RegExp(`^${cat}$`)]);
                if (items[cat]?.includes(localId)) {
                  kategori = cat;
                  break;
                }
              }
            } catch {
              // Ikke kritisk
            }

            onObjektValgtRef.current({ localId, kategori, attributter, relasjoner });
          } catch (err) {
            console.warn("Kunne ikke hente objektegenskaper:", err);
            onObjektValgtRef.current(null);
          }
        }

        container.addEventListener("click", handleKlikk);

        // Dobbeltklikk for klippeplan
        async function handleDblKlikk() {
          if (!clipper.enabled || renset) return;
          await clipper.create(world);
        }
        container.addEventListener("dblclick", handleDblKlikk);

        // Viewer-referanser
        viewerRef.current = {
          toggleModell: (tegningId: string, synlig: boolean) => {
            const model = modellMap.get(tegningId) as { object?: { visible: boolean } } | undefined;
            if (model?.object) {
              model.object.visible = synlig;
            }
          },
          fjernAlleKlippeplan: () => {
            clipper.deleteAll();
            clipper.enabled = false;
          },
          settKlipperSynlig: (synlig: boolean) => {
            clipper.enabled = synlig;
            clipper.visible = synlig;
          },
        };

        setLaster(false);

        return () => {
          container.removeEventListener("click", handleKlikk);
          container.removeEventListener("dblclick", handleDblKlikk);
          if (animFrameId !== null) cancelAnimationFrame(animFrameId);
        };
      })
      .catch((err) => {
        if (!renset) {
          console.error("IFC viewer feil:", err);
          setLaster(false);
        }
      });

    return () => {
      renset = true;
      viewerRef.current = null;
      if (componentsRef && typeof (componentsRef as { dispose?: () => void }).dispose === "function") {
        try {
          (componentsRef as { dispose: () => void }).dispose();
        } catch {
          // Ignorer
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tegningerIds]);

  useEffect(() => {
    viewerRef.current?.settKlipperSynlig(klippModus);
  }, [klippModus, viewerRef]);

  return (
    <div className="flex h-full flex-col">
      {/* Verktøylinje */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Layers className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">
          {tegninger.length} modell{tegninger.length !== 1 ? "er" : ""}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
          <button
            onClick={() => {
              const nyModus = !klippModus;
              onKlippModusEndret(nyModus);
              if (nyModus) viewerRef.current?.settKlipperSynlig(true);
            }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              klippModus
                ? "bg-sitedoc-primary text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            title="Snitt-modus"
          >
            <Scissors className="h-3.5 w-3.5" />
            Snitt
          </button>
          {klippModus && (
            <button
              onClick={() => {
                viewerRef.current?.fjernAlleKlippeplan();
                onKlippModusEndret(false);
              }}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Fjern alle
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1">
        {laster && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-100">
            <Loader2 className="h-10 w-10 animate-spin text-sitedoc-primary" />
            <p className="mt-3 text-sm font-medium text-gray-700">
              Laster modeller ({antallLastet}/{tegninger.length})...
            </p>
            {lasterNavn && (
              <p className="mt-1 text-xs font-medium text-sitedoc-secondary">
                {lasterNavn}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Parsing skjer lokalt i nettleseren. Større filer tar lengre tid.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
