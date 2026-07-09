# F2 — skjermbilder for designgodkjenning (mobilapp)

Simulator: iPhone 16 Plus, mobil-API mot test.sitedoc.no (tunnel 3301).
Prosjekt: «Markussen Boligfelt B12» (Byggeleder -Firma). Seedet testdata:
Ola Tømrer (Registrator, **Leser**, tlf +47 900 12 345) + Per Prosjektadmin
(Godkjenner, **Redigerer**) i dokumentflyt «A.Markussen Ansatte».

| # | Fil | Viser |
|---|-----|-------|
| 1 | `1-mer-fane-dokumentflyt-grupper-qr-fjernet.png` | Mer-fanen: «Dokumentflyt» til stede (funksjonell), «Grupper» + «Skann QR» fjernet |
| 2 | `2-null-prosjekt-tilstand.png` | Uten aktivt prosjekt: «Velg et prosjekt for å se dokumentflyt» (ingen crash/spinner) |
| 3 | `3-etter-faggruppe-populert-leser-redigerer.png` | «Etter faggruppe»: A.MARKUSSEN AS → Ola (Leser, amber) + Per (Redigerer), badge + ekspander-chevron |
| 4 | `4-etter-faggruppe-ekspandert-per-flyt.png` | Ola ekspandert: per-flyt-detalj «A.Markussen Ansatte · Registrator · Leser» |
| 5 | `5-etter-person-tlf-chip.png` | «Etter person»: Ola med tlf-chip (+47 900 12 345) + e-post; øvrige kun e-post |
| 6 | `6-toast-fallback-ingen-raa-feil.png` | Tel-tap i simulator → stille toast «Kunne ikke åpne – …», ingen rå «Unable to open URL» |

Berørte filer: `apps/mobile/app/dokumentflyt.tsx` (ny read-only skjerm),
`apps/mobile/app/(tabs)/mer.tsx`, `apps/mobile/app/kontakter.tsx` (defensiv chip-fiks),
`apps/mobile/src/lib/apnLenke.ts`, `apps/mobile/src/components/MiniToast.tsx`.
