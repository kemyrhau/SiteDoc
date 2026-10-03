import { eq, and } from "drizzle-orm";
import { raaVedleggIData, TERMINALE_DOKUMENTSTATUSER } from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { dokumentSpeil } from "../db/schema";
import type { trpc } from "../lib/trpc";

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/* ============================================================================
 *  Dokument-speil (Offline-LESING fase 2, 2026-10-03)
 *
 *  Speiler HELE dokumentet (`hentMedId`-svaret) lokalt pr. (dokumentType, id,
 *  userId), så detaljskjermen kan rendre i tvungen lesemodus uten nett. To
 *  skrive-veier (begge via `lagreDokumentSpeil`):
 *   1. Write-through: hver gang brukeren åpner et dokument MED nett og
 *      `hentMedId` lykkes (ingen ekstra nettkall).
 *   2. «Forbered offline»: forhånds-nedlasting via den bieffekt-frie
 *      `hentForOffline` (stempler IKKE lest-kvittering).
 *
 *  🔴 Signerte vedleggs-URL-er (`?exp=&sig=`) STRIPPES før lagring via den delte
 *  `raaVedleggIData` (@sitedoc/shared) — nøyaktig samme skrive-vei-vaksine som
 *  serveren bruker på `Checklist.data`/`Task.data`. Signaturen har innebygd utløp;
 *  en lagret signatur dør i databasen. Signaturfelt (base64 i `data`) består og
 *  vises offline; bilder krever nett (skjermen viser en rolig plassholder).
 *
 *  Nøklet på `userId` (synlighetsvakt): en ny bruker på samme telefon leser ALDRI
 *  forrige brukers speil. Synkes ALDRI opp — usynkede utkast bor i `*_feltdata`.
 * ============================================================================ */

export type DokumentType = "sjekkliste" | "oppgave";

export interface DokumentSpeilResultat {
  /** Parsed `hentMedId`-svar med signaturer strippet. Kalleren caster til sin form. */
  dokument: unknown;
  /** Unix ms — «viser lagret versjon fra {tid}» (offline-banner). */
  hentetVed: number;
}

/**
 * Lagre (write-through / forhånds-nedlasting) serverens `hentMedId`-svar i speilet.
 * Idempotent upsert på komposit-PK (dokumentType, id, userId) via delete+insert
 * (samme mønster som katalog-tjenestene; rører kun denne ene raden). No-op uten
 * db/id/userId. Strip-steget er ufravikelig — ingen signert URL skal persisteres.
 */
export function lagreDokumentSpeil(
  dokumentType: DokumentType,
  id: string,
  projectId: string,
  userId: string,
  svar: unknown,
): void {
  const db = hentDatabase();
  if (!db || !id || !userId || svar == null) return;

  const rent = raaVedleggIData(svar);
  const naa = Date.now();

  db.delete(dokumentSpeil)
    .where(
      and(
        eq(dokumentSpeil.dokumentType, dokumentType),
        eq(dokumentSpeil.id, id),
        eq(dokumentSpeil.userId, userId),
      ),
    )
    .run();
  db.insert(dokumentSpeil)
    .values({
      id,
      dokumentType,
      projectId,
      userId,
      json: JSON.stringify(rent),
      hentetAt: naa,
    })
    .run();
}

/**
 * Les brukerens speil for ett dokument. `null` når det ikke er lastet ned (eller
 * JSON er korrupt — defensivt). Bruker-filtrert: en annen bruker får ALDRI treff.
 */
export function hentDokumentSpeil(
  dokumentType: DokumentType,
  id: string,
  userId: string,
): DokumentSpeilResultat | null {
  const db = hentDatabase();
  if (!db || !id || !userId) return null;

  const rad = db
    .select()
    .from(dokumentSpeil)
    .where(
      and(
        eq(dokumentSpeil.dokumentType, dokumentType),
        eq(dokumentSpeil.id, id),
        eq(dokumentSpeil.userId, userId),
      ),
    )
    .all()[0];
  if (!rad) return null;

  try {
    return { dokument: JSON.parse(rad.json), hentetVed: rad.hentetAt };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 *  Forhånds-nedlasting («Forbered offline»)
 * ------------------------------------------------------------------------- */

/**
 * Øvre grense pr. forhånds-nedlasting (navngitt tak, ordre § B.3). Bevisst konservativt:
 * speilet bærer HELE hentMedId-svaret (mal + data + historikk), så volumet pr. dokument
 * er langt større enn liste-radene. 200 dekker et aktivt prosjekt uten å hamre anleggsnettet.
 */
export const FORHAANDSLAST_TAK = 200;

/**
 * Statuser forhånds-nedlastingen hopper over = domenets terminale statuser
 * (`TERMINALE_DOKUMENTSTATUSER` fra @sitedoc/shared, delt med `utledDokumentRettighet` —
 * ingen lokal kopi) + `deleted`. `deleted` er navngitt med vilje: ikke en flyt-terminal,
 * men en slettet rad ingen skal lese offline. (Write-through speiler fortsatt et åpnet
 * «approved»-dokument — kun BULK-forhånds-nedlasting hopper over de terminale.)
 */
function erTerminalForForhaandslast(status: string): boolean {
  return TERMINALE_DOKUMENTSTATUSER.has(status) || status === "deleted";
}

export interface ForhaandslastDokument {
  id: string;
  type: DokumentType;
  status: string;
}

export interface ForhaandslastResultat {
  lastet: number;
  hoppet: number;
  feilet: number;
  /** Gammel server uten `hentForOffline` → forhånds-nedlasting hoppet over (write-through virker). */
  serverManglerProsedyre: boolean;
}

/** NOT_FOUND / 404 fra tRPC = prosedyren finnes ikke på serveren (gammel kode). */
function erProsedyreMangler(e: unknown): boolean {
  const feil = e as { data?: { code?: string; httpStatus?: number }; message?: string };
  return (
    feil?.data?.code === "NOT_FOUND" ||
    feil?.data?.httpStatus === 404 ||
    (typeof feil?.message === "string" && /not_?found|404|No "query"-procedure/i.test(feil.message))
  );
}

/**
 * Last ned de oppgitte dokumentene via den bieffekt-frie `hentForOffline` og speil dem.
 * Respekterer taket, stopper IKKE på ett feilet dokument, og hopper over terminale.
 *
 * 🔴 Gammel server: `hentForOffline` kaster NOT_FOUND → vi stopper HELE forhånds-nedlastingen
 * stille-men-logget (write-through fortsetter å virke på ekte visninger). Første NOT_FOUND
 * tolkes som manglende prosedyre (ikke per-dokument-feil), siden alle kall går mot samme sti.
 */
export async function forhaandslastDokumenter(
  klient: TrpcKlient,
  projectId: string,
  userId: string,
  dokumenter: ForhaandslastDokument[],
): Promise<ForhaandslastResultat> {
  const res: ForhaandslastResultat = { lastet: 0, hoppet: 0, feilet: 0, serverManglerProsedyre: false };
  if (!userId) return res;

  const kandidater = dokumenter.filter((d) => !erTerminalForForhaandslast(d.status));
  res.hoppet = dokumenter.length - kandidater.length;

  let antall = 0;
  for (const d of kandidater) {
    if (antall >= FORHAANDSLAST_TAK) {
      // Logg hva som ble droppet — ikke stille trunkering.
      console.log(`[offline] forhånds-nedlasting nådde taket (${FORHAANDSLAST_TAK}); ${kandidater.length - antall} dokumenter hoppet over`);
      res.hoppet += kandidater.length - antall;
      break;
    }
    try {
      // Hver gren tilordnes en `unknown`-variabel FØR den slås sammen — en ternær
      // over de to tRPC-retur-typene tvinger en dyp union og trigger TS2589.
      let svar: unknown;
      if (d.type === "sjekkliste") {
        svar = await klient.sjekkliste.hentForOffline.query({ id: d.id });
      } else {
        svar = await klient.oppgave.hentForOffline.query({ id: d.id });
      }
      lagreDokumentSpeil(d.type, d.id, projectId, userId, svar);
      res.lastet++;
      antall++;
    } catch (e) {
      if (erProsedyreMangler(e)) {
        console.log("[offline] hentForOffline mangler på serveren — hopper over forhånds-nedlasting (write-through virker)");
        res.serverManglerProsedyre = true;
        break;
      }
      res.feilet++; // enkelt-dokument-feil stopper ikke resten
      antall++;
    }
  }
  return res;
}
