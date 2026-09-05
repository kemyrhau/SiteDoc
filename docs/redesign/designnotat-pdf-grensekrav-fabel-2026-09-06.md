# Designnotat — arkiv-PDF viser GRENSEKRAVET (DG-tillegg, premiss 3-utskillelsen) — fabel 2026-09-06

Sak fra `kp-malkvalitet-kall-premiss3-fabel-2026-09-05.md` § 1. Funn (cowork-målt, fabel-
verifisert i kode 06.09): `packages/pdf` bruker hverken `formaterGrense`, `normaliserGrense`
eller `grenseStatus` — en arkiv-PDF viser målt verdi, aldri kravet den ble målt mot.
Byggherren ser «14 mm», ikke at kravet var ≤ 10 mm. Mangel i kundeleveransen i dag,
uavhengig av Vei B.

## Visning (designlås — følger radkort-/tabellformen i arkivmalen)

For `integer`/`decimal`/`calculation` med grense (`harGrense`):

- **Utfylt, innenfor:** `14 mm` + dempet kravtekst etter verdien: `· krav ≤ 15 mm`
  (kravteksten er `formaterGrense`-formatet: «≥ 2 %», «± 3 mm», «2–10 mm»).
- **Utfylt, utenfor:** `14 mm — UTENFOR KRAV (≤ 10 mm)` — fet + amber (print-oversatt:
  amber tekst + fet; aldri kun farge, ordet «UTENFOR KRAV» bærer semantikken i s/h-print).
  Statustekst per `GrenseStatus`: under → «UNDER KRAV», over → «OVER KRAV»,
  utenfor_toleranse → «UTENFOR TOLERANSE».
- **Tom med grense:** `Ikke utfylt (krav ≤ 15 mm)` — kravet står selv uten måling
  (F7-prinsippet: fravær skal synes, og kravet ER dokumentasjon).
- Felter uten grense: uendret. Web/mobil-utfylling: uendret (viser allerede grense/amber).

Mockup: `PDF Grensekrav Mockup.dc.html` (designprosjektet) — de tre tilstandene i
radkort-form.

## Arkitektur (designlås)

- **`packages/pdf` forblir null-avhengigheter** (`felt.ts`-kommentaren + CLAUDE.md §
  Prosjektstruktur respekteres — ingen shared-import, ingen duplisering av grenseSjekk).
  Løsning = eksisterende oppslagsmønster (som `tegningsOppslag`/`signaturOppslag`):
  **`config.grenseOppslag[objektId] = { kravTekst, status }`** — beregnes av laget som
  bygger `PdfConfig` (api-siden, som allerede importerer shared) med
  `normaliserGrense`/`grenseStatus`/`formaterGrense`. `felt.ts` rendrer kun strengene.
- **Vei B-kontrakten står:** når betingede grenser lander, bytter oppslagsbyggeren til den
  delte resolveren `(objekt, forelder-verdi) → Grense` — `felt.ts` røres ikke. Sakene er
  fortsatt uavhengige i rekkefølge.

## Snapshot-spørsmålet (flyttet hit fra Vei B) — fabel-kall

Problem: PDF-en rekonstruerer kravet fra malens config VED GENERERING — endres malen etter
utfylling, viser arkivet et annet krav enn det målingen ble vurdert mot.

**Kall: snapshot ved LAGRING.** Når en verdi lagres på felt med grense, lagres
`{ kravTekst, status }` sammen med feltverdien (additivt felt i verdi-JSON — ingen
migrering). PDF bruker snapshotet når det finnes; eldre data uten snapshot rekonstruerer
fra malen (dagens virkelighet, merkes ikke). Rotårsaksfiks fremfor plaster: arkivet
dokumenterer kravet slik det var da målingen ble gjort — samme prinsipp som
runde-/psiVersion-snapshotene. ⚠️ Enkeltmålt: cowork verifiserer at verdi-JSON-en tåler
tilleggsfeltet på begge flater (web + mobil lagrer feltverdier hver sin vei).

## Utenfor saken
- Grenser finnes kun på integer/decimal (cowork-målt) — andre typer røres ikke.
- MalBygger/utfylling: ingen endring. Vei B (betingede grenser): egen sak, uendret.

## Neste
Kenneths blikk på mockupen → cowork kost-sjekker oppslagsbygger + snapshot-punktet →
fabel skriver ordre (designlås = dette notatet).

— fabel
