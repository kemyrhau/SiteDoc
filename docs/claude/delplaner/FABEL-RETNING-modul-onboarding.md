# Fabel — DESIGNRETNING: modul-onboarding, tredje tilstand — 2026-08-11

Svar på cowork-spørsmål 2026-08-11. Retning, ikke ferdig ordre — cowork
skriver ordren mot denne.

## Hovedbeslutning: eksplisitt modell, per DATATYPE — aldri utledet

1. **Utledning fra data avvises.** Hele problemet er at tilstand 1 (aldri
   onboardet) og tilstand 3 (bevisst egen katalog) er identiske i data —
   «finnes det rader?» kan per definisjon ikke skille dem. Enhver heuristikk
   («har nivå 2-rader → egen katalog») er en gjetning som blir ny stille
   divergens. Kenneths intensjon om A.Markussens lønnsarter finnes i hodet
   hans, ikke i databasen — da må den skrives NED, ikke utledes.
2. **Per datatype, ikke per modul.** Coworks eget bevis avgjør: A.Markussen
   har egen lønnsartkatalog OG fikk nettopp standard utleggskategorier —
   samtidig, i samme modul. Et felt per modul kan ikke uttrykke det som
   allerede er sann tilstand i prod i dag.

## Konkret modell

Egen liten tabell (ikke felt på Organization/OrganizationModule):

```
OrganizationSeedPolicy
  organizationId  FK
  datatype        enum (lonnsart, utleggskategori, hms_omrade, aktivitet, …)
  policy          enum: 'standard' | 'egen_katalog'
  begrunnelse     tekst (påkrevd ved 'egen_katalog' — hvem/hvorfor)
  settAvUserId, settDato
UNIQUE (organizationId, datatype)
```

- Fravær av rad = 'standard' (default). Kun avvik registreres — ingen
  backfill-plikt for alle kunder.
- `begrunnelse` er ikke pynt: tilstand 3 er en beslutning, og beslutninger
  uten spor er slik dagens situasjon oppsto.
- Settes av sitedoc_admin (evt. firma-admin senere — ikke i første omgang).

`aktiverTomKatalog`-sporet UTVIDES IKKE — det svarer på modulnivå og bærer
en annen semantikk («migrerer fra annet system»). La det stå; det kan på
sikt skrive policy-rader i stedet, men det er opprydding, ikke del av dette.

## Seed-rutinen

- ÉN generisk aktiveringsvei: `organisasjon.settFirmamodul` kaller modulens
  seed-hook (samme transaksjon, som `hms-avvik` allerede gjør — det mønsteret
  er fasit). Timers parallelle vei (`aktiverNivaa1`) konvergeres inn;
  maskin/varelager får hooks. `onOrganizationCreated`-hooken i
  arkitektur-syntese § 3.8 finnes ikke — syntesen rettes eller hooken bygges,
  ikke begge deler halvveis.
- Hooken seeder per datatype og hopper over datatyper med
  `policy = 'egen_katalog'`. Idempotent: «finnes rader?» brukes KUN som
  hopp-over-guard ved policy 'standard' (tilstand 2), aldri som
  tilstandsdetektor for 3.

## onboarding.status / rapportering

Tilstand 3 rapporteres som **komplett med merkelapp**, aldri «ufullstendig»:
«Lønnsarter: egen katalog (satt av X, dato)». Tre visningsverdier:
`komplett` / `komplett_egen_katalog` / `mangler`. En diagnostikk som fortsatt
teller tilstand 3 som mangel ville reprodusere feilen cowork advarer mot —
en «forbedring» som ødelegger en riktig kunde.

## Første handling i ordren

Backfill av den ENE kjente tilstand 3-raden: A.Markussen + lonnsart →
'egen_katalog', begrunnelse = Kenneths føring (sitat), settAv = Kenneth.
Da er prod-sannheten uttrykt i modellen fra dag én, og seed-rutinen kan
aldri treffe dem.

## Svar på coworks direkte spørsmål

- Modell-endring eller utledning? **Modell-endring.** Ny tabell, additiv,
  ingen migrering av eksisterende data utover den ene policy-raden.
- Skal onboarding.status rapportere tilstand 3 annerledes? **Ja** — komplett
  med merkelapp, aldri ufullstendig.

— fabel (relayet av Kenneth)
