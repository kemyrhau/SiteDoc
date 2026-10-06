/**
 * Én stedsmodell for timer-GPS (LAG 1-A, 2026-10-02).
 *
 * Erstatter de konkurrerende «hvor er jeg»-definisjonene som lå spredt i
 * mobilappen — to haversine-kopier (`utils/geo.ts`, `utils/dagsforslag.ts`) og
 * to speilede gjenkjennings-funksjoner (oppmøtested + byggeplass) — med ÉN
 * kilde: rene funksjoner, ingen DB, ingen React Native. 🔴 **Og ingen
 * Node-moduler:** lag 0c satte `types: ["node"]` på shared, så TypeScript
 * stopper deg IKKE om du importerer `fs` — ikke gå i den kanten. Kun globaler
 * som finnes i RN, Node OG nettleser. Da lastes fila i vitest-node.
 *
 * Kontrakt A1–A6 fra `docs/claude/timer-gps-lag1-spec.md § 2`.
 *
 * ⚠️ A5 (`velgDestinasjon`) kobles inn i reisekjeden (`beregnDagsforslag`) først
 * i LAG 1-B. I L1-A bygges og testes den, men den wires ikke — `ny.tsx` er den
 * eneste atferdsendringen L1-A gjør (H2: geofence-treff i stedet for 500 m).
 */

/**
 * GPS-punkt. Eget navn fordi `Punkt` i `utils/maaling` allerede er opptatt av
 * piksel-koordinater `{ x, y }`.
 */
export type GpsPunkt = { lat: number; lng: number };

/**
 * V17 — en byggeplass' geofence er enten en SIRKEL (punkt + radius, standard)
 * eller en SONE (polygon tegnet i lat/lng). Diskriminert union på `form`, påkrevd
 * på begge grener (spec § 3) — kompilatoren vokter at ingen formløs kandidat når
 * `gjenkjennSted`.
 *
 * `id = byggeplassId` (fordi `tolkPosisjon` leser `sted.id` som byggeplass,
 * `:107-110`). `lat/lng` = byggeplassens origo (reise-anker, B2) også for soner.
 */
export type Sirkel = {
  form: "sirkel";
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
};
export type Polygon = {
  form: "polygon";
  id: string;
  lat: number;
  lng: number;
  punkter: GpsPunkt[];
  omradeId: string;
  omradeNavn: string;
};
export type Geofence = Sirkel | Polygon;

/**
 * Et gjenkjent sted + målt avstand til origo. `form`/`omradeId` bæres fra
 * treffet (B4) — `omradeId` er null for sirkel. `avstandM` er avstand til origo
 * (logging, ikke avgjørelse for polygon).
 */
export type Treff<T> = {
  sted: T;
  avstandM: number;
  form: "sirkel" | "polygon";
  omradeId: string | null;
};

/** Jordradius i meter — haversine-grunnlag for A1. */
const JORDRADIUS_M = 6_371_000;

/** Meter pr. grad (bue) — lokalt-plan-skalering for areal/buffer (A2/B5). */
const M_PER_GRAD = (Math.PI / 180) * JORDRADIUS_M;

/**
 * A1 — haversine-avstand mellom to GPS-punkter, i hele meter.
 *
 * ÉN implementasjon. Erstatter `geo.ts`, kopien i `dagsforslag.ts` og
 * 500 m-regnestykket i `ny.tsx`. (`georeferanse.avstandMeter` er en EGEN,
 * ekvirektangulær tilnærming for tegnings-transformasjoner — den er ikke
 * haversine og røres ikke her.)
 */
export function avstandM(a: GpsPunkt, b: GpsPunkt): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(
    JORDRADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)),
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  V17 geometri — egne operasjoner i ÉT lokalt plan rundt et origo (ingen pakke,
//  ingen Node-moduler; spec § 2b). Planet: x = (lng−lng0)·cos(lat0), y = lat−lat0
//  (grader), fordi soner er km-skala, ikke kontinent-skala. `cosLat0` korrigerer
//  for lengdegradskompresjon. Alt testes mot A1/A2.
// ──────────────────────────────────────────────────────────────────────────

function cosLat(latGrader: number): number {
  return Math.cos((latGrader * Math.PI) / 180);
}

type PlanPunkt = { x: number; y: number };

/** GPS → lokalt plan (grader, x skalert med cos(lat0)). */
function tilPlan(p: GpsPunkt, lat0: number, lng0: number, c: number): PlanPunkt {
  return { x: (p.lng - lng0) * c, y: p.lat - lat0 };
}

/** Er punktet på segmentet a→b (kollineært + innenfor endepunktene)? */
function paaSegment(p: PlanPunkt, a: PlanPunkt, b: PlanPunkt): boolean {
  const kryss = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const eps = len2 > 0 ? Math.sqrt(len2) * 1e-9 : 1e-12;
  if (Math.abs(kryss) > eps) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  return dot >= -eps && dot <= len2 + eps;
}

/**
 * A1-kjerne — punkt-i-polygon ved ray-casting i det lokale planet rundt origo.
 * Kant teller som INNENFOR. Forutsetter enkelt polygon (`erEnkeltPolygon` ved
 * lagring) — ingen selvkryssings-sjekk her.
 */
function punktIPolygon(
  pos: GpsPunkt,
  punkter: readonly GpsPunkt[],
  lat0: number,
  lng0: number,
): boolean {
  const c = cosLat(lat0);
  const P = tilPlan(pos, lat0, lng0, c);
  const V = punkter.map((p) => tilPlan(p, lat0, lng0, c));
  const n = V.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (paaSegment(P, V[i]!, V[j]!)) return true; // kant = innenfor
  }
  let inne = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = V[i]!.y,
      yj = V[j]!.y,
      xi = V[i]!.x,
      xj = V[j]!.x;
    if (
      yi > P.y !== yj > P.y &&
      P.x < ((xj - xi) * (P.y - yi)) / (yj - yi) + xi
    ) {
      inne = !inne;
    }
  }
  return inne;
}

/**
 * A1 — er en posisjon innenfor en geofence? Sirkel: `avstandM ≤ radiusM` (=
 * dagens `sted.ts:70`). Polygon: punkt-i-polygon i lokalt plan rundt origo,
 * kant = innenfor. **Dette er PSIs funksjon** (måling M8) — ingen PSI-kode i V17.
 */
export function erInnenfor(pos: GpsPunkt, g: Geofence): boolean {
  if (g.form === "polygon") return punktIPolygon(pos, g.punkter, g.lat, g.lng);
  return avstandM(pos, g) <= g.radiusM;
}

/**
 * A2 — polygonets areal i m² (shoelace i lokalt plan × (m/grad)²). Kun for
 * B4-prioritet (minst areal vinner), ikke for visning.
 */
export function polygonArealM2(p: Polygon): number {
  const c = cosLat(p.lat);
  const V = p.punkter.map((q) => tilPlan(q, p.lat, p.lng, c));
  let a = 0;
  for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
    a += V[j]!.x * V[i]!.y - V[i]!.x * V[j]!.y;
  }
  return Math.round((Math.abs(a) / 2) * M_PER_GRAD * M_PER_GRAD);
}

/**
 * B2 — sentroiden (aritmetisk snitt av hjørnene) som lat/lng. Byggeplassens
 * origo når ingen er satt eksplisitt (reise-anker, utledet av sonene).
 */
export function sentroidePunkter(punkter: readonly GpsPunkt[]): GpsPunkt {
  const n = punkter.length;
  return {
    lat: punkter.reduce((s, p) => s + p.lat, 0) / n,
    lng: punkter.reduce((s, p) => s + p.lng, 0) / n,
  };
}

/** Orientering (kryssprodukt) av (a→b) mot (a→c) i planet. */
function orient(a: PlanPunkt, b: PlanPunkt, c: PlanPunkt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Krysser to segmenter (p1→p2, p3→p4) — egentlig kryss eller berøring? */
function segmenterKrysser(
  p1: PlanPunkt,
  p2: PlanPunkt,
  p3: PlanPunkt,
  p4: PlanPunkt,
): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return true;
  if (d1 === 0 && paaSegment(p1, p3, p4)) return true;
  if (d2 === 0 && paaSegment(p2, p3, p4)) return true;
  if (d3 === 0 && paaSegment(p3, p1, p2)) return true;
  if (d4 === 0 && paaSegment(p4, p1, p2)) return true;
  return false;
}

/**
 * Er polygonet ENKELT (ikke selvkryssende)? Segment-mot-segment O(n²) i lokalt
 * plan; tilstøtende kanter (deler hjørne) hoppes over. Figur-8 → false.
 * Garanteres ved lagring (spec § 2b) så A1 slipper å sjekke.
 */
export function erEnkeltPolygon(punkter: readonly GpsPunkt[]): boolean {
  const n = punkter.length;
  if (n < 3) return false;
  const lat0 = punkter[0]!.lat,
    lng0 = punkter[0]!.lng,
    c = cosLat(lat0);
  const V = punkter.map((p) => tilPlan(p, lat0, lng0, c));
  for (let i = 0; i < n; i++) {
    const a1 = V[i]!,
      a2 = V[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // Tilstøtende kanter deler et hjørne → hopp over.
      if (j === i || (i + 1) % n === j || (j + 1) % n === i) continue;
      if (segmenterKrysser(a1, a2, V[j]!, V[(j + 1) % n]!)) return false;
    }
  }
  return true;
}

/** Interpoler en bue (korteste vei) rundt senter i meter-planet. */
function buePunkter(
  senter: PlanPunkt,
  radius: number,
  fraAng: number,
  tilAng: number,
  antall: number,
): PlanPunkt[] {
  let d = tilAng - fraAng;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const ut: PlanPunkt[] = [];
  for (let k = 1; k < antall; k++) {
    const a = fraAng + d * (k / antall);
    ut.push({ x: senter.x + radius * Math.cos(a), y: senter.y + radius * Math.sin(a) });
  }
  return ut;
}

/**
 * B5 — buffer en kart-LINJE til en korridor-polygon (lat/lng), bredde `breddeM`.
 * Arbeider i et lokalt METER-plan rundt linjens første punkt: forskyv hvert
 * segment ± bredde/2 normalt, med en 8-punkts avrundet skjøt pr. indre hjørne.
 * Resultatet valideres med `erEnkeltPolygon` — feiler det (for skarp sving),
 * KASTES linjen med navngitt feil (spec B5 «avvises med navngitt feil»).
 * Rett linje → eksakt rektangel (ingen skjøt). KUN for linjer tegnet på kart.
 */
export function korridorFraLinje(
  linje: readonly GpsPunkt[],
  breddeM: number,
): GpsPunkt[] {
  if (linje.length < 2) {
    throw new Error("Korridor krever minst to linjepunkter.");
  }
  const lat0 = linje[0]!.lat,
    lng0 = linje[0]!.lng,
    c = cosLat(lat0);
  const half = breddeM / 2;
  const P = linje.map((p) => ({
    x: (p.lng - lng0) * c * M_PER_GRAD,
    y: (p.lat - lat0) * M_PER_GRAD,
  }));
  const seg: Array<{ a: PlanPunkt; b: PlanPunkt; nx: number; ny: number }> = [];
  for (let i = 0; i < P.length - 1; i++) {
    const dx = P[i + 1]!.x - P[i]!.x,
      dy = P[i + 1]!.y - P[i]!.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue; // dupliserte punkter
    seg.push({ a: P[i]!, b: P[i + 1]!, nx: -dy / len, ny: dx / len }); // venstre-normal
  }
  if (seg.length === 0) throw new Error("Korridor-linjen har null lengde.");
  const BUE = 8;
  const venstre: PlanPunkt[] = [];
  const hoyre: PlanPunkt[] = [];
  for (let i = 0; i < seg.length; i++) {
    const s = seg[i]!;
    const vAng = Math.atan2(s.ny, s.nx); // venstre-offset-retning
    const hAng = vAng + Math.PI; // høyre-offset-retning
    if (i > 0) {
      const pv = Math.atan2(seg[i - 1]!.ny, seg[i - 1]!.nx);
      venstre.push(...buePunkter(s.a, half, pv, vAng, BUE));
      hoyre.push(...buePunkter(s.a, half, pv + Math.PI, hAng, BUE));
    }
    venstre.push({ x: s.a.x + s.nx * half, y: s.a.y + s.ny * half });
    venstre.push({ x: s.b.x + s.nx * half, y: s.b.y + s.ny * half });
    hoyre.push({ x: s.a.x - s.nx * half, y: s.a.y - s.ny * half });
    hoyre.push({ x: s.b.x - s.nx * half, y: s.b.y - s.ny * half });
  }
  const ringM = [...venstre, ...hoyre.reverse()];
  const ring = ringM.map((m) => ({
    lat: lat0 + m.y / M_PER_GRAD,
    lng: lng0 + m.x / (c * M_PER_GRAD),
  }));
  if (!erEnkeltPolygon(ring)) {
    throw new Error(
      "Korridoren selvkrysser (for skarp sving) — del traséen i flere soner.",
    );
  }
  return ring;
}

/**
 * A3 — gjenkjenn stedet en posisjon er innenfor, blant geofence-kandidater.
 *
 * `pos == null` → `null`. Treff = `erInnenfor` (A1). B4-prioritet ved flere
 * treff: (1) SONE (polygon) før sirkel · (2) blant soner: MINST areal først
 * (sideveg slår hovedtrasé, «rom» slår «anlegg») · (3) blant sirkler: nærmest
 * sentrum. Tilstøtende soner som deler kant → begge treffer (kant = innenfor),
 * minst areal avgjør deterministisk (input-rekkefølge ved likt areal) — ALDRI
 * null når minst én dekker. `Treff` bærer `form` + `omradeId` (null for sirkel)
 * og `avstandM` til origo (logging, ikke avgjørelse for polygon).
 *
 * Kandidatene er GEOFENCER, ikke byggeplasser — en byggeplass med tre soner gir
 * tre polygon-kandidater (samme `id`), en sirkel-byggeplass én. Kalleren bygger
 * dem via `tilGeofencer` (A4) og mapper treff → byggeplass.
 */
export function gjenkjennSted<T extends Geofence>(
  pos: GpsPunkt | null,
  kandidater: readonly T[],
): Treff<T> | null {
  if (pos == null) return null;
  const traff = kandidater.filter((k) => erInnenfor(pos, k));
  if (traff.length === 0) return null;

  // B4 (1)+(2): sone vinner; blant soner minst areal først.
  const soner = traff.filter((k) => k.form === "polygon");
  if (soner.length > 0) {
    let beste = soner[0]!;
    let besteAreal = polygonArealM2(beste as Polygon);
    for (let i = 1; i < soner.length; i++) {
      const a = polygonArealM2(soner[i]! as Polygon);
      if (a < besteAreal) {
        beste = soner[i]!;
        besteAreal = a;
      }
    }
    return {
      sted: beste,
      avstandM: avstandM(pos, beste),
      form: "polygon",
      omradeId: (beste as Polygon).omradeId,
    };
  }

  // B4 (3): sirkler — nærmest sentrum.
  let beste = traff[0]!;
  let besteM = avstandM(pos, beste);
  for (let i = 1; i < traff.length; i++) {
    const m = avstandM(pos, traff[i]!);
    if (m < besteM) {
      beste = traff[i]!;
      besteM = m;
    }
  }
  return { sted: beste, avstandM: besteM, form: "sirkel", omradeId: null };
}

/**
 * A4 — bygg geofence-kandidatene for én byggeplass. ÉN kilde som erstatter de
 * tre `radiusM != null`-filtrene (måling M7 #5–#7). Soner med ≥ POLYGON_MIN_PUNKTER
 * punkter → én polygon-kandidat hver (origo = byggeplassens punkt, B2); ingen
 * geo-soner ∧ radius → én sirkel (B9); ellers tom (ikke gjenkjennbar). Krever
 * punkt (B2). Oppmøtested kalles med `soner: []` → alltid sirkel.
 */
export function tilGeofencer(b: {
  id: string;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  soner: readonly { id: string; navn: string; punkter: GpsPunkt[] }[];
}): Geofence[] {
  if (b.lat == null || b.lng == null) return []; // origo kreves
  const lat = b.lat;
  const lng = b.lng;
  const geoSoner = b.soner.filter(
    (s) => s.punkter.length >= GEOFENCE_GRENSER.polygonMinPunkter,
  );
  if (geoSoner.length > 0) {
    return geoSoner.map((s) => ({
      form: "polygon" as const,
      id: b.id,
      lat,
      lng,
      punkter: s.punkter,
      omradeId: s.id,
      omradeNavn: s.navn,
    }));
  }
  if (b.radiusM != null) {
    return [{ form: "sirkel", id: b.id, lat, lng, radiusM: b.radiusM }];
  }
  return [];
}

/**
 * A5 — byggeplassens utledede form (B3): polygon når ≥ 1 geo-sone, ellers sirkel
 * når radius, ellers null. Ingen kolonne — formen kan ikke drifte fra dataene.
 */
export function geofenceForm(b: {
  radiusM: number | null;
  soner?: readonly { punkter: GpsPunkt[] }[];
}): "sirkel" | "polygon" | null {
  const harSone = (b.soner ?? []).some(
    (s) => s.punkter.length >= GEOFENCE_GRENSER.polygonMinPunkter,
  );
  if (harSone) return "polygon";
  if (b.radiusM != null) return "sirkel";
  return null;
}

/**
 * Felles tolkning av en GPS-posisjon mot oppmøtesteder og byggeplasser.
 * Grunnlaget for både A3 (`tolkStart`) og A4 (`tolkSlutt`) — samme union.
 *
 * - `pos == null` → `ukjent` (H11: «startet hjemmefra» ≠ «GPS var avslått»;
 *   ALDRI `utenfor`).
 * - Treffer BÅDE et oppmøtested og en byggeplass → `kontor` vinner (V15), men
 *   byggeplass-id-en bæres med.
 * - Kun byggeplass → `byggeplass`. Ingen treff → `utenfor`.
 */
export type TolketSted =
  | { type: "kontor"; oppmotestedId: string; byggeplassId: string | null }
  | { type: "byggeplass"; byggeplassId: string }
  | { type: "utenfor" }
  | { type: "ukjent"; aarsak: "posisjon_utilgjengelig" };

export type Startsted = TolketSted;
export type Sluttsted = TolketSted;

function tolkPosisjon<
  O extends Geofence & { id: string },
  B extends Geofence & { id: string },
>(
  pos: GpsPunkt | null,
  oppmotesteder: readonly O[],
  byggeplasser: readonly B[],
): TolketSted {
  if (pos == null) return { type: "ukjent", aarsak: "posisjon_utilgjengelig" };
  const kontor = gjenkjennSted(pos, oppmotesteder);
  const bygg = gjenkjennSted(pos, byggeplasser);
  if (kontor) {
    // V15: kontor vinner når begge treffer; bær byggeplassen med for retur.
    return {
      type: "kontor",
      oppmotestedId: kontor.sted.id,
      byggeplassId: bygg ? bygg.sted.id : null,
    };
  }
  if (bygg) return { type: "byggeplass", byggeplassId: bygg.sted.id };
  return { type: "utenfor" };
}

/** A3 — tolk startposisjonen. Se {@link tolkPosisjon}. */
export function tolkStart<
  O extends Geofence & { id: string },
  B extends Geofence & { id: string },
>(
  pos: GpsPunkt | null,
  oppmotesteder: readonly O[],
  byggeplasser: readonly B[],
): Startsted {
  return tolkPosisjon(pos, oppmotesteder, byggeplasser);
}

/** A4 — tolk sluttposisjonen (grunnlag for retur, V7). Se {@link tolkPosisjon}. */
export function tolkSlutt<
  O extends Geofence & { id: string },
  B extends Geofence & { id: string },
>(
  pos: GpsPunkt | null,
  oppmotesteder: readonly O[],
  byggeplasser: readonly B[],
): Sluttsted {
  return tolkPosisjon(pos, oppmotesteder, byggeplasser);
}

/**
 * A5 — velg destinasjonen (hvor arbeidet skjedde) for reiseberegningen.
 *
 * Rekkefølge:
 *  (1) sluttsted er en byggeplass → den.
 *  (2) arbeiderens aktive byggeplass (`kontekstByggeplassId`).
 *  (3) prosjektet har NØYAKTIG ÉN byggeplass med punkt → den.
 *  (4) ellers `ukjent` med årsak.
 *
 * 🔴 ALDRI primærbyggeplass, ALDRI nærmeste-uten-grense, ALDRI `prosjekter[0]`.
 * Når prosjektet har to byggeplasser med punkt og verken sluttsted eller
 * kontekst peker ut én, er svaret `ukjent` — ikke et gjett.
 */
export type Destinasjon =
  | { type: "byggeplass"; byggeplassId: string }
  | {
      type: "ukjent";
      aarsak: "flere_byggeplasser" | "ingen_byggeplass_med_punkt";
    };

export type VelgDestinasjonArgs = {
  sluttsted: Sluttsted;
  kontekstByggeplassId: string | null;
  /** Prosjektets byggeplasser med flagg for om de har et geofence-punkt. */
  prosjektByggeplasser: readonly { id: string; harPunkt: boolean }[];
};

export function velgDestinasjon(args: VelgDestinasjonArgs): Destinasjon {
  if (args.sluttsted.type === "byggeplass") {
    return { type: "byggeplass", byggeplassId: args.sluttsted.byggeplassId };
  }
  if (args.kontekstByggeplassId != null) {
    return { type: "byggeplass", byggeplassId: args.kontekstByggeplassId };
  }
  const medPunkt = args.prosjektByggeplasser.filter((b) => b.harPunkt);
  if (medPunkt.length === 1) {
    return { type: "byggeplass", byggeplassId: medPunkt[0]!.id };
  }
  return {
    type: "ukjent",
    aarsak:
      medPunkt.length === 0
        ? "ingen_byggeplass_med_punkt"
        : "flere_byggeplasser",
  };
}

/**
 * A6 — geofence-grensene, samlet på ÉN kilde som nå BINDER (ikke bare
 * dokumenterer, måling M9/§ 8): API-validatorene `byggeplass.ts` og
 * `oppmotested.ts` importerer radius-spennene herfra. Tallene er UENDRET.
 *
 * Radius-spennene (verifisert 2026-10-02): oppmøtested 10–5000, byggeplass-API
 * 1–100000, modal 25–500. V17 utvider med polygon-/trasé-konstanter.
 */
export const GEOFENCE_GRENSER = {
  oppmotested: { min: 10, max: 5000 },
  byggeplassApi: { min: 1, max: 100_000 },
  modal: { min: 25, max: 500 },
  /** Et polygon må ha minst så mange hjørner (A4/B-3). */
  polygonMinPunkter: 3,
  /** Øvre tak på hjørner pr. sone (ytelse + sync-størrelse). */
  polygonMaksPunkter: 500,
  /** Auto-sirkel over denne radiusen merkes «upresis» (B6). Meter. */
  upresisRadiusM: 1500,
  /** Standard korridorbredde når en kartlinje bufres til sone (B5). Meter. */
  traseKorridorBreddeM: 30,
} as const;
