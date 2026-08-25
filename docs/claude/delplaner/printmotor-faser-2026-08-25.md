---
name: printmotor-faser
description: Faseinndeling av fabels printmotor-design (eksportvalg + lagrede utskriftsmaler). Cowork eier inndelingen; fabel eier designet.
status: FASE 1 BESTILT
sist_verifisert_mot_kode: 2026-08-25
---

# Printmotor — faseinndeling

**Designet:** [designnotat-eksportvalg-fakturagrunnlag-fabel-2026-08-25.md](../../redesign/designnotat-eksportvalg-fakturagrunnlag-fabel-2026-08-25.md) (rev 3)
· mockup i `docs/redesign/eksportvalg-mockup/`.

Notatet er komplett og ufaset — **faseinndeling er coworks ansvar, ikke fabels.**
Fabel designer; cowork setter leveransegrenser. (Cowork formulerte dette som en
mangel hos fabel 2026-08-25; det var feil og er rettet.)

## Rekkefølgen — verdi først, datamodell sist

| Fase | Innhold | Hvorfor her |
|---|---|---|
| **1** | **PDF av rapporten.** Tredje valg i Eksporter-menyen. Samme innhold som dagens Excel, formatert som dokument. Ny mal på `arkiv.rendr`-motoren — `packages/pdf` er dokumentorientert og har ingen tabellrenderer, men HTML→PDF-rørledningen står | Hullet Kenneth pekte på: «det fins enda ingen print av rapporter». Motoren finnes, ingen ny datamodell |
| **2** | **Radvalg.** Type-kolonne (Timer · Maskin · Tillegg · Utlegg) i ett kronologisk ark + avhuking av radtyper i Tilpasset-modalen. Ingen lagring | Gjør eksporten svar på «hva trenger jeg» uten et malsystem |
| **3** | **Lagrede maler.** `EksportOppsett` (firma + personlig via nullable `eierId`, `basertPaId` som bindeledd), «Lagre som», redigering | Modalen fra fase 2 ER redigereren — den får bare lagringsknapper |

**Hvorfor datamodellen kommer sist:** den designes da mot en funksjon som virker,
i stedet for i det abstrakte. Viser fase 2 at radvalget har en annen form enn
antatt, endrer fase 3 seg gratis — før noe er persistert i en tabell.

## Avklart underveis — ikke bygg dette på nytt

- **`skalEksporteres` er FERDIG** (2026-08-25, i develop og main). Filtrerer både
  lønnsarter (`rapport.ts:161`, kode-nivå i eksport-veien) og tillegg (`:74`/`:308`,
  Prisma relasjons-where i `detaljEksport`). Eksport-only: skjermen viser fortsatt
  alt, fordi attestering må se timer som ikke skal eksporteres. Maskinrader på en
  ekskludert timerad får egen linje i stedet for å forurense «Maskin uten timerad»,
  som er et anomali-signal. Fabel foreslo den til fase 2 på utdatert grunnlag.
- **ID-kolonner:** blir i Excel som koblingsnøkkel for en senere
  underprosjekt-dimensjon, men skal ALDRI i PDF-en. Kenneth: «den id raden er bare
  tull — den er kun for verifisering mot databasen».
- **Underprosjekt-dimensjonen** (dokumentflyt, avhenger av proadm-API) og
  **kostnad/enhetspris per rad** (henger sammen med maskin- og varelagerprising) er
  bevisst utsatt. Eksportkoden skal skrives datadrevet så dimensjonen kan legges til
  som én kolonne + ett filter uten ombygging.

## Arkitektur-vakter for fase 3

- **Ikke et tredje mal-begrep.** `ReportTemplate` (schema:920) og
  `OrganizationTemplate` (:993) finnes allerede, med en ufullført migrering mellom
  seg (`migrering-reporttemplate.md`). `EksportOppsett` lagrer VISNINGER, ikke
  dokumentstruktur, og berører ingen av dem. MALBYGGER-sporet er en annen sak.
- **Firma-vakten er `erFirmaAdmin`/`autoriserAdminForFirma`**, som leser
  `OrganizationMember.firmaRoller`. IKKE `User.role === "company_admin"` — den er
  den gamle kilden, og begge lever side om side i serveren midt i en ufullført
  konsolidering (`tilgangskontroll.ts:73` mot `:177`).
