# Fabel — UTREDNING: abonnement per modul, utløp og fakturaflate — 2026-08-11

Svar på coworks to meldinger. Dette er utredning med anbefalinger — de tre
punktene merket ⚖ er Kenneth-beslutninger. Ingen ordre skrives før de er tatt.
Interim-fiksen (10-grense kun standalone) går uavhengig, som planlagt.

---

## 1. Grunnmodellen: abonnement per modul, konsekvens per firma

Kenneths ramme aksepteres: abonnement per modul, bygget på `OrganizationModule`.
Additiv utvidelse, ingen ny abonnementstabell i første omgang:

```
OrganizationModule (utvidelse)
  utloperDato    DateTime?   — null = løper uten utløp (dagens kunder)
  plan           enum: 'prove' | 'abonnement'   — default 'prove' for nye
  + eksisterende status/aktivertVed/deaktivertAv-felter
```

- **10-grensen knyttes til `plan = 'prove'`** — aldri til standalone-aksen.
  Dagens implisitte regel i `admin.ts:613,626` («standalone = prøve») er
  nettopp den typen utledning fra data vi avviste i seed-policy-saken; den
  erstattes av det eksplisitte feltet. Interim-fiksen kan stå til dette lander.
- Betalingstilstand (fakturert/betalt/purret) holdes UTENFOR
  `OrganizationModule` — det er fakturaflatens domene (§ 4), ikke modulens.

## 2. Utløpsmekanikken: firma-nivå, tre trinn, aldri per prosjekt

**Per modul vs. per prosjekt (coworks spm. 2):** deaktivering skjer på
**modul × firma**, aldri per prosjekt. Utløper Timer mens HMS løper, stenges
timer-flatene i alle firmaets prosjekter; HMS-dokumentasjonen i de samme
prosjektene er urørt. «Deaktiver hele prosjektet» blir bare sluttresultatet
når ALLE firmaets moduler er utløpt — det er samme regel, ikke en egen
mekanisme. Dette løser Kenneths intensjon uten prosjekt-nivå-tilstand.
For delte prosjekter (flere firma) gjelder tilgangen per firma — byggherrens
abonnement holder ikke entreprenørens flater åpne, og omvendt.

**Trinnene** (coworks ramme godkjennes, med konkretisering):

1. **Varsling 30/14/7 dager før utløp** til firma-admin (e-post + banner i
   appen). Banneret sier dato og hva som stenges.
2. **Eksportvindu etter utløp:** all skriving stengt, lesing + eksport åpen.
   ⚖ Lengde: min anbefaling **60 dager** — en byggeleder midt i en hektisk
   periode rekker det, og det er kort nok til at serverleie-argumentet holder
   (vinduet er en avviklingskostnad, ikke evig subsidie).
3. **Nedfrysing, ikke sletting:** ⚖ min klare anbefaling er kald lagring
   etter vinduet — tilgang stengt helt, data flyttet til arkivlagring.
   Begrunnelse: (a) serverleie-argumentet er et KOSTNADS-argument, og kald
   lagring fjerner ~hele kostnaden; (b) sletting av kundens byggedokumentasjon
   er irreversibel og avtalerettslig den farligste enden; (c) reaktivering
   («slår vi det på igjen») blir et løfte vi faktisk kan holde. Sletting
   tidligst etter en lang, avtaleforankret frist (f.eks. 2 år) med eget varsel
   — og det punktet trenger ikke besluttes nå.

Forutsetning for hele rammen: S2 (objektlager) — kald lagring finnes ikke på
lokal disk. Det gir S2 en produktbegrunnelse i tillegg til driftsbegrunnelsen;
rekkefølgen blir S2 før trinn 3 kan bygges. Trinn 1–2 kan bygges uten.

## 3. Coworks siste tanke: eksport som løpende funksjon — JA, og først

Dette er det viktigste enkeltpunktet i meldingen. **Prosjekt-/firmaeksport
bygges som ordinær funksjon** (kundens data, tilgjengelig når som helst),
ikke som utløpsmekanisme. Da er utløpshåndteringen redusert til
tilgangsstyring + varsling — ingen «redd dataene»-panikk, ingen spesialkode
som bare kjører i en krisesituasjon (og derfor aldri er testet når den
trengs). Eksportvinduet i trinn 2 blir bare «eksportfunksjonen er fortsatt
tilgjengelig». Omfang første versjon: dokumenter som PDF + filer som
zip-arkiv per prosjekt; strukturert dataeksport (CSV/JSON) som fase to.
Tegninger/punktskyer følger som filene de er — ingen konvertering.

## 4. Fakturaflaten: register først, generering senere

Minste nyttige versjon (og ⚖ Kenneth bekrefter at dette holder som start):
side i sitedoc-admin som viser per firma: moduler, plan, aktivert, utløper,
pris (nytt prisfelt per modul × firma, fri verdi), status (aktiv / utløper
snart / i eksportvindu / frosset), og handlingene «forny/endre utløpsdato»
og «reaktiver». Ingen fakturagenerering i v1 — Kenneth fakturerer eksternt,
siden er kontrollpanelet («holde kontroll på hvem som har abonnement»).
Fakturagenerering/regnskapskobling vurderes først når refusjonseksport-sporet
(PowerOffice/Visma) har definert integrasjonsmønsteret — samme mottakere.

## 5. Seed-policy-interaksjonen (coworks spm. 3)

Reaktivering skal IKKE re-seede. Utløp er suspensjon, ikke sletting — dataene
finnes, og seed-hookens «finnes rader?»-guard hopper korrekt over. Presisering
til ordren når den skrives: reaktivering går gjennom samme
`settFirmamodul`-vei, og idempotens-guarden er dokumentert som dekkende for
tilstanden «var aktiv, utløp, reaktivert». Ingen ny kode, men en test.

## ⚖ Kenneth-beslutninger før ordre

1. Eksportvinduets lengde (anbefalt 60 dager).
2. Nedfrysing framfor sletting etter vinduet (anbefalt: nedfrysing; sletting
   kun etter lang avtalefrist, besluttes senere).
3. Fakturaflate v1 = register/kontrollpanel uten fakturagenerering (anbefalt).

Når de tre er tatt, skriver cowork ordre-utkast mot denne utredningen;
rekkefølge: eksportfunksjon → modellutvidelse + varsling → fakturaflate →
(etter S2) nedfrysing.

— fabel (relayet av Kenneth)
