---
name: spor2-matrise-ekstraksjon-ordre
status: 🟢 BYGGET + MERGET — `cf76d81d`. Fase A (test før refaktor) + Fase B (ekstraksjon), matrise 90/90 mot begge sider
eier: cowork (ordre) · fabel (gate før start) · kode-Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-20
---

# Ordre — Spor 2: tilgangsmatrise-test → så ekstraksjon

> Fabel-vedtak 2026-07-20 (gate-svar 1+3). Grunnlag: [tilgangsmatrise-test.md](tilgangsmatrise-test.md). **Rekkefølgen ER poenget: test før refaktor.**

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus, **ledd 3 (koding)** — samme økt som bygde sak 1. **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Branch:** `refactor/tilgang-ren-funksjon` fra develop (etter at sak 1 er merget).

**Fil-disjunkt fra spor 1:** en annen kode-Opus arbeider samtidig i `.github/workflows/`. Rør ikke den mappa.

**Leveranse i to faser — STOPP mellom:**
1. **Fase A — matrise-testen mot DAGENS oppførsel.** Ingen produksjonskode endres. Testen skal være **grønn mot dagens `verifiserDokumentTilgang`** før du rører den. Stopp og lever.
2. **Fase B — ekstraksjonen.** Deretter trekk ut beslutningen som ren funksjon, og kjør **samme matrise** mot den nye. Begge sider må gi identisk utfall.

**Ditt neste svar:** matrise-testen (Fase A) + bevis på at den er grønn mot dagens kode.

## 1. Hvorfor denne rekkefølgen
Testen er **både sikkerhetsnettet for refaktoren og selve leveransen**. Skrives den etter ekstraksjonen, tester den bare at den nye koden er enig med seg selv. Skrevet først, mot dagens oppførsel, beviser den at ekstraksjonen ikke endret noe.

## 2. Fase A — matrisen (mot dagens kode)

Tabelldrevet enhetstest i repoets eksisterende mønster (`packages/shared/src/utils/*.test.ts` — 8 slike finnes, alle rene, uten database).

**Dimensjoner:**
- **Bindingstype:** faggruppe · gruppe · person-direkte · ingen
- **Relevant status** per call-site-kategori
- **Dokument-attributter:** `bestillerUserId` / `recipientUserId` / `bestillerFaggruppeId` / `utforerFaggruppeId` / `dokumentflytId` / `domain` / `hmsSynlighet`
- **Brukerkontekst:** `sitedoc_admin` · prosjektadmin · `erFirmaansvarlig` · vanlig medlem

**Obligatoriske rader (fabel-krav):**
- **Periode-vindu:** aktiv (`periode_slutt = null`) → tillat · utløpt (`periode_slutt` satt) → avvis
- **F1-A:** privat HMS (`domain="hms"` og `hmsSynlighet !== "apen"`) → **avvis tross gyldig flyt-medlemskap**

**Format:** én fil, rader som data — **utvidbart**. Sak 2 (bestiller/mottaker-grener), sak 3 (HMS-synlighet-regel) og sak1b (rollestyring) skal senere legge til **rader**, ikke nye testfiler.

**Fase A-utfordringen:** dagens `verifiserDokumentTilgang` gjør Prisma-oppslag, så den kan ikke kalles direkte i en ren enhetstest. Løs det uten å endre produksjonskode — f.eks. ved at testen speiler beslutningsgrenene mot de samme inndataene, eller ved minimal mocking av oppslagene. **Finner du ingen vei uten å røre produksjonskoden: stopp og flagg** — da må rekkefølgen diskuteres på nytt, ikke omgås.

## 3. Fase B — ekstraksjonen

```
avgjorDokumentTilgang(fakta) → { tillat: boolean; grunn: string }
```

`fakta` = de allerede-hentede verdiene: brukerrolle, prosjektmedlem-rolle, `erFirmaansvarlig`, faggruppe-IDer, gruppe-IDer (m/ domener), flyt-IDer, og dokumentets attributter (§ 2).

`verifiserDokumentTilgang` beholder **alle** Prisma-oppslagene og kaller den rene funksjonen. **Null atferdsendring** — kun flytting av grenene, i uendret rekkefølge (admin → prosjektadmin → firmaansvarlig → bestiller/mottaker → faggruppe → gruppe-domain → HMS-apen → flyt-medlemskap).

**Verifikasjon (fabel-presisert):** samme matrise kjøres mot **begge** sider. Identisk utfall på hver rad. Ikke bare S/D-testene — hele matrisen.

## 4. Ufravikelig
- Grenene beholder **rekkefølge og semantikk**. En refaktor som «rydder» logikken er en atferdsendring i forkledning — stopp og flagg.
- `hentFlytIderForMedlem` / `hentBrukersFlytMedlemskap` forblir eneste medlemskaps-kilde. Null kopier.
- Rør ikke `.github/workflows/` (spor 1).
- Ingen i18n-endring forventet.

## 5. DoD
Fase A grønn mot dagens kode → cowork-gate → Fase B → matrisen grønn mot begge sider → `next build` grønn → push → cowork-review → fabel-gate → dok-sync (`dokumentflyt.md § 3`: beslutningslaget navngis) → «klar for commit».
