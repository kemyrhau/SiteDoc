# Ordre M1–M3 — mobil detaljskjerm: flytlinje + P3-handlingslinje + flyt-sheet (fabel → redesign-Opus, via Kenneth, 2026-07-30)

> Kenneth-godkjent mockup 2026-07-30: `Mobil Detalj Redesign.dc.html` (1a hovedtilstand, 1b split-meny, 1c flyt-sheet). Grunnlag: mobiltest-funn-2026-07-30.md funn B + coworks Q1-ranking (P3-speiling valgt). Berørte flater: `apps/mobile/app/oppgave/[id].tsx`, `apps/mobile/app/sjekkliste/[id].tsx`, `src/components/DokumentHandlingsmeny.tsx`, `src/components/FlytIndikator.tsx`, `src/utils/dokumentflyt-ledd.ts` (leses, røres ikke).

## 0. Nå-sjekk FØRST (rapporteres før koding)
1. **Autolagring**: bekreft at utfyllings-synken (synkStatus/lagreStatus i detalj-headeren, OpplastingsKoProvider) faktisk persisterer ALLE felttyper uten manuelt «Lagre utfylling»-trykk. Hvis manuelt trykk fortsatt kreves for noen felttyper: rapporter hvilke — M2s Lagre-demotering gates på dette (negativ påstand krever oppgitt søkerom: alle RapportObjekt-typer + kommentar/vedlegg).
2. **hvilke detaljskjermer** bruker DokumentHandlingsmeny (kjent: oppgave, sjekkliste — bekreft ingen flere).
3. Bekreft at `hentRolleFiltrertHandlinger` + `byggLedd` er delte kilder mobil↔web (skal være det post-P1/P3).

## M1 — Én flytlinje (funn B)
- Slå sammen dagens to representasjoner: boks-raden i `DokumentHandlingsmeny` (BOKS_WIDTH-radene) og `FlytIndikator` → ÉN flytlinje i den blå headeren.
- Innhold per ledd: faggruppefarge-svatt (10px) + navn; aktivt ledd hvit chip m/fet tekst (mockup 1a). Kompakt-regelen fra FlytIndikator beholdes (aktiv + nabo, «+N» ved >3 ledd).
- Under linjen: «Du har ballen»-mikrotekst (grønn prikk) når recipient = meg/min gruppe; ellers «Venter på [aktivt ledd]». i18n.
- Tap på flytlinjen → M3-sheeten. Boks-raden i bunn FJERNES.
- Delt kilde: `byggLedd`/`finnAktivtIndex` — ingen ny ledd-logikk.

## M2 — P3-mønster på mobil (handlingslinje)
- Samme regel som web-P3-ordren: én primær (`erPrimaer`) + split-▾ med ALLE øvrige lovlige handlinger fra `hentRolleFiltrertHandlinger` — ingen UI-egen handlingsliste.
- Primærknapp navngis med retning: «Send til [neste ledds faggruppenavn]» / «Besvar til […]» (neste ledd fra byggLedd). Full bredde + ▾-segment (mockup 1a).
- Split-sheet-rekkefølge (mockup 1b): framover → Lagre og lukk → destruktive (Avvis, rød, beholder påkrevd begrunnelse/P2-gating) → Videresend… → Bytt flyt (dagens flyt-bytte-knapp flyttes inn hit) → Admin-handlinger (⋯-menyen flyttes inn hit). Egen ▾-sheet og admin-modal slås altså sammen til ÉN sheet.
- «Lagre utfylling»-knappen demoteres: autolagring + «Lagret automatisk HH:MM ✓»-mikrotekst + sekundær tekstknapp «Lagre og lukk» (GATES på nå-sjekk pkt 1 — hvis autolagring ikke dekker alt, beholdes Lagre som sekundær knapp ved siden av primær, og demotering blir egen sak).
- Bekreftelses-sheet ved statushandling beholdes som i dag (den ER kommentar-inngangen — ikke dobbel bekreftelse).
- **Påkrevd-validering på Send (fabel-avgjort 2026-07-30, etter nå-sjekk):** valideringen fra dagens Lagre-knapp bæres videre som **deaktivert primær Send + caption** — gjenbruk P2-mønsteret (`besvarDeaktivertGrunn`-mekanismen som alt finnes i `DokumentHandlingsmeny`), tekst «X påkrevde felt gjenstår» (i18n, flertallsbøyd). Feilen synlig FØR trykk, ingen død-tapp, ingen Alert. To presiseringer: (a) valideringen gjelder KUN framoverstatus (Send/Besvar) — «Lagre og lukk» og autolagring validerer ALDRI (utkast skal kunne være ufullstendige); (b) dagens felt-nivå `valideringsfeil`-markering beholdes så brukeren finner feltene — captionen er telleren, feltmarkeringen er veiviseren.
- Ikke-eier/lesevisning: som i dag (ingen handlingslinje), men flytlinjen (M1) vises alltid.

## M3 — Flyt-sheet (erstatter flat medlemspopup)
- Tap på flytlinje → bottom-sheet (mockup 1c): ledd vertikalt 1→2→3, nummererte fargede noder, aktivt ledd uthevet (grønn ramme) m/«DIN TUR»-badge når det er brukerens tur.
- Per ledd: faggruppenavn · rolle, ★ hovedansvarlig, «(deg)»-markering, siste hendelses-tidsstempel fra overføringene der det finnes.
- REN VISNING — ingen statushandlinger i sheeten (de bor i M2-knappen). Dagens boks-popup m/status-knapper utgår.
- Synlig «Lukk» i sheet-header (Avbryt-prinsippet, rammeverk § Effektivitets-gate pkt 5).

## Ufravikelig
- i18n alle nye strenger (nb + eksisterende språk-nøkkelsett).
- Ingen server-/statusmaskinendring. Delte kilder: `byggLedd`, `hentRolleFiltrertHandlinger`, `statusKreverBegrunnelse`.
- Alle nye sheets har synlig Avbryt/Lukk (funn A-prinsippet).
- Flagg-nøytralt (dette er funksjonsflate, ikke nav-skall).
- Begge detaljskjermer (oppgave + sjekkliste) endres likt — felles komponent, ikke duplisert JSX.

## Klikk-budsjett (rapporteres ved levering)
- Send (hyppigste handling): i dag boks(1) → status(2) → bekreft(3), usynlig inngang. Mål: primær(1) → bekreft(2). 3 → 2 taps.
- «Hvem har ballen»: i dag popup + tolkning. Mål: 0 taps (synlig i header).

## Gate
Nå-sjekk-rapport → fabel bekrefter/justerer → kode → build grønn → skjermbilder (min.: draft, received×utfører, received×godkjenner, ikke-eier, split-åpen, flyt-sheet) → fabel task-walkthrough mot klikk-budsjett → dok-sync (mobil.md) → cowork-merge.

## Utenfor denne ordren
- M4 Avbryt-sweep: egen liten ordre (mobiltest-funn-2026-07-30.md funn A) — går uavhengig.
- M5 tidslinje-kollaps (funn C): backlog.
- Web røres ikke (P3 eier web-linjen).
