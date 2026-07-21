---
name: cowork-rapport-2026-07-20
status: 🟢 RAPPORT — cowork → fabel. Fem beslutninger venter
eier: cowork (rapport) · fabel (beslutninger)
sist_verifisert_mot_kode: 2026-07-20
---

# Cowork-rapport til fabel — 2026-07-20

> Status etter N3 del 1+2, sak 1 og spor 1. Skrevet fordi flere spor er lukket samtidig og køen trenger prioritering. **Fem beslutninger venter på deg** (§ 4).

## 1. Levert og lukket

| Sak | Utfall | Bevis |
|---|---|---|
| **N3 del 1** (`96d5d2c0`) | Liste-synlighet for person-direkte flyt-medlem | 8 tester, T1/T4/T5/T6 ✅ — men **partiell**, detalj+opprett urørt |
| **N3 del 2** (`d2863dd5`) | Detalj-lese + opprett + G3 feilmelding-skille | D1/D2/D3/D5/D6/D7 ✅, D4 kode-verifisert |
| **A-3a Del E** | **Lukket** | kmy=utforer: `received` → Avvis «KUN ADMINISTRATOR» · `responded` → Godkjenn/Send tilbake/Videresend «KUN GODKJENNER» |
| **Sak 1 — paritet** (`fd573b61`) | Flyt-medlemskap likestilt med faggruppe; `tillatFlytMedlemskap`-flagget fjernet, grenen ubetinget på alle 17 call-sites | S1 ✅ (skriving virker der den før ga «ikke tilgang») · S2 ✅ · S7 ✅ · S3/S4/S5/S6 kode-verifisert |
| **Spor 1 — CI** (PR #1, #2) | CI finnes nå: `pnpm test` på PR **og** push til develop, `permissions: contents: read` | Grønn på faktiske kjøringer (29731575055, 29740186107) |

**Del E-avklaringen er verdt å merke seg:** den så ut som en feil («menyen er ikke rollefiltrert») helt til vi målte at kmy var **registrator**, og at `statusHandlinger.ts:85` + `erTillattForRolle:7` gjør registrator til superbruker på **begge** sider. Funksjonen virket hele tiden; testsubjektet kunne ikke demonstrere den. Med utforer falt den på plass umiddelbart.

## 2. Funn som endrer bildet

**a) CI-hullet vi bygde og merget forbi samme dag.** Trigger var kun `pull_request`, men vår merge-konvensjon er `git push origin HEAD:develop` fra merge-treet — uten PR. Sak 1 landet slik og ble aldri testet av CI. Lukket i PR #2 (`push: [develop]` lagt til). Verdt å ta med i planleggingen: **konvensjon og verktøy må være samstemte, ellers er gaten dekorasjon.**

**b) Mobil-configen skjulte 19 ekte funn.** `eslint-plugin-react-hooks` var aldri installert, så tre `eslint-disable`-kommentarer ga «rule not found». Etter fiks: mobil lint 12 → **28** — 18 `exhaustive-deps`-warnings og **1 `rules-of-hooks`-error**: `apps/mobile/src/components/TegningsCapture.tsx:38`, `useCallback` kalt betinget etter tidlig return. **Det er en reell React-korrekthetsbug, ikke stil** — hook-rekkefølgen endrer seg mellom renders. Kan ha gitt mobil-symptomer som aldri ble sporet hit.

**c) To fantom-funn strøket.** «Treg periode-refresh / cache-TTL» (observert i D6 og S5) finnes ikke: begge sporer til SQL som aldri kjørte (havnet i Mac-shellen) eller til at raden var NULL hele tiden. **Ingen evidens for cache.** Og «klient/server-divergens» i S2 finnes heller ikke — begge sider er enige om at registrator er superbruker.

**d) Prosesslærdom: manuelle DB-endringer under testkjøring ødelegger attribusjon.** Kenneth syklet kmys rolle gjennom alle fire under S1/S2 (legitimt — han sammenlignet). Resultatet er at vi kan si *at* noe virket, men ikke *hvorfor*. Dette er argumentet for spor 2s matrise-test i renform: deterministisk, ingen delt muterbar tilstand.

## 3. Kø — hva som står igjen

| Sak | Tilstand | Blokkert av |
|---|---|---|
| **Spor 2** — matrise-test → ekstraksjon | Ordre skrevet, cowork-gatet | **Din gate** |
| **Sak 2** — opprett→usynlig | Ordre skrevet + gatet | Spor 2 (samme fil) |
| **A-3b** — perspektiv-prinsippet | **Gate-godkjent, men ingen økt eier den** | Ingenting — den er foreldreløs |
| **Sak 3** — HMS-synlighet-regel | Sak skrevet, design-punkter åpne | Timing-beslutning |
| **Sak 1b** — bør mutasjoner rollestyres? | Arkitektursak skrevet | Prioritering |
| **Lint/typecheck-gjeld** | Trinn 1 utført, resten målt | Prioritering |
| **TegningsCapture-bug** | Nytt funn, ikke plassert | Trenger mobil-kapabel økt |

## 4. Beslutninger som venter på deg

1. **Spor 2 — gate ekstraksjonsordren.** Den er skrevet og cowork-gatet; du sa du ville gate den før start. Kjernen: matrise-testen skrives mot **dagens** oppførsel FØR ekstraksjonen, og kjøres mot begge sider. Rekkefølgen er hele poenget — skrives den etter, tester den bare at ny kode er enig med seg selv.

2. **A-3b — hvor i køen?** Den er den eneste gate-godkjente ordren uten eier. Perspektiv-tabellen (Del 1a) er første leveranse og krever din designgate. Skal den tas av spor 2-økta etter ekstraksjonen, eller av en egen Opus parallelt? Den rører visningslag + `@sitedoc/shared` — kolliderer ikke med spor 1, men **overlapper spor 2 i `packages/shared`**.

3. **TegningsCapture-bugen — egen sak nå, eller backlog?** Cowork-anbefaling: **egen sak**, men **ikke** som lint-rydding. Å flytte en hook endrer komponentens oppførsel og krever mobil-bygg + simulator for verifisering. Den hører hjemme hos en mobil-kapabel økt, ikke hos den som rydder `prefer-const`.

4. **Skal lint-ryddingen fortsette i det hele tatt?** Cowork-anbefaling: **stopp etter trinn 1.** Resten (`pdf` 7, `web` 2+, `api` 57) er kosmetikk sammenlignet med køen. En Opus som rydder ubrukte variabler mens tilgangslaget mangler regresjonsvern, jobber på feil sted. Unntaket er `shared` typecheck (2) — den har forvirret to økter og koster lite.

5. **Sak 3 (HMS-synlighet) — før eller etter A-3b?** Cowork-anbefaling: **etter**. A-3b er større og har Kenneth-vedtatt fundament; sak 3 er avgrenset config og blokkerer ingenting. Merk avhengigheten: når sak 3 innfører `null = normal flyt`, **må** F1-A-betingelsen endres fra `!== "apen"` til `=== "privat"`, ellers behandles null-HMS feilaktig som privat.

## 5. Cowork-anbefalt rekkefølge

**Spor 2 → sak 2 → A-3b → sak 3 → sak 1b.** Begrunnelse: spor 2 gir varig regresjonsvern på laget vi har brukt mest tid på, og sak 2 rører samme fil (bør følge rett etter mens konteksten er fersk). A-3b er størst og bør ha en ren økt. Sak 1b er et designspørsmål uten hastverk — men det bør ikke glemmes, for det er det eneste stedet der modellen faktisk kan være feil, ikke bare ufullstendig.

**TegningsCapture parallelt** når en mobil-økt finnes — den er fil-disjunkt fra alt annet.
