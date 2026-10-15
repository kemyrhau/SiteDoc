// Ren skjerm↔verden-projeksjon for dxf-viewer-grenen (plan § 12, leveranse 2-posten
// "SVAR leveranse 2", relay/inbox-dokgen-arbeidstegning-f1.md). Formelen speiler
// EKSAKT hvordan `dxf-viewer` selv projiserer (`DxfViewer.js#_CanvasToSceneCoord`,
// `Vector3(x·2/cw−1, −y·2/ch+1, 1).unproject(camera)`), slik at måling/trykk kan
// bygges som en delt, testet funksjon i stedet for å gjenta matematikken i web
// OG mobil-WebView (samme feilklasse som startutsnitt-zoom.ts før den ble delt).
//
// Kameraets rotasjon (`rotasjonGrader`) er samme konvensjon som
// `viewer.camera.up.set(Math.sin(rad), Math.cos(rad), 0)` i `DxfViewerTegning.tsx`
// (VEDTAK B — ren visningsrotasjon, ingen auto-rotasjon). Utledning: med den
// opp-vektoren kaller `OrbitControls.update()` sin `camera.lookAt(target)` som gir
// kamera-lokal X-akse `(cosθ,−sinθ)` og Y-akse `(sinθ,cosθ)` i verdensrom (θ i
// radianer) — projeksjonen av et verdenspunkt til kamerarom blir dermed en VANLIG
// CCW-rotasjon med θ av vektoren fra kamerasenteret:
//   viewX = Δx·cosθ − Δy·sinθ
//   viewY = Δx·sinθ + Δy·cosθ
// Se kamera-projeksjon.test.ts for utledningen verifisert mot three.js sin
// lookAt-konvensjon og mot dxf-viewers egen `_CanvasToSceneCoord`.
//
// Origo trengs IKKE som parameter: `senterX`/`senterY` oppgis i SAMME koordinat-
// system som punktet som projiseres (DXF-verdenskoordinater, F11.2 — kalleren
// legger `viewer.origin` til `viewer.camera.position` ÉN gang når parametrene
// hentes ut), og origo-forskyvningen kansellerer i differansen `punkt − senter`.

/** Kameraparametre hentet direkte fra `dxf-viewer`s `OrthographicCamera` + canvas. */
export interface DxfKameraParametre {
  /** `camera.left`/`camera.right` (scene-enheter, FØR zoom). */
  left: number;
  right: number;
  /** `camera.top`/`camera.bottom` (scene-enheter, FØR zoom). */
  top: number;
  bottom: number;
  /** `camera.zoom`. */
  zoom: number;
  /** Kamerasenter i DXF-VERDENSKOORDINATER (`viewer.origin.x + camera.position.x`, tilsvarende for y). */
  senterX: number;
  senterY: number;
  /** Visningsrotasjon i GRADER — samme felt som `Drawing.rotasjonOverstyrt`/`rotasjonOverstyrt`-propen. */
  rotasjonGrader: number;
  /** Canvas-størrelse i CSS-piksler, SAMME tall som sendes til `viewer.SetSize(...)`. */
  canvasBredde: number;
  canvasHoyde: number;
}

export interface SkjermPunkt {
  /** Piksler fra venstre kant av canvaset (CSS-px, samme rom som `getBoundingClientRect`). */
  skjermX: number;
  /** Piksler fra TOPPEN av canvaset (skjerm-konvensjon, Y ned). */
  skjermY: number;
}

export interface VerdenPunkt {
  /** DXF-verdenskoordinat (samme enhet/rom som registerets `bbox`, F11.2). */
  verdenX: number;
  verdenY: number;
}

function halvbredder(k: DxfKameraParametre) {
  return {
    halvW: (k.right - k.left) / (2 * k.zoom),
    halvH: (k.top - k.bottom) / (2 * k.zoom),
    midX: (k.right + k.left) / 2,
    midY: (k.top + k.bottom) / 2,
  };
}

/** Skjermpunkt (canvas-piksler) → DXF-verdenskoordinat. */
export function skjermTilVerden(p: SkjermPunkt, k: DxfKameraParametre): VerdenPunkt {
  // Samme NDC-formel som dxf-viewers `_CanvasToSceneCoord`.
  const ndcX = (p.skjermX / k.canvasBredde) * 2 - 1;
  const ndcY = 1 - (p.skjermY / k.canvasHoyde) * 2;
  const { halvW, halvH, midX, midY } = halvbredder(k);
  const viewX = ndcX * halvW + midX;
  const viewY = ndcY * halvH + midY;

  const theta = (k.rotasjonGrader * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  // Invers rotasjon (−θ) av kamerarom-vektoren gir offset i verdensrom.
  const dx = viewX * cosT + viewY * sinT;
  const dy = -viewX * sinT + viewY * cosT;
  return { verdenX: k.senterX + dx, verdenY: k.senterY + dy };
}

/** DXF-verdenskoordinat → skjermpunkt (canvas-piksler). Inversen av {@link skjermTilVerden}. */
export function verdenTilSkjerm(p: VerdenPunkt, k: DxfKameraParametre): SkjermPunkt {
  const dx = p.verdenX - k.senterX;
  const dy = p.verdenY - k.senterY;

  const theta = (k.rotasjonGrader * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const viewX = dx * cosT - dy * sinT;
  const viewY = dx * sinT + dy * cosT;

  const { halvW, halvH, midX, midY } = halvbredder(k);
  const ndcX = (viewX - midX) / halvW;
  const ndcY = (viewY - midY) / halvH;
  return {
    skjermX: ((ndcX + 1) / 2) * k.canvasBredde,
    skjermY: ((1 - ndcY) / 2) * k.canvasHoyde,
  };
}
