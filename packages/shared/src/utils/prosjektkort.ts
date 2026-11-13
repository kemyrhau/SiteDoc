/**
 * Prosjektkort L1/L2 (2026-11-05): rene utledninger for samlesiden i
 * prosjektkort-modus. Kortet er en VISNING over samme `DailySheet` (modell A) —
 * ingen ny lagring. Tallene her følger spec-prosjektkort § 3.1: erstattede rader
 * (`attestertStatus = "erstattet"`, attestørens korreksjon har tatt over) telles
 * aldri, reise skilles fra arbeid via `erReise`. Delt mellom web og mobil (L2)
 * så kortsummene er identiske på begge flater.
 */

export type TimerModus = "dagskort" | "prosjektkort";

/** Ukjent/manglende verdi → dagskort (default, gamle klienter). */
export function lesTimerModus(verdi: string | null | undefined): TimerModus {
  return verdi === "prosjektkort" ? "prosjektkort" : "dagskort";
}

type Tall = unknown;

export type KortTimerRad = {
  projectId: string;
  byggeplassId: string | null;
  timer: Tall;
  erReise?: boolean;
  attestertStatus: string | null;
};

export type KortMaskinRad = {
  projectId: string;
  byggeplassId: string | null;
  timer: Tall;
  attestertStatus: string | null;
};

export type KortVareLinje = {
  projectId: string;
  antall: number;
  vare: { enhet: string };
};

function tilTall(v: Tall): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  if (v && typeof v === "object" && "toString" in v) {
    return parseFloat(String(v)) || 0;
  }
  return 0;
}

const gjelder = (r: { attestertStatus: string | null }) =>
  r.attestertStatus !== "erstattet";

/** Varekolonnen: én enhet → summert mengde; ulike enheter → antall linjer. */
export type VareSum =
  | { type: "mengde"; antall: number; enhet: string }
  | { type: "linjer"; antall: number }
  | null;

export type KortSummer = {
  arbeid: number;
  maskin: number;
  reise: number;
  varer: VareSum;
};

export function beregnKortSummer(
  timer: readonly KortTimerRad[],
  maskin: readonly KortMaskinRad[],
  varer: readonly KortVareLinje[],
): KortSummer {
  let arbeid = 0;
  let reise = 0;
  for (const r of timer) {
    if (!gjelder(r)) continue;
    if (r.erReise) reise += tilTall(r.timer);
    else arbeid += tilTall(r.timer);
  }
  const maskinSum = maskin
    .filter(gjelder)
    .reduce((acc, r) => acc + tilTall(r.timer), 0);

  let vareSum: VareSum = null;
  if (varer.length > 0) {
    const enheter = new Set(varer.map((v) => v.vare.enhet));
    vareSum =
      enheter.size === 1
        ? {
            type: "mengde",
            antall: varer.reduce((acc, v) => acc + v.antall, 0),
            enhet: varer[0]!.vare.enhet,
          }
        : { type: "linjer", antall: varer.length };
  }
  return { arbeid, maskin: maskinSum, reise, varer: vareSum };
}

/** «Sum i dag» = alle timer-rader (arbeid + reise) som ikke er erstattet. */
export function sumIDag(timer: readonly KortTimerRad[]): number {
  return timer.filter(gjelder).reduce((acc, r) => acc + tilTall(r.timer), 0);
}

/** Σ maskin- eller reisetimer for hele dagen (bunnlinja). */
export function dagSummer(
  timer: readonly KortTimerRad[],
  maskin: readonly KortMaskinRad[],
): { maskin: number; reise: number } {
  const s = beregnKortSummer(timer, maskin, []);
  return { maskin: s.maskin, reise: s.reise };
}

export type KortByggeplass =
  | { type: "ingen" }
  | { type: "en"; id: string }
  | { type: "flere"; antall: number };

/**
 * Prosjektsjekk for arv: med `arv` satt teller sedelens byggeplass bare for
 * rader uten egen når den hører til kortets prosjekt (samme regel som webens
 * `radByggeplassLinje`). Ukjent byggeplass teller ikke. Uten `arv`: dagens
 * oppførsel (arv uten sjekk).
 */
export interface KortByggeplassArv {
  projectId: string;
  byggeplassProsjekt: (byggeplassId: string) => string | null | undefined;
}

/**
 * Distinkt byggeplass over kortets timer- og maskinrader. Rad uten egen
 * byggeplass arver sedelens (`null` = dagens byggeplass). Erstattede rader
 * teller ikke.
 */
export function utledKortByggeplass(
  rader: readonly { byggeplassId: string | null; attestertStatus: string | null }[],
  sedelByggeplassId: string | null,
  arv?: KortByggeplassArv,
): KortByggeplass {
  const arvGjelder =
    sedelByggeplassId != null &&
    (!arv || arv.byggeplassProsjekt(sedelByggeplassId) === arv.projectId);
  const ider = new Set<string>();
  for (const r of rader) {
    if (!gjelder(r)) continue;
    const id = r.byggeplassId ?? (arvGjelder ? sedelByggeplassId : null);
    if (id) ider.add(id);
  }
  if (ider.size === 0) return { type: "ingen" };
  if (ider.size === 1) return { type: "en", id: [...ider][0]! };
  return { type: "flere", antall: ider.size };
}

/** Kortets merke: én returnert rad → «Returnert»; alle attestert → «Attestert». */
export function kortStatus(
  rader: readonly { attestertStatus: string | null }[],
): "returnert" | "attestert" | null {
  const aktuelle = rader.filter(gjelder);
  if (aktuelle.some((r) => r.attestertStatus === "returnert")) return "returnert";
  if (
    aktuelle.length > 0 &&
    aktuelle.every((r) => r.attestertStatus === "attestert")
  ) {
    return "attestert";
  }
  return null;
}

/**
 * Trafikklys for dagsummen relativt til dagsnorm — samme regel som dagskortets
 * topp-sum (rund kun for farge, nærmeste 15 min).
 */
export function trafikklysSone(
  registrert: number,
  norm: number | null,
): "grå" | "grønn" | "gul" | "blå" {
  if (norm === null) return "grå";
  const rundet = Math.round(registrert * 4) / 4;
  if (Math.abs(rundet - norm) < 0.001) return "grønn";
  return rundet > norm ? "gul" : "blå";
}

/* ------------------------------------------------------------------ */
/*  L3 (2026-11-06): vareforbruk fra kortet — delt web/mobil.          */
/* ------------------------------------------------------------------ */

/** «+ Vareforbruk» vises kun i et redigerbart kort der Varelager er på for prosjektet. */
export function visVareforbrukKnapp(args: {
  prosjektIderMedVarelager: readonly string[] | null | undefined;
  projectId: string;
  erRedigerbar: boolean;
}): boolean {
  return (
    args.erRedigerbar &&
    (args.prosjektIderMedVarelager ?? []).includes(args.projectId)
  );
}

/**
 * Sedel-koblingen for en ny varelinje. API-et (`vareforbruk.opprett`) avviser
 * en `dagsseddelId` uten timerrad for samme prosjekt — et kort med bare maskin
 * eller tillegg fører derfor linjen uten kobling (som på prosjektsiden).
 */
export function kortDagsseddelId(
  sedelId: string,
  timer: readonly { projectId: string }[],
  projectId: string,
): string | undefined {
  return timer.some((r) => r.projectId === projectId) ? sedelId : undefined;
}

export type KortVareforbrukInput = {
  id?: string;
  projectId: string;
  dato: string;
  vareId: string;
  antall: number;
  byggeplassId: string | null;
  /** ORDRE 36b: kortets underprosjekt — sendes kun når kortet har ett. */
  externalCostObjectId?: string;
  dagsseddelId?: string;
  /** Radform (2026-11-12): timerraden varen er ført fra — kun sammen med `dagsseddelId`. */
  sheetTimerId?: string;
};

/** Opprett-input fra kortet. Prosjektet (og underprosjektet, 36b) er alltid kortets — kan ikke velges. */
export function kortVareforbrukInput(args: {
  kortProsjektId: string;
  dato: string;
  vareId: string;
  antall: number;
  byggeplassId: string | null;
  externalCostObjectId?: string | null;
  dagsseddelId?: string;
  sheetTimerId?: string | null;
  id?: string;
}): KortVareforbrukInput {
  return {
    ...(args.id ? { id: args.id } : {}),
    projectId: args.kortProsjektId,
    dato: args.dato,
    vareId: args.vareId,
    antall: args.antall,
    byggeplassId: args.byggeplassId,
    ...(args.externalCostObjectId ? { externalCostObjectId: args.externalCostObjectId } : {}),
    ...(args.dagsseddelId ? { dagsseddelId: args.dagsseddelId } : {}),
    ...(args.dagsseddelId && args.sheetTimerId ? { sheetTimerId: args.sheetTimerId } : {}),
  };
}

/**
 * Server-linjer + lokale (ikke synket) i én liste. En lokal linje som alt er
 * synket har samme id som server-raden (klient-id) → telles én gang.
 */
export function slaaSammenVarelinjer<T extends { id: string }>(
  server: readonly T[],
  lokale: readonly T[],
): T[] {
  const kjente = new Set(server.map((v) => v.id));
  return [...server, ...lokale.filter((v) => !kjente.has(v.id))];
}
