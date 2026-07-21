---
name: p1d-suffiks-innstilling-sak
status: 🟡 VEDTATT, IKKE PRIORITERT — utskilt fra P1 (Kenneth-vedtak b, 2026-07-21). Krever migrerings-gate
eier: Kenneth (DDL-godkjenning) · fabel (design) · cowork (migrerings-gate)
sist_verifisert_mot_kode: 2026-07-21
---

# P1-D — Suffiks «— hele firmaet» som firmainnstilling

> Utskilt fra [p1-nivasignal-ordre.md § 2D](p1-nivasignal-ordre.md) ved **Kenneth-vedtak 2026-07-21, alternativ (b)**: P1 leverer A–C (rene visningsendringer) uten DDL-risiko; denne innstillingen føres som egen sak med egen migrerings-gate.

## Hva saken er

Firma-h1 skal kunne bære suffikset «— hele firmaet» (f.eks. «HMS — hele firmaet»), **valgfritt per firma**. Formålet er å forsterke nivåsignalet i tekst, ikke bare i farge — for brukere som ikke leser fargekoding.

Fra [p1-nivasignal-vedtak.md](p1-nivasignal-vedtak.md) punkt 4.

## Kodemåling (redesign-Opus ledd 1, 2026-07-21)

**Hvor den hører hjemme:** `OrganizationSetting` — `packages/db/prisma/schema.prisma:224`.

Modellen bærer allerede tre boolean-toggles i nøyaktig samme form: `tillattSelvAttestering`, `tillattRedigerVedAttestering`, `reisetidTellerOvertid`. **Ingen ny struktur trengs.**

**UI-mønsteret finnes ferdig:** `apps/web/src/app/dashbord/firma/innstillinger/page.tsx` leser og skriver via `trpc.organisasjon.hentSetting` / `oppdaterSetting`. Ny toggle blir en seksjon i samme form som `RedigerVedAttesteringSeksjon` (samme fil, ~linje 623–687).

**Arbeidet er dermed:** ny boolean-kolonne (additiv, med default) → felt i `oppdaterSetting`-Zod → toggle-seksjon i UI → lesing i firma-h1.

## Hvorfor den ble skilt ut

Additiv boolean med default er lav risiko i seg selv. Begrunnelsen er ikke risiko, men **verifiserbarhet**: P1 A–C er rene visningsendringer som kan bekreftes med skjermbilder alene. Blandes en skjemaendring inn, må DoD-runden dekke både UI og database samtidig, og en visuell designgate blir da også en migrerings-gate. To gater i én runde gjør begge svakere.

## Åpne spørsmål før ordre skrives

1. **Default PÅ eller AV?** Fabels ordre stilte spørsmålet uten å svare det. PÅ gir signalet til alle uten konfigurasjon; AV er konservativt for eksisterende kunder.
2. **Gjelder suffikset alle firma-flater eller kun HMS?** P1 piloterer HMS-paret; det gjennomgående mønsteret er egen sak.
3. **Er teksten «— hele firmaet» i18n-nøkkel?** Ja, forventet — og den treffer da `generate.ts`, som må sekvenseres mot andre i18n-eiende økter.

## Ufravikelig ved utførelse

- **Prisma-migrering krever Kenneths eksplisitte godkjenning** (CLAUDE.md § Task boundary). Godkjenningen for *saken* er ikke godkjenning for *migreringen* — den innhentes når ordren skrives.
- **To-stegs migrasjonspolicy** gjelder: additiv kolonne med default i steg 1. Ingen kolonne-sletting i samme migrering.
- i18n-nøkkelen krever `generate.ts`-kjøring → tavle-koordinering mot andre økter.

## Prioritet

**Ikke satt.** Køes av fabel/Kenneth etter at P1 A–C er levert og verifisert.
