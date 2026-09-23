# KS: SiteDoc-nivå i MalBygger — redesigns stopp + coworks vei C

Dato: 2026-09-14 · fra fabel · KS på redesign-melding (feat/malbygger-sitedoc-nivaa)
og coworks måling/anbefaling (objekt-tabell på BibliotekMal).

## KS av redesigns stopp: GODKJENT, forbilledlig
- Stoppet på premiss FØR koding, null commits, avvik meldt i stedet for tolket —
  nøyaktig §5/Krav 2-adferd. Dette er standarden.
- Kjernefunnene er riktige (fabel har selv verifisert i arbeidstreet):
  `felt-${indeks}` + `parentId: null` hardkodet (bibliotek-mal.ts:29),
  `malInnhold Json` på BibliotekMal (schema:2293), rad-modell finnes kun på
  firma/prosjekt (OrganizationTemplateObject schema:1171). «Stille tomhet»-
  klassifiseringen av nesting-tap er korrekt.
- Gate-funnet (verifiserSiteDocAdmin ≠ autoriserMalTilgang, samme jobb) er et
  ordre-avvik hos oss, ikke hos ham. Tas inn i ordre-malen: pek på FAKTISK
  funksjonsnavn, målt — ikke antatt.
- Eneste anmerkning: baseline-gate-tall ble ikke kjørt. Riktig valg her (ingen
  kode), men skal stå eksplisitt som «ikke kjørt — ingen kode» i meldingsmalen.

## KS av coworks vei C (objekt-tabell på BibliotekMal): RIKTIG VALG
A (lappe JSON med id/parentId) gir samme arbeid i bibliotek.ts/firmamal.ts og
etterlater et evig spesialtilfelle. B (flat editor på SiteDoc-nivå) motsier både
fabels D-punkt og Kenneths krav 14.09 («alle 3 nivåer samme egenskaper») — og
gjør «én editor» til en løgn i koden. C fjerner spesialtilfellet. Enig i C.
Repeater-spørsmålet (om SENTRALMALENE skal BRUKE nesting) forblir Kenneths
mal-metode-beslutning — C gir evnen, MAL-METODE styrer bruken.

## Krav fra fabel til C-ordren (utover coworks to-delte plan, som er riktig)
1. **Migreringen (JSON → rader) skal bevise seg selv:** dry-run som per mal viser
   feltantall i JSON == radantall etter, med diff-liste; idempotent (kjørt ×2 =
   samme resultat); negativ kontroll på config/hjelpetekst (§7-sjekken gjenbrukes).
2. **Lånevegen er gate-kritisk:** round-trip-test FØR/ETTER — lån av samme mal
   fra malInnhold-veien og rad-veien skal gi identisk kopi (felt for felt).
   laanFraSentralarkiv, importerMal og dobbeltlån-vakten (#10) skal ha grønne
   tester mot rad-veien før ruting-delen starter.
3. **Ingen dobbel skrivevei:** etter migrering er rader eneste kilde.
   `malInnhold`-kolonnen fryses (leses ikke), fjernes i egen senere runde etter
   verifisert testperiode — aldri samtidig med migreringen.
4. **Sekvens mot malarbeidet:** KC3.1-ordren (8 felt) og resten av 12-mal-køen
   kjøres IKKE parallelt med migreringen — seed-bibliotek.ts bytter skriveform.
   Rekkefølge: C del 1 (tabell+migrering) → KC3.1 på ny form → C del 2 (ruting).
5. **Oversettelser:** rad-modellen har translations-felt; migreringen setter dem
   tomme med definert fallback (norsk) — ikke NULL-udefinert. Henger sammen med
   132-nøkkels-gjelden; ingen ny drift.
6. **Riving:** admin/bibliotek rives først når MalBygger beviselig kan det samme
   (coworks formulering står) — og rivingen er alt bestilt i stoppkorreksen
   14.09; C del 2 lukker den.
7. **Skjemagate:** tabellen speiler OrganizationTemplateObject felt for felt —
   avvik fra speiling krever eget avviksforslag. Kenneth gater migrerings-SQL
   med dry-run-output, som ved #10.

## Svar på Kenneths spørsmål i tråden
«Hvor vanskelig er det at alle 3 nivåer har samme egenskaper?» — Middels (6
filer, 2 blir mindre; coworks måling stemmer med fabels lesning), og C er eneste
vei som gjør det SANT i stedet for simulert. Risikoen bor i migreringen og
lånevegen — derfor krav 1–3 over.
