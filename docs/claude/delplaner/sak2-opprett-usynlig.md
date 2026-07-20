---
name: sak2-opprett-usynlig
status: 🔴 REPRODUSERT (cowork, kode-målt 2026-07-19) — klar for fabel-planlegging. Ikke startet
eier: cowork (reproduksjon) · fabel (ordre) · kode-Opus (bygg)
sist_verifisert_mot_kode: 2026-07-19
---

# Sak 2 — «opprett → usynlig»: liste- og detalj-gaten er uenige

> Funn fra N3-del-2-verifisering (web-Opus, test 2026-07-19): kmy opprettet KB2-006, som **ikke vises i lista** men **åpner via direkte URL**. Cowork-reprodusert på kodenivå. **Ikke en del-2-regresjon** — en eldre asymmetri del 2 gjorde synlig.

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus, **ledd 3 (koding)**. Cowork har reprodusert og gatet (denne ordren). **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Branch:** `fix/sak2-oppretter-ser-eget` fra develop (`68f3ddaf`). Du pusher kun denne.

**Leveranse (én fase — omfanget er to OR-grener):** implementer § Fiks-retning → `next build` grønn → push → vis diff til cowork. Avdekker du at endringen treffer bredere enn de to grenene, **stopp og flagg** i stedet for å utvide.

**Ditt neste svar:** diff + build-status.

## Rotårsak (målt)

**Ikke «manglende flyt-binding» — to tilgangsgater som er uenige om samme bruker:**

| Gate | Har bestiller/mottaker-gren? | Konsekvens |
|---|---|---|
| `verifiserDokumentTilgang` (detalj, `tilgangskontroll.ts:557-564`) | ✅ `bestillerUserId === userId \|\| recipientUserId === userId` → tillат | Du **åpner** dokumentet via URL |
| `byggTilgangsFilter` (liste, `:724`) | ❌ `bestillerUserId`/`recipientUserId` finnes **kun** inne i `erFirmaansvarlig`-grenen | Du **ser det ikke** i lista |

Utenfor firmaansvarlig bygger liste-filteret kun på: faggruppe (`bestillerFaggruppeId`/`utforerFaggruppeId` ∈ dine `FaggruppeKobling`), gruppe-domene, og (fra del 1) flyt-medlemskap.

**Sekundærfaktor:** `dokumentflytId` settes aldri ved opprett — klientens `matchDf` finnes via `m.rolle === "oppretter"`, men gyldige rolleverdier er `registrator`/`bestiller`/`utforer`/`godkjenner`. Matchen er **død**, så `dokumentflytId: matchDf?.id` er alltid `undefined`. Binding skjer ved send (bevisst). Derfor redder heller ikke flyt-grenen dokumentet før det er sendt.

## Hvem rammes (bredere enn opprinnelig antatt)

Alle uten `FaggruppeKobling` som ellers har legitim tilgang til dokumentet:
1. **Oppretter** (person-/gruppe-direkte flyt-medlem) — sitt eget nye dokument forsvinner fra lista til det sendes.
2. **Personlig mottaker** (`recipientUserId` satt, ingen faggruppe-kobling) — dokumentet sendt til deg vises ikke i lista, men åpner via URL.

Faggruppe-bundne brukere rammes ikke: deres eget dokument får `bestillerFaggruppeId` = egen faggruppe → fanges av faggruppe-grenen.

## Fiks-retning (cowork-anbefaling)

**La liste-filteret speile detalj-gaten:** legg to OR-grener i `byggTilgangsFilter`:
```
orBetingelser.push({ bestillerUserId: userId });
orBetingelser.push({ recipientUserId: userId });
```
- **Ingen rettighetsutvidelse:** begge brukergrupper kan allerede åpne dokumentet via detalj-gaten — dette gjør bare lista konsistent med det.
- **Stemmer med HMS-regelen:** «Privat = kun innsender, mottaker og HMS-ansvarlige» — innsender/mottaker skal nettopp se sitt eget. HMS-lista AND-er dessuten `byggHmsSynlighetsFilter` på toppen (uendret).
- **Smal:** to linjer, ingen datamodell-endring, ingen flyt-semantikk rørt.

**Forkastede alternativer:**
- *Bind `dokumentflytId` ved opprett* — større inngrep i flyt-semantikken (endrer hvordan hvert dokument får flyt), og fikser ikke mottaker-tilfellet.
- *Reparer den døde `"oppretter"`-matchen* — «oppretter» er ingen gyldig rolleverdi; ville krevd rollemodell-endring for å løse et liste-problem.

## Henger sammen med
- **G1-mutere** (de 11 mutasjonene mangler flyt-grenen) — begge er konsekvenser av at tilgangsgatene er utviklet hver for seg. Verdt å planlegge i samme runde.
- N3-lærdommen: [inventer alle tilgangsstier] — ved «gate X ser ikke Y», sammenlign **alle** gater som styrer samme objekt før fiks.

## DoD-skisse
Kode → `next build` grønn → test: (1) person-direkte medlem oppretter dokument → **vises i lista umiddelbart**, (2) personlig mottaker uten faggruppe ser dokumentet i lista, (3) negativ kontroll: bruker som verken er bestiller/mottaker/faggruppe/flyt ser fortsatt ingenting, (4) admin uendret, (5) HMS-privat fortsatt skjult for uvedkommende.
