/**
 * Strandet/pågår-mønster for `drawings.conversion_status`, trukket ut etter samme
 * forbilde som `reprosessering.ts` (ftd_documents.processing_state).
 *
 * RETUR 6 rekonverter (orkestrator 2026-10-16, DB-som-kø + én arbeider i api):
 * `pending` er IKKE lenger en kortvarig synkron mellomtilstand (satt og umiddelbart
 * videresendt i SAMME request) — den er en kø-post en alltid-kjørende arbeider i api
 * garantert plukker opp (poll hvert 3 s), uansett hvor lenge den venter (en stor
 * batch på maks 2 samtidig kan holde en rad i `pending` i godt over 10 min). Derfor
 * er `pending` ALDRI strandet: den eneste måten en `pending`-rad blir evig stående
 * på er at HELE api-prosessen er nede for godt, og da er «strandet vs. ikke» uansett
 * irrelevant (ingen kan se status). Kun `converting` — en rad arbeideren FAKTISK har
 * tatt (atomisk opptak, se `tegningKonverteringPoll` i `tegning.ts`) — kan være
 * strandet: arbeideren som eide den døde midt i (restart/krasj), og ingen annen
 * prosess skriver videre på raden. Derfor livstegn (`lagTegningLivstegn`, speiler
 * `reprosessering.ts`s `lagLivstegn`) BARE i `converting`-fasen, og KUN `converting`
 * sjekkes mot `KONVERTERING_STRANDET_MS` — en periodisk watchdog (ikke bare ved
 * oppstart som den tidligere `gjenopptaStrandedeRekonverteringer`) setter en strandet
 * `converting`-rad tilbake til `pending`, og den vanlige poll-løkka plukker den opp
 * på nytt uten noe eget gjenopprettings-steg.
 */
export { erRekonverterbarOriginal, TEGNING_MANGLER_ORIGINALFIL_KODE } from "@sitedoc/shared";

export const KONVERTERING_STRANDET_MS = 10 * 60 * 1000;

/**
 * True når tegningen står i `converting` uten fremdrift siden `updatedAt` i minst
 * `KONVERTERING_STRANDET_MS` — dvs. arbeideren som konverterte den døde (crash/
 * restart) midt i, og ingen livstegn (`lagTegningLivstegn`) har blitt skrevet siden.
 * `pending` er ALDRI strandet (se modul-kommentaren over).
 */
export function erKonverteringStrandet(
  conversionStatus: string | null,
  updatedAt: Date,
  naa: number = Date.now(),
): boolean {
  if (conversionStatus !== "converting") return false;
  return naa - updatedAt.getTime() >= KONVERTERING_STRANDET_MS;
}

/**
 * True når tegningen faktisk er under konvertering eller venter i kø AKKURAT NÅ.
 * `pending` er ALLTID pågår (arbeideren garanterer den blir plukket opp, uansett
 * alder — se modul-kommentaren over). `converting` er pågår med mindre den er
 * strandet (da telles den som feilet i `rekonverteringStatus`, ellers låses
 * «Oppdater alle tegninger»-knappen evig).
 */
export function erKonverteringPågår(
  conversionStatus: string | null,
  updatedAt: Date,
  naa: number = Date.now(),
): boolean {
  if (conversionStatus === "pending") return true;
  if (conversionStatus === "converting") return !erKonverteringStrandet(conversionStatus, updatedAt, naa);
  return false;
}

/**
 * Hvor ofte et livstegn faktisk skrives til DB mens en konvertering pågår — speiler
 * `reprosessering.ts`s `LIVSTEGN_THROTTLE_MS`. Godt under `KONVERTERING_STRANDET_MS`,
 * så en levende jobb holdes fersk mens et reelt crash slutter å skrive og blir
 * strandet etter grensen.
 */
export const TEGNING_LIVSTEGN_THROTTLE_MS = 30 * 1000;

/** Minimal del av Prisma-klienten livstegnet trenger — holder modulen uavhengig. */
type LivstegnPrisma = {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

/**
 * Lager en throttlet livstegn-funksjon for ÉN tegning under konvertering. Hvert kall
 * bumper `drawings.updated_at = now()` (maks hvert `TEGNING_LIVSTEGN_THROTTLE_MS`),
 * gjerdet på `conversion_status = 'converting'` slik at et sent livstegn aldri
 * gjenopplivar en rad som allerede er skrevet `done`/`failed` av hovedveien.
 *
 * `naa` injiserbar for test. Feil svelges (logges) — et tapt livstegn skal aldri
 * velte selve konverteringen.
 */
export function lagTegningLivstegn(
  prisma: LivstegnPrisma,
  tegningId: string,
  naa: () => number = Date.now,
): () => Promise<void> {
  let sistSkrevet = 0;
  return async () => {
    const n = naa();
    if (sistSkrevet !== 0 && n - sistSkrevet < TEGNING_LIVSTEGN_THROTTLE_MS) return;
    sistSkrevet = n;
    try {
      await prisma.$executeRaw`
        UPDATE drawings
        SET updated_at = now()
        WHERE id = ${tegningId} AND conversion_status = 'converting'
      `;
    } catch (err) {
      console.warn(`[DWG] livstegn feilet for ${tegningId}:`, err);
    }
  };
}
