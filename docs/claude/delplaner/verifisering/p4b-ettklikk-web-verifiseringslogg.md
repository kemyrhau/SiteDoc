---
name: p4b-ettklikk-web-verifiseringslogg
status: 🟢 FABEL FULL GODKJENNING (task-walkthrough) — dok-sync gjort, venter cowork-merge
eier: kode-Opus (P4b) · fabel (godkjent) · cowork (merge)
branch: feat/p4b-ettklikk-web (fra origin/develop, post-P1/P2/P3 `50ce6d90`)
ordre: relay/inbox-opus-p4b-web.md [2026-07-29] (GO Ledd 2 + pkt 0 + Løype 1/2)
sist_verifisert_mot_kode: 2026-07-30
---

> **🟢 Fabel-designgate: FULL GODKJENNING** på task-walkthrough av de 8 bevisene (2026-07-30).
> Siste steg = dok-sync (`web.md` + denne loggen), så cowork-merge. P4b merger alene.
>
> **Bevis-steg-lærdom (3. gang):** Løype-2-e2e fanget en reell stale-closure-bug (auto-hopp
> fra toppknappen utløstes ALDRI — gjaldt òg P2s 1-mal-auto-hopp, maskert av modalen) som
> unit-tester + typecheck + kode-gate IKKE fanget. Tredje gang bevis-steget fanger det
> tester ikke gjør — mønsteret holder: driv flyten, ikke bare testene.

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

## pkt 0 — server-side tilgjengelighets-filter (fabel-gatet, `20d6fe03`)
Kenneths mobiltest: mal-velgeren tilbød maler brukeren ikke kan opprette fra →
skjema fylles, innsending avvises («Dokumentflyt er påkrevd»). Fabel-vedtak:
filtrer på opprettbarhet FØR auto-valg, SERVER-SIDE, DELT kilde med opprett-
valideringen (ikke duplisert klient-logikk, ikke ny validering).

- **Server (`mal.ts:44`):** additivt `opprettbar` + `opprettbareFlytIder` på
  `mal.hentForProsjekt`, utledet via `hentBrukersOpprettFlytMedlemskap`
  (`tilgangskontroll.ts:881` — samme fn opprett-valideringen `sjekkliste.ts:324`
  avviser på) + eier-faggruppe. HMS alltid opprettbar. **IKKE hard-filter** (mal-
  admin trenger alle). Eksplisitt returtype (`Prisma.ReportTemplateGetPayload`)
  mot TS2589 i AppRouter-inferens.
- **Web sjekkliste:** `malFlytStatus` bruker server-feltet; klient-duplikatet
  (`mineOpprettFlyter`) fjernet. Auto-hopp + flyt-gruppert velger → kun opprettbare.
- **Web oppgave + mobil `MalVelger`:** velger/auto-hopp filtrerer på `opprettbar`.
  Mobil-bugkilden var kun kategori-filter (`MalVelger.tsx:41`).
- **Utilgjengelige:** skjult som default, bak «vis utilgjengelige (N)» m/grunn (web+mobil).
- **Klikk-tak uendret (maks 2 før utfylling):** filteret FJERNER avvist innsending, legger ikke til klikk.

**GPS-presisering (fabel #5, til fallback-stigen):** GPS er bekreftelsessignal NÅR
til stede, aldri forutsetning — utfylling skjer ofte ikke på byggeplass. «Sist
brukt»/manuelt valg er likeverdig normalvei, ikke degradert unntak. `useSistBrukteMal`-
kommentaren behandler sist-brukt som normal kilde (ikke fallback-hierarki).

**Mobil-note:** `MalVelger.tsx` er hardkodet nb (pre-eksisterende, ikke i18n) — nye
strenger følger filens konvensjon; i18n av hele fila er egen gjeld. **Reload: `npx expo start --clear`.**

## Løype 2 — e2e opprett-flyt (dev-login + seed, localhost `2746999d`)
Full app + dev-login (`test-firma`, registrator) + seed (`seed-testbrukere` + `seed-e2e-flyt`
+ 2 ekstra maler: én opprettbar #2, én utilgjengelig). Bevis i `relay/p4b-bevis/`:
- `p4b-e2e-01-velger-opprettbare.png` — velger med 2 opprettbare maler + «Vis utilgjengelige (1)».
- `p4b-e2e-02-utilgjengelig-expandert.png` — ekspandert: «E2E Utilgjengelig» dempet m/grunn (**pkt 0-bevis — KB2-klassen vises ikke lenger**).
- `p4b-e2e-03-utfyllingsmodus-chiplinje.png` — detaljside i utfyllingsmodus: redigerbar tittel + chip-linje (Prosjekt · Byggeplass ▾ · Utfører ▾ · Mal) + utfyllbart felt (2-klikk-flyten).
- `p4b-e2e-04-sistbrukt-autohopp.png` — sist-brukt: **1 klikk → rett i utfylling** (ingen modal).

**Klikk-tall mot budsjett (maks 2):**
| Flyt | Klikk | Budsjett |
|------|-------|----------|
| >1 mal, ingen historikk | Opprett (1) → velg mal (2) = **2** | ✅ innenfor (ett lovlig mellomvalg) |
| Sist brukt / eneste opprettbar | Opprett (1) = **1** | ✅ optimal |
| Utilgjengelig mal | skjult — aldri tilbudt (ingen fyll-så-avvis) | ✅ pkt 0 |

### ⚠️ Bug funnet + fikset i Løype 2 (`2746999d`)
Auto-hopp (både 1-mal og sist-brukt) fra **verktøylinje-toppknappen** utløstes ALDRI:
`useVerktoylinje` re-registrerer onClick kun ved deps-endring → handleren frøs en stale
`åpneMalVelger` med tom `flytGrupper`/sist-brukt (data ikke lastet ved registrering) → falt
alltid til mal-modalen. Modalen rendret riktige maler (fersk JSX) og maskerte buggen for
>1-mal. Fiks: stabil onClick som deref-er en ref holdt fersk hver render. Gjelder både
sjekkliste + oppgave. (TS2589 ref-tippet budsjettet → sanksjonert suppresjon på oppgave.opprett.)
**Testdata ryddet etterpå** (3 instanser slettet, seed-scaffolding beholdt).

## Gate-kjede
- [x] **build+tester:** typecheck ren api+web (TS2589 løst); lint 0 nye feil (110 baseline-errors urørt, ingen i mine filer); web-tester 93/93, shared 379/379. Mobil `MalVelger` ren (mobil-baseline har pre-eksisterende feil urelatert til P4b — verifisert via stash-sammenligning).
- [x] **Løype 1 (harness):** 4 chip-tilstander i `relay/p4b-bevis/` (alle fylt · sist-brukt-merke · varsel-tom-chip · søk>6). Harness slettet, git rent.
- [x] **Løype 2 (e2e):** opprett-flyt + pkt-0 + sist-brukt + klikk-tall (over). Stale-closure-bug funnet + fikset.
- [ ] i18n 13 språk (nb+en lagt til: `kontekstChip.faggruppeKunUtkast`, `sjekklister.mal`, `sjekklister.utilgjengeligeMaler`, `felles.ingenTreff`) — generate ved merge (P2/P3-konvensjon).
- [ ] harness (chip-tilstander) + e2e (opprett-flyt + auto-hopp) + klikk-tall — test-miljø.
- [ ] fabel task-walkthrough.
- [ ] dok-sync (web.md chip-linje) + merge.

## Berørte filer
Nye: `components/kontekst-chip/{trakt-primitiver,DokumentKontekstChipLinje}.tsx`, `hooks/useSistBrukteMal.ts`.
Endret: `layout/KontekstChip.tsx` (primitiver hevet), `sjekklister/page.tsx`, `sjekklister/[sjekklisteId]/page.tsx`, `oppgaver/page.tsx`, `oppgaver/[oppgaveId]/page.tsx`, i18n `nb.json`/`en.json`.
