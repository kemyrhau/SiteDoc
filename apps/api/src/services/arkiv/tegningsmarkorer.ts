/**
 * Arkivmal D2b — rekursiv innsamling av repeater-markører + moderat-DPI utsnitt.
 *
 * Markørene til D2b-helsiden ligger i repeater-RADER (`drawing_position`-barn).
 * Innsamlingen er REKURSIV (fabel-krav): en repeater kan nestes, så vi går ned i
 * nestede repeatere også. Frittstående (topp-nivå) `drawing_position` samles IKKE
 * her — de beholder D2-blokkformen (steg 2). Flat nummerering per tegning gjøres
 * av kalleren.
 *
 * Utsnittet croppes server-side med sharp (Gate 2+3): 4×-zoom-region i 4:3, klemt
 * innenfor tegningskanten, nedskalert til moderat DPI — ikke full tegning gjentatt
 * N ganger i nyttelasten.
 */

import sharp from "sharp";
import type { TreObjekt, FeltVerdi } from "@sitedoc/pdf";

export interface RepeaterMarkor {
  drawingId: string;
  /** Posisjon i prosent (0–100). */
  x: number;
  y: number;
  /**
   * 1-basert radnummer i repeateren. Helsidens markørnummer = dette, så det
   * peker mot radnummeret i repeater-tabellen (Kenneth-vedtak 2026-08-21:
   * detaljutsnittet flyttet inn i raden, helsidens duplikat-tabell fjernet).
   */
  radnr: number;
  /**
   * Referanse til markør-verdi-objektet i data-treet. Kalleren injiserer det
   * croppede detaljutsnittet her (`utsnittDataUrl`), så repeater-cellen kan
   * rendre det under koordinatteksten. Mutasjonen treffer den data-en som
   * `byggInnhold` faktisk rendrer (kjør innsamlingen på `dataInlinet`).
   */
  markorObj: Record<string, unknown>;
}

interface MarkorVerdi {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
}

/** Er verdien en komplett tegningsmarkør? */
function harMarkor(v: unknown): v is MarkorVerdi & { drawingId: string; positionX: number; positionY: number } {
  const m = v as MarkorVerdi | null | undefined;
  return (
    !!m &&
    typeof m === "object" &&
    typeof m.drawingId === "string" &&
    m.positionX != null &&
    m.positionY != null
  );
}

/**
 * Samler alle repeater-markører (rekursivt). `data` er rad-scope ved rekursjon
 * inn i nestede repeatere. Rekkefølge = traverseringsrekkefølge (dokumentorden).
 * `radnr` er 1-basert radindeks i den umiddelbare repeateren.
 */
export function samleRepeaterMarkorer(
  objekter: TreObjekt[],
  data: Record<string, FeltVerdi>,
): RepeaterMarkor[] {
  const ut: RepeaterMarkor[] = [];
  for (const obj of objekter) {
    if (obj.type === "repeater") {
      const barn = obj.children ?? [];
      const dpBarn = barn.filter((b) => b.type === "drawing_position");
      const nestedRep = barn.filter((b) => b.type === "repeater");
      const rader = Array.isArray(data[obj.id]?.verdi)
        ? (data[obj.id]!.verdi as Record<string, FeltVerdi>[])
        : [];
      rader.forEach((rad, radIdx) => {
        for (const dp of dpBarn) {
          const v = rad[dp.id]?.verdi;
          if (harMarkor(v)) {
            ut.push({
              drawingId: v.drawingId,
              x: v.positionX,
              y: v.positionY,
              radnr: radIdx + 1,
              markorObj: v as unknown as Record<string, unknown>,
            });
          }
        }
        // Rekursiv: nestede repeatere i denne raden (rad = data-scope).
        for (const nr of nestedRep) ut.push(...samleRepeaterMarkorer([nr], rad));
      });
    } else if (obj.children && obj.children.length > 0) {
      // Seksjoner (heading/subtitle med barn) — rekurser i samme data-scope.
      ut.push(...samleRepeaterMarkorer(obj.children, data));
    }
  }
  return ut;
}

const ZOOM = 4;
/** Moderat DPI: 320px bred crop ≈ ~3 cm ved arkiv-oppløsning (ikke print-DPI). */
const CROP_MAKS_BREDDE = 320;

/**
 * Croppet detaljutsnitt rundt markøren (Gate 2+3): 4×-zoom-region i 4:3, klemt
 * innenfor tegningskanten, nedskalert til moderat DPI. Feilende → null (stiplet
 * tom celle i tabellen).
 */
export async function byggUtsnittCrop(
  bytes: Buffer,
  imageWidth: number,
  imageHeight: number,
  xPct: number,
  yPct: number,
): Promise<string | null> {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return null;
  const cropW = Math.max(1, Math.round(imageWidth / ZOOM));
  const cropH = Math.max(1, Math.round((cropW * 3) / 4)); // 4:3
  const w = Math.min(cropW, imageWidth);
  const h = Math.min(cropH, imageHeight);
  const cx = (xPct / 100) * imageWidth;
  const cy = (yPct / 100) * imageHeight;
  // Klem croppen innenfor tegningskanten (markør nær kant → utsnitt forskyves inn).
  const left = Math.max(0, Math.min(imageWidth - w, Math.round(cx - w / 2)));
  const top = Math.max(0, Math.min(imageHeight - h, Math.round(cy - h / 2)));
  try {
    const buf = await sharp(bytes)
      .extract({ left, top, width: w, height: h })
      .resize({ width: CROP_MAKS_BREDDE, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
