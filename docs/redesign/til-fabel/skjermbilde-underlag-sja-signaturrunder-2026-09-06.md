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
SEED_SJA_BRUKER=<din-epost> pnpm --filter @sitedoc/db seed:sja
```

🔴 **`SEED_SJA_BRUKER` er påkrevd** — e-posten til brukeren som skal logge inn og teste «Signer».
Den brukeren må allerede finnes i mål-DB-en (innlogging er OAuth — Google/Entra — så en seedet
demo-bruker kan aldri autentiseres) **og** være aktivt medlem av et firma. Demo-prosjektet festes
til DEN brukerens firma (`primaryOrganizationId`), så det er synlig i firmakontekst. Tydelig
feilmelding hvis brukeren/firmaet mangler eller env-varen ikke er satt.

Forutsetning ellers: DB-en må ha migreringen `20260906000000_sja_signaturrunder` **og** develop-
kolonnene (test.sitedoc.no har begge etter test-deploy). Seeden er **idempotent** — kjør på nytt
så mange ganger du vil; en tidligere ORPHAN demo-prosjekt-rad **repareres** (firma settes), runder
+ deltakere bygges på nytt, prosjekt/mal/brukere gjenbrukes.

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
| Firma | Den innloggende brukerens (`SEED_SJA_BRUKER`) eksisterende `Organization` |
| Prosjekt | «SJA-signaturrunder demo» (`SD-DEMO-SJA-0001`) — festet til firmaet, synlig i firmakontekst |
| Mal | «SJA — Løft med mobilkran» (`category=hms`, `subdomain=sja`) med ett `signature_list`-objekt |
| SJA-dokument | «SJA Løft mobilkran — Akse 4» (bestiller/ansvarlig = den innloggende brukeren) |
| Deltakere (levende liste) | **Deg selv** (admin/ansvarlig), Ola Tømrer, Nina Elektriker, **gjest** Truls Kranfører (Kranutleie Øst AS) |
| **Runde 1 — AVSLUTTET** | alle 4 signert, `antallDeltakere` frosset = 4, HMS-kort på medlemmer, gjest «har ikke» |
| **Runde 2 — ÅPEN** | 1 av 4 signert (Ola). 🔴 **Din egen rad står USIGNERT** → «Signer». Øvrig manko: Nina (signerte forrige runde → amber forrige-rad) + Truls (gjest) |

**Innlogging:** Logg inn som **deg selv** (`SEED_SJA_BRUKER`) via OAuth. Du er både ansvarlig/admin
(ser «Start ny runde», «Legg til deltaker», «Avslutt runde») **og** deltaker med usignert rad i
runde 2 → ser **«Signer»** på din egen rad (gating: innlogget bruker = deltakers userId). Ingen
demo-bruker trenger å logge inn — de fyller bare deltakerlista.

---

## Flater å fange (mot mockupen)

1. **HMS-lista → SJA-fane:** SJA-kortet med chip `1/4` (amber). — *Verifiser: amber til komplett, grønn ved alle-signert.*
2. **SJA åpnet (som deg selv = ansvarlig + deltaker):** objekt-leder «Runde 2 · 1 av 4 signert» →
   - **manko FØRST** i amber boks: **din egen rad m/ «Signer»** + Nina + gjest-rad «signer på ansvarliges enhet».
   - signert under (Ola) med tidspunkt + HMS-kort.
   - «Tidligere runder» amber (Nina fra runde 1) — teller ikke i X.
   - handlinger: «Legg til deltaker», «Avslutt runde».
3. **Signer egen rad:** klikk «Signer» på din rad → raden flytter til signert, teller blir `2/4`. *Verifiser klikk-budsjett: 1 klikk signerer.*
4. **«Legg til deltaker»-modal:** prosjektmedlem-nedtrekk + gjest-skjema, Avbryt til stede.
5. **Avslutt runde → Start ny runde:** låst dokument VISER låsen («Låst — runde N avsluttet …»), «Start ny runde»-modal m/ valgfri årsak + Avbryt.
6. **MalBygger-guard:** dra et andre `signature_list` inn i malen → klartekst-modal «Dokumentet har allerede en signaturliste».
7. **Arkiv-PDF** (Skriv ut / rendrArkiv): hovedtabell = gjeldende runde med **«IKKE SIGNERT»** (du selv + Truls, før du signerer) + **forrige-runde-rad** (Nina, amber) ALLTID med (F7); topplinje «Runde 2 (startet …) · 1 av 4 signert · generert …»; «Med logg»-seksjon = begge runder m/ dato/årsak.
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
