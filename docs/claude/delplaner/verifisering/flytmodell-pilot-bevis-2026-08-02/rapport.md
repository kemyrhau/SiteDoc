# Flytmodell pilot — Kenneths live-test på test.sitedoc.no (2026-08-02)

> Batch `312a513e` deployet til test (meny-fiks + §2.4 + 5b + bygg-stempel). Kenneth testet **4-ledds distinkt-person pilot-flyt** (KB2-010: Ola Tømrer → Kari ansatt medlem → Sitedoc Ledelse → Byggherre Boligfelt B12). Bilder `bevis-01..09` (kronologisk 06:01–06:16) i denne mappa. Kenneth: «Jeg har ikke testet alt.» Cowork-triage under. **Til fabel for design-kall + bekreftelse; cowork ruter engineering-fiksene.**

## ✅ Bekreftet virker (kjernen står)

- **Distinkt-person-ruting** — tidslinjen viser korrekt forover-ruting med fire ULIKE personer (Ola/Kari/Sitedoc Ledelse/Byggherre), ikke lenger alle samme faggruppe. Pilot-seeden (5b) traff.
- **«Du har ballen — Kontrollerer avvik»**-mikroteksten vises på ballholderens aktive ledд (bevis-01).
- **§2.4-gjenåpning landet på riktig ledд** (bevis-06: gjenåpnet dok, ball på ledд 3, «Send til 4»).
- **Send-tilstandens split-▾ er korrekt** (bevis-04: Besvar/Godkjenn/Avvis/Videresend/Trekk tilbake) — meny-fiksen VIRKER for Send.
- **«Send til N·X →»** + **«Godkjenn og fullfør ✓»**-primærtekster vises.

## Kenneths 10 punkter (verbatim) + cowork-triage

**#1 + #2 — «godkjenn etter besvar? → skal være send».** Dok i `Besvart`, ball hos kontroll-ledд **2** (ikke siste ledд), «Du har ballen — Kontrollerer avvik». Primær viser grønt **«Godkjenn»**. Kenneth: skal være **«Send til N·X»** (forover), siden ledд 2 ikke er siste. → **COWORK-TRIAGE: primær-utledning-bug mot vedtatt regel.** «Godkjenn og fullfør» skal KUN vises på siste ledд (`nesteLedд=null`); ellers «Send». Her aktivPosisjon=2 → nesteLedд=3 → skal være Send. **Engineering-bug**, men fabel bekrefter ønsket primær når et kontroll-ledд mottar en Besvar (Send forover, ikke Godkjenn).

**#3 — «i Godkjenn tilstand kom denne feil med delvis skjult nedtrekksmeny tilbake».** Split-▾ i Godkjenn-tilstand viser velger-innhold som blør gjennom («Boligfelt B12»/«Bygger Boligfelt») — samme klasse som meny-fiksen løste for utkast. → **COWORK-TRIAGE: meny-fiksen (draftSend && !harFlyt) dekket KUN utkast; bleeden gjenstår i Godkjenn-tilstander.** Ufullstendig fiks, **engineering-bug**. Henger sammen med #1: er primæren feilaktig «Godkjenn», havner man i den buggy tilstanden.

**#4 — «i send modus er denne rett».** Send-tilstandens split-▾ korrekt (bevis-04). → **Bekreftelse, ingen sak.**

**#5 — «jeg måtte videresende uten å vite hva jeg trykket på for å komme ut av godkjenn».** Den buggy Godkjenn-tilstanden tvang gjetting for å komme videre. → **Følge av #1 + #3** (fikses med dem).

**#7 — «eneste lovlige tilleggshandling er slett, ikke sikkert det er feil, men da er det mange handlinger tidligere i dokumentforløpet som er feil».** Utkast @ ledд 3, primær «Send til 4», split-▾ = kun **«Slett»** (bevis-06). Kenneth: kanskje riktig, men da er tidligere tilstanders handlingssett inkonsistent. → **FABEL: handlingslinje-konsistens** — hvilke tilleggshandlinger skal hver tilstand ha? (Design-kall, din handlingslinje P3/M1–M3.)

**#8 — «mockup ble delvis skjult igjen i Godkjenn og fullfør».** Velger-bleed i «Godkjenn og fullfør»-tilstand (siste ledд, bevis-07). → **Samme som #3 (engineering).**

**#9 — «Gjenåpne har delvis skjult mockup».** Velger-bleed i Gjenåpne-tilstand (Godkjent-dok, bevis-08). → **Samme som #3 (engineering).**

**#10 — «trykket gjenåpne → status utkast → det er feil etter lang behandling og mange kommentarer → under arbeid eller lignende tilstand er ønsket».** Gjenåpne → status **«Utkast»** (bevis-09). Kenneth vil ha **«Under arbeid»** e.l. for et gjenåpnet dok med historikk — «Utkast» impliserer aldri-rørt. → **FABEL: status-semantikk.** Kolliderer med Q1=A-vedtaket (in_progress kollapset til «Hos N»). Et gjenåpnet dok med lang historikk merket «Utkast» er villedende. **Fabel-kall:** skal gjenåpnet/trukket-tilbake dok bære en distinkt «under arbeid»/«gjenåpnet»-etikett i stedet for «Utkast»?

## Cowork-oppsummering

**Engineering-bugs (cowork ruter til Opus etter fabels holistiske blikk):**
- **A. Meny-bleed gjenstår** i Godkjenn / Godkjenn-og-fullfør / Gjenåpne-tilstander (#3/#8/#9) — meny-fiksen var utkast-spesifikk, må dekke alle tilstander der en velger rendres i split-▾.
- **B. Primær «Godkjenn» der den skal være «Send»** (#1/#2/#5) — «Godkjenn og fullfør» kun på siste ledд; kontroll-ledд som mottar Besvar skal Sende forover.

**Fabel design-kall:**
- **C. Handlingslinje-konsistens** (#7) — tilleggshandlinger per tilstand.
- **D. Gjenåpne-status** (#10) — «Utkast» vs distinkt «under arbeid»-etikett for dok med historikk.

A + B henger sammen (feil primær → buggy tilstand). Anbefaling: fabel bekrefter B-regelen (Send ved besvart-mottak) + avgjør C/D → cowork ruter A+B (+ evt. C-justering) som én fokusert oppfølger-fiks til flytmodell-Opus.
