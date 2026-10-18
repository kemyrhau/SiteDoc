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
  flyttPunkt,
  slettAktiv,
  slettAlle,
  aktivMaling,
  insunitsTilMm,
  lesInsunitsFraDxfTekst,
  malVerdenMm,
  malVerdenArealMm2,
  kanMaleVerden,
  beregnSnapVerden,
  finnNaermesteVerdenPunkt,
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

const formatMeter = (m: number) =>
  `${m.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
const formatAreal = (m2: number) =>
  `${m2.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

/** Kamera-parametre for den delte skjerm↔verden-projeksjonen, lest rett fra dxf-viewer-instansen. */
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
  modus: "nyttPunkt" | "flyttEksisterende" | "observer" | null;
  flyttIndex: number;
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
    flyttIndex: -1,
    pekere: new Set(),
    forhandsvisning: null,
  };
}

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
  const [mmPrVerdenEnhet, setMmPrVerdenEnhet] = useState<number | null>(null);
  const [lupeVisning, setLupeVisning] = useState<{ skjermX: number; skjermY: number } | null>(null);
  const rotasjonOverstyrtRef = useRef(rotasjonOverstyrt ?? 0);
  rotasjonOverstyrtRef.current = rotasjonOverstyrt ?? 0;
  const onMaleKlarEndringRef = useRef(onMaleKlarEndring);
  onMaleKlarEndringRef.current = onMaleKlarEndring;
  const onObjektValgtRef = useRef(onObjektValgt);
  onObjektValgtRef.current = onObjektValgt;
  const onLaginventarKlarRef = useRef(onLaginventarKlar);
  onLaginventarKlarRef.current = onLaginventarKlar;
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
  // Imperativt speil av den reaktive målingstilstanden — lest av DOM-pointer-lytterne
  // (registrert ÉN gang pr. viewer-instans via last(), ikke ved hver render) for å
  // unngå stale closures uten å måtte re-registrere lytterne på hver tilstandsendring.
  const uiRef = useRef({ verktoy, ortho, snapPaa, maleTilstand, mmPrVerdenEnhet });

  const tegnOverlegg = useCallback(() => {
    const svg = overlaySvgRef.current;
    const viewer = viewerRef.current;
    if (!svg || !viewer?.camera) return;
    const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
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
  }, []);

  useEffect(() => {
    uiRef.current = { verktoy, ortho, snapPaa, maleTilstand, mmPrVerdenEnhet };
    tegnOverlegg();
    const viewer = viewerRef.current;
    if (viewer?.controls && gestRef.current.modus === null) {
      viewer.controls.enablePan = verktoy === "flytt";
    }
    onMaleKlarEndringRef.current?.(kanMaleVerden(mmPrVerdenEnhet));
  }, [verktoy, ortho, snapPaa, maleTilstand, mmPrVerdenEnhet, tegnOverlegg]);

  function naerTerskel(p: Punkt, q: Punkt): boolean {
    const viewer = viewerRef.current;
    if (!viewer?.camera) return false;
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

  function oppdaterForhandsvisning(skjermX: number, skjermY: number) {
    const viewer = viewerRef.current;
    if (!viewer?.camera) return;
    const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
    const kandidat = skjermTilVerden({ skjermX, skjermY }, k);
    const { maleTilstand: mt, ortho: orthoPaa, snapPaa: snapPaaNaa } = uiRef.current;
    const g = gestRef.current;

    const referanser: VerdenPunkt[] = [];
    for (const m of mt.malinger) {
      m.punkter.forEach((p, i) => {
        if (g.modus === "flyttEksisterende" && m.id === mt.aktivId && i === g.flyttIndex) return;
        referanser.push(toVerden(p));
      });
    }

    let anker: VerdenPunkt | null = null;
    let forforrige: VerdenPunkt | null = null;
    const aktiv = aktivMaling(mt);
    if (g.modus === "nyttPunkt" && aktiv && !aktiv.ferdig && aktiv.punkter.length > 0) {
      anker = toVerden(aktiv.punkter[aktiv.punkter.length - 1]!);
      if (aktiv.punkter.length > 1) forforrige = toVerden(aktiv.punkter[aktiv.punkter.length - 2]!);
    } else if (g.modus === "flyttEksisterende" && aktiv) {
      if (g.flyttIndex > 0) anker = toVerden(aktiv.punkter[g.flyttIndex - 1]!);
      if (g.flyttIndex > 1) forforrige = toVerden(aktiv.punkter[g.flyttIndex - 2]!);
    }

    g.forhandsvisning = beregnSnapVerden({
      kandidat,
      anker,
      forforrige,
      referanser,
      ortho: orthoPaa,
      snap: snapPaaNaa,
      kamera: k,
      punktTolPx: 16,
      guideTolPx: 10,
    });
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
    g.flyttIndex = -1;
    g.forhandsvisning = null;
    if (lupeRafRef.current !== null) {
      cancelAnimationFrame(lupeRafRef.current);
      lupeRafRef.current = null;
    }
    lupeRafPendingRef.current = null;
    setLupeVisning(null);
    if (viewer?.controls) viewer.controls.enablePan = uiRef.current.verktoy === "flytt";
    tegnOverlegg();
  }

  function onPointerDown(e: PointerEvent) {
    const g = gestRef.current;
    g.pekere.add(e.pointerId);
    if (g.pekere.size > 1) {
      avbrytGest();
      return;
    }
    const viewer = viewerRef.current;
    const canvas = viewer?.canvas as HTMLCanvasElement | undefined;
    if (!viewer?.camera || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const skjermX = e.clientX - rect.left;
    const skjermY = e.clientY - rect.top;
    const { verktoy: v, maleTilstand: mt, mmPrVerdenEnhet: mmEnh } = uiRef.current;

    if (v === "flytt") {
      const aktiv = aktivMaling(mt);
      if (!aktiv) return; // ingen aktiv måling å dra i — la OrbitControls panorere fritt
      const idx = finnNaermesteVerdenPunkt(
        aktiv.punkter.map(toVerden),
        { skjermX, skjermY },
        kameraParametre(viewer, rotasjonOverstyrtRef.current),
        18,
      );
      if (idx < 0) return; // bom — la OrbitControls panorere
      viewer.controls.enablePan = false;
      g.modus = "flyttEksisterende";
      g.flyttIndex = idx;
    } else if (v === "linjal" || v === "polylinje" || v === "areal") {
      if (!kanMaleVerden(mmEnh)) return;
      viewer.controls.enablePan = false;
      g.modus = "nyttPunkt";
    } else if (v === "navigering") {
      // F1 (trykk → egenskaper): KUN observasjon, ALDRI pointerCapture/enablePan-endring
      // — OrbitControls skal fortsatt eie pan/zoom helt fritt. Trygt uten capture-triks:
      // begge lyttere sitter PÅ SAMME canvas-node (ikke forelder/barn), og dxf-viewers
      // interne stopPropagation() (bevist i harness-v3.html) stopper bare bubbling til
      // FORELDRE-noder, ikke søsken-lyttere på samme element. avgjorTrykkHandling()
      // avgjør ved SLIPP (uten bevegelse, kort varighet) om det var et "hint".
      g.modus = "observer";
      g.aktiv = true;
      g.pointerId = e.pointerId;
      g.startTid = performance.now();
      g.startSkjerm = { x: skjermX, y: skjermY };
      g.flyttet = false;
      return;
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
    if (g.modus === "observer") return; // F1-observasjon: ingen lupe/forhåndsvisning, kun bevegelse-terskel
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
    if (!g.aktiv || e.pointerId !== g.pointerId) return;

    const varighetMs = performance.now() - g.startTid;
    const gest: TrykkGest = {
      varighetMs,
      flyttet: g.flyttet,
      antallPekere: g.pekere.size + 1,
      nedPaaPunkt: g.modus === "flyttEksisterende",
    };
    const handling = avgjorTrykkHandling(uiRef.current.verktoy, gest);
    const forhand = g.forhandsvisning;

    if (handling === "settPunkt" && forhand) {
      const punkt = fraVerden(forhand.punkt);
      setMaleTilstand((t) => leggTilPunkt(t, punkt, (q) => naerTerskel(punkt, q)));
    } else if (handling === "draPunkt" && forhand && g.modus === "flyttEksisterende") {
      const index = g.flyttIndex;
      const punkt = fraVerden(forhand.punkt);
      setMaleTilstand((t) => flyttPunkt(t, index, punkt));
    } else if (handling === "hint") {
      // F1: trykk utenfor målemodus → identifiser objektet under trykkpunktet.
      // g.startSkjerm er allerede canvas-relative CSS-px (satt i onPointerDown) —
      // samme punkt som slippet skjedde nær (avgjorTrykkHandling krever <6px bevegelse).
      const viewer = viewerRef.current;
      const reg = registerRef.current;
      const idx = bboxIndeksRef.current;
      if (viewer?.camera && reg && idx) {
        const k = kameraParametre(viewer, rotasjonOverstyrtRef.current);
        const treff = hitTestWorld(
          { skjermX: g.startSkjerm.x, skjermY: g.startSkjerm.y },
          k,
          reg,
          idx,
        );
        valgtObjektRef.current = treff;
        onObjektValgtRef.current?.(treff ? byggEgenskapsfelt(treff, uiRef.current.mmPrVerdenEnhet) : null);
      }
    }
    avbrytGest();
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
      fullfoerAktiv: () => setMaleTilstand(settFerdig),
      gjenopptaAktiv: () => setMaleTilstand(gjenoppta),
      slettAktiv: () => setMaleTilstand(slettAktiv),
      slettAlle: () => setMaleTilstand(() => slettAlle()),
      settLagSynlig: (navn: string, synlig: boolean) => {
        const viewer = viewerRef.current;
        if (!viewer?.ShowLayer) return;
        viewer.ShowLayer(navn, synlig);
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
    // SVAR 3 (orkestrator 2026-10-18, root cause for 100 % mobil-krasj på cache-treff):
    // ResizeObserver sitt FØRSTE varsel kan komme etter at viewer-instansen er bygget
    // (viewerRef.current satt) men FØR viewer.Load() har satt scene.bounds/origin —
    // worker-rundturen er async. Ved cache-treff + allerede lastet worker-bunt er dette
    // vinduet bredt nok at varselet alltid lander der, og "else"-grenen under leser
    // viewer.origin.x på undefined. Et ferskt nettverks-fetch holdt vinduet for kort til
    // at det samme varselet traff viewer-objektet. last() kaller selv tilpassKamera() rett
    // etter at Load() er ferdig, så hopp over her er aldri et tapt kamera-fit.
    if (!viewer || !viewer.bounds || rect.width <= 0 || rect.height <= 0) return;
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
          viewer.controls?.addEventListener("change", tegnOverlegg);
          if (viewer.controls) viewer.controls.enablePan = uiRef.current.verktoy === "flytt";
          fjernCanvasLytter = () => {
            canvas.removeEventListener("webglcontextlost", paaContextTapt);
            canvas.removeEventListener("webglcontextrestored", paaContextGjenopprettet);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerUp);
            viewer.controls?.removeEventListener("change", tegnOverlegg);
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
    };
    // RETUR 4 punkt 1: avhengig av den USIGNERTE stien (stabil for samme fil), ikke
    // dxfUrl/registerWorldUrl (signert på nytt ved hver tRPC-refetch — se filheaderen).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usignertDxfSti, usignertRegisterSti, rotasjonOverstyrt, retryTeller]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <svg ref={overlaySvgRef} className="pointer-events-none absolute inset-0" />
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
