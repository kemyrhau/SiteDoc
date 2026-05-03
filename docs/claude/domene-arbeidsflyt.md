---
name: domene-arbeidsflyt
description: Beskriver den virkelige arbeidsflyten i SiteDoc sett fra brukerens perspektiv.
  Dette er det styrende dokumentet for arkitektur-beslutninger — kode skal alltid kunne
  forklares tilbake til en arbeidsflyt beskrevet her.
status: under-utvikling
sist_oppdatert: 2026-05-03
---

# Domene-arbeidsflyt — SiteDoc

## Formål
Dette dokumentet beskriver hva SiteDoc faktisk gjør fra brukerens perspektiv.
Det er ikke et teknisk dokument — det er en beskrivelse av virkeligheten systemet skal støtte.
Alle arkitektur-beslutninger skal kunne forklares tilbake til en arbeidsflyt her.

---

## Aktører

| Aktør | Rolle | Primære behov |
|---|---|---|
| Ansatt (feltarbeider) | Utfører arbeid, registrerer | Enkel registrering, tilgang til prosjektinfo |
| Leder/Prosjektleder | Kontrollerer, attesterer, fordeler | Oversikt, godkjenning, rapportering |
| Byggherre | Mottar dokumentasjon, godkjenner | Godkjenning av endringer og leveranser |
| Firma-admin | Administrerer firma, moduler, brukere | Konfigurasjon, rapportering |
| sitedoc_admin | Systemadministrasjon på tvers av firmaer | Full oversikt alle firmaer |

---

## Arbeidsdag — Ansatt (feltarbeider)

### Morgen — planlegg dagen
1. **Kontrollplan** → sjekk hvilke sjekklister som skal utføres i dag
2. **Fremdriftsplan** → hva og hvor mye må gjøres i dag?
3. **Innboks** → har leder sendt oppgaver som skal utføres?

### Under arbeid — utfør og dokumenter
4. **Tegninger** → verifiser at arbeidet utføres på korrekt lokasjon
5. **Mapper** → les prosjektbeskrivelse og relevante dokumenter ved behov
6. **Sjekkliste** → dokumenter løpende etter hvert som punkter fullføres
7. **RUH/HMS-avvik** → registrer umiddelbart hvis avvik oppstår
8. **Oppgave fra leder** → utfør, ta bilde, skriv kort oppsummering, send tilbake

### Slutt av dag — registrer forbruk
9. **Dagsseddel** (eies av Timer-modulen):
   - Lønnsart → hvilken type arbeid ble utført, på hvilket prosjekt/ECO
   - Tillegg → mat og/eller reise
   - Maskin (hvis Maskin-modul aktiv) → hvilken maskin, antall timer/km
   - Vareforbruk (hvis Varelager-modul aktiv) → materialer brukt

### Oppfølging — se hva leder har gjort
10. **Timer-status** → se om leder har attestert, returnert eller flyttet timer

---

## Arbeidsflyt — Leder/Prosjektleder

### Timer-attestering
1. Mottar dagssedler fra ansatte
2. Kontrollerer timer
3. Kan **flytte timer** mellom prosjekt og ECO/tilleggsarbeid (timer-admin — ikke bygget ennå)
4. Attesterer → dagsseddel låses
5. Sender til:
   - **Økonomi** → lønnsutbetaling til ansatt
   - **ProAdm** → kostnad registreres per prosjekt

### Dokumentflyt
1. Sender oppgaver til ansatte
2. Mottar tilbake utfylte oppgaver med bilde og beskrivelse
3. Godkjenner eller returnerer

---

## Dataflyten ut av SiteDoc

```
Attestert dagsseddel
├── → Økonomi (lønnsutbetaling)
└── → ProAdm (kostnad per prosjekt)
        ↓
    ProAdm sender tilbake:
    ECO / Endringsmelding / Underprosjekt
        ↓
    Byggherre godkjenner/avviser i SiteDoc
```

---

## Modul-avhengigheter i dagsseddelen

Dagsseddelen er Timer-modulens kjernedokument, men utvides av andre moduler:

| Modul | Bidrag til dagsseddel | Forutsetning |
|---|---|---|
| Timer (basis) | Lønnsart, tillegg, prosjekt/ECO-tilknytning | Alltid tilgjengelig |
| Maskin | Maskin brukt, timer/km | Maskin-modul aktivert for firma |
| Varelager | Materialer brukt | Varelager-modul aktivert for firma (ikke bygget) |
| Kompetanse | Mulig kobling (ukjent ennå) | TBD |

---

## Åpne spørsmål (Kenneth må beslutte)

- [ ] Kompetansematrise — kobling til dagsseddel? Hvilken?
- [ ] Timer-admin (flytte timer prosjekt ↔ ECO) — egen side eller del av attestering?
- [ ] Varelager — per dagsseddel eller per prosjekt?
- [ ] HMS/RUH — eksplisitt modul-flag eller behold som oppgave-domain?

---

## Koblinger til tekniske dokumenter

| Arbeidsflyt-element | Teknisk dokument |
|---|---|
| Dagsseddel | dagsseddel-design.md |
| Maskin-kobling | maskin.md |
| Timer-katalog (lønnsart/tillegg) | timer.md |
| Dokumentflyt (oppgave/sjekkliste) | dokumentflyt.md |
| ECO / Endringsmelding | fase-0-beslutninger.md § E.11 |
| ProAdm-integrasjon | okonomi.md |
