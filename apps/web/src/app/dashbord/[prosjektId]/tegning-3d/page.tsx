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
  konverterTilWgs84,
  wgs84TilProjeksjon,
} from "@sitedoc/shared/utils";
import type { GeoReferanse } from "@sitedoc/shared";
import type { KoordinatSystem } from "@sitedoc/shared/utils";
import { Layers, Link2, Link2Off, MapPin, ChevronLeft, ChevronRight, Ruler, Navigation, X } from "lucide-react";

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
  gpsOverride?: {
    lat: number; lng: number; rotasjon?: number; skala?: number;
    transform?: { a: number; b: number; tx: number; tz: number };
  } | null;
  coordinateSystem?: string | null;
}

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

  // GPS-opprinnelse: gpsOverride → ifcMetadata → null
  const ifcOpprinnelse = useMemo(() => {
    for (const m of ifcModeller) {
      // Kalibrert GPS har prioritet
      if (m.gpsOverride?.lat && m.gpsOverride?.lng) {
        return { lat: m.gpsOverride.lat, lng: m.gpsOverride.lng };
      }
      if (m.ifcMetadata?.gpsBreddegrad && m.ifcMetadata?.gpsLengdegrad) {
        return { lat: m.ifcMetadata.gpsBreddegrad, lng: m.ifcMetadata.gpsLengdegrad };
      }
    }
    return null;
  }, [ifcModeller]);

  const harGpsOverride = useMemo(() => ifcModeller.some((m) => m.gpsOverride?.lat && m.gpsOverride?.lng), [ifcModeller]);
  const harIfcGps = useMemo(() => ifcModeller.some((m) => m.ifcMetadata?.gpsBreddegrad && m.ifcMetadata?.gpsLengdegrad), [ifcModeller]);

  const coordSystem: KoordinatSystem = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.coordinateSystem) return m.coordinateSystem as KoordinatSystem;
    }
    return "utm33";
  }, [ifcModeller]);

  // Direkte similarity-transform fra kalibrering: tegning(%) ↔ 3D(xz)
  const kalibTransform = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.gpsOverride?.transform) return m.gpsOverride.transform;
    }
    return null;
  }, [ifcModeller]);

  /** Tegning pixel% → 3D xz (direkte transform, ingen GPS/UTM) */
  const tegningTil3D = useCallback((pkt: { x: number; y: number }): { x: number; z: number } | null => {
    if (!kalibTransform) return null;
    const { a, b, tx, tz } = kalibTransform;
    return { x: a * pkt.x + b * pkt.y + tx, z: -b * pkt.x + a * pkt.y + tz };
  }, [kalibTransform]);

  /** 3D xz → tegning pixel% (invers transform) */
  const treDTilTegning = useCallback((punkt: { x: number; z: number }): { x: number; y: number } | null => {
    if (!kalibTransform) return null;
    const { a, b, tx, tz } = kalibTransform;
    const det = a * a + b * b;
    if (det < 1e-10) return null;
    const dx = punkt.x - tx, dz = punkt.z - tz;
    return { x: (a * dx - b * dz) / det, y: (b * dx + a * dz) / det };
  }, [kalibTransform]);

  // Fallback: GPS-basert konvertering (uten kalibrering)
  const gpsTil3DRotert = useCallback((gps: { lat: number; lng: number }, hoyde: number = 0) => {
    if (!ifcOpprinnelse) return null;
    return gpsTil3D(gps, ifcOpprinnelse, coordSystem, hoyde);
  }, [ifcOpprinnelse, coordSystem]);

  const tredjeTilGpsRotert = useCallback((punkt: { x: number; y: number; z: number }) => {
    if (!ifcOpprinnelse) return null;
    return tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
  }, [ifcOpprinnelse, coordSystem]);

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
  const [tegningMarkør, setTegningMarkør] = useState<{ x: number; y: number; vinkel?: number } | null>(null);
  const [innholdStr, setInnholdStr] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Kalibrert gulvhøyde — lagres i localStorage per bygning
  const gulvNøkkel = aktivBygning?.id ? `gulvY_${aktivBygning.id}` : null;
  const [gulvY, setGulvY] = useState<number | null>(() => {
    if (typeof window === "undefined" || !gulvNøkkel) return null;
    const lagret = localStorage.getItem(gulvNøkkel);
    return lagret ? parseFloat(lagret) : null;
  });
  const [kalibrerModus, setKalibrerModus] = useState(false);

  // GPS-kalibrering state
  const [gpsKalibrerÅpen, setGpsKalibrerÅpen] = useState(false);
  const [gpsInput, setGpsInput] = useState("");
  const [gpsFeil, setGpsFeil] = useState<string | null>(null);

  // Klikk-kalibrering: 4 steg (2 punkt-par for posisjon + rotasjon)
  // Steg 1: klikk tegning A, 2: klikk 3D A, 3: klikk tegning B, 4: klikk 3D B
  const [klikkKalibSteg, setKlikkKalibSteg] = useState<0 | 1 | 2 | 3 | 4>(0);
  const kalibTegningGpsARef = useRef<{ lat: number; lng: number } | null>(null);
  const [kalibPunktA, setKalibPunktA] = useState<{
    tegningGps: { lat: number; lng: number };
    treD: { x: number; y: number; z: number };
  } | null>(null);
  const [kalibTegningGpsB, setKalibTegningGpsB] = useState<{ lat: number; lng: number } | null>(null);
  const [kalibMarkørA, setKalibMarkørA] = useState<{ x: number; y: number } | null>(null);
  const [kalibMarkørB, setKalibMarkørB] = useState<{ x: number; y: number } | null>(null);

  // Finjustering: 2 steg — klikk tegning, klikk 3D → korrigerer bare offset
  const [finjusterSteg, setFinjusterSteg] = useState<0 | 1 | 2>(0);
  const finjusterTegningPktRef = useRef<{ x: number; y: number } | null>(null);

  const utils = trpc.useUtils();
  const settGpsOverrideMutation = trpc.tegning.settGpsOverride.useMutation({
    onSuccess: (_data: unknown) => {
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setGpsKalibrerÅpen(false);
      setGpsInput("");
      setGpsFeil(null);
      setSynkAktiv(true); // Aktiver synk automatisk etter kalibrering
    },
    onError: (err: { message: string }) => setGpsFeil(err.message),
  });
  const fjernGpsOverrideMutation = trpc.tegning.fjernGpsOverride.useMutation({
    onSuccess: (_data: unknown) => {
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setGpsKalibrerÅpen(false);
    },
  });

  /** Parser GPS-input: støtter WGS84, UTM, Norgeskart-format */
  const parserGpsInput = useCallback((tekst: string): { lat: number; lng: number } | null => {
    const t = tekst.trim();
    if (!t) return null;

    // Norgeskart: 653849.51,7732794.51@EPSG:25833
    const norgeskartMatch = t.match(/^([\d.]+)\s*,\s*([\d.]+)\s*@\s*EPSG:\s*258(\d\d)/i);
    if (norgeskartMatch) {
      const ost = parseFloat(norgeskartMatch[1]!);
      const nord = parseFloat(norgeskartMatch[2]!);
      const sone = parseInt(norgeskartMatch[3]!, 10);
      return konverterTilWgs84(nord, ost, `utm${sone}` as KoordinatSystem);
    }

    // WGS84 desimal: 69.65, 18.95
    const desimalMatch = t.match(/^(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)$/);
    if (desimalMatch) {
      const a = parseFloat(desimalMatch[1]!.replace(",", "."));
      const b = parseFloat(desimalMatch[2]!.replace(",", "."));
      // Auto-detect: store tall er UTM, små er WGS84
      if (a > 90 || b > 180) {
        return konverterTilWgs84(a > b ? a : b, a > b ? b : a, coordSystem);
      }
      return { lat: a, lng: b };
    }

    return null;
  }, [coordSystem]);

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

  /** Hent korrekt GPS fra georeferert tegning (sentrum av tegningen) */
  const gpsFromTegning = useMemo(() => {
    if (!transformasjon) return null;
    try { return tegningTilGps({ x: 50, y: 50 }, transformasjon); } catch { return null; }
  }, [transformasjon]);

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

    // Finjustering steg 2: korrigér offset i eksisterende transform
    if (finjusterSteg === 2 && finjusterTegningPktRef.current && kalibTransform) {
      const tegPkt = finjusterTegningPktRef.current;
      const { a, b, tx, tz } = kalibTransform;
      // Hvor tegning-punktet BURDE mappe til (med nåværende transform)
      const forventetX = a * tegPkt.x + b * tegPkt.y + tx;
      const forventetZ = -b * tegPkt.x + a * tegPkt.y + tz;
      // Differanse = feil som må korrigeres
      const nyTx = tx + (punkt.x - forventetX);
      const nyTz = tz + (punkt.z - forventetZ);

      const ifcId = ifcModeller[0]?.id;
      if (ifcId) {
        const senterGps = ifcOpprinnelse ?? { lat: 0, lng: 0 };
        settGpsOverrideMutation.mutate({
          drawingId: ifcId,
          lat: senterGps.lat,
          lng: senterGps.lng,
          transform: { a, b, tx: nyTx, tz: nyTz },
        });
      }
      setFinjusterSteg(0);
      finjusterTegningPktRef.current = null;
      return;
    }

    // Klikk-kalibrering steg 2: lagre punkt A komplett, gå til steg 3
    if (klikkKalibSteg === 2 && kalibTegningGpsARef.current) {
      setKalibPunktA({
        tegningGps: kalibTegningGpsARef.current,
        treD: { x: punkt.x, y: punkt.y, z: punkt.z },
      });
      kalibTegningGpsARef.current = null;
      setKlikkKalibSteg(3);
      return;
    }

    // Klikk-kalibrering steg 4: beregn direkte similarity-transform fra tegning(%) til 3D(xz)
    if (klikkKalibSteg === 4 && kalibPunktA && kalibMarkørA && kalibMarkørB) {
      // Punkt A: tegning (px_a%, py_a%) → 3D (x_a, z_a)
      const pxA = kalibMarkørA.x, pyA = kalibMarkørA.y;
      const xA = kalibPunktA.treD.x, zA = kalibPunktA.treD.z;
      // Punkt B: tegning (px_b%, py_b%) → 3D (x_b, z_b)
      const pxB = kalibMarkørB!.x, pyB = kalibMarkørB!.y;
      const xB = punkt.x, zB = punkt.z;

      // Similarity transform: [x] = [a  b] [px] + [tx]
      //                        [z]   [-b a] [py]   [tz]
      const dpx = pxA - pxB, dpy = pyA - pyB;
      const dx = xA - xB, dz = zA - zB;
      const denom = dpx * dpx + dpy * dpy;

      if (denom > 0.01) {
        const a = (dx * dpx + dz * dpy) / denom;
        const b = (dx * dpy - dz * dpx) / denom;
        const tx = xA - a * pxA - b * pyA;
        const tz = zA + b * pxA - a * pyA;

        // GPS-opprinnelse fra tegningens sentrum (for kompatibilitet)
        const senterGps = transformasjon ? tegningTilGps({ x: 50, y: 50 }, transformasjon) : ifcOpprinnelse;

        const ifcId = ifcModeller[0]?.id;
        if (ifcId && senterGps) {
          settGpsOverrideMutation.mutate({
            drawingId: ifcId,
            lat: senterGps.lat,
            lng: senterGps.lng,
            transform: { a, b, tx, tz },
          });
        }
      }
      setKlikkKalibSteg(0);
      setKalibPunktA(null);
      setKalibTegningGpsB(null);
      setKalibMarkørA(null);
      setKalibMarkørB(null);
      return;
    }

    // Blokkér normal synk under kalibrering/finjustering
    if (klikkKalibSteg > 0 || finjusterSteg > 0) return;
    if (!ifcOpprinnelse) return;

    // Normal synk: direkte transform har prioritet, fallback til GPS
    if (!synkAktiv) { setTegningMarkør(null); return; }
    if (kalibTransform) {
      const pkt = treDTilTegning(punkt);
      if (pkt) setTegningMarkør({ x: pkt.x, y: pkt.y });
    } else if (transformasjon) {
      const gps = tredjeTilGpsRotert(punkt);
      if (gps) setTegningMarkør(gpsTilTegning(gps, transformasjon));
    }
  }, [valgtObjekt]); // eslint-disable-line

  // Live kamera-tracking på tegningen
  const [kameraMarkør, setKameraMarkør] = useState<{ x: number; y: number; vinkel: number } | null>(null);
  useEffect(() => {
    if (!synkAktiv || klikkKalibSteg > 0 || (!kalibTransform && !transformasjon)) {
      setKameraMarkør(null);
      return;
    }
    let aktiv = true;
    function oppdater() {
      if (!aktiv) return;
      const kam = viewerRef.current?.hentKameraPosisjon();
      if (kam) {
        let pkt: { x: number; y: number } | null = null;
        let retPkt: { x: number; y: number } | null = null;

        // Bruk kameraets target (fokuspunkt) — mer presist enn cam.position
        // fordi target ligger nærmere det man faktisk ser på
        const fokus = kam.target;

        // Retning: vektor fra kameraposisjon mot target (der kameraet ser)
        // Mye mer pålitelig enn getWorldDirection
        const retX = kam.target.x - kam.pos.x;
        const retZ = kam.target.z - kam.pos.z;
        const retLen = Math.sqrt(retX * retX + retZ * retZ) || 1;
        // Normalisér og skalér opp for presisjon i mm-modeller
        const retOff = 10000;
        const normRetX = (retX / retLen) * retOff;
        const normRetZ = (retZ / retLen) * retOff;

        if (kalibTransform && treDTilTegning) {
          pkt = treDTilTegning(fokus);
          retPkt = treDTilTegning({ x: fokus.x + normRetX, z: fokus.z + normRetZ });
        } else if (transformasjon && ifcOpprinnelse) {
          const gps = tredjeTilGpsRotert(fokus);
          if (gps) {
            pkt = gpsTilTegning(gps, transformasjon);
            const retGps = tredjeTilGpsRotert({ x: fokus.x + normRetX, y: fokus.y, z: fokus.z + normRetZ });
            if (retGps) retPkt = gpsTilTegning(retGps, transformasjon);
          }
        }

        if (pkt) {
          let vinkel = 0;
          if (retPkt) vinkel = Math.atan2(retPkt.y - pkt.y, retPkt.x - pkt.x) * (180 / Math.PI);
          setKameraMarkør({ x: pkt.x, y: pkt.y, vinkel });
        }
      }
      requestAnimationFrame(oppdater);
    }
    requestAnimationFrame(oppdater);
    return () => { aktiv = false; };
  }, [synkAktiv, kalibTransform, transformasjon, ifcOpprinnelse, klikkKalibSteg, viewerRef, treDTilTegning, tredjeTilGpsRotert]);

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

      // Finjustering steg 1: lagre tegning-punkt, gå til steg 2
      if (finjusterSteg === 1) {
        finjusterTegningPktRef.current = { ...pxProsent };
        setKalibMarkørA({ ...pxProsent });
        setFinjusterSteg(2);
        return;
      }

      // Klikk-kalibrering steg 1: lagre tegning-GPS A, gå til steg 2
      if (klikkKalibSteg === 1 && transformasjon) {
        kalibTegningGpsARef.current = tegningTilGps(pxProsent, transformasjon);
        setKalibMarkørA({ ...pxProsent });
        setKlikkKalibSteg(2);
        return;
      }

      // Klikk-kalibrering steg 3: lagre tegning-GPS B, gå til steg 4
      if (klikkKalibSteg === 3 && transformasjon) {
        setKalibTegningGpsB(tegningTilGps(pxProsent, transformasjon));
        setKalibMarkørB({ ...pxProsent });
        setKlikkKalibSteg(4);
        return;
      }

      // Blokkér synk under kalibrering/finjustering
      if (klikkKalibSteg > 0 || finjusterSteg > 0) return;

      // Synk-modus: direkte transform har prioritet
      if (!synkAktiv) return;
      let flyX: number, flyZ: number;
      if (kalibTransform) {
        const p = tegningTil3D(pxProsent);
        if (!p) return;
        flyX = p.x; flyZ = p.z;
      } else if (transformasjon && ifcOpprinnelse) {
        const gps = tegningTilGps(pxProsent, transformasjon);
        const punkt3d = gpsTil3DRotert(gps, 0);
        if (!punkt3d) return;
        flyX = punkt3d.x; flyZ = punkt3d.z;
      } else return;

      setTegningMarkør({ ...pxProsent });
      viewerRef.current?.flyTil(flyX, 0, flyZ, gulvY ?? undefined);
    },
    [synkAktiv, transformasjon, ifcOpprinnelse, coordSystem, viewerRef, klikkKalibSteg, finjusterSteg],
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
          >
            <option value="">Alle etasjer</option>
            {etasjer.map((e) => (
              <option key={e.navn} value={e.navn}>{e.navn} {e.høyde != null ? `(${e.høyde.toFixed(1)}m)` : ""}</option>
            ))}
          </select>
        )}

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

        {/* Georeferanse-status */}
        {valgtTegningId && (
          transformasjon ? (
            <span className="flex items-center gap-1.5 text-xs text-green-700">
              <MapPin size={14} />
              Georeferert
            </span>
          ) : harRedigerTilgang ? (
            <span className="text-xs text-gray-400">Georeferér i Lokasjoner</span>
          ) : null
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

        {/* GPS-kalibrering (kun felt-admin, kun når IFC finnes) */}
        {harRedigerTilgang && ifcModeller.length > 0 && (
          <button
            onClick={() => setGpsKalibrerÅpen(true)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
              harGpsOverride ? "bg-green-50 text-green-700" : harIfcGps ? "bg-gray-50 text-gray-500" : "bg-red-50 text-red-700"
            }`}
            title={harGpsOverride ? "GPS kalibrert manuelt" : harIfcGps ? "GPS fra IFC-metadata" : "Ingen GPS — klikk for å kalibrere"}
          >
            <Navigation size={14} />
            {harGpsOverride ? "GPS kalibrert" : harIfcGps ? "GPS (IFC)" : "Kalibrer GPS"}
          </button>
        )}

        {/* Klikk-kalibrering statuslinje */}
        {klikkKalibSteg > 0 && (
          <div className="pointer-events-auto flex items-center gap-2 rounded border border-purple-200 bg-purple-50 px-3 py-1.5">
            <span className="text-xs font-medium text-purple-700">
              {klikkKalibSteg === 1 && "① Klikk punkt A på tegningen (f.eks. et hjørne)"}
              {klikkKalibSteg === 2 && "② Klikk SAMME punkt A i 3D-modellen"}
              {klikkKalibSteg === 3 && "③ Klikk punkt B på tegningen (langt fra A)"}
              {klikkKalibSteg === 4 && "④ Klikk SAMME punkt B i 3D-modellen"}
            </span>
            <button
              onClick={() => { setKlikkKalibSteg(0); setKalibPunktA(null); setKalibTegningGpsB(null); setKalibMarkørA(null); setKalibMarkørB(null); kalibTegningGpsARef.current = null; }}
              className="rounded bg-white px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              Avbryt
            </button>
          </div>
        )}

        {/* Finjustering statuslinje */}
        {finjusterSteg > 0 && (
          <div className="pointer-events-auto flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-1.5">
            <span className="text-xs font-medium text-green-700">
              {finjusterSteg === 1 ? "① Klikk et punkt på tegningen" : "② Klikk SAMME punkt i 3D"}
            </span>
            <button
              onClick={() => { setFinjusterSteg(0); finjusterTegningPktRef.current = null; setKalibMarkørA(null); }}
              className="rounded bg-white px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              Avbryt
            </button>
          </div>
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
                  cursor: panStartRef.current ? "grabbing" : "default",
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
                    onLoad={(e) => setInnholdStr({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    draggable={false}
                  />
                )}
              </div>
            </div>
            {/* Markør-overlay utenfor transform (faste pikselposisjoner) */}
            {innholdStr.w > 0 && tegningMarkør && klikkKalibSteg === 0 && (() => {
              const p = pktTilPx(tegningMarkør);
              const v = tegningMarkør.vinkel ?? 0;
              return (
                <>
                  <div className="pointer-events-none absolute z-20" style={{ left: p.x, top: p.y }}>
                    <svg width="48" height="48" viewBox="-24 -24 48 48" style={{ transform: `rotate(${v}deg)`, overflow: "visible" }}>
                      <path d="M0,0 L20,-10 L20,10 Z" fill="rgba(59,130,246,0.25)" stroke="rgba(59,130,246,0.6)" strokeWidth="1" />
                    </svg>
                  </div>
                  <div className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 ring-2 ring-white" style={{ left: p.x, top: p.y }} />
                </>
              );
            })()}
            {/* Kalibrerings-markører A og B */}
            {innholdStr.w > 0 && kalibMarkørA && (() => {
              const p = pktTilPx(kalibMarkørA);
              return (
                <div className="pointer-events-none absolute z-20" style={{ left: p.x, top: p.y }}>
                  <div className="h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-purple-500 text-center text-[10px] font-bold leading-[18px] text-white">A</div>
                </div>
              );
            })()}
            {innholdStr.w > 0 && kalibMarkørB && (() => {
              const p = pktTilPx(kalibMarkørB);
              return (
                <div className="pointer-events-none absolute z-20" style={{ left: p.x, top: p.y }}>
                  <div className="h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange-500 text-center text-[10px] font-bold leading-[18px] text-white">B</div>
                </div>
              );
            })()}
            {/* Live synsfelt: prikk = øyne, trekant = blikkretning */}
            {innholdStr.w > 0 && kameraMarkør && (() => {
              const p = pktTilPx(kameraMarkør);
              return (
                <div className="pointer-events-none absolute z-30" style={{ left: p.x, top: p.y }}>
                  <svg width="100" height="100" viewBox="-50 -50 100 100" style={{ transform: `rotate(${kameraMarkør.vinkel}deg)`, overflow: "visible" }}>
                    {/* Synsfelt: trekant som åpner seg ut fra øynene */}
                    <path d="M0,0 L45,-22 L45,22 Z" fill="rgba(59,130,246,0.13)" stroke="rgba(59,130,246,0.4)" strokeWidth="0.8" />
                    {/* Øyne (prikk) */}
                    <circle cx="0" cy="0" r="4" fill="#2563eb" stroke="white" strokeWidth="1.5" />
                  </svg>
                </div>
              );
            })()}
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
        <div className="relative flex-1" />
      </div>

      {/* GPS-kalibrering modal */}
      {gpsKalibrerÅpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-sm font-semibold">IFC GPS-kalibrering</h3>
              <button onClick={() => { setGpsKalibrerÅpen(false); setGpsFeil(null); }} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {/* Nåværende GPS */}
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <div className="font-medium text-gray-700 mb-1">Nåværende GPS-opprinnelse:</div>
                {ifcOpprinnelse
                  ? <span>{ifcOpprinnelse.lat.toFixed(6)}, {ifcOpprinnelse.lng.toFixed(6)} {harGpsOverride ? <span className="text-green-600">(kalibrert)</span> : <span className="text-gray-400">(fra IFC)</span>}</span>
                  : <span className="text-red-500">Ingen GPS funnet</span>
                }
              </div>

              {/* Klikk-kalibrering — presis */}
              {transformasjon && (
                <button
                  onClick={() => {
                    setKlikkKalibSteg(1);
                    setGpsKalibrerÅpen(false);
                  }}
                  className="w-full rounded border border-purple-200 bg-purple-50 px-3 py-2.5 text-left text-sm hover:bg-purple-100"
                >
                  <div className="font-medium text-purple-800">Klikk-kalibrering (presis)</div>
                  <div className="text-xs text-purple-600">
                    Klikk et gjenkjennelig punkt på tegningen, deretter samme punkt i 3D
                  </div>
                </button>
              )}

              {/* Finjustering — korrigér offset uten å endre rotasjon/skala */}
              {kalibTransform && (
                <button
                  onClick={() => {
                    setFinjusterSteg(1);
                    setGpsKalibrerÅpen(false);
                  }}
                  className="w-full rounded border border-green-200 bg-green-50 px-3 py-2.5 text-left text-sm hover:bg-green-100"
                >
                  <div className="font-medium text-green-800">Finjuster posisjon</div>
                  <div className="text-xs text-green-600">
                    Klikk ett punkt på tegningen, deretter samme punkt i 3D — korrigerer offset
                  </div>
                </button>
              )}

              {/* Auto fra tegning — grov */}
              {gpsFromTegning && (
                <button
                  onClick={() => {
                    const ifcId = ifcModeller.find((m) => m.ifcMetadata?.gpsBreddegrad || m.gpsOverride)?.id ?? ifcModeller[0]?.id;
                    if (!ifcId) return;
                    settGpsOverrideMutation.mutate({ drawingId: ifcId, lat: gpsFromTegning.lat, lng: gpsFromTegning.lng });
                  }}
                  disabled={settGpsOverrideMutation.isPending}
                  className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm hover:bg-gray-100"
                >
                  <div className="font-medium text-gray-700">Hent fra tegningens sentrum (grov)</div>
                  <div className="text-xs text-gray-500">
                    {gpsFromTegning.lat.toFixed(6)}, {gpsFromTegning.lng.toFixed(6)}
                  </div>
                </button>
              )}

              {/* Manuell input */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Skriv inn koordinater</label>
                <input
                  type="text"
                  value={gpsInput}
                  onChange={(e) => { setGpsInput(e.target.value); setGpsFeil(null); }}
                  placeholder="69.65, 18.95  eller  653849,7732794@EPSG:25833"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
                <p className="mt-1 text-[10px] text-gray-400">WGS84 (lat, lng), UTM (nord, øst) eller Norgeskart-format</p>
              </div>

              {gpsFeil && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{gpsFeil}</div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const parsed = parserGpsInput(gpsInput);
                    if (!parsed) { setGpsFeil("Kunne ikke tolke koordinatene"); return; }
                    const ifcId = ifcModeller[0]?.id;
                    if (!ifcId) return;
                    settGpsOverrideMutation.mutate({ drawingId: ifcId, lat: parsed.lat, lng: parsed.lng });
                  }}
                  disabled={!gpsInput.trim() || settGpsOverrideMutation.isPending}
                  className="rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
                >
                  Lagre
                </button>

                {harGpsOverride && (
                  <button
                    onClick={() => {
                      const ifcId = ifcModeller.find((m) => m.gpsOverride)?.id;
                      if (ifcId) fjernGpsOverrideMutation.mutate({ drawingId: ifcId });
                    }}
                    disabled={fjernGpsOverrideMutation.isPending}
                    className="rounded border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Tilbakestill til IFC
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
