# Flytmodell pilot — Kenneths runde-2 live-test (2026-08-02, etter A+B+D-fiks)

> Pilot-fiks A+B+D/#11 (`29b26d47`) + backfill (23 dok) deployet til test. Kenneth testet 4-ledds distinkt-person-flyt (KB2-012/014/016/017; flyt «Sitedoc Ansatte»: Registrator→Bestiller→Utfører→Godkjenner). 19 bevis (`bevis-01..19`) i denne mappa. 18 nummererte funn. **Til fabel: bøtte 1 (flyt-semantikk) + bøtte 3 (merkelapper). Bøtte 2 = eng-fiks (cowork ruter). Bøtte 4 = kontekst-fra-innlogging-sporet.**

## ✅ Pilot-fiksen bekreftet (A+B+D holder)

- **B** — kontroll-ledд som mottar Besvar viser primær «Send til N·X →» (bevis: KB2-017 ledд 2 «Send til 3», ledд 3 «Send til 4»); siste ledд «Godkjenn og fullfør ✓». Ikke «Godkjenn» lenger.
- **A** — split-▾ ren, ingen velger-innhold blør gjennom.
- **Besvar→bakover** (#14) — Besvar fra ledд 3 → ball tilbake til ledд 2. ✓
- **D + backfill** — 23 sjekklister re-avledet; gjenåpnede dok viser «Hos N», ikke «Utkast».
- **Bygg-stempel** — «Bygg 29b26d47 · 16:52» i Innstillinger.

## De 18 funnene → 4 bøtter

### Bøtte 1 — FLYT-SEMANTIKK (fabel — den tunge)

**#15 + #12 — «Send tilbake» og «Besvar» er redundante bakover-handlinger.** «Send tilbake» = `responded→in_progress`; «Besvar» = `received→responded`. Begge går bakover. Kenneth (#15): «to kommandoer som gjør det samme → eneste logiske her er videre tilbake til 2». (#12): fra `Mottatt` savner han å kunne «sende tilbake til kmy» (avsenderen) — får kun Send-forover eller Slett. **Cowork-kode-note:** `beregnRuting` (flytFakta.ts) håndterer `sent`/`responded`/`draft(§2.4)` — men **ikke `in_progress`** → «Send tilbake» flytter ikke posisjon konsistent (delvis «ble stående», delvis «gikk til 3» — inkonsistent). Trenger fabel-semantikk-vedtak: behold én bakover-handling (Besvar←) og fjern/redefiner «Send tilbake», ELLER gjør «Send tilbake» posisjon-styrt.

**#16 + #17 + #18 — status-uenighet + ønsket «Under arbeid».** Sjekkliste-status viser «Mottatt», men tidslinje-loggen viser «Under arbeid» for samme handling (#16: «Ingen av disse er teknisk feil», men de er uenige). Kenneth (#18): for et dok som er bearbeidet + sendt tilbake passer **«Under arbeid · venter på kmy»** best, ikke «Mottatt». → **Q1=A (in_progress-kollaps) bør revurderes.** in_progress er halvkollapset: skjult i den avledede statusen (Q1=A), men fortsatt skrevet i loggen som «Under arbeid». Enten kollaps helt (fjern «Under arbeid» fra loggen òg) ELLER gjeninnfør «Under arbeid» som synlig avledet status. Fabels status-modell-kall.

**#10b + #11 — «Trekk tilbake» der det ikke gir mening + trekk-tilbake-status.** (#10b): «Trekk tilbake» tilbys på ledд 1 (fersk registrator-utkast) — «hva trekker man tilbake fra?» Ingenting er sendt. (#11): trekk-tilbake fra `Mottatt/venter-på-kmy` → «Utkast», samme posisjon — Kenneth: «for så vidt ok status». → knytter til den allerede-flaggede trekk-tilbake-status-saken (skal trukket-tilbake dok være «Utkast» eller «Hos [avsender]»?), + guard: «Trekk tilbake» skal ikke tilbys der ingenting er sendt.

### Bøtte 2 — SMÅ ENGINEERING-BUGS (cowork ruter til Opus)

**#4 — slett-hover-tooltip mangler** (hover som skal forklare Slett-funksjonen vises ikke).
**#10a — split-▾-hover-tooltip renderer BAK sidebaren** (posisjon/z-index; tooltipen på ▾-valgene legger seg til venstre bak nav) — må frem foran. Bevis: tooltip «Send til 2 · Sitedoc Ledelse → Sendt. Flytter dokumentet ett ledд fram…» klippet bak sidebar.

### Bøtte 3 — MERKELAPPER / INFO (fabel-design)

**#6 — «UTFØRER»-etiketten i detalj-headeren skal hete «Faggruppe».** Feltet viser en faggruppe (Sitedoc Bygger…), ikke en «utfører».
**#7 + #8 — flytlinja/headeren mangler dokumentflyt-navnet.** Flytboksene vises (ok), men det står ingensteds at dette er dokumentflyt **«Sitedoc Ansatte»** (Registrator→Bestiller→Utfører→Godkjenner).

### Bøtte 4 — KONTEKST FRA INNLOGGING (fabels eksisterende spor)

**#2 — innlogget byggeplass huskes ikke** etter ut/inn-logging.
**#3 — ny sjekkliste arver ikke valgt byggeplass** → byggeplass står tom, må velges manuelt (Kenneth slettet utkastet + valgte B12 på nytt).
→ begge er «logg feltarbeideren helt inn til byggeplass»-innsikten (fabels kontekst-fra-innlogging-designnotat). Ikke nye saker — hører til det sporet.

## Cowork-innstilling

Ingen regresjon i A/B/D — pilot-fiksen står. De nye funnene er (1) en reell flyt-semantikk-reconciliation som er fabels (bakover-handlinger + «Under arbeid»-status), (2) to små eng-bugs cowork ruter, (3) to merkelapp-saker (fabel), (4) kontekst-fra-innlogging som alt er et fabel-spor. Anbefaling: fabel tar bøtte 1 + 3 samlet (henger sammen — status + handlinger + merkelapper på samme flate); cowork ruter bøtte 2 som liten eng-fiks; bøtte 4 legges til kontekst-sporet.
