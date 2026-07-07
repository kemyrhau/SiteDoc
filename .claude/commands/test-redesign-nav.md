---
description: Verifiser redesign-navigasjonen (nyNavigasjon-flagg) på test.sitedoc.no via chrome-devtools MCP — T9 mobil-web-hamburger + FM5 «Mine timer», flagg på/av
---

# Test redesign-navigasjon (nyNavigasjon) på web

Du skal bruke `chrome-devtools`-MCP-verktøyene til å verifisere redesign-navigasjonen bak
`nyNavigasjon`-flagget på **test.sitedoc.no**, og levere skjermbilder til fabel for
designgodkjenning. Fokus nå: **T9** (mobil-web-hamburger) + **FM5/K2** («Mine timer» flyttet
til brukermeny + søk). Kommandoen er gjenbrukbar for framtidige redesign-web-runder.

## Forutsetninger

- Brukeren er logget inn som **Kenneth (sitedoc_admin)** på test.sitedoc.no i en Chrome-fane
  som chrome-devtools MCP har tilgang til. (Admin kreves for at FIRMA-sonen skal vises.)
- Test-web-imaget er rebygget med den aktuelle redesign-koden (ellers ser du gammel nav).
- **Test-prosjekt med firma + medlemskap** (for enablet PROSJEKT-sone + FIRMA-sone):
  `Markussen Boligfelt B12` = `f6dcb81f-802c-415b-a6c6-a8fdf7f9710f`.

## Flagg-mekanikk (viktig)

- **Slå på:** naviger med `?nyNav=1` i URL-en, **eller** sett `localStorage['sitedoc-ny-navigasjon'] = '1'`.
- **Slå av:** `?nyNav=0` (eller localStorage `'0'`). Uten query-param leses persistert verdi.
- Flagget leses klientside — **reload** siden etter at du har satt det, så React-treet monteres på nytt.
- Verifiser alltid flagg-tilstand før en fangst:
  `evaluate_script: () => localStorage.getItem('sitedoc-ny-navigasjon')` → `"1"` / `"0"`.

## Viewport

- **T9 (hamburger)** krever **mobil-viewport < 768px** (`md`-breakpoint). Bruk `resize_page` til
  **390 × 844**. Hamburger-knappen er `md:hidden` og vises kun da.
- **FM5 (sidebar/brukermeny/søk)** bruker **desktop-viewport** (sidebaren er `md:flex`, skjult < md).
  Bruk `resize_page` til **1280 × 900**.

Rapporter HVER sjekk som ✅/❌ med kort kommentar + ta skjermbilde (`take_screenshot`) på hvert
merket punkt. Ikke fortsett hvis noe vesentlig feiler — rapporter og avvent.

---

## Del A — T9: mobil-web-hamburger

### A1. Flagg PÅ, med prosjekt (enablet PROSJEKT-sone + fargeaksent + FIRMA-sone)

1. `resize_page` 390 × 844.
2. Naviger til `https://test.sitedoc.no/dashbord/f6dcb81f-802c-415b-a6c6-a8fdf7f9710f/sjekklister?nyNav=1`
   (en modul-rute så en PROSJEKT-rad er aktiv → fargeaksent skal vises på den).
3. Bekreft flagg = `"1"` (evaluate_script). Reload om nødvendig.
4. Ta snapshot, finn **hamburger-knappen** (første `button` i toppbaren, uten tekst, venstre for «SiteDoc»-lenken). Klikk den.
5. 📸 **Skjermbilde A1.** Verifiser i hamburger-panelet:
   - ✅ **Seksjonsoverskrift «PROSJEKT»** (uppercase, grå).
   - ✅ Prosjekt-rader (Dashbord, Sjekklister, Oppgaver, Bilder, Mapper, …) er **klikkbare** (ikke grå).
   - ✅ Den aktive raden (Sjekklister) har **fargeaksent** (venstre kant / farget ikon) + `aria-current`.
   - ✅ **Seksjonsoverskrift «FIRMA»** med firma-innganger (Oversikt/Ansatte/HMS/Timer/… avhengig av moduler) + evt. Maskin.
   - ✅ **«Innstillinger»** nederst (egen seksjon, over/utenfor listen) → lenker til `/dashbord/innstillinger`.
   - ✅ Ingen «Mine timer» i PROSJEKT-sonen (FM5 — flyttet til brukermeny).

### A2. Flagg PÅ, uten prosjekt (disabled-tilstand)

1. Fortsatt 390 × 844. Naviger til `https://test.sitedoc.no/dashbord?nyNav=1` (ingen prosjekt i URL).
2. Åpne hamburgeren.
3. 📸 **Skjermbilde A2.** Verifiser:
   - ✅ PROSJEKT-radene som krever prosjekt er **grå/disabled** (`opacity-40 cursor-not-allowed`, ikke klikkbare).
   - ✅ Dashbord + Innstillinger (uten `kreverProsjekt`) er fortsatt klikkbare.

### A3. Flagg AV (byte-identisk dagens meny)

1. Naviger til `https://test.sitedoc.no/dashbord?nyNav=0`. Bekreft flagg = `"0"`.
2. Åpne hamburgeren.
3. 📸 **Skjermbilde A3.** Verifiser:
   - ✅ Hamburgeren viser **dagens hardkodede meny** (Dashbord · Sjekklister · Oppgaver · Maler · Tegninger · Mapper · Innstillinger) — ingen PROSJEKT/FIRMA-seksjonsoverskrifter.
   - ✅ Ingen visuell endring vs. dagens produksjon (byte-identisk).

---

## Del B — FM5/K2: «Mine timer» → brukermeny + søk

Krever at Timer-firmamodulen er aktiv på firmaet (ellers vises ikke «Mine timer» noe sted — det er korrekt gating). Bruk desktop-viewport.

### B1. Sidebar UTEN «Mine timer» i PROSJEKT-sonen

1. `resize_page` 1280 × 900.
2. Naviger til `https://test.sitedoc.no/dashbord/f6dcb81f-802c-415b-a6c6-a8fdf7f9710f/dashbord?nyNav=1`. Bekreft flagg = `"1"`.
3. 📸 **Skjermbilde B1** (venstre NavSidebar). Verifiser:
   - ✅ PROSJEKT-sonen har IKKE en «Mine timer»-rad (den lå der interimt før FM5).
   - ✅ Øvrige rader uendret (inkl. «Timer» og «Kontakter»).

### B2. Brukermeny (avatar) MED «Mine timer»

1. Klikk brukermeny-knappen øverst til høyre (avatar / brukernavn).
2. 📸 **Skjermbilde B2.** Verifiser:
   - ✅ Dropdown viser en **«Mine timer»**-lenke (BarChart-ikon) → `/dashbord/timer/mine`.
   - ✅ (For sitedoc_admin: også «Ny navigasjon»-toggle + «Logg ut».)
   - Klikk «Mine timer» → ✅ lander på `/dashbord/timer/mine`.

### B3. Søk: «timer» / «min side» med brødsmule «Min side»

1. Åpne søkemodalen: «Søk overalt»-pille i toppbaren, eller Ctrl/Cmd+K.
2. Skriv `timer`. 📸 **Skjermbilde B3a.** Verifiser:
   - ✅ Et treff **«Mine timer»** med brødsmule **«Min side»** (ikke «Prosjekt»).
   - ✅ Øvrige timer-treff (Timer, Timer-attestering, Lønnsarter …) uendret.
3. Tøm og skriv `min side`. 📸 **Skjermbilde B3b.** Verifiser:
   - ✅ «Mine timer — Min side» treffer (diakritikk-/ord-match).
4. (Valgfritt) Skriv `mine timer`, trykk ↵ → ✅ navigerer til `/dashbord/timer/mine`.

---

## Opprydning

Ingen data opprettes/endres (ren nav-verifisering). Sett flagget tilbake til ønsket
tilstand etterpå (`?nyNav=0` hvis testmiljøet skal stå av-default).

## Rapportformat

```
Test: Redesign-nav (nyNavigasjon) — T9 + FM5
A1 (flagg på, m/ prosjekt):  ✅/❌  [skjermbilde]
A2 (flagg på, disabled):     ✅/❌  [skjermbilde]
A3 (flagg av, byte-ident.):  ✅/❌  [skjermbilde]
B1 (sidebar u/ Mine timer):  ✅/❌  [skjermbilde]
B2 (brukermeny m/ Mine timer): ✅/❌ [skjermbilde]
B3 (søk «timer»/«min side»): ✅/❌  [skjermbilde]
Avvik/kommentarer: […]
```

Lever skjermbildene + rapporten til fabel (via Kenneth) for designgodkjenning.
