# Ordre til redesign-Opus — mobil device-funn 2026-08-08 (Kenneth-test)

Kilde: Kenneths enhetstest 2026-08-08 (skjermbilder 18:00–18:45, prosjekt 998 Instinniforbotn).
Fabel har verifisert alle funn mot faktisk kode. Fire deler, prioritert rekkefølge.
Krav: rotårsaksfiks, ikke plaster. Delte kilder fremfor duplisert logikk. Guards og
feilhåndtering eksplisitt. Pilot-kontekst: mobil + timeregistrering viktigst.

---

## Del A (P1) — Tegninger: trykk på tegning skal åpne tegningen

**Funn (verifisert):** `apps/mobile/app/(tabs)/tegninger.tsx` renderItem gjør
`router.push("/lokasjoner")` UTEN tegning-id. Brukeren må deretter velge byggeplass
og tegning på nytt (2+ ekstra trykk). Tegningen som ble trykket kastes.
I `lokasjoner.tsx` er `valgtTegningId` ren `useState` — nullstilles ved hver mount,
ingen minne om sist valgte tegning.

**Ordre:**
1. Send `tegningId` (og byggeplass-id om tilgjengelig) som route-param fra
   tegnings-listen; `lokasjoner.tsx` initialiserer `valgtTegningId` fra param og
   åpner tegningen direkte. Guard: finnes ikke tegningen i prosjektets liste
   (slettet/annet prosjekt), fall tilbake til dagens velger — aldri krasj/blank.
2. Persister sist valgte tegning **per prosjekt** i SQLite (offline-vennlig, ikke
   AsyncStorage — samme lagringsmønster som øvrige *_local-tabeller eller en
   nøkkel/verdi-tabell hvis en slik finnes). Skrives ved hvert tegningsvalg.
3. «Fortsett i <tegningsnavn>»-snarvei øverst i Tegninger-fanen når lagret verdi
   finnes og tegningen fortsatt eksisterer i prosjektet.
4. Én delt kilde for «åpne tegning X»-navigering (helper), brukt av både listen,
   snarveien og evt. fremtidige innganger — ikke tre kopier av param-bygging.

**DoD:** fra Tegninger-fanen: 1 trykk på rad → tegningen vises. App-restart →
snarveien står der og virker offline (cached tegning). Slettet tegning → graceful
fallback til velger.

---

## Del B (P2) — Timer: maskinregistrering er i praksis utilgjengelig

**Funn (verifisert):**
- Maskin kan KUN legges til i maskin-seksjonen i «+ Legg til timer-rad»-modalen,
  og kun ved NY rad (`TimerSeksjon.tsx` ~1452). Redigering av eksisterende rad har
  ingen maskin-inngang. Auto-utfylte dagskort (genererForslag) lager aldri
  maskinrader → arbeideren som får dagen auto-utfylt har INGEN vei til å føre maskin
  uten å slette/nyføre raden.
- Seksjonen gates av `redigerbar && harEquipmentCache`. Tom Equipment-cache →
  inngangen forsvinner stille (kjent device-funn #4: krevde seed + re-login).
- Samtidig vises kapasitets-banneret «Herav maskin 0.00t av Xt arbeid» så snart
  cachen er populert — banner uten inngang er selvmotsigende, og ordlyden er
  allerede flagget som misforståelig i BACKLOG (arbeider leser det som at
  maskintimer ER ført).

**Ordre:**
1. Maskin-seksjon også ved **redigering** av eksisterende timer-rad. Gjenbruk
   nøyaktig samme seksjon/komponent som ny-rad-banen (én kilde). Semantikk ved
   eksisterende maskinrad knyttet til timer-raden: vis/rediger den, ikke dupliser.
2. Tom Equipment-cache: aldri stille skjuling. Vis nedtonet rad «Ingen maskiner
   tilgjengelig — synkroniseres fra firmaets utstyrsregister» (i18n-nøkkel).
   Undersøk og fiks rotårsaken til at cachen var tom på Kenneths enhet
   (seed-/refresh-flyten fra device-funn #4 — cache-refresh skal ikke kreve
   re-login).
3. Kapasitets-banneret «Herav maskin …» skjules når maskin = 0.00t. (Ved maskin
   > 0 beholdes dagens ordlyd — allerede omformulert én gang.)

**DoD:** auto-utfylt dagskort → arbeider kan legge maskin på eksisterende rad i
≤ 2 trykk fra raden. Tom cache → forklarende tekst, ingen usynlig funksjon.
Banner vises aldri uten at maskintimer finnes.

---

## Del C (P3) — Hjem: innboksen skalerer ikke

**Funn (verifisert):** `app/(tabs)/hjem.tsx` viser `innboksElementer.slice(0, 10)`
inline uten kollaps. Med mange meldinger skyves Oppgaver/Sjekklister/
Kontrollplaner/HMS under skjermkanten.

**Ordre:** vis maks 3 elementer inline + «Se alle (N)»-rad som navigerer til
Boks-fanen. Badge-tallet i seksjonshodet beholdes som totalantall. Ingen
kollaps-tilstand å persistere (bevisst enkel løsning).

**DoD:** med 10+ innbokselementer er Oppgaver/Sjekklister/Kontrollplaner/HMS
synlige uten scroll forbi 3 innboksrader på standard mobilhøyde.

---

## Del D (P3) — Byggeplass-velger: marker hvilken byggeplass som arves

**Funn (verifisert):** velgeren har «Arv fra dagskortet»-rad med hake, og rader
uten override viser nedtonet «(fra dagskortet)» — men listen over byggeplasser
markerer ikke HVILKEN som er den arvede.

**Ordre:** i `ByggeplassVelger`/prosjekt-byggeplass-modalen: undertekst
«· arves fra dagskortet» (i18n) på raden som tilsvarer dagskortets byggeplass,
kun når «Arv fra dagskortet» er valgt eller tilbys. Ingen logikkendring.

**DoD:** velgeren viser tydelig hvilken konkret byggeplass arven peker på.

---

## Kenneths OK-funn (ingen handling)
- #3 valgt lokasjon/byggeplass synlig på Hjem — OK.
- #4 automatisk tidslogging — OK.
- #8 GPS fortsetter på dagskortet — OK.

## Rekkefølge og exit
A → B → C → D. Hver del: exit-protokoll per FABEL-RAMMEVERK (verifisert mot kode,
dokumentasjonssync ved exit). Fabel designgodkjenner før «klar for commit/merge».
