---
description: Kjør ende-til-ende-test av MS Project-import-veiviseren på test.sitedoc.no via chrome-devtools MCP
---

# Test import-veiviser for kontrollplan

Du skal bruke `chrome-devtools`-MCP-verktøyene til å verifisere at MS Project-importen fungerer ende-til-ende på test.sitedoc.no, med spesielt fokus på de nye forbedringene i steg 2 (inline faggruppe-opprettelse, bulk-knapp, alltid synlig standard-faggruppe).

## Forutsetninger

- Brukeren er logget inn som Kenneth (admin) på test.sitedoc.no i en Chrome-fane som chrome-devtools MCP har tilgang til
- Test-XML-fil: `tests/fixtures/ms-project-testfil.xml` (absolutt sti: `/Users/kennethmyrhaug/Documents/Programmering/SiteDoc/tests/fixtures/ms-project-testfil.xml`)
- Test-prosjekt: `https://test.sitedoc.no/dashbord/2bd15f09-8fbc-4de9-a826-3d2e5462bb23/kontrollplan`

## Innhold i test-filen (husk dette ved verifisering)

- **Prosjektnavn:** "SiteDoc Test - Leilighetskompleks B201"
- **2 sammendragsoppgaver** (Bad 201 - Fuktsikring, Elektrisk installasjon B201)
- **5 aktiviteter** (Forberedelse av membran, Legging av membran, Tetthetstest bad, Trekking av kabler, Montering av kontakter og brytere)
- **3 ressurser** (Mur AS, Maler AS, Taktekker AS) — valgt for å ikke matche standard faggrupper via fuzzy substring-matching. Hvis prosjektet ditt har Mur-/Maler-/Taktekker-faggrupper fra før, bytt ut navnene i testfilen

## Testprotokoll

Gå gjennom stegene under. Rapporter HVER sjekk som ✅/❌ med kort kommentar. Ikke fortsett til neste steg hvis forrige feilet på noe vesentlig — rapporter og avvent beskjed.

### Steg 0: Naviger til kontrollplan

1. Åpne `https://test.sitedoc.no/dashbord/2bd15f09-8fbc-4de9-a826-3d2e5462bb23/kontrollplan`
2. Ta en snapshot. Verifiser:
   - ✅ Siden laster uten feil
   - ✅ Knappen "Importer fremdriftsplan" er synlig

### Steg 1: Åpne veiviseren og last opp fil

1. Klikk "Importer fremdriftsplan"
2. Verifiser at modalen åpnes med tittelen "Importer fremdriftsplan" og steg-indikator 1–2–3 synlig
3. Last opp fil via file input. I chrome-devtools MCP: bruk `upload_file` på `input[type="file"]` med stien `/Users/kennethmyrhaug/Documents/Programmering/SiteDoc/tests/fixtures/ms-project-testfil.xml`. Hvis verktøyet ikke støtter det, spør brukeren om å dra-slippe filen manuelt og vent på bekreftelse.
4. Verifiser:
   - ✅ Filnavn "ms-project-testfil.xml" vises
   - ✅ Oppgave-tre viser 2 sammendragsoppgaver (Bad 201 - Fuktsikring, Elektrisk installasjon B201)
   - ✅ Fotnote viser "SiteDoc Test - Leilighetskompleks B201 — 5 aktiviteter, 3 ressurser"

### Steg 2 (hovedfokus): Ressurser → Faggrupper

1. Klikk "Velg alle"
2. Verifiser: "5 aktiviteter valgt"
3. Klikk "Neste"
4. Når steg 2 lastes, ta snapshot. Verifiser i denne rekkefølgen:
   - ✅ **Info-boks** (blå bakgrunn) er synlig med teksten «Eksempel: ressurs «Tømrer AS»...»
   - ✅ **Bulk-advarsel** (gul bakgrunn) viser «3 ressurs(er) mangler matchende faggruppe» og lister navnene (Mur AS, Maler AS, Taktekker AS). NB: hvis prosjektet har faggrupper som inneholder «Mur», «Maler» eller «Taktekker», vil fuzzy-match fange dem og færre enn 3 vises her
   - ✅ **Bulk-knapp** «Opprett 3 manglende som faggrupper» er synlig
   - ✅ 3 rader vises — én per ressurs — med aktivitetsantall (1 eller 2)
   - ✅ Hver rad har dropdown (viser "Ikke tilordnet") OG en blå «+ Opprett som faggruppe»-knapp
   - ✅ **Standard-faggruppe-seksjon** er synlig nederst (grå bakgrunn, "Standard faggruppe" + dropdown)
   - ✅ **Lenke** «Administrer faggrupper ↗» er synlig nederst til høyre

5. **Test 1: Inline opprettelse** — Klikk «+ Opprett som faggruppe» på raden for "Mur AS". Verifiser:
   - ✅ Knappen viser loading-spinner kort
   - ✅ Etter fullføring: dropdown for raden viser "Mur AS" som valgt verdi
   - ✅ «+ Opprett»-knappen forsvinner fra denne raden
   - ✅ Bulk-advarselen viser nå 2 manglende (ikke 3)

6. **Test 2: Bulk-opprettelse** — Klikk bulk-knappen «Opprett 2 manglende som faggrupper». Verifiser:
   - ✅ Loading-spinner vises
   - ✅ Etter fullføring: begge gjenstående rader får valgt faggruppe
   - ✅ Bulk-advarselen forsvinner helt
   - ✅ Ingen «+ Opprett»-knapper synlige lenger

### Steg 3: Tilordne maler

1. Klikk "Neste"
2. Verifiser:
   - ✅ Steg 3 viser 3 gruppeheadere (en per faggruppe) med fargeprikk og aktivitetsantall
   - ✅ Aktiviteter er gruppert under riktig faggruppe

3. Åpne mal-dropdown på den første aktiviteten. Verifiser:
   - ✅ Dropdown viser standardene som overskrift med maler under (flat liste)
4. Velg en vilkårlig mal. Klikk "Bruk for alle" på den gruppen.
5. Gjenta for de andre gruppene (velg én mal, bruk for alle).
6. Verifiser: Alle 5 aktiviteter har tildelt mal.

### Steg 4: Oppsummering og opprettelse

1. Klikk "Oppsummering"
2. Verifiser:
   - ✅ Gruppert visning per (mal × faggruppe)
   - ✅ Totalt 5 punkter vises for opprettelse
   - ✅ Uke-spenn vises (fra ca. uke 20 til uke 22)
3. Klikk "Opprett 5 punkter" (tallet kan variere)
4. Verifiser:
   - ✅ Grønn suksessmelding vises
   - ✅ Modalen lukkes automatisk etter ~1 sek
   - ✅ Siden viser nå de 5 nye kontrollpunktene (scroll gjennom listen)

## Opprydning

Etter vellykket test — spør brukeren om kontrollpunktene og de auto-opprettede faggruppene skal slettes manuelt, eller om de skal beholdes for videre testing.

## Rapportformat

Når testen er ferdig, lever en kompakt rapport:

```
Test: MS Project-import
Steg 0: ✅/❌
Steg 1: ✅/❌
Steg 2: ✅/❌  (hovedfokus — detaljer hvis noen ❌)
Steg 3: ✅/❌
Steg 4: ✅/❌
Opprettet data: [liste]
```
