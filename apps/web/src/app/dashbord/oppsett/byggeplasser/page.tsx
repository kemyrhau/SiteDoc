"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { rensSvg } from "@/lib/sanitize";
import { Button, Input, Select, Textarea, Modal, Spinner, EmptyState } from "@sitedoc/ui";
import { KnappMedForklaring } from "@/components/KnappMedForklaring";
import { useTranslation } from "react-i18next";
import {
  DRAWING_DISCIPLINES,
  DRAWING_TYPES,
} from "@sitedoc/shared";
import {
  Plus,
  LayoutGrid,
  Trash2,
  Pencil,
  MoreVertical,
  X,
  Upload,
  Building2,
  Box,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  MapPin,
  ExternalLink,
  Search,
  ListChecks,
  Download,
} from "lucide-react";
import { GeoReferanseEditor } from "@/components/GeoReferanseEditor";
import { SignertBilde } from "@/components/SignertBilde";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { OmradeAdmin } from "./_components/OmradeAdmin";
import {
  TegningSerieTabell,
  type SerieRad,
  type LiveTegning,
} from "@/components/tegning/TegningSerieTabell";
import {
  lastOppSerie,
  grupperTegningerEtterFag,
  type TegningRadEndring,
} from "@/lib/tegningSerieOpplasting";

// Leaflet-kart må lastes klient-side (window-avhengig) — SSR av.
const KartVelgerDynamic = dynamic(
  () => import("@/components/KartVelger").then((m) => m.KartVelger),
  { ssr: false },
);

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

type TegningRad = {
  id: string;
  name: string;
  byggeplassId: string | null;
  fileUrl: string;
  fileType: string;
  floor?: string | null;
  geoReference?: unknown;
  // T1 (R6/R4): fag-gruppering + serietabell leser disse fra Drawing.
  drawingNumber?: string | null;
  discipline?: string | null;
  drawingType?: string | null;
  originator?: string | null;
  scale?: string | null;
  revision?: string | null;
  conversionStatus?: string | null;
  // T2: hvilken serie tegningen ligger i (null = «ikke i serie», en gyldig tilstand).
  serieId?: string | null;
};

// T2: en tegningsserie (merk-og-flytt-gruppering). Metadata er standardverdier.
type SerieRadData = {
  id: string;
  name: string;
  discipline?: string | null;
  originator?: string | null;
  description?: string | null;
  byggeplassId?: string | null;
  _count?: { drawings: number };
};

interface TegningGruppe {
  navn: string;
  tegninger: TegningRad[];
  ikon: "utomhus" | "etasje" | "uten";
}

/* ------------------------------------------------------------------ */
/*  grupperTegninger — grupperer tegninger etter Utomhus / etasje       */
/* ------------------------------------------------------------------ */

function grupperTegninger(tegninger: TegningRad[]): TegningGruppe[] {
  const utomhus: TegningRad[] = [];
  const etasjeMap: Record<string, TegningRad[]> = {};
  const utenEtasje: TegningRad[] = [];

  for (const t of tegninger) {
    if (t.floor) {
      // Etasje-tegninger grupperes etter etasje — uavhengig av geoReference
      const etasje = t.floor;
      if (!etasjeMap[etasje]) etasjeMap[etasje] = [];
      etasjeMap[etasje]!.push(t);
    } else if (t.geoReference) {
      // Kun tegninger UTEN etasje med geoReference → "Utomhus"
      utomhus.push(t);
    } else {
      utenEtasje.push(t);
    }
  }

  const grupper: TegningGruppe[] = [];

  if (utomhus.length > 0) {
    grupper.push({ navn: "Utomhus", tegninger: utomhus, ikon: "utomhus" });
  }

  const sortedEtasjer = Object.entries(etasjeMap).sort(([a], [b]) =>
    a.localeCompare(b, "nb-NO", { numeric: true }),
  );
  for (const [etasje, tegningerIGruppe] of sortedEtasjer) {
    grupper.push({ navn: etasje, tegninger: tegningerIGruppe, ikon: "etasje" });
  }

  if (utenEtasje.length > 0) {
    grupper.push({ navn: "Uten etasje", tegninger: utenEtasje, ikon: "uten" });
  }

  return grupper;
}

/* ------------------------------------------------------------------ */
/*  RedigerLokasjon — fullskjerm overlay for å redigere en lokasjon     */
/* ------------------------------------------------------------------ */

function RedigerLokasjon({
  lokasjonId,
  onLukk,
}: {
  lokasjonId: string;
  onLukk: () => void;
}) {
  const { prosjektId } = useProsjekt();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const filInputRef = useRef<HTMLInputElement>(null);
  const [visTilføyMeny, setVisTilføyMeny] = useState(false);
  const [visMerMeny, setVisMerMeny] = useState(false);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  // Zoom og panorering
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [erDraging, setErDraging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const forhåndsvisningRef = useRef<HTMLDivElement>(null);

  // Georeferanse-visning
  const [visGeoEditor, setVisGeoEditor] = useState(false);

  // Inline SVG for vector-effect:non-scaling-stroke
  const [svgInnhold, setSvgInnhold] = useState<string | null>(null);

  // Zoom via native event listener (React onWheel er passiv og kan ikke preventDefault)
  useEffect(() => {
    const container = forhåndsvisningRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;

      setZoom((prev) => {
        const faktor = e.deltaY > 0 ? 0.9 : 1.1;
        const neste = Math.min(50, Math.max(0.1, prev * faktor));
        const skalaDiff = neste - prev;

        setPan((p) => ({
          x: p.x - skalaDiff * (mx - 0.5) * rect.width,
          y: p.y - skalaDiff * (my - 0.5) * rect.height,
        }));

        return neste;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setErDraging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!erDraging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, [erDraging]);

  const handleMouseUp = useCallback(() => {
    setErDraging(false);
  }, []);

  const nullstillVisning = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const velgTegning = useCallback((id: string | null) => {
    setValgtTegningId(id);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setVisGeoEditor(false);
    setSvgInnhold(null);
  }, []);


  // Opplastingstilstand
  const [lasterOpp, setLasterOpp] = useState(false);
  const [visMetadataModal, setVisMetadataModal] = useState(false);
  const [opplastetFil, setOpplastetFil] = useState<{
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null>(null);

  // Metadata-skjema
  const [metaNavn, setMetaNavn] = useState("");
  const [metaTegningsnr, setMetaTegningsnr] = useState("");
  const [metaDisiplin, setMetaDisiplin] = useState("");
  const [metaType, setMetaType] = useState("");
  const [metaRevisjon, setMetaRevisjon] = useState("A");
  const [metaEtasje, setMetaEtasje] = useState("");
  const [metaMålestokk, setMetaMålestokk] = useState("");
  const [metaOpphav, setMetaOpphav] = useState("");
  const [metaBeskrivelse, setMetaBeskrivelse] = useState("");

  // T1 serieopplasting (R1/R2/R4/R5): felles-felt + etterfyllings-tabell.
  const [valgteFiler, setValgteFiler] = useState<File[]>([]);
  const [visSerieModal, setVisSerieModal] = useState(false); // felles-felt-skjema
  const [serieFag, setSerieFag] = useState("");
  const [serieOpphav, setSerieOpphav] = useState("");
  const [serieEtasje, setSerieEtasje] = useState("");
  const [serieRader, setSerieRader] = useState<SerieRad[]>([]);
  const [visSerieTabell, setVisSerieTabell] = useState(false);
  const [radLagrerId, setRadLagrerId] = useState<string | null>(null);
  const serieFilerRef = useRef<Record<string, File>>({}); // tempId → File (for «Prøv igjen»)
  // T1b R4: samme tabell gjenbrukes til å redigere eksisterende tegninger
  // (ikke bare rett etter opplasting). Styrer kun tittelteksten.
  const [erRedigerModus, setErRedigerModus] = useState(false);
  // T1b (vis og tilbake): skjul tabell-overlayet (uten å avmontere det, så
  // ulagrede radendringer bevares) mens brukeren ser tegningen i sidens egen
  // forhåndsvisning. Floating «Tilbake til tabellen» henter overlayet tilbake.
  const [serieTabellSkjult, setSerieTabellSkjult] = useState(false);
  // R6: fag-gruppering som standard, med veksel til etasje-grupperingen.
  const [grupperFag, setGrupperFag] = useState(true);
  // T1b (kollaps): hvilke grupper er kollapset, nøklet på «fag|etasje::navn».
  // Huskes pr. byggeplass i localStorage. Standard: alt åpent (tom mengde).
  const [kollapsedeGrupper, setKollapsedeGrupper] = useState<Record<string, true>>({});

  // T2 (merk-og-flytt): avkryssings-utvalg i lista + serie-dialoger.
  const [merkeModus, setMerkeModus] = useState(false);
  const [valgteTegninger, setValgteTegninger] = useState<Set<string>>(new Set());
  // Serie-dialog: null id = «ny serie fra valgte»; satt id = rediger eksisterende.
  const [visSerieDialog, setVisSerieDialog] = useState(false);
  const [serieDialogId, setSerieDialogId] = useState<string | null>(null);
  const [serieNavn, setSerieNavn] = useState("");
  const [serieFagFelt, setSerieFagFelt] = useState("");
  const [serieOpphavFelt, setSerieOpphavFelt] = useState("");
  const [serieBeskrFelt, setSerieBeskrFelt] = useState("");
  // «Flytt til serie»-velger (eksisterende serier).
  const [visFlyttTilSerie, setVisFlyttTilSerie] = useState(false);

  // Poll konverterings-status mens tabellen er åpen og minst én rad konverterer.
  const skalPolle =
    visSerieTabell && serieRader.some((r) => r.status === "konverterer");
  const { data: lokasjon } = trpc.bygning.hentMedId.useQuery(
    { id: lokasjonId },
    { refetchInterval: skalPolle ? 2500 : false },
  );

  // Hent SVG-innhold for inline rendering med zoom-justert linjetykkelse
  useEffect(() => {
    if (!valgtTegningId) { setSvgInnhold(null); return; }
    const tegning = (lokasjon?.drawings as TegningRad[] | undefined)?.find((t) => t.id === valgtTegningId);
    if (!tegning || (tegning.fileType ?? "") !== "svg" || !tegning.fileUrl) {
      setSvgInnhold(null);
      return;
    }
    fetch(`/api${tegning.fileUrl}`)
      .then((res) => res.text())
      .then((raaTekst) => {
        // Saniter opplastet/konvertert SVG FØR våre egne, betrodde transformasjoner
        const tekst = rensSvg(raaTekst);
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
        tilpasset = tilpasset.replace(
          /(<svg[^>]*>)/,
          `$1\n<style>line,polyline,circle,path,ellipse,polygon{stroke-width:calc(1.5 / var(--svg-zoom, 1)) !important}</style>`,
        );
        setSvgInnhold(tilpasset);
      })
      .catch(() => setSvgInnhold(null));
  }, [valgtTegningId, lokasjon?.drawings]);

  const { data: alleTegninger } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const tilknyttMutation = trpc.tegning.tilknyttByggeplass.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate({ id: lokasjonId });
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const opprettTegningMutation = trpc.tegning.opprett.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate({ id: lokasjonId });
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisMetadataModal(false);
      nullstillMetadata();
    },
  });

  // Serie: egen opprett-mutasjon (uten enkel-modal-sideeffektene) + per-rad oppdater.
  const serieOpprettMutation = trpc.tegning.opprett.useMutation();
  const radOppdaterMutation = trpc.tegning.oppdater.useMutation();

  // DWG-1 (D2): er DWG/DXF-konvertering tilgjengelig på serveren? Når ikke, avvises
  // .dwg/.dxf i opplastingsdialogen med forklaring (ingen stille `failed`).
  const { data: konvKapasitet } = trpc.tegning.konverteringKapasitet.useQuery(undefined, {
    staleTime: 60_000,
  });
  const [dwgSperreAntall, setDwgSperreAntall] = useState<number | null>(null);

  // T2 (tegningsserie): seriene på byggeplassen + merk-og-flytt-mutasjoner.
  const { data: serier } = trpc.tegningsserie.hentForByggeplass.useQuery(
    { byggeplassId: lokasjonId },
    { enabled: !!lokasjonId },
  );
  const serieListe = (serier ?? []) as SerieRadData[];

  function invaliderEtterSerie() {
    utils.bygning.hentMedId.invalidate({ id: lokasjonId });
    utils.tegningsserie.hentForByggeplass.invalidate({ byggeplassId: lokasjonId });
    utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
  }
  const opprettSerieMutation = trpc.tegningsserie.opprett.useMutation({ onSuccess: invaliderEtterSerie });
  const oppdaterSerieMutation = trpc.tegningsserie.oppdater.useMutation({ onSuccess: invaliderEtterSerie });
  const slettSerieMutation = trpc.tegningsserie.slett.useMutation({ onSuccess: invaliderEtterSerie });
  const flyttTilSerieMutation = trpc.tegningsserie.flyttTegninger.useMutation({ onSuccess: invaliderEtterSerie });
  const brukPaAlleMutation = trpc.tegningsserie.brukPaAlle.useMutation({ onSuccess: invaliderEtterSerie });

  function nullstillMetadata() {
    setOpplastetFil(null);
    setMetaNavn("");
    setMetaTegningsnr("");
    setMetaDisiplin("");
    setMetaType("");
    setMetaRevisjon("A");
    setMetaEtasje("");
    setMetaMålestokk("");
    setMetaOpphav("");
    setMetaBeskrivelse("");
  }

  // R1: filfeltet tar nå flere filer. Én fil → dagens enkel-modal (bevart);
  // flere → serieflyten (felles-felt-skjema → etterfyllings-tabell).
  async function handleFilValgt(e: React.ChangeEvent<HTMLInputElement>) {
    let filer = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (filer.length === 0) return;

    // D2: avvis .dwg/.dxf når serveren mangler konverterer — forklar i stedet for stille `failed`.
    if (konvKapasitet && konvKapasitet.dwg === false) {
      const erDwg = (f: File) => /\.(dwg|dxf)$/i.test(f.name);
      const avviste = filer.filter(erDwg);
      if (avviste.length > 0) {
        setDwgSperreAntall(avviste.length);
        filer = filer.filter((f) => !erDwg(f));
        if (filer.length === 0) return;
      }
    }

    if (filer.length === 1) {
      await lastOppEnkelFil(filer[0]!);
      return;
    }
    // Serie: velg felles-felt først, last opp etterpå.
    setValgteFiler(filer);
    setSerieFag("");
    setSerieOpphav("");
    setSerieEtasje("");
    setVisSerieModal(true);
  }

  // Dagens enkeltopplasting (bevart): last opp én fil → åpne detalj-modal.
  async function lastOppEnkelFil(fil: File) {
    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? t("tegninger.serie.opplastingFeilet"));
        return;
      }
      const data = await res.json();
      setOpplastetFil(data);
      setMetaNavn(fil.name.replace(/\.[^.]+$/, ""));
      setVisMetadataModal(true);
    } catch {
      alert(t("tegninger.serie.opplastingFeilet"));
    } finally {
      setLasterOpp(false);
    }
  }

  function settRad(tempId: string, endring: Partial<SerieRad>) {
    setSerieRader((rader) =>
      rader.map((r) => (r.tempId === tempId ? { ...r, ...endring } : r)),
    );
  }

  const konvTilStatus = (cs: string | null | undefined): SerieRad["status"] =>
    cs === "converting" || cs === "pending" ? "konverterer" : "klar";

  // Last opp én fil + opprett tegning (R2/R5). Kaster ved feil (isoleres av kalleren).
  async function behandleSerieFil(tempId: string, fil: File) {
    if (!prosjektId) throw new Error(t("tegninger.serie.opplastingFeilet"));
    const formData = new FormData();
    formData.append("file", fil);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? t("tegninger.serie.opplastingFeilet"));
    }
    const opplastet = await res.json();
    const created = await serieOpprettMutation.mutateAsync({
      projectId: prosjektId,
      byggeplassId: lokasjonId,
      name: fil.name.replace(/\.[^.]+$/, ""),
      discipline: (serieFag || undefined) as typeof DRAWING_DISCIPLINES[number] | undefined,
      floor: serieEtasje || undefined,
      originator: serieOpphav || undefined,
      fileUrl: opplastet.fileUrl,
      fileType: opplastet.fileType,
      fileSize: opplastet.fileSize,
    });
    settRad(tempId, {
      drawingId: created.id,
      forslag: created.metadataForslag,
      status: konvTilStatus(created.conversionStatus),
    });
  }

  // R1/R2/R5: start serieopplasting fra felles-feltene.
  async function startSerie() {
    const filer = valgteFiler;
    if (filer.length === 0) return;
    const rader: SerieRad[] = filer.map((f, i) => ({
      tempId: `rad-${i}`,
      fileName: f.name,
      drawingId: null,
      status: "laster",
    }));
    serieFilerRef.current = {};
    rader.forEach((r, i) => { serieFilerRef.current[r.tempId] = filer[i]!; });
    setSerieRader(rader);
    setVisSerieModal(false);
    setVisSerieTabell(true);

    await lastOppSerie(
      filer.length,
      (i) => behandleSerieFil(rader[i]!.tempId, filer[i]!),
      {
        maksSamtidig: 4,
        onStatus: (i, status, feil) => {
          if (status === "laster") settRad(rader[i]!.tempId, { status: "laster", feil: undefined });
          else if (status === "feilet") settRad(rader[i]!.tempId, { status: "feilet", feil });
        },
      },
    );
    utils.bygning.hentMedId.invalidate({ id: lokasjonId });
    utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
  }

  // «Prøv igjen» for én feilet fil (R5).
  async function prøvIgjenSerie(tempId: string) {
    const fil = serieFilerRef.current[tempId];
    if (!fil) return;
    settRad(tempId, { status: "laster", feil: undefined });
    try {
      await behandleSerieFil(tempId, fil);
      utils.bygning.hentMedId.invalidate({ id: lokasjonId });
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    } catch (e) {
      settRad(tempId, { status: "feilet", feil: e instanceof Error ? e.message : t("tegninger.serie.opplastingFeilet") });
    }
  }

  // R4: lagre én rad (kun endrede felt) via tegning.oppdater. Enum-feltene
  // (discipline/drawingType) kommer fra enum-selects → trygt å caste til input-typen.
  async function lagreRad(endring: TegningRadEndring) {
    setRadLagrerId(endring.id);
    try {
      await radOppdaterMutation.mutateAsync(
        endring as Parameters<typeof radOppdaterMutation.mutateAsync>[0],
      );
      await utils.bygning.hentMedId.invalidate({ id: lokasjonId });
      await utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    } finally {
      setRadLagrerId(null);
    }
  }

  // T1b R4: bygg en tabellrad fra en alt opprettet tegning (ingen fil-opplasting,
  // ingen R3-forslag — verdiene finnes allerede på Drawing). tempId = drawingId.
  const radFraTegning = useCallback(
    (d: TegningRad): SerieRad => ({
      tempId: d.id,
      fileName: d.name,
      drawingId: d.id,
      status: konvTilStatus(d.conversionStatus),
    }),
    [],
  );

  // «Rediger flere»: åpne tabellen med ALLE tegningene på byggeplassen.
  function åpneRedigerFlere() {
    serieFilerRef.current = {};
    setSerieRader(tegninger.map(radFraTegning));
    setErRedigerModus(true);
    setSerieTabellSkjult(false);
    setVisSerieTabell(true);
  }

  // Rediger ÉN tegning i samme tabell (filtrert til den ene) — ingen ny dialog.
  function åpneRedigerEn(d: TegningRad) {
    serieFilerRef.current = {};
    setSerieRader([radFraTegning(d)]);
    setErRedigerModus(true);
    setSerieTabellSkjult(false);
    setVisSerieTabell(true);
  }

  // T1b (vis og tilbake): vis tegningen i sidens egen forhåndsvisning uten å
  // avmontere tabellen (ulagrede radendringer bevares). Skjuler kun overlayet.
  function visTegningFraTabell(drawingId: string) {
    velgTegning(drawingId);
    setSerieTabellSkjult(true);
  }

  function lukkSerieTabell() {
    setVisSerieTabell(false);
    setSerieTabellSkjult(false);
    setErRedigerModus(false);
  }

  // T1b (kollaps): nøkkel pr. gruppe, skilt på gjeldende grupperingsmodus slik at
  // fag- og etasje-grupper med samme navn ikke kolliderer.
  const kollapsNokkel = useCallback(
    (navn: string) => `${grupperFag ? "fag" : "etasje"}::${navn}`,
    [grupperFag],
  );

  // Last kollaps-valg fra localStorage pr. byggeplass (try/catch — privat modus
  // / full disk / korrupt JSON skal aldri velte siden).
  useEffect(() => {
    try {
      const rå = localStorage.getItem(`sitedoc_tegning_kollaps_${lokasjonId}`);
      setKollapsedeGrupper(rå ? (JSON.parse(rå) as Record<string, true>) : {});
    } catch {
      setKollapsedeGrupper({});
    }
  }, [lokasjonId]);

  function toggleKollapsNokkel(nokkel: string) {
    setKollapsedeGrupper((forrige) => {
      const neste = { ...forrige };
      if (neste[nokkel]) delete neste[nokkel];
      else neste[nokkel] = true;
      try {
        localStorage.setItem(`sitedoc_tegning_kollaps_${lokasjonId}`, JSON.stringify(neste));
      } catch {
        // Lagring feilet (privat modus / kvote) — valget gjelder for økten uansett.
      }
      return neste;
    });
  }
  function toggleKollaps(navn: string) {
    toggleKollapsNokkel(kollapsNokkel(navn));
  }
  // T2: seriegrupper har egen kollaps-nøkkel (uavhengig av fag/etasje-veksel).
  const serieKollapsNokkel = (serieId: string) => `serie::${serieId}`;

  /* ---- T2: merk-og-flytt-handlere ---- */

  function toggleMerkeModus() {
    setMerkeModus((på) => {
      if (på) setValgteTegninger(new Set()); // slå av → tøm utvalg
      return !på;
    });
  }
  function toggleValgt(id: string) {
    setValgteTegninger((forrige) => {
      const neste = new Set(forrige);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }
  function tømUtvalg() {
    setValgteTegninger(new Set());
  }

  // T2: last ned valgte tegninger / en hel serie som ZIP. Serveren pakker
  // originalfilene og strømmer; prosjektet utledes server-side fra id-ene/serien
  // (ingen prosjekt-id fra klienten). En vanlig GET-navigering bærer cookie-sesjonen,
  // og Content-Disposition fra ruten gir zip-navnet.
  //
  // HEAD-preflight FØRST: samme vakter uten strøm, så en 413 (over 200 tegninger /
  // 2 GB) blir en tydelig melding i stedet for en tom nedlasting. `x-zip-grense`
  // sier hvilken grense som slo til. Maks-tallene speiler serveren (MAKS_TEGNINGER
  // = 200, MAKS_SUM_BYTES = 2 GB i `tegningNedlasting.ts`).
  async function lastNedZip(params: { serieId?: string; ider?: string[] }) {
    const sp = new URLSearchParams();
    if (params.serieId) sp.set("serieId", params.serieId);
    if (params.ider && params.ider.length > 0) sp.set("ider", params.ider.join(","));
    const url = `/api/tegning/last-ned-zip?${sp.toString()}`;
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (head.status === 413) {
        alert(
          head.headers.get("x-zip-grense") === "antall"
            ? t("tegninger.nedlasting.forMange", { maks: 200 })
            : t("tegninger.nedlasting.forStor", { maks: "2 GB" }),
        );
        return;
      }
      if (!head.ok) {
        alert(t("tegninger.nedlasting.feil"));
        return;
      }
    } catch {
      alert(t("tegninger.nedlasting.feil"));
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Felles verdi blant de valgte tegningene, ellers "" (for navneforslag + forhåndsutfylling).
  function fellesVerdi(felt: "discipline" | "originator"): string {
    const valgte = tegninger.filter((d) => valgteTegninger.has(d.id));
    if (valgte.length === 0) return "";
    const første = (valgte[0]?.[felt] ?? "") || "";
    return valgte.every((d) => ((d[felt] ?? "") || "") === første) ? første : "";
  }

  // «Ny serie fra valgte»: åpne dialog i opprett-modus med navneforslag = felles fag + rådgiver.
  function åpneNySerie() {
    const fag = fellesVerdi("discipline");
    const opphav = fellesVerdi("originator");
    setSerieDialogId(null);
    setSerieNavn([fag, opphav].filter(Boolean).join(" ").trim());
    setSerieFagFelt(fag);
    setSerieOpphavFelt(opphav);
    setSerieBeskrFelt("");
    setVisSerieDialog(true);
  }

  // Rediger en eksisterende serie.
  function åpneRedigerSerie(s: SerieRadData) {
    setSerieDialogId(s.id);
    setSerieNavn(s.name);
    setSerieFagFelt(s.discipline ?? "");
    setSerieOpphavFelt(s.originator ?? "");
    setSerieBeskrFelt(s.description ?? "");
    setVisSerieDialog(true);
  }

  function lagreSerie() {
    if (!prosjektId || serieNavn.trim() === "") return;
    const fag = (serieFagFelt || undefined) as typeof DRAWING_DISCIPLINES[number] | undefined;
    if (serieDialogId === null) {
      // Opprett fra valgte
      opprettSerieMutation.mutate(
        {
          projectId: prosjektId,
          byggeplassId: lokasjonId,
          name: serieNavn.trim(),
          discipline: fag,
          originator: serieOpphavFelt || undefined,
          description: serieBeskrFelt || undefined,
          drawingIds: [...valgteTegninger],
        },
        {
          onSuccess: () => {
            setVisSerieDialog(false);
            setMerkeModus(false);
            tømUtvalg();
          },
        },
      );
    } else {
      oppdaterSerieMutation.mutate(
        {
          id: serieDialogId,
          name: serieNavn.trim(),
          discipline: fag ?? null,
          originator: serieOpphavFelt || null,
          description: serieBeskrFelt || null,
        },
        { onSuccess: () => setVisSerieDialog(false) },
      );
    }
  }

  function slettSerie() {
    if (serieDialogId === null) return;
    slettSerieMutation.mutate({ id: serieDialogId }, { onSuccess: () => setVisSerieDialog(false) });
  }

  function brukPaAlle() {
    if (serieDialogId === null) return;
    brukPaAlleMutation.mutate({ serieId: serieDialogId });
  }

  // Flytt valgte inn i en eksisterende serie.
  function flyttValgteTilSerie(serieId: string) {
    flyttTilSerieMutation.mutate(
      { drawingIds: [...valgteTegninger], serieId },
      {
        onSuccess: () => {
          setVisFlyttTilSerie(false);
          setMerkeModus(false);
          tømUtvalg();
        },
      },
    );
  }

  // Ta valgte ut av serie (serieId = null).
  function taValgteUtAvSerie() {
    flyttTilSerieMutation.mutate(
      { drawingIds: [...valgteTegninger], serieId: null },
      {
        onSuccess: () => {
          setMerkeModus(false);
          tømUtvalg();
        },
      },
    );
  }

  // T2: del en fag-gruppes tegninger i serie-bøtter (serie → nummer) + løse (uten serie).
  // Serie-bøtter sorteres i serieListe-rekkefølge; løse tegninger beholder gruppas sortering.
  function serieBucketsForGruppe(gruppeTegninger: TegningRad[]): {
    buckets: { serie: SerieRadData; tegninger: TegningRad[] }[];
    utenSerie: TegningRad[];
  } {
    const perSerie = new Map<string, TegningRad[]>();
    const utenSerie: TegningRad[] = [];
    for (const d of gruppeTegninger) {
      if (d.serieId) {
        const liste = perSerie.get(d.serieId);
        if (liste) liste.push(d);
        else perSerie.set(d.serieId, [d]);
      } else {
        utenSerie.push(d);
      }
    }
    const buckets = serieListe
      .filter((s) => perSerie.has(s.id))
      .map((s) => ({ serie: s, tegninger: perSerie.get(s.id)! }));
    return { buckets, utenSerie };
  }

  // Én tegningsrad i lista. I merkemodus (T2) får raden en avkryssingsboks foran.
  function renderTegningRad(tegning: TegningRad) {
    const harGeoRef = !!tegning.geoReference;
    const valgt = valgtTegningId === tegning.id;
    const avkrysset = valgteTegninger.has(tegning.id);
    return (
      <li key={tegning.id}>
        <div
          className={`flex items-center gap-1 rounded-md pr-1 text-sm transition-colors ${
            valgt ? "bg-sitedoc-primary/10" : avkrysset ? "bg-sitedoc-primary/5" : "hover:bg-gray-50"
          }`}
        >
          {merkeModus && (
            <input
              type="checkbox"
              checked={avkrysset}
              onChange={() => toggleValgt(tegning.id)}
              aria-label={t("tegninger.serieGruppe.merkRad", { navn: tegning.name })}
              className="ml-2 h-4 w-4 flex-shrink-0 accent-sitedoc-primary"
            />
          )}
          <button
            onClick={() => velgTegning(valgt ? null : tegning.id)}
            className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left ${
              valgt ? "text-sitedoc-primary" : "text-gray-700"
            }`}
          >
            <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span className="flex-1 truncate">{tegning.name}</span>
            {harGeoRef && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                Georeferert
              </span>
            )}
          </button>
          {/* T1b R4: rediger ÉN tegning i samme tabell. */}
          <button
            onClick={() => åpneRedigerEn(tegning)}
            className="flex-shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title={t("handling.rediger")}
            aria-label={t("handling.rediger")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    );
  }

  function handleLagreTegning(e: React.FormEvent) {
    e.preventDefault();
    if (!prosjektId || !opplastetFil) return;

    opprettTegningMutation.mutate({
      projectId: prosjektId,
      byggeplassId: lokasjonId,
      name: metaNavn,
      drawingNumber: metaTegningsnr || undefined,
      discipline: (metaDisiplin || undefined) as typeof DRAWING_DISCIPLINES[number] | undefined,
      drawingType: (metaType || undefined) as typeof DRAWING_TYPES[number] | undefined,
      revision: metaRevisjon || "A",
      floor: metaEtasje || undefined,
      scale: metaMålestokk || undefined,
      originator: metaOpphav || undefined,
      description: metaBeskrivelse || undefined,
      fileUrl: opplastetFil.fileUrl,
      fileType: opplastetFil.fileType,
      fileSize: opplastetFil.fileSize,
    });
  }

  const utilknyttede = (alleTegninger as TegningRad[] | undefined)
    ?.filter((t) => !t.byggeplassId) ?? [];
  const tegninger = (lokasjon?.drawings ?? []) as TegningRad[];
  const valgtTegning = tegninger.find((t) => t.id === valgtTegningId) ?? null;

  // R6: fag-gruppering (standard) eller dagens etasje-gruppering (veksel).
  const tegningGrupper: TegningGruppe[] = useMemo(() => {
    if (!grupperFag) return grupperTegninger(tegninger);
    return grupperTegningerEtterFag(tegninger).map((g) => ({
      navn: g.fag ?? t("tegninger.serie.utenFag"),
      tegninger: g.tegninger,
      ikon: "etasje" as const,
    }));
  }, [grupperFag, tegninger, t]);

  // Live-tegninger for serietabellen (status + originalverdier), nøklet på id.
  const liveTegninger: Record<string, LiveTegning> = useMemo(() => {
    const kart: Record<string, LiveTegning> = {};
    for (const d of tegninger) {
      kart[d.id] = {
        id: d.id,
        name: d.name,
        drawingNumber: d.drawingNumber ?? null,
        discipline: d.discipline ?? null,
        drawingType: d.drawingType ?? null,
        floor: d.floor ?? null,
        originator: d.originator ?? null,
        scale: d.scale ?? null,
        revision: d.revision ?? null,
        conversionStatus: d.conversionStatus ?? null,
      };
    }
    return kart;
  }, [tegninger]);

  // Rekonsilier «konverterer»-rader mot server-status (polling oppdaterer lokasjon).
  useEffect(() => {
    setSerieRader((rader) =>
      rader.map((r) => {
        if (r.status !== "konverterer" || !r.drawingId) return r;
        const cs = liveTegninger[r.drawingId]?.conversionStatus;
        if (cs === "done") return { ...r, status: "klar" };
        if (cs === "failed") return { ...r, status: "feilet", feil: r.feil ?? t("tegninger.serie.konverteringFeilet") };
        return r;
      }),
    );
  }, [liveTegninger, t]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header + Verktøylinje (samlet rad) */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-4 py-1.5">
        <div className="flex items-center gap-2 mr-3">
          <Building2 className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">
            {lokasjon?.name ?? "Laster..."}
          </span>
        </div>

        <div className="relative">
          <Button size="sm" onClick={() => setVisTilføyMeny(!visTilføyMeny)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tilføy
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
          {visTilføyMeny && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVisTilføyMeny(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    filInputRef.current?.click();
                    setVisTilføyMeny(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  Last opp tegning
                </button>
                {utilknyttede.length > 0 && (
                  <>
                    <div className="my-1 border-t border-gray-100" />
                    <p className="px-4 py-1.5 text-xs font-medium text-gray-400">
                      Tilknytt eksisterende
                    </p>
                    {utilknyttede.map((tegning) => (
                      <button
                        key={tegning.id}
                        onClick={() => {
                          tilknyttMutation.mutate({
                            drawingId: tegning.id,
                            byggeplassId: lokasjonId,
                          });
                          setVisTilføyMeny(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <FileText className="h-4 w-4 text-gray-400" />
                        {tegning.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {valgtTegningId && (
          <button
            onClick={() => setVisGeoEditor(!visGeoEditor)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              visGeoEditor
                ? "bg-sitedoc-primary/10 text-sitedoc-primary font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <MapPin className="h-4 w-4" />
            Georeferanse
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setVisMerMeny(!visMerMeny)}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            <MoreVertical className="h-4 w-4" />
            {t("handling.mer")}
          </button>
          {visMerMeny && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVisMerMeny(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <KnappMedForklaring sperret={!valgtTegningId} forklaring={t("sperret.velgTegning")} wrapperKlasse="relative flex w-full">
                  <button
                    disabled={!valgtTegningId}
                    onClick={() => {
                      if (valgtTegningId) {
                        tilknyttMutation.mutate({ drawingId: valgtTegningId, byggeplassId: null });
                        setValgtTegningId(null);
                      }
                      setVisMerMeny(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Fjern tegning
                  </button>
                </KnappMedForklaring>
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={onLukk}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Skjult filinput — R1: flervalg (serieopplasting ved >1 fil) */}
      <input
        ref={filInputRef}
        type="file"
        multiple
        accept=".pdf,.dwg,.dxf,.ifc,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFilValgt}
      />

      {/* Opplastingsindikator */}
      {lasterOpp && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-blue-50 px-6 py-2 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Laster opp fil...
        </div>
      )}

      {/* To-kolonne innhold */}
      <div className="flex flex-1 overflow-hidden">
        {/* Venstre — tegningsliste gruppert */}
        <div className="flex w-[260px] flex-shrink-0 flex-col border-r border-gray-200">
          {/* R6: veksle mellom fag- og etasje-gruppering */}
          {tegninger.length > 0 && (
            <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-1.5">
              <button
                onClick={() => setGrupperFag(true)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  grupperFag ? "bg-sitedoc-primary/10 text-sitedoc-primary" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t("tegninger.serie.grupperFag")}
              </button>
              <button
                onClick={() => setGrupperFag(false)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  !grupperFag ? "bg-sitedoc-primary/10 text-sitedoc-primary" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t("tegninger.serie.grupperEtasje")}
              </button>
              <div className="flex-1" />
              {/* T2: merkemodus for serie-flytting (kun i fag-gruppering). */}
              {grupperFag && (
                <button
                  onClick={toggleMerkeModus}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    merkeModus ? "bg-sitedoc-primary/10 text-sitedoc-primary" : "text-gray-500 hover:bg-gray-100"
                  }`}
                  title={t("tegninger.serieGruppe.merk")}
                >
                  <Box className="h-3.5 w-3.5" />
                  {merkeModus ? t("handling.avbryt") : t("tegninger.serieGruppe.merk")}
                </button>
              )}
              {/* T1b R4: åpne etterfyllings-tabellen med ALLE tegningene. */}
              <button
                onClick={åpneRedigerFlere}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
                title={t("tegninger.serie.redigerFlere")}
              >
                <ListChecks className="h-3.5 w-3.5" />
                {t("tegninger.serie.redigerFlere")}
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {tegninger.length > 0 ? (
              <div className="flex flex-col gap-4">
                {tegningGrupper.map((gruppe) => {
                  const kollapset = !!kollapsedeGrupper[kollapsNokkel(gruppe.navn)];
                  return (
                  <div key={gruppe.navn}>
                    {/* T1b (kollaps): gruppe-header åpner/lukker gruppen; valget huskes pr. byggeplass. */}
                    <button
                      onClick={() => toggleKollaps(gruppe.navn)}
                      className="mb-1 flex w-full items-center gap-2 rounded px-3 py-1 text-left hover:bg-gray-50"
                      aria-expanded={!kollapset}
                    >
                      {kollapset ? (
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      )}
                      {gruppe.ikon === "utomhus" ? (
                        <MapPin className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {gruppe.navn}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({gruppe.tegninger.length})
                      </span>
                    </button>
                    {!kollapset && (() => {
                      // T2: i fag-modus deles gruppa i serie-bøtter (fag → serie → nummer)
                      // + løse tegninger. I etasje-modus beholdes flat liste.
                      if (!grupperFag) {
                        return (
                          <ul className="flex flex-col gap-0.5">
                            {gruppe.tegninger.map(renderTegningRad)}
                          </ul>
                        );
                      }
                      const { buckets, utenSerie } = serieBucketsForGruppe(gruppe.tegninger);
                      return (
                        <div className="flex flex-col gap-1">
                          {buckets.map(({ serie, tegninger: serieT }) => {
                            const serieKollapset = !!kollapsedeGrupper[serieKollapsNokkel(serie.id)];
                            return (
                              <div key={serie.id} className="ml-3 border-l border-gray-100 pl-1">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleKollapsNokkel(serieKollapsNokkel(serie.id))}
                                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-gray-50"
                                    aria-expanded={!serieKollapset}
                                  >
                                    {serieKollapset ? (
                                      <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-400" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400" />
                                    )}
                                    <Box className="h-3.5 w-3.5 flex-shrink-0 text-sitedoc-primary/70" />
                                    <span className="truncate text-xs font-medium text-gray-700">{serie.name}</span>
                                    <span className="text-xs text-gray-400">({serieT.length})</span>
                                  </button>
                                  {serieT.length > 0 && (
                                    <button
                                      onClick={() => lastNedZip({ serieId: serie.id })}
                                      className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                      title={t("tegninger.serieGruppe.lastNedSerie")}
                                      aria-label={t("tegninger.serieGruppe.lastNedSerie")}
                                    >
                                      <Download className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => åpneRedigerSerie(serie)}
                                    className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    title={t("tegninger.serieGruppe.serieModalTittelRediger")}
                                    aria-label={t("tegninger.serieGruppe.serieModalTittelRediger")}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>
                                {!serieKollapset && (
                                  <ul className="flex flex-col gap-0.5">
                                    {serieT.map(renderTegningRad)}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                          {utenSerie.length > 0 && (
                            <ul className="flex flex-col gap-0.5">
                              {utenSerie.map(renderTegningRad)}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center pt-12">
                <p className="mb-4 text-sm text-gray-300">
                  Ingen tegninger
                </p>
                <Button variant="secondary" onClick={() => filInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Last opp
                </Button>
                <p className="mt-2 text-xs text-gray-400">
                  IFC, DWG, PDF eller bilde
                </p>
              </div>
            )}
          </div>
          {/* T2: handlingslinje — dukker opp når tegninger er merket. */}
          {merkeModus && valgteTegninger.size > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-gray-200 bg-gray-50 px-3 py-2">
              <span className="text-xs font-medium text-gray-600">
                {t("tegninger.serieGruppe.valgtAntall", { antall: valgteTegninger.size })}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => lastNedZip({ ider: [...valgteTegninger] })}
                  className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("tegninger.serieGruppe.lastNedValgte", { antall: valgteTegninger.size })}
                </button>
                <button
                  onClick={åpneNySerie}
                  className="flex items-center gap-1 rounded bg-sitedoc-primary px-2 py-1 text-xs font-medium text-white hover:bg-sitedoc-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("tegninger.serieGruppe.nySerie")}
                </button>
                {serieListe.length > 0 && (
                  <button
                    onClick={() => setVisFlyttTilSerie(true)}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {t("tegninger.serieGruppe.flyttTilSerie")}
                  </button>
                )}
                <button
                  onClick={taValgteUtAvSerie}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {t("tegninger.serieGruppe.taUtAvSerie")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Høyre — forhåndsvisning eller georeferanse-editor */}
        {visGeoEditor && valgtTegningId ? (
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <GeoReferanseEditor
              tegningId={valgtTegningId}
              tegning={valgtTegning}
              byggeplassId={lokasjonId}
              startSenter={
                lokasjon?.latitude != null && lokasjon?.longitude != null
                  ? { lat: lokasjon.latitude, lng: lokasjon.longitude }
                  : null
              }
              onLagret={() => {
                utils.bygning.hentMedId.invalidate({ id: lokasjonId });
              }}
            />
          </div>
        ) : (
          <div
            ref={forhåndsvisningRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={nullstillVisning}
            className="relative flex flex-1 overflow-hidden bg-gray-50"
            style={{ cursor: valgtTegning?.fileUrl ? (erDraging ? "grabbing" : "grab") : "default" }}
          >
            {valgtTegning?.fileUrl ? (
              <div
                className="flex min-h-full min-w-full items-center justify-center transition-transform duration-100 ease-out"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                {(valgtTegning.fileType ?? "") === "dwg" ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <p className="text-sm">DWG-filen må konverteres før den kan vises</p>
                  </div>
                ) : ["png", "jpg", "jpeg", "svg"].includes(valgtTegning.fileType ?? "") ? (
                  (valgtTegning.fileType ?? "") === "svg" && svgInnhold ? (
                    <div
                      className="max-w-full"
                      style={{ "--svg-zoom": zoom } as React.CSSProperties}
                      dangerouslySetInnerHTML={{ __html: svgInnhold }}
                    />
                  ) : (
                    <SignertBilde
                      url={valgtTegning.fileUrl}
                      alt={valgtTegning.name}
                      className="max-w-full object-contain"
                      draggable={false}
                    />
                  )
                ) : (valgtTegning.fileType ?? "") === "ifc" ? (
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Box className="h-12 w-12 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">{valgtTegning.name}</p>
                    <p className="text-xs">IFC-modell</p>
                    <a
                      href={`/dashbord/${prosjektId}/3d-visning`}
                      className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Åpne i 3D-visning
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={`/api${valgtTegning.fileUrl}`}
                    title={valgtTegning.name}
                    className="h-[calc(100vh-50px)] w-[calc(100vw-260px)] border-0"
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <LayoutGrid className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                  <p className="text-lg text-gray-400">
                    {valgtTegningId ? "Ingen fil tilgjengelig" : "Velg en tegning for forhåndsvisning"}
                  </p>
                </div>
              </div>
            )}
            {valgtTegning?.fileUrl && zoom !== 1 && (
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white">
                {Math.round(zoom * 100)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata-modal for ny tegning */}
      <Modal
        open={visMetadataModal}
        onClose={() => {
          setVisMetadataModal(false);
          nullstillMetadata();
        }}
        title="Tegningsdetaljer"
      >
        <form onSubmit={handleLagreTegning} className="flex flex-col gap-4">
          <Input
            label="Navn"
            value={metaNavn}
            onChange={(e) => setMetaNavn(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tegningsnummer"
              value={metaTegningsnr}
              onChange={(e) => setMetaTegningsnr(e.target.value)}
              placeholder="f.eks. ARK-P-101"
            />
            <Select
              label="Fagdisiplin"
              value={metaDisiplin}
              onChange={(e) => setMetaDisiplin(e.target.value)}
              placeholder="Velg disiplin"
              options={DRAWING_DISCIPLINES.map((d) => ({ value: d, label: d }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tegningstype"
              value={metaType}
              onChange={(e) => setMetaType(e.target.value)}
              placeholder="Velg type"
              options={DRAWING_TYPES.map((t) => ({
                value: t,
                label: t.charAt(0).toUpperCase() + t.slice(1),
              }))}
            />
            <Input
              label="Revisjon"
              value={metaRevisjon}
              onChange={(e) => setMetaRevisjon(e.target.value)}
              placeholder="A"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Etasje"
              value={metaEtasje}
              onChange={(e) => setMetaEtasje(e.target.value)}
              placeholder="f.eks. 1. etasje"
            />
            <Input
              label="Målestokk"
              value={metaMålestokk}
              onChange={(e) => setMetaMålestokk(e.target.value)}
              placeholder="f.eks. 1:100"
            />
          </div>
          <Input
            label="Opphav (firma)"
            value={metaOpphav}
            onChange={(e) => setMetaOpphav(e.target.value)}
          />
          <Textarea
            label="Beskrivelse"
            value={metaBeskrivelse}
            onChange={(e) => setMetaBeskrivelse(e.target.value)}
            rows={2}
          />
          {opplastetFil && (
            <p className="text-xs text-gray-400">
              Fil: {opplastetFil.fileName} ({Math.round(opplastetFil.fileSize / 1024)} KB)
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setVisMetadataModal(false);
                nullstillMetadata();
              }}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={opprettTegningMutation.isPending}>
              {opprettTegningMutation.isPending ? "Lagrer..." : "Lagre tegning"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* R1: felles-felt for serieopplasting — settes ÉN gang for hele utvalget. */}
      <Modal
        open={visSerieModal}
        onClose={() => setVisSerieModal(false)}
        title={t("tegninger.serie.fellesTittel")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {t("tegninger.serie.fellesHjelp", { antall: valgteFiler.length })}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t("tegninger.feltFagdisiplin")}
              value={serieFag}
              onChange={(e) => setSerieFag(e.target.value)}
              placeholder={t("tegninger.velgDisiplin")}
              options={DRAWING_DISCIPLINES.map((d) => ({ value: d, label: d }))}
            />
            <Input
              label={t("tegninger.feltEtasje")}
              value={serieEtasje}
              onChange={(e) => setSerieEtasje(e.target.value)}
              placeholder={t("tegninger.etasjePlaceholder")}
            />
          </div>
          <Input
            label={t("tegninger.feltOpphav")}
            value={serieOpphav}
            onChange={(e) => setSerieOpphav(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setVisSerieModal(false)}>
              {t("handling.avbryt")}
            </Button>
            <Button onClick={startSerie}>
              {t("tegninger.serie.lastOppAntall", { antall: valgteFiler.length })}
            </Button>
          </div>
        </div>
      </Modal>

      {/* R2/R4: etterfyllings-tabell — detaljer legges inn etter opplasting, eller
          «Rediger flere» (T1b) på eksisterende tegninger. Skjules (ikke avmonteres)
          med `hidden` når brukeren ser en tegning via «Vis», så radendringer bevares. */}
      {visSerieTabell && (
        <div
          className={`fixed inset-0 z-[60] flex-col bg-white ${serieTabellSkjult ? "hidden" : "flex"}`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <span className="text-sm font-semibold text-gray-900">
              {erRedigerModus
                ? t("tegninger.serie.tabellTittelRediger")
                : t("tegninger.serie.tabellTittel")}
            </span>
            <Button size="sm" variant="secondary" onClick={lukkSerieTabell}>
              {t("tegninger.serie.ferdig")}
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <TegningSerieTabell
              rader={serieRader}
              liveTegninger={liveTegninger}
              onLagreRad={lagreRad}
              lagrerId={radLagrerId}
              onPrøvIgjen={prøvIgjenSerie}
              onVis={visTegningFraTabell}
              onRevisjonFerdig={() => {
                utils.bygning.hentMedId.invalidate({ id: lokasjonId });
                utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
              }}
            />
          </div>
        </div>
      )}

      {/* T1b (vis og tilbake): floating retur til tabellen mens den er skjult. */}
      {visSerieTabell && serieTabellSkjult && (
        <button
          onClick={() => setSerieTabellSkjult(false)}
          className="fixed left-1/2 top-3 z-[70] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-sitedoc-primary/90"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("tegninger.serie.tilbakeTilTabell")}
        </button>
      )}

      {/* D2: DWG/DXF avvist fordi serveren mangler libredwg. */}
      <Modal
        open={dwgSperreAntall !== null}
        onClose={() => setDwgSperreAntall(null)}
        title={t("tegninger.dwgSperre.tittel")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {t("tegninger.dwgSperre.forklaring", { antall: dwgSperreAntall ?? 0 })}
          </p>
          <div className="flex justify-end">
            <Button onClick={() => setDwgSperreAntall(null)}>{t("handling.lukk")}</Button>
          </div>
        </div>
      </Modal>

      {/* T2: opprett / rediger tegningsserie. Serien bærer BEVISST ikke revisjon,
          målestokk eller status — kun navn + standardverdier (fag/rådgiver). */}
      <Modal
        open={visSerieDialog}
        onClose={() => setVisSerieDialog(false)}
        title={
          serieDialogId === null
            ? t("tegninger.serieGruppe.serieModalTittelNy")
            : t("tegninger.serieGruppe.serieModalTittelRediger")
        }
      >
        <div className="flex flex-col gap-4">
          {serieDialogId === null && (
            <p className="text-sm text-gray-600">
              {t("tegninger.serieGruppe.nySerieHjelp", { antall: valgteTegninger.size })}
            </p>
          )}
          <Input
            label={t("tegninger.serieGruppe.feltNavn")}
            value={serieNavn}
            onChange={(e) => setSerieNavn(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t("tegninger.serieGruppe.feltFag")}
              value={serieFagFelt}
              onChange={(e) => setSerieFagFelt(e.target.value)}
              placeholder={t("tegninger.velgDisiplin")}
              options={DRAWING_DISCIPLINES.map((d) => ({ value: d, label: d }))}
            />
            <Input
              label={t("tegninger.serieGruppe.feltRadgiver")}
              value={serieOpphavFelt}
              onChange={(e) => setSerieOpphavFelt(e.target.value)}
            />
          </div>
          <Textarea
            label={t("tegninger.serieGruppe.feltBeskrivelse")}
            value={serieBeskrFelt}
            onChange={(e) => setSerieBeskrFelt(e.target.value)}
          />
          {/* R10: «Bruk på alle» er eksplisitt og viser antallet som berøres. */}
          {serieDialogId !== null && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-xs text-gray-600">
                {t("tegninger.serieGruppe.brukPaAlleBekreft", {
                  antall: serieListe.find((s) => s.id === serieDialogId)?._count?.drawings ?? 0,
                })}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={brukPaAlle}
                disabled={brukPaAlleMutation.isPending}
              >
                {t("tegninger.serieGruppe.brukPaAlle")}
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {serieDialogId !== null && (
                <Button variant="danger" size="sm" onClick={slettSerie} disabled={slettSerieMutation.isPending}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t("tegninger.serieGruppe.slettSerie")}
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setVisSerieDialog(false)}>
                {t("handling.avbryt")}
              </Button>
              <Button
                onClick={lagreSerie}
                disabled={
                  serieNavn.trim() === "" ||
                  opprettSerieMutation.isPending ||
                  oppdaterSerieMutation.isPending
                }
              >
                {t("handling.lagre")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* T2: flytt valgte tegninger inn i en eksisterende serie. */}
      <Modal
        open={visFlyttTilSerie}
        onClose={() => setVisFlyttTilSerie(false)}
        title={t("tegninger.serieGruppe.flyttTilSerie")}
      >
        <div className="flex flex-col gap-2">
          {serieListe.length === 0 ? (
            <p className="text-sm text-gray-500">{t("tegninger.serieGruppe.ingenSerier")}</p>
          ) : (
            serieListe.map((s) => (
              <button
                key={s.id}
                onClick={() => flyttValgteTilSerie(s.id)}
                disabled={flyttTilSerieMutation.isPending}
                className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <Box className="h-4 w-4 flex-shrink-0 text-sitedoc-primary/70" />
                <span className="flex-1 truncate text-gray-800">{s.name}</span>
                {s.discipline && <span className="text-xs text-gray-400">{s.discipline}</span>}
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Geofence-indikator (per rad)                                        */
/* ------------------------------------------------------------------ */

type GeofenceFelt = { latitude?: number | null; longitude?: number | null; radiusM?: number | null };
/** Adressesøk-treff (speiler `bygning.geokod`-retur / rute-service AdresseTreff). */
type AdresseTreff = { lat: number; lng: number; label: string };

/** Geofence er «satt» når alle tre feltene finnes. */
function harGeofence(lok: GeofenceFelt): boolean {
  return lok.latitude != null && lok.longitude != null && lok.radiusM != null;
}

/**
 * Klikkbar MapPin-status per rad: blå fylt = geofence satt, grå omriss = ikke.
 * Span med role=button → gyldig både i tabell-celle og inne i kort-knappen
 * (unngår nøstet <button>). Klikk stopper propagering så rad-valg ikke trigges.
 */
function GeofenceKnapp({ satt, tittel, onClick }: { satt: boolean; tittel: string; onClick: () => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={tittel}
      aria-label={tittel}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      className="inline-flex cursor-pointer rounded p-1 transition-colors hover:bg-gray-100"
    >
      <MapPin className={`h-4 w-4 ${satt ? "fill-sitedoc-primary/20 text-sitedoc-primary" : "text-gray-300"}`} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  PublisertLokasjonKort                                               */
/* ------------------------------------------------------------------ */

function PublisertLokasjonKort({
  lokasjon,
  erValgt,
  geofenceSatt,
  visReiseMangel,
  onVelg,
  onRediger,
  onGeofence,
}: {
  lokasjon: {
    id: string;
    name: string;
    _count: { drawings: number };
  };
  erValgt: boolean;
  geofenceSatt: boolean;
  visReiseMangel: boolean;
  onVelg: () => void;
  onRediger: () => void;
  onGeofence: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onVelg}
      onDoubleClick={onRediger}
      className={`flex w-[220px] flex-col overflow-hidden rounded-lg border bg-white text-left transition-shadow hover:shadow-md ${
        erValgt
          ? "border-sitedoc-primary ring-1 ring-sitedoc-primary"
          : "border-gray-200"
      }`}
    >
      <div className="flex h-[140px] items-center justify-center bg-gray-50">
        <Building2 className="h-10 w-10 text-gray-300" />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-gray-900">
          {lokasjon.name}
        </p>
        <GeofenceKnapp
          satt={geofenceSatt}
          tittel={geofenceSatt ? t("lokasjoner.geofence.satt") : t("lokasjoner.geofence.ikkeSatt")}
          onClick={onGeofence}
        />
      </div>
      {visReiseMangel && (
        <p className="border-t border-gray-100 px-3 py-1.5 text-xs text-amber-700">
          {t("lokasjoner.geofence.manglerReise")}
        </p>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function LokasjonerSide() {
  const { prosjektId, valgtProsjekt } = useProsjekt();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  // C5(a): «mangler plassering»-merket vises KUN når Timer-modulen er aktiv for
  // firmaet — ellers betyr et manglende byggeplass-punkt ingenting for brukeren.
  const orgId = valgtProsjekt?.primaryOrganizationId ?? null;
  const { data: modulTilstand } = trpc.modul.effektivTilstand.useQuery(
    { firmaId: orgId!, slugs: ["timer"] },
    { enabled: !!orgId },
  );
  const timerAktiv = modulTilstand?.timer === true;
  const [visModal, setVisModal] = useState(false);
  const [visEndreNavnModal, setVisEndreNavnModal] = useState(false);
  // Geofence skilt ut til egen, synlig inngang (discoverability) — egen modal.
  const [visGeofenceModal, setVisGeofenceModal] = useState(false);
  const [nyNavn, setNyNavn] = useState("");
  const [nyAdresse, setNyAdresse] = useState("");
  const [endreNavn, setEndreNavn] = useState("");
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [redigerLokasjonId, setRedigerLokasjonId] = useState<string | null>(null);
  const [visMerMeny, setVisMerMeny] = useState(false);

  const { data: lokasjoner, isLoading } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const opprettMutation = trpc.bygning.opprett.useMutation({
    onSuccess: (_data: unknown, variabler: { name: string }) => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! }).then(() => {
        const oppdatert = utils.bygning.hentForProsjekt.getData({ projectId: prosjektId! });
        const nytt = oppdatert?.find((a) => a.name === variabler.name);
        // Marker den nye byggeplassen i lista → verktøylinje-handlingene
        // (Geofence/Tegninger/…) gjelder den straks. Ikke auto-kast inn i
        // tegnings-editoren — geofence er nå en synlig knapp.
        if (nytt) setValgtId(nytt.id);
      });
      setVisModal(false);
      setNyNavn("");
      setNyAdresse("");
    },
  });

  const [visSletteDialog, setVisSletteDialog] = useState(false);

  const publiserMutation = trpc.bygning.publiser.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const oppdaterMutation = trpc.bygning.oppdater.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisEndreNavnModal(false);
      setEndreNavn("");
    },
  });

  // Fase 1c: geofence-override (lat/lng/radius som tekst, parses ved lagring)
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [geoRadius, setGeoRadius] = useState("");
  const [geoFeil, setGeoFeil] = useState<string | null>(null);
  // Del B: adresse-søk (button-trigget, Kartverket-treffliste — ikke autocomplete)
  const [geoAdresse, setGeoAdresse] = useState("");
  const [geokodMelding, setGeokodMelding] = useState<string | null>(null);
  const [geoAdresseTreff, setGeoAdresseTreff] = useState<AdresseTreff[]>([]);

  const beregnGeofenceMutation = trpc.bygning.beregnGeofence.useMutation({
    onSuccess: (data: { lat: number; lng: number; radiusM: number }) => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setGeoLat(String(data.lat));
      setGeoLng(String(data.lng));
      setGeoRadius(String(data.radiusM));
      setGeoFeil(null);
    },
    onError: (feil: { message: string }) => setGeoFeil(feil.message),
  });

  const settGeofenceMutation = trpc.bygning.settGeofence.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setGeoFeil(null);
      setVisGeofenceModal(false);
    },
    onError: (feil: { message: string }) => setGeoFeil(feil.message),
  });

  // Del B: adressesøk → inntil 5 treff (klikkbar liste) via server-proxy
  // (bygning.geokod, Kartverket). Klikk et treff → setter senter.
  const settGeoSenter = (treff: AdresseTreff) => {
    setGeoLat(String(treff.lat));
    setGeoLng(String(treff.lng));
    // Gi nyplassert senter en brukbar default-radius (jf. 150 m ellers) så
    // sirkelen vises straks. Rører ikke en allerede satt radius.
    setGeoRadius((forrige) => (forrige.trim() === "" ? "150" : forrige));
    setGeoAdresseTreff([]);
    setGeokodMelding(null);
  };
  const geokodMutation = trpc.bygning.geokod.useMutation({
    onSuccess: (treff: AdresseTreff[]) => {
      if (treff.length === 0) {
        setGeoAdresseTreff([]);
        setGeokodMelding(t("lokasjoner.geofence.geokodIngen"));
      } else if (treff.length === 1) {
        settGeoSenter(treff[0]!); // ett treff → sett senter direkte
      } else {
        setGeoAdresseTreff(treff); // flere → klikkbar treffliste
        setGeokodMelding(null);
      }
    },
    onError: (feil: { message: string }) => {
      setGeoAdresseTreff([]);
      setGeokodMelding(feil.message);
    },
  });

  // Parsing for kart-props (NaN→null) — påvirker ikke lagre-logikken under.
  const geoLatNum = geoLat.trim() === "" ? NaN : Number(geoLat.replace(",", "."));
  const geoLngNum = geoLng.trim() === "" ? NaN : Number(geoLng.replace(",", "."));
  const geoRadiusNum = geoRadius.trim() === "" ? NaN : Number(geoRadius);

  const valgtLokasjon = lokasjoner?.find((b) => b.id === valgtId) ?? null;
  const upubliserte = lokasjoner?.filter((b) => b.status === "unpublished") ?? [];
  const publiserte = lokasjoner?.filter((b) => b.status === "published") ?? [];

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!prosjektId) return;
    opprettMutation.mutate({
      name: nyNavn,
      projectId: prosjektId,
      // C2: oppgitt adresse geokodes på server (Kartverket). Nøyaktig ett treff
      // setter geofence-punktet automatisk; ellers opprettes byggeplassen uten punkt.
      address: nyAdresse.trim() || undefined,
    });
  }

  function handleEndreNavn(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtId) return;
    oppdaterMutation.mutate({ id: valgtId, name: endreNavn });
  }

  function handleSlettValgt() {
    if (!valgtId || !valgtLokasjon) return;
    setVisSletteDialog(true);
  }

  function handleSletteFullfort() {
    setVisSletteDialog(false);
    setValgtId(null);
  }

  function apneEndreNavn() {
    if (!valgtLokasjon) return;
    setEndreNavn(valgtLokasjon.name);
    setVisEndreNavnModal(true);
    setVisMerMeny(false);
  }

  // Per-rad-inngang: åpner geofence-modalen med RADENS data (setter valgtId så
  // handleLagreGeofence lagrer på riktig byggeplass). Erstatter den tidligere
  // verktøylinje-knappen som leste valgtLokasjon.
  function apneGeofence(lokasjon: GeofenceFelt & { id: string }) {
    setValgtId(lokasjon.id);
    setGeoLat(lokasjon.latitude != null ? String(lokasjon.latitude) : "");
    setGeoLng(lokasjon.longitude != null ? String(lokasjon.longitude) : "");
    setGeoRadius(lokasjon.radiusM != null ? String(lokasjon.radiusM) : "");
    setGeoFeil(null);
    setGeoAdresse("");
    setGeokodMelding(null);
    setVisGeofenceModal(true);
    setVisMerMeny(false);
  }

  function handleLagreGeofence() {
    if (!valgtId) return;
    const lat = geoLat.trim() === "" ? null : Number(geoLat);
    const lng = geoLng.trim() === "" ? null : Number(geoLng);
    const radiusM = geoRadius.trim() === "" ? null : Math.round(Number(geoRadius));
    if (
      (lat !== null && Number.isNaN(lat)) ||
      (lng !== null && Number.isNaN(lng)) ||
      (radiusM !== null && Number.isNaN(radiusM))
    ) {
      setGeoFeil(t("lokasjoner.geofence.ugyldig"));
      return;
    }
    settGeofenceMutation.mutate({ byggeplassId: valgtId, latitude: lat, longitude: lng, radiusM });
  }

  const harValgt = !!valgtLokasjon;
  const erPublisert = valgtLokasjon?.status === "published";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {/* Verktøylinje */}
      <div className="mb-6 flex items-center gap-1 border-b border-gray-200 pb-3">
        <Button size="sm" onClick={() => setVisModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("handling.leggTil")}
        </Button>
        <KnappMedForklaring sperret={!harValgt} forklaring={t("sperret.velgIListe")}>
          <button
            disabled={!harValgt}
            onClick={apneEndreNavn}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" />
            {t("lokasjoner.endreNavn")}
          </button>
        </KnappMedForklaring>
        <KnappMedForklaring sperret={!harValgt} forklaring={t("sperret.velgIListe")}>
          <button
            disabled={!harValgt}
            onClick={() => {
              if (valgtId) setRedigerLokasjonId(valgtId);
            }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LayoutGrid className="h-4 w-4" />
            {t("nav.tegninger")}
          </button>
        </KnappMedForklaring>
        <KnappMedForklaring sperret={!harValgt} forklaring={t("sperret.velgIListe")}>
          <button
            disabled={!harValgt}
            onClick={handleSlettValgt}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            {t("handling.slett")}
          </button>
        </KnappMedForklaring>
        <div className="relative">
          <button
            onClick={() => setVisMerMeny(!visMerMeny)}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            <MoreVertical className="h-4 w-4" />
            {t("handling.mer")}
          </button>
          {visMerMeny && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVisMerMeny(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {harValgt && !erPublisert && (
                  <button
                    onClick={() => {
                      if (valgtLokasjon) {
                        publiserMutation.mutate({ id: valgtLokasjon.id });
                      }
                      setVisMerMeny(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t("lokasjoner.publiser")}
                  </button>
                )}
                <KnappMedForklaring sperret={!harValgt} forklaring={t("sperret.velgIListe")} wrapperKlasse="relative flex w-full">
                  <button
                    disabled={!harValgt}
                    onClick={() => {
                      handleSlettValgt();
                      setVisMerMeny(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    {t("lokasjoner.slettLokasjon")}
                  </button>
                </KnappMedForklaring>
              </div>
            </>
          )}
        </div>
        <div className="ml-auto">
          <HjelpKnapp>
            <HjelpFane tittel={t("hjelp.lokasjoner.hvaTittel")}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">{t("hjelp.lokasjoner.hva")}</p>
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <p className="text-sm font-medium text-blue-800">{t("hjelp.lokasjoner.tipsTittel")}</p>
                  <p className="mt-1 text-sm text-blue-700">{t("hjelp.lokasjoner.tips")}</p>
                </div>
              </div>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </div>

      {/* Innhold */}
      {!lokasjoner || lokasjoner.length === 0 ? (
        <EmptyState
          title={t("lokasjoner.ingenLokasjoner")}
          description={t("lokasjoner.ingenLokasjonerBeskrivelse")}
        />
      ) : (
        <>
          {/* Upubliserte lokasjoner */}
          {upubliserte.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                {t("lokasjoner.upubliserte")}
              </h3>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                        {t("tabell.navn")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                        {t("tabell.status")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                        {t("lokasjoner.geofence.tittel")}
                      </th>
                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700">
                        Oppdatert av
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {upubliserte.map((lokasjon) => (
                      <tr
                        key={lokasjon.id}
                        onClick={() => setValgtId(valgtId === lokasjon.id ? null : lokasjon.id)}
                        onDoubleClick={() => setRedigerLokasjonId(lokasjon.id)}
                        className={`cursor-pointer border-b border-gray-100 last:border-0 ${
                          valgtId === lokasjon.id
                            ? "bg-sitedoc-primary/5"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-2.5 text-sm text-gray-900">
                          {lokasjon.name}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">
                          {t("lokasjoner.upublisert")}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <GeofenceKnapp
                              satt={harGeofence(lokasjon)}
                              tittel={harGeofence(lokasjon) ? t("lokasjoner.geofence.satt") : t("lokasjoner.geofence.ikkeSatt")}
                              onClick={() => apneGeofence(lokasjon)}
                            />
                            {timerAktiv && !harGeofence(lokasjon) && (
                              <span className="text-xs text-amber-700">
                                {t("lokasjoner.geofence.manglerReise")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-gray-500">
                          &mdash;
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-sm text-gray-500">
                Lokasjoner vil <strong>automatisk</strong> bli gjort
                tilgjengelige når de er blitt utarbeidet.
              </p>
            </div>
          )}

          {/* Publiserte lokasjoner */}
          {publiserte.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                {t("lokasjoner.publiserte")}
              </h3>
              <div className="flex flex-wrap gap-4">
                {publiserte.map((lokasjon) => (
                  <PublisertLokasjonKort
                    key={lokasjon.id}
                    lokasjon={lokasjon}
                    erValgt={valgtId === lokasjon.id}
                    geofenceSatt={harGeofence(lokasjon)}
                    visReiseMangel={timerAktiv && !harGeofence(lokasjon)}
                    onVelg={() => setValgtId(valgtId === lokasjon.id ? null : lokasjon.id)}
                    onRediger={() => setRedigerLokasjonId(lokasjon.id)}
                    onGeofence={() => apneGeofence(lokasjon)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Område-administrasjon for valgt byggeplass (steg 1, 2026-09-23) */}
          {valgtLokasjon && prosjektId && (
            <div className="mt-8">
              <h3 className="mb-1 text-lg font-bold text-gray-900">
                {t("omrade.seksjon.forByggeplass", { navn: valgtLokasjon.name })}
              </h3>
              <OmradeAdmin byggeplassId={valgtLokasjon.id} prosjektId={prosjektId} />
            </div>
          )}
        </>
      )}

      {/* Tilføy lokasjon modal */}
      <Modal
        open={visModal}
        onClose={() => setVisModal(false)}
        title={t("lokasjoner.tilfoey")}
      >
        {opprettMutation.isPending ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleOpprett} className="flex flex-col gap-4">
            <Input
              label={t("tabell.navn")}
              value={nyNavn}
              onChange={(e) => setNyNavn(e.target.value)}
              required
            />
            <div>
              <Input
                label={t("lokasjoner.adresseValgfri")}
                value={nyAdresse}
                onChange={(e) => setNyAdresse(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t("lokasjoner.adresseHjelp")}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVisModal(false)}
              >
                {t("handling.avbryt")}
              </Button>
              <Button type="submit">{t("lokasjoner.tilfoey")}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Endre navn modal */}
      <Modal
        open={visEndreNavnModal}
        onClose={() => setVisEndreNavnModal(false)}
        title={t("lokasjoner.endreNavn")}
      >
        <form onSubmit={handleEndreNavn} className="flex flex-col gap-4">
          <Input
            label={t("lokasjoner.nyttNavn")}
            value={endreNavn}
            onChange={(e) => setEndreNavn(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisEndreNavnModal(false)}
            >
              {t("handling.avbryt")}
            </Button>
            <Button type="submit" disabled={oppdaterMutation.isPending}>
              {t("handling.lagre")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Geofence modal — egen, tydelig inngang (skilt fra navne-endring) */}
      <Modal
        open={visGeofenceModal}
        onClose={() => setVisGeofenceModal(false)}
        title={t("lokasjoner.geofence.tittel")}
      >
        <div className="flex flex-col">
          <p className="mb-3 text-xs text-gray-500">
            {t("lokasjoner.geofence.beskrivelse")}
          </p>

          {/* Del B: adressesøk → Kartverket-treffliste (button-trigget, ikke autocomplete) */}
          <div className="mb-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={t("lokasjoner.geofence.adresse")}
                  value={geoAdresse}
                  onChange={(e) => {
                    setGeoAdresse(e.target.value);
                    setGeokodMelding(null);
                    setGeoAdresseTreff([]);
                  }}
                  placeholder={t("lokasjoner.geofence.adressePlaceholder")}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  valgtId &&
                  geokodMutation.mutate({
                    byggeplassId: valgtId,
                    adresse: geoAdresse.trim(),
                  })
                }
                disabled={geoAdresse.trim().length === 0 || geokodMutation.isPending}
              >
                <Search className="mr-1.5 h-4 w-4" />
                {geokodMutation.isPending
                  ? t("lokasjoner.geofence.sokLaster")
                  : t("lokasjoner.geofence.sok")}
              </Button>
            </div>
            {geoAdresseTreff.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-md border border-gray-200">
                {geoAdresseTreff.map((treff, i) => (
                  <li key={`${treff.label}-${i}`}>
                    <button
                      type="button"
                      onClick={() => settGeoSenter(treff)}
                      className="flex w-full items-center gap-2 border-b border-gray-100 px-2.5 py-1.5 text-left text-xs text-gray-700 last:border-b-0 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{treff.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {geokodMelding && (
              <p className="mt-1 text-xs text-sitedoc-error">{geokodMelding}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              {t("georef.attribusjonKartverket")}
            </p>
          </div>

          {/* Del A: kart — klikk/dra markør for senter; sirkel = radius (live) */}
          <div className="mb-3">
            <KartVelgerDynamic
              latitude={Number.isFinite(geoLatNum) ? geoLatNum : null}
              longitude={Number.isFinite(geoLngNum) ? geoLngNum : null}
              radiusM={Number.isFinite(geoRadiusNum) ? geoRadiusNum : null}
              onVelgPosisjon={(nyLat, nyLng) => {
                setGeoLat(String(nyLat));
                setGeoLng(String(nyLng));
                setGeoRadius((forrige) => (forrige.trim() === "" ? "150" : forrige));
              }}
              hoyde="260px"
            />
            <p className="mt-1 text-xs text-gray-400">
              {t("lokasjoner.geofence.kartHjelp")}
            </p>
          </div>

          {/* lat/lng — redigerbar for finjustering (driver kartet via props) */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Input
              label={t("lokasjoner.geofence.lat")}
              value={geoLat}
              onChange={(e) => setGeoLat(e.target.value)}
              placeholder="—"
            />
            <Input
              label={t("lokasjoner.geofence.lng")}
              value={geoLng}
              onChange={(e) => setGeoLng(e.target.value)}
              placeholder="—"
            />
          </div>

          {/* Radius — slider (25–500) + tall-felt (opp til 100000); sirkel live */}
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("lokasjoner.geofence.radius")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={25}
                max={500}
                step={25}
                value={Number.isFinite(geoRadiusNum) ? Math.min(geoRadiusNum, 500) : 150}
                onChange={(e) => setGeoRadius(e.target.value)}
                className="flex-1 accent-sitedoc-primary"
              />
              <div className="w-28">
                <Input
                  type="number"
                  value={geoRadius}
                  onChange={(e) => setGeoRadius(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
          </div>
          {geoFeil && (
            <p className="mb-2 text-xs text-sitedoc-error">{geoFeil}</p>
          )}
          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => valgtId && beregnGeofenceMutation.mutate({ byggeplassId: valgtId })}
              disabled={beregnGeofenceMutation.isPending}
            >
              {t("lokasjoner.geofence.beregnFraTegning")}
            </Button>
            <Button
              type="button"
              onClick={handleLagreGeofence}
              disabled={settGeofenceMutation.isPending}
            >
              {t("lokasjoner.geofence.lagre")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Fullskjerm redigeringsvisning */}
      {redigerLokasjonId && (
        <RedigerLokasjon
          lokasjonId={redigerLokasjonId}
          onLukk={() => setRedigerLokasjonId(null)}
        />
      )}

      {/* Slette-dialog (Fase 0.5 § 5 slette-policy) */}
      {visSletteDialog && valgtLokasjon && prosjektId && (
        <SletteLokasjonDialog
          lokasjonId={valgtLokasjon.id}
          prosjektId={prosjektId}
          onLukk={() => setVisSletteDialog(false)}
          onFullfort={handleSletteFullfort}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SletteLokasjonDialog — Fase 0.5 § 5 slette-policy                  */
/* ------------------------------------------------------------------ */

function SletteLokasjonDialog({
  lokasjonId,
  prosjektId,
  onLukk,
  onFullfort,
}: {
  lokasjonId: string;
  prosjektId: string;
  onLukk: () => void;
  onFullfort: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [navnInput, setNavnInput] = useState("");
  const [feilmelding, setFeilmelding] = useState<string | null>(null);

  const { data: sammendrag, isLoading } =
    trpc.bygning.hentSletteSammendrag.useQuery({ byggeplassId: lokasjonId });

  const slettMutation = trpc.bygning.slett.useMutation({
    onSuccess: (resultat: {
      navn: string;
      bevares: { tegninger: number; punktskyer: number; sjekklister: number; ftdKontrakter: number; psi: number };
      slettes: { omrader: number; kontrollplaner: number; gruppeKoblinger: number };
    }) => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId });
      const totaltBevart =
        resultat.bevares.tegninger +
        resultat.bevares.punktskyer +
        resultat.bevares.sjekklister +
        resultat.bevares.ftdKontrakter +
        resultat.bevares.psi;
      const totaltSlettet =
        resultat.slettes.omrader +
        resultat.slettes.kontrollplaner +
        resultat.slettes.gruppeKoblinger;
      const melding =
        totaltBevart > 0 || totaltSlettet > 0
          ? t("lokasjoner.slett.suksessMedDetaljer", {
              navn: resultat.navn,
              bevart: totaltBevart,
              slettet: totaltSlettet,
            })
          : t("lokasjoner.slett.suksess", { navn: resultat.navn });
      // Lett toast — alert er enkelt i denne sammenhengen, kan byttes ut senere
      // når et toast-system er på plass i UI-pakken
      alert(melding);
      onFullfort();
    },
    onError: (error) => {
      setFeilmelding(error.message);
    },
  });

  if (isLoading || !sammendrag) {
    return (
      <Modal open={true} onClose={onLukk} title={t("lokasjoner.slett.tittel")}>
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      </Modal>
    );
  }

  const navnMatcher =
    navnInput.trim().toLowerCase() === sammendrag.navn.trim().toLowerCase();

  const bevaresRader: Array<{ nokkel: string; antall: number }> = [
    { nokkel: "tegninger", antall: sammendrag.bevares.tegninger },
    { nokkel: "punktskyer", antall: sammendrag.bevares.punktskyer },
    { nokkel: "sjekklister", antall: sammendrag.bevares.sjekklister },
    { nokkel: "ftdKontrakter", antall: sammendrag.bevares.ftdKontrakter },
    { nokkel: "psi", antall: sammendrag.bevares.psi },
  ].filter((r) => r.antall > 0);

  const slettesRader: Array<{ nokkel: string; antall: number }> = [
    { nokkel: "omrader", antall: sammendrag.slettes.omrader },
    { nokkel: "kontrollplaner", antall: sammendrag.slettes.kontrollplaner },
    { nokkel: "gruppeKoblinger", antall: sammendrag.slettes.gruppeKoblinger },
  ].filter((r) => r.antall > 0);

  function handleSlett() {
    setFeilmelding(null);
    slettMutation.mutate({
      byggeplassId: lokasjonId,
      navnBekreftelse: navnInput,
    });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("lokasjoner.slett.tittel")}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          {t("lokasjoner.slett.intro", { navn: sammendrag.navn })}
        </p>

        {bevaresRader.length > 0 && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <h4 className="mb-2 text-sm font-medium text-blue-900">
              {t("lokasjoner.slett.bevaresTittel")}
            </h4>
            <ul className="space-y-1 text-sm text-blue-800">
              {bevaresRader.map((rad) => (
                <li key={rad.nokkel}>
                  {t(`lokasjoner.slett.bevares.${rad.nokkel}`, { antall: rad.antall })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {slettesRader.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <h4 className="mb-2 text-sm font-medium text-red-900">
              {t("lokasjoner.slett.slettesTittel")}
            </h4>
            <ul className="space-y-1 text-sm text-red-800">
              {slettesRader.map((rad) => (
                <li key={rad.nokkel}>
                  {t(`lokasjoner.slett.slettes.${rad.nokkel}`, { antall: rad.antall })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {bevaresRader.length === 0 && slettesRader.length === 0 && (
          <p className="text-sm text-gray-500">{t("lokasjoner.slett.ingenAvhengigheter")}</p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("lokasjoner.slett.bekreftLabel", { navn: sammendrag.navn })}
          </label>
          <Input
            type="text"
            value={navnInput}
            onChange={(e) => setNavnInput(e.target.value)}
            placeholder={sammendrag.navn}
            autoFocus
          />
        </div>

        {feilmelding && (
          <p className="text-sm text-red-600">{feilmelding}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!navnMatcher || slettMutation.isPending}
            onClick={handleSlett}
          >
            {slettMutation.isPending ? t("handling.lagrer") : t("lokasjoner.slett.slettKnapp")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
