# Fabel-svar — endringslogg i arkivmalen (fem spørsmål) — 2026-08-11

Kenneth har rett, og cowork leser det riktig: loggen er revisjonssporet,
stempelet er bare uttaks-kvitteringen. Spec-tillegg under; fase 3 er
avblokket igjen når dette er tatt inn.

## 1. Plassering: egen seksjon bakerst i dokumentet, foran signaturblokken? Nei — ETTER innhold, FØR signaturer, som siste innholdsseksjon

Loggen er innhold med samme rang som tiltakstabellen — ikke vedlegg.
Seksjonsheading i samme stil: «Endringslogg». Blir den lang, bryter den
naturlig til nye sider (rendreren paginerer; tabellen får <thead> som
gjentas per side). Signaturblokk + bunntekst forblir dokumentets avslutning
— signaturen skal stå etter det den bekrefter, inkludert loggen.

## 2. Begge: sammendrag i statusblokken + full logg som seksjon

- Statusblokken får femte felt når logg finnes: «Sist endret —
  {navn}, {dato}».
- Full logg som egen seksjon (pkt. 1): dato/tid · bruker · felt ·
  fra-verdi → til-verdi. Kronologisk, eldste først (leses som historie).
- Ingen trunkering i arkivutgaven — en forkortet revisjonslogg er ikke en
  revisjonslogg. Blir den 40 sider, ER dokumenthistorikken 40 sider.

## 3. Logg av: én ærlig linje, aldri tom seksjon

Når `enableChangeLog = false` på malen: ingen loggseksjon, men linje i
statusblokk-området: «Endringslogg ikke aktivert for denne dokumenttypen».
Coworks resonnement tiltres — en tom seksjon leses som «ingen endringer»,
og det er usant. Fravær av spor skal se annerledes ut enn spor uten
hendelser.

## 4. Ja — loggen er sporbarhetsminimum

Når `enableChangeLog` er på for malen, kan loggen ikke velges bort i
`utskriftsinnstillinger`. Samme prinsipp som resten: innstillinger styrer
presentasjon, aldri sporbarhet. Å tillate «logg på i systemet, av i
utskriften» ville gi byggherren et dokument som ser komplett ut, men er
redigert i presentasjonen — verre enn ingen logg.

## 5. Verifisert: timer/utlegg HAR logg-ekvivalent — men annen form

- **HMS:** bæres av oppgave/sjekkliste → `TaskChangeLog`/
  `ChecklistChangeLog` gjelder direkte. Samme seksjon, gratis.
- **Timer/utlegg:** har `sheet_rad_historikk` (db-timer, migrering
  20260713120000) — write-only audit av ERSTATTEDE radversjoner (snapshot
  via to_jsonb + delete), indeksert på sheet_id/original_rad_id/rad_type.
  Det er versjonshistorikk, ikke feltdiff. Malseksjonen for
  timer/utlegg-dokumenter blir derfor **«Revisjoner»**: per rad som er
  erstattet — tidligere verdier (fra snapshot) mot gjeldende, med
  tidspunkt. Ikke tving den inn i felt-diff-formen; to logg-former, én
  visuell ramme (samme heading-stil og tabellform).
- I tillegg gjelder `ordningVedFoering`-stempelet og korreksjonsrader med
  synlig kreditering (U1) — de ER utleggets revisjonsspor på radnivå og
  gjengis i dokumentet som de er ført.

## Mockup

Jeg oppdaterer mockupen med loggseksjon på sjekkliste-siden (side 1) +
«ikke aktivert»-linjen på den avskrudde varianten (side 2) når dere vil se
den — si fra om Kenneth vil ha visuell bekreftelse før fase 3-ordren låses,
ellers holder denne specteksten.

— fabel (relayet av Kenneth)
