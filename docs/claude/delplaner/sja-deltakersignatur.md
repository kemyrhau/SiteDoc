---
name: sja-deltakersignatur
status: 🟡 VEDTATT RETNING (Kenneth 2026-07-21) — ikke bygget. To åpne spørsmål før ordre
eier: Kenneth (domenesannhet) · fabel (design + malbygger-konsekvens) · cowork (måling)
sist_verifisert_mot_kode: 2026-07-21
---

# SJA — deltakerliste som bygges av signaturene

> **Kenneth 2026-07-21:** *«Hvem bygger listen med deltagere? Listen bygger seg selv hver gang en arbeider signerer — denne funksjonen må utbedres.»*
>
> Utløst av gaten: kan SJA gå i standard dokumentflyt? **Ja — men ikke med dagens signaturfelt.**

## Kravet

En SJA gjennomgås av et arbeidslag og signeres. Utføres samme arbeid igjen **tre uker senere med et nytt gruppemedlem**, skal den nye personen kunne signere **samme SJA** — også etter at dokumentet er ferdigbehandlet.

**Deltakerlisten skal bygge seg selv:** hver signatur legger til én person. Ingen fyller ut listen manuelt.

## Dagens tilstand (cowork-målt 2026-07-21)

SJA-malen (`packages/shared/src/types/index.ts:565-573`) har to atskilte felter:

```
persons     "Deltakere"             påkrevd   ← manuelt utfylt liste
signature   "Signatur arbeidsleder" påkrevd   ← ÉN signatur
```

**Signaturfeltet:** `apps/web/src/components/rapportobjekter/SignaturObjekt.tsx` — canvas-tegning lagret som én PNG data-URL i `verdi`.

### Tre hindre

| # | Hinder | Detalj |
|---|---|---|
| 1 | **Én signatur per felt** | `verdi` er én streng. Ingen struktur for flere signaturer |
| 2 | **Ingen tidsstempel** | Signaturen bærer ikke når den ble avgitt. «Tre uker senere» er usynlig |
| 3 | **Signaturfeltet bor i dokumentets data** | Å signere = **redigere dokumentet**. Er SJA-en `closed`, blokkerer statuslåsen (`flytRolle.ts:182`: `closed/approved/cancelled → leser`) |

**Hinder 3 er det avgjørende.** Det er ikke en manglende funksjon — det er at signaturen er modellert som dokumentinnhold. En liste som skal vokse etter lukking kan ikke ligge der.

Deltakerne signerer heller ikke i dag: `persons` er en navneliste, `signature` er arbeidslederens alene.

## Vedtatt retning

**Deltakerlisten er signaturene.** De to feltene kollapser til én mekanisme:

- Én rad per signatur: **person · tidspunkt · signaturbilde**
- Listen er **avledet**, ikke utfylt — den vokser når noen signerer
- Ligger **ved siden av dokumentdataen**, ikke i den → sen signering treffer ikke statuslåsen

### Referansemønster finnes: `PsiSignatur`

`packages/db/prisma/schema.prisma:1677` har allerede nøyaktig denne formen — én rad per person, `signatureData`, og gjeste-felter for QR-signering (`:1719`). Den er bygget for at folk signerer seg inn på **ulike tidspunkt**, som er samme problem.

**Gjenbruk mønsteret, ikke tabellen** — `PsiSignatur` er bundet til PSI-domenet. Cross-package-FK håndteres som svakt String-felt per CLAUDE.md § To-stegs migrations-policy.

## Åpne spørsmål før ordre

1. **Hvem får signere senere?** Et nytt gruppemedlem tre uker etter — men hva avgjør at han hører til? Gruppemedlemskap på signeringstidspunktet, eller eksplisitt invitasjon? **Uten en regel kan hvem som helst signere seg inn på en gammel SJA.**
2. **Endrer en sen signatur SJA-ens status?** Cowork-innstilling: **nei** — signaturen dokumenterer at han har lest den, den gjenåpner ikke saken. Men det bør sies eksplisitt, ellers avgjøres det av en implementasjonsdetalj.

## Konsekvenser å ta med i designet

- **Malbyggeren:** «Deltakere»-feltet på SJA-malen blir overflødig hvis listen avledes. Skal felttypen `persons` fjernes fra SJA-malen, eller beholdes for planlagte deltakere (i motsetning til faktiske)? Det er et reelt skille — hvem *skulle* delta vs. hvem *har* signert.
- **Gjelder dette kun SJA?** Signaturfeltet brukes også i andre maler (`types/index.ts:515`, `:549`, `:622`). Endres felttypen, treffer det dem. Piloten bør være SJA alene.
- **Utskrift:** en SJA med signaturer avgitt over tid må vise dem med dato i print/PDF.

## ✅ SJA hører i HMS-flyten — ikke standard dokumentflyt (Kenneth 2026-07-21)

> **Kenneth:** *«En kranbil utfører løft over en hovedinngang til byggeplass → SJA utføres → dette involverer arbeidere på tvers av forskjellige dokumentflyter → oppgaven må derfor ligge som HMS-flyt, ikke som standard dokumentflyt. Den hører også til i HMS-arbeidet.»*

**Dette omgjør en tidligere cowork-gate.** Cowork svarte først at SJA *kunne* gå i standard dokumentflyt forutsatt at signeringen ble løst. **Den vurderingen var feil akse** — den gatet på signeringsmekanikk, ikke på hvem som deltar.

**Argumentet som avgjør:** en SJA for et kranløft samler folk fra flere faggrupper og flere dokumentflyter samtidig. Standard dokumentflyt er bundet til faggruppe- og flytmedlemskap og kan per definisjon ikke romme en gruppe som går på tvers.

**HMS-flyten er allerede bygget for det** (cowork-målt, `apps/api/src/routes/modul.ts:60`):

```
steg 1:  rolle "bestiller",  null-medlem  → åpen for ALLE prosjektmedlemmer
steg 2:  rolle "utforer",    groupId      → HMS-gruppen
```

Null-medlemmet på steg 1 er nettopp den tverrgående egenskapen et kranløft krever. **Ingen strukturendring trengs for å plassere SJA riktig** — SJA-malen ligger allerede i HMS-domenet (`subdomain: "sja"`).

**Deltakersignatur-kravet står uendret.** Det er uavhengig av hvilken flyt SJA lever i — listen skal bygges av signaturene uansett.

## Relatert

- **Synlighet:** SJA er **åpen** (Kenneth 2026-07-21); RUH og HMS-avvik er private. Se [hms-synlighet-regel.md](hms-synlighet-regel.md) — SJA som åpen HMS-type er nettopp det som gjør tverrgående deltakelse mulig.
- HMS-domenemodell (to akser, arbeidsgiver-ruting): [hms-domenemodell.md](../hms-domenemodell.md).
- Rollematrisen ([dokumentflyt.md](../dokumentflyt.md)) gjelder dokumentet. **Signering er ikke redigering** i denne modellen — det er en egen handling med egen adgangsregel (spørsmål 1).
