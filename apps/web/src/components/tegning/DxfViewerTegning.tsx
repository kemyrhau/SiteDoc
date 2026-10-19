"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  RegisterVerden,
  RegisterVerdenObjekt,
  RegisterVerdenLagInfo,
  Punkt,
  MaleTilstand,
  Maling,
  DxfKameraParametre,
  VerdenPunkt,
  TegningVerktoy,
  TrykkGest,
  EgenskapsFelt,
} from "@sitedoc/shared";
import {
  erGyldigRegisterVerden,
  TOM_MALETILSTAND,
  startMaling,
  leggTilPunkt,
  settFerdig,
  gjenoppta,
  flyttPunktIMaling,
  slettAktiv,
  slettAlle,
  aktivMaling,
  velgMaling,
  insunitsTilMm,
  lesInsunitsFraDxfTekst,
  malVerdenMm,
  malVerdenArealMm2,
  kanMaleVerden,
  beregnSnapVerden,
  finnMalingTreffVerden,
  lupePlassering,
  LUPE_DIAMETER,
  LUPE_FORSTORRELSE,
  LUPE_FORSKYVNING,
  avgjorTrykkHandling,
  skjermTilVerden,
  verdenTilSkjerm,
  MAALING_FARGE_AKTIV,
  MAALING_FARGE_FERDIG,
  byggBboxIndeks,
  hitTestWorld,
  byggEgenskapsfelt,
  OBJEKT_MARKERING_FARGE,
  erMaleVerktoy,
} from "@sitedoc/shared";
import { hentFilMedCache, usignertFilSti } from "@/lib/tegningFilCache";
import { hentDxfWorkerFactory } from "@/lib/dxfWorkerFactory";

/**
 * Leveranse 1 (TEGNING_MOTOR=dxfviewer): tegner forenklet DXF + O1-register direkte
 * via `dxf-viewer` (WebGL), som erstatning for SVG-visningen bak flagget (plan § 1-3,
 * relay/inbox-orkestrator.md). Lazy-lastet (dynamic import) — `dxf-viewer` drar med
 * seg en EGEN three.js-kopi (^0.186, direkte avhengighet) ved siden av 3D-viserens
 * ^0.183.2 (orkestrator-vedtak 2026-10-13: to kopier akseptert, så lenge denne siden
 * ikke drar dem inn i 3D-sidens bundle).
 *
 * Kun INITIELT kamera-oppsett (fit + startutsnitt + VEDTAK B-rotasjon) bygges her —
 * pan/zoom kommer "gratis" fra dxf-viewer sin egne OrbitControls. Objektklikk/lag-panel
 * er en senere leveranse.
 *
 * Måling + lupe (leveranse 3+4, "POST: mobil leveranse 3+4, lupe og måling i dxf-viewer"):
 * bygget INN i denne komponenten (ikke i kalleren) — da virker den samme måten uansett
 * om den mountes i web-dashbordet (`tegninger/page.tsx`, ingen toolbar koblet ennå) eller
 * i mobil-WebView-en (`dxf-viewer-smoketest/page.tsx`, toolbar er RN — se den filens
 * header for postMessage-protokollen). Toolbar-styring skjer via `ref` (imperativ, samme
 * mønster som `DxfViewerTegningMobil`s `beOmStatus`), IKKE via nye props — en kaller som
 * ikke bruker refen får null endret oppførsel.
 *
 * Måleverktøyene lagrer punkter i DXF-VERDENSKOORDINATER (ikke prosent-av-bilde som
 * SVG-veien) — `packages/shared/src/tegning/maaling-verden.ts` har begrunnelsen. Punktene
 * gjenbruker likevel `Maling`/`MaleTilstand` (packages/shared/src/utils/malinger.ts)
 * UFORANDRET: den datamodellen er enhets-agnostisk (ren punkt-liste-manipulasjon), kun
 * de GEOMETRISKE funksjonene (lås/snap/mål) er verdensrom-native. `toVerden`/`fraVerden`
 * under er den tynne adapteren mellom de to.
 *
 * Referanselinje-knappen (SVG-veiens 90°-lås-tillegg) er IKKE bygget her — krever en egen
 * punkt-velger-flyt som ikke er i ordren sin eksplisitte liste (Linjal/Polylinje/Areal/
 * Snap). 90°-lås mot AKSER + forrige segment er fullt bygget.
 */

export interface DxfViewerTegningProps {
  dxfUrl: string;
  registerWorldUrl: string;
  /** Brukerens visningsrotasjon i grader (DB: Drawing.rotasjonOverstyrt). VEDTAK B:
   * ikke-georeferert DWG vises SOM TEGNET — ingen auto-kamerarotasjon, kun denne. */
  rotasjonOverstyrt: number | null;
  /** Kalt når måleverktøyet blir tilgjengelig/utilgjengelig (ny `$INSUNITS` lest fra DXF-en). */
  onMaleKlarEndring?: (kanMale: boolean) => void;
  /** F1: kalt med egenskapsfeltene for objektet under et trykk (utenfor målemodus),
   * eller `null` ved trykk i tomrom / når markeringen fjernes. */
  onObjektValgt?: (felt: EgenskapsFelt[] | null) => void;
  /** F2: kalt når registeret er lastet, med laginventaret (gruppe/visningsnavn/
   * antall allerede beregnet server-side). `null` ved ugyldig/manglende register. */
  onLaginventarKlar?: (laginventar: RegisterVerdenLagInfo[] | null) => void;
}

/** Imperativ styring av måleverktøyet — samme mønster som `DxfViewerTegningMobil`s ref. */
export interface DxfViewerTegningRef {
  /** Verktøyknapp trykket. "linjal"/"polylinje"/"areal" starter ALLTID en NY måling
   * (samme regel som `startMaling`s docstring); "flytt" bytter kun modus. */
  settVerktoy: (v: TegningVerktoy) => void;
  settOrtho: (på: boolean) => void;
  settSnap: (på: boolean) => void;
  /** Tillegg 3: fast trådkors + handlingsknapp i stedet for direkte trykk. */
  settPeker: (på: boolean) => void;
  /** Fullfør (polylinje) — no-op hvis ingen aktiv påbegynt måling. */
  fullfoerAktiv: () => void;
  /** Fortsett en ferdig måling (åpne den aktive igjen for flere punkter). */
  gjenopptaAktiv: () => void;
  slettAktiv: () => void;
  slettAlle: () => void;
  /** F2: slå et DXF-lag av/på (dxf-viewers `ShowLayer`). `navn` = `RegisterVerdenLagInfo.navn`. */
  settLagSynlig: (navn: string, synlig: boolean) => void;
}

// Samme midlertidige heuristikk som harness-v3 (orkestrator-godkjent MVP, plan § 6):
// rutenett-/akselinjer ekskluderes fra byggutstrekningen via lagnavn-nøkkelord.
// Erstattes av en geometrisk regel (ingen lagnavn) i en egen leveranse FØR en
// kundetegning med annen rutenett-navngivning treffer veggen.
const RUTENETT_NOKKELORD = ["modullinj"];

function erRutenettObjekt(o: { kategori?: string; lag?: string }): boolean {
  const k = `${o.kategori ?? ""} ${o.lag ?? ""}`.toLowerCase();
  return RUTENETT_NOKKELORD.some((n) => k.includes(n));
}

function beregnByggUtstrekning(register: RegisterVerden) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const o of Object.values(register.objekter)) {
    if (!o.bbox || erRutenettObjekt(o)) continue;
    if (o.bbox[0] < x0) x0 = o.bbox[0];
    if (o.bbox[2] > x1) x1 = o.bbox[2];
    if (o.bbox[1] < y0) y0 = o.bbox[1];
    if (o.bbox[3] > y1) y1 = o.bbox[3];
  }
  return Number.isFinite(x0) ? { x0, x1, y0, y1 } : null;
}

// --- Måling: adapter mellom verdens-geometrien og den enhets-agnostiske Maling-modellen. ---
const toVerden = (p: Punkt): VerdenPunkt => ({ verdenX: p.x, verdenY: p.y });
const fraVerden = (p: VerdenPunkt): Punkt => ({ x: p.verdenX, y: p.verdenY });
/** `finnMalingTreffVerden` tar en strukturell `{punkter: VerdenPunkt[]}[]` (ingen
 * avhengighet til `Maling`-typen i maaling-verden.ts) — denne adapteren bevarer
 * array-INDEKSEN 1:1 mot `malinger`, slik at kalleren kan slå opp `malinger[treff.
 * malingIndex]` direkte på resultatet. */
const malingerTilVerden = (malinger: Maling[]): { punkter: VerdenPunkt[] }[] =>
  malinger.map((m) => ({ punkter: m.punkter.map(toVerden) }));

const formatMeter = (m: number) =>
  `${m.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
const formatAreal = (m2: number) =>
  `${m2.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

/** RETUR krasjretting (Kontrollør, orkestrator 2026-10-18): ÉN sentral klar-sjekk for
 * ALT som leser scene/kamera fra en dxf-viewer-instans. `camera` settes i konstruktøren
 * (alltid sann for en konstruert viewer), mens `bounds`/`origin` settes FØRST etter at
 * `Load()` har fullført sin async worker-rundtur (node_modules kilde: DxfViewer.js:242-
 * 243). Siden `last()` ALLTID bygger en FERSK `DxfViewer`-instans (aldri gjenbruk),
 * selv-nullstiller denne sjekken korrekt pr. last — ingen egen ref/state kan komme ut
 * av synk med viewer-objektet den speiler.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function viewerKlar(viewer: any): boolean {
  return Boolean(viewer?.camera && viewer.bounds && viewer.origin);
}

/** Kamera-parametre for den delte skjerm↔verden-projeksjonen, lest rett fra dxf-viewer-instansen.
 * Kalleren MÅ sjekke `viewerKlar(viewer)` FØRST — denne leser `viewer.origin` uten guard. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function kameraParametre(viewer: any, rotasjonGrader: number): DxfKameraParametre {
  const cam = viewer.camera;
  const o = viewer.origin;
  return {
    left: cam.left,
    right: cam.right,
    top: cam.top,
    bottom: cam.bottom,
    zoom: cam.zoom,
    senterX: o.x + cam.position.x,
    senterY: o.y + cam.position.y,
    rotasjonGrader,
    canvasBredde: viewer.canvasWidth,
    canvasHoyde: viewer.canvasHeight,
  };
}

const SVG_NS = "http://www.w3.org/2000/svg";

function tegnEtikett(svg: SVGSVGElement, x: number, y: number, tekst: string) {
  const g = document.createElementNS(SVG_NS, "g");
  const t = document.createElementNS(SVG_NS, "text");
  t.textContent = tekst;
  t.setAttribute("x", String(x));
  t.setAttribute("y", String(y));
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("dominant-baseline", "middle");
  t.setAttribute("font-size", "12");
  t.setAttribute("font-family", "sans-serif");
  t.setAttribute("fill", "#111827");
  t.setAttribute("paint-order", "stroke");
  t.setAttribute("stroke", "#ffffff");
  t.setAttribute("stroke-width", "3");
  g.appendChild(t);
  svg.appendChild(g);
}

/** Tillegg 3 (peker): fast trådkors midt på flaten — brukeren panorerer tegningen
 * UNDER det i stedet for å flytte korset. Rent visuelt (ingen hit-test her). */
function tegnPekerSikte(svg: SVGSVGElement, cx: number, cy: number) {
  const g = document.createElementNS(SVG_NS, "g");
  const sirkel = document.createElementNS(SVG_NS, "circle");
  sirkel.setAttribute("cx", String(cx));
  sirkel.setAttribute("cy", String(cy));
  sirkel.setAttribute("r", "12");
  sirkel.setAttribute("fill", "none");
  sirkel.setAttribute("stroke", MAALING_FARGE_AKTIV);
  sirkel.setAttribute("stroke-width", "1.5");
  g.appendChild(sirkel);
  for (const [x1, y1, x2, y2] of [
    [cx - 20, cy, cx - 6, cy],
    [cx + 6, cy, cx + 20, cy],
    [cx, cy - 20, cx, cy - 6],
    [cx, cy + 6, cx, cy + 20],
  ]) {
    const l = document.createElementNS(SVG_NS, "line");
    l.setAttribute("x1", String(x1));
    l.setAttribute("y1", String(y1));
    l.setAttribute("x2", String(x2));
    l.setAttribute("y2", String(y2));
    l.setAttribute("stroke", MAALING_FARGE_AKTIV);
    l.setAttribute("stroke-width", "1.5");
    g.appendChild(l);
  }
  // Tillegg 3 pkt 3 (prikk i senter): eksakt treffpunkt — korsets linjer/ring viser
  // RETNINGEN, men ikke det nøyaktige pikselet. Samme prikk gjentas i lupen
  // (tegnPekerLupe) så begge peker på identisk punkt.
  const prikk = document.createElementNS(SVG_NS, "circle");
  prikk.setAttribute("cx", String(cx));
  prikk.setAttribute("cy", String(cy));
  prikk.setAttribute("r", "2");
  prikk.setAttribute("fill", MAALING_FARGE_AKTIV);
  g.appendChild(prikk);
  svg.appendChild(g);
}

/** Tillegg 3 pkt 1 (pekerlupe): ×3-forstørring av området UNDER trådkorset, kopiert
 * fra WebGL-canvasen samme vei som `tegnLupe` (drag-lupen) — se dens kommentar for
 * DPR-resonnementet. Forskjellen er plasseringen: denne ligger FAST over trådkorset
 * (midt på flaten), ikke ved fingeren, så JSX-en under styrer `left`/`top` direkte
 * i stedet for å gå via `lupePlassering` (som flipper side relativt til en finger). */
function tegnPekerLupe(
  canvas: HTMLCanvasElement | null,
  viewer: { canvas?: HTMLCanvasElement; canvasWidth: number } | null,
  skjermX: number,
  skjermY: number,
) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !viewer?.canvas || !ctx) return;
  const D = LUPE_DIAMETER;
  const dpr = viewer.canvas.width / viewer.canvasWidth;
  const s = (D / LUPE_FORSTORRELSE) * dpr;
  ctx.clearRect(0, 0, D, D);
  ctx.save();
  ctx.beginPath();
  ctx.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(viewer.canvas, skjermX * dpr - s / 2, skjermY * dpr - s / 2, s, s, 0, 0, D, D);
  ctx.restore();
  ctx.strokeStyle = MAALING_FARGE_AKTIV;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, D / 2);
  ctx.lineTo(D - 8, D / 2);
  ctx.moveTo(D / 2, 8);
  ctx.lineTo(D / 2, D - 8);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(D / 2, D / 2, D / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  // Samme prikk som i trådkorset (tegnPekerSikte) — eksakt treffpunkt.
  ctx.fillStyle = MAALING_FARGE_AKTIV;
  ctx.beginPath();
  ctx.arc(D / 2, D / 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function tegnMaling(
  svg: SVGSVGElement,
  m: Maling,
  k: DxfKameraParametre,
  erAktiv: boolean,
  mmPrVerdenEnhet: number | null,
) {
  const punkterVerden = m.punkter.map(toVerden);
  const skjermPunkter = punkterVerden.map((p) => verdenTilSkjerm(p, k));
  const farge = erAktiv ? MAALING_FARGE_AKTIV : MAALING_FARGE_FERDIG;

  if (skjermPunkter.length >= 2) {
    const lukket = m.verktoy === "areal" && m.ferdig;
    const el = document.createElementNS(SVG_NS, lukket ? "polygon" : "polyline");
    el.setAttribute("points", skjermPunkter.map((p) => `${p.skjermX},${p.skjermY}`).join(" "));
    el.setAttribute("fill", lukket ? `${farge}33` : "none");
    el.setAttribute("stroke", farge);
    el.setAttribute("stroke-width", "3");
    el.setAttribute("stroke-linejoin", "round");
    svg.appendChild(el);
  }
  for (const sp of skjermPunkter) {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", String(sp.skjermX));
    c.setAttribute("cy", String(sp.skjermY));
    c.setAttribute("r", "5");
    c.setAttribute("fill", farge);
    c.setAttribute("stroke", "#ffffff");
    c.setAttribute("stroke-width", "1.5");
    svg.appendChild(c);
  }

  if (mmPrVerdenEnhet == null) return;
  if (m.verktoy === "areal" && m.ferdig && punkterVerden.length >= 3) {
    const m2 = malVerdenArealMm2(punkterVerden, mmPrVerdenEnhet) / 1_000_000;
    const cx = skjermPunkter.reduce((s, p) => s + p.skjermX, 0) / skjermPunkter.length;
    const cy = skjermPunkter.reduce((s, p) => s + p.skjermY, 0) / skjermPunkter.length;
    tegnEtikett(svg, cx, cy, formatAreal(m2));
  } else {
    for (let i = 1; i < skjermPunkter.length; i++) {
      const a = skjermPunkter[i - 1]!;
      const b = skjermPunkter[i]!;
      const mm = malVerdenMm(punkterVerden[i - 1]!, punkterVerden[i]!, mmPrVerdenEnhet);
      tegnEtikett(svg, (a.skjermX + b.skjermX) / 2, (a.skjermY + b.skjermY) / 2, formatMeter(mm / 1000));
    }
  }
}

/** F1: kontur-highlight for valgt objekt. Ekte geometri (samme `geom` hitTestWorld
 * bruker) når den finnes; bbox-rektangel for flate/HATCH-objekter uten egen kontur;
 * ett punkt (romtagg-attributtblokk uten linjeverk) tegnes som en liten sirkel. */
function tegnHighlight(svg: SVGSVGElement, o: RegisterVerdenObjekt, k: DxfKameraParametre) {
  const polyer: { verdenX: number; verdenY: number }[][] = [];
  if (o.geom && o.geom.length) {
    for (const flat of o.geom) {
      const pts: VerdenPunkt[] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ verdenX: flat[i]!, verdenY: flat[i + 1]! });
      if (pts.length) polyer.push(pts);
    }
  } else if (o.bbox) {
    const [x0, y0, x1, y1] = o.bbox;
    polyer.push([
      { verdenX: x0, verdenY: y0 },
      { verdenX: x1, verdenY: y0 },
      { verdenX: x1, verdenY: y1 },
      { verdenX: x0, verdenY: y1 },
    ]);
  }
  for (const poly of polyer) {
    if (poly.length === 1) {
      const p = verdenTilSkjerm(poly[0]!, k);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", String(p.skjermX));
      c.setAttribute("cy", String(p.skjermY));
      c.setAttribute("r", "9");
      c.setAttribute("fill", "none");
      c.setAttribute("stroke", OBJEKT_MARKERING_FARGE);
      c.setAttribute("stroke-width", "3");
      svg.appendChild(c);
      continue;
    }
    const skjermPunkter = poly.map((p) => verdenTilSkjerm(p, k));
    const lukket = o.bbox !== undefined && !(o.geom && o.geom.length);
    const el = document.createElementNS(SVG_NS, lukket ? "polygon" : "polyline");
    el.setAttribute("points", skjermPunkter.map((p) => `${p.skjermX},${p.skjermY}`).join(" "));
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", OBJEKT_MARKERING_FARGE);
    el.setAttribute("stroke-width", "3");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    svg.appendChild(el);
  }
}

interface GestState {
  aktiv: boolean;
  pointerId: number | null;
  startTid: number;
  startSkjerm: { x: number; y: number };
  flyttet: boolean;
  /** Tillegg 1 (SVAR orkestrator 2026-10-19: «langt trykk + dra og lupen skal
   * fjernes» — pekeren er den ene veien til å flytte et punkt). "observerFlytt"
   * = Flytt-verktøyet UTEN peker, nå REN observasjon som "observer" (F1): ingen
   * capture/enablePan-endring, avgjøres ved SLIPP (se `onPointerUp`). */
  modus: "nyttPunkt" | "observer" | "observerFlytt" | null;
  pekere: Set<number>;
  forhandsvisning: ReturnType<typeof beregnSnapVerden> | null;
}

function nyGestState(): GestState {
  return {
    aktiv: false,
    pointerId: null,
    startTid: 0,
    startSkjerm: { x: 0, y: 0 },
    flyttet: false,
    modus: null,
    pekere: new Set(),
    forhandsvisning: null,
  };
}

/** Treffradius (skjerm-px) for Flytt-verktøyets direkte-trykk-søk etter et
 * målepunkt/-segment, på tvers av alle målinger (uendret fra tidligere 18px). */
const FLYTT_TREFF_PX = 18;
/** Treffradius (skjerm-px) for pekerens (trådkors) søk — strammere enn direkte
 * trykk (POST flytte målepunkter, orkestrator 2026-10-18 pkt 2: "innen ~12 px"). */
const PEKER_PUNKT_TREFF_PX = 12;

/** Tillegg 3 pkt 2 (presisjonsdra): med pekeren på flytter ÉN finger tegningen med
 * 1/3 av fingerens bevegelse (finjustering) — to fingre (pinch/pan) er UENDRET fart.
 * `OrbitControls.panSpeed` er samme skalar for begge (node_modules/dxf-viewer sin
 * `handleTouchMovePan`), så den justeres LIVE etter antall aktive pekere (se
 * `oppdaterPekerPanSpeed`) i stedet for å gaffle kontrolleren. */
const PEKER_PRESISJON_FAKTOR = 1 / 3;

/** Peker-tilstanden for "Flytt punkt" (Tillegg, orkestrator 2026-10-18, pkt 2):
 * "ingen" = normal Velg/Sett punkt-knapp. "naer" = trådkorset er innen
 * `PEKER_PUNKT_TREFF_PX` av et punkt i Flytt-verktøyet (viser "Flytt punkt", ikke
 * commitet ennå). "flytter" = brukeren har trykket "Flytt punkt" — punktet følger
 * trådkorset til "Sett punkt" eller "Avbryt" trykkes. */
type PekerFlyttTilstand =
  | { status: "ingen" }
  | { status: "naer"; malingIndex: number; punktIndex: number }
  | { status: "flytter"; malingIndex: number; punktIndex: number };
const PEKER_FLYTT_INGEN: PekerFlyttTilstand = { status: "ingen" };

export const DxfViewerTegning = forwardRef<DxfViewerTegningRef, DxfViewerTegningProps>(
  function DxfViewerTegning(
    { dxfUrl, registerWorldUrl, rotasjonOverstyrt, onMaleKlarEndring, onObjektValgt, onLaginventarKlar },
    ref,
  ) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlaySvgRef = useRef<SVGSVGElement>(null);
  const lupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState<string | null>(null);
  const [fremdriftProsent, setFremdriftProsent] = useState<number | null>(null);
  // Manuelt "Prøv igjen"-trykk (feilvisning) — teller inngår bevisst i avhengighetene
  // under: en brukerinitiert retry SKAL laste på nytt, i motsetning til signatur-churn.
  const [retryTeller, setRetryTeller] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const bygningRef = useRef<ReturnType<typeof beregnByggUtstrekning>>(null);
  const fitZoomBaseRef = useRef<number | null>(null);
  // Ferskeste SIGNERTE URL-er tilgjengelig for effekten uten å trigge et nytt effekt-løp
  // (se avhengighetene i useEffect under — kun den USIGNERTE stien trigger reload).
  const dxfUrlRef = useRef(dxfUrl);
  dxfUrlRef.current = dxfUrl;
  const registerWorldUrlRef = useRef(registerWorldUrl);
  registerWorldUrlRef.current = registerWorldUrl;
  const usignertDxfSti = usignertFilSti(dxfUrl);
  const usignertRegisterSti = usignertFilSti(registerWorldUrl);

  // --- Måling (leveranse 3+4) ---
  const [maleTilstand, setMaleTilstand] = useState<MaleTilstand>(TOM_MALETILSTAND);
  // F1-FUNN (verifisert lokalt, Playwright mot smoketest-siden): "flytt" som
  // startverktøy ga ALDRI noen gest (onPointerDown returnerer tidlig når ingen
  // aktiv måling finnes), så F1-trykk kunne umulig nås før toolbaren koblet et
  // eksplisitt settVerktoy — som ikke finnes for denne grenen i page.tsx i dag.
  // "navigering" er den naturlige default-tilstanden (ingen verktøy valgt).
  const [verktoy, setVerktoy] = useState<TegningVerktoy>("navigering");
  const [ortho, setOrtho] = useState(false);
  const [snapPaa, setSnapPaa] = useState(true);
  // Tillegg 3 (Kenneth 2026-10-18, "ja, ta med pekeren" — funksjonsendring med
  // hjemmel): fast trådkors midt på flaten + handlingsknapp, for presis plassering
  // uten å dekke treffpunktet med fingeren. Se filheaderen for flyten.
  const [pekerPaa, setPekerPaa] = useState(false);
  // Tillegg (flytte målepunkt med peker, orkestrator 2026-10-18 pkt 2): se
  // `PekerFlyttTilstand`-kommentaren for de tre tilstandene.
  const [pekerFlytt, setPekerFlytt] = useState<PekerFlyttTilstand>(PEKER_FLYTT_INGEN);
  const [mmPrVerdenEnhet, setMmPrVerdenEnhet] = useState<number | null>(null);
  const [lupeVisning, setLupeVisning] = useState<{ skjermX: number; skjermY: number } | null>(null);
  // Tillegg 3 pkt 1 (pekerlupe): synlig mens tegningen faktisk flyttes (satt av
  // `varslePekerLupeBevegelse`, se der) ELLER mens et peker-"Flytt punkt" pågår
  // (JSX OR'er inn `pekerFlytt.status === "flytter"` direkte — ingen egen flagg-
  // kobling nødvendig). Kenneth valgte "skjul etter stillstand" (1 s) i ordren —
  // begrunnelse: en fast lupe midt på flaten når brukeren bare har slått PÅ pekeren
  // uten å gjøre noe, dekker treffpunktet unødig og er støy, se filheaderen.
  const [pekerLupeBevegelse, setPekerLupeBevegelse] = useState(false);
  const pekerLupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const pekerLupeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotasjonOverstyrtRef = useRef(rotasjonOverstyrt ?? 0);
  rotasjonOverstyrtRef.current = rotasjonOverstyrt ?? 0;
  const onMaleKlarEndringRef = useRef(onMaleKlarEndring);
  onMaleKlarEndringRef.current = onMaleKlarEndring;
  const onObjektValgtRef = useRef(onObjektValgt);
  onObjektValgtRef.current = onObjektValgt;
  const onLaginventarKlarRef = useRef(onLaginventarKlar);
  onLaginventarKlarRef.current = onLaginventarKlar;
  // RETUR krasjretting (Kontrollør, orkestrator 2026-10-18): "lag-API". `settLagSynlig`
  // kalles imperativt fra UTSIDEN (RN-bunnark/web-lagpanel, bl.a. gjenopprettet lagvalg
  // fra enhetens lagring RETT ETTER mount) og kan komme FØR Load() er ferdig. Fremfor å
  // stille tape valget (ShowLayer no-op'er trygt på et ukjent lag, se vendor-kilden),
  // legges det i kø og spilles av igjen når last() har kjørt viewerKlar()-sjekken OK.
  const lagVentelisteRef = useRef<Map<string, boolean>>(new Map());
  // F1: registeret + rbush-indeksen bygges ÉN gang ved innlasting (ikke pr. trykk, se
  // hit-test-verden.ts sin "rbush som første filter"-kommentar), og valgt objekt
  // speiles i en ref (tegnOverlegg() leser den imperativt, samme mønster som måling).
  const registerRef = useRef<RegisterVerden | null>(null);
  const bboxIndeksRef = useRef<ReturnType<typeof byggBboxIndeks> | null>(null);
  const valgtObjektRef = useRef<RegisterVerdenObjekt | null>(null);
  const idTellerRef = useRef(0);
  const gestRef = useRef<GestState>(nyGestState());
  // Lupe-tegningen pr. pointermove throttles til rAF (RETUR leveranse 3+4) — canvas-til-
  // canvas-kopien + React-rerender er billig pr. kall, men unødvendig oftere enn skjermen
  // tegner. `lupeRafPending` holder bare siste posisjon; mellomliggende move-eventer slås
  // sammen til én tegning pr. frame.
  const lupeRafRef = useRef<number | null>(null);
  const lupeRafPendingRef = useRef<{ skjermX: number; skjermY: number } | null>(null);
  // RETUR (Kenneths telefontest, tillegg 2 punkt 5): overlegget (måling + markering +
  // lupe-sikte) må IKKE tegnes synkront inni dxf-viewers "viewChanged"-event — den
  // fyres for HVER OrbitControls-change (kan være flere pr. skjermbilde ved en rask
  // pinch), og en synkron SVG-ombygging pr. event kan komme ut av takt med WebGL-
  // ramma når eventene kommer tettere enn skjermens rAF. rAF-koalesering (samme
  // mønster som lupa over) garanterer nøyaktig ÉN overlegg-tegning pr. faktisk malt
  // bilde, alltid med det NYESTE kameraet på tegnetidspunktet.
  const overleggRafRef = useRef<number | null>(null);
  // Imperativt speil av den reaktive målingstilstanden — lest av DOM-pointer-lytterne
  // (registrert ÉN gang pr. viewer-instans via last(), ikke ved hver render) for å
  // unngå stale closures uten å måtte re-registrere lytterne på hver tilstandsendring.
  const uiRef = useRef({ verktoy, ortho, snapPaa, maleTilstand, mmPrVerdenEnhet, pekerPaa, pekerFlytt });

  /** Hvilket punkt dras akkurat nå — kun via et pågående peker-"Flytt punkt"
   * (`pekerFlytt.status === "flytter"`) siden Tillegg 1 (SVAR orkestrator
   * 2026-10-19): direkte langt-trykk-dra er fjernet, pekeren er den ene veien.
   * `null` = ingen aktiv flytting. */
  function gjeldendeFlytt(): { malingIndex: number; punktIndex: number } | null {
    const pf = uiRef.current.pekerFlytt;
    return pf.status === "flytter" ? { malingIndex: pf.malingIndex, punktIndex: pf.punktIndex } : null;
  }

  const tegnOverlegg = useCallback(() => {
    const svg = overlaySvgRef.current;
    const viewer = viewerRef.current;
    if (!svg || !viewerKlar(viewer)) return;
    const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);

    // Peker-"Flytt punkt" (Tillegg, orkestrator 2026-10-18 pkt 2): hold forhånds-
    // visningen i takt med kameraet mens trådkorset holdes fast og tegningen
    // panoreres under det — samme rAF-koalesering som driver DENNE funksjonen.
    // "naer" (ingen commit ennå) oppdages HER av samme grunn: live "er trådkorset
    // nær et punkt?"-sjekk mens brukeren panorerer, ikke bare ved knappetrykk.
    if (uiRef.current.pekerPaa) {
      const cx = k.canvasBredde / 2;
      const cy = k.canvasHoyde / 2;
      const pf = uiRef.current.pekerFlytt;
      if (pf.status === "flytter") {
        beregnForhandsvisningForSkjerm(cx, cy);
      } else if (uiRef.current.verktoy === "flytt") {
        const treff = finnMalingTreffVerden(malingerTilVerden(uiRef.current.maleTilstand.malinger), { skjermX: cx, skjermY: cy }, k, PEKER_PUNKT_TREFF_PX);
        const naer: PekerFlyttTilstand =
          treff && treff.punktIndex !== null
            ? { status: "naer", malingIndex: treff.malingIndex, punktIndex: treff.punktIndex }
            : PEKER_FLYTT_INGEN;
        const endret =
          naer.status !== pf.status ||
          (naer.status === "naer" && pf.status === "naer" && (naer.malingIndex !== pf.malingIndex || naer.punktIndex !== pf.punktIndex));
        if (endret) {
          uiRef.current.pekerFlytt = naer;
          setPekerFlytt(naer);
        }
      } else if (pf.status !== "ingen") {
        uiRef.current.pekerFlytt = PEKER_FLYTT_INGEN;
        setPekerFlytt(PEKER_FLYTT_INGEN);
      }
    }

    svg.setAttribute("width", String(k.canvasBredde));
    svg.setAttribute("height", String(k.canvasHoyde));
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const { maleTilstand: mt, mmPrVerdenEnhet: mmEnh } = uiRef.current;
    for (const m of mt.malinger) {
      tegnMaling(svg, m, k, m.id === mt.aktivId, mmEnh);
    }
    if (valgtObjektRef.current) tegnHighlight(svg, valgtObjektRef.current, k);
    const forhand = gestRef.current.forhandsvisning;
    if (forhand) {
      if (forhand.aksehjelpelinje) {
        const a = verdenTilSkjerm(forhand.aksehjelpelinje[0], k);
        const b = verdenTilSkjerm(forhand.aksehjelpelinje[1], k);
        const l = document.createElementNS(SVG_NS, "line");
        l.setAttribute("x1", String(a.skjermX));
        l.setAttribute("y1", String(a.skjermY));
        l.setAttribute("x2", String(b.skjermX));
        l.setAttribute("y2", String(b.skjermY));
        l.setAttribute("stroke", "#9ca3af");
        l.setAttribute("stroke-width", "1");
        l.setAttribute("stroke-dasharray", "4 4");
        svg.appendChild(l);
      }
      const sp = verdenTilSkjerm(forhand.punkt, k);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", String(sp.skjermX));
      c.setAttribute("cy", String(sp.skjermY));
      c.setAttribute("r", "7");
      c.setAttribute("fill", "none");
      c.setAttribute("stroke", MAALING_FARGE_AKTIV);
      c.setAttribute("stroke-width", "2");
      svg.appendChild(c);
      if (forhand.vinkelrett) tegnEtikett(svg, sp.skjermX, sp.skjermY - 18, "90°");
    }
    if (uiRef.current.pekerPaa) {
      tegnPekerSikte(svg, k.canvasBredde / 2, k.canvasHoyde / 2);
      // Tillegg 3 pkt 1: tegnes uansett (canvasen eksisterer kun i DOM-en når JSX-en
      // viser den, se render-delen) — billig no-op via guard inni funksjonen selv
      // når ref/viewer ikke er klare, samme mønster som resten av filen.
      tegnPekerLupe(pekerLupeCanvasRef.current, viewer, k.canvasBredde / 2, k.canvasHoyde / 2);
    }
    // `beregnForhandsvisningForSkjerm`/`gjeldendeFlytt` leser kun refs (uiRef/gestRef)
    // og trenger ikke stå i avhengighetene for korrekthet — samme mønster som resten
    // av filens imperative hjelpefunksjoner (naerTerskel, tegnLupe m.fl.).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** rAF-koalesert wrapper om `tegnOverlegg` — se `overleggRafRef`-kommentaren.
   * Flere kall innen samme bilde slås sammen til ett, og tegningen leser alltid
   * kameraet SLIK DET ER på tegnetidspunktet (ikke ved event-tidspunktet). */
  const tegnOverleggRaf = useCallback(() => {
    if (overleggRafRef.current !== null) return;
    overleggRafRef.current = requestAnimationFrame(() => {
      overleggRafRef.current = null;
      // Tillegg 3 pkt 1: KUN denne stien (ekte "viewChanged", ikke verktøybytte
      // osv.) teller som "tegningen flyttes" for lupe-synligheten.
      if (uiRef.current.pekerPaa) varslePekerLupeBevegelse();
      tegnOverlegg();
    });
  }, [tegnOverlegg]);

  useEffect(() => {
    uiRef.current = { verktoy, ortho, snapPaa, maleTilstand, mmPrVerdenEnhet, pekerPaa, pekerFlytt };
    // Forlater Flytt-verktøyet eller slår av peker midt i et pågående "Flytt punkt"
    // → avbryt (punktet er aldri skrevet før "Sett punkt" committer — se
    // `utforPekerHandling`, så det er ingenting å rulle tilbake, kun tilstanden).
    if ((!pekerPaa || verktoy !== "flytt") && pekerFlytt.status !== "ingen") {
      uiRef.current.pekerFlytt = PEKER_FLYTT_INGEN;
      setPekerFlytt(PEKER_FLYTT_INGEN);
      gestRef.current.forhandsvisning = null;
    }
    tegnOverlegg();
    const viewer = viewerRef.current;
    if (viewer?.controls && gestRef.current.modus === null) {
      // Peker-modus: ALLTID fri panorering (plasseringen skjer via handlingsknappen,
      // ikke ved trykk — se filheaderen) — uansett hvilket verktøy som er valgt.
      viewer.controls.enablePan = pekerPaa || verktoy === "flytt";
    }
    // Tillegg 3 pkt 2: forlater peker-modus med `panSpeed` stående på 1/3 (satt av
    // et aktivt énfinger-trykk) ville lekket presisjonsfarten inn i vanlig
    // Flytt-dra — nullstill eksplisitt i stedet for å stole på neste pointer-event.
    if (viewer?.controls && !pekerPaa) viewer.controls.panSpeed = 1;
    onMaleKlarEndringRef.current?.(kanMaleVerden(mmPrVerdenEnhet));
  }, [verktoy, ortho, snapPaa, maleTilstand, mmPrVerdenEnhet, pekerPaa, pekerFlytt, tegnOverlegg]);

  function naerTerskel(p: Punkt, q: Punkt): boolean {
    const viewer = viewerRef.current;
    if (!viewerKlar(viewer)) return false;
    const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
    const sp = verdenTilSkjerm(toVerden(p), k);
    const sq = verdenTilSkjerm(toVerden(q), k);
    return Math.hypot(sp.skjermX - sq.skjermX, sp.skjermY - sq.skjermY) <= 16;
  }

  function tegnLupe(skjermX: number, skjermY: number) {
    const canvas = lupeCanvasRef.current;
    const viewer = viewerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !viewer?.canvas || !ctx) return;
    const D = LUPE_DIAMETER;
    // `viewer.canvas` sin interne pikselbuffer er devicePixelRatio-skalert
    // (`renderer.setPixelRatio`, dxf-viewer sin DxfViewer.js), mens skjermX/skjermY
    // er CSS-px (fra getBoundingClientRect). drawImage()s KILDE-rektangel leses i
    // bufferens EGNE piksler — uten denne skaleringen treffer utsnittet feil (for
    // lite, feil hjørne) og lupa viser tilsynelatende tomt innhold ved DPR>1.
    const dpr = viewer.canvas.width / viewer.canvasWidth;
    const s = (D / LUPE_FORSTORRELSE) * dpr;
    ctx.clearRect(0, 0, D, D);
    ctx.save();
    ctx.beginPath();
    ctx.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(viewer.canvas, skjermX * dpr - s / 2, skjermY * dpr - s / 2, s, s, 0, 0, D, D);
    ctx.restore();
    ctx.strokeStyle = MAALING_FARGE_AKTIV;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, D / 2);
    ctx.lineTo(D - 8, D / 2);
    ctx.moveTo(D / 2, 8);
    ctx.lineTo(D / 2, D - 8);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(D / 2, D / 2, D / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** Tillegg 3 pkt 1: marker at tegningen nettopp ble flyttet (viewChanged) — viser
   * pekerlupen og starter/forlenger en ~1 s nedtelling til den skjules igjen. Kalt
   * KUN fra viewChanged-stien (se `tegnOverleggRaf`), ikke fra `tegnOverlegg()`s
   * andre kall-steder (verktøybytte osv.) — de er ikke "tegningen flyttes". */
  function varslePekerLupeBevegelse() {
    setPekerLupeBevegelse(true);
    if (pekerLupeTimerRef.current) clearTimeout(pekerLupeTimerRef.current);
    pekerLupeTimerRef.current = setTimeout(() => {
      pekerLupeTimerRef.current = null;
      setPekerLupeBevegelse(false);
    }, 1000);
  }

  /** Tillegg 3 pkt 2: `panSpeed` er delt mellom OrbitControls' én- og tofinger-pan
   * (se `PEKER_PRESISJON_FAKTOR`-kommentaren) — denne justerer den LIVE etter
   * `gestRef.current.pekere` (holdt oppdatert av onPointerDown/onPointerUp selv i
   * peker-modus, se der), slik at 1 finger alltid gir finjustert fart og 2+ alltid
   * gir normal fart, uansett hvilken retning overgangen skjer (lagt til/fjernet). */
  function oppdaterPekerPanSpeed() {
    const viewer = viewerRef.current;
    if (!viewer?.controls) return;
    viewer.controls.panSpeed = gestRef.current.pekere.size <= 1 ? PEKER_PRESISJON_FAKTOR : 1;
  }

  /**
   * Beregner forhåndsvisningen (snap/90°-lås) for et skjermpunkt og lagrer den i
   * `gestRef.current.forhandsvisning` — IKKE tegn selv (kalles fra inni
   * `tegnOverlegg()` sin peker-"flytter"-gren, der et nytt tegne-kall ville
   * rekursert). `oppdaterForhandsvisning` under er den vanlige wrapperen som
   * BÅDE beregner og tegner, for de andre kall-stedene (direkte pointer-gester).
   */
  function beregnForhandsvisningForSkjerm(skjermX: number, skjermY: number) {
    const viewer = viewerRef.current;
    if (!viewerKlar(viewer)) return;
    const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
    const kandidat = skjermTilVerden({ skjermX, skjermY }, k);
    const { maleTilstand: mt, ortho: orthoPaa, snapPaa: snapPaaNaa } = uiRef.current;
    const g = gestRef.current;
    const flytt = gjeldendeFlytt();

    const referanser: VerdenPunkt[] = [];
    for (let mi = 0; mi < mt.malinger.length; mi++) {
      mt.malinger[mi]!.punkter.forEach((p, i) => {
        if (flytt && mi === flytt.malingIndex && i === flytt.punktIndex) return;
        referanser.push(toVerden(p));
      });
    }

    let anker: VerdenPunkt | null = null;
    let forforrige: VerdenPunkt | null = null;
    const aktiv = aktivMaling(mt);
    if (g.modus === "nyttPunkt" && aktiv && !aktiv.ferdig && aktiv.punkter.length > 0) {
      anker = toVerden(aktiv.punkter[aktiv.punkter.length - 1]!);
      if (aktiv.punkter.length > 1) forforrige = toVerden(aktiv.punkter[aktiv.punkter.length - 2]!);
    } else if (flytt) {
      const m = mt.malinger[flytt.malingIndex];
      if (m) {
        if (flytt.punktIndex > 0) anker = toVerden(m.punkter[flytt.punktIndex - 1]!);
        if (flytt.punktIndex > 1) forforrige = toVerden(m.punkter[flytt.punktIndex - 2]!);
      }
    }

    g.forhandsvisning = beregnSnapVerden({
      kandidat,
      anker,
      forforrige,
      referanser,
      dominantVeggvinkelGrader: registerRef.current?.dominantVeggvinkelGrader,
      ortho: orthoPaa,
      snap: snapPaaNaa,
      kamera: k,
      punktTolPx: 16,
      guideTolPx: 10,
    });
  }

  function oppdaterForhandsvisning(skjermX: number, skjermY: number) {
    beregnForhandsvisningForSkjerm(skjermX, skjermY);
    tegnOverlegg();
  }

  function avbrytGest() {
    const g = gestRef.current;
    const viewer = viewerRef.current;
    if (g.aktiv && g.pointerId != null) {
      viewer?.canvas?.releasePointerCapture?.(g.pointerId);
    }
    g.aktiv = false;
    g.pointerId = null;
    g.modus = null;
    g.forhandsvisning = null;
    if (lupeRafRef.current !== null) {
      cancelAnimationFrame(lupeRafRef.current);
      lupeRafRef.current = null;
    }
    lupeRafPendingRef.current = null;
    setLupeVisning(null);
    if (viewer?.controls) viewer.controls.enablePan = uiRef.current.pekerPaa || uiRef.current.verktoy === "flytt";
    tegnOverlegg();
  }

  function onPointerDown(e: PointerEvent) {
    const g = gestRef.current;
    if (uiRef.current.pekerPaa) {
      // Tillegg 3 pkt 2: OrbitControls eier FORTSATT alle gester (ingen capture,
      // ingen preventDefault) — kun antall aktive pekere spores her, for å sette
      // `panSpeed` FØR OrbitControls' egen touchmove-håndtering leser den (se
      // `oppdaterPekerPanSpeed`-kommentaren for rekkefølge-resonnementet).
      g.pekere.add(e.pointerId);
      oppdaterPekerPanSpeed();
      return;
    }
    g.pekere.add(e.pointerId);
    if (g.pekere.size > 1) {
      avbrytGest();
      return;
    }
    const viewer = viewerRef.current;
    const canvas = viewer?.canvas as HTMLCanvasElement | undefined;
    if (!viewerKlar(viewer) || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const skjermX = e.clientX - rect.left;
    const skjermY = e.clientY - rect.top;
    const { verktoy: v, mmPrVerdenEnhet: mmEnh } = uiRef.current;

    if (v === "navigering" || v === "flytt") {
      // F1 (trykk → egenskaper) OG Flytt UTEN peker (Tillegg 1, SVAR orkestrator
      // 2026-10-19: «langt trykk + dra og lupen skal fjernes» — pekeren er den ene
      // veien til å flytte et punkt): BEGGE er nå REN observasjon, ALDRI pointer-
      // Capture/enablePan-endring — OrbitControls skal fortsatt eie pan/zoom helt
      // fritt. Trygt uten capture-triks: begge lyttere sitter PÅ SAMME canvas-node
      // (ikke forelder/barn), og dxf-viewers interne stopPropagation() (bevist i
      // harness-v3.html) stopper bare bubbling til FORELDRE-noder, ikke søsken-
      // lyttere på samme element. `onPointerUp` avgjør ved SLIPP (uten bevegelse)
      // om det var et F1-"hint" (navigering) eller en måling som skal velges (flytt)
      // — treffsøket skjer DER, ikke her, siden ingenting lenger kan dras.
      g.modus = v === "navigering" ? "observer" : "observerFlytt";
      g.aktiv = true;
      g.pointerId = e.pointerId;
      g.startTid = performance.now();
      g.startSkjerm = { x: skjermX, y: skjermY };
      g.flyttet = false;
      return;
    } else if (v === "linjal" || v === "polylinje" || v === "areal") {
      if (!kanMaleVerden(mmEnh)) return;
      viewer.controls.enablePan = false;
      g.modus = "nyttPunkt";
    } else {
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    g.aktiv = true;
    g.pointerId = e.pointerId;
    g.startTid = performance.now();
    g.startSkjerm = { x: skjermX, y: skjermY };
    g.flyttet = false;
    oppdaterForhandsvisning(skjermX, skjermY);
    setLupeVisning({ skjermX, skjermY });
    tegnLupe(skjermX, skjermY);
  }

  function onPointerMove(e: PointerEvent) {
    const g = gestRef.current;
    if (!g.aktiv || e.pointerId !== g.pointerId) return;
    const canvas = viewerRef.current?.canvas as HTMLCanvasElement | undefined;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const skjermX = e.clientX - rect.left;
    const skjermY = e.clientY - rect.top;
    if (Math.hypot(skjermX - g.startSkjerm.x, skjermY - g.startSkjerm.y) > 6) g.flyttet = true;
    // Ren observasjon (F1-navigering OG Flytt uten peker, Tillegg 1): ingen lupe/
    // forhåndsvisning underveis — kun bevegelse-terskelen over, avgjort ved slipp.
    if (g.modus === "observer" || g.modus === "observerFlytt") return;
    oppdaterForhandsvisning(skjermX, skjermY);
    lupeRafPendingRef.current = { skjermX, skjermY };
    if (lupeRafRef.current === null) {
      lupeRafRef.current = requestAnimationFrame(() => {
        lupeRafRef.current = null;
        const p = lupeRafPendingRef.current;
        if (!p) return;
        setLupeVisning(p);
        tegnLupe(p.skjermX, p.skjermY);
      });
    }
  }

  function onPointerUp(e: PointerEvent) {
    const g = gestRef.current;
    g.pekere.delete(e.pointerId);
    if (uiRef.current.pekerPaa) oppdaterPekerPanSpeed(); // Tillegg 3 pkt 2: en finger løftet/lagt til
    if (!g.aktiv || e.pointerId !== g.pointerId) return;

    // Tillegg 1 (SVAR orkestrator 2026-10-19): Flytt uten peker er nå ren
    // observasjon (se onPointerDown) — treffsøket skjer FØRST her, ved slipp, og
    // velger målingen (punkt ELLER segment) på et kort, ubevegd trykk. Flytter
    // ALDRI noe — det er pekerens jobb alene nå (`pekerFlytt`/`utforPekerHandling`).
    if (g.modus === "observerFlytt") {
      if (!g.flyttet) {
        const viewer = viewerRef.current;
        if (viewerKlar(viewer)) {
          const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
          const mt = uiRef.current.maleTilstand;
          const skjerm = { skjermX: g.startSkjerm.x, skjermY: g.startSkjerm.y };
          const treff = finnMalingTreffVerden(malingerTilVerden(mt.malinger), skjerm, k, FLYTT_TREFF_PX);
          const id = treff ? mt.malinger[treff.malingIndex]?.id : undefined;
          if (id) setMaleTilstand((t) => velgMaling(t, id));
        }
      }
      avbrytGest();
      return;
    }

    const varighetMs = performance.now() - g.startTid;
    const gest: TrykkGest = {
      varighetMs,
      flyttet: g.flyttet,
      antallPekere: g.pekere.size + 1,
    };
    const handling = avgjorTrykkHandling(uiRef.current.verktoy, gest);
    const forhand = g.forhandsvisning;

    if (handling === "settPunkt" && forhand) {
      const punkt = fraVerden(forhand.punkt);
      setMaleTilstand((t) => leggTilPunkt(t, punkt, (q) => naerTerskel(punkt, q)));
    } else if (handling === "hint") {
      // F1: trykk utenfor målemodus → identifiser objektet under trykkpunktet.
      // g.startSkjerm er allerede canvas-relative CSS-px (satt i onPointerDown) —
      // samme punkt som slippet skjedde nær (avgjorTrykkHandling krever <6px bevegelse).
      const viewer = viewerRef.current;
      const reg = registerRef.current;
      const idx = bboxIndeksRef.current;
      if (viewerKlar(viewer) && reg && idx) {
        const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
        const treff = hitTestWorld(
          { skjermX: g.startSkjerm.x, skjermY: g.startSkjerm.y },
          k,
          reg,
          idx,
        );
        valgtObjektRef.current = treff;
        onObjektValgtRef.current?.(treff ? byggEgenskapsfelt(treff, uiRef.current.mmPrVerdenEnhet, t) : null);
      }
    }
    avbrytGest();
  }

  function avbrytPekerFlytt() {
    uiRef.current.pekerFlytt = PEKER_FLYTT_INGEN;
    setPekerFlytt(PEKER_FLYTT_INGEN);
    gestRef.current.forhandsvisning = null;
    tegnOverlegg();
  }

  /** Tillegg 3 (peker): handlingsknappen utfører gjeldende verktøys handling PÅ
   * TRÅDKORSETS faste skjermposisjon (midt på canvaset) — "Velg" (F1-identifisering)
   * utenfor målemodus, "Sett punkt" (samme snap/90°-lås-pipeline som et vanlig
   * trykk) i Linjal/Polylinje/Areal. Ingen gest/lupe involvert (se onPointerDown).
   *
   * Tillegg (flytte målepunkt med peker, orkestrator 2026-10-18 pkt 2): et pågående
   * "Flytt punkt" (`pekerFlytt.status === "flytter"`) committes av DENNE SAMME
   * knappen (teksten viser da "Sett punkt" — se JSX). Prioritet (pkt 1): et treff
   * på en måling (punkt ELLER segment) sjekkes FØR objekt-identifisering.
   */
  function utforPekerHandling() {
    const viewer = viewerRef.current;
    if (!viewerKlar(viewer)) return;
    const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
    const skjermX = k.canvasBredde / 2;
    const skjermY = k.canvasHoyde / 2;
    const { verktoy: v, mmPrVerdenEnhet: mmEnh, maleTilstand: mt, pekerFlytt: pf } = uiRef.current;

    if (pf.status === "flytter") {
      const forhand = gestRef.current.forhandsvisning;
      const id = mt.malinger[pf.malingIndex]?.id;
      if (forhand && id) {
        const punkt = fraVerden(forhand.punkt);
        setMaleTilstand((t) => flyttPunktIMaling(t, id, pf.punktIndex, punkt));
      }
      uiRef.current.pekerFlytt = PEKER_FLYTT_INGEN;
      setPekerFlytt(PEKER_FLYTT_INGEN);
      gestRef.current.forhandsvisning = null;
      tegnOverlegg();
      return;
    }

    if (erMaleVerktoy(v) && kanMaleVerden(mmEnh)) {
      oppdaterForhandsvisning(skjermX, skjermY);
      const forhand = gestRef.current.forhandsvisning;
      if (forhand) {
        const punkt = fraVerden(forhand.punkt);
        setMaleTilstand((t) => leggTilPunkt(t, punkt, (q) => naerTerskel(punkt, q)));
      }
      gestRef.current.forhandsvisning = null;
      tegnOverlegg();
      return;
    }

    const maleTreff = finnMalingTreffVerden(malingerTilVerden(mt.malinger), { skjermX, skjermY }, k, PEKER_PUNKT_TREFF_PX);
    if (maleTreff) {
      if (v === "flytt" && maleTreff.punktIndex !== null) {
        const flytter: PekerFlyttTilstand = {
          status: "flytter",
          malingIndex: maleTreff.malingIndex,
          punktIndex: maleTreff.punktIndex,
        };
        uiRef.current.pekerFlytt = flytter;
        setPekerFlytt(flytter);
        beregnForhandsvisningForSkjerm(skjermX, skjermY);
        tegnOverlegg();
        return;
      }
      const id = mt.malinger[maleTreff.malingIndex]?.id;
      if (id) setMaleTilstand((t) => velgMaling(t, id));
      tegnOverlegg();
      return;
    }

    const reg = registerRef.current;
    const idx = bboxIndeksRef.current;
    if (reg && idx) {
      const treff = hitTestWorld({ skjermX, skjermY }, k, reg, idx);
      valgtObjektRef.current = treff;
      onObjektValgtRef.current?.(treff ? byggEgenskapsfelt(treff, mmEnh, t) : null);
      tegnOverlegg();
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      settVerktoy: (v: TegningVerktoy) => {
        setVerktoy(v);
        if (v === "linjal" || v === "polylinje" || v === "areal") {
          const nyId = `m-${idTellerRef.current++}`;
          setMaleTilstand((t) => startMaling(t, v, nyId));
        }
      },
      settOrtho: (på: boolean) => setOrtho(på),
      settSnap: (på: boolean) => setSnapPaa(på),
      settPeker: (på: boolean) => setPekerPaa(på),
      fullfoerAktiv: () => setMaleTilstand(settFerdig),
      gjenopptaAktiv: () => setMaleTilstand(gjenoppta),
      slettAktiv: () => setMaleTilstand(slettAktiv),
      slettAlle: () => setMaleTilstand(() => slettAlle()),
      settLagSynlig: (navn: string, synlig: boolean) => {
        const viewer = viewerRef.current;
        if (!viewerKlar(viewer)) {
          // Load() ikke ferdig ennå (f.eks. gjenopprettet lagvalg rett etter mount,
          // SVAR 2) — kø, spill av igjen i last() når viewerKlar() er sann.
          lagVentelisteRef.current.set(navn, synlig);
          return;
        }
        viewer.ShowLayer?.(navn, synlig);
        viewer.Render?.();
      },
    }),
    [],
  );

  /** Kamera-fit til bygningsutstrekningen (eller hele DXF-en før registeret er lastet),
   * for den GJELDENDE containerstørrelsen. Kalt ved første last OG fra ResizeObserver —
   * RETUR (orkestrator 2026-10-14): container-høyden er 0 ved mount inntil den delte
   * dashbord-layouten har satt en definit høyde (tegningVisningshoyde.ts), og kan endre
   * seg senere (vindu/mobilpanel) — ett engangs-FitView holder ikke. */
  function tilpassKamera(rect: DOMRectReadOnly | DOMRect) {
    const viewer = viewerRef.current;
    // SVAR 3 + RETUR krasjretting (orkestrator 2026-10-18, root cause for 100 % mobil-
    // krasj på cache-treff): ResizeObserver sitt FØRSTE varsel (og flere andre kilder,
    // se viewerKlar()-kommentaren) kan komme FØR viewer.Load() har satt scene.bounds/
    // origin. last() kaller selv tilpassKamera() rett etter at Load() er ferdig, så
    // hopp over her er aldri et tapt kamera-fit.
    if (!viewerKlar(viewer) || rect.width <= 0 || rect.height <= 0) return;
    viewer.SetSize(Math.round(rect.width), Math.round(rect.height));
    const o = viewer.origin;
    const bu = bygningRef.current;
    const cam = viewer.camera;
    if (bu) {
      const uMinX = bu.x0 - o.x, uMaxX = bu.x1 - o.x, uMinY = bu.y0 - o.y, uMaxY = bu.y1 - o.y;
      const margin = Math.max(uMaxX - uMinX, uMaxY - uMinY) * 0.02;
      const width = uMaxX - uMinX + margin * 2;
      const height = uMaxY - uMinY + margin * 2;
      const aspect = rect.width / rect.height;
      let finalWidth = width, finalHeight = height;
      if (finalHeight * aspect > finalWidth) finalWidth = finalHeight * aspect;
      else finalHeight = finalWidth / aspect;
      const cx = (uMinX + uMaxX) / 2, cy = (uMinY + uMaxY) / 2;
      cam.left = -finalWidth / 2; cam.right = finalWidth / 2;
      cam.top = finalHeight / 2; cam.bottom = -finalHeight / 2;
      cam.zoom = 1;
      cam.position.set(cx, cy, 1);
      cam.updateProjectionMatrix();
      if (viewer.controls) { viewer.controls.target.set(cx, cy, 0); viewer.controls.update(); }
    } else {
      // Registeret er ikke lastet ennå (eller ugyldig) — hele DXF-ens extents, samme
      // ramme som FØR registeret svarer.
      const b = viewer.bounds;
      viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y, 0.05);
    }
    if (viewer.controls && fitZoomBaseRef.current) {
      const startBredde = viewer.camera.right - viewer.camera.left;
      const forhold = startBredde / fitZoomBaseRef.current;
      viewer.controls.minZoom = 0.5 * forhold;
      // Zoomtak (leveranse 3+4, Kenneth-mål "zoomer inn for lite"): EMPIRISK målt mot
      // den ekte fallplanen (romareal-stempler, MTEXT) via camera.zoom satt direkte —
      // zoom≈20× fit-bredden gir allerede flere stempler lesbare samtidig med god
      // margin («43,00 m²» krystallklar); zoom≈100× fyller skjermen med ÉN etikett
      // (fortsatt nyttig for presisjon); zoom≈300+× zoomer inn I et enkelt bokstav-
      // strøk (ubrukelig). 150× fit-bredden treffer midt i det nyttige vinduet — god
      // margin uten å gjøre pinch-rekkevidden unødvendig grov. Oppjustert fra 50×
      // (leveranse 1-default, Kenneths "zoomer inn for lite"-klage).
      viewer.controls.maxZoom = 150 * forhold;
    }
    viewer.Render();
    tegnOverlegg();
  }

  useEffect(() => {
    let kansellert = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null;
    let dxfBlobUrl: string | null = null;
    let fjernCanvasLytter: (() => void) | null = null;

    async function last() {
      // Rydd en FORRIGE instans FØR en ny bygges — `last()` kan kalles re-entrant fra
      // `webglcontextrestored` (ikke bare ved et nytt effekt-løp), og uten dette stables
      // flere canvas i samme container (DxfViewer.appendChild fjerner aldri en gammel).
      if (viewer) {
        fjernCanvasLytter?.();
        fjernCanvasLytter = null;
        viewer.Destroy?.();
        viewer = null;
        // RETUR 5 (nit, Kontrollør-gate e08784f0): Destroy() frigjør GL-konteksten
        // men fjerner ALDRI canvas-noden fra containeren — uten dette stabler hver
        // re-entrant last()-runde (webglcontextrestored) en ekstra (GL-løs) canvas.
        containerRef.current?.replaceChildren();
      }
      if (dxfBlobUrl) {
        URL.revokeObjectURL(dxfBlobUrl);
        dxfBlobUrl = null;
      }
      setLaster(true);
      setFeil(null);
      setFremdriftProsent(null);
      setMmPrVerdenEnhet(null);
      // Lagvalg fra en EVENTUELL forrige (annen) tegning er irrelevant for den nye.
      lagVentelisteRef.current.clear();
      const el = containerRef.current;
      if (!el) return;
      try {
        // RETUR 4 punkt 1+3: hent fra klient-cache (usignert nøkkel) først; signert URL
        // brukes kun ved bom. Parallelt (ikke sekvensielt som før) — register-fetchen
        // venter ikke på at DXF-parsingen er ferdig.
        const [dxfBlob, registerBlob, workerFactory] = await Promise.all([
          hentFilMedCache(usignertDxfSti, dxfUrlRef.current, (fase, mottatt, total) => {
            if (kansellert) return;
            setFremdriftProsent(fase === "nedlasting" && total ? Math.round((mottatt / total) * 100) : null);
          }),
          hentFilMedCache(usignertRegisterSti, registerWorldUrlRef.current),
          hentDxfWorkerFactory(),
        ]);
        if (kansellert) return;
        dxfBlobUrl = URL.createObjectURL(dxfBlob);
        setFremdriftProsent(null);

        // Leveranse 3+4: $INSUNITS leses rett fra DEN SAMME blob-en viewer.Load() under
        // bruker (ikke en server-DB-kolonne) — garanterer samme koordinatsystem som det
        // som faktisk rendres. Lett rå-tekst-skann (ikke en full parser-kjøring til).
        dxfBlob.text().then((tekst) => {
          if (kansellert) return;
          setMmPrVerdenEnhet(insunitsTilMm(lesInsunitsFraDxfTekst(tekst)));
        });

        const { DxfViewer } = await import("dxf-viewer");
        // preserveDrawingBuffer: lupen (leveranse 4) leser canvas-pikslene via
        // ctx.drawImage(viewer.canvas, …) — uten dette kan WebGL-bakbufferen være
        // tømt FØR drawImage får lese den (nettleser-avhengig, ikke garantert av specen).
        viewer = new DxfViewer(el, {
          autoResize: false,
          colorCorrection: true,
          sceneOptions: { wireframeMesh: false },
          preserveDrawingBuffer: true,
        });
        viewerRef.current = viewer;
        bygningRef.current = null;
        fitZoomBaseRef.current = null;

        // RETUR 4 punkt 2: tapt WebGL-kontekst (f.eks. en bakgrunnsfane Chrome reklamerer
        // GPU-minne fra) skal ALDRI gi en stille blank flate. "lost" viser feil+"Prøv
        // igjen"; "restored" laster på nytt automatisk (blobene er alt cachet → raskt).
        const canvas: HTMLCanvasElement | undefined = viewer.canvas;
        if (canvas) {
          const paaContextTapt = (e: Event) => {
            e.preventDefault();
            if (kansellert) return;
            setFeil(t("tegningsvelger.feilWebglKontekstTapt"));
            setLaster(false);
          };
          const paaContextGjenopprettet = () => {
            if (!kansellert) last();
          };
          canvas.addEventListener("webglcontextlost", paaContextTapt, false);
          canvas.addEventListener("webglcontextrestored", paaContextGjenopprettet, false);
          // Leveranse 3+4: måle-gestene. OrbitControls lytter på SAMME canvas (bubble-
          // fase) — ingen stopPropagation/capture-triks nødvendig, se filheaderen for
          // enablePan-resonnementet (2-fingers knip virker uendret, kun 1-finger-pan
          // slås av mens et måleverktøy er valgt eller et punkt dras).
          canvas.addEventListener("pointerdown", onPointerDown);
          canvas.addEventListener("pointermove", onPointerMove);
          canvas.addEventListener("pointerup", onPointerUp);
          canvas.addEventListener("pointercancel", onPointerUp);
          // RETUR (tillegg 2 punkt 5): dxf-viewers EGNE "viewChanged" (ikke bare
          // OrbitControls sin "change") — fyres også ved SetSize/ResizeObserver-fit,
          // ikke kun bruker-gest. rAF-koalesert (se tegnOverleggRaf-kommentaren).
          viewer.Subscribe("viewChanged", tegnOverleggRaf);
          if (viewer.controls) viewer.controls.enablePan = uiRef.current.pekerPaa || uiRef.current.verktoy === "flytt";
          fjernCanvasLytter = () => {
            canvas.removeEventListener("webglcontextlost", paaContextTapt);
            canvas.removeEventListener("webglcontextrestored", paaContextGjenopprettet);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerUp);
            viewer.Unsubscribe("viewChanged", tegnOverleggRaf);
            if (overleggRafRef.current !== null) {
              cancelAnimationFrame(overleggRafRef.current);
              overleggRafRef.current = null;
            }
          };
        }

        // Krav fra GODKJENT-posten (relay/inbox-dokgen-arbeidstegning-f1.md):
        // worker-veien er standard, men en 404/CSP-blokkert bunt skal ALDRI gi
        // blank flate — ett forsøk til på hovedtråden (samme viewer, Load()
        // nullstiller internt via Clear()), med en synlig konsollmelding.
        try {
          await viewer.Load({ url: dxfBlobUrl, fonts: ["/fonts/Arimo.ttf"], workerFactory: workerFactory ?? undefined });
        } catch (workerErr) {
          if (!workerFactory) throw workerErr;
          console.warn("[dxf-viewer] worker-bunt feilet, faller tilbake til hovedtråden", workerErr);
          if (kansellert) return;
          await viewer.Load({ url: dxfBlobUrl, fonts: ["/fonts/Arimo.ttf"] });
        }
        if (kansellert) { viewer.Destroy?.(); return; }
        if (viewer.SetClearColor) viewer.SetClearColor(0xffffff);

        // VEDTAK B: ikke-georeferert DWG vises SOM TEGNET. R=0 ved last; brukerens
        // rotasjonOverstyrt er en REN visningsrotasjon (kamera-up), ikke en ny fit.
        const R = rotasjonOverstyrt ?? 0;
        const rad = (R * Math.PI) / 180;
        viewer.camera.up.set(Math.sin(rad), Math.cos(rad), 0);

        // Mål/sett størrelsen FØR FitView (aspekt-korrekt fit) — kan være 0 her
        // (høyden settes av den delte dashbord-layouten i en annen komponent, se
        // tegningVisningshoyde.ts), ResizeObserveren under retter det opp.
        const initRect = el.getBoundingClientRect();
        if (initRect.width > 0 && initRect.height > 0) {
          viewer.SetSize(Math.round(initRect.width), Math.round(initRect.height));
        }

        // viewer.bounds er RÅ DXF-verdenskoordinater, scenen er origin-forskjøvet —
        // FitView/SetView gjør ingen origin-trekk selv (bekreftet i bunten).
        const b = viewer.bounds, o = viewer.origin;
        viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y, 0.05);
        fitZoomBaseRef.current = viewer.camera.right - viewer.camera.left;

        // Startutsnitt (RETUR, orkestrator 2026-10-13): regnes DIREKTE fra registerets
        // bygningsutstrekning (rutenett ekskludert), IKKE render.py sin SVG-startutsnitt-
        // brøk (annen koordinatramme: rotert/flippet/margin — kun gyldig for SVG-veien).
        const register = JSON.parse(await registerBlob.text());
        if (kansellert) return;
        if (erGyldigRegisterVerden(register)) {
          bygningRef.current = beregnByggUtstrekning(register);
          // F1: registeret + bbox-indeksen bygges ÉN gang her, ikke pr. trykk.
          registerRef.current = register;
          bboxIndeksRef.current = byggBboxIndeks(register);
          onLaginventarKlarRef.current?.(register.laginventar);
        } else {
          registerRef.current = null;
          bboxIndeksRef.current = null;
          onLaginventarKlarRef.current?.(null);
        }
        valgtObjektRef.current = null;
        onObjektValgtRef.current?.(null); // ny tegning lastet -> forrige markering er ugyldig
        // RETUR krasjretting: spill av lagvalg som kom inn FØR viewerKlar() ble sann
        // (settLagSynlig la dem i kø i stedet for å tape dem, se useImperativeHandle).
        if (lagVentelisteRef.current.size > 0) {
          for (const [navn, synlig] of lagVentelisteRef.current) viewer.ShowLayer?.(navn, synlig);
          lagVentelisteRef.current.clear();
          viewer.Render?.();
        }
        tilpassKamera(el.getBoundingClientRect());
        setLaster(false);
      } catch (e) {
        if (!kansellert) {
          setFeil(e instanceof Error ? e.message : String(e));
          setLaster(false);
        }
      }
    }
    last();

    // RETUR (orkestrator 2026-10-14): containerens høyde er 0 ved mount (den delte
    // dashbord-layoutens høyde-effekt kjører i en annen komponent og settes FØR denne
    // useEffect-en, men vinduet/panelet kan endre størrelse SENERE — mobilpanel tvunget
    // synlig, vindu resizet, verktøylinje som vokser). Refit på HVER observerte endring,
    // ikke bare ved mount.
    const el = containerRef.current;
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect) tilpassKamera(rect);
      });
      ro.observe(el);
    }

    return () => {
      kansellert = true;
      ro?.disconnect();
      fjernCanvasLytter?.();
      viewer?.Destroy?.();
      if (dxfBlobUrl) URL.revokeObjectURL(dxfBlobUrl);
      if (pekerLupeTimerRef.current) clearTimeout(pekerLupeTimerRef.current);
    };
    // RETUR 4 punkt 1: avhengig av den USIGNERTE stien (stabil for samme fil), ikke
    // dxfUrl/registerWorldUrl (signert på nytt ved hver tRPC-refetch — se filheaderen).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usignertDxfSti, usignertRegisterSti, rotasjonOverstyrt, retryTeller]);

  return (
    // Tillegg 2 (Kenneth 2026-10-19, bilde `ios-tekstlupe-velg.jpg`): langt trykk på
    // «Velg» (peker) trigget iOS' innebygde tekstmarkerings-lupe/håndtak — WebKit
    // tolket knappeteksten som markerbar. Dekker HELE flaten (canvas, SVG-overlegg,
    // trådkors-knapp, lupe) fra samme rot — én kilde, ikke én regel pr. kontroll.
    // `onContextMenu` dekker Android/desktop sin ekvivalente langt-trykk-meny.
    <div
      className="relative h-full w-full select-none"
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "manipulation" } as React.CSSProperties}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={containerRef} className="absolute inset-0" />
      <svg ref={overlaySvgRef} className="pointer-events-none absolute inset-0" />
      {pekerPaa && (
        <div className="absolute left-1/2 top-1/2 flex translate-x-[-50%] translate-y-[24px] gap-2">
          <button
            type="button"
            onClick={utforPekerHandling}
            className="rounded-full bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {pekerFlytt.status === "flytter" || erMaleVerktoy(verktoy)
              ? t("maaling.settPunkt")
              : pekerFlytt.status === "naer"
                ? t("maaling.flyttPunkt")
                : t("handling.velg")}
          </button>
          {pekerFlytt.status === "flytter" && (
            <button
              type="button"
              onClick={avbrytPekerFlytt}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg"
            >
              {t("handling.avbryt")}
            </button>
          )}
        </div>
      )}
      {pekerPaa && (pekerLupeBevegelse || pekerFlytt.status === "flytter") && (
        // Tillegg 3 pkt 1: FAST plassert over trådkorset (midt på flaten), ikke ved
        // fingeren — derfor ingen `lupePlassering`-sideflipp her, kun et konstant
        // oppover-offset fra senter (klemt mot toppkanten i stedet for å flippe).
        <canvas
          ref={pekerLupeCanvasRef}
          width={LUPE_DIAMETER}
          height={LUPE_DIAMETER}
          className="pointer-events-none absolute rounded-full shadow-lg"
          style={(() => {
            const viewer = viewerRef.current;
            const bredde = viewer?.canvasWidth ?? 0;
            const hoyde = viewer?.canvasHeight ?? 0;
            const left = bredde / 2 - LUPE_DIAMETER / 2;
            const top = Math.max(4, hoyde / 2 - LUPE_FORSKYVNING - LUPE_DIAMETER);
            return { left, top, width: LUPE_DIAMETER, height: LUPE_DIAMETER };
          })()}
        />
      )}
      {lupeVisning && containerRef.current && (
        <canvas
          ref={lupeCanvasRef}
          width={LUPE_DIAMETER}
          height={LUPE_DIAMETER}
          className="pointer-events-none absolute rounded-full shadow-lg"
          style={(() => {
            const viewer = viewerRef.current;
            const pos = lupePlassering(
              lupeVisning.skjermX,
              lupeVisning.skjermY,
              viewer?.canvasWidth ?? 0,
              viewer?.canvasHeight ?? 0,
              LUPE_DIAMETER,
              LUPE_FORSKYVNING,
            );
            return { left: pos.left, top: pos.top, width: LUPE_DIAMETER, height: LUPE_DIAMETER };
          })()}
        />
      )}
      {laster && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
          {fremdriftProsent !== null
            ? t("tegningsvelger.lasterTegningProsent", { prosent: fremdriftProsent })
            : t("tegningsvelger.lasterTegning")}
        </div>
      )}
      {feil && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 p-4 text-center text-red-600">
          <span>{feil}</span>
          <button
            type="button"
            onClick={() => setRetryTeller((n) => n + 1)}
            className="rounded border border-red-300 bg-white px-3 py-1 text-sm text-red-700 hover:bg-red-50"
          >
            {t("handling.provIgjen")}
          </button>
        </div>
      )}
    </div>
  );
  },
);
