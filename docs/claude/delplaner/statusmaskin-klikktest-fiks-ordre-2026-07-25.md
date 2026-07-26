---
name: statusmaskin-klikktest-fiks-ordre
status: 🟢 BYGGEORDRE for kode-Opus — to koherens-fikser fra klikktesten. Ren kode. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (F0–F5 inne)
opphav: Chrome-Opus klikktest 2026-07-25 — T6/T7 videresend-avvik + T2 slett-tekst
---

# Byggeordre — klikktest-fikser (Videresend-hover + Slett-tekst)

Chrome-Opus fant to koherens-brudd mellom matrise/hover og faktisk dokument-UI. Begge små, i `DokumentHandlingsmeny` + i18n.

## Ufravikelig
- **INGEN migrering** — ren kode. **Ikke gjør § 0-refaktoren.** Ikke rør STATUS-AKTUELT/BACKLOG. Ikke merge — push feature-branch.
- Norsk bokmål, `t()`-i18n, ingen `any`.
- **Koherens (STYRENDE):** etter fiksen skal videresend-cellen stemme overens matrise ↔ hover ↔ knapp (tekst + tooltip).

## Fiks 1 — Videresend: merk knappen + wire hover
Bakgrunn: F5 la til en egen «Send» (fram). Kryssflyt-kontrollen er fortsatt merket **«Send ⌄»** («SEND VIDERE TIL:») og mangler hover — så to kontroller heter «Send», og videresend-teksten (`flythjelp.handling.videresend` = «på tvers av dokumentflyter», finnes alt, linje ~313–314) vises aldri.

1. I `DokumentHandlingsmeny.tsx`: der Send-nedtrekket rendrer **videresend** (ikke-draft: `ellers → videresend (forwarded)`, kommentar ~linje 365), **merk kontrollen «Videresend»** (Kenneth-bekreftet ordlyd) — tydelig skilt fra F5s «Send»-fram. For **draft** forblir kontrollen «Send» (førstegangs-send til faggruppe) — kun ikke-draft/videresend-tilfellet omdøpes.
2. **Wire Tooltip v2** (`flythjelp.handling.videresend`) på videresend-trigger-en, samme mønster som primærknappens `Tooltip` (~linje 544). Tittel «Videresend → Videresendt» + brødtekst «... på tvers av dokumentflyter ...».
3. Verifiser i DOM at trigger-en får `aria-describedby` (Tooltip v2 gir det automatisk).

## Fiks 2 — Slett-bekreftelse: bruk 90-dagers-teksten
Bakgrunn: bekreftelsen bruker gammel `flythjelp.handling.slettKladd` = «Sletter kladden din permanent» (linje ~2167), men oppførselen er soft-delete til papirkurv i 90 dager (F0).

4. Rewire slett-bekreftelsen/mikroteksten fra `flythjelp.handling.slettKladd` (og `slettTrukket` der den brukes til vanlig Slett) til F0s **`flythjelp.handling.slett`** («Legger dokumentet i slettede. Det kan gjenopprettes i 90 dager — deretter slettes det endelig.»). «Slett endelig» beholder sin egen `slettEndelig`-tekst («permanent, før 90-dagersfristen»).
5. La `slettKladd`/`slettTrukket`-nøklene ligge som relikvier (fjerning = konsoliderings-oppryddingen); ikke slett dem her, bare slutt å bruke dem for vanlig Slett.

## DoD
- [ ] Videresend-kontrollen merket «Videresend» (ikke-draft) + Tooltip v2 med `flythjelp.handling.videresend`; DOM viser `aria-describedby`. Koherens matrise↔hover↔knapp bekreftet.
- [ ] Slett-bekreftelsen viser 90-dagers-teksten (`flythjelp.handling.slett`), ikke «permanent».
- [ ] web typecheck + test grønt. Vis diff. Push `feat/klikktest-fikser`. Ikke merge. Ikke rør STATUS/BACKLOG.
