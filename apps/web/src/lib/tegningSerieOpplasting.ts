import { DRAWING_DISCIPLINES } from "@sitedoc/shared";

/**
 * Serieopplasting av tegninger (T1, R5) + fag-gruppering (R6) + rad-endringsdiff
 * (R4/test 6). Rene funksjoner — ingen React, ingen nettverk injisert utenfra —
 * så de kan testes uten nettleser (spec § 4, test 5 og 6).
 */

export type OpplastetFil = {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export type SerieFilStatus = "laster" | "konverterer" | "klar" | "feilet";

export type SerieResultat<T> =
  | { indeks: number; status: "klar"; resultat: T }
  | { indeks: number; status: "feilet"; feil: string };

/**
 * R5: kjør N oppgaver (opplasting + opprett pr. fil) parallelt, med et tak på
 * samtidige kall. Hver oppgave er uavhengig: en feil på én fil STOPPER IKKE de
 * andre — den fanges og rapporteres som `feilet` med årsak. Kaster aldri selv.
 *
 * `onStatus` kalles ved start («laster») og ved utfall («klar»/«feilet») pr. fil,
 * så tabellen (R4) kan vise fremdrift live.
 */
export async function lastOppSerie<T>(
  antall: number,
  kjørEn: (indeks: number) => Promise<T>,
  opts: {
    maksSamtidig?: number;
    onStatus?: (indeks: number, status: SerieFilStatus, feil?: string) => void;
  } = {},
): Promise<SerieResultat<T>[]> {
  const maks = Math.max(1, opts.maksSamtidig ?? 4);
  const resultater: SerieResultat<T>[] = new Array(antall);
  let neste = 0;

  async function arbeider(): Promise<void> {
    for (;;) {
      const i = neste++;
      if (i >= antall) return;
      opts.onStatus?.(i, "laster");
      try {
        const resultat = await kjørEn(i);
        resultater[i] = { indeks: i, status: "klar", resultat };
        opts.onStatus?.(i, "klar");
      } catch (e) {
        const feil = e instanceof Error ? e.message : "Opplasting feilet";
        resultater[i] = { indeks: i, status: "feilet", feil };
        opts.onStatus?.(i, "feilet", feil);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maks, antall) }, () => arbeider()),
  );
  return resultater;
}

/**
 * R8: foreslå neste revisjonskode. Én bokstav A–Y → neste bokstav; en kode som
 * ender på et tall → tallet +1; ellers kode + "1". Alltid redigerbar i UI-et.
 */
export function nesteRevisjon(gjeldende: string | null | undefined): string {
  const r = (gjeldende || "A").trim().toUpperCase();
  if (/^[A-Y]$/.test(r)) return String.fromCharCode(r.charCodeAt(0) + 1);
  const m = r.match(/^(.*?)(\d+)$/);
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return `${r}1`;
}

/* ------------------------------------------------------------------ */
/*  R6 — fag-gruppering (fag → tegningsnummer)                          */
/* ------------------------------------------------------------------ */

export interface FagGrupperbar {
  id: string;
  name: string;
  discipline?: string | null;
  drawingNumber?: string | null;
}

export interface FagGruppe<T extends FagGrupperbar> {
  fag: string | null; // null = «Uten fag»
  tegninger: T[];
}

/**
 * R6: grupper tegninger etter fag (discipline), sortert innen gruppe på
 * tegningsnummer → navn. Fag uten verdi havner SIST som «Uten fag» (`fag: null`).
 * Kjente fag kommer i `DRAWING_DISCIPLINES`-rekkefølge; ukjente fag alfabetisk
 * etter de kjente, før «Uten fag».
 */
export function grupperTegningerEtterFag<T extends FagGrupperbar>(
  tegninger: T[],
): FagGruppe<T>[] {
  const map = new Map<string | null, T[]>();
  for (const t of tegninger) {
    const fag = t.discipline && t.discipline.trim() !== "" ? t.discipline : null;
    const liste = map.get(fag);
    if (liste) liste.push(t);
    else map.set(fag, [t]);
  }

  const fagRang = (fag: string): number => {
    const i = (DRAWING_DISCIPLINES as readonly string[]).indexOf(fag);
    return i === -1 ? DRAWING_DISCIPLINES.length : i;
  };

  const fag = [...map.keys()].filter((f): f is string => f !== null);
  fag.sort((a, b) => {
    const ra = fagRang(a);
    const rb = fagRang(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, "nb-NO");
  });

  const sorterInnen = (liste: T[]): T[] =>
    [...liste].sort((a, b) => {
      const na = a.drawingNumber ?? "";
      const nb = b.drawingNumber ?? "";
      if (na !== nb) {
        if (na === "") return 1; // tegning uten nummer sist i gruppa
        if (nb === "") return -1;
        return na.localeCompare(nb, "nb-NO", { numeric: true });
      }
      return a.name.localeCompare(b.name, "nb-NO", { numeric: true });
    });

  const grupper: FagGruppe<T>[] = fag.map((f) => ({
    fag: f,
    tegninger: sorterInnen(map.get(f)!),
  }));
  const utenFag = map.get(null);
  if (utenFag) grupper.push({ fag: null, tegninger: sorterInnen(utenFag) });
  return grupper;
}

/* ------------------------------------------------------------------ */
/*  R4 / test 6 — rad-endringsdiff (kun endrede felt)                   */
/* ------------------------------------------------------------------ */

export interface TegningRadFelt {
  name: string;
  drawingNumber: string;
  discipline: string;
  drawingType: string;
  floor: string;
  originator: string;
  scale: string;
}

export type TegningRadEndring = { id: string } & Partial<{
  name: string;
  drawingNumber: string;
  discipline: string;
  drawingType: string;
  floor: string;
  originator: string;
  scale: string;
}>;

/** Tom = null/undefined/blank streng → behandles likt (urørt). */
function erTom(v: string | null | undefined): boolean {
  return v == null || v.trim() === "";
}

/**
 * R4 (test 6): bygg `tegning.oppdater`-input med KUN de feltene brukeren faktisk
 * endret. Et felt som står uendret sendes ALDRI — så en lagring av raden ikke
 * overskriver verdier brukeren ikke rørte. Blank streng på et fritekstfelt som var
 * satt = eksplisitt tømming (sendes som ""). To blanke verdier = ingen endring.
 */
export function byggTegningRadEndring(
  id: string,
  original: Partial<TegningRadFelt>,
  redigert: TegningRadFelt,
): TegningRadEndring {
  const endring: TegningRadEndring = { id };
  const felter: (keyof TegningRadFelt)[] = [
    "name",
    "drawingNumber",
    "discipline",
    "drawingType",
    "floor",
    "originator",
    "scale",
  ];
  // Enum-felt (discipline/drawingType) kan ikke tømmes via `oppdater` (Zod-enum,
  // ikke nullbar) — en tom verdi sendes derfor aldri, bare et bytte til gyldig kode.
  const enumFelter = new Set<keyof TegningRadFelt>(["discipline", "drawingType"]);
  for (const felt of felter) {
    const ny = redigert[felt] ?? "";
    const gammel = original[felt];
    // Begge tomme → urørt. Ellers: ulik trimmet verdi → endret.
    if (erTom(ny) && erTom(gammel)) continue;
    if (erTom(ny) && enumFelter.has(felt)) continue; // kan ikke tømme enum
    if ((ny ?? "").trim() !== (gammel ?? "").trim()) {
      endring[felt] = ny;
    }
  }
  return endring;
}
