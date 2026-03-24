"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useTreDViewer } from "@/kontekst/tred-viewer-kontekst";
import { useBygning } from "@/kontekst/bygning-kontekst";
import {
  beregnTransformasjon,
  tegningTilGps,
  gpsTilTegning,
  gpsTil3D,
  tredjeTilGps,
} from "@sitedoc/shared/utils";
import type { GeoReferanse } from "@sitedoc/shared";
import type { KoordinatSystem } from "@sitedoc/shared/utils";
import { Layers, Link2, Link2Off, MapPin, Check, X, Crosshair, ChevronLeft, ChevronRight, Ruler } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  PDF canvas-rendering med pdf.js                                    */
/* ------------------------------------------------------------------ */
function usePdfCanvas(
  url: string | null,
  erPdf: boolean,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sideNr, setSideNr] = useState(1);
  const [antallSider, setAntallSider] = useState(1);
  const [laster, setLaster] = useState(false);

  type PdfDok = { getPage: (n: number) => Promise<unknown>; numPages: number };
  const [pdfDok, setPdfDok] = useState<PdfDok | null>(null);

  // Last PDF-dokument
  useEffect(() => {
    if (!erPdf || !url) { setPdfDok(null); return; }
    let avbrutt = false;
    setLaster(true);
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (avbrutt) return;
        setPdfDok(pdf as unknown as PdfDok);
        setAntallSider(pdf.numPages);
        setSideNr(1);
      } catch (e) {
        console.error("PDF-lasting feilet:", e);
      }
    })();
    return () => { avbrutt = true; };
  }, [url, erPdf]);

  // Rendre side til canvas — kjører når pdfDok eller sideNr endres
  useEffect(() => {
    if (!pdfDok || !canvasRef.current) return;
    let avbrutt = false;
    setLaster(true);
    (async () => {
      try {
        const side = await pdfDok.getPage(sideNr) as {
          getViewport: (opts: { scale: number }) => { width: number; height: number };
          render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
        };
        if (avbrutt) return;
        const viewport = side.getViewport({ scale: 3 });
        const canvas = canvasRef.current!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await side.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.error("PDF-rendering feilet:", e);
      } finally {
        if (!avbrutt) setLaster(false);
      }
    })();
    return () => { avbrutt = true; };
  }, [pdfDok, sideNr]);

  return { canvasRef, sideNr, setSideNr, antallSider, laster };
}

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  floor: string | null;
  fileUrl: string | null;
  fileType: string | null;
  geoReference?: unknown;
  ifcMetadata?: {
    gpsBreddegrad?: number | null;
    gpsLengdegrad?: number | null;
    etasjer?: Array<{ navn: string; høyde: number | null }>;
  } | null;
  coordinateSystem?: string | null;
}

type GeoRefSteg = "idle" | "tegning1" | "modell1" | "tegning2" | "modell2" | "ferdig";

const GEOREF_VEILEDER: Record<GeoRefSteg, string> = {
  idle: "",
  tegning1: "Steg 1/4: Dobbeltklikk på et tydelig punkt i tegningen (hjørne, søyle, kryss)",
  modell1: "Steg 2/4: Klikk på samme punkt i 3D-modellen",
  tegning2: "Steg 3/4: Dobbeltklikk på et annet punkt i tegningen (langt fra punkt 1)",
  modell2: "Steg 4/4: Klikk på samme punkt i 3D-modellen",
  ferdig: "Georeferanse satt — tegning og 3D er nå koblet!",
};

export default function Tegning3DSide() {
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const { viewerRef, valgtObjekt } = useTreDViewer();
  const { aktivBygning } = useBygning();

  // Tilgangskontroll — kun felt-admin kan endre georeferanse/kalibrering
  const { data: minTilgang } = (trpc.gruppe.hentMinTilgang as unknown as {
    useQuery: (input: { projectId: string }, opts: { enabled: boolean }) => { data: { erAdmin: boolean; tillatelser: string[] } | undefined };
  }).useQuery({ projectId: prosjektId! }, { enabled: !!prosjektId });
  const harRedigerTilgang = minTilgang?.erAdmin || minTilgang?.tillatelser?.includes("manage_field") || minTilgang?.tillatelser?.includes("drawing_manage");

  const tegningQuery = (trpc.tegning.hentForProsjekt as unknown as {
    useQuery: (input: { projectId: string; buildingId?: string }, opts: { enabled: boolean }) => { data: unknown };
  }).useQuery(
    { projectId: prosjektId!, ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}) },
    { enabled: !!prosjektId },
  );
  const tegninger = (tegningQuery.data ?? []) as TegningData[];

  const plantegninger = useMemo(() => tegninger.filter((t) => t.fileUrl && t.fileType?.toLowerCase() !== "ifc"), [tegninger]);
  const ifcModeller = useMemo(() => tegninger.filter((t) => t.fileType?.toLowerCase() === "ifc"), [tegninger]);

  const ifcOpprinnelse = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.ifcMetadata?.gpsBreddegrad && m.ifcMetadata?.gpsLengdegrad) {
        return { lat: m.ifcMetadata.gpsBreddegrad, lng: m.ifcMetadata.gpsLengdegrad };
      }
    }
    return null;
  }, [ifcModeller]);

  const coordSystem: KoordinatSystem = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.coordinateSystem) return m.coordinateSystem as KoordinatSystem;
    }
    return "utm33";
  }, [ifcModeller]);

  const etasjer = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.ifcMetadata?.etasjer && m.ifcMetadata.etasjer.length > 0) return m.ifcMetadata.etasjer;
    }
    return [];
  }, [ifcModeller]);

  // State
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [valgtEtasje, setValgtEtasje] = useState<string | null>(null);
  const [synkAktiv, setSynkAktiv] = useState(true);
  const [tegningMarkør, setTegningMarkør] = useState<{ x: number; y: number } | null>(null);
  const [innholdStr, setInnholdStr] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Kalibrert gulvhøyde — lagres i localStorage per bygning
  const gulvNøkkel = aktivBygning?.id ? `gulvY_${aktivBygning.id}` : null;
  const [gulvY, setGulvY] = useState<number | null>(() => {
    if (typeof window === "undefined" || !gulvNøkkel) return null;
    const lagret = localStorage.getItem(gulvNøkkel);
    return lagret ? parseFloat(lagret) : null;
  });
  const [kalibrerModus, setKalibrerModus] = useState(false);

  // Etasjeklipp i 3D
  useEffect(() => {
    if (!valgtEtasje || etasjer.length === 0) {
      viewerRef.current?.fjernEtasjeKlipp();
      return;
    }
    const idx = etasjer.findIndex((e) => e.navn === valgtEtasje);
    if (idx < 0) return;
    const nedre = etasjer[idx]!.høyde ?? 0;
    const øvre = idx + 1 < etasjer.length ? (etasjer[idx + 1]!.høyde ?? nedre + 4) : nedre + 4;
    viewerRef.current?.settEtasjeKlipp(nedre, øvre);

    // Bytt tegning til matchende etasje
    const match = plantegninger.find((t) => t.floor === valgtEtasje);
    if (match) setValgtTegningId(match.id);

    return () => { viewerRef.current?.fjernEtasjeKlipp(); };
  }, [valgtEtasje, etasjer, plantegninger, viewerRef]);

  // Georeferanse-modus
  const [georefSteg, setGeorefSteg] = useState<GeoRefSteg>("idle");
  const [georefPunkt1Tegning, setGeorefPunkt1Tegning] = useState<{ x: number; y: number } | null>(null);
  const [georefPunkt1Gps, setGeorefPunkt1Gps] = useState<{ lat: number; lng: number } | null>(null);
  const [georefPunkt2Tegning, setGeorefPunkt2Tegning] = useState<{ x: number; y: number } | null>(null);
  const [georefPunkt2Gps, setGeorefPunkt2Gps] = useState<{ lat: number; lng: number } | null>(null);

  const utils = trpc.useUtils();
  const settGeoRefMutation = (trpc.tegning.settGeoReferanse as unknown as {
    useMutation: (opts: { onSuccess: () => void }) => { mutate: (input: { drawingId: string; geoReference: GeoReferanse }) => void; isPending: boolean };
  }).useMutation({
    onSuccess: () => {
      utils.tegning.hentForProsjekt.invalidate();
      setGeorefSteg("ferdig");
      setTimeout(() => setGeorefSteg("idle"), 2000);
    },
  });

  const fjernGeoRefMutation = (trpc.tegning.fjernGeoReferanse as unknown as {
    useMutation: (opts: { onSuccess: () => void }) => { mutate: (input: { drawingId: string }) => void; isPending: boolean };
  }).useMutation({
    onSuccess: () => {
      utils.tegning.hentForProsjekt.invalidate();
    },
  });

  function startGeoref() {
    setGeorefSteg("tegning1");
    setGeorefPunkt1Tegning(null);
    setGeorefPunkt1Gps(null);
    setGeorefPunkt2Tegning(null);
    setGeorefPunkt2Gps(null);
  }

  function avbrytGeoref() {
    setGeorefSteg("idle");
    setGeorefPunkt1Tegning(null);
    setGeorefPunkt1Gps(null);
    setGeorefPunkt2Tegning(null);
    setGeorefPunkt2Gps(null);
  }

  // Split — draggbar
  const [splitPx, setSplitPx] = useState<number | null>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    setSplitPx(Math.max(100, Math.min(rect.width - 100, e.clientX - rect.left)));
  }, []);
  const handleDragEnd = useCallback(() => { draggingRef.current = false; }, []);

  // Tegning zoom/pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const faktor = e.deltaY > 0 ? 0.9 : 1.1;
    // Zoom mot musepeker: behold punktet under musen fast
    const rect = e.currentTarget.getBoundingClientRect();
    const musX = e.clientX - rect.left;
    const musY = e.clientY - rect.top;
    setZoom((prev) => {
      const nyZoom = Math.max(0.05, Math.min(10, prev * faktor));
      const skala = nyZoom / prev;
      setPan((p) => ({
        x: musX - (musX - p.x) * skala,
        y: musY - (musY - p.y) * skala,
      }));
      return nyZoom;
    });
  }, []);
  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);
  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!panStartRef.current) return;
    setPan({ x: panStartRef.current.panX + e.clientX - panStartRef.current.x, y: panStartRef.current.panY + e.clientY - panStartRef.current.y });
  }, []);
  const handlePanEnd = useCallback(() => { panStartRef.current = null; }, []);

  const tegningContainerRef = useRef<HTMLDivElement>(null);

  // Auto-fit tegning til container ved oppstart og tegningsbytte
  useEffect(() => {
    if (innholdStr.w === 0 || !tegningContainerRef.current) {
      setZoom(1); setPan({ x: 0, y: 0 });
      return;
    }
    const rect = tegningContainerRef.current.getBoundingClientRect();
    const fitZoom = Math.min(rect.width / innholdStr.w, rect.height / innholdStr.h, 1) * 0.95;
    setZoom(fitZoom);
    // Sentrér
    const skalertW = innholdStr.w * fitZoom;
    const skalertH = innholdStr.h * fitZoom;
    setPan({ x: (rect.width - skalertW) / 2, y: (rect.height - skalertH) / 2 });
  }, [valgtTegningId, innholdStr]);
  useEffect(() => {
    if (!valgtTegningId && plantegninger.length > 0) setValgtTegningId(plantegninger[0]!.id);
  }, [plantegninger, valgtTegningId]);

  const valgtTegning = plantegninger.find((t) => t.id === valgtTegningId);
  const transformasjon = useMemo(() => {
    if (!valgtTegning?.geoReference) return null;
    try { return beregnTransformasjon(valgtTegning.geoReference as GeoReferanse); } catch { return null; }
  }, [valgtTegning?.geoReference]);
  const harSynkMulighet = !!transformasjon && !!ifcOpprinnelse;
  const erIGeorefModus = georefSteg !== "idle" && georefSteg !== "ferdig";

  // Klikk i tegning — spor start for å skille drag fra klikk
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleImgPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement | HTMLImageElement>) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // 3D-klikk → kalibrering, georef eller synk
  useEffect(() => {
    if (!valgtObjekt) return;
    const punkt = viewerRef.current?.sisteKlikkPunkt();
    if (!punkt) return;

    // Kalibrering av gulvhøyde
    if (kalibrerModus) {
      setGulvY(punkt.y);
      if (gulvNøkkel) localStorage.setItem(gulvNøkkel, String(punkt.y));
      setKalibrerModus(false);
      return;
    }

    if (!ifcOpprinnelse) return;

    // Georeferanse-modus: hent GPS fra 3D-punkt
    if (georefSteg === "modell1") {
      const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
      if (gps) {
        setGeorefPunkt1Gps(gps);
        setGeorefSteg("tegning2");
      }
      return;
    }
    if (georefSteg === "modell2") {
      const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
      if (gps && georefPunkt1Tegning && georefPunkt1Gps && georefPunkt2Tegning && valgtTegningId) {
        setGeorefPunkt2Gps(gps);
        // Lagre georeferanse
        settGeoRefMutation.mutate({
          drawingId: valgtTegningId,
          geoReference: {
            point1: { pixel: georefPunkt1Tegning, gps: georefPunkt1Gps },
            point2: { pixel: georefPunkt2Tegning, gps },
          },
        });
      }
      return;
    }

    // Normal synk
    if (!synkAktiv || !transformasjon) { setTegningMarkør(null); return; }
    const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
    if (!gps) return;
    setTegningMarkør(gpsTilTegning(gps, transformasjon));
  }, [valgtObjekt]); // eslint-disable-line

  const tegningUrl = valgtTegning?.fileUrl
    ? valgtTegning.fileUrl.startsWith("/api") ? valgtTegning.fileUrl : `/api${valgtTegning.fileUrl}`
    : null;
  const erPdf = valgtTegning?.fileType?.toLowerCase() === "pdf" || tegningUrl?.toLowerCase().endsWith(".pdf");
  const { canvasRef: pdfCanvasRef, sideNr, setSideNr, antallSider, laster: pdfLaster } = usePdfCanvas(tegningUrl, !!erPdf);
  // Oppdater innholdsdimensjoner når PDF er ferdig rendret
  useEffect(() => {
    if (!pdfLaster && pdfCanvasRef.current && pdfCanvasRef.current.width > 0) {
      const w = pdfCanvasRef.current.width;
      const h = pdfCanvasRef.current.height;
      setInnholdStr((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    }
  }, [pdfLaster, pdfCanvasRef]);
  const splitWidth = splitPx ?? (splitContainerRef.current?.getBoundingClientRect().width ?? 800) * 0.4;

  // Felles klikk-handler for tegning (canvas/img)
  const handleTegningElementClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement | HTMLImageElement>) => {
      if (clickStartRef.current) {
        const dx = e.clientX - clickStartRef.current.x;
        const dy = e.clientY - clickStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const pxProsent = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };

      // Georef: enkeltklikk korrigerer siste punkt
      if (georefSteg === "modell1" && georefPunkt1Tegning) {
        setGeorefPunkt1Tegning(pxProsent);
        return;
      }
      if (georefSteg === "modell2" && georefPunkt2Tegning) {
        setGeorefPunkt2Tegning(pxProsent);
        return;
      }

      // Normal synk-modus
      if (!synkAktiv || !transformasjon || !ifcOpprinnelse) return;
      setTegningMarkør(pxProsent);
      const gps = tegningTilGps(pxProsent, transformasjon);
      const punkt3d = gpsTil3D(gps, ifcOpprinnelse, coordSystem, 0);
      if (!punkt3d) return;
      viewerRef.current?.flyTil(punkt3d.x, punkt3d.y, punkt3d.z, gulvY ?? undefined);
    },
    [georefSteg, georefPunkt1Tegning, georefPunkt2Tegning, synkAktiv, transformasjon, ifcOpprinnelse, coordSystem, viewerRef],
  );

  // Felles dobbeltklikk-handler for georef
  const handleTegningElementDblClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement | HTMLImageElement>) => {
      if (georefSteg !== "tegning1" && georefSteg !== "tegning2") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pxProsent = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
      if (georefSteg === "tegning1") { setGeorefPunkt1Tegning(pxProsent); setGeorefSteg("modell1"); }
      else { setGeorefPunkt2Tegning(pxProsent); setGeorefSteg("modell2"); }
    },
    [georefSteg],
  );

  // Beregn pikselposisjon for markør (utenfor transform-div)
  const pktTilPx = useCallback((pkt: { x: number; y: number }) => ({
    x: pan.x + (pkt.x / 100) * innholdStr.w * zoom,
    y: pan.y + (pkt.y / 100) * innholdStr.h * zoom,
  }), [pan, zoom, innholdStr]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="pointer-events-auto flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <select
          value={valgtTegningId ?? ""}
          onChange={(e) => setValgtTegningId(e.target.value || null)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          disabled={erIGeorefModus}
        >
          <option value="">Velg tegning...</option>
          {plantegninger.map((t) => (
            <option key={t.id} value={t.id}>
              {t.drawingNumber ?? t.name} {t.floor ? `(${t.floor})` : ""}
            </option>
          ))}
        </select>

        {etasjer.length > 0 && (
          <select
            value={valgtEtasje ?? ""}
            onChange={(e) => setValgtEtasje(e.target.value || null)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            disabled={erIGeorefModus}
          >
            <option value="">Alle etasjer</option>
            {etasjer.map((e) => (
              <option key={e.navn} value={e.navn}>{e.navn} {e.høyde != null ? `(${e.høyde.toFixed(1)}m)` : ""}</option>
            ))}
          </select>
        )}

        {!erIGeorefModus ? (
          <>
            <button
              onClick={() => setSynkAktiv(!synkAktiv)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                synkAktiv && harSynkMulighet ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
              }`}
              disabled={!harSynkMulighet}
              title={harSynkMulighet ? "Synkroniser klikk mellom tegning og 3D" : "Krever georeferert tegning og IFC med GPS"}
            >
              {synkAktiv ? <Link2 size={14} /> : <Link2Off size={14} />}
              Synk
            </button>

            {/* Georeferanse-knapp (kun felt-admin) */}
            {valgtTegningId && harRedigerTilgang && (
              <button
                onClick={ifcOpprinnelse ? startGeoref : undefined}
                disabled={!ifcOpprinnelse}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  !ifcOpprinnelse ? "bg-gray-100 text-gray-400"
                    : transformasjon ? "bg-green-50 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
                title={
                  !ifcOpprinnelse ? `IFC mangler GPS (${ifcModeller.length} IFC-filer funnet)`
                    : transformasjon ? "Tegningen er georeferert — klikk for å sette på nytt"
                    : "Georeferér tegningen mot 3D-modellen"
                }
              >
                <MapPin size={14} />
                {!ifcOpprinnelse ? "Mangler GPS" : transformasjon ? "Georeferert" : "Georeferér"}
              </button>
            )}
            {valgtTegningId && transformasjon && harRedigerTilgang && (
              <button
                onClick={() => {
                  if (confirm("Fjerne georeferanse for denne tegningen?")) {
                    fjernGeoRefMutation.mutate({ drawingId: valgtTegningId });
                  }
                }}
                disabled={fjernGeoRefMutation.isPending}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                title="Fjern georeferanse"
              >
                <X size={14} />
              </button>
            )}

            {/* Kalibrer gulvhøyde (kun felt-admin) */}
            {harRedigerTilgang && <button
              onClick={() => setKalibrerModus(!kalibrerModus)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                kalibrerModus ? "bg-purple-100 text-purple-700" : gulvY != null ? "bg-gray-50 text-gray-500" : "bg-orange-50 text-orange-700"
              }`}
              title={gulvY != null ? `Gulvhøyde: ${gulvY.toFixed(1)}m — klikk for å endre` : "Klikk på gulvet i 3D for å kalibrere kamerahøyde"}
            >
              <Ruler size={14} />
              {kalibrerModus ? "Klikk på gulvet..." : gulvY != null ? `Gulv: ${gulvY.toFixed(1)}` : "Kalibrer"}
            </button>}
          </>
        ) : (
          <button
            onClick={avbrytGeoref}
            className="flex items-center gap-1.5 rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
          >
            <X size={14} />
            Avbryt georeferanse
          </button>
        )}

        {/* PDF sidekontroller */}
        {erPdf && antallSider > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSideNr((s) => Math.max(1, s - 1))}
              disabled={sideNr <= 1}
              className="rounded bg-gray-100 px-1.5 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40"
            ><ChevronLeft size={14} /></button>
            <span className="text-xs text-gray-500 w-14 text-center">{sideNr}/{antallSider}</span>
            <button
              onClick={() => setSideNr((s) => Math.min(antallSider, s + 1))}
              disabled={sideNr >= antallSider}
              className="rounded bg-gray-100 px-1.5 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40"
            ><ChevronRight size={14} /></button>
          </div>
        )}

        {/* Zoom-tilbakestill */}
        {zoom !== 1 && (
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
          >
            {Math.round(zoom * 100)}% — Tilbakestill
          </button>
        )}
      </div>

      {/* Georeferanse-veileder */}
      {georefSteg !== "idle" && (
        <div className={`pointer-events-auto flex items-center gap-3 px-4 py-2 text-sm ${
          georefSteg === "ferdig" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
        }`}>
          <Crosshair size={16} />
          <span className="font-medium">{GEOREF_VEILEDER[georefSteg]}</span>
          {georefPunkt1Tegning && (
            <span className="flex items-center gap-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              1: {georefPunkt1Tegning.x.toFixed(0)}%, {georefPunkt1Tegning.y.toFixed(0)}%
              {georefPunkt1Gps && <Check size={10} />}
            </span>
          )}
          {georefPunkt2Tegning && (
            <span className="flex items-center gap-1 rounded bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              2: {georefPunkt2Tegning.x.toFixed(0)}%, {georefPunkt2Tegning.y.toFixed(0)}%
              {georefPunkt2Gps && <Check size={10} />}
            </span>
          )}
          {(georefSteg === "modell1" || georefSteg === "modell2") && (
            <span className="text-xs text-amber-600">Dobbeltklikk i tegningen for å korrigere punktet</span>
          )}
          {georefSteg === "ferdig" && <Check size={16} className="text-green-600" />}
        </div>
      )}

      {/* Split-view */}
      <div
        ref={splitContainerRef}
        className="flex flex-1 overflow-hidden"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        {/* Venstre: Tegning (felles zoom/pan for PDF og bilde) */}
        <div
          className="pointer-events-auto relative overflow-hidden bg-gray-100"
          style={{ width: splitWidth, flexShrink: 0 }}
        >
          {tegningUrl ? (
            <>
            <div
              ref={tegningContainerRef}
              className="relative h-full w-full"
              onWheel={handleWheel}
              onPointerDown={handlePanStart}
              onPointerMove={handlePanMove}
              onPointerUp={handlePanEnd}
            >
              <div
                className="relative origin-top-left"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  cursor: erIGeorefModus ? "crosshair" : panStartRef.current ? "grabbing" : "default",
                }}
              >
                {erPdf ? (
                  /* PDF — rendret til canvas via pdf.js */
                  <>
                    {pdfLaster && (
                      <div className="flex h-[600px] items-center justify-center text-sm text-gray-400">
                        Laster PDF...
                      </div>
                    )}
                    <canvas
                      ref={pdfCanvasRef}
                      className="max-w-none select-none"
                      style={{ display: pdfLaster ? "none" : "block" }}
                      onPointerDown={handleImgPointerDown}
                      onClick={handleTegningElementClick}
                      onDoubleClick={handleTegningElementDblClick}
                    />
                  </>
                ) : (
                  /* Bilde (SVG/PNG) */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tegningUrl}
                    alt={valgtTegning?.name ?? "Tegning"}
                    className="max-w-none select-none"
                    onPointerDown={handleImgPointerDown}
                    onClick={handleTegningElementClick}
                    onDoubleClick={handleTegningElementDblClick}
                    onLoad={(e) => setInnholdStr({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    draggable={false}
                  />
                )}
              </div>
            </div>
            {/* Markør-overlay utenfor transform (faste pikselposisjoner) */}
            {innholdStr.w > 0 && tegningMarkør && !erIGeorefModus && (
              <>
                <div className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 ring-2 ring-white" style={{ left: pktTilPx(tegningMarkør).x, top: pktTilPx(tegningMarkør).y }} />
                <div className="pointer-events-none absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-blue-500" style={{ left: pktTilPx(tegningMarkør).x, top: pktTilPx(tegningMarkør).y }} />
              </>
            )}
            {innholdStr.w > 0 && georefPunkt1Tegning && (
              <div className="pointer-events-none absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-white" style={{ left: pktTilPx(georefPunkt1Tegning).x, top: pktTilPx(georefPunkt1Tegning).y }}>1</div>
            )}
            {innholdStr.w > 0 && georefPunkt2Tegning && (
              <div className="pointer-events-none absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-white" style={{ left: pktTilPx(georefPunkt2Tegning).x, top: pktTilPx(georefPunkt2Tegning).y }}>2</div>
            )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-400">
                <Layers size={32} className="mx-auto mb-2" />
                <p className="text-sm">Velg en tegning</p>
              </div>
            </div>
          )}
        </div>

        {/* Skillelinje */}
        <div
          className="pointer-events-auto group relative z-20 flex w-1.5 cursor-col-resize items-center justify-center bg-gray-300 hover:bg-blue-400 active:bg-blue-500"
          onPointerDown={handleDragStart}
        >
          <div className="h-8 w-1 rounded-full bg-gray-500 group-hover:bg-white" />
        </div>

        {/* Høyre: 3D */}
        <div className="relative flex-1">
          {/* Georef 3D-veileder overlay */}
          {(georefSteg === "modell1" || georefSteg === "modell2") && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-amber-500/90 px-4 py-2 text-center text-sm font-medium text-white">
              Klikk på punkt {georefSteg === "modell1" ? "1" : "2"} i 3D-modellen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
