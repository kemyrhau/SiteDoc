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

/** Geofence = punkt + radius i meter. A2-kandidater MÅ ha alle tre. */
export type Geofence = GpsPunkt & { radiusM: number };

/** Et gjenkjent sted + målt avstand til det. */
export type Treff<T> = { sted: T; avstandM: number };

/** Jordradius i meter — haversine-grunnlag for A1. */
const JORDRADIUS_M = 6_371_000;

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

/**
 * A2 — nærmeste kandidat der `avstandM ≤ radiusM`.
 *
 * `pos == null` → `null` (ingen GPS → ingen gjenkjenning). Kandidater uten
 * komplett geofence (`lat`/`lng`/`radiusM`) filtreres av KALLEREN; typen krever
 * at de er med. To overlappende kandidater → den nærmeste vinner.
 */
export function gjenkjennSted<T extends Geofence>(
  pos: GpsPunkt | null,
  kandidater: readonly T[],
): Treff<T> | null {
  if (pos == null) return null;
  let beste: Treff<T> | null = null;
  for (const k of kandidater) {
    const m = avstandM(pos, k);
    if (m <= k.radiusM && (beste === null || m < beste.avstandM)) {
      beste = { sted: k, avstandM: m };
    }
  }
  return beste;
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
 * A6 — de tre radius-spennene, navngitt og samlet på ÉN kilde.
 *
 * 🔴 Grensene ENDRES IKKE i lag 1 — de får bare navn. Verifisert mot koden
 * 2026-10-02: oppmøtested `oppmotested.ts:68` (`int().min(10).max(5000)`),
 * byggeplass-API `byggeplass.ts:153` (`int().min(1).max(100000)`), modal
 * `byggeplasser/page.tsx:1400` (glider 25–500, tallfelt opp til 100 000).
 */
export const RADIUS_GRENSER = {
  oppmotested: { min: 10, max: 5000 },
  byggeplassApi: { min: 1, max: 100_000 },
  modal: { min: 25, max: 500 },
} as const;
