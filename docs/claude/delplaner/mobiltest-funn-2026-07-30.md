# Mobiltest-funn 2026-07-30 (Kenneth, iOS) — fabel-analyse + ordrepunkter

> Testbygg: `40236d22` (54.0.7) = develop FØR P4a/P4b-merge. Funn 1–5 (umfiltrert malvelger, gammelt opprett-skjema) er dermed FORVENTET gammel flyt — ikke regresjon. P4a-retesten krever P4a-bygg (Expo dev-client fra `feat/p4a-ios-modal`).

## Funn A — modal uten Avbryt (kommentar-modal, bilder 6–8) — GATE-FUNN, egen liten ordre
«Ny kommentar»-fullskjermmodalen (mobil) har kun Send. Ingen Avbryt/lukk, ingen swipe-dismiss registrert; Kenneth måtte SENDE en ufrivillig kommentar for å komme ut (nå synlig i Dialog på BEF1 — kan slettes?).
**Prinsipp (inn i FABEL-RAMMEVERK § Effektivitets-gate, pkt 5 — Avbrytbarhet):** enhver modal/flate som starter en handling skal ha eksplisitt Avbryt-affordance (knapp, X, eller dokumentert swipe/utenfor-trykk); en handling skal aldri være eneste utvei. Trykk-utenfor holder bare der modalen faktisk er delvis (bottom-sheet) — fullskjerm krever knapp.
**Ordre (liten):** sweep mobil-modaler: kommentar-modal (mangler helt), opprett-modal (har Avbryt ✓), status-bottom-sheet (utenfor-trykk ✓ men usynlig affordance — vurder synlig Avbryt), øvrige fullskjerm-modaler. Nå-sjekk lister alle; fiks = Avbryt-knapp konsistent plassert (venstre i header, som opprett-modalen). Kan Kenneths ufrivillige kommentar på BEF1 slettes in-app? Hvis nei → dialog-sletting er eget hull (noter, ikke bygg nå).

## Funn B — flyt-posisjon/ball mangler på mobil-detalj (bilder 3–5) — design-sak
Web-detaljen har flyt-posisjon-header (REGISTRATOR→UTFØRER→GODKJENNER-chips m/aktiv markering). Mobil-detaljen viser kun status-pill + faggruppe-chip — ingen «hvem har ballen», ingen flyt-posisjon. Kenneths forventning: dokument i MIN innboks ⇒ skjermen bekrefter at JEG har ballen.
**Forslag:** kompakt flyt-posisjonslinje øverst på mobil-detalj (gjenbruk web-leddmodellen/`byggLedd` — delt kilde), aktiv part uthevet + «Du har ballen»-mikrotekst når recipient = meg/min gruppe. Skisse fra fabel før ordre. Hører naturlig sammen med P4a+-runden (mobil detalj-skjerm røres uansett av chip-arbeidet senere).

## Funn C — tidslinje-spam fra gammel Send-bug (bilder 3–5) — kosmetisk backlog
KB27 viser ~15 Sendt↔Mottatt-par fra P1-bugens no-op-klikk (historiske loggrader; bugen selv er fikset). Forslag: kollaps konsekutive identiske statuspar i tidslinje-visningen («Sendt ⇄ Mottatt ×8», ekspanderbar). Ren visnings-sak, lav prioritet.

## Funn D — mobil-MalVelger-konsum av pkt 0 — VERIFISER i P4b-diffen
P4b Ledd 2 var web-only. Bekreft at `MalVelger.tsx` filtrerer på server-feltet `opprettbar` (Opus' anbefalte form sa «mobil arver gratis» — men bare hvis konsumet faktisk ble kodet). Hvis ikke: egen liten wiring-sak FØR mobil-app-release, ellers består Kenneths bilde-1/9–11-bug på mobil etter merge.

## Ruting
A = liten ordre nå (uavhengig av P4) · B = fabel-skisse → ordre · C = backlog · D = verifiseringspunkt til cowork på P4b-merge-gaten.
