---
name: ui-standarder
description: UI-designprinsipper, slett-bekreftelse, adaptive nedtrekk, filter-standard, toppbar-filtre og fargepalett. Flyttet ut av CLAUDE.md 2026-08-20 (størrelsesgrense).
sist_verifisert_mot_kode: 2026-08-20
sist_endret: 2026-08-20
---

# UI-standarder

> Flyttet ordrett fra `CLAUDE.md` 2026-08-20 fordi hovedfila nådde 40k-grensen.
> Innholdet er uendret og fortsatt **styrende**.

## UI-designprinsipper

- **Renest mulig UI** — hvert element må rettferdiggjøre sin eksistens. Unngå toasts/bannere/animasjoner uten tydelig behov; foretrekk subtile signaler.

### Slett-bekreftelse i UI

Bruk alltid ekte modal-komponent (ikke native `confirm()`) for slett-operasjoner. `confirm()` blokkerer browser-automatisering og testing.

**Eksisterende unntak:**
- `apps/web/src/app/dashbord/firma/avdelinger/page.tsx` → byttes til modal ved neste iterasjon i den filen.

### Mobil-UI-regel: Adaptive nedtrekksmenyer for fritekst-felt

For inputs der bruker registrerer fritt valgte verdier (material, kategori, etiketter, leverandør, etc.) — bruk adaptiv nedtrekk i stedet for å forhåndskonfigurere katalog eller la fritekst stå alene. Mobil-UI er hovedfokus (feltarbeideren skriver ikke gjerne i lange skjemaer), men mønsteret gjelder også web-skjemaer hvor relevant.

1. **Første gang:** Ren tekstinput
2. **Når en verdi er brukt 3+ ganger:** Tilgjengelig som forslag (dropdown) under tekstinput
3. **Når listen passerer 7 elementer:** Legg til søkefelt øverst
4. **Bruker kan skjule forslag** («ikke vis igjen») for å rydde

Gjelder alle «lærende» inputs — materialer, kategorier, etiketter, taggegruppe-navn, leverandører, etc.

Fordeler: ingen forhåndskonfigurering, lærer av faktisk bruk, skalerer 1→100+ verdier uten redesign.

Bruk dette mønsteret før du lager en eksplisitt katalog-tabell. Katalog-tabell er kun riktig når verdiene er regulert (lønnsart, lovpålagte koder) eller deles på tvers av firma.

### Filter-standard (vedtatt 2026-05-29)

Filterpaneler bruker `MultiComboks` (`apps/web/src/components/ui/MultiComboks.tsx`) for multi-select + `SearchInput` (`@sitedoc/ui`) for fritekst-søk (alltid del av filter-blokken, ikke separat element). Fritekst øverst (tittel/løpenummer på tvers av faner), multi-select under (grid), valgte som chips med X-knapp, søkefelt i dropdown alltid synlig, «Tøm filter» kun når noe er valgt. Referanse: `dashbord/firma/hms/page.tsx`. Ikke-blokkerende — kun ny kode følger standarden.

### Toppbar-filtre-standard (vedtatt 2026-05-30)

Nye sider deklarerer hvilke toppbar-filtre de bruker via `useToppbarFiltre`-hooken (`apps/web/src/hooks/useToppbarFiltre.ts`): velgere som ikke er i bruk vises grå/ikke-klikkbar (`opacity-40 + cursor-not-allowed`) så brukeren ser at de ikke har effekt.

- **Side som IKKE filtrerer på byggeplass:** kall `useToppbarFiltre({ byggeplass: false })` øverst i komponenten.
- **Side som bruker byggeplass aktivt** (bilder, hms, kontrollplan, oppgaver/sjekklister, tegninger, tegning-3d, vareforbruk, lokasjoner): ikke kall hooken — default er aktiv; hooken resetter ved unmount.

Integrasjon: `toppbar-filtre-kontekst.tsx` + `ByggeplassVelger.tsx` (`disabled`-prop via `Toppbar.tsx`). Bakgrunn: byggeplass-velger viste seg uten effekt på 16/30 detalj-/11/14 oppsett-sider.

## Fargepalett

| Farge | Hex | Bruk |
|-------|-----|------|
| `sitedoc-primary` | `#1e40af` | Primærfarge (toppbar, knapper) |
| `sitedoc-secondary` | `#3b82f6` | Sekundær (lenker, hover) |
| `sitedoc-accent` | `#f59e0b` | Aksent (varsler) |
| `sitedoc-success` | `#10b981` | Suksess (godkjent) |
| `sitedoc-error` | `#ef4444` | Feil (avvist, slett) |
