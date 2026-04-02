"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useBygning } from "@/kontekst/bygning-kontekst";
import { useTranslation } from "react-i18next";
import { Button, Select, Modal, Spinner } from "@sitedoc/ui";
import {
  beregnTransformasjon,
  tegningTilGps,
} from "@sitedoc/shared";
import type { GeoReferanse } from "@sitedoc/shared";

interface ArbeidsflopMal {
  template: { id: string; name: string; category: string };
}

interface ArbeidsflopRad {
  id: string;
  enterpriseId: string;
  responderEnterprise: { id: string; name: string } | null;
  templates: ArbeidsflopMal[];
}
import { Map, FileText, MapPin, Plus, ZoomIn, ZoomOut, ArrowLeft, Crosshair, Loader2, AlertTriangle, Info } from "lucide-react";

interface Markør {
  id: string;
  x: number;
  y: number;
  label: string;
  status: string;
}

interface IfcMetadataJson {
  prosjektnavn?: string | null;
  organisasjon?: string | null;
  forfatter?: string | null;
  programvare?: string | null;
  tidsstempel?: string | null;
  gpsBreddegrad?: number | null;
  gpsLengdegrad?: number | null;
  bygningNavn?: string | null;
  etasjer?: { navn: string; høyde: number | null }[];
  fagdisiplin?: string | null;
  fase?: string | null;
}

function IfcMetadataBadge({ metadata }: { metadata: IfcMetadataJson }) {
  const [vis, setVis] = useState(false);
  const detaljer: { label: string; verdi: string }[] = [];
  if (metadata.prosjektnavn) detaljer.push({ label: "Prosjekt", verdi: metadata.prosjektnavn });
  if (metadata.organisasjon) detaljer.push({ label: "Organisasjon", verdi: metadata.organisasjon });
  if (metadata.forfatter) detaljer.push({ label: "Forfatter", verdi: metadata.forfatter });
  if (metadata.programvare) detaljer.push({ label: "Programvare", verdi: metadata.programvare });
  if (metadata.fase) detaljer.push({ label: "Fase", verdi: metadata.fase });
  if (metadata.tidsstempel) detaljer.push({ label: "Tidsstempel", verdi: metadata.tidsstempel });
  if (metadata.gpsBreddegrad && metadata.gpsLengdegrad) {
    detaljer.push({ label: "GPS", verdi: `${metadata.gpsBreddegrad.toFixed(5)}, ${metadata.gpsLengdegrad.toFixed(5)}` });
  }
  if (metadata.etasjer && metadata.etasjer.length > 0) {
    detaljer.push({ label: "Etasjer", verdi: metadata.etasjer.map((e) => e.navn).join(", ") });
  }
  if (detaljer.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setVis(!vis)}
        className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 hover:bg-blue-100"
        title="Vis IFC-metadata"
      >
        <Info className="h-3 w-3" />
        IFC
      </button>
      {vis && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[280px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <h4 className="mb-2 text-xs font-semibold text-gray-500 uppercase">IFC-metadata</h4>
          <div className="flex flex-col gap-1.5">
            {detaljer.map((d) => (
              <div key={d.label} className="flex gap-2 text-xs">
                <span className="shrink-0 font-medium text-gray-500 w-24">{d.label}</span>
                <span className="text-gray-900 break-words">{d.verdi}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ZOOM_NIVÅER: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50];
const MIN_ZOOM = 0.25;
const MAKS_ZOOM = 50;
const STANDARD_ZOOM = 1;

export default function TegningerSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    aktivTegning,
    aktivBygning,
    posisjonsvelgerAktiv,
    fullførPosisjonsvelger,
    avbrytPosisjonsvelger,
  } = useBygning();
  const utils = trpc.useUtils();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Zoom
  const [zoom, setZoom] = useState(STANDARD_ZOOM);

  // Klikkemodus: inspeksjon (vis DWG-egenskaper) eller plassering (opprett oppgave)
  const [klikkModus, setKlikkModus] = useState<"inspeksjon" | "plassering">("plassering");

  // DWG-elementinfo ved klikk
  const [valgtElement, setValgtElement] = useState<{ lag: string; type: string; tekst: string; x: number; y: number } | null>(null);

  // Ny markør-plassering
  const [nyMarkør, setNyMarkør] = useState<{ x: number; y: number } | null>(null);
  const [visOpprettModal, setVisOpprettModal] = useState(false);
  const [opprettType, setOpprettType] = useState<"oppgave" | "sjekkliste">("oppgave");

  const [valgtMal, setValgtMal] = useState("");
  const [valgtOppretter, setValgtOppretter] = useState("");

  // GPS-koordinater ved musebevegelse over georeferert tegning
  const [gpsKoordinat, setGpsKoordinat] = useState<{ lat: number; lng: number } | null>(null);

  const [dwgPoller, setDwgPoller] = useState(false);
  const { data: tegning, isLoading } = trpc.tegning.hentMedId.useQuery(
    { id: aktivTegning?.id ?? "" },
    {
      enabled: !!aktivTegning?.id,
      refetchInterval: dwgPoller ? 3000 : false,
    },
  );

  // Start/stopp polling basert på konverteringsstatus
  useEffect(() => {
    const status = tegning?.conversionStatus;
    setDwgPoller(status === "pending" || status === "converting");
  }, [tegning?.conversionStatus]);

  // Beregn GPS-transformasjon for georefererte tegninger
  const geoRef = (tegning as unknown as { geoReference?: unknown } | undefined)?.geoReference as GeoReferanse | null;
  const transformasjon = useMemo(() => {
    if (!geoRef) return null;
    try {
      return beregnTransformasjon(geoRef);
    } catch {
      return null;
    }
  }, [geoRef]);

  // Hent eksisterende oppgavemarkører for denne tegningen
  const { data: oppgaveMarkører } = trpc.oppgave.hentForTegning.useQuery(
    { drawingId: aktivTegning?.id ?? "" },
    { enabled: !!aktivTegning?.id },
  );

  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: params.prosjektId },
    { enabled: visOpprettModal },
  );
  const { data: arbeidsforlop } = trpc.arbeidsforlop.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: visOpprettModal },
  );
  const { data: alleMaler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: visOpprettModal },
  );
  const { data: minTilgang } = trpc.gruppe.hentMinTilgang.useQuery(
    { projectId: params.prosjektId },
    { enabled: visOpprettModal },
  );

  // Auto-velg oppretter-entreprise når data lastes
  useEffect(() => {
    if (!visOpprettModal || valgtOppretter) return;
    if (mineEntrepriser && mineEntrepriser.length > 0) {
      const forste = mineEntrepriser[0];
      if (forste) setValgtOppretter(forste.id);
    }
  }, [mineEntrepriser, visOpprettModal, valgtOppretter]);

  const opprettOppgaveMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown, _vars: { title: string }) => {
      utils.oppgave.hentForTegning.invalidate({ drawingId: aktivTegning?.id ?? "" });
      lukkModal();
    },
  });

  const opprettSjekklisteMutation = trpc.sjekkliste.opprett.useMutation({
    onSuccess: () => {
      lukkModal();
    },
  });

  const provKonverteringIgjenMutation = trpc.tegning.provKonverteringIgjen.useMutation({
    onSuccess: () => {
      utils.tegning.hentMedId.invalidate({ id: aktivTegning?.id ?? "" });
    },
  });

  // Reset zoom ved tegningsbytte
  useEffect(() => {
    setZoom(STANDARD_ZOOM);
    setNyMarkør(null);
    setGpsKoordinat(null);
  }, [aktivTegning?.id]);

  // Hent SVG-innhold for inline rendering med zoom-justert linjetykkelse
  const svgUrl = tegning?.fileUrl ? `/api${tegning.fileUrl}` : null;
  const erSvgFil = (tegning?.fileType ?? "") === "svg";
  const [svgInnhold, setSvgInnhold] = useState<string | null>(null);
  useEffect(() => {
    if (!svgUrl || !erSvgFil) {
      setSvgInnhold(null);
      return;
    }
    fetch(svgUrl)
      .then((res) => res.text())
      .then((tekst) => {
        // Fjern faste width/height og inject zoom-justert stroke-width CSS
        let tilpasset = tekst.replace(
          /<svg([^>]*)>/,
          (_match, attrs: string) => {
            const uten = attrs
              .replace(/\s*width="[^"]*"/g, "")
              .replace(/\s*height="[^"]*"/g, "");
            return `<svg${uten} width="100%" height="auto" style="display:block">`;
          },
        );
        // Fjern eksisterende <style> og erstatt med zoom-bevisst versjon
        tilpasset = tilpasset.replace(/<style>[^<]*<\/style>/g, "");
        // Inject ny style rett etter <svg ...>
        tilpasset = tilpasset.replace(
          /(<svg[^>]*>)/,
          `$1\n<style>line,polyline,circle,path,ellipse,polygon{stroke-width:calc(1.5 / var(--svg-zoom, 1)) !important}</style>`,
        );
        setSvgInnhold(tilpasset);
      })
      .catch(() => setSvgInnhold(null));
  }, [svgUrl, erSvgFil]);

  // SVG-variant for inspeksjonsmodus med bredere treffområde og hover-highlight
  const svgInnholdInspeksjon = useMemo(() => {
    if (!svgInnhold) return null;
    // Erstatt stroke-width CSS med bredere versjon + pointer-events stroke + hover-effekt
    return svgInnhold.replace(
      /<style>[^<]*<\/style>/,
      `<style>
        line,polyline,circle,path,ellipse,polygon{
          stroke-width:calc(1.5 / var(--svg-zoom, 1)) !important;
        }
        [data-layer]{
          stroke-width:calc(5 / var(--svg-zoom, 1)) !important;
          pointer-events:stroke;
          cursor:pointer;
        }
        [data-layer]:hover{
          stroke:#3b82f6 !important;
        }
      </style>`,
    );
  }, [svgInnhold]);

  // Musehjul-zoom sentrert på musepekeren
  // Re-registrer når tegning endres (containerRef mountes etter data-lasting)
  const tegningId = aktivTegning?.id;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();

      const rect = el!.getBoundingClientRect();
      // Museposisjon i innholdet (piksler fra topp-venstre av scrollbart innhold)
      const contentX = e.clientX - rect.left + el!.scrollLeft;
      const contentY = e.clientY - rect.top + el!.scrollTop;
      // Museposisjon i viewporten (piksler fra topp-venstre av synlig område)
      const viewX = e.clientX - rect.left;
      const viewY = e.clientY - rect.top;

      setZoom((prev) => {
        const faktor = e.deltaY > 0 ? 0.8 : 1.25;
        const neste = Math.min(MAKS_ZOOM, Math.max(MIN_ZOOM, prev * faktor));
        const skala = neste / prev;

        requestAnimationFrame(() => {
          if (!el) return;
          // Innholdspunktet under musen skaleres med faktoren
          el.scrollLeft = contentX * skala - viewX;
          el.scrollTop = contentY * skala - viewY;
        });

        return neste;
      });
    }

    // Dra-for-å-panorere (midterste museknapp eller venstre + dra)
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      dragging = false; // Settes til true ved bevegelse
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el!.scrollLeft;
      startScrollTop = el!.scrollTop;
    }

    function handlePointerMove(e: PointerEvent) {
      if (e.buttons !== 1) return; // Venstre knapp holdt nede
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.sqrt(dx * dx + dy * dy) > 5) {
        dragging = true;
        el!.style.cursor = "grabbing";
      }
      if (dragging) {
        el!.scrollLeft = startScrollLeft - dx;
        el!.scrollTop = startScrollTop - dy;
      }
    }

    function handlePointerUp() {
      dragging = false;
      el!.style.cursor = "";
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [tegningId, isLoading]);

  function lukkModal() {
    setVisOpprettModal(false);
    setNyMarkør(null);
    setValgtMal("");
    setValgtOppretter("");
  }

  const handleMuseBevegelse = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!transformasjon) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    try {
      const gps = tegningTilGps({ x, y }, transformasjon);
      setGpsKoordinat(gps);
    } catch {
      setGpsKoordinat(null);
    }
  }, [transformasjon]);

  const handleMuseForlat = useCallback(() => {
    setGpsKoordinat(null);
  }, []);

  // Skille mellom pan (dra) og klikk (plassering)
  const museNedPosRef = useRef<{ x: number; y: number } | null>(null);
  const handleMuseNed = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    museNedPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleBildeKlikk = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignorer klikk hvis musen ble dratt (pan)
    if (museNedPosRef.current) {
      const dx = e.clientX - museNedPosRef.current.x;
      const dy = e.clientY - museNedPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;
    }

    // Inspeksjonsmodus: vis DWG-egenskaper
    if (klikkModus === "inspeksjon") {
      const target = e.target as SVGElement;
      const lag = target?.getAttribute?.("data-layer");
      const elementType = target?.getAttribute?.("data-type");
      if (lag || elementType) {
        // For tekst-elementer: hent tekstinnholdet
        const tekst = (elementType === "TEXT" || elementType === "MTEXT")
          ? (target.textContent ?? "")
          : "";
        setValgtElement({
          lag: lag ?? "",
          type: elementType ?? "",
          tekst,
          x: e.clientX,
          y: e.clientY,
        });
      } else {
        setValgtElement(null);
      }
      return;
    }
    setValgtElement(null);

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Posisjonsvelger-modus: returner posisjon og naviger tilbake
    if (posisjonsvelgerAktiv && aktivTegning) {
      fullførPosisjonsvelger({
        drawingId: aktivTegning.id,
        drawingName: aktivTegning.name,
        positionX: Math.round(x * 100) / 100,
        positionY: Math.round(y * 100) / 100,
      });
      router.back();
      return;
    }

    setNyMarkør({ x, y });
    setVisOpprettModal(true);
  }, [posisjonsvelgerAktiv, aktivTegning, fullførPosisjonsvelger, router, klikkModus]);

  // Finn matchende arbeidsforløp for valgt oppretter + mal
  const alleArbeidsforlop = (arbeidsforlop ?? []) as unknown as ArbeidsflopRad[];
  const matchendeArbeidsforlop = alleArbeidsforlop.find((af) =>
    af.enterpriseId === valgtOppretter &&
    af.templates.some((wt) => wt.template.id === valgtMal),
  );
  const utledetSvarer = matchendeArbeidsforlop?.responderEnterprise?.id ?? valgtOppretter;

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal || !valgtOppretter) return;

    if (opprettType === "oppgave") {
      opprettOppgaveMutation.mutate({
        templateId: valgtMal,
        creatorEnterpriseId: valgtOppretter,
        responderEnterpriseId: utledetSvarer,
        title: "Ny oppgave",
        drawingId: aktivTegning?.id,
        positionX: nyMarkør?.x,
        positionY: nyMarkør?.y,
        workflowId: matchendeArbeidsforlop?.id,
      });
    } else {
      opprettSjekklisteMutation.mutate({
        templateId: valgtMal,
        creatorEnterpriseId: valgtOppretter,
        responderEnterpriseId: utledetSvarer,
        buildingId: aktivBygning?.id,
        drawingId: aktivTegning?.id,
        workflowId: matchendeArbeidsforlop?.id,
      });
    }
  }

  function zoomInn() {
    setZoom((prev) => {
      const neste = ZOOM_NIVÅER.find((z) => z > prev);
      return neste ?? prev;
    });
  }

  function zoomUt() {
    setZoom((prev) => {
      const forrige = [...ZOOM_NIVÅER].reverse().find((z) => z < prev);
      return forrige ?? prev;
    });
  }

  // Markører fra eksisterende oppgaver
  const markører: Markør[] = (oppgaveMarkører ?? [])
    .filter((o) => o.positionX != null && o.positionY != null)
    .map((o) => ({
      id: o.id,
      x: o.positionX!,
      y: o.positionY!,
      label: o.template?.prefix
        ? `${o.template.prefix}-${String(o.number ?? 0).padStart(3, "0")}`
        : o.title,
      status: o.status,
    }));

  // Filtrerte maler basert på tilgang:
  // 1. Admin / manage_field → alle maler
  // 2. Enterprise-arbeidsforløp → maler knyttet via workflow + HMS (alle kan opprette HMS)
  // 3. Domene-grupper (HMS, Bygg) → maler med matchende domain
  const filtrerMaler = (() => {
    if (!valgtOppretter) return [];
    const alleMalerTypet = (alleMaler ?? []) as Array<{ id: string; name: string; category: string; domain: string | null }>;
    const kategoriMaler = alleMalerTypet.filter((m) => m.category === opprettType);

    // Admin eller manage_field → alle maler av riktig kategori
    if (minTilgang?.erAdmin || minTilgang?.tillatelser.includes("manage_field")) {
      return kategoriMaler.map((m) => ({ id: m.id, name: m.name }));
    }

    const synligeMalIder = new Set<string>();

    // Entreprise-arbeidsforløp: maler knyttet til valgt oppretter via workflow
    for (const af of alleArbeidsforlop) {
      if (af.enterpriseId !== valgtOppretter) continue;
      for (const wt of af.templates) {
        if (wt.template.category === opprettType) {
          synligeMalIder.add(wt.template.id);
        }
      }
    }

    // HMS-maler er alltid tilgjengelige for entreprise-medlemmer
    for (const mal of kategoriMaler) {
      if (mal.domain === "hms") {
        synligeMalIder.add(mal.id);
      }
    }

    // Domene-tilgang: maler som matcher brukerens gruppe-domener
    if (minTilgang?.domener) {
      for (const mal of kategoriMaler) {
        if (mal.domain && minTilgang.domener.includes(mal.domain)) {
          synligeMalIder.add(mal.id);
        }
      }
    }

    return kategoriMaler
      .filter((m) => synligeMalIder.has(m.id))
      .map((m) => ({ id: m.id, name: m.name }));
  })();

  const oppretterAlternativer = (mineEntrepriser ?? []).map((e) => ({ value: e.id, label: e.name }));

  // Ingen tegning valgt
  if (!aktivTegning) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Map className="mx-auto mb-4 h-16 w-16 text-gray-200" />
          <p className="text-lg font-medium text-gray-400">
            {aktivBygning
              ? t("tegninger.velgTegning")
              : t("tegninger.velgLokasjonOgTegning")}
          </p>
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

  if (!tegning) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">Tegningen ble ikke funnet</p>
      </div>
    );
  }

  const fileUrl = tegning.fileUrl ? `/api${tegning.fileUrl}` : null;
  const fileType = tegning.fileType ?? "";
  const erBilde = ["png", "jpg", "jpeg", "svg"].includes(fileType);
  const erDwgKonvertering = tegning.conversionStatus === "pending" || tegning.conversionStatus === "converting";
  const dwgFeilet = tegning.conversionStatus === "failed";
  const erUkonvertertDwg = fileType === "dwg"; // DWG kan ikke vises direkte i nettleser
  const erLaster = opprettOppgaveMutation.isPending || opprettSjekklisteMutation.isPending;
  const zoomProsent = Math.round(zoom * 100);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Posisjonsvelger-banner */}
      {posisjonsvelgerAktiv && (
        <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-6 py-2.5">
          <Crosshair className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Klikk i tegningen for å velge posisjon
          </span>
          <div className="flex-1" />
          <button
            onClick={() => {
              avbrytPosisjonsvelger();
              router.back();
            }}
            className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Avbryt
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-2">
        <FileText className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">{tegning.name}</span>
        {tegning.drawingNumber && (
          <span className="text-sm text-gray-500">({tegning.drawingNumber})</span>
        )}
        {tegning.revision && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            Rev. {tegning.revision}
          </span>
        )}
        {tegning.coordinateSystem && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
            {tegning.coordinateSystem.toUpperCase()}
          </span>
        )}
        {(tegning as unknown as { ifcMetadata: IfcMetadataJson | null }).ifcMetadata && (
          <IfcMetadataBadge metadata={(tegning as unknown as { ifcMetadata: IfcMetadataJson }).ifcMetadata} />
        )}
        <div className="flex-1" />

        {/* Zoom-kontroller */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomUt}
            disabled={zoom <= MIN_ZOOM}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
            title="Zoom ut"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(STANDARD_ZOOM)}
            className="min-w-[48px] rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            title="Tilbakestill zoom"
          >
            {zoomProsent}%
          </button>
          <button
            onClick={zoomInn}
            disabled={zoom >= MAKS_ZOOM}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
            title="Zoom inn"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Klikkemodus — kun for DWG-konverterte SVG-tegninger */}
        {erSvgFil && (
          <>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <div className="flex items-center rounded border border-gray-200">
              <button
                onClick={() => { setKlikkModus("plassering"); setValgtElement(null); }}
                className={`flex items-center gap-1 rounded-l px-2 py-1 text-xs ${
                  klikkModus === "plassering" ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Klikk for å opprette oppgave"
              >
                <MapPin className="h-3 w-3" />
                Oppgave
              </button>
              <button
                onClick={() => { setKlikkModus("inspeksjon"); setNyMarkør(null); }}
                className={`flex items-center gap-1 rounded-r px-2 py-1 text-xs ${
                  klikkModus === "inspeksjon" ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Klikk for å se DWG-egenskaper"
              >
                <Info className="h-3 w-3" />
                Inspeksjon
              </button>
            </div>
          </>
        )}

        {/* GPS-koordinater for georefererte tegninger */}
        {transformasjon && (
          <>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <MapPin className="h-3.5 w-3.5 text-green-600" />
            {gpsKoordinat ? (
              <span className="font-mono text-xs text-gray-600">
                {gpsKoordinat.lat.toFixed(6)}, {gpsKoordinat.lng.toFixed(6)}
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                Beveg musen over tegningen
              </span>
            )}
          </>
        )}

        {!posisjonsvelgerAktiv && (
          <>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <span className="text-xs text-gray-400">
              Klikk i tegningen for å opprette
            </span>
          </>
        )}
      </div>

      {/* DWG konverteringsstatus */}
      {erDwgKonvertering && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            DWG-filen konverteres til visningsformat. Dette kan ta opptil 2 minutter...
          </span>
        </div>
      )}
      {dwgFeilet && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-800">
            DWG-konvertering feilet: {tegning.conversionError ?? "Ukjent feil"}
          </span>
          <button
            onClick={() => provKonverteringIgjenMutation.mutate({ id: tegning.id })}
            disabled={provKonverteringIgjenMutation.isPending}
            className="ml-auto rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Prøv igjen
          </button>
        </div>
      )}

      {/* Tegningsvisning med markører */}
      {fileUrl && !erDwgKonvertering && !erUkonvertertDwg ? (
        erBilde ? (
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-gray-100"
          >
            <div
              className={`relative inline-block ${klikkModus === "inspeksjon" ? "cursor-pointer" : "cursor-crosshair"}`}
              style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
              onMouseDown={handleMuseNed}
              onClick={handleBildeKlikk}
              onMouseMove={handleMuseBevegelse}
              onMouseLeave={handleMuseForlat}
            >
              {/* SVG: inline rendering med zoom-justert linjetykkelse */}
              {erSvgFil && svgInnhold ? (
                <div
                  className="block w-full"
                  style={{ "--svg-zoom": zoom } as React.CSSProperties}
                  dangerouslySetInnerHTML={{ __html: klikkModus === "inspeksjon" && svgInnholdInspeksjon ? svgInnholdInspeksjon : svgInnhold }}
                />
              ) : (
                <img
                  src={fileUrl}
                  alt={tegning.name}
                  className="block w-full"
                  crossOrigin="anonymous"
                  draggable={false}
                />
              )}

              {/* Eksisterende markører */}
              {markører.map((m) => (
                <button
                  key={m.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashbord/${params.prosjektId}/oppgaver?oppgave=${m.id}`);
                  }}
                  className="group absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  title={m.label}
                >
                  <MapPin className="h-6 w-6 fill-red-500 text-red-700 drop-shadow-md transition-transform group-hover:scale-125" />
                  <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {m.label}
                  </span>
                </button>
              ))}

              {/* Ny markør (klikket posisjon) */}
              {nyMarkør && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
                  style={{ left: `${nyMarkør.x}%`, top: `${nyMarkør.y}%` }}
                >
                  <MapPin className="h-7 w-7 fill-blue-500 text-blue-700 drop-shadow-lg animate-bounce" />
                </div>
              )}
            </div>

            {/* DWG element-info popup */}
            {valgtElement && erSvgFil && (
              <div
                className="fixed z-50 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg"
                style={{ left: valgtElement.x + 12, top: valgtElement.y - 10 }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    {valgtElement.lag && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Lag</span>
                        <span className="text-sm font-semibold text-gray-900">{valgtElement.lag}</span>
                      </div>
                    )}
                    {valgtElement.type && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Type</span>
                        <span className="text-sm text-gray-700">{valgtElement.type}</span>
                      </div>
                    )}
                    {valgtElement.tekst && (
                      <div className="mt-1 flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-500">Tekst</span>
                        <span className="text-sm text-gray-900">{valgtElement.tekst}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setValgtElement(null)}
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* PDF — iframe med klikkbar overlay for markørplassering */
          <div ref={containerRef} className="relative flex-1 overflow-hidden">
            <iframe
              src={fileUrl}
              title={tegning.name}
              className="h-full w-full border-0"
            />
            {/* Overlay som fanger klikk for markørplassering */}
            <div
              className="absolute inset-0 cursor-crosshair"
              onMouseDown={handleMuseNed}
              onClick={handleBildeKlikk}
              onMouseMove={handleMuseBevegelse}
              onMouseLeave={handleMuseForlat}
              style={{ background: "transparent" }}
            />
            {/* Markører over PDF */}
            {markører.map((m) => (
              <button
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashbord/${params.prosjektId}/oppgaver?oppgave=${m.id}`);
                }}
                className="group absolute -translate-x-1/2 -translate-y-full pointer-events-auto"
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                title={m.label}
              >
                <MapPin className="h-6 w-6 fill-red-500 text-red-700 drop-shadow-md transition-transform group-hover:scale-125" />
                <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {m.label}
                </span>
              </button>
            ))}
            {nyMarkør && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
                style={{ left: `${nyMarkør.x}%`, top: `${nyMarkør.y}%` }}
              >
                <MapPin className="h-7 w-7 fill-blue-500 text-blue-700 drop-shadow-lg animate-bounce" />
              </div>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gray-50">
          {erUkonvertertDwg ? (
            <>
              <p className="text-sm text-gray-500">DWG-filen må konverteres før den kan vises</p>
              <button
                onClick={() => provKonverteringIgjenMutation.mutate({ id: tegning.id })}
                disabled={provKonverteringIgjenMutation.isPending}
                className="rounded bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:opacity-50"
              >
                {provKonverteringIgjenMutation.isPending ? "Starter..." : "Konverter DWG"}
              </button>
            </>
          ) : (
            <p className="text-gray-400">Ingen fil tilgjengelig</p>
          )}
        </div>
      )}

      {/* Opprett modal */}
      <Modal
        open={visOpprettModal}
        onClose={lukkModal}
        title="Opprett fra tegning"
      >
        <form onSubmit={handleOpprett} className="flex flex-col gap-4">
          {/* Type-valg */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setOpprettType("oppgave"); setValgtMal(""); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                opprettType === "oppgave"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Oppgave
            </button>
            <button
              type="button"
              onClick={() => { setOpprettType("sjekkliste"); setValgtMal(""); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                opprettType === "sjekkliste"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Sjekkliste
            </button>
          </div>

          {oppretterAlternativer.length > 1 && (
            <Select
              label="Entreprise"
              options={oppretterAlternativer}
              value={valgtOppretter}
              onChange={(e) => { setValgtOppretter(e.target.value); setValgtMal(""); }}
              placeholder="Velg entreprise..."
            />
          )}

          <Select
            label="Mal"
            options={filtrerMaler.map((m) => ({ value: m.id, label: m.name }))}
            value={valgtMal}
            onChange={(e) => setValgtMal(e.target.value)}
            placeholder="Velg mal..."
          />

          {/* Vis svarer-info hvis utledet fra arbeidsforløp */}
          {valgtMal && matchendeArbeidsforlop?.responderEnterprise && (
            <p className="text-xs text-gray-500">
              Svarer: {matchendeArbeidsforlop.responderEnterprise.name}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={erLaster} disabled={!valgtMal || !valgtOppretter}>
              <Plus className="mr-1.5 h-4 w-4" />
              Opprett {opprettType === "oppgave" ? "oppgave" : "sjekkliste"}
            </Button>
            <Button type="button" variant="secondary" onClick={lukkModal}>
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
