// Måling (Linjal/Polylinje/Areal) + 90°-lås/snap for dxf-viewer-grenen (WebGL), i DXF-
// VERDENSKOORDINATER (plan § 12, "POST: mobil leveranse 3+4", relay/inbox-orkestrator.md).
//
// `packages/shared/src/utils/maaling.ts` regner på PAPIR-modellen (prosent av vist bilde
// + mm/piksel + målestokk-nevner) — den modellen gjelder ikke her: `dxf-viewer` har ingen
// "bilde", kun DXF-verdenskoordinater som ER virkelige lengder så snart $INSUNITS er kjent
// (ingen papir-målestokk å dele med). Derfor en egen, enklere fil: verdensrommet er
// ISOTROPT (x og y har samme skala, i motsetning til prosent-av-bilde-rommet, som er
// strukket av bildets sideforhold) — vinkel-/projeksjonsmatten trenger ingen
// piksel-space-omregning (`tilPiksel`/`tilProsent` i maaling.ts).
//
// Snap/lås-ALGORITMEN speiler likevel EKSAKT `laasDetaljer`/`snapTilPunkt`/`snapTil90Linje`/
// `beregnSnap` i maaling.ts (samme presedens, samme formler) — rettes en bug i en av dem,
// sjekk den andre.
//
// `insunitsTilMm`/`lesInsunits`-paret speiler `apps/api/src/services/dwgKonvertering.ts`
// (samme tabell som `apps/api/src/services/ezdxf/render.py`) — et bevisst MIRROR (samme
// mønster som `packages/pdf` sine speil av `maaling.ts`/`opsjon.ts`/`signaturVerdi.ts`),
// ikke en import av `apps/api` inn i `packages/shared`. Leses klient-side (web + mobil-
// WebView) rett fra den allerede nedlastede DXF-blob-teksten — ingen ny DB-kolonne, ingen
// ny nettverksrunde.

import type { DxfKameraParametre, SkjermPunkt, VerdenPunkt } from "./kamera-projeksjon";
import { skjermTilVerden, verdenTilSkjerm } from "./kamera-projeksjon";

// =============================================================================
// $INSUNITS → mm/enhet (speil av apps/api/src/services/dwgKonvertering.ts).
// =============================================================================

/** mm pr. DXF-verdensenhet for en kjent `$INSUNITS`-kode. Ukjent/0 → null. */
export function insunitsTilMm(insunits: number | undefined | null): number | null {
  switch (insunits) {
    case 1: return 25.4; // tommer
    case 2: return 304.8; // fot
    case 4: return 1; // mm
    case 5: return 10; // cm
    case 6: return 1000; // m
    default: return null; // 0/ukjent/udefinert
  }
}

/**
 * Les `$INSUNITS` fra DXF-headeren via rå-tekst-skann (speil av `lesInsunits` i
 * `dwgKonvertering.ts` — se den for begrunnelsen). `$INSUNITS` etterfølges av
 * gruppekode 70 og verdien. Fant ikke → null (ukjent enhet).
 */
export function lesInsunitsFraDxfTekst(dxfInnhold: string): number | null {
  const linjer = dxfInnhold.split("\n");
  for (let i = 0; i < linjer.length - 1; i++) {
    if (linjer[i]!.trim() !== "$INSUNITS") continue;
    for (let j = i + 1; j + 1 < Math.min(i + 8, linjer.length); j += 2) {
      if (linjer[j]!.trim() === "70") {
        const n = parseInt(linjer[j + 1]!.trim(), 10);
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  }
  return null;
}

// =============================================================================
// Måling (lengde/areal) — direkte i verdensenheter, ingen målestokk-nevner.
// =============================================================================

/** Euklidsk avstand mellom to verdenspunkter, i DXF-verdensenheter. */
export function avstandVerden(a: VerdenPunkt, b: VerdenPunkt): number {
  return Math.hypot(b.verdenX - a.verdenX, b.verdenY - a.verdenY);
}

/** Virkelig lengde (mm) mellom to verdenspunkter. */
export function malVerdenMm(a: VerdenPunkt, b: VerdenPunkt, mmPrVerdenEnhet: number): number {
  return avstandVerden(a, b) * mmPrVerdenEnhet;
}

/** Sum av virkelig lengde (mm) langs en polylinje av verdenspunkter. */
export function malVerdenPolylinjeMm(punkter: VerdenPunkt[], mmPrVerdenEnhet: number): number {
  let sum = 0;
  for (let i = 1; i < punkter.length; i++) {
    const a = punkter[i - 1];
    const b = punkter[i];
    if (a === undefined || b === undefined) continue;
    sum += malVerdenMm(a, b, mmPrVerdenEnhet);
  }
  return sum;
}

/**
 * Virkelig areal (mm²) av et lukket polygon av verdenspunkter (shoelace, lukket
 * ring siste→første). < 3 punkter → 0. Robust mot klikk-rekkefølge (absoluttverdi).
 */
export function malVerdenArealMm2(punkter: VerdenPunkt[], mmPrVerdenEnhet: number): number {
  if (punkter.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < punkter.length; i++) {
    const a = punkter[i]!;
    const b = punkter[(i + 1) % punkter.length]!;
    sum += a.verdenX * b.verdenY - b.verdenX * a.verdenY;
  }
  const arealVerden = Math.abs(sum) / 2;
  return arealVerden * mmPrVerdenEnhet * mmPrVerdenEnhet;
}

/** Kan måleverktøyet brukes? Krever en kjent, positiv, endelig mm/verdensenhet-faktor. */
export function kanMaleVerden(mmPrVerdenEnhet: number | null | undefined): boolean {
  return mmPrVerdenEnhet != null && Number.isFinite(mmPrVerdenEnhet) && mmPrVerdenEnhet > 0;
}

// =============================================================================
// 90°-lås + snapping i verdensrom — speil av maaling.ts sine funksjoner med samme
// navn (uten "Verden"-suffikset), men uten prosent/piksel-omregningslaget.
// =============================================================================

interface Vektor2 {
  dx: number;
  dy: number;
}

function vektor(a: VerdenPunkt, b: VerdenPunkt): Vektor2 {
  return { dx: b.verdenX - a.verdenX, dy: b.verdenY - a.verdenY };
}

/** En referanselinje (to verdenspunkter) å låse parallelt/vinkelrett på. */
export interface ReferanselinjeVerden {
  a: VerdenPunkt;
  b: VerdenPunkt;
}

/** Detaljert resultat av en 90°-lås i verdensrom (for hjelpelinje + «90°»-etikett). */
export interface LaasDetaljVerden {
  punkt: VerdenPunkt;
  /** Valgt låseretning som enhetsvektor i VERDENSROM. */
  retning: Vektor2;
  vinkelrett: boolean;
}

/**
 * Kjernen i 90°-låsen i verdensrom. Presedens for referanseretningen (RETUR
 * 2026-10-18, Kenneths telefontest punkt 3 — orkestrators avgjørelse):
 *   1. Ankeret er snappet til en vegg/linje (`referanse` satt) → lås parallelt/
 *      vinkelrett på DEN linjen.
 *   2. Ellers, finnes et forrige segment (`forforrige`, polylinje/areal fra
 *      segment 2) → lås parallelt/vinkelrett på DET segmentet (0°/90° i forhold
 *      til forrige, ikke byggets vinkel — en polylinje som følger en vinklet
 *      veggrekke skal kunne svinge rent i hvert hjørne).
 *   3. Ellers (første punkt, intet vegg-treff) → byggets DOMINANTE veggvinkel
 *      (`dominantVeggvinkelGrader`, fra render.py, se objektmodell.ts), IKKE
 *      skjermaksene/DXF-ens rå X/Y — de faller bare sammen når bygget selv er
 *      aksejevnt med filens koordinatsystem, som fallplanens 40°-vinkel beviser
 *      at det ikke alltid er. Mangler vinkelen (for tynt grunnlag) → 0°, identisk
 *      med oppførselen FØR dette feltet fantes (aksejevne akser).
 * Ingen piksel-space-omregning her (verdensrom er isotropt) — se `laasDetaljer`
 * (maaling.ts) for den papir/prosent-baserte SØSTER-implementasjonen.
 */
export function laasDetaljerVerden(
  anker: VerdenPunkt,
  kandidat: VerdenPunkt,
  forforrige?: VerdenPunkt | null,
  referanse?: ReferanselinjeVerden | null,
  dominantVeggvinkelGrader?: number | null,
): LaasDetaljVerden {
  const v = vektor(anker, kandidat);
  const retninger: { d: Vektor2; perp: boolean }[] = [];
  if (referanse) {
    const u = vektor(referanse.a, referanse.b);
    const len = Math.hypot(u.dx, u.dy);
    if (len > 0) {
      const un = { dx: u.dx / len, dy: u.dy / len };
      retninger.push({ d: un, perp: false }); // parallelt med veggen
      retninger.push({ d: { dx: -un.dy, dy: un.dx }, perp: true }); // vinkelrett inn mot veggen
    }
  } else if (forforrige) {
    const u = vektor(forforrige, anker);
    const len = Math.hypot(u.dx, u.dy);
    if (len > 0) {
      const un = { dx: u.dx / len, dy: u.dy / len };
      retninger.push({ d: un, perp: false }); // 0°: fortsett rett fram
      retninger.push({ d: { dx: -un.dy, dy: un.dx }, perp: true }); // 90°: vinkelrett på forrige
    }
  }
  if (retninger.length === 0) {
    const rad = ((dominantVeggvinkelGrader ?? 0) * Math.PI) / 180;
    retninger.push({ d: { dx: Math.cos(rad), dy: Math.sin(rad) }, perp: false });
    retninger.push({ d: { dx: -Math.sin(rad), dy: Math.cos(rad) }, perp: true });
  }

  let best: VerdenPunkt = kandidat;
  let bestRetning = retninger[0]!.d;
  let bestPerp = false;
  let bestAvstand = Infinity;
  for (const r of retninger) {
    const dl = Math.hypot(r.d.dx, r.d.dy);
    if (dl === 0) continue;
    const dn = { dx: r.d.dx / dl, dy: r.d.dy / dl };
    const proj = v.dx * dn.dx + v.dy * dn.dy; // skalar-projeksjon langs retningen
    const lp: VerdenPunkt = { verdenX: anker.verdenX + proj * dn.dx, verdenY: anker.verdenY + proj * dn.dy };
    const avstand = Math.hypot(kandidat.verdenX - lp.verdenX, kandidat.verdenY - lp.verdenY);
    if (avstand < bestAvstand) {
      bestAvstand = avstand;
      best = lp;
      bestRetning = dn;
      bestPerp = r.perp;
    }
  }
  return { punkt: best, retning: bestRetning, vinkelrett: bestPerp };
}

/**
 * Antall DXF-verdensenheter pr. SKJERM-piksel ved nåværende kamera (zoom/rotasjon).
 * Brukt til å konvertere en konstant skjerm-px-terskel (snap-radius) til verdensenheter
 * for den aktuelle zoomen — uten dette ville en snap-terskel i verdensenheter blitt
 * usynlig innzoomet / altfor grov utzoomet.
 */
export function verdenPerSkjermPiksel(k: DxfKameraParametre): number {
  const p0 = skjermTilVerden({ skjermX: 0, skjermY: 0 }, k);
  const p1 = skjermTilVerden({ skjermX: 1, skjermY: 0 }, k);
  return Math.hypot(p1.verdenX - p0.verdenX, p1.verdenY - p0.verdenY);
}

/**
 * Endepunktene (verdenskoordinater) for den stiplede aksehjelpelinja gjennom `anker`
 * med retning `retning` — strukket langt nok til å dekke hele det synlige utsnittet
 * (ingen eksakt boks-klipp nødvendig: linja klippes visuelt av canvaset/overlegget).
 */
export function aksehjelpelinjeVerden(
  anker: VerdenPunkt,
  retning: Vektor2,
  k: DxfKameraParametre,
): [VerdenPunkt, VerdenPunkt] {
  const dl = Math.hypot(retning.dx, retning.dy);
  const d = dl > 0 ? { dx: retning.dx / dl, dy: retning.dy / dl } : { dx: 1, dy: 0 };
  const viewBredde = (k.right - k.left) / k.zoom;
  const viewHoyde = (k.top - k.bottom) / k.zoom;
  const halvDiagonal = Math.hypot(viewBredde, viewHoyde);
  return [
    { verdenX: anker.verdenX - d.dx * halvDiagonal, verdenY: anker.verdenY - d.dy * halvDiagonal },
    { verdenX: anker.verdenX + d.dx * halvDiagonal, verdenY: anker.verdenY + d.dy * halvDiagonal },
  ];
}

/**
 * Behold bare punktene som (projisert til skjerm ved nåværende kamera) ligger inne i
 * canvaset, med en margin i skjerm-px — speil av `filtrerSynligePunkter` (maaling.ts),
 * men via faktisk skjerm-projeksjon i stedet for et prosent-utsnitt (korrekt også ved
 * kamera-rotasjon).
 */
export function filtrerSynligeVerdenPunkter(
  punkter: VerdenPunkt[],
  k: DxfKameraParametre,
  marginPx = 0,
): VerdenPunkt[] {
  return punkter.filter((p) => {
    const s = verdenTilSkjerm(p, k);
    return (
      s.skjermX >= -marginPx &&
      s.skjermX <= k.canvasBredde + marginPx &&
      s.skjermY >= -marginPx &&
      s.skjermY <= k.canvasHoyde + marginPx
    );
  });
}

/** Snap til nærmeste verdenspunkt i `mål` innen `tolVerden` verdensenheter. */
export function snapTilPunktVerden(
  kandidat: VerdenPunkt,
  mål: VerdenPunkt[],
  tolVerden: number,
): VerdenPunkt | null {
  let best: VerdenPunkt | null = null;
  let bestAvstand = tolVerden;
  for (const m of mål) {
    const d = Math.hypot(m.verdenX - kandidat.verdenX, m.verdenY - kandidat.verdenY);
    if (d <= bestAvstand) {
      bestAvstand = d;
      best = m;
    }
  }
  return best;
}

export interface HjelpelinjerVerden {
  /** verdenX for en loddrett hjelpelinje, ellers null. */
  vertikal: number | null;
  /** verdenY for en vannrett hjelpelinje, ellers null. */
  horisontal: number | null;
}

/**
 * Snap til 90°-hjelpelinjer fra eksisterende punkter (uavhengig x/y). Terskel i
 * verdensenheter. Speil av `snapTil90Linje` (maaling.ts).
 */
export function snapTil90LinjeVerden(
  kandidat: VerdenPunkt,
  referanser: VerdenPunkt[],
  tolVerden: number,
): { punkt: VerdenPunkt; hjelpelinjer: HjelpelinjerVerden } {
  const resultat: HjelpelinjerVerden = { vertikal: null, horisontal: null };
  let x = kandidat.verdenX;
  let y = kandidat.verdenY;
  let bestX = tolVerden;
  let bestY = tolVerden;
  for (const r of referanser) {
    const dx = Math.abs(r.verdenX - kandidat.verdenX);
    if (dx <= bestX) {
      bestX = dx;
      x = r.verdenX;
      resultat.vertikal = r.verdenX;
    }
    const dy = Math.abs(r.verdenY - kandidat.verdenY);
    if (dy <= bestY) {
      bestY = dy;
      y = r.verdenY;
      resultat.horisontal = r.verdenY;
    }
  }
  return { punkt: { verdenX: x, verdenY: y }, hjelpelinjer: resultat };
}

export interface SnapInnVerden {
  /** Rått kandidatpunkt (verdenskoordinat), fra skjerm→verden. */
  kandidat: VerdenPunkt;
  /** Forrige satte punkt i den påbegynte målingen (ortho-anker). null = første punkt / dra. */
  anker: VerdenPunkt | null;
  /** Punktet før ankeret (for vinkelrett på forrige segment). */
  forforrige: VerdenPunkt | null;
  /** Alle andre punkter på tegningen (snap-mål + hjelpelinje-referanser). */
  referanser: VerdenPunkt[];
  /** Valgt referanselinje — lås parallelt/vinkelrett på den i stedet for akser. */
  referanselinje?: ReferanselinjeVerden | null;
  /** Byggets dominante veggvinkel (grader, RegisterVerden.dominantVeggvinkelGrader)
   * — fallback-referanse når det ikke finnes referanselinje ELLER forrige segment.
   * `null`/fravær → 0° (aksejevne akser, samme som før feltet fantes). */
  dominantVeggvinkelGrader?: number | null;
  /** 90°-lås på? */
  ortho: boolean;
  /** Snap på? */
  snap: boolean;
  /** Nåværende kamera (for px→verdensenhet-terskler og synlighetsfilter). */
  kamera: DxfKameraParametre;
  /** Treffradius punkt-snap (skjerm-px). */
  punktTolPx: number;
  /** Treffradius hjelpelinje-snap (skjerm-px). */
  guideTolPx: number;
}

export interface SnapResultatVerden {
  /** Endelig punkt (verdenskoordinat) — det som skal lagres/vises. */
  punkt: VerdenPunkt;
  traffPunkt: boolean;
  hjelpelinjer: HjelpelinjerVerden;
  aksehjelpelinje: [VerdenPunkt, VerdenPunkt] | null;
  vinkelrett: boolean;
}

/**
 * Full snap+lås for ETT kandidatpunkt i verdensrom. Samme presedens som `beregnSnap`
 * (maaling.ts) § 1 snap-punkt vinner, § 2 ortho-lås mot anker, § 3 snap til 90°-
 * hjelpelinjer uten anker.
 */
export function beregnSnapVerden(inn: SnapInnVerden): SnapResultatVerden {
  const tom: HjelpelinjerVerden = { vertikal: null, horisontal: null };
  const perPx = verdenPerSkjermPiksel(inn.kamera);
  const punktTolVerden = inn.punktTolPx * perPx;
  const guideTolVerden = inn.guideTolPx * perPx;

  const margin = Math.max(inn.punktTolPx, inn.guideTolPx);
  const referanser = filtrerSynligeVerdenPunkter(inn.referanser, inn.kamera, margin);

  // 1) Eksakt punkt-snap vinner.
  if (inn.snap) {
    const p = snapTilPunktVerden(inn.kandidat, referanser, punktTolVerden);
    if (p) return { punkt: p, traffPunkt: true, hjelpelinjer: tom, aksehjelpelinje: null, vinkelrett: false };
  }

  // 2) 90°-lås mot ankeret (akser eller valgt referanselinje).
  if (inn.ortho && inn.anker) {
    const d = laasDetaljerVerden(inn.anker, inn.kandidat, inn.forforrige, inn.referanselinje, inn.dominantVeggvinkelGrader);
    return {
      punkt: d.punkt,
      traffPunkt: false,
      hjelpelinjer: tom,
      aksehjelpelinje: aksehjelpelinjeVerden(inn.anker, d.retning, inn.kamera),
      vinkelrett: d.vinkelrett,
    };
  }

  // 3) 90°-hjelpelinjer (forlengelse av vannrett/loddrett fra eksisterende punkter).
  if (inn.snap && inn.ortho) {
    const { punkt, hjelpelinjer } = snapTil90LinjeVerden(inn.kandidat, referanser, guideTolVerden);
    return { punkt, traffPunkt: false, hjelpelinjer, aksehjelpelinje: null, vinkelrett: false };
  }

  return { punkt: inn.kandidat, traffPunkt: false, hjelpelinjer: tom, aksehjelpelinje: null, vinkelrett: false };
}

/**
 * Nærmeste eksisterende verdenspunkt til et SKJERM-trykk, innen `tolPx` skjerm-piksler
 * (-1 = ingen treff). Brukt til å avgjøre om et trykk starter en NY plassering eller
 * en FLYTTING av et eksisterende punkt (drag-to-reposition).
 */
export function finnNaermesteVerdenPunkt(
  punkter: VerdenPunkt[],
  skjermKandidat: SkjermPunkt,
  k: DxfKameraParametre,
  tolPx: number,
): number {
  let best = -1;
  let bestAvstand = tolPx;
  for (let i = 0; i < punkter.length; i++) {
    const s = verdenTilSkjerm(punkter[i]!, k);
    const d = Math.hypot(s.skjermX - skjermKandidat.skjermX, s.skjermY - skjermKandidat.skjermY);
    if (d <= bestAvstand) {
      best = i;
      bestAvstand = d;
    }
  }
  return best;
}

/** Avstand (skjerm-px) fra et skjermpunkt til et linjesegment (begge i skjermrom). */
function avstandTilSkjermSegment(p: SkjermPunkt, a: SkjermPunkt, b: SkjermPunkt): number {
  const dx = b.skjermX - a.skjermX;
  const dy = b.skjermY - a.skjermY;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.skjermX - a.skjermX, p.skjermY - a.skjermY);
  let tt = ((p.skjermX - a.skjermX) * dx + (p.skjermY - a.skjermY) * dy) / len2;
  tt = Math.max(0, Math.min(1, tt));
  return Math.hypot(p.skjermX - (a.skjermX + tt * dx), p.skjermY - (a.skjermY + tt * dy));
}

/** Ett treff fra `finnMalingTreffVerden`: hvilken måling, og ev. hvilket PUNKT. */
export interface MaalingTreffVerden {
  malingIndex: number;
  /** Indeksen til punktet som ble truffet, eller `null` = traff et SEGMENT (ikke et punkt). */
  punktIndex: number | null;
}

/**
 * Nærmeste måling et skjermtrykk/trådkors traff, PÅ TVERS AV ALLE målinger (ikke
 * kun den aktive) — punkter FØR segmenter, sist-tegnet (øverste) måling vinner ved
 * flere treff. Brukt til prioritetsregelen "målepunkter (og målesegmenter) går
 * ALLTID foran objekter" (POST flytte målepunkter, orkestrator 2026-10-18, pkt 1) —
 * kalleren sjekker DENNE FØR `hitTestWorld` (objekt-identifisering). `null` = bom.
 */
export function finnMalingTreffVerden(
  malinger: { punkter: VerdenPunkt[] }[],
  skjermKandidat: SkjermPunkt,
  k: DxfKameraParametre,
  tolPx: number,
): MaalingTreffVerden | null {
  for (let mi = malinger.length - 1; mi >= 0; mi--) {
    const pts = malinger[mi]!.punkter;
    const skjermPts = pts.map((p) => verdenTilSkjerm(p, k));
    for (let i = 0; i < skjermPts.length; i++) {
      const s = skjermPts[i]!;
      if (Math.hypot(s.skjermX - skjermKandidat.skjermX, s.skjermY - skjermKandidat.skjermY) <= tolPx) {
        return { malingIndex: mi, punktIndex: i };
      }
    }
    for (let i = 0; i + 1 < skjermPts.length; i++) {
      if (avstandTilSkjermSegment(skjermKandidat, skjermPts[i]!, skjermPts[i + 1]!) <= tolPx) {
        return { malingIndex: mi, punktIndex: null };
      }
    }
  }
  return null;
}
