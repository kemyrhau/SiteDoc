---
name: testliste-bygg-45
description: Hva som skal testes i TestFlight-bygg 45 (2026-08-19) — prioritert, med hva som er bestått
status: aktiv
---

# Testliste — bygg 45 (TestFlight, commit `8fdd82bc`)

Rekkefølgen er prioritert. **De tre første er de som har blokkert deg i felt** — kommer du
ikke lenger enn dit, er de likevel de viktigste.

---

## 1. 🔴 Frysingen — den som stoppet alt

**Trykk `+` for ny sjekkliste. Gjenta 4–5 ganger på rad, i minst to ulike prosjekter.**

- ✅ **Bestått:** hver gang navigerer appen rett til detaljsiden, skjermen responderer.
- ❌ **Ikke bestått:** skjermen låser seg. (Swipe fra venstre kant løsner den — men da er
  fiksen ikke god nok.)

Test også i **Testprosjekt** hvis det finnes — det var der den frøs sist, selv etter at B12
fungerte.

## 2. 🔴 Bilder — vises de?

**Ta et bilde i et felt.**

- ✅ Thumbnailen vises **med én gang**, ikke tom ramme.
- ✅ Nummer-badge (`01`, `02`, …) på hver thumbnail, **stigende gjennom dokumentet** — også
  på tvers av repeater-rader.
- ✅ Trykk «Annoter» → bildet vises (ikke svart skjerm), og du kan tegne.

**Hent så 2–3 bilder fra galleriet.** Numrene skal følge rekkefølgen du valgte dem i.

## 3. 🔴 Dokumentflyt — går oppgaven til riktig person?

**Opprett en oppgave fra en mal som har en dokumentflyt.**

- ✅ **Utfører blir flytens faggruppe**, ikke deg selv.
- ❌ Står du selv som både bestiller og utfører, treffer ikke auto-utledningen.

Dette har vært brutt siden 6. mars — det er første gang det testes.

---

## 4. 🟠 Vær ved befaringstidspunkt

**Åpne et nytt dokument fra en mal med værfelt (Befaringsrapport).**

- ✅ Datofeltet står **tomt** ved opprettelse — ikke forhåndsutfylt med i dag.
- ✅ Trykk «Nå» → både tid **og vær** fylles, umiddelbart.
- ✅ Endre klokkeslettet → været oppdateres til den nye timen.
- ✅ Endre en tekst eller et bilde → været endres **ikke**.

**Åpne så et dokument fra en mal *uten* værfelt:** datofeltet skal prefylles som før.
Det er avveiningen 22 mot 1 — bare vær-ankeret mistet prefyllet.

## 5. 🟠 Lokasjon → tegning og kart

**På et dokument uten lokasjon, trykk «Velg lokasjon…».**

- ✅ Har prosjektet **én** tegning: den åpnes direkte.
- ✅ Har det **flere**: velgeren åpnes.
- ✅ Har det **ingen**: ærlig melding, ikke tom skjerm eller død knapp.
- ✅ Georefererte tegninger er merket **«Kart»** i lista.
- ✅ Ortofotoet **rendrer** (var usynlig før — URL-feil).
- ✅ Pinnen havner **der du trykker**.
- ✅ Zoom: pinch fungerer, pinnen holder posisjon og blåses ikke opp.
- ✅ Ingen P1/P2/P3-georef-punkter synlig i tegningsvisningen.

## 6. 🟡 Arkiv-PDF

**På sjekklistedetalj, trykk «Del»-ikonet (arkiv-PDF).**

- ✅ PDF lastes ned og kan deles.
- ✅ Mangler vedlegg: amber melding «N vedlegg mangler», men nedlasting går likevel.
- ✅ Uten nett: «PDF krever tilkobling» — ikke stille feil.
- ✅ Den gamle «Lokal»-knappen finnes fortsatt (fallback, merket).

**Sammenlign de to:** generer arkiv-PDF og lokal PDF av samme dokument. De skal se like ut.
Avviker de, er det et funn — den lokale skal fjernes senere, og da må formen stemme.

---

## Ikke synlig, men med i bygget

- **Sweep-fiks:** vær-køen leser ikke lenger hele databasen hvert 30. sekund. Merkes bare
  som fravær av treghet.
- **`harAktivLocation`:** backend sender feltet, men mobil bruker det ikke ennå
  (kontekstkjeden er ikke bygget).

## Kjent, ikke fikset

- **0-byte-bilde:** ett av åtte bilder ble tomt på server (mistenkt race mot frysingen).
  Frysingen er nå borte — si fra hvis det skjer igjen.
- **Prosjektvelger på mobil** viser bare prosjekter du er **medlem** i, ikke alle du når som
  admin. Egen sak.
- **Byggeplass og tegning** kan ikke redigeres eller slettes fra UI. Egen sak.

## Meld fra slik

For hvert avvik: **hvilken skjerm, hva du gjorde, hva som skjedde.** Skjermbilde hjelper.
Og si hvilket prosjekt — flere av gårsdagens feil viste seg å være ufullstendige testdata,
ikke kode.
