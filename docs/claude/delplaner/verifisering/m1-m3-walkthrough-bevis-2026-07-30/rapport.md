# M1–M3 mobil detalj-redesign — live-verify + Kenneth-walkthrough (2026-07-30)

> Branch `feat/mobil-detalj-redesign` @ `c231531b` · testet på **4-rolle-flyt** (Sitedoc Bygger Boligfelt B12: Registrator→Bestiller→Utfører→Godkjenner) · KB210. Cowork-triage av Kenneths 7 punkter mot koden. Bilder: `bevis-01..07.png` i denne mappa.

## ✅ Bekreftet virker (kjernevedtaket)

| Bevis | Viser |
|---|---|
| bevis-01 | Flyt-sheet (M3): 4 nummererte ledd, «DIN TUR»-badge på aktivt (Registrator), rolle + «(deg)» + medlemsliste, synlig «Lukk ✕». **#1+#3-fiksen virker: 4 ledd, ikke 1 chip.** |
| bevis-03 | Header-flytlinje: «Sitedoc Ansatte → Sitedoc Led… +2» + «● Du har ballen». Primær **«Send til Sitedoc Ledelse»** (retningsnavnet virker). «Lagret automatisk 18:18». |
| bevis-04 | Bekreftelse **«Send til Sitedoc Ledelse?»** (#2-fiksen: speiler primæren, ikke lenger «…bytte til Send?»). |
| bevis-05 | Mottatt-tilstand: primær lilla **«Besvar til Sitedoc Ledelse»**, header «Venter på Sitedoc Ledelse». |
| bevis-06 | Split-meny «Handlinger» i fabel-rekkefølge: Godkjenn → Lagre og lukk → **Avvis** (rød) → Videresend → Bytt flyt → ADMIN: Trekk tilbake. Synlig «Lukk ✕». |

Klikk-budsjett bekreftet i praksis: «hvem har ballen» = 0 tap (i header), Send = primær(1) → bekreft(2).

## Kenneths 7 punkter — cowork-triage

**#2 — misliker ny kommentar-inngang (bevis-02).** Kommentar åpner en fullskjerm-modal («Kommentar», Avbryt/Ferdig). → **Design, fabel avgjør.** Merk: dette er `FeltDokumentasjon`-kommentarmodalen (forhåndseksisterende), M4 la kun til Avbryt-knappen. Kenneth ønsker seg trolig inline-inngang i stedet for fullskjerm. Fabel-kall.

**#3 — er malbyggeren endret, eller bare sjekklistene?** → **Cowork-verifisert: redesignet/P1–P4 rørte IKKE sjekkliste-felt-rendringen.** `RapportObjektRenderer` ble kun berørt av M4 (Avbryt i kommentarmodal) + P2 (6 wire-ins). Malbyggeren har hatt EGEN, separat gap-bygging (`56cb0cfa` — grenseverdier/quiz/kollaps/kopiér-mal). Ser sjekklistene annerledes ut, kommer det fra malbygger-gap-arbeidet, ikke fra detalj-redesignet. Ingen regresjon her.

**#4 — hvorfor må jeg bekrefte at jeg sender videre? (bevis-04)** → **Intendert per ordre.** Bekreftelses-sheeten ER den valgfrie kommentar-inngangen (unngår dobbel bekreftelse), og teller som tap 2 i klikk-budsjettet. Fabel: skal den kunne hoppes over når bruker ikke vil kommentere (f.eks. Send = 1 tap direkte, kommentar via split)? Design-kall.

**#5 — etter sending står den «som dette»; er det min admin som gjør det ulogisk? «jeg er medlem overalt» (bevis-05).** → **Test-konto-artefakt, ikke bug.** Kenneth er medlem i ALLE roller i denne flyten (se bevis-01: kmy/Kenneth/Sitedoc Ledelse i hvert ledd). Da holder han ballen på NESTE ledd umiddelbart etter Send → «Besvar til …» vises rett etterpå. Med separate personer per rolle ville dokumentet forlatt hans innboks. **Anbefaling: fabel/test-data — en demo-konto som er alle roller gjør flyten forvirrende å verifisere; vurder en test-flyt med distinkte personer per ledd.**

**#6 + #7 — «Lagre og lukk»: hva skjer? «den ble lukket, ble ikke sendt videre».** → **Cowork-verifisert KORREKT.** `håndterLagreOgLukk = await lagre(); router.back()` — lagrer utkast + lukker **skjermen**. Endrer IKKE dokumentstatus (ingen «lukket»/closed). «Den ble lukket» = skjermen, ikke dokumentet; det står fortsatt som utkast, korrekt ikke sendt. **MEN:** navnet «Lagre og lukk» er tvetydig (lukk skjerm vs lukk dokument) — Kenneth leste det som at dokumentet ble lukket. **Reell mikrotekst-sak → fabel** (jf. mikrotekst-standard: handlingstekst skal være entydig; f.eks. «Lagre og gå tilbake»).

**#7b — filterfunksjonen ser svak ut, få filtervalg (bevis-07).** Sjekkliste-lista har chips: Alle/Utkast/Mottatt/Godkjent/Lukket. → **Design, fabel.** Utenfor M1–M3-scope (list-flate, ikke detalj-flate) — egen liten sak.

## Cowork-innstilling til merge

Kjernevedtaket (M1–M3) er bevist virker på 4-rolle-flyt. Ingen av de 7 punktene er en regresjon eller blokkerende bug i M1–M3:
- **Verifisert korrekt (ingen handling):** #3, #5, #6/#7 (Lagre og lukk-oppførsel).
- **Design-kall til fabel (kan gå post-merge som egne små saker):** #2 (kommentar-inngang), #4 (bekreft-på-send), #7b (filter), + mikrotekst-fiks på «Lagre og lukk»-navnet (#6/#7).

**Anbefaling:** M1–M3 kan merges når fabel har sett denne rapporten og bekreftet at design-punktene (#2/#4/#7b + «Lagre og lukk»-navnet) håndteres som egne oppfølgere, ikke blokkere denne runden. Mikrotekst-navnet på «Lagre og lukk» er den eneste jeg vil vurdere å ta FØR merge (billig, ett-strengs, unngår forvirring i prod).
