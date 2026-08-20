// STEG 1 (flytmodell-fjerning): normaliser `DocumentTransfer.senderRolle` for arkiv-PDF-ens
// dokumenthistorikk. FIRE former må håndteres (Kenneth-presisering 2026-08-20 — deler
// fabels opprinnelige «tom/ukjent som ett tilfelle» i to, fordi de bærer ulik informasjon):
//   1. Kjent enum (registrator/bestiller/utforer/godkjenner) → norsk etikett (arkiv-PDF er
//      norsk-only, ingen locale i pipelinen — jf. hardkodet handling-tekst i logg-lesere).
//   2. Posisjonsetikett («Ledd 2 av 4», skrevet av senere F-serie) → vis RÅTT, allerede
//      visningsklar.
//   3. Tom/null → BLANK (ingen strek). ~⅓ av prod-radene har `sender_rolle = null`; en «—»
//      i hver tredje historikk-rad er støy som ikke informerer.
//   4. Ukjent ikke-enum (f.eks. «kontrollør», en fjernet/korrupt type) → vis RÅTT. En ukjent
//      verdi ER informasjon — å erstatte den med en strek kaster bort det eneste vi vet. Samme
//      prinsipp som posisjonsetikettene: vi kaster aldri en lagret verdi vi ikke forstår — den
//      kan være neste års etikettformat.
//
// FORBEHOLD (persondata, fabel): rått ukjent-innhold er persondata-nøytralt fordi feltet ALLTID
// har vært rolle-/etikett-tekst, aldri fritekst. Endres det (feltet begynner å bære fritekst),
// MÅ rått-visningen (form 3 + 4) revurderes.
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
 * `senderRolle` (rå) → visningsklar rolle-tekst for logg-raden. Fire former:
 * tom/null → BLANK · kjent enum → oversett · posisjonsetikett → rått · ukjent → rått.
 */
export function formaterAktorRolle(rolle: string | null | undefined): string {
  // 1. Tom/null → BLANK (ingen strek).
  if (rolle == null || rolle.trim() === "") return "";
  // 2. Kjent enum → norsk etikett.
  const kjent = ROLLE_ETIKETT[rolle];
  if (kjent) return kjent;
  // 3. Posisjonsetikett («Ledd N av M») → vis rått (kjent, visningsklar form).
  //    Beholdt eksplisitt selv om (4) også gir rått — dokumenterer den som en tiltenkt
  //    råform, ikke et uventet fall-through.
  if (POSISJONSETIKETT.test(rolle)) return rolle;
  // 4. Ukjent ikke-enum → vis RÅTT (kaster ikke bort det vi vet).
  return rolle.trim();
}
