# Kontrollplan — systemarkitektur

## Formål

Kontrollplan knytter sjekklister til steder (soner/rom) og tid, med ansvarlig, varsling og rapportering. Gjør det mulig å planlegge og spore kvalitetskontroller systematisk gjennom et byggeprosjekt.

## Arkitektur-oversikt

```
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  Malbygger   │   │  Tegninger   │   │   Sone / Rom     │
│  BIM-egenskap│   │  DWG/PDF/IFC │   │  Tegning-markup  │
│  Soneegenskap│   │  per bygge-  │──→│  Etasje → Sone   │
│  Romegenskap │   │  plass       │   │  Sone → Rom(mer) │
└──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
       │ maler            │ kobles til          │ lokasjon
       ↓                  ↓                     ↓
┌──────────────┐   ┌─────────────────────────────────────┐
│  Sjekkliste  │──→│          KONTROLLPLAN                │
│  Fra mal     │   │  Sjekkliste + Sted + Tid             │
│  eller ad-hoc│   │  Ansvarlig + Status                  │──→ Varsling
│  Oppgaver/felt   │  Varsling                            │    Push / SMS
└──────────────┘   └──────────────┬──────────────────────┘    Frist / frekvens
                                  │
                                  ↓
                          ┌───────────────┐   ┌──────────────┐
                          │  Utførelse    │   │   Rapport    │
                          │  Mobil / felt │   │  PDF/oversikt│
                          │  Foto, sign,  │   │  Status per  │
                          │  kommentar    │   │  sone        │
                          └───────────────┘   └──────────────┘
```

## Komponenter

### Malbygger → Kontrollplan

Malbygger definerer maler med egenskaper som kobler til kontrollplan:
- **BIM-egenskap** — kobler sjekkpunkter til BIM-modell-elementer
- **Soneegenskap** — kobler sjekkliste til en sone på tegning
- **Romegenskap** — kobler sjekkliste til spesifikt rom

### Tegninger og soner/rom

Tegninger (DWG/PDF/IFC) per byggeplass merkes opp med soner og rom:
- Tegning → Sone/rom-oppmerkng (markup)
- Hierarki: Etasje → Sone → Rom(mer)
- Soner/rom kobles som lokasjon i kontrollplanen

### Kontrollplan-kjerne

En kontrollplan-instans inneholder:
- **Sjekkliste** — fra mal (malbygger) eller ad-hoc opprettet
- **Sted** — sone/rom fra tegning-markup
- **Tid** — planlagt utførelse, frist
- **Ansvarlig** — hvem skal utføre
- **Status** — planlagt, pågår, utført, godkjent
- **Varsling** — push/SMS ved frist/frekvens

### Utførelse (felt)

Utføres fra mobil eller felt-PC:
- Fylle ut sjekkliste-felter
- Ta foto som dokumentasjon
- Signere digitalt
- Legge til kommentarer

### Varsling

- Push-notifikasjoner og/eller SMS
- Basert på frist (X dager før) eller frekvens (ukentlig, månedlig)
- Konfigureres per kontrollplan-instans

### Rapportering

- PDF-eksport av kontrollplan-status
- Oversikt per sone — hva er utført, hva gjenstår
- Filtrering på tidsperiode, ansvarlig, status

## Status

Kontrollplan-siden er **ikke bygget ennå** (404 på `/oppsett/produksjon/kontrollplaner`). Arkitekturen over er planlagt basert på eksisterende moduler (malbygger, tegninger, soner).
