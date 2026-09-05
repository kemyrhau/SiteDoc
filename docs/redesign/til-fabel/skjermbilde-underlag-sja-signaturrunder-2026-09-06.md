# Skjermbilde-underlag — SJA-signaturrunder (redesign-Opus → fabel, 2026-09-06)

**Gate:** fabel sjekker flatene linje for linje mot mockupen (`SJA Signaturer Mockup.dc.html`)
+ klikk-budsjettet. **Flyttet av cowork til FØR PROD** (merge skjedde før gaten fordi
kontrollplan var blokkert på det delte TILBEHOR-settet). Ingenting når Kenneths telefon eller
A.Markussen før denne gaten er passert.

Branch: `feat/sja-signaturrunder` (`f5d75571`, på develop `276e8357`).

---

## Ett-stegs seed

```sh
# LOKAL eller TEST (aldri prod — guarden nekter fjernvert+/sitedoc uten SEED_CONFIRM_DB):
pnpm --filter @sitedoc/db seed:sja
```

Forutsetning: DB-en må ha migreringen `20260906000000_sja_signaturrunder` **og** develop-
kolonnene (test.sitedoc.no har begge etter test-deploy; en lokal DB må være à jour med
`develop`). Seeden er **idempotent** — kjør på nytt så mange ganger du vil; runder + deltakere
for demo-SJA-en nullstilles og bygges på nytt, prosjekt/mal/brukere gjenbrukes.

**Kilde:** `packages/db/prisma/seed-sja-signaturrunder.ts` (prod-guard speiler `seed-bibliotek.ts`).

> ⚠️ **Ikke kjørt i redesign-Opus' lokale sandkasse.** Den har historikk-drift (mangler
> enkelte develop-kolonner, f.eks. `report_templates.versjon_av_hovedmal`), og `db push` ville
> DROPPE ekte lokale data — som ikke gjøres uten godkjenning. Seeden er type-verifisert mot
> Prisma-klienten, og de tre signatur-tabellene er runtime-verifisert (inserts + XOR-CHECK).
> Den kjører rent mot test / en à jour lokal DB.

---

## Hva seeden bygger (scenariet fabel gater mot)

| Entitet | Verdi |
|---|---|
| Prosjekt | «SJA-signaturrunder demo» (`SD-DEMO-SJA-0001`) |
| Mal | «SJA — Løft med mobilkran» (`category=hms`, `subdomain=sja`) med ett `signature_list`-objekt |
| SJA-dokument | «SJA Løft mobilkran — Akse 4» |
| Deltakere (levende liste) | Kari Ansvarlig (admin), Ola Tømrer, Nina Elektriker, **gjest** Truls Kranfører (Kranutleie Øst AS) |
| **Runde 1 — AVSLUTTET** | alle 4 signert, `antallDeltakere` frosset = 4, HMS-kort på medlemmer, gjest «har ikke» |
| **Runde 2 — ÅPEN** | 2 av 4 signert (Kari + Ola). Manko: Nina (signerte forrige runde → amber forrige-rad) + Truls (gjest, aldri signert) |

**Innlogging:**
- `sja.ansvarlig@demo.sitedoc.no` = ansvarlig/admin → ser «Start ny runde», «Legg til deltaker», «Avslutt runde».
- `nina.elektro@demo.sitedoc.no` → ser **«Signer»** på egen manko-rad (gating: innlogget = deltakers userId).

---

## Flater å fange (mot mockupen)

1. **HMS-lista → SJA-fane:** SJA-kortet med chip `2/4` (amber). — *Verifiser: amber til komplett, grønn ved alle-signert.*
2. **SJA åpnet (som ansvarlig):** objekt-leder «Runde 2 · 2 av 4 signert» →
   - **manko FØRST** i amber boks: Nina (m/ «Signer» skjult for ansvarlig — ikke egen rad) + gjest-rad «signer på ansvarliges enhet».
   - signerte under (Kari, Ola) med tidspunkt + HMS-kort.
   - «Tidligere runder» amber (Nina fra runde 1) — teller ikke i X.
   - handlinger: «Legg til deltaker», «Avslutt runde».
3. **SJA åpnet (som Nina):** «Signer»-knapp på egen manko-rad. *Verifiser klikk-budsjett: 1 klikk signerer.*
4. **«Legg til deltaker»-modal:** prosjektmedlem-nedtrekk + gjest-skjema, Avbryt til stede.
5. **Avslutt runde → Start ny runde:** låst dokument VISER låsen («Låst — runde N avsluttet …»), «Start ny runde»-modal m/ valgfri årsak + Avbryt.
6. **MalBygger-guard:** dra et andre `signature_list` inn i malen → klartekst-modal «Dokumentet har allerede en signaturliste».
7. **Arkiv-PDF** (Skriv ut / rendrArkiv): hovedtabell = gjeldende runde med **«IKKE SIGNERT»** (Truls) + **forrige-runde-rad** (Nina, amber) ALLTID med (F7); topplinje «Runde 2 (startet …) · 2 av 4 signert · generert …»; «Med logg»-seksjon = begge runder m/ dato/årsak.
8. **Mobil:** samme objekt i sjekkliste-detalj (SignaturListeObjekt) — leder, manko, Signer.

---

## Klikk-budsjett (målt mot implementasjonen)

| Handling | Budsjett | Faktisk |
|---|---|---|
| Signere egen rad fra åpnet dokument | ≤ 2 | **1** (Signer — ingen modal/pad) |
| SHA-KU finner manko | 0 nye | **0** (chip i lista + manko FØRST i objektet) |
| Gjenta kjent jobb: åpne → Start ny runde → bekreft | ≤ 3 | **3** |
| Legge til deltaker fra prosjektet | ≤ 3 | **3** web / **2** mobil (tap rad) |

---

## 🔴 Tre begrensninger — to er designspørsmål fabel skal svare på

**1. Signering er 1-klikks attest, ingen signaturpad/HMS-kort inline (DESIGNSPØRSMÅL).**
For å holde klikk-budsjettet (signer = 1) er «Signer» én handling: identiteten er innlogget
bruker, tidspunktet fanges (lokal-ISO, samme form som signaturfeltet «dd.mm.åååå kl. hh:mm»).
Ingen tegnet signatur, ingen HMS-kort-innhenting i signeringsøyeblikket. Schema bærer
`signaturbilde` + `hmsKortNr` (seedet på eksisterende rader), så en pad/kort-innhenting kan
legges til senere. **Fabel: skal felt-signering kreve tegnet signatur/HMS-kort, eller er
innlogget attest nok?**

**2. Medlemsdeltakeres firma vises ikke (DESIGNSPØRSMÅL).**
Modellen (låst av deg) har `guestCompany` kun på gjest. Gjest viser firma; medlem viser navn
alene (firmaet er ikke snapshottet på deltaker-raden). Mockupen viser «navn + firma» — for
medlemmer mangler datakilden uten en ny kolonne eller et org-oppslag. **Fabel: godta navn-alene
for medlemmer, eller skal medlemsfirma snapshottes (krever schema-tillegg)?**

**3. Server-hard-lås etter avsluttet runde (IKKE designspørsmål — coworks ordre).**
UI viser låsen; `sjekkliste.ts` edit-mutasjon er urørt (kollisjonsvakt). Cowork skriver egen
ordre for server-låsen før prod. **Bygges ikke nå.** Tas med her kun for fullstendighet.

---

## Designavvik utover disse: ingen

Alle andre flater følger designlåsen (runder, låsing = handling, manko FØRST, gjest-mønster,
PDF F7, ingen tilbehør, chip-farger). — redesign-Opus
