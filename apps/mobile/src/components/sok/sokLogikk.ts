import { delOppTermer, finnOverlapp, velgOfflineListeKilde } from "@sitedoc/shared";

/**
 * Ren logikk bak mobilsøket (spec-sok-mobil rev. 2): omfang og offline-matrise (§ 9), motorvalg for Mapper
 * (§ 6), gruppering pr. dokument (§ 2) og chunk-leseren (§ 3). Ingen React/RN her — testes i node.
 */

export type Omfang = "alle" | "mapper" | "sjekklister" | "oppgaver";
export type Kilde = Exclude<Omfang, "alle">;

/** Rekkefølgen i «Alle»: mapper er nytt og hovedmålet; listene finnes alt andre steder (§ 9.4). */
export const KILDE_REKKEFOLGE: Kilde[] = ["mapper", "sjekklister", "oppgaver"];

/** Maks listerader pr. seksjon i «Alle»; «Vis alle N» velger kilden alene. */
export const MAKS_RADER_ALLE = 10;

/** «Vis N flere» henter vist + porsjon fra samme endepunkt (som web `VIS_FLERE_PORSJON`). */
export const VIS_FLERE_PORSJON = 20;

export function kilderFor(omfang: Omfang): Kilde[] {
  return omfang === "alle" ? KILDE_REKKEFOLGE : [omfang];
}

/** server = ferske svar · lokal = lagret katalog («lagret versjon · sist hentet») · krever-nett = kun Mapper offline. */
export type KildeModus = "server" | "lokal" | "krever-nett";

export interface KildeModusInput {
  erPaaNettet: boolean;
  /** Listekildene: har server-spørringen svart? */
  serverBekreftet: boolean;
  serverAntall: number;
  lokalAntall: number;
}

/** Offline-matrisen (§ 9.3). Listene følger samme kildevalg som sjekkliste-/oppgavelistene. */
export function kildeModus(kilde: Kilde, i: KildeModusInput): KildeModus {
  if (kilde === "mapper") return i.erPaaNettet ? "server" : "krever-nett";
  return velgOfflineListeKilde(i).kilde;
}

/** Seksjoner som vises: «Alle» skjuler tomme, men Mapper vises alltid når den krever nett. */
export function synligeSeksjoner(
  omfang: Omfang,
  antall: Record<Kilde, number>,
  modus: Record<Kilde, KildeModus>,
): Kilde[] {
  if (omfang !== "alle") return [omfang];
  return KILDE_REKKEFOLGE.filter((k) => antall[k] > 0 || modus[k] === "krever-nett");
}

/** Tellelinjen: «N treff» (+ «· mapper krever nett» når Mapper er i omfanget og er frakoblet). */
export function tellelinje(
  omfang: Omfang,
  antall: Record<Kilde, number>,
  modus: Record<Kilde, KildeModus>,
): { treff: number; mapperKreverNett: boolean } {
  const kilder = kilderFor(omfang);
  return {
    treff: kilder.reduce((sum, k) => sum + antall[k], 0),
    mapperKreverNett: kilder.includes("mapper") && modus.mapper === "krever-nett",
  };
}

export function seksjonsUtvalg<T>(rader: T[], omfang: Omfang): { rader: T[]; totalt: number } {
  return {
    rader: omfang === "alle" ? rader.slice(0, MAKS_RADER_ALLE) : rader,
    totalt: rader.length,
  };
}

/**
 * Mapper-motor uten bryter (§ 6, samme regel som web `sok/page.tsx`): AI når embeddings finnes og AI svarte
 * uten feil med treff; ellers leksikalsk (også når AI ga 0 treff). `aiUtilgjengelig` = serveren falt selv til
 * tekstsøk (embedding-tjenesten svarte ikke).
 */
export function velgMappeMotor(i: {
  harEmbeddings: boolean;
  aiFeilet: boolean;
  aiAntall: number;
  aiSøkUtilgjengelig: boolean;
}): { motor: "ai" | "leksikalsk"; aiUtilgjengelig: boolean } {
  const aiOk = i.harEmbeddings && !i.aiFeilet;
  return {
    motor: aiOk && i.aiAntall > 0 ? "ai" : "leksikalsk",
    aiUtilgjengelig: aiOk && i.aiSøkUtilgjengelig,
  };
}

interface DokTreff {
  id: string;
  documentId: string;
  filename: string;
  antallIDok?: number;
}

export interface DokumentGruppe<T extends DokTreff> {
  documentId: string;
  filename: string;
  treff: T[];
  vist: number;
  /** Treff-chunks i dokumentet totalt (server), minst `vist`. */
  antallIDok: number;
  flere: number;
}

/** Grupper pr. dokument i serverens rekkefølge (første forekomst = beste rang), som web `TreffListe`. */
export function grupperPerDokument<T extends DokTreff>(treff: T[]): Array<DokumentGruppe<T>> {
  const grupper: Array<{ documentId: string; filename: string; treff: T[] }> = [];
  const indeks = new Map<string, number>();
  for (const tr of treff) {
    let i = indeks.get(tr.documentId);
    if (i === undefined) {
      i = grupper.length;
      indeks.set(tr.documentId, i);
      grupper.push({ documentId: tr.documentId, filename: tr.filename, treff: [] });
    }
    grupper[i]!.treff.push(tr);
  }
  return grupper.map((g) => {
    const vist = g.treff.length;
    const antallIDok = Math.max(vist, ...g.treff.map((tr) => tr.antallIDok ?? 0));
    return { ...g, vist, antallIDok, flere: antallIDok - vist };
  });
}

/** «Vis N flere»: de nye radene erstatter dokumentets rader på dokumentets plass i lista (som web). */
export function flettUtvidet<T extends DokTreff>(grunn: T[], utvidet: Record<string, T[]>): T[] {
  if (Object.keys(utvidet).length === 0) return grunn;
  const ferdig = new Set<string>();
  const ut: T[] = [];
  for (const tr of grunn) {
    const ekstra = utvidet[tr.documentId];
    if (!ekstra) {
      ut.push(tr);
      continue;
    }
    if (ferdig.has(tr.documentId)) continue;
    ferdig.add(tr.documentId);
    ut.push(...ekstra);
  }
  return ut;
}

// ---- Chunk-leseren (§ 3) ----

export interface LeserChunk {
  id: string;
  chunkIndex: number;
  pageNumber: number | null;
  sectionTitle: string | null;
  chunkText: string;
}

/** En bit av et avsnitt: vanlig tekst, eller ordforekomst nummerert i dokumentrekkefølge. */
export interface LeserDel {
  tekst: string;
  forekomst?: number;
}

export interface LeserSegment {
  chunkIndex: number;
  erValgt: boolean;
  deler: LeserDel[];
}

export interface LeserSide {
  side: number;
  sectionTitle: string | null;
  segmenter: LeserSegment[];
}

/**
 * Sammenhengende tekst pr. side med overlapp fjernet; hver chunk beholder sitt segment (rammen og rulle-målet).
 * SØK-2 M3: valgt chunk vises HEL, overlappet tas fra forgjengerens hale i stedet (som web `Fulltekst`).
 */
export function byggLeser(
  chunks: LeserChunk[],
  valgtChunkIndex: number | null,
  søkeord: string,
): { sider: LeserSide[]; forekomster: Array<{ chunkIndex: number }> } {
  const perSide = new Map<number, LeserChunk[]>();
  for (const c of chunks) {
    const side = c.pageNumber ?? 0;
    const arr = perSide.get(side) ?? [];
    arr.push(c);
    perSide.set(side, arr);
  }

  const råSider: Array<{ side: number; sectionTitle: string | null; seg: Array<{ chunkIndex: number; tekst: string }> }> = [];
  for (const [side, sideChunks] of perSide) {
    sideChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const seg: Array<{ chunkIndex: number; tekst: string }> = [];
    let forrige = "";
    for (const chunk of sideChunks) {
      const ov = forrige ? finnOverlapp(forrige, chunk.chunkText) : 0;
      if (chunk.chunkIndex === valgtChunkIndex && ov > 0) {
        const forgjenger = seg[seg.length - 1];
        if (forgjenger) forgjenger.tekst = forgjenger.tekst.slice(0, Math.max(0, forgjenger.tekst.length - ov));
        seg.push({ chunkIndex: chunk.chunkIndex, tekst: chunk.chunkText });
      } else {
        seg.push({ chunkIndex: chunk.chunkIndex, tekst: chunk.chunkText.slice(ov) });
      }
      forrige = chunk.chunkText;
    }
    råSider.push({ side, sectionTitle: sideChunks[0]?.sectionTitle ?? null, seg });
  }
  råSider.sort((a, b) => a.side - b.side);

  let n = 0;
  const forekomster: Array<{ chunkIndex: number }> = [];
  const sider = råSider.map((s) => ({
    side: s.side,
    sectionTitle: s.sectionTitle,
    segmenter: s.seg.map((seg) => ({
      chunkIndex: seg.chunkIndex,
      erValgt: seg.chunkIndex === valgtChunkIndex,
      deler: delOppTermer(seg.tekst, søkeord)
        .filter((d) => d.tekst.length > 0)
        .map((d): LeserDel => {
          if (!d.erMatch) return { tekst: d.tekst };
          forekomster.push({ chunkIndex: seg.chunkIndex });
          return { tekst: d.tekst, forekomst: n++ };
        }),
    })),
  }));
  return { sider, forekomster };
}

/** ▲▼ med rundgang (som web): siste → første, første → siste; fra «–» går neste til første, forrige til siste. */
export function nesteEnhet(aktiv: number | null, retning: 1 | -1, antall: number): number | null {
  if (antall === 0) return null;
  if (aktiv == null) return retning === 1 ? 0 : antall - 1;
  return (aktiv + retning + antall) % antall;
}

/** Startenhet ved åpning fra treffliste: første enhet i valgt chunk (som web liste-klikk), ellers «–». */
export function startEnhet(enheter: Array<{ chunkIndex: number }>, startChunk: number | null): number | null {
  if (startChunk == null) return null;
  const i = enheter.findIndex((e) => e.chunkIndex === startChunk);
  return i === -1 ? null : i;
}
