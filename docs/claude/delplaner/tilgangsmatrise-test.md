---
name: tilgangsmatrise-test
status: 🟢 BYGGET — omskrevet form levert i spor 2 (`tilgangsmatrise.test.ts`). CI-delen: [spor1-ci-ordre.md](spor1-ci-ordre.md)
eier: fabel (beslutning om form) · cowork (måling + gate) · kode-Opus (bygg)
sist_verifisert_mot_kode: 2026-07-20
---

# Tilgangsmatrise-test — varig håndhevelse av paritetsvedtaket

> Fabel-tillegg til sak 1 § 3 (2026-07-20): tabelldrevet test over tilgangsmatrisen, utvidbar for sak 2/3/1b. **Intensjonen er riktig og beholdes.** Cowork-gaten fant at to premisser ikke holder mot repoet — formen må endres, ikke målet.

## Gate-måling (cowork 2026-07-20)

| Premiss i tillegget | Målt | Konsekvens |
|---|---|---|
| «Testen kjører i CI» | **Ingen CI finnes** — ingen `.github/workflows`, ingen CI-config i repoet | Kan ikke leveres. Egen infrastruktur-sak |
| «Integrasjonstest på API-nivå» | `apps/api` har vitest som devDependency, men **0 testfiler og intet `test`-script**. Ingen DB-fixtures, ingen test-DB-harness | Krever et testfundament som ikke finnes |
| Repoets faktiske testkultur | 8 testfiler, alle i `packages/shared/src/utils/*.test.ts` + 1 i web — **rene enhetstester, ingen database** | Peker mot enhetstest-formen |

**Sak 1 er allerede merget** (`fd573b61` → develop) og deployet test. Tillegget kan derfor ikke være del av den leveransen — det er en oppfølger.

## Omskrevet form (cowork-anbefaling)

**Problemet:** `verifiserDokumentTilgang` blander to ting — **datahenting** (Prisma-oppslag av medlem, faggrupper, grupper, flyt-medlemskap, dokumentparter) og **beslutning** (gitt disse fakta: tillat eller avvis?). Bare det første trenger database.

**Grepet:** trekk ut beslutningen som en ren funksjon:

```
avgjorDokumentTilgang(fakta) → { tillat: boolean; grunn: string }
```
der `fakta` er de allerede-hentede verdiene: brukerrolle, prosjektmedlem-rolle, `erFirmaansvarlig`, faggruppe-IDer, gruppe-IDer (m/ domener), flyt-IDer, og dokumentets `bestillerUserId`/`recipientUserId`/`bestillerFaggruppeId`/`utforerFaggruppeId`/`dokumentflytId`/`domain`/`hmsSynlighet`.

`verifiserDokumentTilgang` beholder Prisma-oppslagene og kaller den rene funksjonen. **Ingen atferdsendring** — kun flytting av grenene.

**Da blir matrisen en ren enhetstest** i repoets eksisterende mønster (`packages/shared/src/utils/tilgangsmatrise.test.ts`): bindingstype (faggruppe / gruppe / person-direkte / ingen) × relevant status × dokument-attributter → forventet tillat/avvis. Ingen database, ingen CI nødvendig for at den skal ha verdi — `pnpm test` kjører den.

**Fabels krav som overlever uendret:**
- Tabelldrevet, én fil, **utvidbar med rader** — sak 2 (bestiller/mottaker-grener), sak 3 (HMS-synlighet), sak1b (rollestyring) legger til rader, ikke nye filer.
- **Obligatoriske rader:** periode-vindu (aktiv/utløpt) og F1-A (privat HMS blokkert tross flyt-medlemskap).
- Varig håndhevelse — browser-testene beholdes kun for visning/UX.

**Det som ikke kan leveres nå:** «kjører i CI». Uten CI er testen en lokal/pre-merge-gate (`pnpm test` før commit-gaten). Verdien er fortsatt høy — den fanger regresjon ved neste endring i tilgangslaget, som er nettopp der vi har brukt mest tid.

## Åpen beslutning til fabel
1. **Godtas den omskrevne formen** (ren funksjon + enhetstest) i stedet for DB-integrasjonstest?
2. **Skal CI reises som egen sak?** Uten den er ingen test automatisk håndhevet — det er en større mangel enn denne ene testen, og treffer alt annet arbeid også.
3. Ekstraksjonen er en refaktor av en sikkerhetskritisk funksjon. Egen branch, egen gate, ingen atferdsendring — verifiseres ved at alle eksisterende D/S-tester gir samme utfall.
