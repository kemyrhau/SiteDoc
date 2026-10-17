// O2 — felles egenskapskort-feltmapping (spec § 8). Ren funksjon: O1-objekt (F1
// § 3 sin feltrekkefølge) → en liste av rader, kun feltene som faktisk har verdi.
//
// Bygget for de to NYE panelene denne leveransen gir (dxf-viewer web+mobil) — IKKE
// koblet til 3D-kortet (`EgenskapsPopup`) i denne runden (orkestrator-avklaring A,
// 2026-10-17: "bygg O2-feltlogikken nå ... rør ikke 3D-kortene i denne runden" —
// migrering av 3D til samme funksjon blir en egen, liten oppfølgerordre). Signaturen
// tar derfor med vilje bare `RegisterVerdenObjekt` (2D-DWG-adapter) — en fremtidig
// IFC-adapter mapper til SAMME `EgenskapsFelt`-type uten å endre den.

import type { RegisterVerdenObjekt } from "./objektmodell";
import { kanMaleVerden, malVerdenArealMm2, malVerdenPolylinjeMm } from "./maaling-verden";
import type { VerdenPunkt } from "./kamera-projeksjon";

export type EgenskapsFeltNokkel =
  | "hva"
  | "typeStorrelse"
  | "rom"
  | "materiale"
  | "tekst"
  | "naermesteMerking"
  | "mal"
  | "status"
  | "linjetype"
  | "id";

export interface EgenskapsFelt {
  nokkel: EgenskapsFeltNokkel;
  /** Verdi, allerede formatert (tall ferdig rundet/enhet lagt på). */
  verdi: string;
  /** Underverdi vist mindre/svakere under hovedverdien (F1: rå lagnavn, rå skravurnavn). */
  underverdi?: string;
  /** Tolket/utledet, ikke objektets egen verdi — vises visuelt annerledes (F1 felt 1 fallback, 5b). */
  tolket?: boolean;
}

const FLATE_DTYPE = new Set(["HATCH", "SOLID"]);

/** Dør/vindu-blokk (INSERT) — kjent AIA/IFC-konvensjon i blokknavnet. */
const DOER_VINDU_BLOKK = /dør|door|window|vindu/i;

/**
 * RETUR F1+F2 web r2 (Kenneth): rått ArchiCAD-lagnavn bruker understrek der
 * tegningen egentlig mener komma ("Vinduer_ dører_ foldevegger" -> "Vinduer,
 * dører, foldevegger") — samme normalisering lagpanelets gruppenavn allerede
 * viser via NS3451-tabellen. Trailing komma (understrek på slutten) fjernes.
 */
function renskUnderstrek(s: string): string {
  return s.replace(/_+\s*/g, ", ").replace(/,\s*$/, "").trim();
}

function formatMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toLocaleString("nb-NO", { maximumFractionDigits: 2 })} m`;
  return `${mm.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} mm`;
}

function formatM2(mm2: number): string {
  const m2 = mm2 / 1_000_000;
  return `${m2.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

function geomTilVerdenPunkter(flat: number[]): VerdenPunkt[] {
  const punkter: VerdenPunkt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    punkter.push({ verdenX: flat[i]!, verdenY: flat[i + 1]! });
  }
  return punkter;
}

/**
 * Dør/vindu-bredde (RETUR F1+F2 web r2, Kenneth): et viste "Mål 42 mm" på en
 * dør — `beregnMaal()` sitt `geom[0]` er for et INSERT bare det FØRSTE av
 * flere oppsporede strek-segmenter (ofte en liten hjørne-tagg et par mm,
 * ikke åpningsbredden). Foretrukket kilde: bredde-attributt/Revit-type når
 * den finnes; ellers det LENGSTE segmentet i blokkens egen geometri (målt på
 * fallplanen: de to diagonale "wall break"-linjene som spenner hele
 * åpningen er lengst, korte tagger ved hver jamb er det ikke). Uten en
 * pålitelig kilde vises ikke "Mål" — bedre enn et misvisende tall.
 */
function beregnDoerVinduBredde(o: RegisterVerdenObjekt, mmPr: number): string | null {
  const breddeAttr = o.attr?.WIDTH ?? o.attr?.BREDDE;
  if (breddeAttr) {
    const tall = parseFloat(breddeAttr.replace(",", "."));
    if (Number.isFinite(tall) && tall > 0) return formatMm(tall);
  }
  if (!o.geom || o.geom.length === 0) return null;
  let lengste = 0;
  for (const seg of o.geom) {
    if (!seg || seg.length < 4) continue;
    const lengdeMm = malVerdenPolylinjeMm(geomTilVerdenPunkter(seg), mmPr);
    if (lengdeMm > lengste) lengste = lengdeMm;
  }
  return lengste > 0 ? formatMm(lengste) : null;
}

/** F1 felt 6: lengde (strek) eller areal (lukket flate), kun når `kanMaleVerden`. */
function beregnMaal(o: RegisterVerdenObjekt, mmPrVerdenEnhet: number | null | undefined): string | null {
  if (!kanMaleVerden(mmPrVerdenEnhet)) return null;
  const mmPr = mmPrVerdenEnhet as number;
  if (o.dtype === "INSERT" && o.blokk && DOER_VINDU_BLOKK.test(o.blokk)) {
    return beregnDoerVinduBredde(o, mmPr);
  }
  if (!o.geom || o.geom.length === 0) return null;
  const forsteLinje = o.geom[0];
  if (!forsteLinje || forsteLinje.length < 4) return null;
  const punkter = geomTilVerdenPunkter(forsteLinje);
  if (FLATE_DTYPE.has(o.dtype)) {
    const arealMm2 = malVerdenArealMm2(punkter, mmPr);
    return arealMm2 > 0 ? formatM2(arealMm2) : null;
  }
  const lengdeMm = malVerdenPolylinjeMm(punkter, mmPr);
  return lengdeMm > 0 ? formatMm(lengdeMm) : null;
}

/**
 * O2 (§ 8): bygg egenskapsfelt fra et O1-objekt, i F1 § 3 sin feltrekkefølge — kun
 * feltene som faktisk har verdi. `mmPrVerdenEnhet` kommer fra tegningens skala
 * (samme kilde som måleverktøyet); uten den utelates felt 6 (Mål) helt.
 */
export function byggEgenskapsfelt(
  o: RegisterVerdenObjekt,
  mmPrVerdenEnhet?: number | null,
): EgenskapsFelt[] {
  const felt: EgenskapsFelt[] = [];

  // 1. Hva — kategori, med rå lagnavn som underverdi.
  if (o.kategori) felt.push({ nokkel: "hva", verdi: renskUnderstrek(o.kategori), underverdi: o.lag });

  // 2. Type/størrelse — blokknavn + Revit type-id.
  const typeDeler = [o.blokk, o.typeId].filter((d): d is string => !!d);
  if (typeDeler.length) felt.push({ nokkel: "typeStorrelse", verdi: typeDeler.join(" · ") });

  // 3. Rom/blokk — ROOM_NAME/ROOM_NUMBER-attributter.
  const romNavn = o.attr?.ROOM_NAME;
  const romNummer = o.attr?.ROOM_NUMBER;
  if (romNavn || romNummer) {
    felt.push({ nokkel: "rom", verdi: [romNavn, romNummer].filter(Boolean).join(" · ") });
  }

  // 4. Materiale — kjent mapping; rått mønsternavn vises som tolket når ukjent.
  if (o.materiale) {
    felt.push({ nokkel: "materiale", verdi: o.materiale });
  } else if (o.materialeRaa) {
    felt.push({ nokkel: "materiale", verdi: o.materialeRaa, tolket: true });
  }

  // 5. Tekst — egen TEXT/MTEXT, ellers øvrige (ikke-rom) blokkattributter.
  if (o.tekst) {
    felt.push({ nokkel: "tekst", verdi: o.tekst });
  } else if (o.attr) {
    const ovrige = Object.entries(o.attr).filter(([tag]) => tag !== "ROOM_NAME" && tag !== "ROOM_NUMBER");
    if (ovrige.length) felt.push({ nokkel: "tekst", verdi: ovrige.map(([, v]) => v).join(" · ") });
  }

  // 5b. Nærmeste merking — ALLTID tolket, aldri objektets egen verdi (AT-F10).
  if (o.naermesteMerking) {
    felt.push({ nokkel: "naermesteMerking", verdi: o.naermesteMerking, tolket: true });
  }

  // 6. Mål.
  const maal = beregnMaal(o, mmPrVerdenEnhet);
  if (maal) felt.push({ nokkel: "mal", verdi: maal });

  // 7. Status.
  if (o.status) felt.push({ nokkel: "status", verdi: o.status });

  // 8. Linjetype — render.py setter `linjetype` KUN når den avviker fra laget
  // (BYLAYER-verdien skjules allerede server-side, se bygg_objektregister()).
  if (o.linjetype) felt.push({ nokkel: "linjetype", verdi: o.linjetype });

  // 9. Id — Revit element-id foretrukket (stabil på tvers av tegninger), ellers DXF-handle.
  felt.push({ nokkel: "id", verdi: o.elid ?? o.id });

  return felt;
}
