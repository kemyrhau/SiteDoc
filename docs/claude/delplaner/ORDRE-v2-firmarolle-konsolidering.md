# ORDRE v2 — Firmarolle-konsolidering (revidert etter Kenneths kodeverifisering)

Til: redesign-Opus (via Kenneth). Fra: fabel. Dato: 2026-08-10.
Erstatter ORDRE-firmarolle-opprydding.md (2026-08-10-1500).

## Klassifisering: TEKNISK GJELD — ikke produksjonsfeil

Kenneths funn korrigerer diagnosen min: prod-DATAENE er i synk (null rader der
`company_admin` mangler `firma_admin` — Fase 0 er AVLYST, backfillen ville gjort
ingenting). Det som har drevet fra hverandre er KODEN: to lesekilder for
«er firma-admin» brukt om hverandre.

- Gammel kilde `users.role = 'company_admin'`: leses av `dashbord/page.tsx:47`,
  `Toppbar.tsx:142` (gammel nav) og admin-panelets badge.
- Ny kilde `OrganizationMember.firmaRoller ∋ 'firma_admin'`: leses av
  firma-gatingen, FIRMA-sonen og skjemaene.

Bevis: Mathias (`role='user'` + `firma_admin`) er halvveis inne — ser
firmasidene (ny gating) men mangler firma-lenke i gammel nav og opprett-knapp
(gammel gating). Ingen datafeil; ren kodedivergens.

Konsekvens av omklassifiseringen: **ingen hast-deploy.** Kvalitetskravet står
over tempo — hver fase går gjennom normal exit-protokoll og fabel-godkjenning
før «klar for commit/merge».

## Allerede utført (utenfor denne ordren)

`dashbord/page.tsx:47` er tatt ut som punktfiks av Kenneth og gitt til Opus —
det ene stedet i Fase 2 med brukersynlig utslag i dag. Resten av Fase 2 skal
IKKE bygge videre på punktfiksen uten å verifisere at den konvergerer mot samme
delte kilde som ordren definerer.

## Fase 1 — Divergensvakt (uendret, men mål justert)

Diagnostikk som teller uenighet begge veier + logg ved kontekst-bygging.
Formålet er nå å vokte KODE-konvergensen (fange lesebaner som fortsatt spør
gammel kilde), ikke å jakte datadrift. Kjøres før og etter Fase 2 som bevis.

## Fase 2 — Én lesekilde (PRIORITERT)

`firmaRoller[]` blir eneste kilde for firma-admin-gating:
- `Toppbar.tsx:142` (gammel nav) konverteres.
- Admin-panelets badge (`BrukereFane.tsx`) leses fra medlemsrader.
- `firma-kontekst.tsx`: fjern `erCompanyAdmin`.
- Repo-grep for `company_admin` — hver forekomst klassifiseres: konverter,
  behold midlertidig med kommentar, eller slett. Én delt helper for sjekken,
  ikke N inline-varianter (punktfiksen i dashbord/page.tsx inkluderes her).

**DoD:** Mathias-profilen (user + firma_admin) får identisk opplevelse i gammel
og ny nav; divergensvakten viser null kodedivergens.

## Fase 3 — Skrivebaner + avvikling av `company_admin` (IKKE hastes)

Som før: skrivebaner skriver kun `firmaRoller[]`; `users.role` reduseres til
`sitedoc_admin | user`. Krever migrering — planlegges separat med
migreringsgate hos Kenneth, tidligst etter at Fase 2 har ligget stabilt i prod.

— fabel
