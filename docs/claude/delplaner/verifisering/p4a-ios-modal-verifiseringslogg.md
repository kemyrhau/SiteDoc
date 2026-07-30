---
name: p4a-ios-modal-verifiseringslogg
status: 🟢 Strukturelt gatet (cowork `7d19e3ea`) + fabel-gatet kandidat #1 — bygget, DoD = Kenneth fysisk iOS-test post-merge
eier: Opus (utførende) · fabel (kandidat-gate) · cowork (gate + merge) · Kenneth (fysisk test)
branch: feat/p4a-ios-modal (fra develop, base origin/develop)
ordre: delplaner/p4-ettklikk-opprett-ordrepakke-2026-07-29.md § P4a
sist_verifisert_mot_kode: 2026-07-30
---

# P4a — Mobil iOS-modal-kollisjon + ett-klikk opprett — verifiseringslogg

Scope: **mobil only** — `OpprettDokumentModal.tsx` + i18n `opprettModal.oppretter` (nb/en).
Server/db/andre komponenter urørt. Sentralisert i komponenten → **0 endringer i de 4 call-sites**
(hjem, sjekkliste/index, oppgave/index, sjekkliste/[id]). `lokasjoner.tsx` bruker `OppgaveModal`
(annen komponent) — utenfor scope.

## Ledd 1 — nå-sjekk = rot-årsak (måling, ingen kode)

**Rot-årsak = to samtidige native iOS-transitions i samme tick.** `OpprettDokumentModal` er en
react-native `<Modal animationType="slide">` (egen UIViewController presentert modalt over stacken).
Ved suksess kalte parentens `onOpprettet` → f.eks. `hjem.tsx` `håndterOpprettet`: satte `synlig=false`
(modalen **starter slide-ut**) OG `router.push('/sjekkliste/${id}')` i **samme render** — pusher på
native-stacken bak modalen mens den fortsatt animerer ut. iOS UIKit tåler ikke push på en
navigation-controller mens en modal-VC er midt i dismiss → «unbalanced begin/end appearance
transitions»: modalen henger, eller navigeringen svelges/dobles.

Auto-opprett-varianten (tidligere deaktivert) er samme klasse motsatt vei: mutasjon fyrt mens modalen
animerte **inn** → onSuccess-nav kolliderte med present-transitionen. Derfor tvang dagens flyt et ekstra
manuelt «Opprett»-trykk.

- **Ikke versjonsspesifikt** — iboende UIKit-atferd (present/dismiss-VC vs. native-stack-push i samme
  tick). Rammer alle iOS-versjoner, timing-sensitivt. **Android upåvirket** (JS-modal er ikke egen VC på
  samme måte).
- **Presedens:** `f5e69756` (MalVelger, del6b klikk-kutt 1) løste NØYAKTIG samme klasse. `mobil.md`
  dokumenterte alt regelen (auto-opprett fjernet + ikke `pageSheet`).
- **Spor på tiltenkt fiks:** propen `onModalLukket?` var alt plumbed inn men ubrukt — scaffoldet for
  «naviger etter at modalen er helt lukket».

3 kandidater rangert (rapport → `inbox-cowork.md`). Fabel valgte **#1** (anbefalt). #2 (full-screen
expo-router-rute) + #3 (ekte ett-klikk uten modal, krever server + mobil chip-detalj) → backlog.

## Ledd 2 — bygget (`7d19e3ea`, kandidat #1)

**A. Serialiser navigering.** `internSynlig`-speil (synkes fra `synlig`-propen) settes false lokalt ved
opprett-suksess → modalen animerer helt ut → navigering skjer i `<Modal onDismiss>` (iOS-only, fyrer
etter full dismiss) via `onModalLukket`. Android navigerer direkte i `onSuccess` (Platform-gren; ingen
kollisjon). `pendingNavId`-ref bærer mål-id gjennom dismiss. Refs nullstilles når modalen lukkes.

**B. Skip modal ved entydig kontekst.** `skalAutoOpprett` = queries ferdig + `faggrupperMedFlyt.length===1`
+ `matchendeDokumentflyter.length===1` + utledet `autoSvarerFaggruppeId`. Effekt fyrer `håndterOpprett()`
én gang (ref-guard). Fullskjerm-spinner «Oppretter…» (`visSpinner`) i stedet for skjema-flash mens
konteksten avgjøres/opprettes; flertydig (≥2) viser det fulle skjemaet.

**GPS best-effort (Kenneth-vedtatt):** auto-opprett fyrer så snart faggruppe+flyt er klare
(tRPC ~100–300 ms), mens GPS tar ~1–2 s → auto-opprettede sjekklister får typisk ingen auto-lokasjon;
settes i detaljskjermen (redigerbar). «Sett kun hvis urørt / vis · GPS»-regelen er bevart i det
modal-viste (ambiguøse) sporet via eksisterende oppførsel. GPS-på-chip + post-opprett-patch = senere
mobil-chip-runde (P4a #2/#3, backlogget).

## Build/verifikasjon

- `tsc` på `OpprettDokumentModal.tsx`: **ren** (0 feil i berørt fil). Mobil-appen har pre-eksisterende
  typegjeld på develop-basen (hjem.tsx TS2589, `erstattVedlegg`, `FlytBrukerInfo`, timerSync m.fl. — alle
  i urørte filer). Prisma-generate-artefakter ryddet før måling.
- eslint: tillagte linjer rene. 4 pre-eksisterende unused-var-errors (uendret gjeld).
- Ingen mobil-test-suite finnes.
- Metro bygget rent på iPhone 16 Plus-simulator fra worktreet (JS-only, ingen native-moduler).

## DoD (gjenstår)

Kenneth fysisk iOS-test **post-merge** (Kenneth valgte merge-først; P4a er lavrisiko + trivielt
revertibel, én komponent): opprett fra hjem + fra liste, ingen hengende modal/dobbel-nav. Fix-forward
hvis testen avdekker noe. i18n `generate.ts` (13 språk) kjøres ved merge (nb/en står).
