---
name: gjennomgangsplan-dokumenthandling-utfylling-malbygger
status: 🟢 AKTIV — kilde for spor A/B/C
eier: fabel (design) · cowork committer revisjoner
sist_verifisert_mot_kode: 2026-07-17
---

# Gjennomgangsplan — dokumenthandling, utfylling og MalBygger-UX

> **Fabel-plan 2026-07-17**, på Kenneth-føring: «bred gjennomgang og planlegging — uten å skade de funksjoner som virker.» Grunnlag: M-3a del 2-exit + Kenneths syv testfunn.
>
> **§9 — denne fila er kilden.** Repoet er ikke en lesekopi: hver revisjon relayes av Kenneth og committes hit. En Opus kan peke hit uten selvbærende liming. Fabels eget prosjekt («Sitedoc redesign tips») er **verkstedet** — mockups, DC-er og design-statuskilder som gates mot bilder blir der, fordi de ikke kan versjoneres meningsfullt i git.
>
> **Design-statuskilde (utenfor repoet):** `verifisering/del6b-verifiseringslogg.md` i designprosjektet. Pekeren navngir treet, per §9.

## Prinsipp

Ikke seks småfikser — tre sammenhengende gjennomganger, hver med **nå-rapport → fabel-design → Kenneth-vedtak → ordre**.

**«Ikke skad det som virker» er gate i alle:** hver endring skal navngi hvilke fungerende flater den rører, og hvorfor den ikke kan ramme dem. Se [§11d](../dokumentasjons-standard.md) — mål hva dataen **bærer** og hvem som **leser** den, ikke hva koden antar.

## Spor A — Handlings-matrisen (dokumentflyt; ryggraden)

**OMSCOPET 2026-07-17: matrisen FINNES ALLEREDE.** `packages/shared/src/utils/statusHandlinger.ts` bærer to av tre kolonner, korrekt: `hentStatusHandlinger` = **når**; `ROLLE_HANDLINGER` = **hvem**. (`sent→[trekkTilbake]`, `approved→[lukk, videresend]`.) Statusmaskinen (`isValidStatusTransition`) er korrekt og røres ikke.

> ⚠️ **Rettelse 2026-07-17 — coworks premiss var feil, korrigert av lese-økt-rapporten.**
>
> Denne planen sa opprinnelig: «Web har TO handlings-UI-er: `StatusHandlinger.tsx:158` konsulterer kilden … og en usann kommentar (`:4` påstår mobil-bruk; 0 treff).» **Begge påstandene var gale.**
>
> Målt i [lese-okt-a1-b1-2026-07-17.md](../lese-okt-a1-b1-2026-07-17.md): `StatusHandlinger.tsx` er **død kode** — `<StatusHandlinger>` rendres aldri. Og kommentaren på `:4` er **sann**: mobil ER kilde-drevet, via `hentRolleFiltrertHandlinger` (søsterfunksjonen). Cowork grep-et på `hentStatusHandlinger`, fikk 0 treff i `apps/mobile`, og leste fravær som fravær.
>
> **Bildet snus: mobil-menyen er den korrekte flaten. Web-menyen er den ødelagte.** `DokumentHandlingsmeny.tsx` (web) er helt hardkodet og tilbyr overganger serveren avviser.

1. **A-1 nå-rapport** — ✅ **LEVERT** ([lese-okt-a1-b1-2026-07-17.md](../lese-okt-a1-b1-2026-07-17.md), merget `47e628e7`).
2. **A-2 — én Kenneth-beslutning, ikke en tabell.** ADMIN-seksjonen tilbyr bevisst mer enn normalflyten, men serveren avviser → verken/eller i dag. **Spørsmålet: hva skal admin få utover normalflyten — og hvis ingenting, hvorfor finnes ADMIN-seksjonen?** ([§11e](../dokumentasjons-standard.md): fraværet av filtrering kan være designet overstyring, ikke defekt.) Innstilling: se [a2-b2-innstilling.md](a2-b2-innstilling.md).
3. **A-3 ordre** (etter vedtak): web-menyen konsulterer kilden · **«hva sier den når nei» bygges** — den eneste kolonnen som ikke finnes i noen form · kommentar-krav differensiert (Lukk-funnet) · `StatusHandlinger.tsx` slettes (død kode).

## Spor B — Utfyllings-opplevelsen (renderer-laget)

Samler: toleranse-fiksen (vedtatt modell: **Område `min`/`maks` XOR Toleranse `nominell`±**, `nominell`=0-default — se [MALBYGGER.md](../../MALBYGGER.md)), repeater-ledetekst som forsvinner, befaring-bilder nederst, nestet-repeater-tomtekst, trafikklys (F3 omscopet: renderer leser aldri config).

1. **B-1 nå-rapport** — ✅ **LEVERT** (samme rapport, inkl. båret-vs-lest data-pass mot test).
2. **B-2 ordre** (etter Kenneth-gate): prioritering i [a2-b2-innstilling.md](a2-b2-innstilling.md). **Grense: ingen ny felttype, ingen datamodell-endring uten flagg.**

## Spor C — MalBygger-ergonomi (byggerens UX)

Samler Kenneths funn: drag-slipp-presisjon («fungerer, men ikke godt nok» — bedre visuell landing) · betingelse-flyt (popup når betingelsen skrives, ikke prikk-meny etterpå) · det blå betingelse-feltet («unødvendig og ikke så beskrivende») · felt-kontrast.

1. **C-1 er design, ikke rapport:** fabel lager mockup (DC) — Kenneth godkjenner visuelt FØR ordre (samme vei som georef-mockupen).
2. **C-2 ordre** etter mockup-godkjenning. **Grense: ingen endring i mal-datamodellen eller lagringsformat** — ren interaksjon/visning.

## Rekkefølge og kollisjoner

- **A først** (pilot-nærmest: brukere møter «Ugyldig statusovergang» i dag), så B, så C.
- **B rører renderer-filene M-3a del 2 nettopp rørte** — B-ordren skal lese dem som de ER.
- **C rører `MalBygger.tsx`** → kolliderer med ev. M-3b-bygging; cowork sekvenserer via tavle-rad.
- **M-3b** (bibliotek) og **del6b fase 2** (mobil) står i køen uavhengig — denne planen erstatter dem ikke.

## Kenneth-beslutninger

1. ✅ Tre-spors-formen + rekkefølgen A→B→C.
2. ✅ A-1+B-1 som én kombinert lese-økt — levert.
3. **Åpen:** toleranse-fiksen — frittstående fiks-ordre nå, eller vent på B-2? (Buggen står på test; Kenneth valgte «la stå» 2026-07-17.)
