"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc";
import { useBygning } from "@/kontekst/bygning-kontekst";
import { useBilder } from "@/kontekst/bilder-kontekst";
import { Spinner } from "@sitedoc/ui";
import { BildeLightbox, type LightboxBilde } from "@/components/BildeLightbox";
import {
  beregnTransformasjon,
  gpsTilTegning,
  erInnenforTegning,
} from "@sitedoc/shared";
import type { GeoReferanse } from "@sitedoc/shared";
import {
  Image as ImageIcon,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  MapPin,
  Calendar,
  X,
  Crosshair,
  Info,
  MousePointer,
  Download,
  Trash2,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// Typer
// ──────────────────────────────────────────────────────────────

interface TegningData {
  id: string;
  name: string;
  floor: string | null;
  geoReference: unknown;
  fileUrl: string | null;
  fileType: string | null;
  buildingId: string | null;
}

interface NormalisertBilde {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsEnabled: boolean;
  createdAt: string;
  parentType: "sjekkliste" | "oppgave";
  parentId: string;
  parentLabel: string;
  parentDrawingId: string | null;
  parentDrawing: TegningData | null;
  positionX: number | null;
  positionY: number | null;
}

// ──────────────────────────────────────────────────────────────
// Kartkomponent (dynamisk import — Leaflet krever window)
// ──────────────────────────────────────────────────────────────

const BildeKart = dynamic(
  () => import("./BildeKart").then((m) => m.BildeKart),
  { ssr: false, loading: () => <Spinner size="lg" /> },
);

// ──────────────────────────────────────────────────────────────
// Zoom-konstanter
// ──────────────────────────────────────────────────────────────

const ZOOM_NIVÅER: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
const MIN_ZOOM = 0.25;
const MAKS_ZOOM = 3;
const STANDARD_ZOOM = 1;

// ──────────────────────────────────────────────────────────────
// Hjelpefunksjoner
// ──────────────────────────────────────────────────────────────

function formaterDato(dato: string): string {
  return new Date(dato).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function datoGruppe(dato: string): string {
  const d = new Date(dato);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function harGpsUtenforTegninger(
  bilde: NormalisertBilde,
  alleTegninger: TegningData[],
): boolean {
  if (bilde.gpsLat == null || bilde.gpsLng == null) return false;
  const gps = { lat: bilde.gpsLat, lng: bilde.gpsLng };
  for (const tegning of alleTegninger) {
    if (!tegning.geoReference) continue;
    try {
      const t = beregnTransformasjon(tegning.geoReference as GeoReferanse);
      if (erInnenforTegning(gps, t)) return false;
    } catch {
      // Ugyldig georeferanse, hopp over
    }
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// Hovedkomponent
// ──────────────────────────────────────────────────────────────

export default function BilderSide() {
  const params = useParams<{ prosjektId: string }>();
  const { aktivTegning } = useBygning();
  const {
    visningsmodus,
    plasseringsmodus,
    settPlasseringsmodus,
    datoFra,
    datoTil,
    settDatoFra,
    settDatoTil,
    områdevalg,
    settOmrådevalg,
  } = useBilder();

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxBilder, setLightboxBilder] = useState<LightboxBilde[]>([]);
  const [zoom, setZoom] = useState(STANDARD_ZOOM);
  const [velgerOmråde, setVelgerOmråde] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [datoHurtigvalg, setDatoHurtigvalg] = useState<string>("alle");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.bilde.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // Hent tegningsdata (med fileUrl) for valgt tegning
  const { data: tegningDetalj } = trpc.tegning.hentMedId.useQuery(
    { id: aktivTegning?.id ?? "" },
    { enabled: !!aktivTegning?.id && visningsmodus === "tegning" },
  );

  // Reset zoom ved tegningsbytte
  useEffect(() => {
    setZoom(STANDARD_ZOOM);
    settOmrådevalg(null);
  }, [aktivTegning?.id, settOmrådevalg]);

  // Musehjul-zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((prev) => Math.min(MAKS_ZOOM, Math.max(MIN_ZOOM, prev + (e.deltaY > 0 ? -0.25 : 0.25))));
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Normaliser bilder ──

  const alleBilder = useMemo((): NormalisertBilde[] => {
    if (!data) return [];
    const resultat: NormalisertBilde[] = [];

    for (const b of data.sjekklisteBilder) {
      const c = b.checklist;
      if (!c) continue;
      const prefix = c.template?.prefix ?? "SJK";
      const nummer = String(c.number ?? 0).padStart(3, "0");
      resultat.push({
        id: b.id,
        fileUrl: b.fileUrl,
        fileName: b.fileName,
        fileSize: b.fileSize,
        gpsLat: b.gpsLat,
        gpsLng: b.gpsLng,
        gpsEnabled: b.gpsEnabled,
        createdAt: String(b.createdAt),
        parentType: "sjekkliste",
        parentId: c.id,
        parentLabel: `${prefix}-${nummer}`,
        parentDrawingId: c.drawingId,
        parentDrawing: c.drawing as TegningData | null,
        positionX: null,
        positionY: null,
      });
    }

    for (const b of data.oppgaveBilder) {
      const t = b.task;
      if (!t) continue;
      const prefix = t.template?.prefix ?? "OPP";
      const nummer = String(t.number ?? 0).padStart(3, "0");
      resultat.push({
        id: b.id,
        fileUrl: b.fileUrl,
        fileName: b.fileName,
        fileSize: b.fileSize,
        gpsLat: b.gpsLat,
        gpsLng: b.gpsLng,
        gpsEnabled: b.gpsEnabled,
        createdAt: String(b.createdAt),
        parentType: "oppgave",
        parentId: t.id,
        parentLabel: `${prefix}-${nummer} ${t.title}`,
        parentDrawingId: t.drawingId,
        parentDrawing: t.drawing as TegningData | null,
        positionX: t.positionX,
        positionY: t.positionY,
      });
    }

    resultat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return resultat;
  }, [data]);

  // ── Alle unike tegninger (for GPS-sjekk i listevisning) ──

  const alleTegninger = useMemo((): TegningData[] => {
    const map = new Map<string, TegningData>();
    for (const b of alleBilder) {
      if (b.parentDrawing) map.set(b.parentDrawing.id, b.parentDrawing);
    }
    return [...map.values()];
  }, [alleBilder]);

  // ── Datofilter ──

  const datoFiltrerteBilder = useMemo(() => {
    return alleBilder.filter((b) => {
      const d = new Date(b.createdAt);
      if (datoFra && d < datoFra) return false;
      if (datoTil && d > new Date(datoTil.getTime() + 86400000)) return false;
      return true;
    });
  }, [alleBilder, datoFra, datoTil]);

  // ── Hurtigvalg-håndtering ──

  function handleHurtigvalg(valg: string) {
    setDatoHurtigvalg(valg);
    const nå = new Date();
    switch (valg) {
      case "uke":
        settDatoFra(new Date(nå.getTime() - 7 * 86400000));
        settDatoTil(null);
        break;
      case "mnd":
        settDatoFra(new Date(nå.getTime() - 30 * 86400000));
        settDatoTil(null);
        break;
      case "3mnd":
        settDatoFra(new Date(nå.getTime() - 90 * 86400000));
        settDatoTil(null);
        break;
      default:
        settDatoFra(null);
        settDatoTil(null);
    }
  }

  // ── Lightbox ──

  function åpneLightbox(bilder: NormalisertBilde[], index: number) {
    setLightboxBilder(
      bilder.map((b) => ({
        id: b.id,
        fileUrl: b.fileUrl,
        fileName: b.fileName,
        createdAt: b.createdAt,
        gpsLat: b.gpsLat,
        gpsLng: b.gpsLng,
        parentType: b.parentType,
        parentId: b.parentId,
        parentLabel: b.parentLabel,
        prosjektId: params.prosjektId,
      })),
    );
    setLightboxIndex(index);
  }

  // ── Zoom-funksjoner ──

  function zoomInn() {
    setZoom((prev) => ZOOM_NIVÅER.find((z) => z > prev) ?? prev);
  }

  function zoomUt() {
    setZoom((prev) => [...ZOOM_NIVÅER].reverse().find((z) => z < prev) ?? prev);
  }

  // ── Områdevalg (drag-rektangel) ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!velgerOmråde) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setDragStart({ x, y });
      setDragCurrent({ x, y });
    },
    [velgerOmråde],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragStart) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setDragCurrent({ x, y });
    },
    [dragStart],
  );

  const handleMouseUp = useCallback(() => {
    if (dragStart && dragCurrent) {
      const x1 = Math.min(dragStart.x, dragCurrent.x);
      const y1 = Math.min(dragStart.y, dragCurrent.y);
      const x2 = Math.max(dragStart.x, dragCurrent.x);
      const y2 = Math.max(dragStart.y, dragCurrent.y);
      if (Math.abs(x2 - x1) > 1 && Math.abs(y2 - y1) > 1) {
        settOmrådevalg({ x1, y1, x2, y2 });
      }
    }
    setDragStart(null);
    setDragCurrent(null);
    setVelgerOmråde(false);
  }, [dragStart, dragCurrent, settOmrådevalg]);

  // ──────────────────────────────────────────────────────────
  // LISTEVISNING
  // ──────────────────────────────────────────────────────────

  if (visningsmodus === "liste") {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      );
    }

    if (datoFiltrerteBilder.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <ImageIcon className="h-16 w-16 text-gray-200" />
          <p className="text-lg font-medium text-gray-400">Ingen bilder i prosjektet</p>
        </div>
      );
    }

    // Grupper etter dato → rapport
    const datoGrupper = new Map<string, Map<string, NormalisertBilde[]>>();
    for (const b of datoFiltrerteBilder) {
      const dg = datoGruppe(b.createdAt);
      if (!datoGrupper.has(dg)) datoGrupper.set(dg, new Map());
      const rapportMap = datoGrupper.get(dg)!;
      const key = `${b.parentType}:${b.parentId}`;
      if (!rapportMap.has(key)) rapportMap.set(key, []);
      rapportMap.get(key)!.push(b);
    }

    const sorterteDatoer = [...datoGrupper.keys()].sort((a, b) => b.localeCompare(a));

    return (
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {/* Datofilter */}
        <div className="mb-4 flex items-center gap-2">
          {["alle", "uke", "mnd", "3mnd"].map((v) => (
            <button
              key={v}
              onClick={() => handleHurtigvalg(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                datoHurtigvalg === v
                  ? "bg-blue-100 text-blue-700"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {v === "alle" ? "Alle" : v === "uke" ? "Siste uke" : v === "mnd" ? "Siste måned" : "Siste 3 mnd"}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-gray-400">
            {datoFiltrerteBilder.length} bilder
          </span>
        </div>

        {/* Datogrupper */}
        <div className="flex flex-col gap-6">
          {sorterteDatoer.map((dato) => {
            const rapportMap = datoGrupper.get(dato)!;
            return (
              <div key={dato}>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">
                  <Calendar className="mr-1.5 inline h-4 w-4 text-gray-400" />
                  {formaterDato(`${dato}T00:00:00`)}
                </h3>
                <div className="flex flex-col gap-4">
                  {[...rapportMap.entries()].map(([key, bilder]) => {
                    const first = bilder[0]!;
                    const parentUrl = first.parentType === "sjekkliste"
                      ? `/dashbord/${params.prosjektId}/sjekklister?sjekkliste=${first.parentId}`
                      : `/dashbord/${params.prosjektId}/oppgaver?oppgave=${first.parentId}`;

                    return (
                      <div key={key} className="rounded-lg border border-gray-200 bg-white p-3">
                        <Link
                          href={parentUrl}
                          className="mb-2 block text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {first.parentLabel}
                        </Link>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {bilder.map((b, idx) => {
                            const gpsVarsel =
                              b.gpsLat != null &&
                              b.gpsLng != null &&
                              harGpsUtenforTegninger(b, alleTegninger);
                            return (
                              <button
                                key={b.id}
                                onClick={() => åpneLightbox(bilder, idx)}
                                className="group relative aspect-square overflow-hidden rounded-md border border-gray-100 bg-gray-50"
                              >
                                <img
                                  src={`/api${b.fileUrl}`}
                                  alt={b.fileName}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  crossOrigin="anonymous"
                                  loading="lazy"
                                />
                                {gpsVarsel && (
                                  <div className="absolute right-1 top-1 rounded-full bg-amber-100 p-0.5" title="GPS utenfor alle tegninger">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <BildeLightbox
            bilder={lightboxBilder}
            aktivIndex={lightboxIndex}
            onLukk={() => setLightboxIndex(null)}
            onEndreIndex={setLightboxIndex}
          />
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // KARTVISNING
  // ──────────────────────────────────────────────────────────

  if (visningsmodus === "kart") {
    const bilderMedGps = datoFiltrerteBilder.filter(
      (b) => b.gpsLat != null && b.gpsLng != null,
    );

    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      );
    }

    if (bilderMedGps.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-gray-400">
            <MapPin className="mx-auto mb-2 h-10 w-10 text-gray-300" />
            <p className="text-sm">Ingen bilder med GPS-posisjon</p>
          </div>
        </div>
      );
    }

    return (
      <KartVisningMedValg
        bilderMedGps={bilderMedGps}
        prosjektId={params.prosjektId}
        lightboxIndex={lightboxIndex}
        lightboxBilder={lightboxBilder}
        setLightboxIndex={setLightboxIndex}
        setLightboxBilder={setLightboxBilder}
      />
    );
  }

  // ──────────────────────────────────────────────────────────
  // TEGNINGSVISNING
  // ──────────────────────────────────────────────────────────

  if (!aktivTegning) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <ImageIcon className="mx-auto mb-4 h-16 w-16 text-gray-200" />
          <p className="text-lg font-medium text-gray-400">Velg en tegning i panelet</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Tegningsdata fra hentMedId-query (har fileUrl/fileType)
  // Cast for å unngå TS2589 (excessively deep tRPC type)
  const td = tegningDetalj as unknown as {
    fileUrl?: string | null;
    fileType?: string | null;
    geoReference?: unknown;
  } | undefined;
  const fileUrl = td?.fileUrl ? `/api${td.fileUrl}` : null;
  const fileType = td?.fileType ?? "";
  const erBilde = ["png", "jpg", "jpeg"].includes(fileType);
  const zoomProsent = Math.round(zoom * 100);

  // Beregn transformasjon for GPS-modus
  const geoRef = td?.geoReference as GeoReferanse | null;
  let transformasjon: ReturnType<typeof beregnTransformasjon> | null = null;
  if (geoRef) {
    try {
      transformasjon = beregnTransformasjon(geoRef);
    } catch {
      // Ugyldig georeferanse
    }
  }

  // Filtrer bilder for denne tegningen basert på plasseringsmodus
  type BildeMedPosisjon = NormalisertBilde & { tegningX: number; tegningY: number; erPrikk: boolean };

  const tegningBilder: BildeMedPosisjon[] = [];
  const uklassifiserteBilder: NormalisertBilde[] = [];

  for (const b of datoFiltrerteBilder) {
    if (plasseringsmodus === "rapportlokasjon") {
      // Modus A: Rapportlokasjon
      if (b.parentDrawingId === aktivTegning.id) {
        if (b.positionX != null && b.positionY != null) {
          tegningBilder.push({ ...b, tegningX: b.positionX, tegningY: b.positionY, erPrikk: true });
        } else {
          tegningBilder.push({ ...b, tegningX: 0, tegningY: 0, erPrikk: false });
        }
      } else if (!b.parentDrawingId) {
        uklassifiserteBilder.push(b);
      }
    } else {
      // Modus B: GPS-plassering
      if (b.gpsLat != null && b.gpsLng != null && transformasjon) {
        const gps = { lat: b.gpsLat, lng: b.gpsLng };
        if (erInnenforTegning(gps, transformasjon)) {
          const pos = gpsTilTegning(gps, transformasjon);
          tegningBilder.push({ ...b, tegningX: pos.x, tegningY: pos.y, erPrikk: true });
        }
      } else if (b.gpsLat == null || b.gpsLng == null) {
        uklassifiserteBilder.push(b);
      }
    }
  }

  // Områdefilter
  const prikkBilder = tegningBilder.filter((b) => b.erPrikk);
  const listeBilder = tegningBilder.filter((b) => !b.erPrikk);
  const områdeFiltrerteBilder = områdevalg
    ? prikkBilder.filter(
        (b) =>
          b.tegningX >= områdevalg.x1 &&
          b.tegningX <= områdevalg.x2 &&
          b.tegningY >= områdevalg.y1 &&
          b.tegningY <= områdevalg.y2,
      )
    : null;

  // Drag-rektangel beregning
  const dragRect = dragStart && dragCurrent
    ? {
        left: `${Math.min(dragStart.x, dragCurrent.x)}%`,
        top: `${Math.min(dragStart.y, dragCurrent.y)}%`,
        width: `${Math.abs(dragCurrent.x - dragStart.x)}%`,
        height: `${Math.abs(dragCurrent.y - dragStart.y)}%`,
      }
    : null;

  // Bilder som vises i grid under tegningen
  const gridBilder = områdeFiltrerteBilder ?? [...listeBilder, ...uklassifiserteBilder];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Verktøylinje */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
        {/* Plasseringsmodus */}
        <div className="flex gap-1 rounded-md bg-gray-100 p-0.5">
          <button
            onClick={() => settPlasseringsmodus("rapportlokasjon")}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              plasseringsmodus === "rapportlokasjon"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Rapportlokasjon
          </button>
          <button
            onClick={() => settPlasseringsmodus("gps")}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              plasseringsmodus === "gps"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            GPS
          </button>
        </div>

        {plasseringsmodus === "gps" && (
          <span className="flex items-center gap-1 text-[11px] text-amber-600">
            <Info className="h-3 w-3" />
            GPS kan være unøyaktig innendørs
          </span>
        )}

        <div className="mx-1 h-4 w-px bg-gray-200" />

        {/* Datofilter */}
        {["alle", "uke", "mnd", "3mnd"].map((v) => (
          <button
            key={v}
            onClick={() => handleHurtigvalg(v)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              datoHurtigvalg === v
                ? "bg-blue-100 text-blue-700"
                : "text-gray-100 hover:bg-gray-100 text-gray-500"
            }`}
          >
            {v === "alle" ? "Alle" : v === "uke" ? "Siste uke" : v === "mnd" ? "Siste mnd" : "3 mnd"}
          </button>
        ))}

        <div className="mx-1 h-4 w-px bg-gray-200" />

        {/* Områdevalg */}
        <button
          onClick={() => {
            setVelgerOmråde(!velgerOmråde);
            if (!velgerOmråde) settOmrådevalg(null);
          }}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            velgerOmråde
              ? "bg-blue-100 text-blue-700"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <Crosshair className="h-3.5 w-3.5" />
          Velg område
        </button>
        {områdevalg && (
          <button
            onClick={() => settOmrådevalg(null)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
          >
            <X className="h-3.5 w-3.5" />
            Fjern utvalg
          </button>
        )}

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomUt}
            disabled={zoom <= MIN_ZOOM}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(STANDARD_ZOOM)}
            className="min-w-[48px] rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            {zoomProsent}%
          </button>
          <button
            onClick={zoomInn}
            disabled={zoom >= MAKS_ZOOM}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <span className="text-xs text-gray-400">{prikkBilder.length} bilder</span>
      </div>

      {/* Tegning + prikker */}
      {fileUrl ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-gray-100"
          >
            {erBilde ? (
              <div
                className={`relative inline-block ${velgerOmråde ? "cursor-crosshair" : ""}`}
                style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <img
                  src={fileUrl}
                  alt={aktivTegning.name}
                  className="block w-full"
                  crossOrigin="anonymous"
                  draggable={false}
                />

                {/* Prikker */}
                {prikkBilder.map((b) => (
                  <button
                    key={b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      åpneLightbox([b], 0);
                    }}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${b.tegningX}%`, top: `${b.tegningY}%` }}
                    title={b.parentLabel}
                  >
                    <div
                      className={`h-3.5 w-3.5 rounded-full drop-shadow-md transition-transform group-hover:scale-150 ${
                        plasseringsmodus === "rapportlokasjon"
                          ? "bg-blue-600 border-2 border-white"
                          : "bg-blue-400 border-2 border-dashed border-white"
                      }`}
                    />
                    <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {b.parentLabel}
                    </span>
                  </button>
                ))}

                {/* Områdevalg-rektangel */}
                {dragRect && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                    style={dragRect}
                  />
                )}

                {/* Lagret områdevalg */}
                {områdevalg && !dragStart && (
                  <div
                    className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
                    style={{
                      left: `${områdevalg.x1}%`,
                      top: `${områdevalg.y1}%`,
                      width: `${områdevalg.x2 - områdevalg.x1}%`,
                      height: `${områdevalg.y2 - områdevalg.y1}%`,
                    }}
                  />
                )}
              </div>
            ) : (
              /* PDF med overlay */
              <div className="relative h-full w-full">
                <iframe
                  src={fileUrl}
                  title={aktivTegning.name}
                  className="h-full w-full border-0"
                />
                <div
                  className={`absolute inset-0 ${velgerOmråde ? "cursor-crosshair" : ""}`}
                  style={{ background: "transparent" }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  {prikkBilder.map((b) => (
                    <button
                      key={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        åpneLightbox([b], 0);
                      }}
                      className="group absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                      style={{ left: `${b.tegningX}%`, top: `${b.tegningY}%` }}
                      title={b.parentLabel}
                    >
                      <div
                        className={`h-3.5 w-3.5 rounded-full drop-shadow-md transition-transform group-hover:scale-150 ${
                          plasseringsmodus === "rapportlokasjon"
                            ? "bg-blue-600 border-2 border-white"
                            : "bg-blue-400 border-2 border-dashed border-white"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bildeliste under tegningen */}
          {gridBilder.length > 0 && (
            <div className="border-t border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-xs font-semibold text-gray-600">
                  {områdeFiltrerteBilder
                    ? `${områdeFiltrerteBilder.length} bilder i valgt område`
                    : uklassifiserteBilder.length > 0
                      ? "Bilder uten plassering"
                      : "Bilder uten posisjon på tegningen"}
                </h4>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                {gridBilder.map((b, idx) => (
                  <button
                    key={b.id}
                    onClick={() => åpneLightbox(gridBilder, idx)}
                    className="group relative aspect-square overflow-hidden rounded border border-gray-100 bg-gray-50"
                  >
                    <img
                      src={`/api${b.fileUrl}`}
                      alt={b.fileName}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      crossOrigin="anonymous"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <p className="text-gray-400">Ingen fil tilgjengelig for denne tegningen</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <BildeLightbox
          bilder={lightboxBilder}
          aktivIndex={lightboxIndex}
          onLukk={() => setLightboxIndex(null)}
          onEndreIndex={setLightboxIndex}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Kartvisning med velgemodus og eksport                              */
/* ================================================================== */

function KartVisningMedValg({
  bilderMedGps,
  prosjektId,
  lightboxIndex,
  lightboxBilder,
  setLightboxIndex,
  setLightboxBilder,
}: {
  bilderMedGps: NormalisertBilde[];
  prosjektId: string;
  lightboxIndex: number | null;
  lightboxBilder: LightboxBilde[];
  setLightboxIndex: (i: number | null) => void;
  setLightboxBilder: (b: LightboxBilde[]) => void;
}) {
  const [velgModus, setVelgModus] = useState(false);
  const [valgteBildeIder, setValgteBildeIder] = useState<Set<string>>(new Set());
  const [eksporterer, setEksporterer] = useState(false);

  const valgteBilder = useMemo(
    () =>
      bilderMedGps
        .filter((b) => valgteBildeIder.has(b.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [bilderMedGps, valgteBildeIder],
  );

  const handleVelgBilder = useCallback(
    (indekser: number[]) => {
      setValgteBildeIder((prev) => {
        const neste = new Set(prev);
        for (const i of indekser) {
          const bilde = bilderMedGps[i];
          if (bilde) {
            if (neste.has(bilde.id)) neste.delete(bilde.id);
            else neste.add(bilde.id);
          }
        }
        return neste;
      });
    },
    [bilderMedGps],
  );

  const handleKlikkBilde = useCallback(
    (index: number) => {
      setLightboxBilder(
        bilderMedGps.map((b) => ({
          id: b.id,
          fileUrl: b.fileUrl,
          fileName: b.fileName,
          createdAt: b.createdAt,
          gpsLat: b.gpsLat,
          gpsLng: b.gpsLng,
          parentType: b.parentType,
          parentId: b.parentId,
          parentLabel: b.parentLabel,
          prosjektId,
        })),
      );
      setLightboxIndex(index);
    },
    [bilderMedGps, prosjektId, setLightboxBilder, setLightboxIndex],
  );

  async function eksporterValgte() {
    if (valgteBilder.length === 0) return;
    setEksporterer(true);
    try {
      // Bygg HTML for utskrift — 2 bilder per rad, maksimert for A4
      const html = `
        <html>
        <head>
          <title>Bildeeksport — SiteDoc</title>
          <style>
            @page { margin: 10mm; size: A4; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; color: #333; }
            .header { padding: 4mm 0 6mm; border-bottom: 1px solid #ddd; margin-bottom: 4mm; }
            .header h1 { font-size: 16px; }
            .header .info { font-size: 10px; color: #666; margin-top: 2px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
            .bilde { page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
            .bilde img { width: 100%; aspect-ratio: 5/4; object-fit: cover; display: block; }
            .meta { padding: 2mm 3mm; font-size: 8px; line-height: 1.4; background: #f9fafb; }
            .meta .nr { font-weight: 600; font-size: 9px; color: #111; }
            .meta .dato { color: #555; }
            .meta .gps { font-family: monospace; color: #888; font-size: 7px; }
            .meta .rapport { color: #444; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Bildeeksport</h1>
            <div class="info">${valgteBilder.length} bilder · ${new Date(valgteBilder[0]!.createdAt).toLocaleDateString("nb-NO")} – ${new Date(valgteBilder[valgteBilder.length - 1]!.createdAt).toLocaleDateString("nb-NO")}</div>
          </div>
          <div class="grid">
          ${valgteBilder.map((b, i) => `
            <div class="bilde">
              <img src="/api${b.fileUrl}" crossorigin="anonymous" />
              <div class="meta">
                <span class="nr">${i + 1}.</span>
                <span class="dato">${new Date(b.createdAt).toLocaleString("nb-NO")}</span>
                ${b.gpsLat != null ? `<span class="gps"> · ${b.gpsLat.toFixed(5)}, ${b.gpsLng?.toFixed(5)}</span>` : ""}
                <div class="rapport">${b.parentLabel}</div>
              </div>
            </div>
          `).join("")}
          </div>
        </body>
        </html>
      `;
      const vindu = window.open("", "_blank");
      if (vindu) {
        vindu.document.write(html);
        vindu.document.close();
        vindu.focus();
        // Vent på at bilder lastes
        setTimeout(() => vindu.print(), 1500);
      }
    } finally {
      setEksporterer(false);
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Kart */}
      <div className="relative flex-1">
        {/* Velgemodus-knapp */}
        <div className="absolute right-3 top-3 z-[1000] flex gap-1.5">
          <button
            onClick={() => {
              setVelgModus(!velgModus);
              if (velgModus) setValgteBildeIder(new Set());
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shadow-md ${
              velgModus
                ? "bg-sitedoc-primary text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <MousePointer className="h-3.5 w-3.5" />
            {velgModus ? "Avslutt valg" : "Velg bilder"}
          </button>
        </div>

        <BildeKart
          bilder={bilderMedGps}
          onKlikkBilde={handleKlikkBilde}
          onVelgBilder={handleVelgBilder}
          velgModus={velgModus}
          valgteBilder={valgteBildeIder}
        />
      </div>

      {/* Sidepanel med valgte bilder */}
      {velgModus && valgteBilder.length > 0 && (
        <div className="flex w-[280px] flex-col border-l border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {valgteBilder.length} valgt
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setValgteBildeIder(new Set())}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Fjern alle"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={eksporterValgte}
                disabled={eksporterer}
                className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Eksporter
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {valgteBilder.map((b, i) => (
              <div
                key={b.id}
                className="flex items-center gap-3 border-b border-gray-100 px-3 py-2"
              >
                <img
                  src={`/api${b.fileUrl}`}
                  alt={b.fileName}
                  className="h-12 w-12 shrink-0 rounded object-cover"
                  crossOrigin="anonymous"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-900">
                    {i + 1}. {b.parentLabel}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(b.createdAt).toLocaleString("nb-NO")}
                  </p>
                  {b.gpsLat != null && (
                    <p className="font-mono text-[10px] text-gray-400">
                      {b.gpsLat.toFixed(5)}, {b.gpsLng?.toFixed(5)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setValgteBildeIder((prev) => {
                      const neste = new Set(prev);
                      neste.delete(b.id);
                      return neste;
                    });
                  }}
                  className="shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <BildeLightbox
          bilder={lightboxBilder}
          aktivIndex={lightboxIndex}
          onLukk={() => setLightboxIndex(null)}
          onEndreIndex={setLightboxIndex}
        />
      )}
    </div>
  );
}
