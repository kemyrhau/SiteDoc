---
name: flytposisjon-header-ordre
status: 🟢 BYGGEORDRE for kode-Opus — flyt-posisjon i dokument-headeren (evolusjon av FlytIndikator). Ren kode. 2026-07-26
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop
design: docs/claude/delplaner/flytposisjon-header-design-2026-07-26.md (fabel — LES FØRST, mockup 4 varianter A–D)
---

# Byggeordre — flyt-posisjon i dokument-headeren

Kenneths test-observasjon: headeren viser *hvem* som har ballen, men ikke *hvor i flyten* dokumentet står, eller *hvorfor Send ikke går* ved siste ledd. Fabel-design: kompakt ledd-rad i headeren. **Dette er en evolusjon av eksisterende `FlytIndikator.tsx`, ikke en ny komponent.**

**LES FØRST:** `docs/claude/delplaner/flytposisjon-header-design-2026-07-26.md` (fabel) + mockupen (4 varianter). Del boks-språket med flyt-konfiguratoren der det gir mening.

## Ufravikelig
- **INGEN migrering** — ren kode (web + evt. shared). **Ikke rør § 0-refaktoren av statusmaskinen.** Ikke rør STATUS-AKTUELT/BACKLOG. Ikke merge — push feature-branch.
- **DYNAMISK (kjernekrav):** raden rendres fra dokumentets FAKTISKE flyt (`byggLedd` grupperer på `steg`) — 2 bokser i 2-ledds flyt, 4 i 4-ledds. Aldri hardkodet 4-rolle-rekke.
- Norsk bokmål, `t()`-i18n, ingen `any`, named exports.

## Scope
1. **Flag 1 — delt kilde:** `byggLedd` + `finnAktivtIndex` ligger duplisert i `FlytIndikator.tsx` OG `DokumentHandlingsmeny.tsx`. Trekk dem ut til én delt kilde (f.eks. `apps/web/src/lib/flyt-ledd.ts`), begge importerer derfra. Ingen dobbel logikk.
2. **Flag 2 — rolle per ledd:** legg til `rolle` i `Ledd`-typen; populer i `byggLedd` fra `FlytMedlem.rolle` (steg-gruppen bærer rollen). Brukes til rolle-etiketten (REGISTRATOR/UTFØRER/… i caps per boks).
3. **Evolvér FlytIndikator til header-displayet** per fabel-designet:
   - Passert ledd (hvit, ✓, dempet), aktivt ledd (fylt blå, ● + `aktivNavn`), kommende ledd (stiplet, dempet).
   - Rolle-etikett caps per boks.
   - **Siste-ledd (variant C):** deaktivert «Send →» med hover «Ingen neste mottaker — flytens siste ledd» + én dempet fotnotelinje med de reelle utveiene (Godkjenn/Send tilbake/Lukk avhengig av status). Svarer på Kenneths observasjon.
   - **5+ ledd (variant D):** kollaps fjerne ledd til «+N»-pille (aktivt ± 1 vises); gjenbruk `filtrerNaboer`; tooltip lister skjulte.
   - **Medlems-hover (Kenneth):** boksen viser ETT navn (gruppe hvis leddet har gruppe, ellers én bruker — hovedansvarlig prioritert); hover ramser opp alle medlemmer (navn + rolle) fra `brukerIder`/`gruppeIder` i `Ledd`. Ingen API-endring.
4. **Plassering:** dokument-headeren, mellom tittel og handlingsknappene (sjekkliste- + oppgave-detaljsidene).

## Ikke i scope (fabel)
Klikk på raden → flytpanel (senere). Endring av ballen-logikken. Boks-dynamikk/gruppevisning som egen samtale.

## DoD
- [ ] `byggLedd`/`finnAktivtIndex` i delt kilde, ingen duplikat; FlytIndikator + DokumentHandlingsmeny importerer derfra.
- [ ] `Ledd.rolle` lagt til + populert; rolle-etikett vises per boks.
- [ ] Header-raden er DYNAMISK (test: 2-ledds flyt viser 2 bokser, 4-ledds viser 4); passert/aktiv/kommende-tilstander; siste-ledd viser deaktivert Send + forklaring + utveier; 5+ kollapser; medlems-hover lister medlemmer.
- [ ] `pnpm --filter @sitedoc/web` typecheck + test grønt (ny test på byggLedd + dynamisk render).
- [ ] Vis diff. Push `feat/flytposisjon-header`. Ikke merge. Ikke rør STATUS/BACKLOG.
