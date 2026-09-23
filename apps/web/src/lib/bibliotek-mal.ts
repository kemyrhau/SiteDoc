import type { MalObjekt } from "@/components/malbygger/DraggbartFelt";

/**
 * Ett felt i en bibliotekmals `malInnhold` (JSON). Speiler seed-formen
 * (`seed-bibliotek.ts`): { label, type, zone, fase, config } + valgfri
 * required/sortOrder. Sentralarkivet lagrer flat liste (ingen nesting) — fase
 * grupperer, array-rekkefølgen er sorteringen.
 */
export interface BibliotekFelt {
  label: string;
  type: string;
  zone?: string;
  fase?: string | null;
  config?: Record<string, unknown>;
  required?: boolean;
  sortOrder?: number;
}

/** Fasene et felt kan ligge i. `null` = uten fase (vises som egen gruppe). */
export const BIBLIOTEK_FASER = ["FØR", "UNDER", "ETTER"] as const;

/**
 * malInnhold-felt → MalObjekt slik `FeltKonfigurasjon` (malbygger) forventer det.
 * Syntetisk id = indeks i lista (bibliotekfelt har ingen egen id). Flat — parentId
 * alltid null (arkivet nester ikke).
 */
export function feltTilObjekt(felt: BibliotekFelt, indeks: number): MalObjekt {
  return {
    id: `felt-${indeks}`,
    type: felt.type,
    label: felt.label,
    required: felt.required ?? false,
    sortOrder: felt.sortOrder ?? indeks,
    config: felt.config ?? {},
    parentId: null,
  };
}

interface FaseGruppe {
  fase: string | null;
  /** Feltene i fasen, med sin globale indeks i den flate lista. */
  felter: { felt: BibliotekFelt; indeks: number }[];
}

/**
 * Grupper felter etter fase i visningsrekkefølge FØR → UNDER → ETTER → (uten fase).
 * Bevarer den flate array-rekkefølgen innenfor hver fase (= sorteringen).
 * Tomme faser utelates.
 */
export function grupperEtterFase(felter: BibliotekFelt[]): FaseGruppe[] {
  const rekkefolge: (string | null)[] = [...BIBLIOTEK_FASER, null];
  return rekkefolge
    .map((fase) => ({
      fase,
      felter: felter
        .map((felt, indeks) => ({ felt, indeks }))
        .filter(({ felt }) => (felt.fase ?? null) === fase),
    }))
    .filter((g) => g.felter.length > 0);
}

/**
 * Flytt feltet på `indeks` opp/ned BYTTE med nabofeltet i SAMME fase (rekkefølge
 * innenfor fase, spec:629). Fasebytte skjer via dropdown, ikke her. Returnerer ny
 * array; uendret hvis feltet alt er ytterst i sin fase.
 */
export function flyttInnenforFase(
  felter: BibliotekFelt[],
  indeks: number,
  retning: "opp" | "ned",
): BibliotekFelt[] {
  const felt = felter[indeks];
  if (!felt) return felter;
  const fase = felt.fase ?? null;
  // Finn nabo i samme fase i ønsket retning (hopp over felt i andre faser).
  const steg = retning === "opp" ? -1 : 1;
  let naboIndeks = -1;
  for (let i = indeks + steg; i >= 0 && i < felter.length; i += steg) {
    const kandidat = felter[i];
    if (kandidat && (kandidat.fase ?? null) === fase) { naboIndeks = i; break; }
  }
  if (naboIndeks === -1) return felter; // ingen nabo i fasen — alt ytterst
  const kopi = [...felter];
  const a = kopi[indeks];
  const b = kopi[naboIndeks];
  if (!a || !b) return felter;
  kopi[indeks] = b;
  kopi[naboIndeks] = a;
  return kopi;
}
