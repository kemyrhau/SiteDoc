import * as FileSystem from "expo-file-system/legacy";

const BILDE_MAPPE = `${FileSystem.documentDirectory}sitedoc-bilder/`;

/**
 * Sørg for at bildemappen eksisterer.
 */
async function sikreMappe() {
  const info = await FileSystem.getInfoAsync(BILDE_MAPPE);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BILDE_MAPPE, { intermediates: true });
  }
}

/**
 * Lagre et bilde lokalt i persistent lagring.
 * Returnerer den lokale filstien (file:// URI).
 */
export async function lagreLokaltBilde(
  kildeUri: string,
  filnavn: string,
): Promise<string> {
  await sikreMappe();
  const målSti = `${BILDE_MAPPE}${filnavn}`;
  await FileSystem.copyAsync({ from: kildeUri, to: målSti });
  return målSti;
}

/**
 * Deterministisk lokal sti for et bilde lagret via `lagreLokaltBilde` (samme
 * `filnavn`). Brukes i visning for å falle tilbake til lokalfila mens en fersk
 * opplasting ennå bærer en usignert privat server-URL som 401-er i visning
 * (se `utils/signerteUrler.ts` + funn C). Kun visning — aldri persistert.
 */
export function lokalBildeSti(filnavn: string): string {
  return `${BILDE_MAPPE}${filnavn}`;
}

/**
 * Slett et lokalt bilde etter vellykket server-opplasting.
 */
export async function slettLokaltBilde(lokalSti: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(lokalSti);
    if (info.exists) {
      await FileSystem.deleteAsync(lokalSti, { idempotent: true });
    }
  } catch (feil) {
    console.warn("Kunne ikke slette lokalt bilde:", feil);
  }
}

/**
 * Hent filstørrelse for en lokal fil.
 */
export async function hentFilstorrelse(lokalSti: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(lokalSti);
  return info.exists && "size" in info ? ((info as { size?: number }).size ?? 0) : 0;
}

/**
 * List alle filer i bildemappen.
 * Brukes av opprydding for å finne foreldreløse filer.
 */
export async function listLokalebilder(): Promise<string[]> {
  try {
    const info = await FileSystem.getInfoAsync(BILDE_MAPPE);
    if (!info.exists) return [];
    const filer = await FileSystem.readDirectoryAsync(BILDE_MAPPE);
    return filer.map((f) => `${BILDE_MAPPE}${f}`);
  } catch {
    return [];
  }
}
