---
description: Verifiser at sluttrapport-PDF bruker korrekt terminologi og layout på test.sitedoc.no
---

# Test sluttrapport PDF

Du skal bruke `chrome-devtools`-MCP til å verifisere at sluttrapporten for kontrollplanen har:
- Ingen «Avvik»-terminologi (skal hete «Returnert»)
- Korrekt datoformat (dd.MM.yyyy, ikke ISO)
- Punkt-liste øverst med status-badges
- Dynamisk kontrollerklæring («er under gjennomføring» når ikke alt er godkjent)
- Self-contained CSS (ingen rå CSS-tekst som lekker ut i rapporten)

## Forutsetninger

- Brukeren er logget inn på test.sitedoc.no
- Test-prosjekt: `https://test.sitedoc.no/dashbord/2bd15f09-8fbc-4de9-a826-3d2e5462bb23/kontrollplan`
- Kontrollplanen har minst 2 punkter (0/2 godkjent per skjermbilde fra brukeren)

## Testprotokoll

### Steg 1: Naviger og åpne sluttrapport

1. Åpne `https://test.sitedoc.no/dashbord/2bd15f09-8fbc-4de9-a826-3d2e5462bb23/kontrollplan`
2. Klikk "Sluttrapport"-knappen
3. Sluttrapporten åpnes i ny fane/vindu som HTML (rendres print-klar)
4. Ta snapshot av den nye fanen

### Steg 2: Verifiser CSS-rendering (CSS-bug-regresjonstest)

- ✅ **Øverst på siden skal IKKE vises rå CSS-tekst** som `body { font-family: ... }` eller `@page { margin: ... }`. Hvis slik tekst er synlig øverst, er dette en regresjon av CSS-bug-fiksen fra 2026-04-23.
- ✅ Siden skal ha ryddig typografi (tittel, tabeller, badges med farger)

### Steg 3: Verifiser terminologi

Bruk browserens søkefunksjon eller `evaluate` for å søke i DOM-innholdet:

- ❌ **FEIL hvis følgende ord forekommer:**
  - "Avvik totalt"
  - "Åpne avvik"
  - "Avvik lukket"
  - "Avvik og lukking"
  - "Lukket" (som status)

- ✅ **RIKTIG hvis følgende forekommer** (når relevant):
  - "Returnert" (i oppsummering, hvis returnerte sjekklister finnes)
  - "Returnerte sjekklister" (seksjonsoverskrift, hvis relevant)
  - "Totalt", "Godkjent", "Planlagt", "Pågår", "Utført" (som oppsummerings-nøkkeltall)
  - "Ubehandlet" (hvis returnerte som ikke er godkjent)

### Steg 4: Verifiser punkt-liste øverst

- ✅ Rett under tittel/metainfo skal det være en liste med én linje per kontrollpunkt, hver med status-badge til høyre

### Steg 5: Verifiser kontrollerklæring

Ettersom planen har 0/2 godkjent:
- ✅ Teksten skal inneholde «er under gjennomføring» (IKKE «er gjennomført»)
- ✅ Teksten skal si «0 av 2 kontrollpunkter er godkjent. 2 gjenstår.»

### Steg 6: Verifiser datoformat

- ✅ Hvis noen punkter har godkjent-dato: format dd.MM.yyyy (f.eks. "23.04.2026"), IKKE ISO "2026-04-23T..."
- ✅ Hvis ingen er godkjent: «—» vises i godkjent-kolonnen

### Steg 7: Visuell sjekk

- ✅ Status-badges har fargekoding (planlagt=grå, pågår=gul, utført=blå, godkjent=grønn)
- ✅ Tabell for kontrollerte områder har 5 kolonner: Område, Sjekkliste, Status, Godkjent, Faggruppe

## Rapportformat

```
Test: Sluttrapport PDF
Steg 2 (CSS-rendering):    ✅/❌
Steg 3 (terminologi):      ✅/❌  — feilord funnet: [...]
Steg 4 (punkt-liste):      ✅/❌
Steg 5 (kontrollerklæring): ✅/❌
Steg 6 (datoformat):       ✅/❌
Steg 7 (visuell):          ✅/❌
```

Hvis én eller flere ❌ — gi konkret sitat fra DOM-en og foreslå rot-årsak (f.eks. "seksjon 3 har fortsatt 'Avvik'-overskrift — se `packages/pdf/src/sluttrapport.ts` linje X").
