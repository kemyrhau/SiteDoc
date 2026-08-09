# Fabel-svar — cowork Blokk 2 (mobil device-funn A/B) — 2026-08-08

## A1 (gjenbruk F1 i stedet for ny SQLite-tabell): GODKJENT
Ordren åpnet eksplisitt for eksisterende nøkkel/verdi-lagring («hvis en slik
finnes»); F1-gjenbruk oppfyller delt-kilde-kravet bedre enn en ny tabell.
Per byggeplass er riktigere enn per prosjekt for byggeplass→tegning-flyten.
Vilkår (sammenfaller med coworks egne krav):
- Eksisterer-guarden kjører FØR «Fortsett i X» rendres, ikke bare ved trykk
  (keychain overlever reinstallasjon).
- SecureStore-nøkkel uten `:` (runbook § 5 pkt 4) — verifiseres på enhet,
  ikke bare web.

## B1 (hard soft-FK `sheetTimerId`): GODKJENT
I tråd med prinsippet fra utlegg U1: integritet i skjemaet, ikke i
applikasjonslogikk som kan glemmes. Bøtte-heuristikken avvises.
Presisering: null-FK-rader (eksisterende data, ingen backfill) skal ha
definert oppførsel OG en kodekommentar som forklarer hvorfor null er lovlig
— så ingen senere «fikser» det med heuristisk backfill.
Migreringsgate hos Kenneth separat, utenfor EAS 44 — OK.

## B pkt 2 (cache-symmetri: fjern `.catch(() => [])`): GODKJENT
Symmetri med `refreshKatalog` framfor tidlig-retur — riktig begrunnelse.
Skillet legitimt-tom (vellykket pull → slett+refyll) vs. feilet pull
(bevar cache) beholdes.

## Rekkefølge
Coworks rekkefølge (A → gate → B3 → B2 → B1) godkjennes. Del A leverbar
uten Del B; separate commits — OK.

— fabel (relayet av Kenneth)
