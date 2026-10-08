"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { rensSvg } from "@/lib/sanitize";
import { useByggeplass, velgerRehydreringsHandling } from "@/kontekst/byggeplass-kontekst";
import { byggOpprettInput } from "@/lib/opprettFraTegning";
import { klassifiserWheel, anvendZoomFaktor, knipFaktor, hjulFaktor } from "@/lib/tegningZoomGest";
import { settVisningshøyde } from "@/lib/tegningVisningshoyde";
import { useTranslation } from "react-i18next";
import { avledPunktTilstand, isoUkeRef, OVER_FRIST_KANT, type TilstandVisning } from "@/lib/kontrollplanFremdrift";
import { PeriodeFilter } from "@/components/PeriodeFilter";
import { type Periode, effektiveGrenser, innenforPeriode } from "@/lib/periode";
import { Button, Select, Modal, Spinner } from "@sitedoc/ui";
import {
  beregnTransformasjon,
  tegningTilGps,
  avstandMeter,
  parseMalestokk,
  kanMale,
  kalibrerMalestokk,
  malMm,
  malArealMm2,
  TOM_MALETILSTAND,
  aktivMaling,
  harPaagaaende,
  startMaling,
  leggTilPunkt,
  settFerdig,
  gjenoppta,
  flyttPunkt,
  velgMaling,
  slettAktiv,
  slettAlle,
  avsluttAktiv,
  finnMalingTreff,
  finnNaermesteKant,
  settInnPunktPaaKant,
  nyKantPunktIndeks,
  fjernPunkt,
  beregnSnap,
  type Hjelpelinjer,
  type Referanselinje,
  type SnapResultat,
  type Punkt,
  type MaleVerktoy,
  type Maling,
  type MaleTilstand,
} from "@sitedoc/shared";
import type { GeoReferanse } from "@sitedoc/shared";

interface DokumentflytMalRad {
  template: { id: string; name: string; category: string };
}

interface DokumentflytRad {
  id: string;
  name: string;
  faggruppeId: string | null;
  maler: DokumentflytMalRad[];
}
import { Map, FileText, MapPin, Plus, ZoomIn, ZoomOut, ArrowLeft, Crosshair, Loader2, AlertTriangle, Info, Pentagon, Trash2, RefreshCw, Ruler, Pencil, Waypoints, VectorSquare, TriangleRight, Magnet, Spline, Check } from "lucide-react";
import { MaalingOverlay, type MaalingSegment } from "@/components/tegning/MaalingOverlay";
import { konverteringBanner } from "@/lib/tegningKonverteringBanner";
import { invaliderEtterSlett, invaliderEtterRekonverter, invaliderEtterRedigerDetaljer, slettFeilTekst } from "@/lib/tegningMutasjonEffekter";
import { RedigerTegningModal } from "@/components/tegning/RedigerTegningModal";
import { RevisjonsListe } from "@/components/tegning/RevisjonsListe";
import { OmradeOverlay } from "@/components/tegning/OmradeOverlay";
import { OmradeTegneverktoy } from "@/components/tegning/OmradeTegneverktoy";
import { SignertBilde } from "@/components/SignertBilde";

interface Markør {
  id: string;
  x: number;
  y: number;
  label: string;
  status: string;
  createdAt: string; // periodefilter (2026-08-23)
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
// Treffradius (px) for «klikk på eksisterende punkt» = lukk/avslutt polylinje/areal.
const PUNKT_TREFF_PX = 12;

/**
 * Samle snap-/hjelpelinje-referanser fra ALLE målinger (også andre enn den
 * aktive, jf. ordre § 2). I den aktive målingen kan ett punkt ekskluderes —
 * ankeret ved tegning (unngå null-segment) eller punktet som dras.
 */
function samleReferanser(t: MaleTilstand, ekskluderIdx: number | null): Punkt[] {
  return t.malinger.flatMap((m) =>
    m.id === t.aktivId && ekskluderIdx != null
      ? m.punkter.filter((_, i) => i !== ekskluderIdx)
      : m.punkter,
  );
}

export default function TegningerSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    aktivTegning,
    aktivByggeplass,
    posisjonsvelgerAktiv,
    startPosisjonsvelger,
    fullførPosisjonsvelger,
    avbrytPosisjonsvelger,
    settAktivTegning,
  } = useByggeplass();
  const utils = trpc.useUtils();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Web punkt-dra (TILLEGG RETUR 1): dra et satt målepunkt med musa. punktDragRef
  // leses i pan-handlerne (zoom-effekten) for å ikke panorere mens et punkt dras.
  const maleInnerRef = useRef<HTMLDivElement | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const punktDragRef = useRef(false);
  const nettoppDrattRef = useRef(false);
  // 🟢 RETUR 6 § 2: valgt hjørne i den aktive målingen (for Delete-fjerning).
  // Shift-klikk på en kant setter inn et nytt hjørne. Web-valget (meldt i leveransen):
  // shift-klikk = legg til · klikk velger punkt · Delete/Backspace = fjern.
  const [valgtPunktIdx, setValgtPunktIdx] = useState<number | null>(null);

  // Zoom
  const [zoom, setZoom] = useState(STANDARD_ZOOM);
  // Gjeldende zoom lest synkront i rAF/knip (effekt-closuren har ikke `zoom` i deps).
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // Ønsket scroll etter musehjul-zoom; settes i useLayoutEffect (etter at
  // bredden er oppdatert), ikke i rAF (før), slik at verdien ikke klippes.
  const ønsketScrollRef = useRef<{ left: number; top: number } | null>(null);
  // Knip-zoom (styreflate): mange høyfrekvente knip-event samles til ÉN sømløs
  // zoom pr. animasjonsramme.
  const knipRafRef = useRef<number | null>(null);
  // 🔴 RETUR 3 § B: knip forankres fra GEST-STARTEN (zoom + scroll + peker), ikke
  // fra forrige rammes scroll. Per-ramme-forankring leste `el.scrollLeft` på nytt
  // hver ramme; i fit→overflyt-overgangen er den fortsatt klippet, så forankringen
  // regnet fra feil origo og hoppet akkumulerte. Baseline = ett fast origo for hele
  // knipet → ingen akkumulert drift; når innholdet blir stort nok, lander punktet
  // rett. `knipTotalRef` er netto deltaY siden start (faktor = exp(-total·k)).
  const knipBaseRef = useRef<{
    zoom: number;
    scrollLeft: number;
    scrollTop: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const knipTotalRef = useRef(0);
  const knipSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Klikkemodus: inspeksjon (vis DWG-egenskaper) eller plassering (opprett oppgave)
  const [klikkModus, setKlikkModus] = useState<"inspeksjon" | "plassering" | "omrade">("plassering");
  const [visOmrader, _setVisOmrader] = useState(true);
  // L2: lagfilter for markørtyper. Begge på som standard. «Frie sjekklister» er IKKE et
  // eget lag — de rendres ikke på tegning i dag (Checklist har posisjonsfelt, men verken
  // render eller lagrede posisjoner). Lagene som faktisk finnes: oppgaver + kontrollpunkter.
  const [visOppgaver, setVisOppgaver] = useState(true);
  const [visKontrollpunkter, setVisKontrollpunkter] = useState(true);
  // Periodefilter på markørene (createdAt). Standard: alle.
  const [periode, setPeriode] = useState<Periode>({ hurtigvalg: "alle", fra: null, til: null });
  const { fra: pFra, til: pTil } = effektiveGrenser(periode);
  const naaUke = useMemo(() => isoUkeRef(new Date()), []);
  // L2: «Vis på tegning» sender ?marker=<punktId> → den markøren utheves (spretter).
  const uthevetPunktId = useSearchParams().get("marker");
  const sokeParams = useSearchParams();
  const posisjonsvelgerParam = sokeParams.get("posisjonsvelger");
  // F1 (2026-08-23): «Endre» sender feltets NÅVÆRENDE posisjon med i URL-en → velgeren åpner på
  // RIKTIG tegning og tegner den eksisterende markøren dempet, så brukeren ser hvor punktet står.
  const eksTegningId = sokeParams.get("tegning");
  const eksTegningNavn = sokeParams.get("tegningNavn");
  const eksPxRaa = sokeParams.get("px");
  const eksPyRaa = sokeParams.get("py");
  const eksisterendeMarkør =
    eksTegningId && eksPxRaa != null && eksPyRaa != null && !Number.isNaN(Number(eksPxRaa)) && !Number.isNaN(Number(eksPyRaa))
      ? { drawingId: eksTegningId, x: Number(eksPxRaa), y: Number(eksPyRaa) }
      : null;
  const harRehydrertVelger = useRef(false);

  // Re-hydrer velger-tilstanden fra URL-en ÉN gang ved mount (funn 2026-08-22):
  // posisjonsvelgerAktiv er ren in-memory provider-state og nullstilles ved full last /
  // remount. Uten dette faller klikk-gaten (:457) gjennom → «Opprett fra tegning» i stedet
  // for å sette PUNKT. URL-en er sannhetskilden på denne ruten:
  //   · param satt, men provider tom (full last) → gjenopprett velger-modus.
  //   · ingen param, men provider har stale velger-modus → rydd (så «fra Tegninger-siden»
  //     alltid gir Opprett-dialog, aldri arvet velger-modus fra en tidligere dokument-flyt).
  // Run-once-guard: uten den re-fyrer effekten etter fullførPosisjonsvelger (aktiv=false,
  // før router.back()) og `startPosisjonsvelger` ville nullstilt resultat-ref-en → punktet tapt.
  useEffect(() => {
    if (harRehydrertVelger.current) return;
    harRehydrertVelger.current = true;
    const handling = velgerRehydreringsHandling(posisjonsvelgerParam, posisjonsvelgerAktiv);
    if (handling === "start") {
      startPosisjonsvelger(posisjonsvelgerParam!);
      // F1: åpne feltets EGEN tegning (ikke standard/sist-viste) når «Endre» ga oss en.
      if (eksTegningId && aktivTegning?.id !== eksTegningId) {
        settAktivTegning({ id: eksTegningId, name: eksTegningNavn ?? "" });
      }
    } else if (handling === "avbryt") avbrytPosisjonsvelger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posisjonsvelgerParam, posisjonsvelgerAktiv, startPosisjonsvelger, avbrytPosisjonsvelger]);

  // DWG-elementinfo ved klikk
  const [valgtElement, setValgtElement] = useState<{ lag: string; type: string; tekst: string; x: number; y: number } | null>(null);

  // Ny markør-plassering
  const [nyMarkør, setNyMarkør] = useState<{ x: number; y: number } | null>(null);
  // Måleverktøy (RETUR 3 § C, som Adobe): tre verktøy, ett aktivt om gangen.
  //   linjal    – to punkter → én avstand, så stopp (neste klikk = ny måling)
  //   polylinje – summert lengde, avsluttes ved klikk på et eksisterende punkt / Enter / dblklikk
  //   areal     – lukket polygon (m² + omkrets), lukkes ved klikk på første punkt
  // kalibrerModus samler 2 punkter for å utlede målestokk fra en kjent lengde.
  // RETUR 2: flere målinger via delt reducer. En ferdig måling blir liggende;
  // trykk på verktøyknappen igjen starter en ny. Den valgte er «aktiv» (vises i
  // stripa, punktene kan dras). Kalibrering har egen punktsamling (kalibrerPunkter).
  const [maleTilstand, setMaleTilstand] = useState<MaleTilstand>(TOM_MALETILSTAND);
  const aktivMal = aktivMaling(maleTilstand);
  const aktivVerktoy = aktivMal?.verktoy ?? null;
  const aktivPunkter = aktivMal?.punkter ?? [];
  const maleEngasjert = maleTilstand.aktivId !== null;
  const nesteIdRef = useRef(0);
  // 90°-lås + snapping (ordre «90°-lås og snapping»). Snap holdes PÅ som standard;
  // 90° er en toggle brukeren slår på for å måle vinkelrett. `hjelpelinjer` er de
  // aktive stiplede hjelpelinjene (forhåndsvisning + dra); `forhandsPunkt` er hvor
  // neste klikk lander (vist som en svak markør mens man beveger musa).
  const [ortho, setOrtho] = useState(false);
  const [snapPaa, setSnapPaa] = useState(true);
  const [hjelpelinjer, setHjelpelinjer] = useState<Hjelpelinjer>({ vertikal: null, horisontal: null });
  const [forhandsPunkt, setForhandsPunkt] = useState<Punkt | null>(null);
  // Ortho-aksens stiplede hjelpelinje (to prosent-punkter) + «90°»-flagg (GJENOPPTA § 2).
  const [aksehjelp, setAksehjelp] = useState<[Punkt, Punkt] | null>(null);
  const [visVinkelrett, setVisVinkelrett] = useState(false);
  // Valgt referanselinje (GJENOPPTA § 1) + ett-skudds «velg referanse»-modus.
  const [referanselinje, setReferanselinje] = useState<Referanselinje | null>(null);
  const [velgReferanseModus, setVelgReferanseModus] = useState(false);
  // Ferskeste måletilstand for event-handlere (dra/mus) uten å kjede deps.
  const maleTilstandRef = useRef(maleTilstand);
  maleTilstandRef.current = maleTilstand;
  // 90°/snap-parametre i en ref (fylles etter imgW/imgH er beregnet lenger ned),
  // så event-handlerne leser ferskeste verdier uten TDZ eller deps-kjeding.
  const snapParamRef = useRef<{ imgW: number | null; imgH: number | null; ortho: boolean; snapPaa: boolean; referanselinje: Referanselinje | null }>({
    imgW: null, imgH: null, ortho: false, snapPaa: true, referanselinje: null,
  });
  const [kalibrerPunkter, setKalibrerPunkter] = useState<Punkt[]>([]);
  const [slettAlleModalApen, setSlettAlleModalApen] = useState(false);
  const [visMalestokkPanel, setVisMalestokkPanel] = useState(false);
  const [kalibrerModus, setKalibrerModus] = useState(false);
  const [kalibrerLengde, setKalibrerLengde] = useState("");
  const [egendefinertMalestokk, setEgendefinertMalestokk] = useState("");
  const [visOpprettModal, setVisOpprettModal] = useState(false);
  const [opprettType, setOpprettType] = useState<"oppgave" | "sjekkliste">("oppgave");

  const [valgtMal, setValgtMal] = useState("");
  // Funn 2026-08-22 (modell-korreksjon): dialogen velger DOKUMENTFLYT, ikke faggruppe.
  // Faggruppene utledes fra flyten. `valgtFlyt` = valgt dokumentflytId ("" = ingen).
  const [valgtFlyt, setValgtFlyt] = useState("");
  const [opprettFeil, setOpprettFeil] = useState<string | null>(null);

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
  const { data: kontrollpunktMarkører } = trpc.kontrollplan.hentForTegning.useQuery(
    { drawingId: aktivTegning?.id ?? "" },
    { enabled: !!aktivTegning?.id },
  );
  const { data: oppgaveMarkører } = trpc.oppgave.hentForTegning.useQuery(
    { drawingId: aktivTegning?.id ?? "" },
    { enabled: !!aktivTegning?.id },
  );

  // Områder (polygoner) for aktiv tegning
  const { data: tegningOmrader } = trpc.omrade.hentForTegning.useQuery(
    { tegningId: aktivTegning?.id ?? "" },
    { enabled: !!aktivTegning?.id },
  );

  // Område-opprett er ADMIN-only fra 2026-09-23 (Kenneth: «og bare admin» — stabil navneliste).
  // Verktøyet skjules/deaktiveres for ikke-admin med begrunnelse, ikke en FORBIDDEN ved trykk.
  const { data: minOmradeTilgang } = trpc.gruppe.hentMinTilgang.useQuery({ projectId: params.prosjektId });
  const kanAdministrereOmrade = minOmradeTilgang?.erAdmin ?? false;

  const opprettOmradeMutation = trpc.omrade.opprett.useMutation({
    onSuccess: () => {
      utils.omrade.hentForTegning.invalidate({ tegningId: aktivTegning?.id ?? "" });
      setKlikkModus("plassering");
    },
  });

  // Flyter brukeren kan OPPRETTE i (registrator-medlem) — ikke synlighets-medlemskap
  // (hentMineFlyter). Serveren krever registrator-medlemskap for opprett, så mal-lista
  // filtreres på nettopp disse (funn 2026-08-22 pkt 4).
  const { data: mineOpprettFlyter } = trpc.medlem.hentMineOpprettFlyter.useQuery(
    { projectId: params.prosjektId },
    { enabled: visOpprettModal },
  );
  const { data: arbeidsforlop } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: visOpprettModal },
  );
  const { data: alleMaler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: visOpprettModal },
  );

  const opprettOppgaveMutation = trpc.oppgave.opprett.useMutation({
    // B (2026-08-22): oppgave-grenen navigerer BEVISST IKKE til det nye dokumentet. En oppgave
    // opprettet fra tegning får en markør som blir stående på tegningen — markøren ER kvitteringen
    // («det ble opprettet, her»), og brukeren fortsetter gjerne å plassere flere. Å hoppe til
    // oppgaven ville brutt den flyten. Sjekkliste-grenen (under) er motsatt: den navigerer.
    onSuccess: (_data: unknown, _vars: { title: string }) => {
      utils.oppgave.hentForTegning.invalidate({ drawingId: aktivTegning?.id ?? "" });
      lukkModal();
    },
    // Funn 2026-08-22: uten onError feilet opprett STILLE (serveren avviste manglende
    // dokumentflytId, brukeren så ingenting). Vis serverens melding.
    onError: (error: { message?: string }) => {
      setOpprettFeil(error.message ?? "Kunne ikke opprette oppgaven. Prøv igjen.");
    },
  });

  const opprettSjekklisteMutation = trpc.sjekkliste.opprett.useMutation({
    // B (2026-08-22): naviger til den nye sjekklisten med én gang. Før: den ble opprettet i
    // stillhet og brukeren måtte lete den opp i lista (2–3 ekstra steg + «hva skjedde?»). En
    // sjekkliste fylles ut inne i dokumentet (ikke via en tegningsmarkør), så den riktige neste
    // handlingen er å åpne den. (Oppgave-grenen over navigerer bevisst ikke — markøren er nok.)
    onSuccess: (data: { id: string }) => {
      lukkModal();
      router.push(`/dashbord/${params.prosjektId}/sjekklister/${data.id}`);
    },
    onError: (error: { message?: string }) => {
      setOpprettFeil(error.message ?? "Kunne ikke opprette sjekklisten. Prøv igjen.");
    },
  });

  const provKonverteringIgjenMutation = trpc.tegning.provKonverteringIgjen.useMutation({
    onSuccess: () => {
      utils.tegning.hentMedId.invalidate({ id: aktivTegning?.id ?? "" });
    },
  });

  // Re-konverter feilede PDF-tegninger. Serverprosedyren er PROSJEKT-batch (tar projectId, ikke
  // tegning-id) — den kjører alle PDF-tegninger i prosjektet som mangler/feilet konvertering.
  // Derfor sier knappeteksten «alle». Admin-gatet i serveren (returnerer «Kun admin …»).
  const rekonverterPdfMutation = trpc.tegning.rekonverterPdf.useMutation({
    onSuccess: () => {
      // Status settes til "converting" server-side på FLERE tegninger → invalidér både den viste
      // tegningen (banner) OG lista (søsken-status). Se invaliderEtterRekonverter.
      invaliderEtterRekonverter(utils, params.prosjektId, aktivTegning?.id ?? "");
    },
  });

  // Målestokk: bekreft forslag, velg manuelt, eller lagre kalibrert verdi.
  const oppdaterMalestokkMutation = trpc.tegning.oppdater.useMutation({
    onSuccess: () => {
      utils.tegning.hentMedId.invalidate({ id: aktivTegning?.id ?? "" });
    },
  });

  // Rediger tegningsdetaljer — kobler de metadata-feltene som fylles ved opprettelse til den
  // eksisterende `tegning.oppdater`. Egen mutasjon (ikke målestokk-mutasjonen over) fordi den
  // MÅ invalidere LISTA: endres `floor`, skal raden flytte seg ut av «Uten etasje» (Krav 2).
  const [redigerModalApen, setRedigerModalApen] = useState(false);
  const [redigerFeil, setRedigerFeil] = useState<string | null>(null);
  const redigerDetaljerMutation = trpc.tegning.oppdater.useMutation({
    onSuccess: () => {
      invaliderEtterRedigerDetaljer(utils, params.prosjektId, aktivTegning?.id ?? "");
      setRedigerModalApen(false);
    },
    onError: () => setRedigerFeil(t("tegninger.redigerFeil")),
  });

  const [slettModalApen, setSlettModalApen] = useState(false);
  const [slettFeil, setSlettFeil] = useState<string | null>(null);
  const slettMutation = trpc.tegning.slett.useMutation({
    onSuccess: () => {
      // Invalidér lista FØR navigering — ellers står den slettede raden igjen (samme route → ingen
      // refetch) og neste klikk treffer findUniqueOrThrow på en rad som er borte.
      invaliderEtterSlett(utils, params.prosjektId);
      setSlettModalApen(false);
      router.push(`/dashbord/${params.prosjektId}/tegninger`);
    },
    onError: (error: { message?: string; data?: { code?: string } | null }) => {
      setSlettFeil(slettFeilTekst(error, t("tegninger.slettFeilGenerisk")));
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
      .then((raaTekst) => {
        // Saniter opplastet/konvertert SVG FØR våre egne, betrodde transformasjoner
        const tekst = rensSvg(raaTekst);
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
  // Hvilken visnings-container som rendres (bilde/SVG, PDF-iframe eller «må
  // konverteres»-melding) avgjøres av disse feltene. Når den skifter, byttes
  // DOM-noden som bærer containerRef — brukes som dep slik at høyde-effekten
  // under re-måler mot den nye noden.
  const containerVariant = `${tegning?.conversionStatus ?? ""}|${tegning?.fileType ?? ""}|${tegning?.fileUrl ?? ""}`;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Forankre en zoomfaktor i pekeren og lagre ønsket scroll (settes i
    // useLayoutEffect på `zoom`, etter at bredden er oppdatert — ellers klipper
    // nettleseren verdien til gammelt maksimum og visningen lander for høyt).
    function zoomForankret(faktor: number, clientX: number, clientY: number) {
      const rect = el!.getBoundingClientRect();
      const viewX = clientX - rect.left;
      const viewY = clientY - rect.top;
      setZoom((prev) => {
        const { zoom: neste, scroll } = anvendZoomFaktor(
          prev,
          faktor,
          { min: MIN_ZOOM, maks: MAKS_ZOOM },
          { viewX, viewY, scrollLeft: el!.scrollLeft, scrollTop: el!.scrollTop },
        );
        ønsketScrollRef.current = scroll;
        return neste;
      });
    }

    // Knip: anvend samlet deltaY SIDEN GEST-START mot baseline-origoet, i ÉN
    // kontinuerlig zoom pr. ramme. Baseline (ikke forrige rammes scroll) gjør
    // forankringen immun mot fit→overflyt-klipping — ingen akkumulert hopp.
    function anvendKnip() {
      knipRafRef.current = null;
      const base = knipBaseRef.current;
      if (!base) return;
      const rect = el!.getBoundingClientRect();
      const { zoom: neste, scroll } = anvendZoomFaktor(
        base.zoom,
        knipFaktor(knipTotalRef.current),
        { min: MIN_ZOOM, maks: MAKS_ZOOM },
        {
          viewX: base.clientX - rect.left,
          viewY: base.clientY - rect.top,
          scrollLeft: base.scrollLeft,
          scrollTop: base.scrollTop,
        },
      );
      ønsketScrollRef.current = scroll;
      setZoom(neste);
    }

    function handleWheel(e: WheelEvent) {
      const gest = klassifiserWheel(e);

      // Styreflate-scroll (tofinger) → la beholderen panorere selv. Ingen
      // preventDefault = nettleseren scroller overflow-containeren (x + y).
      if (gest === "styreflate-scroll") return;

      // Knip (styreflate) OG ctrl+hjul: kontinuerlig, pekerforankret zoom.
      // preventDefault blokkerer nettleserens egen side-zoom på tegningsfeltet.
      if (gest === "knip") {
        e.preventDefault();
        // Første event i gesten fastsetter baseline-origoet. Et knip ender ikke
        // med et eget event (wheel-basert), så vi nullstiller baselinen etter en
        // kort stillhet — neste knip starter da fra gjeldende visning.
        if (!knipBaseRef.current) {
          knipBaseRef.current = {
            zoom: zoomRef.current,
            scrollLeft: el!.scrollLeft,
            scrollTop: el!.scrollTop,
            clientX: e.clientX,
            clientY: e.clientY,
          };
          knipTotalRef.current = 0;
        }
        knipTotalRef.current += e.deltaY;
        if (knipRafRef.current == null) {
          knipRafRef.current = requestAnimationFrame(anvendKnip);
        }
        if (knipSettleRef.current) clearTimeout(knipSettleRef.current);
        knipSettleRef.current = setTimeout(() => {
          knipBaseRef.current = null;
          knipTotalRef.current = 0;
        }, 160);
        return;
      }

      // Musehjul: dagens diskrete trinn (uendret).
      e.preventDefault();
      zoomForankret(hjulFaktor(e.deltaY), e.clientX, e.clientY);
    }

    // Safari rapporterer styreflate-knip som gesture*-event (ikke ctrl+wheel).
    // e.scale er kumulativ fra gesturestart; vi anvender forholdet pr. event.
    let gestureForrigeScale = 1;
    let gesturePeker = { clientX: 0, clientY: 0 };
    function handleGestureStart(e: Event) {
      e.preventDefault();
      gestureForrigeScale = (e as unknown as { scale: number }).scale || 1;
      const ge = e as unknown as { clientX?: number; clientY?: number };
      const rect = el!.getBoundingClientRect();
      gesturePeker = {
        clientX: ge.clientX ?? rect.left + rect.width / 2,
        clientY: ge.clientY ?? rect.top + rect.height / 2,
      };
    }
    function handleGestureChange(e: Event) {
      e.preventDefault();
      const scale = (e as unknown as { scale: number }).scale || 1;
      const faktor = gestureForrigeScale > 0 ? scale / gestureForrigeScale : 1;
      gestureForrigeScale = scale;
      const ge = e as unknown as { clientX?: number; clientY?: number };
      if (ge.clientX != null && ge.clientY != null) gesturePeker = { clientX: ge.clientX, clientY: ge.clientY };
      zoomForankret(faktor, gesturePeker.clientX, gesturePeker.clientY);
    }

    // Dra-for-å-panorere (midterste museknapp eller venstre + dra)
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if (punktDragRef.current) return; // drar et målepunkt → ikke panorer
      dragging = false; // Settes til true ved bevegelse
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el!.scrollLeft;
      startScrollTop = el!.scrollTop;
    }

    function handlePointerMove(e: PointerEvent) {
      if (punktDragRef.current) return; // drar et målepunkt → ikke panorer
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
    // Safari-knip (no-op i Chrome/Firefox som ikke fyrer gesture*-event).
    const handleGestureEnd = (e: Event) => e.preventDefault();
    // Safari `gesture*`-event finnes ikke i TS' DOM-lib → typet cast-mål.
    const gestureMål = el as unknown as {
      addEventListener(type: string, lytter: (e: Event) => void): void;
      removeEventListener(type: string, lytter: (e: Event) => void): void;
    };
    gestureMål.addEventListener("gesturestart", handleGestureStart);
    gestureMål.addEventListener("gesturechange", handleGestureChange);
    gestureMål.addEventListener("gestureend", handleGestureEnd);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      gestureMål.removeEventListener("gesturestart", handleGestureStart);
      gestureMål.removeEventListener("gesturechange", handleGestureChange);
      gestureMål.removeEventListener("gestureend", handleGestureEnd);
      if (knipRafRef.current != null) {
        cancelAnimationFrame(knipRafRef.current);
        knipRafRef.current = null;
      }
      if (knipSettleRef.current != null) {
        clearTimeout(knipSettleRef.current);
        knipSettleRef.current = null;
      }
      knipBaseRef.current = null;
      knipTotalRef.current = 0;
    };
  }, [tegningId, isLoading]);

  // Sett scroll etter musehjul-zoom. useLayoutEffect kjører etter DOM-mutasjon og
  // layout (bredden er oppdatert til `zoom * 100%`), men før maling — så verdien
  // klippes ikke til gammelt maksimum slik den gjorde i requestAnimationFrame.
  useLayoutEffect(() => {
    const el = containerRef.current;
    const mål = ønsketScrollRef.current;
    if (!el || !mål) return;
    el.scrollLeft = mål.left;
    el.scrollTop = mål.top;
    ønsketScrollRef.current = null;
  }, [zoom]);

  // Gi visnings-containeren en DEFINIT høyde = fra dens egen topp til bunnen av
  // vinduet. Uten dette scroller hele siden i stedet for tegningen (verktøylinja
  // forsvinner oppover) OG scroll-containeren får aldri vertikal overflyt, så
  // musehjul-zoomens scrollTop-korreksjon blir en no-op og zoomen låser seg til
  // toppkanten. Rotårsaken ligger i den DELTE dashbord-layouten (<main> er
  // display:block, så `flex-1` nedover er inert og ingen definit høyde når hit),
  // men den kan ikke endres uten å klippe de 11 prosjektsidene som er avhengige av
  // at <main> scroller — derfor måler vi høyden her, scoped til tegningssiden.
  // Verifisert i nettleser (test.sitedoc.no): piksel under peker holdt seg innen
  // ±0,2 px og hele-siden-scrollen forsvant. Matematikken i ønsketZoomScroll er urørt.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function settHøyde() {
      const e = containerRef.current;
      if (!e) return;
      settVisningshøyde(e, window.innerHeight);
    }
    settHøyde();
    window.addEventListener("resize", settHøyde);
    // Verktøylinjas høyde endres når bannere/paneler slås av og på (posisjonsvelger,
    // målestokk-panel, måle-stripe) — de ligger over containeren og flytter dermed
    // toppen. En ResizeObserver på forelderen fanger enhver slik omflyt uten at vi
    // må telle opp hver enkelt tilstand. (Ingen løkke: containerens topp er uavhengig
    // av dens egen høyde, så re-målingen gir samme verdi og stabiliserer seg.)
    const ro = new ResizeObserver(settHøyde);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener("resize", settHøyde);
      ro.disconnect();
    };
  }, [tegningId, isLoading, containerVariant]);

  // Tastatur under måling (RETUR 3 § C): Esc avbryter aktivt verktøy; Enter
  // avslutter en pågående polylinje.
  useEffect(() => {
    if (!maleEngasjert && !kalibrerModus) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMaleTilstand((t) => avsluttAktiv(t));
        setKalibrerModus(false);
        setKalibrerPunkter([]);
        setValgtPunktIdx(null);
        setVelgReferanseModus(false);
      } else if (e.key === "Enter" && aktivVerktoy === "polylinje") {
        setMaleTilstand((t) => settFerdig(t));
      } else if ((e.key === "Delete" || e.key === "Backspace") && valgtPunktIdx != null) {
        // 🟢 RETUR 6 § 2: Delete/Backspace fjerner det valgte hjørnet (beholder
        // minst 3 for areal / 2 for linje — håndtert i shared fjernPunkt).
        e.preventDefault();
        setMaleTilstand((t) => fjernPunkt(t, valgtPunktIdx));
        setValgtPunktIdx(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maleEngasjert, kalibrerModus, aktivVerktoy, valgtPunktIdx]);

  function lukkModal() {
    setVisOpprettModal(false);
    setNyMarkør(null);
    setValgtMal("");
    setValgtFlyt("");
    setOpprettFeil(null);
  }

  // Delt snap/lås for ett kandidatpunkt — leser ferskeste 90°/snap-parametre + måletilstand
  // fra refs. `ekskluderIdx` = punktet som ikke skal være snap-mål (ankeret ved tegning,
  // eller punktet som dras). Null hvis bildet mangler mål.
  const beregnSnapForKandidat = useCallback(
    (kandidat: Punkt, rectW: number, rectH: number, ekskluderIdx: number | null): SnapResultat | null => {
      const sp = snapParamRef.current;
      if (sp.imgW == null || sp.imgH == null) return null;
      const t0 = maleTilstandRef.current;
      const akt = aktivMaling(t0);
      const pågår = !!akt && !akt.ferdig;
      const sisteIdx = pågår && akt ? akt.punkter.length - 1 : -1;
      const anker = sisteIdx >= 0 ? akt!.punkter[sisteIdx]! : null;
      const forforrige = sisteIdx >= 1 ? akt!.punkter[sisteIdx - 1]! : null;
      return beregnSnap({
        kandidat, anker, forforrige,
        referanser: samleReferanser(t0, ekskluderIdx),
        referanselinje: sp.referanselinje,
        ortho: sp.ortho, snap: sp.snapPaa,
        imageWidth: sp.imgW, imageHeight: sp.imgH,
        rectW, rectH, punktTolPx: PUNKT_TREFF_PX, guideTolPx: PUNKT_TREFF_PX,
      });
    },
    [],
  );

  const nullstillForhandsvisning = useCallback(() => {
    setForhandsPunkt(null);
    setHjelpelinjer({ vertikal: null, horisontal: null });
    setAksehjelp(null);
    setVisVinkelrett(false);
  }, []);

  const handleMuseBevegelse = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Måle-forhåndsvisning (90°/snap): vis hvor neste klikk lander + aktive
    // stiplede hjelpelinjer mens musa beveger seg over en påbegynt måling.
    const t0 = maleTilstandRef.current;
    const akt = aktivMaling(t0);
    const ankerIdx = akt && !akt.ferdig ? akt.punkter.length - 1 : null;
    if (!kalibrerModus && !punktDragRef.current && harPaagaaende(t0)) {
      const snapR = beregnSnapForKandidat({ x, y }, rect.width, rect.height, ankerIdx);
      if (snapR) {
        setForhandsPunkt(snapR.punkt);
        setHjelpelinjer(snapR.hjelpelinjer);
        setAksehjelp(snapR.aksehjelpelinje);
        setVisVinkelrett(snapR.vinkelrett);
      }
    }

    // GPS-koordinat under peker (kun med georeferanse).
    if (!transformasjon) return;
    try {
      const gps = tegningTilGps({ x, y }, transformasjon);
      setGpsKoordinat(gps);
    } catch {
      setGpsKoordinat(null);
    }
  }, [transformasjon, kalibrerModus, beregnSnapForKandidat]);

  const handleMuseForlat = useCallback(() => {
    setGpsKoordinat(null);
    nullstillForhandsvisning();
  }, [nullstillForhandsvisning]);

  // Skille mellom pan (dra) og klikk (plassering)
  const museNedPosRef = useRef<{ x: number; y: number } | null>(null);
  const handleMuseNed = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    museNedPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleBildeKlikk = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Nettopp dratt et målepunkt → klikket som følger skal ikke sette nytt punkt.
    if (nettoppDrattRef.current) { nettoppDrattRef.current = false; return; }
    // Ignorer klikk hvis musen ble dratt (pan)
    if (museNedPosRef.current) {
      const dx = e.clientX - museNedPosRef.current.x;
      const dy = e.clientY - museNedPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;
    }

    // Måle-/kalibrermodus: samle klikkpunkter (prosent).
    {
      const r = e.currentTarget.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;

      // Kalibrering tar nøyaktig 2 punkter (egen samling, uendret flyt).
      if (kalibrerModus) {
        setKalibrerPunkter((p) => (p.length >= 2 ? [{ x: px, y: py }] : [...p, { x: px, y: py }]));
        return;
      }

      // 🟢 GJENOPPTA § 1: «velg referanselinje»-modus — klikk på et segment i en
      // eksisterende måling (vegg langs en skrå linje) setter det som referanse.
      if (velgReferanseModus) {
        const traffId = finnMalingTreff(maleTilstand.malinger, { x: px, y: py }, r.width, r.height, PUNKT_TREFF_PX);
        const m = traffId ? maleTilstand.malinger.find((x) => x.id === traffId) : null;
        if (m && m.punkter.length >= 2) {
          const lukket = m.verktoy === "areal" && m.ferdig;
          const kant = finnNaermesteKant(m.punkter, { x: px, y: py }, r.width, r.height, PUNKT_TREFF_PX, lukket);
          if (kant >= 0) {
            setReferanselinje({ a: m.punkter[kant]!, b: m.punkter[(kant + 1) % m.punkter.length]! });
          }
        }
        setVelgReferanseModus(false);
        return;
      }

      // Et klikk i bakgrunnen/på en kant velger bort et tidligere valgt hjørne
      // (klikk PÅ et hjørne går via startPunktDrag og beholder valget).
      setValgtPunktIdx(null);

      // 🟢 RETUR 6 § 2: shift-klikk på en kant av den aktive figuren → nytt hjørne
      // der (velges straks, så det kan dras / fjernes). Areal regner med sluttkanten.
      if (e.shiftKey && aktivMal && aktivMal.punkter.length >= 2) {
        const lukket = aktivMal.verktoy === "areal" && aktivMal.ferdig;
        const kant = finnNaermesteKant(aktivMal.punkter, { x: px, y: py }, r.width, r.height, PUNKT_TREFF_PX, lukket);
        if (kant >= 0) {
          setMaleTilstand((t) => settInnPunktPaaKant(t, kant, { x: px, y: py }));
          setValgtPunktIdx(nyKantPunktIndeks(kant));
          return;
        }
      }

      // En påbegynt måling → legg til punkt (RETUR 2: ingen reset på neste klikk).
      // 90°/snap: punktet justeres via beregnSnap FØR det legges til (lukke-terskelen
      // regnes mot det SNAPPEDE punktet, så snap-til-første-punkt lukker areal riktig).
      if (harPaagaaende(maleTilstand)) {
        const aktP = aktivMaling(maleTilstand);
        const ankerIdx = aktP && !aktP.ferdig ? aktP.punkter.length - 1 : null;
        const snapR = beregnSnapForKandidat({ x: px, y: py }, r.width, r.height, ankerIdx);
        const fp = snapR ? snapR.punkt : { x: px, y: py };
        const treffFp = (q: Punkt) =>
          Math.hypot(((q.x - fp.x) / 100) * r.width, ((q.y - fp.y) / 100) * r.height) <= PUNKT_TREFF_PX;
        setMaleTilstand((t) => leggTilPunkt(t, fp, treffFp));
        nullstillForhandsvisning();
        return;
      }

      // Ferdige målinger finnes: klikk på en velger den (RETUR 2).
      if (maleTilstand.malinger.length) {
        const traff = finnMalingTreff(maleTilstand.malinger, { x: px, y: py }, r.width, r.height, PUNKT_TREFF_PX);
        if (traff) {
          setMaleTilstand((t) => velgMaling(t, traff));
          return;
        }
      }

      // En måling er valgt (engasjert), men klikket bommet → gjør INGENTING. Et
      // bom-trykk skal ALDRI slette en ferdig figur eller opprette en markør (§ 2).
      if (maleEngasjert) return;
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
  }, [posisjonsvelgerAktiv, aktivTegning, fullførPosisjonsvelger, router, klikkModus, maleEngasjert, kalibrerModus, maleTilstand, aktivMal, velgReferanseModus, beregnSnapForKandidat, nullstillForhandsvisning]);

  // Dra et satt målepunkt med musa (TILLEGG RETUR 1). Starter på punkt-prikken;
  // move/up lyttes på vindu så dra fortsetter utenfor prikken. Rører ikke maleFerdig
  // (lukket areal/polylinje forblir lukket), setter ikke nytt punkt (klikk undertrykkes).
  const startPunktDrag = useCallback((index: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    punktDragRef.current = true;
    setDragIdx(index);
    setValgtPunktIdx(index); // 🟢 RETUR 6 § 2: klikk på et hjørne velger det (for Delete)
  }, []);

  useEffect(() => {
    if (dragIdx == null) return;
    const idx = dragIdx;
    function flytt(ev: PointerEvent) {
      const r = maleInnerRef.current?.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return;
      const x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
      // 90°/snap under dra: snap til egne punkter + hjelpelinjer (ekskluder punktet
      // som dras). Lås-mot-anker gjelder ikke dra (ingen «anker» i en ferdig figur).
      const snapR = beregnSnapForKandidat({ x, y }, r.width, r.height, idx);
      const fp = snapR ? snapR.punkt : { x, y };
      setMaleTilstand((t) => flyttPunkt(t, idx, fp));
      if (snapR) { setHjelpelinjer(snapR.hjelpelinjer); setAksehjelp(snapR.aksehjelpelinje); }
    }
    function slutt() {
      punktDragRef.current = false;
      nettoppDrattRef.current = true; // undertrykk klikket som følger pointerup
      setDragIdx(null);
      nullstillForhandsvisning();
    }
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slutt);
    return () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slutt);
    };
  }, [dragIdx, beregnSnapForKandidat, nullstillForhandsvisning]);

  // Modell-korreksjon (funn 2026-08-22): dokumentflyt er nøkkelen, ikke faggruppe.
  // Serveren (F1/B1) krever `dokumentflytId` for ikke-HMS og validerer at flyten har malen
  // + at bruker er registrator-medlem. Faggruppene utledes FRA flyten (flyt.faggruppeId).
  const alleArbeidsforlop = (arbeidsforlop ?? []) as unknown as DokumentflytRad[];
  const mineOpprettFlytIder = new Set(mineOpprettFlyter ?? []);
  // Flyter brukeren kan opprette i (registrator-medlem).
  const opprettFlyter = alleArbeidsforlop.filter((af) => mineOpprettFlytIder.has(af.id));
  const valgtFlytObjekt = opprettFlyter.find((af) => af.id === valgtFlyt) ?? null;

  // HMS-maler er FLYT-UAVHENGIGE: serveren auto-ruter dem til prosjektets HMS-flyt og
  // FORBYR klient-sendt dokumentflytId (sjekkliste.ts:345 / oppgave.ts). De vises i egen
  // gruppe (A-vedtak), og ved submit sendes ingen flyt/faggruppe for dem.
  const alleMalerTypet = (alleMaler ?? []) as Array<{ id: string; name: string; category: string; domain: string | null }>;
  // NB: `Map` er skygget av lucide-react-ikonet i denne fila — bruk Set av HMS-mal-IDer.
  const hmsMalIder = new Set(alleMalerTypet.filter((m) => m.domain === "hms").map((m) => m.id));
  const erHmsMal = (malId: string) => hmsMalIder.has(malId);

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    setOpprettFeil(null);
    if (!valgtMal) return;
    const hms = erHmsMal(valgtMal);
    // Ikke-HMS krever en valgt flyt (kilde til dokumentflytId + faggruppe). HMS: server auto-ruter.
    if (!hms && !valgtFlytObjekt) return;
    const flytInput = byggOpprettInput(hms, valgtFlytObjekt);

    if (opprettType === "oppgave") {
      opprettOppgaveMutation.mutate({
        templateId: valgtMal,
        ...flytInput,
        title: "Ny oppgave",
        drawingId: aktivTegning?.id,
        positionX: nyMarkør?.x,
        positionY: nyMarkør?.y,
      });
    } else {
      opprettSjekklisteMutation.mutate({
        templateId: valgtMal,
        ...flytInput,
        byggeplassId: aktivByggeplass?.id,
        drawingId: aktivTegning?.id,
        positionX: nyMarkør?.x,
        positionY: nyMarkør?.y,
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

  // Markører fra eksisterende oppgaver (periode-filtrert på createdAt).
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
      createdAt: String((o as { createdAt?: string }).createdAt ?? ""),
    }))
    .filter((m) => !m.createdAt || innenforPeriode(new Date(m.createdAt), pFra, pTil));

  // L2: kontrollpunkt-markører, farget av den avledede tilstanden (samme fargemodell
  // som liste/rutenett — delt hjelper). Form (fylt pin vs. omriss) = arbeid startet.
  const kontrollpunkter: Array<{ id: string; x: number; y: number; label: string; omradeNavn: string | null; sjekklisteId: string | null; tilstand: TilstandVisning; createdAt: string }> =
    (kontrollpunktMarkører ?? [])
      .map((p) => ({
        id: p.id,
        x: p.positionX!,
        y: p.positionY!,
        label: p.sjekklisteMal.prefix ? `${p.sjekklisteMal.prefix} — ${p.sjekklisteMal.name}` : p.sjekklisteMal.name,
        omradeNavn: p.omrade?.navn ?? null,
        // 3a: startet punkt → åpne den koblede sjekklista direkte; planlagt (ingen
        // sjekkliste ennå) → fall tilbake til kontrollplan-oversikten som før.
        sjekklisteId: p.sjekkliste?.id ?? null,
        tilstand: avledPunktTilstand(p, naaUke),
        createdAt: String((p as { opprettet?: string }).opprettet ?? ""), // KontrollplanPunkt.opprettet
      }))
      .filter((m) => !m.createdAt || innenforPeriode(new Date(m.createdAt), pFra, pTil));

  // Flyt-velger (modell-korreksjon 2026-08-22): flyter brukeren kan OPPRETTE i, med ≥1
  // ikke-HMS-mal av valgt kategori. Etikett = flytnavn. Admin/manage_field/domene-bypass
  // fjernet: serveren krever registrator-medlemskap av flyten for opprett (også for admin,
  // F1-oppfølger 2026-07-24) — å vise maler man ikke kan opprette var villedende (pkt 3/4).
  const flytAlternativer = opprettFlyter
    .filter((af) => af.maler.some((wt) => wt.template.category === opprettType && !hmsMalIder.has(wt.template.id)))
    .map((af) => ({ value: af.id, label: af.name }));

  // Mal-liste: den valgte flytens ikke-HMS-maler + ALLTID HMS-maler (flyt-uavhengige, egen gruppe).
  const flytMalAlternativer = valgtFlytObjekt
    ? valgtFlytObjekt.maler
        .filter((wt) => wt.template.category === opprettType && !hmsMalIder.has(wt.template.id))
        .map((wt) => ({ value: wt.template.id, label: wt.template.name }))
    : [];
  const hmsMalAlternativer = alleMalerTypet
    .filter((m) => m.category === opprettType && m.domain === "hms")
    .map((m) => ({ value: m.id, label: `${m.name} (HMS)` }));
  const malAlternativer = [...flytMalAlternativer, ...hmsMalAlternativer];

  // Auto-velg flyt når nøyaktig én er mulig; rydd stale valg (f.eks. ved kategori-bytte).
  useEffect(() => {
    if (!visOpprettModal) return;
    const gyldig = flytAlternativer.some((f) => f.value === valgtFlyt);
    if (valgtFlyt && !gyldig) setValgtFlyt("");
    else if (!valgtFlyt && flytAlternativer.length === 1) setValgtFlyt(flytAlternativer[0]!.value);
  }, [visOpprettModal, flytAlternativer, valgtFlyt]);

  // Ingen tegning valgt
  if (!aktivTegning) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Map className="mx-auto mb-4 h-16 w-16 text-gray-200" />
          <p className="text-lg font-medium text-gray-400">
            {aktivByggeplass
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
  // Feilet/konvertert PDF beholder fileType="pdf" (feilveien flipper ikke typen) → banner-tekst
  // OG re-konverter-vei velges etter filtype (se konverteringBanner). `kanAdministrereOmrade`
  // (gruppe.hentMinTilgang.erAdmin) er admin-proxy for slett/re-konverter; serveren er porten.
  const banner = konverteringBanner(fileType);
  const erLaster = opprettOppgaveMutation.isPending || opprettSjekklisteMutation.isPending;
  const zoomProsent = Math.round(zoom * 100);

  // --- Måleverktøy: utledet mm/piksel + kilde-sporet målestokk ---
  const mmPrPiksel = tegning.mmPrPiksel ?? null;
  const scaleKilde = tegning.scaleKilde ?? null;
  const scaleDenom = parseMalestokk(tegning.scale);
  const imgW = tegning.imageWidth ?? null;
  const imgH = tegning.imageHeight ?? null;
  snapParamRef.current = { imgW, imgH, ortho, snapPaa, referanselinje };
  // Georeferanse har FORTRINN når den finnes med 3+ punkter (måler bakken, ikke papiret,
  // og tåler at tegningen er strukket). Kun 3+ punkter gir en trygg affin avbildning.
  const antallGeoPunkter = geoRef ? 2 + (geoRef.ekstraPunkter?.length ?? 0) : 0;
  const harGeoref = !!transformasjon && antallGeoPunkter >= 3;
  const maaleKilde: string | null = harGeoref ? "georeferanse" : scaleKilde;
  const kanMaleNaa = harGeoref || kanMale(tegning.scale, mmPrPiksel, scaleKilde);
  // Lesbar grunn når verktøyet er avslått (ordre § D). Et tittelfelt-forslag er
  // IKKE lenger en avslagsgrunn (det er nå målbart direkte) — det som gjenstår er
  // manglende mm/piksel eller manglende/utolkbar målestokk.
  const maleAvslagGrunn: string | null = kanMaleNaa
    ? null
    : mmPrPiksel == null
      ? t("maaling.avslagIngenMmPrPiksel")
      : t("maaling.avslagIngenMalestokk");

  const formatMeter = (m: number) =>
    `${m.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
  const formatAreal = (m2: number) =>
    `${m2.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

  // Kilde-etikett — «en måleverdi uten sin opprinnelse er en påstand» (ordre § D).
  const kildeEtikett = (() => {
    const k = maaleKilde;
    if (k === "georeferanse") return t("maaling.kildeGeoreferanse");
    if (k === "dwg") return t("maaling.kildeDwg");
    if (k === "kalibrert") return t("maaling.kildeKalibrert");
    if (k === "manuell") return t("maaling.kildeManuell");
    if (k === "tittelfelt") return t("maaling.kildeTittelfelt");
    return "";
  })();
  const malestokkEtikett = harGeoref
    ? kildeEtikett
    : tegning.scale
      ? `${t("maaling.malestokk")} ${tegning.scale}, ${kildeEtikett}`
      : kildeEtikett;

  // Mål ett segment (meter). Georeferanse → GPS-avstand; ellers papir-målestokk.
  const segMeter = (a: Punkt, b: Punkt): number | null => {
    if (harGeoref && transformasjon) {
      return avstandMeter(tegningTilGps(a, transformasjon), tegningTilGps(b, transformasjon));
    }
    if (mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
      return malMm(a, b, imgW, imgH, mmPrPiksel, scaleDenom) / 1000;
    }
    return null;
  };

  const erAreal = aktivVerktoy === "areal";

  // Resultat for den AKTIVE målingen: linjal/polylinje per-segment + total;
  // areal viser én sentroide-etikett (m²).
  const maleSegmenter: MaalingSegment[] = [];
  let maleTotalMeter = 0;
  if (!erAreal) {
    for (let i = 1; i < aktivPunkter.length; i++) {
      const a = aktivPunkter[i - 1];
      const b = aktivPunkter[i];
      if (!a || !b) continue;
      const m = segMeter(a, b);
      if (m == null) continue;
      maleTotalMeter += m;
      maleSegmenter.push({ midx: (a.x + b.x) / 2, midy: (a.y + b.y) / 2, tekst: formatMeter(m) });
    }
  }

  // Areal (lukket polygon): m² via papir-shoelace, omkrets via lukket ring.
  let arealM2: number | null = null;
  let omkretsMeter = 0;
  let arealSenter: { x: number; y: number } | null = null;
  if (erAreal && aktivPunkter.length >= 3) {
    const ring = [...aktivPunkter, aktivPunkter[0]!];
    for (let i = 1; i < ring.length; i++) {
      const m = segMeter(ring[i - 1]!, ring[i]!);
      if (m != null) omkretsMeter += m;
    }
    if (mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
      arealM2 = malArealMm2(aktivPunkter, imgW, imgH, mmPrPiksel, scaleDenom) / 1_000_000;
    }
    arealSenter = {
      x: aktivPunkter.reduce((s, p) => s + p.x, 0) / aktivPunkter.length,
      y: aktivPunkter.reduce((s, p) => s + p.y, 0) / aktivPunkter.length,
    };
  }
  // Sentroide-etikett for areal (m² når tilgjengelig).
  if (erAreal && arealSenter && arealM2 != null) {
    maleSegmenter.push({ midx: arealSenter.x, midy: arealSenter.y, tekst: formatAreal(arealM2) });
  }

  // Kort resultat-etikett for en INAKTIV måling (vises ved tyngdepunktet).
  const summaryFor = (m: Maling): string => {
    if (m.verktoy === "areal") {
      if (m.punkter.length >= 3 && mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
        return formatAreal(malArealMm2(m.punkter, imgW, imgH, mmPrPiksel, scaleDenom) / 1_000_000);
      }
      return "";
    }
    if (m.punkter.length < 2) return "";
    let sum = 0;
    for (let i = 1; i < m.punkter.length; i++) {
      const d = segMeter(m.punkter[i - 1]!, m.punkter[i]!);
      if (d != null) sum += d;
    }
    return formatMeter(sum);
  };

  // RETUR 2: trykk på verktøyknappen starter en NY måling; forrige blir stående.
  const velgMaleVerktoy = (verktoy: MaleVerktoy) => {
    setMaleTilstand((t) => startMaling(t, verktoy, `m${(nesteIdRef.current += 1)}`));
    setKalibrerModus(false);
    setKalibrerPunkter([]);
    setKlikkModus("plassering");
    setNyMarkør(null);
  };
  const avsluttMaling = () => {
    setMaleTilstand((t) => avsluttAktiv(t));
    setKalibrerModus(false);
    setKalibrerPunkter([]);
    setKalibrerLengde("");
  };
  const slettAktivMaling = () => setMaleTilstand((t) => slettAktiv(t));
  const slettAlleMalinger = () => { setMaleTilstand(slettAlle()); setSlettAlleModalApen(false); };
  // Start kalibrering (korreksjonen, ordre § C/§ D) — fra målestokk-panelet ELLER
  // fra «Stemmer ikke? Kalibrer» ved måleresultatet. Åpner panelet så mm-feltet er
  // synlig; behold ferdige målinger, men forkast påbegynt og rydd valg.
  const startKalibrering = () => {
    setKalibrerModus(true);
    setMaleTilstand((t) => avsluttAktiv(t));
    setKalibrerPunkter([]);
    setKalibrerLengde("");
    setKlikkModus("plassering");
    setNyMarkør(null);
    setVisMalestokkPanel(true);
  };

  const settMalestokk = (verdi: string, kilde: "manuell" | "kalibrert") => {
    oppdaterMalestokkMutation.mutate({ id: tegning.id, scale: verdi, scaleKilde: kilde });
  };
  const bekreftForslag = () => {
    if (tegning.scale) oppdaterMalestokkMutation.mutate({ id: tegning.id, scaleKilde: "manuell" });
  };
  // Kalibrering: 2 punkter + kjent lengde (mm) → utled målestokk-nevner.
  const lagreKalibrering = () => {
    const a = kalibrerPunkter[0];
    const b = kalibrerPunkter[1];
    const mm = parseFloat(kalibrerLengde.replace(",", "."));
    if (!a || !b || mmPrPiksel == null || imgW == null || imgH == null || !Number.isFinite(mm) || mm <= 0) return;
    const nevner = kalibrerMalestokk(a, b, imgW, imgH, mmPrPiksel, mm);
    if (nevner == null) return;
    settMalestokk(`1:${Math.round(nevner)}`, "kalibrert");
    setKalibrerModus(false);
    setKalibrerPunkter([]);
    setKalibrerLengde("");
  };

  const MALESTOKK_VALG = ["1:20", "1:50", "1:100", "1:200", "1:500"];

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
        {/* D6b: tidligere revisjoner — klikk åpner forrige fil skrivebeskyttet */}
        <RevisjonsListe revisjoner={tegning.revisions} />
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

        {/* Måleverktøy — kun for bilde-tegninger (PNG/JPG/SVG) */}
        {erBilde && (
          <>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <div className="flex items-center rounded border border-gray-200">
              <button
                onClick={() => {
                  setVisMalestokkPanel((v) => !v);
                  setEgendefinertMalestokk("");
                }}
                className={`flex items-center gap-1 rounded-l px-2 py-1 text-xs ${
                  visMalestokkPanel ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                title={t("maaling.malestokkTittel")}
              >
                <Crosshair className="h-3 w-3" />
                {tegning.scale && !harGeoref ? tegning.scale : t("maaling.malestokk")}
              </button>
              {/* Tre måleverktøy (RETUR 3 § C, som Adobe): linjal · polylinje · areal.
                  Ett aktivt om gangen; klikk på aktivt verktøy slår det av. */}
              <button
                disabled={!kanMaleNaa}
                onClick={() => velgMaleVerktoy("linjal")}
                className={`flex items-center gap-1 border-l border-gray-200 px-2 py-1 text-xs ${
                  aktivVerktoy === "linjal" ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={kanMaleNaa ? t("maaling.verktoyLinjal") : (maleAvslagGrunn ?? "")}
              >
                <Ruler className="h-3 w-3" />
                {t("maaling.verktoyLinjal")}
              </button>
              <button
                disabled={!kanMaleNaa}
                onClick={() => velgMaleVerktoy("polylinje")}
                className={`flex items-center gap-1 border-l border-gray-200 px-2 py-1 text-xs ${
                  aktivVerktoy === "polylinje" ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={kanMaleNaa ? t("maaling.verktoyPolylinje") : (maleAvslagGrunn ?? "")}
              >
                <Waypoints className="h-3 w-3" />
                {t("maaling.verktoyPolylinje")}
              </button>
              <button
                disabled={!kanMaleNaa}
                onClick={() => velgMaleVerktoy("areal")}
                className={`flex items-center gap-1 rounded-r border-l border-gray-200 px-2 py-1 text-xs ${
                  aktivVerktoy === "areal" ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={kanMaleNaa ? t("maaling.verktoyAreal") : (maleAvslagGrunn ?? "")}
              >
                <VectorSquare className="h-3 w-3" />
                {t("maaling.verktoyAreal")}
              </button>
            </div>
            {/* 🟢 90°-lås · snap · referanselinje (ordre 90-snap + GJENOPPTA). */}
            <div className="flex items-center rounded border border-gray-200">
              <button
                disabled={!kanMaleNaa}
                onClick={() => setOrtho((v) => !v)}
                className={`flex items-center gap-1 rounded-l px-2 py-1 text-xs ${
                  ortho ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={t("maaling.laasVinkelHjelp")}
              >
                <TriangleRight className="h-3 w-3" />
                {t("maaling.laasVinkel")}
              </button>
              <button
                disabled={!kanMaleNaa || !ortho}
                onClick={() => { setVelgReferanseModus((v) => !v); if (referanselinje) setReferanselinje(null); }}
                className={`flex items-center gap-1 border-l border-gray-200 px-2 py-1 text-xs ${
                  velgReferanseModus || referanselinje ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={t("maaling.referanselinjeHjelp")}
              >
                <Spline className="h-3 w-3" />
                {t("maaling.referanselinje")}
              </button>
              <button
                disabled={!kanMaleNaa}
                onClick={() => setSnapPaa((v) => !v)}
                className={`flex items-center gap-1 rounded-r border-l border-gray-200 px-2 py-1 text-xs ${
                  snapPaa ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={t("maaling.snapHjelp")}
              >
                <Magnet className="h-3 w-3" />
                {t("maaling.snap")}
              </button>
            </div>
          </>
        )}

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
              <button
                disabled={!kanAdministrereOmrade}
                onClick={() => { setKlikkModus("omrade"); setNyMarkør(null); setValgtElement(null); }}
                className={`flex items-center gap-1 rounded-r px-2 py-1 text-xs ${
                  klikkModus === "omrade" ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={kanAdministrereOmrade ? "Tegn nytt område (polygon)" : "Kun administratorer kan opprette områder"}
              >
                <Pentagon className="h-3 w-3" />
                Område
              </button>
            </div>
          </>
        )}

        {/* L2 lagfilter: hvilke markørtyper vises. Begge på = «begge». «Frie sjekklister»
            er ikke et lag (rendres ikke på tegning i dag). */}
        {(kontrollpunkter.length > 0 || markører.length > 0) && (
          <>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVisKontrollpunkter((v) => !v)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                  visKontrollpunkter ? "bg-sitedoc-primary/10 text-sitedoc-primary" : "text-gray-400 hover:bg-gray-100"
                }`}
                title={t("kontrollplan.lagKontrollpunkter")}
              >
                <MapPin className="h-3 w-3" />
                {t("kontrollplan.lagKontrollpunkter")} ({kontrollpunkter.length})
              </button>
              <button
                onClick={() => setVisOppgaver((v) => !v)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                  visOppgaver ? "bg-red-50 text-red-600" : "text-gray-400 hover:bg-gray-100"
                }`}
                title={t("kontrollplan.lagOppgaver")}
              >
                <MapPin className="h-3 w-3" />
                {t("kontrollplan.lagOppgaver")} ({markører.length})
              </button>
            </div>
          </>
        )}

        {/* Periodefilter på markørene (createdAt). Vises når tegningen HAR markører (ufiltrert), så
            filteret er tilgjengelig selv når gjeldende periode skjuler alle. */}
        {((oppgaveMarkører?.length ?? 0) + (kontrollpunktMarkører?.length ?? 0)) > 0 && (
          <>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <PeriodeFilter periode={periode} onEndre={setPeriode} />
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

        {/* Rediger tegningsdetaljer + slett — kun admin. Rediger kobler de opprettelses-feltene
            til `tegning.oppdater` (bl.a. etasje, som flytter raden ut av «Uten etasje»). Slett
            åpner bekreftelsesmodal (ikke confirm()); serveren har slettevakt med tallet. */}
        {kanAdministrereOmrade && (
          <>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <button
              onClick={() => { setRedigerFeil(null); setRedigerModalApen(true); }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-sitedoc-primary"
              title={t("tegninger.redigerDetaljer")}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setSlettFeil(null); setSlettModalApen(true); }}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              title={t("tegninger.slettTegning")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Konverteringsstatus — tekst per filtype (PDF vs DWG) */}
      {erDwgKonvertering && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            {t(banner.konverteresNokkel)}
          </span>
        </div>
      )}
      {dwgFeilet && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-800">
            {t(banner.feiletNokkel, { feil: tegning.conversionError ?? t("tegninger.ukjentFeil") })}
          </span>
          {/* PDF-feil → prosjekt-batch rekonverterPdf (kjører ALLE feilede PDF-er). DWG-feil →
              provKonverteringIgjen (én tegning). Kun admin ser knappen; serveren er porten. */}
          {kanAdministrereOmrade && (banner.handling === "rekonverterPdf" ? (
            <button
              onClick={() => rekonverterPdfMutation.mutate({ projectId: params.prosjektId })}
              disabled={rekonverterPdfMutation.isPending}
              title={t("tegninger.rekonverterPdfHjelp")}
              className="ml-auto flex items-center gap-1.5 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${rekonverterPdfMutation.isPending ? "animate-spin" : ""}`} />
              {t("tegninger.rekonverterPdf")}
            </button>
          ) : (
            <button
              onClick={() => provKonverteringIgjenMutation.mutate({ id: tegning.id })}
              disabled={provKonverteringIgjenMutation.isPending}
              className="ml-auto rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              {t("tegninger.provIgjen")}
            </button>
          ))}
        </div>
      )}

      {/* Målestokk-panel: velg/bekreft/kalibrer — forhåndsvalg, ikke fritekst */}
      {erBilde && visMalestokkPanel && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs">
          <span className="font-medium text-gray-700">{t("maaling.malestokkTittel")}:</span>
          {harGeoref ? (
            <span className="text-gray-600">{t("maaling.georeferertInfo")}</span>
          ) : mmPrPiksel == null ? (
            <span className="text-amber-700">{t("maaling.avslagIngenMmPrPiksel")}</span>
          ) : (
            <>
              <select
                value={tegning.scale && MALESTOKK_VALG.includes(tegning.scale) ? tegning.scale : "annet"}
                onChange={(e) => {
                  if (e.target.value === "annet") { setEgendefinertMalestokk(tegning.scale ?? ""); return; }
                  settMalestokk(e.target.value, "manuell");
                }}
                className="rounded border border-gray-300 px-2 py-1"
              >
                {MALESTOKK_VALG.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
                <option value="annet">{t("maaling.annet")}</option>
              </select>
              {(!tegning.scale || !MALESTOKK_VALG.includes(tegning.scale)) && (
                <span className="flex items-center gap-1">
                  <input
                    value={egendefinertMalestokk}
                    onChange={(e) => setEgendefinertMalestokk(e.target.value)}
                    placeholder="1:75"
                    className="w-20 rounded border border-gray-300 px-2 py-1"
                  />
                  <button
                    onClick={() => { if (parseMalestokk(egendefinertMalestokk)) settMalestokk(egendefinertMalestokk.trim(), "manuell"); }}
                    disabled={!parseMalestokk(egendefinertMalestokk)}
                    className="rounded bg-sitedoc-primary px-2 py-1 text-white disabled:opacity-40"
                  >
                    {t("handling.lagre")}
                  </button>
                </span>
              )}
              {scaleKilde === "tittelfelt" && tegning.scale && (
                <button
                  onClick={bekreftForslag}
                  className="rounded border border-amber-400 bg-amber-50 px-2 py-1 font-medium text-amber-800 hover:bg-amber-100"
                  title={t("maaling.bekreftForslagTittel")}
                >
                  {t("maaling.bekreftForslag", { scale: tegning.scale })}
                </button>
              )}
              {tegning.scale && scaleKilde && scaleKilde !== "tittelfelt" && (
                <span className="text-gray-500">({kildeEtikett})</span>
              )}
              {/* Selve kalibreringsflyten (steg + mm-felt) bor i banneret over
                  tegningen (ordre § C) — her bare inngangen. Skjult mens den pågår. */}
              {!kalibrerModus && (
                <button
                  onClick={startKalibrering}
                  className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
                >
                  {t("maaling.kalibrer")}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Måle-resultatstripe: alltid med kilde — «en måleverdi uten sin opprinnelse er en påstand».
          Tre verktøy (RETUR 3 § C): linjal/polylinje viser lengde, areal viser m² + omkrets. */}
      {erBilde && maleEngasjert && (
        <div className="flex flex-wrap items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs">
          {aktivVerktoy === "areal" ? (
            <VectorSquare className="h-4 w-4 text-sitedoc-primary" />
          ) : aktivVerktoy === "polylinje" ? (
            <Waypoints className="h-4 w-4 text-sitedoc-primary" />
          ) : (
            <Ruler className="h-4 w-4 text-sitedoc-primary" />
          )}
          {erAreal ? (
            aktivPunkter.length < 3 ? (
              <span className="text-gray-600">{t("maaling.hintAreal")}</span>
            ) : (
              <span className="font-semibold text-gray-800">
                {arealM2 != null ? formatAreal(arealM2) : "—"}
                <span className="ml-2 font-normal text-gray-600">
                  {t("maaling.omkrets")}: {formatMeter(omkretsMeter)}
                </span>
                <span className="ml-1 font-normal text-gray-500">({malestokkEtikett})</span>
              </span>
            )
          ) : aktivPunkter.length < 2 ? (
            <span className="text-gray-600">
              {aktivVerktoy === "polylinje" ? t("maaling.hintPolylinje") : t("maaling.klikkToPunkter")}
            </span>
          ) : (
            <span className="font-semibold text-gray-800">
              {formatMeter(maleTotalMeter)}
              <span className="ml-1 font-normal text-gray-500">({malestokkEtikett})</span>
            </span>
          )}
          {/* 🟢 TILLEGG: polylinje avsluttes KUN eksplisitt (paritet med mobil, ikke
              dobbeltklikk/klikk-nær-punkt). «Fullfør» på en pågående, «Fortsett» på
              en ferdig for å legge til flere punkter. Enter avslutter også. */}
          {aktivVerktoy === "polylinje" && harPaagaaende(maleTilstand) && aktivPunkter.length >= 2 && (
            <button onClick={() => setMaleTilstand((t) => settFerdig(t))} className="flex items-center gap-1 rounded border border-green-300 px-2 py-1 text-green-700 hover:bg-green-50">
              <Check className="h-3 w-3" />
              {t("maaling.fullfor")}
            </button>
          )}
          {aktivMal?.verktoy === "polylinje" && aktivMal.ferdig && (
            <button onClick={() => setMaleTilstand((t) => gjenoppta(t))} className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100">
              <Plus className="h-3 w-3" />
              {t("maaling.fortsett")}
            </button>
          )}
          {/* Kalibrering er korreksjonen (ordre § D): står ved resultatet, ikke
              som et bekreftelsessteg før måling. Kun for papir-målestokken —
              georeferanse kalibreres ikke. */}
          {!harGeoref && mmPrPiksel != null && aktivPunkter.length >= 2 && (
            <button
              onClick={startKalibrering}
              className="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100"
            >
              {t("maaling.stemmerIkkeKalibrer")}
            </button>
          )}
          {/* Slett aktiv måling · Slett alle (modal) · Lukk (RETUR 2). */}
          <button onClick={slettAktivMaling} className="ml-auto flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50">
            <Trash2 className="h-3 w-3" />
            {t("maaling.slett")}
          </button>
          {maleTilstand.malinger.length > 1 && (
            <button onClick={() => setSlettAlleModalApen(true)} className="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100">
              {t("maaling.slettAlle")}
            </button>
          )}
          <button onClick={avsluttMaling} className="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100">
            {t("handling.lukk")}
          </button>
        </div>
      )}

      {/* Kalibrerings-banner med SYNLIGE steg (ordre § C) — Kenneth skjønte ikke
          hvordan kalibrering virket. Står tydelig ved tegningen; markøren viser
          trådkors (cursor-crosshair), og punktene tegnes (MaalingOverlay). */}
      {erBilde && kalibrerModus && (
        <div className="flex flex-wrap items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs">
          <Crosshair className="h-4 w-4 text-sitedoc-primary" />
          <span className={kalibrerPunkter.length === 0 ? "font-semibold text-gray-800" : "text-gray-500"}>
            {t("maaling.kalibrerSteg1")}
          </span>
          <span className={kalibrerPunkter.length === 1 ? "font-semibold text-gray-800" : "text-gray-500"}>
            {t("maaling.kalibrerSteg2")}
          </span>
          <span className={kalibrerPunkter.length >= 2 ? "font-semibold text-gray-800" : "text-gray-500"}>
            {t("maaling.kalibrerSteg3")}
          </span>
          {kalibrerPunkter.length >= 2 && (
            <span className="flex items-center gap-1">
              <input
                value={kalibrerLengde}
                onChange={(e) => setKalibrerLengde(e.target.value)}
                placeholder="mm"
                autoFocus
                className="w-24 rounded border border-gray-300 px-2 py-1"
              />
              <button
                onClick={lagreKalibrering}
                disabled={!(parseFloat(kalibrerLengde.replace(",", ".")) > 0)}
                className="rounded bg-sitedoc-primary px-2 py-1 text-white disabled:opacity-40"
              >
                {t("handling.lagre")}
              </button>
            </span>
          )}
          <button onClick={() => setKalibrerPunkter([])} className="ml-auto rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100">
            {t("maaling.nullstill")}
          </button>
          <button onClick={avsluttMaling} className="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100">
            {t("handling.avbryt")}
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
              ref={maleInnerRef}
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
                <SignertBilde
                  url={tegning.fileUrl}
                  alt={tegning.name}
                  className="block w-full"
                  crossOrigin="anonymous"
                  draggable={false}
                />
              )}

              {/* Område-polygoner */}
              <OmradeOverlay
                omrader={((tegningOmrader ?? []) as Array<{ id: string; navn: string; type: string; polygon: unknown; farge: string }>).map((o) => ({
                  ...o,
                  polygon: (Array.isArray(o.polygon) ? o.polygon : []) as { x: number; y: number }[],
                }))}
                synlig={visOmrader && klikkModus !== "omrade"}
              />

              {/* Måle-overlay (RETUR 2): alle målinger. Inaktive dempet + klikkbare
                  for valg; den aktive uthevet med dragbare punkter + segment-etiketter. */}
              {maleTilstand.malinger.map((m) => {
                const erAktiv = m.id === maleTilstand.aktivId;
                const sum = erAktiv ? "" : summaryFor(m);
                return (
                  <MaalingOverlay
                    key={m.id}
                    punkter={m.punkter}
                    segmenter={
                      erAktiv
                        ? maleSegmenter
                        : sum && m.punkter.length
                          ? [{
                              midx: m.punkter.reduce((s, p) => s + p.x, 0) / m.punkter.length,
                              midy: m.punkter.reduce((s, p) => s + p.y, 0) / m.punkter.length,
                              tekst: sum,
                            }]
                          : []
                    }
                    fyll={m.verktoy === "areal" && m.punkter.length >= 3}
                    aktiv={erAktiv}
                    onPunktNed={erAktiv ? startPunktDrag : undefined}
                    onVelg={erAktiv ? undefined : () => setMaleTilstand((t) => velgMaling(t, m.id))}
                    valgtIdx={erAktiv ? valgtPunktIdx : null}
                  />
                );
              })}
              {/* Kalibrering: egen 2-punktsvisning. */}
              {kalibrerModus && (
                <MaalingOverlay punkter={kalibrerPunkter} segmenter={[]} fyll={false} aktiv />
              )}

              {/* 🟢 90°/snap-veiledning (ordre 90-snap + GJENOPPTA § 2): valgt referanselinje
                  (gul), ortho-akse + H/V-hjelpelinjer (stiplet blå), forhåndspunkt + «90°». */}
              {(referanselinje || aksehjelp || hjelpelinjer.vertikal != null || hjelpelinjer.horisontal != null || forhandsPunkt) && (
                <div className="pointer-events-none absolute inset-0">
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                    {referanselinje && (
                      <line x1={referanselinje.a.x} y1={referanselinje.a.y} x2={referanselinje.b.x} y2={referanselinje.b.y}
                        stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    )}
                    {aksehjelp && (
                      <line x1={aksehjelp[0].x} y1={aksehjelp[0].y} x2={aksehjelp[1].x} y2={aksehjelp[1].y}
                        stroke="#1e40af" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    )}
                    {hjelpelinjer.vertikal != null && (
                      <line x1={hjelpelinjer.vertikal} y1={0} x2={hjelpelinjer.vertikal} y2={100}
                        stroke="#1e40af" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    )}
                    {hjelpelinjer.horisontal != null && (
                      <line x1={0} y1={hjelpelinjer.horisontal} x2={100} y2={hjelpelinjer.horisontal}
                        stroke="#1e40af" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    )}
                  </svg>
                  {forhandsPunkt && (
                    <div className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sitedoc-primary/60"
                      style={{ left: `${forhandsPunkt.x}%`, top: `${forhandsPunkt.y}%` }} />
                  )}
                  {forhandsPunkt && visVinkelrett && (
                    <div className="absolute -translate-x-1/2 -translate-y-full rounded bg-sitedoc-primary px-1 py-0.5 text-[10px] font-bold text-white shadow"
                      style={{ left: `${forhandsPunkt.x}%`, top: `${forhandsPunkt.y}%` }}>{t("maaling.laasVinkel")}</div>
                  )}
                </div>
              )}

              {/* Område-tegneverktøy */}
              {klikkModus === "omrade" && aktivTegning && aktivByggeplass && (
                <OmradeTegneverktoy
                  onFerdig={(polygon, navn, type, farge) => {
                    opprettOmradeMutation.mutate({
                      projectId: params.prosjektId,
                      byggeplassId: aktivByggeplass.id,
                      tegningId: aktivTegning.id,
                      navn,
                      type: type as "sone" | "rom" | "etasje",
                      polygon,
                      farge,
                    });
                  }}
                  onAvbryt={() => setKlikkModus("plassering")}
                />
              )}

              {/* Oppgave-markører (lag: oppgaver) */}
              {visOppgaver && markører.map((m) => (
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

              {/* Kontrollpunkt-markører (lag: kontrollpunkter) — farge = tilstand, fylt pin
                  = arbeid startet (print-sikker form: fylt vs. omriss). */}
              {visKontrollpunkter && kontrollpunkter.map((m) => {
                // «Vis på tegning»-uthevingen (?marker) må være lesbar UTEN bevegelse:
                // et skjermbilde og en utskrift fryser animasjon, og prefers-reduced-motion
                // slår den av. Derfor en statisk halo (hvit skive + mørk hårlinje) som bærer
                // signalet, pluss en mild puls som kun trekker blikket. Forstørrelsen ligger
                // på <button> (ikke på svg-en) — legges den på et element som også kjører
                // animate-bounce, overstyrer keyframens transform scale og den blir en no-op.
                const uthevet = m.id === uthevetPunktId;
                return (
                  <button
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        m.sjekklisteId
                          ? `/dashbord/${params.prosjektId}/sjekklister/${m.sjekklisteId}`
                          : `/dashbord/${params.prosjektId}/kontrollplan`,
                      );
                    }}
                    className={`group absolute -translate-x-1/2 -translate-y-full ${uthevet ? "z-20 scale-110" : ""}`}
                    style={{ left: `${m.x}%`, top: `${m.y}%` }}
                    title={`${m.label}${m.omradeNavn ? ` · ${m.omradeNavn}` : ""} — ${t(m.tilstand.labelKey)}`}
                  >
                    {uthevet && (
                      <>
                        <span
                          aria-hidden
                          className="absolute left-1/2 top-1/2 z-0 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-2 ring-gray-900/60"
                        />
                        <span
                          aria-hidden
                          className="absolute left-1/2 top-1/2 z-0 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-gray-900/40 animate-ping"
                        />
                      </>
                    )}
                    {/* M1 tegning (fabel-svar 2026-08-15): kraftigere over-frist-signal enn
                        en tynn pinne-kant. Rød ring med HVIT separator (samme lesbarhets-grep
                        som B1-haloen) rundt pinne-hodet — rødt mot broket ortofoto/rød pinne
                        leses ikke uten separasjon. Eget lag BAK pinnen (z-[5]) men FORAN haloen
                        (z-0): halo → rød ring → hvit separator → pinne, alle tre samtidig uten
                        at ett skjuler et annet. box-shadow: hvit 2px (separator) + rød 3px
                        (signalet, ≥2,5–3px-gulvet). Ren rendering — `overFrist` og modellen røres ikke. */}
                    {m.tilstand.overFrist && (
                      <span
                        aria-hidden
                        className="absolute left-1/2 top-[42%] z-[5] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ boxShadow: `0 0 0 2px #fff, 0 0 0 5px ${OVER_FRIST_KANT}` }}
                      />
                    )}
                    <MapPin
                      className="relative z-10 h-6 w-6 drop-shadow-md transition-transform group-hover:scale-125"
                      // Pinnens egen strek = base-tilstandsfarge; over-frist bæres av den røde
                      // ringen over (med hvit separator), ikke av pinne-streken — så pinne og
                      // signal holdes visuelt adskilt (fabel-krav).
                      style={{ fill: m.tilstand.fylt ? m.tilstand.farge : "white", color: m.tilstand.farge }}
                    />
                    <span className="absolute left-1/2 top-full z-10 mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {m.label}
                    </span>
                  </button>
                );
              })}

              {/* F1: eksisterende posisjon (dempet) under velging — så brukeren ser hvor punktet står i dag */}
              {posisjonsvelgerAktiv && eksisterendeMarkør && aktivTegning?.id === eksisterendeMarkør.drawingId && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-full pointer-events-none opacity-40"
                  style={{ left: `${eksisterendeMarkør.x}%`, top: `${eksisterendeMarkør.y}%` }}
                  title={t("tegninger.naavaerendePosisjon")}
                >
                  <MapPin className="h-7 w-7 fill-gray-400 text-gray-600 drop-shadow" />
                </div>
              )}

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
            {/* F1: eksisterende posisjon (dempet) under velging */}
            {posisjonsvelgerAktiv && eksisterendeMarkør && aktivTegning?.id === eksisterendeMarkør.drawingId && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full pointer-events-none opacity-40"
                style={{ left: `${eksisterendeMarkør.x}%`, top: `${eksisterendeMarkør.y}%` }}
                title={t("tegninger.naavaerendePosisjon")}
              >
                <MapPin className="h-7 w-7 fill-gray-400 text-gray-600 drop-shadow" />
              </div>
            )}
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
              onClick={() => { setOpprettType("oppgave"); setValgtMal(""); setValgtFlyt(""); setOpprettFeil(null); }}
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
              onClick={() => { setOpprettType("sjekkliste"); setValgtMal(""); setValgtFlyt(""); setOpprettFeil(null); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                opprettType === "sjekkliste"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Sjekkliste
            </button>
          </div>

          {flytAlternativer.length > 1 && (
            <Select
              label="Dokumentflyt"
              options={flytAlternativer}
              value={valgtFlyt}
              onChange={(e) => { setValgtFlyt(e.target.value); setValgtMal(""); setOpprettFeil(null); }}
              placeholder="Velg dokumentflyt..."
            />
          )}

          <Select
            label="Mal"
            options={malAlternativer}
            value={valgtMal}
            onChange={(e) => { setValgtMal(e.target.value); setOpprettFeil(null); }}
            placeholder="Velg mal..."
          />

          {opprettFeil && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md p-3">{opprettFeil}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={erLaster} disabled={!valgtMal || (!erHmsMal(valgtMal) && !valgtFlyt)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Opprett {opprettType === "oppgave" ? "oppgave" : "sjekkliste"}
            </Button>
            <Button type="button" variant="secondary" onClick={lukkModal}>
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slett tegning — bekreftelsesmodal (ikke confirm()). Serverens slettevakt viser her
          hvis tegningen er i bruk (hva + antall) og hindrer dinglende markører. */}
      <Modal
        open={slettModalApen}
        onClose={() => setSlettModalApen(false)}
        title={t("tegninger.slettTegning")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700">
            {t("tegninger.slettBekreft", { navn: tegning.name })}
          </p>
          {slettFeil && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{slettFeil}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="danger"
              loading={slettMutation.isPending}
              onClick={() => slettMutation.mutate({ id: tegning.id })}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t("tegninger.slett")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSlettModalApen(false)}>
              {t("tegninger.avbryt")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Slett alle målinger — bekreftelsesmodal (ikke confirm(), jf. ui-standarder). */}
      <Modal
        open={slettAlleModalApen}
        onClose={() => setSlettAlleModalApen(false)}
        title={t("maaling.slettAlleTittel")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700">{t("maaling.slettAlleBekreft")}</p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="danger" onClick={slettAlleMalinger}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t("maaling.slettAlle")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSlettAlleModalApen(false)}>
              {t("tegninger.avbryt")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rediger tegningsdetaljer — kobler opprettelses-feltene til `tegning.oppdater`.
          onSuccess invaliderer BÅDE detaljen og lista (invaliderEtterRedigerDetaljer), så en
          etasje-endring flytter raden ut av «Uten etasje». */}
      <RedigerTegningModal
        open={redigerModalApen}
        onClose={() => setRedigerModalApen(false)}
        tegning={{
          id: tegning.id,
          name: tegning.name,
          drawingNumber: tegning.drawingNumber,
          discipline: tegning.discipline,
          drawingType: tegning.drawingType,
          status: tegning.status,
          floor: tegning.floor,
          originator: tegning.originator,
          description: tegning.description,
          revision: tegning.revision,
        }}
        onLagre={(input) => { setRedigerFeil(null); redigerDetaljerMutation.mutate(input); }}
        lagrer={redigerDetaljerMutation.isPending}
        feil={redigerFeil}
        onRevisjonFerdig={() =>
          invaliderEtterRedigerDetaljer(utils, params.prosjektId, tegning.id)
        }
      />
    </div>
  );
}
