---
name: ordre-kontekstvelger-1a-fabel-2026-08-21
description: Komplett ordre for kontekstvelger v2 etter retning 1a (Kenneth-valgt i mockup) — ERSTATTER ordre-kontekstvelger-gjenoppretting-fabel-2026-08-21.md.
til: redesign-Opus (via Kenneth)
bakgrunn: docs/claude/kontekstvelger-regresjonsjakt-2026-08-21.md
mockup: «Kontekstvelger Alternativer.dc.html» (designprosjektet), alternativ 1a — Kenneth-valgt 2026-08-21
sist_endret: 2026-08-21
---

# Ordre: kontekstvelger v2 — retning 1a («trakt i ett løp»)

Kenneth valgte alternativ 1a i klikkbar mockup 2026-08-21: ett klikkmål og K3-traktens
grammatikk beholdes, men trakten gjenvinner det som gikk tapt og mister friksjonen mellom
nivåene. Denne ordren ERSTATTER `ordre-kontekstvelger-gjenoppretting-fabel-2026-08-21.md`
(levert tidligere i dag) — alt derfra er innbakt her, ikke utfør begge.

**Flagg-prinsipp:** alt under er funksjonalitet — flagg-nøytralt, aldri bak `nyNavigasjon`.

## A. Datakvalitet (høyest prioritet)

### A1. Autovalg av byggeplass — rotårsaksfiks i kontekst-kilden
Tapt i `4d52114e` (`ByggeplassVelger.tsx:41-45` bar autovalget som sideeffekt). Konsekvens:
`sjekklister/page.tsx:407` setter `byggeplassId: aktivByggeplass?.id` → `undefined`.
- Autovalget skal bo i kontekst-kilden (`byggeplass-kontekst.tsx` / der `aktivByggeplass`
  forvaltes) — IKKE som sideeffekt i en UI-komponent (det var det som gjorde det usynlig),
  og IKKE ved å gjeninnføre gammel komponent.
- Regel: aktivt prosjekt har byggeplasser og ingen er valgt → velg første deterministisk.
- Guard: ved prosjektbytte nullstilles/revelges byggeplass som ikke tilhører nytt prosjekt.
- Verifikasjon: opprett sjekkliste uten å ha åpnet trakten — `byggeplassId` aldri `undefined`
  når prosjektet har byggeplasser.

## B. Trakten (KontekstChip)

### B1. Åpner på byggeplassnivået
Dagens `åpne()` gjør delvis dette — behold, men verifiser at default alltid er det dypeste
avklarte steget (firma kun uavklart ved flere firmaer uten valg; ellers byggeplass når
prosjektet har byggeplasser).

### B2. Trakten lukkes ikke mellom nivåene
Prosjektvalg lukker i dag popoveren (`velgProsjektTrakt`). Nytt: prosjekt med byggeplasser →
bli i popoveren, avansér til byggeplassnivået (autovalgt byggeplass fra A1 vises som valgt,
brukeren kan overstyre eller klikke utenfor). Prosjekt uten byggeplasser → lukk som i dag.
Byggeplassvalg lukker.

### B3. Favoritter (stjernemerking) i prosjektlista
Tapt i `ad7cadc1` uten vedtak; mobil har dem (`useFavoritter.ts` finnes på web — verifiser
gjenbruk før ny lagring bygges). Stjerne på hver prosjektrad (høyre, eget klikkmål,
stopPropagation), seksjon «Favoritter» øverst, deretter «Sist brukt» (eksisterende
Activity-logikk beholdes), så «Alle prosjekter». Mockupen viser markup og rekkefølge.

### B4. Autofokus i søkefeltet
Tapt i `ad7cadc1`. Søkefeltet autofokuseres når et nivå med synlig søk åpnes (web/desktop).

## C. Topplinja (chip-teksten)

### C5. Snudd trunkering — prosjektnavnet står fast
I dag: byggeplass-suffikset er `shrink-0`, prosjektnavnet `truncate` — langt byggeplassnavn
spiser prosjektnavnet (Kenneth-skjermbilder 2026-08-21). Nytt: prosjektnavnet får prioritet
(fast opp til egen maks), byggeplass-suffikset får `min-width:0` + egen `truncate` og dempet
tone. `title` beholder full tekst.

### C6. Flytende bredde — 240px-ankeret oppgis
`w-60`-ankeret (fast 240px så chip+⇄ står pixel-fast ved firma↔prosjekt-bytte) oppgis:
navneområdet flyter opp til ~460px (prosjekt maks ~280px), knappene følger navnelengden.
Kenneth-vedtak 2026-08-21: lesbare navn prioriteres over pikselfast knappposisjon. Fjern
også `min-w-[127px]`-kommentarens premiss hvis den blir meningsløs — men behold lik
knappbredde FIRMA/PROSJEKT (den koster ingenting).

## D. Sjekklisteoversikten (web)

### D7. Byggeplassfilter fra konteksten — foreslått, Kenneth godkjenner ved designgaten
Web sender aldri `byggeplassId` (`sjekklister/page.tsx:298`); server støtter det
(`sjekkliste.ts:133,150`); mobil filtrerer (`app/sjekkliste/index.tsx:64-67`). Nytt: lista
filtreres på `aktivByggeplass` fra konteksten, med synlig kontekstlinje og «Hele prosjektet»
som ufiltrert tilstand — som demonstrert i mockupen. Kolonnefilteret i tabellen beholdes for
tverrsnitt. MERK: enkeltmålt premiss — Kenneth valgte 1a-mockupen som viser dette, men har
ikke eksplisitt vedtatt filteret; bekreftes i designgaten før merge.

## Klikk-budsjett (effektivitets-gate pkt 1)

- Bytte byggeplass innen prosjekt: **2 klikk** (chip → byggeplass).
- Bytte prosjekt + byggeplass: **3 klikk** (i dag 5) — B2.
- Lang liste (>6): 2 klikk + tasting (B4 gir tasting umiddelbart, i dag 3 + klikk i felt).
- Utførende rapporterer faktiske tall ved levering.

## Funksjonsinventar (gate — rammeverksregel 2026-08-21)

Ordren rører `KontekstChip` + kontekst-kildene. Status per funksjon i dagens komponent:
trakt firma→prosjekt→byggeplass: bevart · NivåRad/TraktRad-primitiver (delt kilde P4b):
bevart, rør ikke API-et uten å oppdatere `DokumentKontekstChipLinje` · Alle/Mine-pille:
bevart som i dag (reelt scope-valg er egen, uavklart sak) · «Sist brukt» (Activity): bevart,
under Favoritter · sonefarger/⇄/a11y-labels: bevart · søk >6: bevart + autofokus (B4) ·
«Hele prosjektet»: bevart · lastetilstand funn 1b: bevart · 240px-anker: bevisst fjernet
(C6, Kenneth-vedtak) · popover-lukking ved prosjektvalg: bevisst endret (B2, Kenneth-valgt
1a) · byggeplass-suffiks shrink-0: bevisst snudd (C5). Tapte funksjoner som gjenopprettes:
favoritter (B3), autofokus (B4), autovalg byggeplass (A1). IKKE i ordren (uavklart, egen
sak): GPS-forslag på web, byggeplass som eget navngitt klikkmål (1b), Alle/Mine som reelt
valg.

## E. Delt rutepredikat (uendret fra forrige ordre)

`ruteErFirmaKontekst` finnes i tre kopier; kun `KontekstChip.tsx:55-62` ble rettet i
`a859b4f0`. Trekk til én delt modul, importer i `KontekstChip.tsx`, `Toppbar.tsx:49`,
`NavSidebar.tsx:144`. Verifikasjon: `/dashbord/maskin` viser FIRMA konsistent alle tre steder.

## DoD

1. Rotårsak kodet; A1 og E er eksplisitt delte kilder, ingen duplisert logikk
2. Build grønn (`pnpm --filter @sitedoc/web build`)
3. Skjermbilde-designgate hos fabel MED task-walkthrough mot klikk-budsjettet
   (+ D7-bekreftelse fra Kenneth)
4. Dok-sync: `redesign-paritetssjekkliste.md` og `k3-verifiseringslogg.md` re-verifiseres i
   samme økt (`sist_verifisert_mot_kode` = leveransedato); K3-vedtakets «popover lukkes ved
   prosjektvalg» oppdateres til B2 med referanse hit
5. Merge via cowork (`--no-ff`)
