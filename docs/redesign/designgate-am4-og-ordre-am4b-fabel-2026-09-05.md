# DESIGNGATE AM 4 — fabel 2026-09-05

**Vurdert:** Kenneths test-verifisering + to skjermbilder (arkivsiden `/dashbord/firma/malarkiv`, lån-dialogen), jf. designnotatet § DESIGNGATE-FUNN 2026-09-05.

## Verdikt: GODKJENT — bolk 1+2 kan meldes klar for commit/merge

Mot mockup og designlås:
- Amber FIRMA-sone ✓ (stiflyttingen til `/dashbord/firma/` var riktig grep — min opprinnelige sti hadde gitt blå sone)
- Tre faner, typene adskilt (L9) ✓ · «Lånt fra SiteDoc»-badge = B4-avstamning synlig i UI ✓ · lån ende-til-ende ✓
- Kolonnesettet (prefiks/versjon/punkter/i bruk/standard-toggle) dekker mockup A; «Punkter»-tellingen er en god tilføyelse utover mockupen — behold.
- Hjelpelinjen «Innhold redigeres i firma-modus i malbyggeren — kommer i egen runde» er ærlig om avgrensningen ✓. Firma-modus (L8) og seeding (steg 5) står som rest — gaten gjelder bolk 1+2.

De to funnene er SKALA-funn, ikke avvik fra låsene — de blokkerer ikke merge, men går som oppfølgingsordre (under) før arkivet fylles med reelle maler.

## Coworks observasjon — mitt kall: ÉN interaksjonsmodell, IKKE én komponent nå

Ja, det er samme designproblem som BL-velgeren. Men flatene er ulike nok (modal-lån vs. felt-velger i skjema) til at en delt komponent nå ville vært prematur abstraksjon — vi har ett eksempel i drift og ett som ikke er designet. Vedtak:
- Jeg definerer **«velger ved skala»-mønsteret** som designregel i oppfølgingsordren: grupper kollapsbare (persistert), søk over navn+kode fra >20 elementer, inspiser-før-valg uten å forlate velgeren.
- AM 4-oppfølgingen implementerer mønsteret i lån-dialogen. BL-designsaken PEKER på mønsteret og gjenbruker spesifikasjonen; om komponenten da kan deles, avgjøres i BL-ordren med to reelle flater på bordet.
- Rekkefølgen fra 05.09 står uendret — mønsteret er en del av AM 4-oppfølgingen, ikke en ny sak foran LP.

---

# OPPFØLGINGSORDRE AM 4b — lån-dialog ved skala (til redesign-Opus, relayes av Kenneth)

**Grunnlag:** Kenneths to funn 05.09 (§ DESIGNGATE-FUNN). Liten ordre, samme branch-disiplin.

## Designlås
- **L1 inspiser før lån:** hver rad i lån-dialogen kan ekspanderes/åpnes til en forhåndsvisning av malens FELTER (feltnavn + type i rekkefølge, read-only) uten å forlate dialogen og uten å låne. Lån-knappen står i forhåndsvisningen også. Aldri «lån og se etterpå».
- **L2 kollapsbare kapitler:** kapittelgrupper (KA, KB, …) kan minimeres per kapittel; header viser antall («KB Jord og vegetasjon · 3»). Starttilstand: alle KOLLAPSET når arkivet har >20 maler, ellers utbrettet. Tilstand huskes i økten.
- **L3 søk:** søkefelt over navn+kode; treff viser sitt kapittel utbrettet automatisk. Tomt søk → tilbake til kollaps-tilstanden.
- **L4 mønster-status:** dette er «velger ved skala»-mønsteret — dokumenteres slik at BL-designsaken kan gjenbruke spesifikasjonen. Ingen delt komponent bygges nå.

## Klikk-budsjett (DoD)
- Inspisere én mal: 1 klikk (åpne forhåndsvisning), 1 klikk tilbake/lukk
- Lån av kjent mal via søk: ≤ 3 interaksjoner (søk → treff → Lån)
- Dagens lån-flyt uten søk: uendret antall klikk

## Verifisering (DoD)
1. Build grønn · 2. Test med seedet arkiv >20 maler: kollapset start, søk, inspiser, lån — skjermbilder til fabel-gate · 3. Exit-protokoll + dok-sync (designnotatet § DESIGNGATE-FUNN kvitteres løst).
