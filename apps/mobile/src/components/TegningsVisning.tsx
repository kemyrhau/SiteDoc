"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Image,
} from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { byggHtml } from "./tegning-webview-html";
import { X, AlertTriangle, RefreshCw, Ruler, Waypoints, VectorSquare, Check, Trash2, Hand, Plus, TriangleRight, Magnet, Spline, RotateCw, CloudOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  kanMale,
  malMm,
  malArealMm2,
  parseMalestokk,
  TOM_MALETILSTAND,
  minPunkter,
  aktivMaling,
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
  beregnSnap,
  type Punkt,
  type Utsnitt,
  type Referanselinje,
  type Hjelpelinjer,
  type MaleVerktoy,
  type Maling,
  type MaleTilstand,
} from "@sitedoc/shared/utils";
import { avgjorTrykkHandling, type TegningVerktoy } from "../lib/tegningTrykk";
import { lupePlassering, lupeBakgrunn, LUPE_DIAMETER, LUPE_FORSTORRELSE, LUPE_FORSKYVNING } from "../lib/lupe";
import { skrivTegningHtml, TEGNING_CACHE_MAPPE } from "../services/offlineKlargjoring";

/** Live lupe-data fra WebView-en (RETUR 5 § 2): finger i skjerm-dp + bilde-pct + vist bildestørrelse. */
interface LupeData {
  fingerX: number;
  fingerY: number;
  pctX: number;
  pctY: number;
  dispB: number;
  dispH: number;
}

const LASTING_TIMEOUT_MS = 15_000;

/** Måledata fra tegningen (speiler web). `undefined` = måling ikke aktivert av forelder. */
export interface MaaleData {
  mmPrPiksel: number | null;
  scale: string | null;
  scaleKilde: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

/** 🔴 RETUR 6 § 1: areal lukkes når trykket er innen ~12 pt (SKJERM-px, ikke prosent)
 * av FØRSTE punkt. Prosent-terskel lukket arealet «av seg selv» ved innzoom. */
const LUKK_TERSKEL_PX = 12;

/** Treffradius (skjerm-px) for 90°/snap (punkt-snap + hjelpelinje). */
const SNAP_TOL_PX = 12;

/** Samle snap-/hjelpelinje-referanser fra ALLE målinger; ekskluder ett punkt i den aktive. */
function samleReferanser(t: MaleTilstand, ekskluderIdx: number | null): Punkt[] {
  return t.malinger.flatMap((m) =>
    m.id === t.aktivId && ekskluderIdx != null ? m.punkter.filter((_, i) => i !== ekskluderIdx) : m.punkter,
  );
}

/** Trykk innen denne radiusen (skjerm-px) velger en eksisterende måling. */
const VELG_TREFF_PX = 20;

export interface Markør {
  x: number;
  y: number;
  id: string;
  label?: string;
  farge?: string;
  /** true = fylt sirkel (arbeid startet) · false/utelatt = ring (hul). Speiler web-tilstandsformen. */
  fylt?: boolean;
  /** Kant-farge-overstyring (over frist → rød). Utelatt → hvit kant som før. */
  kantFarge?: string;
}

/** Område (sone/rom/etasje) tegnet som polygon i prosent-koordinater — parallelt med web. */
export interface Omrade {
  id: string;
  navn: string;
  farge: string;
  polygon: Array<{ x: number; y: number }>;
}

export interface GpsMarkør {
  x: number;
  y: number;
}

interface TegningsVisningProps {
  tegningUrl: string;
  tegningNavn: string;
  onLukk: () => void;
  /** Legacy: enkelt trykk → plassering (sjekkliste/rapportobjekt m.fl.). */
  onTrykk?: (posX: number, posY: number) => void;
  onMarkørTrykk?: (id: string) => void;
  markører?: Markør[];
  omrader?: Omrade[];
  gpsMarkør?: GpsMarkør | null;
  /** Ubrukt — beholdt for bakoverkompatibilitet */
  pdfPageSize?: { width: number; height: number };
  // --- Avansert trykk + måling (lokasjoner). Settes disse, brukes pekerbasert
  //     trykk-klassifisering i stedet for legacy `onTrykk`. ---
  /** true = plasseringsmodus (trykk oppretter). false/utelatt = navigering. */
  plasseringAktiv?: boolean;
  /** Kort trykk i navigering: vis hint og blink bryteren (ingen oppretting). */
  onHint?: () => void;
  /** Opprett her: langt trykk (navigering) ELLER trykk (plassering). */
  onOpprett?: (posX: number, posY: number) => void;
  /** Måledata. Settes (kan være null) → måleverktøyet vises. undefined → av. */
  maleData?: MaaleData | null;
  /** Varsler når et måleverktøy slås på/av, så forelder kan skjule plasseringsmodus. */
  onMaleModusEndring?: (aktiv: boolean) => void;
  /** RETUR 2 (vedtak A): DWG-rotasjon. `auto` er BAKT inn i SVG-en (vises uansett);
   * `overstyrt` er brukerens valg. Vieweren roterer (overstyrt − auto) på toppen. */
  rotasjon?: { auto: number | null; overstyrt: number | null } | null;
  /** Lagre/nullstill brukerens rotasjons-overstyring (null = tilbake til auto). */
  onSettRotasjon?: (grader: number | null) => void;
  /** L4b: startutsnitt (brøk [0,1] av viewBox) — mobilen åpner zoomet HIT (på bygget),
   * ikke fit-to-width på rutenettet. null/utelatt = fit-to-width (egen-SVG/ikke-DWG). */
  startutsnitt?: { x: number; y: number; w: number; h: number } | null;
  /** C2 (L6): render ezdxf-mobilvarianten INLINE (ikke `<img>`) så streken kan dempes ved
   * zoom (settle). Settes kun for ezdxf-konverterte tegninger (mobilFileUrl). */
  svgInline?: boolean;
  /** Offline: uten nett OG ikke forberedt → vis «Ikke tilgjengelig offline»-tilstand
   * i stedet for et brutt bilde / evig spinner (ordre fix/offline-tegning, D8/H2). */
  offlineUtilgjengelig?: boolean;
}


export function TegningsVisning({
  tegningUrl,
  tegningNavn,
  onLukk,
  onTrykk,
  onMarkørTrykk,
  markører = [],
  omrader = [],
  gpsMarkør,
  plasseringAktiv = false,
  onHint,
  onOpprett,
  maleData,
  onMaleModusEndring,
  rotasjon,
  onSettRotasjon,
  startutsnitt,
  svgInline = false,
  offlineUtilgjengelig = false,
}: TegningsVisningProps) {
  const { t } = useTranslation();
  // RETUR 2: auto-rotasjon er bakt inn i SVG-en; her legges kun en brukeroverstyring på.
  const autoRot = typeof rotasjon?.auto === "number" ? rotasjon.auto : null;
  const rotOverstyrt = typeof rotasjon?.overstyrt === "number" ? rotasjon.overstyrt : null;
  const effektivRot = rotOverstyrt ?? autoRot ?? 0;
  const rotasjonDelta = effektivRot - (autoRot ?? 0);
  const norm180Rot = (d: number) => { let v = ((d % 360) + 360) % 360; if (v > 180) v -= 360; return v; };
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // RETUR 1 B: lokal kopi leveres som file://-sti (ikke base64). Da skriver vi viser-HTML-en
  // til cache-mappa og laster WebView-en derfra, så `<img>`/`fetch` leser tegningen direkte.
  const erLokalFil = tegningUrl.startsWith("file://");
  // RN <Image> kan ikke dekode SVG → native lupe + prefetch er bortkastet for SVG/ezdxf
  // (RETUR 1 B). Raster (PDF→png/jpg) beholder lupa.
  const erSvg = svgInline || /\.svg(\?|#|$)/i.test(tegningUrl);
  const [htmlFilUrl, setHtmlFilUrl] = useState<string | null>(null);
  const htmlNonceRef = useRef(0);

  // Avansert trykk/måling aktiveres når forelder gir avanserte props.
  const avansert = !!onHint || !!onOpprett || maleData !== undefined;

  // --- Måling: flere målinger (RETUR 2) + eksplisitte verktøy (RETUR 3). ---
  // `aktivtVerktoy` er den valgte modusen i verktøylinja (ikke den aktive målingens
  // type). "navigering" = ingen verktøy (pan/zoom + hint / langt trykk).
  const [maleTilstand, setMaleTilstand] = useState<MaleTilstand>(TOM_MALETILSTAND);
  const [aktivtVerktoy, setAktivtVerktoy] = useState<TegningVerktoy>("navigering");
  const [visSlettAlle, setVisSlettAlle] = useState(false);
  // 🔴 RETUR 5 § 2: RN-nativ lupe. `lupe` != null mens fingeren ligger nede i et
  // måleverktøy/Flytt; WebView-en mater fingerposisjon + bilde-utsnitt. `webViewStr`
  // er WebViewens målte dp-størrelse (for kant-flipp av lupa).
  const [lupe, setLupe] = useState<LupeData | null>(null);
  const [webViewStr, setWebViewStr] = useState<{ w: number; h: number } | null>(null);
  // 90°-lås + snap + referanselinje (ordre 90-snap + GJENOPPTA). Snap PÅ som standard.
  const [ortho, setOrtho] = useState(false);
  const [snapPaa, setSnapPaa] = useState(true);
  const [referanselinje, setReferanselinje] = useState<Referanselinje | null>(null);
  const [velgReferanseModus, setVelgReferanseModus] = useState(false);
  const aktiv = aktivMaling(maleTilstand);
  const aktivPunkter = aktiv?.punkter ?? [];
  const erAreal = aktiv?.verktoy === "areal";
  const maleEngasjert = maleTilstand.aktivId !== null;
  const verktoyAktiv = aktivtVerktoy !== "navigering";

  const mmPrPiksel = maleData?.mmPrPiksel ?? null;
  const scale = maleData?.scale ?? null;
  const scaleKilde = maleData?.scaleKilde ?? null;
  const scaleDenom = parseMalestokk(scale);
  const imgW = maleData?.imageWidth ?? null;
  const imgH = maleData?.imageHeight ?? null;
  const kanMaleNaa = !!maleData && kanMale(scale, mmPrPiksel, scaleKilde);

  const formatMeter = (m: number) => `${m.toFixed(2).replace(".", ",")} m`;
  const formatAreal = (m2: number) => `${m2.toFixed(2).replace(".", ",")} m²`;

  const kildeEtikett = (() => {
    if (scaleKilde === "dwg") return t("maaling.kildeDwg");
    if (scaleKilde === "kalibrert") return t("maaling.kildeKalibrert");
    if (scaleKilde === "manuell") return t("maaling.kildeManuell");
    if (scaleKilde === "tittelfelt") return t("maaling.kildeTittelfelt");
    return "";
  })();
  const malestokkEtikett = scale ? `${t("maaling.malestokk")} ${scale}, ${kildeEtikett}` : kildeEtikett;

  // Ett segment i meter (papir-målestokk). null uten komplett måledata.
  const segMeter = useCallback(
    (a: Punkt, b: Punkt): number | null => {
      if (mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
        return malMm(a, b, imgW, imgH, mmPrPiksel, scaleDenom) / 1000;
      }
      return null;
    },
    [mmPrPiksel, scaleDenom, imgW, imgH],
  );
  const malLengdeMeter = useCallback(
    (punkter: Punkt[]): number => {
      let sum = 0;
      for (let i = 1; i < punkter.length; i++) {
        const m = segMeter(punkter[i - 1]!, punkter[i]!);
        if (m != null) sum += m;
      }
      return sum;
    },
    [segMeter],
  );
  const malArealM2 = useCallback(
    (punkter: Punkt[]): number | null => {
      if (punkter.length >= 3 && mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
        return malArealMm2(punkter, imgW, imgH, mmPrPiksel, scaleDenom) / 1_000_000;
      }
      return null;
    },
    [mmPrPiksel, scaleDenom, imgW, imgH],
  );
  // Kort resultat-etikett for en inaktiv måling (vises ved tyngdepunktet).
  const summaryFor = useCallback(
    (m: Maling): string => {
      if (m.verktoy === "areal") {
        const a = malArealM2(m.punkter);
        return a != null ? formatAreal(a) : "";
      }
      return m.punkter.length >= 2 ? formatMeter(malLengdeMeter(m.punkter)) : "";
    },
    [malArealM2, malLengdeMeter],
  );

  // Segment-/areal-etiketter + resultattekst for den AKTIVE målingen.
  const maleSegmenter: { midx: number; midy: number; tekst: string }[] = [];
  let maleTotalMeter = 0;
  let arealM2: number | null = null;
  let omkretsMeter = 0;
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
  } else if (aktivPunkter.length >= 3) {
    const ring = [...aktivPunkter, aktivPunkter[0]!];
    for (let i = 1; i < ring.length; i++) {
      const m = segMeter(ring[i - 1]!, ring[i]!);
      if (m != null) omkretsMeter += m;
    }
    arealM2 = malArealM2(aktivPunkter);
    const cx = aktivPunkter.reduce((s, p) => s + p.x, 0) / aktivPunkter.length;
    const cy = aktivPunkter.reduce((s, p) => s + p.y, 0) / aktivPunkter.length;
    if (arealM2 != null) maleSegmenter.push({ midx: cx, midy: cy, tekst: formatAreal(arealM2) });
  }

  // Refs så den stabile WebView-meldingshåndtereren leser ferskeste tilstand.
  const maleTilstandRef = useRef(maleTilstand);
  maleTilstandRef.current = maleTilstand;
  const plasseringRef = useRef(plasseringAktiv);
  plasseringRef.current = plasseringAktiv;
  // 90°/snap-parametre i en ref (stabil meldingshåndterer leser ferskeste verdier).
  const snapParamRef = useRef({ ortho, snapPaa, referanselinje, imgW, imgH });
  snapParamRef.current = { ortho, snapPaa, referanselinje, imgW, imgH };
  const velgReferanseRef = useRef(velgReferanseModus);
  velgReferanseRef.current = velgReferanseModus;

  // Delt 90°/snap for ett kandidatpunkt (leser refs). null når bildet mangler mål.
  const beregnSnapForKandidat = useCallback(
    (kandidat: Punkt, rectW: number, rectH: number, ekskluderIdx: number | null, utsnitt?: Utsnitt | null) => {
      const sp = snapParamRef.current;
      if (sp.imgW == null || sp.imgH == null || rectW <= 0 || rectH <= 0) return null;
      const t0 = maleTilstandRef.current;
      const akt = aktivMaling(t0);
      const pågår = !!akt && !akt.ferdig;
      const sisteIdx = pågår && akt ? akt.punkter.length - 1 : -1;
      const anker = sisteIdx >= 0 ? akt!.punkter[sisteIdx]! : null;
      const forforrige = sisteIdx >= 1 ? akt!.punkter[sisteIdx - 1]! : null;
      return beregnSnap({
        kandidat, anker, forforrige,
        referanser: samleReferanser(t0, ekskluderIdx),
        utsnitt,
        referanselinje: sp.referanselinje,
        ortho: sp.ortho, snap: sp.snapPaa,
        imageWidth: sp.imgW, imageHeight: sp.imgH,
        rectW, rectH, punktTolPx: SNAP_TOL_PX, guideTolPx: SNAP_TOL_PX,
      });
    },
    [],
  );

  // Unik id pr. ny måling (ingen Date.now/Math.random — en stigende teller holder).
  const nesteIdRef = useRef(0);

  // Forlat en påbegynt måling pent: behold hvis lang nok (settFerdig), ellers forkast.
  const forlatPaagaaende = useCallback((t0: MaleTilstand): MaleTilstand => {
    const akt = aktivMaling(t0);
    if (akt && !akt.ferdig) {
      return akt.punkter.length >= minPunkter(akt.verktoy) ? settFerdig(t0) : slettAktiv(t0);
    }
    return t0;
  }, []);

  // Verktøylinje (RETUR 3): ett verktøy om gangen. Verktøybytte nullstiller valgt punkt.
  const velgMaleVerktoy = useCallback((v: MaleVerktoy) => {
    setMaleTilstand((prev) => startMaling(prev, v, `m${(nesteIdRef.current += 1)}`));
    setAktivtVerktoy(v);
  }, []);
  const velgFlytt = useCallback(() => {
    setMaleTilstand(forlatPaagaaende);
    setAktivtVerktoy("flytt");
  }, [forlatPaagaaende]);
  const velgOpprett = useCallback(() => {
    setMaleTilstand(forlatPaagaaende);
    setAktivtVerktoy("opprett");
  }, [forlatPaagaaende]);

  const håndterLeggTilPunkt = useCallback((x: number, y: number, rectW: number, rectH: number) => {
    // Lukk-terskel i SKJERM-px (side-/vist-rom), ikke prosent: ~12 pt rundt FØRSTE
    // punkt. rectW/rectH er vist bildestørrelse (dp) fra gesten.
    const erNaer = (q: Punkt) =>
      rectW > 0 && rectH > 0
        ? Math.hypot(((q.x - x) / 100) * rectW, ((q.y - y) / 100) * rectH) <= LUKK_TERSKEL_PX
        : false;
    const neste = leggTilPunkt(maleTilstandRef.current, { x, y }, erNaer);
    setMaleTilstand(neste);
    // Ferdig figur → gå automatisk til Flytt med figuren valgt (RETUR 3 § 1).
    // Polylinje blir ALDRI ferdig her (RETUR 6 § 1); kun linjal (2 pkt) / areal (lukk).
    const akt = aktivMaling(neste);
    if (akt?.ferdig) setAktivtVerktoy("flytt");
  }, []);
  const håndterFlyttPunkt = useCallback((index: number, x: number, y: number) => {
    setMaleTilstand((prev) => flyttPunkt(prev, index, { x, y }));
  }, []);
  const håndterSettInnKant = useCallback((kantIndex: number, x: number, y: number) => {
    setMaleTilstand((prev) => settInnPunktPaaKant(prev, kantIndex, { x, y }));
  }, []);
  const håndterFerdig = useCallback(() => {
    setMaleTilstand((prev) => settFerdig(prev));
    setAktivtVerktoy("flytt");
  }, []);
  // 🟢 TILLEGG: «Fortsett» en ferdig polylinje — åpne den igjen og gå til polylinje-modus.
  const håndterGjenoppta = useCallback(() => {
    setMaleTilstand((prev) => gjenoppta(prev));
    setAktivtVerktoy("polylinje");
  }, []);
  const håndterVelgMaling = useCallback((id: string) => {
    setMaleTilstand((prev) => velgMaling(prev, id));
    setAktivtVerktoy("flytt");
  }, []);
  const håndterSlettAktiv = useCallback(() => { setMaleTilstand((prev) => slettAktiv(prev)); }, []);
  const håndterSlettAlle = useCallback(() => { setMaleTilstand(slettAlle()); setVisSlettAlle(false); }, []);
  const avsluttMaling = useCallback(() => {
    setMaleTilstand((prev) => avsluttAktiv(prev));
    setAktivtVerktoy("navigering");
  }, []);

  useEffect(() => {
    setLaster(true);
    setFeil(false);
    // RETUR 1: målinger er flyktig klient-state (ikke persistert pr. tegning) —
    // nullstill ved tegningsbytte så de ikke henger igjen som snap-kandidater på
    // neste tegning.
    setMaleTilstand(slettAlle());
    setAktivtVerktoy("navigering");
  }, [tegningUrl]);

  // RETUR 1 B: forhåndslasting av bildet i RN-bildecachen er fjernet — den tjente kun
  // den native lupa, som for SVG/ezdxf er bortkastet (RN <Image> dekoder ikke SVG), og
  // for raster lastes bildet uansett når lupa dukker opp. Prefetch av en file://-/data:-
  // kilde ga ingen nettverksgevinst.

  useEffect(() => {
    if (laster && !feil) {
      timeoutRef.current = setTimeout(() => {
        setLaster(false);
        setFeil(true);
      }, LASTING_TIMEOUT_MS);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [laster, feil]);

  // Oppdater GPS-markør med CSS-prosent
  useEffect(() => {
    if (!webViewRef.current || laster) return;
    if (gpsMarkør) {
      webViewRef.current.injectJavaScript(`
        (function() {
          var old = document.querySelector('.gps');
          if (old) old.remove();
          var c = document.getElementById('container');
          if (!c) return;
          var div = document.createElement('div');
          div.className = 'gps';
          div.style.left = '${gpsMarkør.x}%';
          div.style.top = '${gpsMarkør.y}%';
          div.innerHTML = '<div class="gps-outer"><div class="gps-inner"></div></div>';
          c.appendChild(div);
          oppdaterZoom();
        })();
        true;
      `);
    }
  }, [gpsMarkør, laster]);

  // Injiser (eller fjern) måle-overlayet uten reload — kalt når tilstanden endres
  // og etter en reload (markør-refetch bygger HTML på nytt). Leser fra refs så
  // callbacken er stabil (ellers re-injiseres overlayet ved hver render).
  const maleSegmenterRef = useRef(maleSegmenter);
  maleSegmenterRef.current = maleSegmenter;
  const injiserMaling = useCallback(() => {
    if (!webViewRef.current) return;
    const tilstand = maleTilstandRef.current;
    const payload = {
      malinger: tilstand.malinger.map((m) => ({
        verktoy: m.verktoy,
        punkter: m.punkter,
        ferdig: m.ferdig,
        aktiv: m.id === tilstand.aktivId,
        summary: m.id === tilstand.aktivId ? "" : summaryFor(m),
      })),
      segmenter: maleSegmenterRef.current,
      referanse: snapParamRef.current.referanselinje,
    };
    webViewRef.current.injectJavaScript(
      `window.tegnMalinger && window.tegnMalinger(${JSON.stringify(payload)}); true;`,
    );
  }, [summaryFor]);

  useEffect(() => {
    if (laster) return;
    injiserMaling();
  }, [maleTilstand, referanselinje, laster, injiserMaling]);

  // 🟢 90°/snap-veiledning: injiser (eller fjern) stiplet akse/hjelpelinjer + «90°».
  // Alltid referanselinja med (så den vises mens man tegner). Round-trip: RN beregner
  // med delt beregnSnap, WebView-en tegner bare resultatet.
  const injiserVeiledning = useCallback((snapR: { aksehjelpelinje: [Punkt, Punkt] | null; hjelpelinjer: Hjelpelinjer; vinkelrett: boolean; punkt: Punkt } | null) => {
    if (!webViewRef.current) return;
    const payload = snapR
      ? {
          akse: snapR.aksehjelpelinje,
          vertikal: snapR.hjelpelinjer.vertikal,
          horisontal: snapR.hjelpelinjer.horisontal,
          vinkelrett: snapR.vinkelrett,
          punkt: snapR.punkt,
        }
      : null;
    webViewRef.current.injectJavaScript(
      `window.tegnVeiledning && window.tegnVeiledning(${JSON.stringify(payload)}); true;`,
    );
  }, []);

  // Verktøyet har forrang over forelderens modus (RETUR 1 § 3/4, RETUR 3): varsle
  // forelder så plasseringsmodus (og banneret) slås av mens et verktøy er valgt.
  useEffect(() => {
    onMaleModusEndring?.(verktoyAktiv);
  }, [verktoyAktiv, onMaleModusEndring]);

  // Fortell WebView-en hvilket verktøy som er aktivt (styrer lupe + set-on-release).
  // Utenfor et eksplisitt verktøy følger vi forelderens bryter (plassering → opprett).
  const effektivtVerktoyRef = useRef<TegningVerktoy>("navigering");
  const effektivtVerktoy: TegningVerktoy = verktoyAktiv
    ? aktivtVerktoy
    : plasseringAktiv
      ? "opprett"
      : "navigering";
  effektivtVerktoyRef.current = effektivtVerktoy;
  useEffect(() => {
    if (laster) return;
    webViewRef.current?.injectJavaScript(`window.__maleModus=${JSON.stringify(effektivtVerktoy)};true;`);
  }, [effektivtVerktoy, laster]);

  const håndterMelding = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "markør") {
          if (onMarkørTrykk) onMarkørTrykk(data.id);
          return;
        }
        // Legacy enkelt-trykk (andre forbrukere uten avanserte props).
        if (data.type === "trykk") {
          if (onTrykk) onTrykk(data.x, data.y);
          return;
        }
        // Punkt-dra (Flytt): live-oppdatering + 90°/snap (ekskluder punktet som dras).
        if (data.type === "maledrag") {
          const snapR = beregnSnapForKandidat({ x: data.x, y: data.y }, data.rectW, data.rectH, data.index, data.utsnitt);
          const fp = snapR ? snapR.punkt : { x: data.x, y: data.y };
          håndterFlyttPunkt(data.index, fp.x, fp.y);
          injiserVeiledning(snapR);
          return;
        }
        // 🟢 90°/snap forhåndsvisning under PLASSERING (måleverktøy, før slipp).
        if (data.type === "forhaandspunkt") {
          const snapR = beregnSnapForKandidat({ x: data.x, y: data.y }, data.rectW, data.rectH, null, data.utsnitt);
          injiserVeiledning(snapR);
          return;
        }
        // 🟢 RETUR 6 § 2: sett inn et nytt hjørne på en kant (trykk på kant i Flytt).
        if (data.type === "settInnKant") {
          håndterSettInnKant(data.kantIndex, data.x, data.y);
          return;
        }
        // RN-nativ lupe (RETUR 5 § 2): WebView mater finger + utsnitt, eller skjul.
        if (data.type === "lupe") {
          if (data.vis) {
            setLupe({ fingerX: data.fingerX, fingerY: data.fingerY, pctX: data.pctX, pctY: data.pctY, dispB: data.dispB, dispH: data.dispH });
          } else {
            setLupe(null);
            injiserVeiledning(null); // gest slutt (også ved avbrytelse) → fjern veiledning
          }
          return;
        }
        if (data.type === "gest") {
          const tilstand = maleTilstandRef.current;
          const verktoy = effektivtVerktoyRef.current;
          injiserVeiledning(null); // slipp → fjern stiplet veiledning

          // 🟢 GJENOPPTA § 1: «velg referanselinje»-modus — trykk på et segment i en
          // eksisterende måling (vegg langs en skrå linje) setter det som referanse.
          if (velgReferanseRef.current) {
            const traffId = finnMalingTreff(tilstand.malinger, { x: data.x, y: data.y }, data.rectW, data.rectH, VELG_TREFF_PX);
            const m = traffId ? tilstand.malinger.find((x) => x.id === traffId) : null;
            if (m && m.punkter.length >= 2) {
              const lukket = m.verktoy === "areal" && m.ferdig;
              const kant = finnNaermesteKant(m.punkter, { x: data.x, y: data.y }, data.rectW, data.rectH, VELG_TREFF_PX, lukket);
              if (kant >= 0) setReferanselinje({ a: m.punkter[kant]!, b: m.punkter[(kant + 1) % m.punkter.length]! });
            }
            setVelgReferanseModus(false);
            return;
          }
          // Flytt + ikke på punkt: traff gesten en eksisterende måling? (grunnlag for valg)
          let traffMaling = false;
          if (verktoy === "flytt" && !data.nedPaaPunkt && tilstand.malinger.length) {
            traffMaling =
              finnMalingTreff(tilstand.malinger, { x: data.x, y: data.y }, data.rectW, data.rectH, VELG_TREFF_PX) != null;
          }
          const handling = avgjorTrykkHandling(verktoy, {
            varighetMs: data.varighetMs,
            flyttet: data.flyttet,
            antallPekere: data.antallPekere,
            nedPaaPunkt: data.nedPaaPunkt,
            traffMaling,
          });
          switch (handling) {
            case "settPunkt": {
              // 90°/snap: juster punktet FØR det legges til (ekskluder ankeret som snap-mål).
              const aktP = aktivMaling(tilstand);
              const ankerIdx = aktP && !aktP.ferdig ? aktP.punkter.length - 1 : null;
              const snapR = beregnSnapForKandidat({ x: data.x, y: data.y }, data.rectW, data.rectH, ankerIdx, data.utsnitt);
              const fp = snapR ? snapR.punkt : { x: data.x, y: data.y };
              håndterLeggTilPunkt(fp.x, fp.y, data.rectW, data.rectH);
              return;
            }
            case "draPunkt":
              // Punktet er dratt live via `maledrag`; posisjonen er allerede anvendt.
              return;
            case "velgMaling": {
              const traff = finnMalingTreff(tilstand.malinger, { x: data.x, y: data.y }, data.rectW, data.rectH, VELG_TREFF_PX);
              if (traff) håndterVelgMaling(traff);
              return;
            }
            case "opprett":
              onOpprett?.(data.x, data.y);
              return;
            case "hint":
              webViewRef.current?.injectJavaScript(
                `window.tegnHint && window.tegnHint(${data.x}, ${data.y}, ${JSON.stringify(t("maaling.hintTrykk"))}); true;`,
              );
              onHint?.();
              return;
            default:
              return; // pan / ingen
          }
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [onTrykk, onMarkørTrykk, onOpprett, onHint, håndterLeggTilPunkt, håndterFlyttPunkt, håndterSettInnKant, håndterVelgMaling, beregnSnapForKandidat, injiserVeiledning, t],
  );

  const trykkOppsett: "ingen" | "enkel" | "avansert" = avansert
    ? "avansert"
    : onTrykk
      ? "enkel"
      : "ingen";
  const html = byggHtml(tegningUrl, markører, omrader, gpsMarkør ?? null, trykkOppsett, rotasjonDelta, startutsnitt ?? null, svgInline);
  // Nett-URL: loadHTMLString med baseUrl = tegningens mappe (relativ henting). Tom/data:
  // → undefined (null-origin). Lokal fil håndteres via file://-lasting under (ikke baseUrl).
  const baseUrl = tegningUrl.startsWith("data:") || tegningUrl === "" || erLokalFil
    ? undefined
    : tegningUrl.substring(0, tegningUrl.lastIndexOf("/") + 1);

  // RETUR 1 B: for lokal kopi skriver vi HTML-en til cache-mappa og laster den som file://,
  // med lese-tilgang til mappa. Da refererer `<img src="file://…">`/`fetch("file://…")`
  // tegningen DIREKTE (ingen base64 i minnet → ingen tredobling av RSS på store filer).
  // Unikt filnavn pr. innholdsendring tvinger reload (file-URL caches ellers).
  useEffect(() => {
    if (!erLokalFil) { setHtmlFilUrl(null); return; }
    let aktiv = true;
    const nonce = (htmlNonceRef.current += 1);
    (async () => {
      try {
        const url = await skrivTegningHtml(html, nonce);
        if (aktiv) setHtmlFilUrl(url);
      } catch {
        // Skriving til documentDirectory feiler i praksis aldri; skulle den gjøre det,
        // forblir htmlFilUrl null → lastetidsavbruddet (15 s) viser feil-/prøv-igjen-UI-et.
        if (aktiv) setHtmlFilUrl(null);
      }
    })();
    return () => { aktiv = false; };
  }, [erLokalFil, html]);

  // Venter på at viser-HTML skrives til cache før WebView-en kan peke på file://-fila.
  const venterFil = erLokalFil && htmlFilUrl === null;
  const filKilde = erLokalFil && htmlFilUrl !== null;
  const filTilgangProps = filKilde
    ? { allowingReadAccessToURL: TEGNING_CACHE_MAPPE, allowFileAccessFromFileURLs: true, allowFileAccess: true }
    : {};

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-between bg-black/80 px-5 py-4">
        <Pressable onPress={onLukk} hitSlop={16} className="rounded-full bg-white/20 p-2.5">
          <X size={22} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 px-4 text-center text-sm font-medium text-white" numberOfLines={1}>
          {tegningNavn}
        </Text>
        {/* RETUR 2 (vedtak A): rotasjon — auto-rotasjonen er bakt inn; her vises etikett
            + manuell overstyring (90°-trinn). Kun når forelder gir rotasjon-prop (DWG). */}
        {rotasjon && onSettRotasjon ? (
          <View className="flex-row items-center gap-2" style={{ minWidth: 42 }}>
            {Math.round(effektivRot) !== 0 && (
              <Text className="text-xs text-white/70">
                {rotOverstyrt == null && autoRot != null
                  ? t("tegninger.rotertAuto", { grader: Math.round(autoRot) })
                  : t("tegninger.rotert", { grader: Math.round(effektivRot) })}
              </Text>
            )}
            <Pressable
              onPress={() => onSettRotasjon(norm180Rot(effektivRot + 90))}
              hitSlop={12}
              className="rounded-full bg-white/20 p-2.5"
              accessibilityLabel={t("tegninger.roter90")}
            >
              <RotateCw size={18} color="#ffffff" />
            </Pressable>
            {rotOverstyrt != null && (
              <Pressable
                onPress={() => onSettRotasjon(null)}
                hitSlop={12}
                className="rounded-full bg-white/20 px-2.5 py-1"
                accessibilityLabel={t("tegninger.roterTilbake")}
              >
                <Text className="text-xs font-medium text-white">{t("tegninger.roterTilbakeKort")}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ width: 42 }} />
        )}
      </View>

      {offlineUtilgjengelig ? (
        // D8/H2: uten nett og ikke forberedt → tydelig tilstand, aldri brutt bilde.
        <View style={stiler.feilContainer}>
          <CloudOff size={48} color="#9ca3af" />
          <Text style={stiler.feilTekst}>{t("tegningsvelger.offlineUtilgjengelig")}</Text>
          <Text style={stiler.feilBeskrivelse}>{t("tegningsvelger.offlineUtilgjengeligInfo")}</Text>
        </View>
      ) : feil ? (
        <View style={stiler.feilContainer}>
          <AlertTriangle size={48} color="#f59e0b" />
          <Text style={stiler.feilTekst}>{t("tegningsvelger.kunneIkkeLaste")}</Text>
          <Text style={stiler.feilBeskrivelse}>{t("tegningsvelger.sjekkNettverkProvIgjen")}</Text>
          <Pressable
            onPress={() => { setLaster(true); setFeil(false); }}
            style={stiler.prøvIgjenKnapp}
          >
            <RefreshCw size={16} color="#ffffff" />
            <Text style={stiler.prøvIgjenTekst}>{t("handling.provIgjen")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {(laster || venterFil) && (
            <View style={stiler.lastingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={stiler.lastingTekst}>{t("tegningsvelger.lasterTegning")}</Text>
            </View>
          )}
          {!venterFil && (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={filKilde ? { uri: htmlFilUrl! } : { html, baseUrl }}
            {...filTilgangProps}
            style={{ flex: 1, backgroundColor: "#1a1a1a" }}
            onLayout={(e: LayoutChangeEvent) => setWebViewStr({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            onLoadEnd={() => { setLaster(false); setFeil(false); injiserMaling(); }}
            onError={() => { setLaster(false); setFeil(true); }}
            onMessage={håndterMelding}
            allowsInlineMediaPlayback
            javaScriptEnabled
            scalesPageToFit={false}
          />
          )}

          {/* 🔴 RETUR 5 § 2: RN-nativ lupe. Plasseres over/til siden for fingeren
              (lupePlassering), med et forstørret utsnitt av tegningsbildet
              (lupeBakgrunn, ~3×) og trådkors i senter der punktet havner. Begge
              geometrifunksjoner er testet i src/lib/lupe.ts. pointerEvents=none så
              den aldri fanger trykk. RETUR 1 B: kun for raster — RN <Image> dekoder
              ikke SVG/ezdxf, så lupa ville vært en tom hvit sirkel (og holdt en base64-
              kopi i minnet). Vektortegninger er uansett skarpe ved zoom i WebView-en. */}
          {lupe && webViewStr && !erSvg && (() => {
            const D = LUPE_DIAMETER;
            const pos = lupePlassering(lupe.fingerX, lupe.fingerY, webViewStr.w, webViewStr.h, D, LUPE_FORSKYVNING);
            const bg = lupeBakgrunn(lupe.pctX, lupe.pctY, lupe.dispB, lupe.dispH, LUPE_FORSTORRELSE, D);
            return (
              <View pointerEvents="none" style={[stiler.lupe, { left: pos.left, top: pos.top, width: D, height: D, borderRadius: D / 2 }]}>
                <Image
                  source={{ uri: tegningUrl }}
                  style={{ position: "absolute", width: bg.bildeB, height: bg.bildeH, left: bg.posX, top: bg.posY }}
                  resizeMode="stretch"
                />
                <View style={[stiler.lupeKryss, { left: 8, right: 8, top: D / 2, height: 1 }]} />
                <View style={[stiler.lupeKryss, { top: 8, bottom: 8, left: D / 2, width: 1 }]} />
              </View>
            );
          })()}

          {/* Verktøylinje (RETUR 3): [Flytt] [Linjal] [Polylinje] [Areal] [＋ Opprett].
              Ett verktøy om gangen. Måleverktøyene sperres når målestokken ikke er
              bekreftet (samme lås som web, ingen kalibrering på mobil); Flytt og
              Opprett er alltid tilgjengelige. */}
          {maleData !== undefined && !laster && (
            <View style={stiler.maleToolbar} pointerEvents="box-none">
              <View style={stiler.maleKnappRad}>
                <Pressable
                  onPress={velgFlytt}
                  style={[stiler.maleKnapp, aktivtVerktoy === "flytt" && stiler.maleKnappAktiv]}
                >
                  <Hand size={14} color={aktivtVerktoy === "flytt" ? "#ffffff" : "#1e3a8a"} />
                  <Text style={[stiler.maleKnappTekst, aktivtVerktoy === "flytt" && stiler.maleKnappTekstAktiv]}>{t("maaling.verktoyFlytt")}</Text>
                </Pressable>
                {([
                  ["linjal", Ruler, t("maaling.verktoyLinjal")],
                  ["polylinje", Waypoints, t("maaling.verktoyPolylinje")],
                  ["areal", VectorSquare, t("maaling.verktoyAreal")],
                ] as const).map(([v, Ikon, etikett]) => {
                  const erValgt = aktivtVerktoy === v;
                  return (
                    <Pressable
                      key={v}
                      disabled={!kanMaleNaa}
                      onPress={() => velgMaleVerktoy(v)}
                      style={[stiler.maleKnapp, erValgt && stiler.maleKnappAktiv, !kanMaleNaa && stiler.maleKnappSperret]}
                    >
                      <Ikon size={14} color={erValgt ? "#ffffff" : "#1e3a8a"} />
                      <Text style={[stiler.maleKnappTekst, erValgt && stiler.maleKnappTekstAktiv]}>{etikett}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={velgOpprett}
                  style={[stiler.maleKnapp, aktivtVerktoy === "opprett" && stiler.maleKnappAktiv]}
                >
                  <Plus size={14} color={aktivtVerktoy === "opprett" ? "#ffffff" : "#1e3a8a"} />
                  <Text style={[stiler.maleKnappTekst, aktivtVerktoy === "opprett" && stiler.maleKnappTekstAktiv]}>{t("maaling.verktoyOpprett")}</Text>
                </Pressable>
              </View>
              {/* 🟢 90°-lås · referanselinje · snap (ordre 90-snap + GJENOPPTA). */}
              {kanMaleNaa && (
                <View style={stiler.maleKnappRad}>
                  <Pressable onPress={() => setOrtho((v) => !v)} style={[stiler.maleKnapp, ortho && stiler.maleKnappAktiv]}>
                    <TriangleRight size={14} color={ortho ? "#ffffff" : "#1e3a8a"} />
                    <Text style={[stiler.maleKnappTekst, ortho && stiler.maleKnappTekstAktiv]}>{t("maaling.laasVinkel")}</Text>
                  </Pressable>
                  <Pressable
                    disabled={!ortho}
                    onPress={() => { setVelgReferanseModus((v) => !v); if (referanselinje) setReferanselinje(null); }}
                    style={[stiler.maleKnapp, (velgReferanseModus || referanselinje) && stiler.maleKnappAktiv, !ortho && stiler.maleKnappSperret]}
                  >
                    <Spline size={14} color={velgReferanseModus || referanselinje ? "#ffffff" : "#1e3a8a"} />
                    <Text style={[stiler.maleKnappTekst, (velgReferanseModus || referanselinje) && stiler.maleKnappTekstAktiv]}>{t("maaling.referanselinje")}</Text>
                  </Pressable>
                  <Pressable onPress={() => setSnapPaa((v) => !v)} style={[stiler.maleKnapp, snapPaa && stiler.maleKnappAktiv]}>
                    <Magnet size={14} color={snapPaa ? "#ffffff" : "#1e3a8a"} />
                    <Text style={[stiler.maleKnappTekst, snapPaa && stiler.maleKnappTekstAktiv]}>{t("maaling.snap")}</Text>
                  </Pressable>
                </View>
              )}
              {velgReferanseModus && (
                <View style={stiler.maleSperret}>
                  <Spline size={12} color="#1e3a8a" />
                  <Text style={[stiler.maleSperretTekst, { color: "#1e3a8a" }]}>{t("maaling.referanselinjeHjelp")}</Text>
                </View>
              )}
              {!kanMaleNaa && (
                <View style={stiler.maleSperret}>
                  <Ruler size={12} color="#9ca3af" />
                  <Text style={stiler.maleSperretTekst}>
                    {mmPrPiksel == null
                      ? t("maaling.manglerMaalegrunnlag")
                      : t("maaling.malestokkBekreftPaaWeb")}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Resultatstripe — den AKTIVE målingen: lengde/areal + kilde + handlinger. */}
          {maleEngasjert && aktiv && (
            <View style={stiler.maleStripe} pointerEvents="box-none">
              <View style={stiler.maleStripeInnhold}>
                {erAreal ? (
                  aktivPunkter.length < 3 ? (
                    <Text style={stiler.maleHint}>{t("maaling.hintArealMobil")}</Text>
                  ) : (
                    <Text style={stiler.maleResultat}>
                      {arealM2 != null ? formatAreal(arealM2) : "—"}
                      <Text style={stiler.maleKilde}>  {t("maaling.omkrets")}: {formatMeter(omkretsMeter)}  ({malestokkEtikett})</Text>
                    </Text>
                  )
                ) : aktivPunkter.length < 2 ? (
                  <Text style={stiler.maleHint}>
                    {aktiv?.verktoy === "polylinje" ? t("maaling.hintPolylinjeMobil") : t("maaling.klikkToPunkter")}
                  </Text>
                ) : (
                  <Text style={stiler.maleResultat}>
                    {formatMeter(maleTotalMeter)}
                    <Text style={stiler.maleKilde}>  ({malestokkEtikett})</Text>
                  </Text>
                )}
                {/* RETUR 5 § 3: piltastene er fjernet — lupa (RN-nativ, ved fingeren)
                    er presisjonsgrepet. Renest mulig UI. */}
                {/* Rediger-hint for en valgt figur i Flytt: sett inn hjørne på en kant.
                    Fjern-hjørne via langt trykk er fjernet (2026-10-14). */}
                {aktivtVerktoy === "flytt" && aktiv && aktiv.ferdig && (
                  <Text style={stiler.maleKilde}>{t("maaling.redigerHint")}</Text>
                )}
                <View style={stiler.maleStripeKnapper}>
                  {(aktiv?.verktoy === "polylinje" && aktivPunkter.length >= 2 && !aktiv.ferdig) && (
                    <Pressable onPress={håndterFerdig} style={stiler.maleHandling}>
                      <Check size={14} color="#16a34a" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.fullfor")}</Text>
                    </Pressable>
                  )}
                  {(aktiv?.verktoy === "areal" && aktivPunkter.length >= 3 && !aktiv.ferdig) && (
                    <Pressable onPress={håndterFerdig} style={stiler.maleHandling}>
                      <Check size={14} color="#16a34a" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.lukkFlate")}</Text>
                    </Pressable>
                  )}
                  {(aktiv?.verktoy === "polylinje" && aktiv.ferdig) && (
                    <Pressable onPress={håndterGjenoppta} style={stiler.maleHandling}>
                      <Plus size={14} color="#1e3a8a" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.fortsett")}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={håndterSlettAktiv} style={stiler.maleHandling}>
                    <Trash2 size={14} color="#dc2626" />
                    <Text style={[stiler.maleHandlingTekst, { color: "#dc2626" }]}>{t("maaling.slett")}</Text>
                  </Pressable>
                  {maleTilstand.malinger.length > 1 && (
                    <Pressable onPress={() => setVisSlettAlle(true)} style={stiler.maleHandling}>
                      <Trash2 size={14} color="#6b7280" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.slettAlle")}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={avsluttMaling} style={stiler.maleHandling}>
                    <X size={14} color="#6b7280" />
                    <Text style={stiler.maleHandlingTekst}>{t("handling.lukk")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Slett alle — bekreftelsesmodal (ikke confirm(), jf. ui-standarder). */}
          <Modal visible={visSlettAlle} transparent animationType="fade" onRequestClose={() => setVisSlettAlle(false)}>
            <View style={stiler.modalBakgrunn}>
              <View style={stiler.modalKort}>
                <Text style={stiler.modalTittel}>{t("maaling.slettAlleTittel")}</Text>
                <Text style={stiler.modalTekst}>{t("maaling.slettAlleBekreft")}</Text>
                <View style={stiler.modalKnapper}>
                  <Pressable onPress={() => setVisSlettAlle(false)} style={[stiler.modalKnapp, stiler.modalKnappAvbryt]}>
                    <Text style={stiler.modalKnappTekst}>{t("handling.avbryt")}</Text>
                  </Pressable>
                  <Pressable onPress={håndterSlettAlle} style={[stiler.modalKnapp, stiler.modalKnappSlett]}>
                    <Text style={[stiler.modalKnappTekst, { color: "#ffffff" }]}>{t("maaling.slettAlle")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}

const stiler = StyleSheet.create({
  feilContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  feilTekst: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  feilBeskrivelse: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  prøvIgjenKnapp: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e40af",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  prøvIgjenTekst: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  lastingContainer: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  lastingTekst: {
    color: "#d1d5db",
    fontSize: 14,
    marginTop: 12,
  },
  // --- Måleverktøy ---
  maleToolbar: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 25,
  },
  maleKnappRad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  maleKnapp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  maleKnappAktiv: {
    backgroundColor: "#1e40af",
  },
  maleKnappSperret: {
    opacity: 0.4,
  },
  maleKnappTekst: {
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: "600",
  },
  maleKnappTekstAktiv: {
    color: "#ffffff",
  },
  maleSperret: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 260,
  },
  maleSperretTekst: {
    color: "#6b7280",
    fontSize: 11,
    flexShrink: 1,
  },
  maleStripe: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  maleStripeInnhold: {
    backgroundColor: "rgba(239,246,255,0.97)",
    borderTopWidth: 1,
    borderTopColor: "#bfdbfe",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  maleHint: {
    color: "#4b5563",
    fontSize: 12,
  },
  maleResultat: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700",
  },
  maleKilde: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "400",
  },
  maleStripeKnapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lupe: {
    position: "absolute",
    zIndex: 50,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#1e40af",
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  lupeKryss: {
    position: "absolute",
    backgroundColor: "rgba(30,64,175,0.7)",
  },
  maleHandling: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  maleHandlingTekst: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "500",
  },
  modalBakgrunn: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalKort: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 20,
    gap: 10,
  },
  modalTittel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  modalTekst: {
    color: "#4b5563",
    fontSize: 14,
  },
  modalKnapper: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  modalKnapp: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalKnappAvbryt: {
    backgroundColor: "#f3f4f6",
  },
  modalKnappSlett: {
    backgroundColor: "#dc2626",
  },
  modalKnappTekst: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
});
