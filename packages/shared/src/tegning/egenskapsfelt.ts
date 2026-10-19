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
import { kanMaleVerden, malVerdenArealMm2 } from "./maaling-verden";
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

/** Meter vises ALLTID med to desimaler (RETUR tillegg 2026-10-19: «Mål 6 m»
 * mot Linjal 6,02 m — samme format som Linjal-verktøyet). Millimeter har
 * ingen meningsfull desimal (registeret er allerede heltalls-mm). */
function formatMm(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
  }
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
 * Algebraisk sirkeltilpasning (Kåsa-metoden) til en punktsky. Brukes for
 * dørens/vinduets slagbue (ARC) — `geom` har ingen egen bue-markering (RDP-
 * forenklet til polylinje), så sirkelen må gjenkjennes fra formen. Returnerer
 * radius i SAMME enhet som punktene, eller `null` når punktene ikke er
 * sirkulære nok (RMS-avvik fra beste sirkel > 5 % av radiusen — skiller en
 * ekte bue fra en nesten rett strek med noen få ekstra RDP-knekkpunkt).
 */
function sirkelRadius(punkter: VerdenPunkt[]): number | null {
  const n = punkter.length;
  if (n < 5) return null;
  let sx = 0;
  let sy = 0;
  for (const p of punkter) {
    sx += p.verdenX;
    sy += p.verdenY;
  }
  const mx = sx / n;
  const my = sy / n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const p of punkter) {
    const u = p.verdenX - mx;
    const v = p.verdenY - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const nevner = suu * svv - suv * suv;
  if (Math.abs(nevner) < 1e-9) return null;
  const hoyreUc = (suuu + suvv) / 2;
  const hoyreVc = (svvv + svuu) / 2;
  const uc = (hoyreUc * svv - hoyreVc * suv) / nevner;
  const vc = (hoyreVc * suu - hoyreUc * suv) / nevner;
  const r2 = uc * uc + vc * vc + (suu + svv) / n;
  if (r2 <= 0) return null;
  const r = Math.sqrt(r2);
  let avvikKvadratSum = 0;
  for (const p of punkter) {
    const d = Math.hypot(p.verdenX - mx - uc, p.verdenY - my - vc);
    const avvik = d - r;
    avvikKvadratSum += avvik * avvik;
  }
  const rms = Math.sqrt(avvikKvadratSum / n);
  return rms <= r * 0.05 ? r : null;
}

/**
 * Dør/vindu-bredde PRIORITET 3: slagbuens (ARC) radius, "målt fra geometri"
 * (RETUR tillegg, orkestrator 2026-10-19 — ERSTATTER den tidligere "lengste
 * segment"-regelen: spec § 9.3 sier dette ALDRI skal brukes, en diagonal
 * "wall break"-linje er ikke bredden). Segmenter med ≥5 punkter som
 * `sirkelRadius()` godtar som en reell sirkel regnes som en svingbue.
 * Dobbeldør: to separate buer i samme blokk -> summer de to STØRSTE radiene
 * (ordrens regel) — små dekor-kurver er alltid mindre enn en reell dørsving.
 */
function beregnSlagbueRadiusMm(o: RegisterVerdenObjekt, mmPr: number): number {
  if (!o.geom) return 0;
  const radier: number[] = [];
  for (const seg of o.geom) {
    if (!seg || seg.length < 10) continue;
    const r = sirkelRadius(geomTilVerdenPunkter(seg));
    if (r !== null && r > 0) radier.push(r * mmPr);
  }
  if (radier.length === 0) return 0;
  radier.sort((a, b) => b - a);
  return radier.length === 1 ? radier[0]! : radier[0]! + radier[1]!;
}

/**
 * Dør/vindu-mål (RETUR tillegg, orkestrator 2026-10-19 — ERSTATTER
 * dørregelen i SVAR 6238de93): ny prioritet (1) bredde-attributt/Revit-type
 * → (2) blokkens egen nestede dørmerking («1 090x2 090»-stempelet, lest i
 * render.py, se `merkingBreddeMm`/`merkingHoydeMm` i objektmodellen) → (3)
 * slagbuens radius → (4) ingenting. Kun (2) og (3) er inferert/tolket —
 * attributtet er en ekte verdi fra tegningen.
 */
function beregnDoerVinduMaal(
  o: RegisterVerdenObjekt,
  mmPr: number,
  t: (nokkel: string) => string,
): { verdi: string; tolket?: boolean } | null {
  const breddeAttr = o.attr?.WIDTH ?? o.attr?.BREDDE;
  if (breddeAttr) {
    const tall = parseFloat(breddeAttr.replace(",", "."));
    if (Number.isFinite(tall) && tall > 0) return { verdi: formatMm(tall) };
  }
  if (o.merkingBreddeMm && o.merkingHoydeMm) {
    const bredde = `${t("tegningsvelger.egenskaper.bredde")} ${formatMm(o.merkingBreddeMm)}`;
    const hoyde = `${t("tegningsvelger.egenskaper.hoyde")} ${formatMm(o.merkingHoydeMm)}`;
    return { verdi: `${bredde} · ${hoyde} (${t("tegningsvelger.egenskaper.fraMerking")})`, tolket: true };
  }
  const radiusMm = beregnSlagbueRadiusMm(o, mmPr);
  return radiusMm > 0 ? { verdi: formatMm(radiusMm), tolket: true } : null;
}

/** Isolasjonsobjekter (render.py: lag/HATCH-mønster inneholder "isol", ELLER
 * HATCH-mønsternavnet står i MATERIALE-tabellen med verdien "Isolasjon" — f.eks.
 * "Skrålinjer_2", verifisert mot EKTE fallplan-DXF der "isol" aldri forekommer,
 * SVAR dda4110b 2026-10-18 — `materiale` settes EKSAKT til denne strengen) — for
 * dem viser "Mål" TYKKELSEN, ikke lengden (POST flytte målepunkter, orkestrator
 * 2026-10-18, pkt 4d). */
const ER_ISOLASJON_MATERIALE = "Isolasjon";

interface LengdeOgTykkelseMm {
  lengdeMm: number;
  tykkelseMm: number;
}

/**
 * Lengste akse (hovedretning) og korteste akse (vinkelrett på den) for en sky av
 * verdenspunkter, via PCA på kovariansmatrisen — robust uavhengig av DXF-ens
 * rotasjon (en vegg på 40° måles like riktig som en aksejevn). `max-min`-utstrekning
 * langs hver akse, i mm. < 2 punkter → begge 0.
 */
function beregnAkslerMm(punkter: VerdenPunkt[], mmPrVerdenEnhet: number): LengdeOgTykkelseMm {
  if (punkter.length < 2) return { lengdeMm: 0, tykkelseMm: 0 };
  const n = punkter.length;
  let sx = 0;
  let sy = 0;
  for (const p of punkter) {
    sx += p.verdenX;
    sy += p.verdenY;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of punkter) {
    const dx = p.verdenX - mx;
    const dy = p.verdenY - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const lang = { x: Math.cos(theta), y: Math.sin(theta) };
  const kort = { x: -lang.y, y: lang.x };
  let langMin = Infinity;
  let langMax = -Infinity;
  let kortMin = Infinity;
  let kortMax = -Infinity;
  for (const p of punkter) {
    const dx = p.verdenX - mx;
    const dy = p.verdenY - my;
    const pLang = dx * lang.x + dy * lang.y;
    const pKort = dx * kort.x + dy * kort.y;
    if (pLang < langMin) langMin = pLang;
    if (pLang > langMax) langMax = pLang;
    if (pKort < kortMin) kortMin = pKort;
    if (pKort > kortMax) kortMax = pKort;
  }
  return {
    lengdeMm: (langMax - langMin) * mmPrVerdenEnhet,
    tykkelseMm: (kortMax - kortMin) * mmPrVerdenEnhet,
  };
}

/** Konveks hull (Andrew's monotone chain), CCW, uten duplisert siste punkt. */
function konvekstHull(punkter: VerdenPunkt[]): VerdenPunkt[] {
  const pts = [...punkter].sort((a, b) => a.verdenX - b.verdenX || a.verdenY - b.verdenY);
  const kryss = (o: VerdenPunkt, a: VerdenPunkt, b: VerdenPunkt): number =>
    (a.verdenX - o.verdenX) * (b.verdenY - o.verdenY) - (a.verdenY - o.verdenY) * (b.verdenX - o.verdenX);
  const nedre: VerdenPunkt[] = [];
  for (const p of pts) {
    while (nedre.length >= 2 && kryss(nedre[nedre.length - 2]!, nedre[nedre.length - 1]!, p) <= 0) nedre.pop();
    nedre.push(p);
  }
  const ovre: VerdenPunkt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (ovre.length >= 2 && kryss(ovre[ovre.length - 2]!, ovre[ovre.length - 1]!, p) <= 0) ovre.pop();
    ovre.push(p);
  }
  nedre.pop();
  ovre.pop();
  return nedre.concat(ovre);
}

/**
 * Minste bredde av en punktsky via konveks hull + "rotating calipers" (RETUR
 * isolasjon `7d5d6787`, orkestrator 2026-10-18 pkt 1): PCA-korteste-akse i
 * `beregnAkslerMm` blåses opp av isolasjonsbåndets skrå endeavslutninger (målt:
 * 104 mm der Linjal ga 100 mm). Teoremet for konvekse polygon: minste bredde er
 * ALLTID vinkelrett på en av kantene — projiser alle hullpunkter på hver kants
 * normal, ta max-min pr. kant, returner minste. Robust mot skrå ender fordi
 * minimum alltid oppstår langs de to lange, parallelle kantene, uansett hvordan
 * endestykkene er skåret.
 */
function beregnMinimumBreddeMm(punkter: VerdenPunkt[], mmPrVerdenEnhet: number): number {
  const hull = konvekstHull(punkter);
  if (hull.length < 3) return 0;
  let minBredde = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const dx = b.verdenX - a.verdenX;
    const dy = b.verdenY - a.verdenY;
    const lengde = Math.hypot(dx, dy);
    if (lengde === 0) continue;
    const nx = -dy / lengde;
    const ny = dx / lengde;
    let projMin = Infinity;
    let projMax = -Infinity;
    for (const p of hull) {
      const proj = p.verdenX * nx + p.verdenY * ny;
      if (proj < projMin) projMin = proj;
      if (proj > projMax) projMax = proj;
    }
    const bredde = projMax - projMin;
    if (bredde < minBredde) minBredde = bredde;
  }
  return minBredde === Infinity ? 0 : minBredde * mmPrVerdenEnhet;
}

/** Et konvekst hull lengde/bredde > denne terskelen regnes som «langt og
 * smalt» — viser Tykkelse+Lengde (calipers) uansett dtype/materiale (RETUR
 * tillegg 2026-10-19, bildet `67abf924`: en bølge-/sikksakk-POLYLINE for
 * isolasjon på et ordinært vegglag, ikke HATCH — "regelen skal gjelde
 * formen, ikke typen"). */
const BOLGELINJE_FORHOLD_TERSKEL = 8;

/** F1 felt 6: lengde (strek), tykkelse (isolasjon/bølgelinje) eller areal (lukket
 * flate), kun når `kanMaleVerden`. `underverdi` brukes til å vise den ANDRE
 * målestørrelsen når begge er meningsfulle (tykkelse ved siden av lengden). */
function beregnMaal(
  o: RegisterVerdenObjekt,
  mmPrVerdenEnhet: number | null | undefined,
  t: (nokkel: string) => string,
): { verdi: string; underverdi?: string; tolket?: boolean } | null {
  if (!kanMaleVerden(mmPrVerdenEnhet)) return null;
  const mmPr = mmPrVerdenEnhet as number;
  if (o.dtype === "INSERT" && o.blokk && DOER_VINDU_BLOKK.test(o.blokk)) {
    return beregnDoerVinduMaal(o, mmPr, t);
  }
  if (!o.geom || o.geom.length === 0) return null;
  // Isolasjon (kjent materiale) FØR flate-arealet (RETTET, SVAR dda4110b
  // 2026-10-18): isolasjonens HATCH-mønster ("Skrålinjer_2" m.fl., se
  // MATERIALE-tabellen i render.py) har dtype "HATCH", som ellers havner i
  // FLATE_DTYPE-arealgrenen under — isolasjon skal ALDRI vise areal, kun
  // tykkelse. Sjekkes derfor FØRST, uavhengig av dtype. Dette er en BEKREFTET
  // klassifisering (ikke tolket) — i motsetning til formgjenkjenningen under.
  if (o.materiale === ER_ISOLASJON_MATERIALE) {
    const allePunkter = o.geom.flatMap((seg) => (seg && seg.length >= 4 ? geomTilVerdenPunkter(seg) : []));
    if (allePunkter.length < 2) return null;
    const { lengdeMm } = beregnAkslerMm(allePunkter, mmPr);
    const tykkelseMm = beregnMinimumBreddeMm(allePunkter, mmPr);
    if (tykkelseMm <= 0) return null;
    const underverdi = lengdeMm > 0 ? `${t("tegningsvelger.egenskaper.lengde")} ${formatMm(lengdeMm)}` : undefined;
    return { verdi: `${t("tegningsvelger.egenskaper.tykkelse")} ${formatMm(tykkelseMm)}`, underverdi };
  }
  // Alle punkter på tvers av ALLE segmenter i geom — `geom[0]` alene kan være en
  // veggs korteste tverr-tagg (RETUR, Kenneths telefontest: "Mål 13 mm" på en vegg).
  const allePunkter = o.geom.flatMap((seg) => (seg && seg.length >= 4 ? geomTilVerdenPunkter(seg) : []));
  // Formgjenkjenning (tolket, IKKE en kjent klassifisering): langt og smalt
  // konvekst omriss viser tykkelse+lengde uansett dtype — fanger isolasjon
  // tegnet som vanlig linje/polyline, ikke bare HATCH med kjent mønsternavn.
  if (allePunkter.length >= 3) {
    const { lengdeMm } = beregnAkslerMm(allePunkter, mmPr);
    const tykkelseMm = beregnMinimumBreddeMm(allePunkter, mmPr);
    if (tykkelseMm > 0 && lengdeMm / tykkelseMm > BOLGELINJE_FORHOLD_TERSKEL) {
      const underverdi = `${t("tegningsvelger.egenskaper.lengde")} ${formatMm(lengdeMm)}`;
      return { verdi: `${t("tegningsvelger.egenskaper.tykkelse")} ${formatMm(tykkelseMm)}`, underverdi, tolket: true };
    }
  }
  if (FLATE_DTYPE.has(o.dtype)) {
    const forsteLinje = o.geom[0];
    if (!forsteLinje || forsteLinje.length < 4) return null;
    const punkter = geomTilVerdenPunkter(forsteLinje);
    const arealMm2 = malVerdenArealMm2(punkter, mmPr);
    return arealMm2 > 0 ? { verdi: formatM2(arealMm2) } : null;
  }
  if (allePunkter.length < 2) return null;
  const { lengdeMm } = beregnAkslerMm(allePunkter, mmPr);
  return lengdeMm > 0 ? { verdi: formatMm(lengdeMm) } : null;
}

/**
 * O2 (§ 8): bygg egenskapsfelt fra et O1-objekt, i F1 § 3 sin feltrekkefølge — kun
 * feltene som faktisk har verdi. `mmPrVerdenEnhet` kommer fra tegningens skala
 * (samme kilde som måleverktøyet); uten den utelates felt 6 (Mål) helt. `t` brukes
 * KUN for isolasjonens tykkelse/lengde-etiketter (pakken er ellers i18n-fri — samme
 * `t`-callback-mønster som `grenseSjekk.ts`), ikke for de andre feltenes råverdier.
 */
export function byggEgenskapsfelt(
  o: RegisterVerdenObjekt,
  mmPrVerdenEnhet: number | null | undefined,
  t: (nokkel: string) => string,
): EgenskapsFelt[] {
  const felt: EgenskapsFelt[] = [];

  // 1. Hva — kategori, med rå lagnavn som underverdi.
  if (o.kategori) felt.push({ nokkel: "hva", verdi: renskUnderstrek(o.kategori), underverdi: o.lag });

  // 2. Type/størrelse — blokknavn + Revit type-id. Anonyme AutoCAD-blokknavn
  // ("*X976") skjules — Kenneth leser dem ikke som en identitet (RETUR, pkt 4b).
  const typeDeler = [o.blokk, o.typeId].filter((d): d is string => !!d && !d.startsWith("*"));
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
  const maal = beregnMaal(o, mmPrVerdenEnhet, t);
  if (maal) felt.push({ nokkel: "mal", verdi: maal.verdi, underverdi: maal.underverdi, tolket: maal.tolket });

  // 7. Status.
  if (o.status) felt.push({ nokkel: "status", verdi: o.status });

  // 8. Linjetype — render.py setter `linjetype` KUN når den avviker fra laget
  // (BYLAYER-verdien skjules allerede server-side, se bygg_objektregister()).
  if (o.linjetype) felt.push({ nokkel: "linjetype", verdi: o.linjetype });

  // 9. Id — Revit element-id foretrukket (stabil på tvers av tegninger), ellers DXF-handle.
  felt.push({ nokkel: "id", verdi: o.elid ?? o.id });

  return felt;
}
