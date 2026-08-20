// STEG 1 (flytmodell-fjerning): normaliser `DocumentTransfer.senderRolle` for arkiv-PDF-ens
// dokumenthistorikk. TRE former må håndteres:
//   1. Kjent enum (registrator/bestiller/utforer/godkjenner) → norsk etikett (arkiv-PDF er
//      norsk-only, ingen locale i pipelinen — jf. hardkodet handling-tekst i logg-lesere).
//   2. Posisjonsetikett («Ledd 2 av 4», skrevet av senere F-serie) → vis som-det-er, allerede
//      visningsklar.
//   3. Tom/ukjent → «—». FORVENTET tilfelle: mange prod-rader har `sender_rolle = null`.
//
// Ren funksjon, ingen avhengigheter (packages/pdf er null-deps). Verdiene speiler
// i18n-nøklene `dokumentflyt.{registrator,bestiller,utforer,godkjenner}` i nb.json.

const ROLLE_ETIKETT: Record<string, string> = {
  registrator: "Registrator",
  bestiller: "Bestiller",
  utforer: "Utfører",
  godkjenner: "Godkjenner",
};

/** Posisjonsetikett fra F-serien — allerede visningsklar, f.eks. «Ledd 2 av 4». */
const POSISJONSETIKETT = /^Ledd \d+ av \d+$/;

/**
 * `senderRolle` (rå) → visningsklar rolle-tekst for logg-raden.
 * Kjent enum oversettes; posisjonsetikett vises uendret; alt annet (tom/null/ukjent) → «—».
 */
export function formaterAktorRolle(rolle: string | null | undefined): string {
  if (rolle == null || rolle.trim() === "") return "—";
  const kjent = ROLLE_ETIKETT[rolle];
  if (kjent) return kjent;
  if (POSISJONSETIKETT.test(rolle)) return rolle;
  return "—";
}
