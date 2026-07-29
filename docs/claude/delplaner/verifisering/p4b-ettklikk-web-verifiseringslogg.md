---
name: p4b-ettklikk-web-verifiseringslogg
status: 🔵 Ledd 2 bygget — build+tester grønt. Venter harness/e2e (chip-tilstander + flyt) + fabel task-walkthrough
eier: kode-Opus (P4b) · fabel (walkthrough) · cowork (merge)
branch: feat/p4b-ettklikk-web (fra origin/develop, post-P1/P2/P3 `50ce6d90`)
ordre: relay/inbox-opus-p4b-web.md [2026-07-29] (GO Ledd 2, server-fritt)
sist_verifisert_mot_kode: 2026-07-29
---

# P4b — web ett-klikk opprett + delt kontekst-chip-linje (verifiseringslogg)

Ledd 2-bygg etter fabel-gate (alle 5 nå-sjekk-funn godkjent, server-fritt). Målbilde:
ett klikk «Opprett» → rett inn i utfylling; kontekst-chip-linje øverst (prosjekt ·
byggeplass · faggruppe · mal), hver chip = velger; mal-velger gruppert per flyt ved
flertydighet; redigerbar tittel.

## Fabel-vedtak (relay [2026-07-29]) → implementasjon

| # | Vedtak | Implementert |
|---|--------|--------------|
| 1 | Ny delt `DokumentKontekstChipLinje` på **hevede** trakt-primitiver (ikke kopi, ikke header-chip) | `components/kontekst-chip/trakt-primitiver.tsx` (TraktRad/NivåRad/SøkeFelt/SeksjonsLabel hevet fra `layout/KontekstChip.tsx` — sistnevnte importerer nå tilbake) + `components/kontekst-chip/DokumentKontekstChipLinje.tsx` (generisk chip-array, gjenbrukbar oppgave/sjekkliste/HMS + P4c) |
| 2 | >1 mal → sist brukt → favoritt/eneste → **mellomvalg**; aldri gjett blindt | `useSistBrukteMal` (klient-lokal interim) + auto-hopp i `åpneMalVelger` (begge list-sider). Entydig treff → opprett direkte; 0/flere → mellomvalg (flyt-gruppert modal) |
| 3 | Mal-gruppering per flyt — inverter **klient-side**, ingen ny server-relasjon | `flytGrupper`-derivat i `sjekklister/page.tsx` fra `malFlytStatus` (flyt = overskrift v/≥2 flyter, maler under). Klikk = entydig → opprett direkte, ingen steg-2 |
| 4 | Detaljside → utfyllingsmodus: chip-linje + redigerbar tittel (mockup 2a) | Chip-linje + redigerbar tittel (blyant → input, Enter/blur lagrer via eksisterende `oppdater`) på sjekkliste- OG oppgave-detaljside |
| 5 | Tittel-regen = default-fyll, kun-når-uendret; malbytte-regen som krever ny server-logikk → STOPP + flagg | Tittel redigerbar; **malbytte etter opprettelse ikke bygget** (krever ny server-mutasjon) → mal-chip er display-only, flagget som egen sak (§ Malbytte-flagg) |

## Server-fritt (bekreftet)
Ingen ny query/mutasjon. All chip-overstyring bruker eksisterende `sjekkliste.oppdater`
/`oppgave.oppdater` (title, byggeplassId/drawingId, utforerFaggruppeId — server tillater
faggruppe-endring kun i draft). Byggeplass-default ved opprett = P2 (uendret).

## «Sist brukt mal» — klient-lokal INTERIM (fabel-krav)
`hooks/useSistBrukteMal.ts`: localStorage, nøkkel `sitedoc_sistbruktmal_${userId}` →
`Record<flytNøkkel, malId>`. **Per bruker + flyt** (sjekkliste: flytId; oppgave:
`oppgave:${prosjektId}` — trygt fordi oppgave-mal→flyt er deterministisk via `matchDf`,
kan aldri gi feil mal på tvers av flyter). Miss → fallback-stigen. Merket i koden som
interim; flyttes server-side hvis/når malbytte-saken bygger server-støtte.

## Klikk-tall (mål 1)
- Sjekkliste/oppgave-opprett v/1 mal: **1 klikk** (P2, uendret).
- v/>1 mal MED sist-brukt-treff: **1 klikk** (nytt — auto-hopp).
- v/>1 mal UTEN treff: **2 klikk** (Opprett → velg i flyt-gruppert modal) — det ene lovlige mellomvalget.
- Detaljside lander i utfyllingsmodus m/ chip-linje + redigerbar tittel (overstyring 2 klikk, uten å forlate skjemaet).

## Divergenser (bevisste, dokumentert)
- **Oppgave byggeplass-chip = display-only:** `oppgave.opprett`/`oppdater` har ikke `byggeplassId` (byggeplass er tegning-avledet — audit V2 sak B). Sjekkliste har byggeplass som velger; oppgave viser tegningens byggeplass. Ikke skjult mangel — server-forskjell.
- **Oppgave-modal ikke flyt-gruppert:** oppgave auto-resolver flyt (`.find()` first-match, ingen `malFlytStatus`). Flyt-gruppering (fabel #3) gjelder sjekkliste der samme mal kan ligge i flere flyter. Oppgave beholder flat mal-liste + sist-brukt-auto-hopp.

## Malbytte-flagg (fabel #5 STOPP → egen sak)
Malbytte ETTER opprettelse (endre `templateId` på eksisterende dokument + migrere/
regenerere sjekkpunkter + løpenummer + tittel) krever NY server-mutasjon (finnes ikke:
`oppdater`-input tar ikke `templateId`). Utenfor P4b (server-fritt). Flagget til
`inbox-cowork.md` som egen backlog-sak. Mal-chip er display-only inntil den bygges.

## Gate-kjede
- [x] **build+tester:** typecheck ren (0 feil); lint 0 nye feil (110 baseline-errors urørt, ingen i mine filer); web-tester 93/93, shared 379/379.
- [ ] i18n 13 språk (nb+en lagt til: `kontekstChip.faggruppeKunUtkast`, `sjekklister.mal`, `sjekklister.utilgjengeligeMaler`, `felles.ingenTreff`) — generate ved merge (P2/P3-konvensjon).
- [ ] harness (chip-tilstander) + e2e (opprett-flyt + auto-hopp) + klikk-tall — test-miljø.
- [ ] fabel task-walkthrough.
- [ ] dok-sync (web.md chip-linje) + merge.

## Berørte filer
Nye: `components/kontekst-chip/{trakt-primitiver,DokumentKontekstChipLinje}.tsx`, `hooks/useSistBrukteMal.ts`.
Endret: `layout/KontekstChip.tsx` (primitiver hevet), `sjekklister/page.tsx`, `sjekklister/[sjekklisteId]/page.tsx`, `oppgaver/page.tsx`, `oppgaver/[oppgaveId]/page.tsx`, i18n `nb.json`/`en.json`.
