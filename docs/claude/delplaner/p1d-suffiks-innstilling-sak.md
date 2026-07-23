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

## Besvarte spørsmål (fabel 2026-07-21) — saken er komplett

| # | Spørsmål | Svar |
|---|---|---|
| 1 | **Default PÅ eller AV?** | **Opus foreslår, fabel gater.** Ikke et åpent Kenneth-spørsmål alene — utførende Opus begrunner et forslag ut fra koden, fabel avgjør |
| 2 | **Rekkevidde: alle firma-flater eller kun HMS?** | **Alle firma-flater.** Suffikset er del av det gjennomgående nivåsignal-mønsteret, ikke HMS-spesifikt |
| 3 | **i18n-nøkkel?** | **Ja, ny nøkkel.** Sekvenseres av cowork mot A-3b/generatoren, som alt annet i18n-rørende |

> ⚠️ **Cowork-merknad til svar 2:** «alle firma-flater» gjør dette bredere enn P1-piloten. [p1-nivasignal-vedtak.md](p1-nivasignal-vedtak.md) punkt 5 sier at det gjennomgående mønsteret får **egen plan etter at vedtatt delplan er ferdig**. Suffikset er teknisk uavhengig av chip-mønsteret (det er ren tekst på firma-h1), så det kan bygges før den planen foreligger — men **inventaret over firma-flater må da måles først**, ellers treffer man ikke alle. Nå-rapportens § 5 har listen: prosjekter-liste, ansatte, avdelinger, oppmøtesteder, kompetanse, moduler, kalender, fakturering, innstillinger, integrasjoner, HMS. Verifiseres mot kode når ordren skrives.

## Ufravikelig ved utførelse

- **Prisma-migrering krever Kenneths eksplisitte godkjenning** (CLAUDE.md § Task boundary). Godkjenningen for *saken* er ikke godkjenning for *migreringen* — den innhentes når ordren skrives.
- **To-stegs migrasjonspolicy** gjelder: additiv kolonne med default i steg 1. Ingen kolonne-sletting i samme migrering.
- i18n-nøkkelen krever `generate.ts`-kjøring → tavle-koordinering mot andre økter.

## Prioritet

**Ikke satt.** Egnet som **liten sak rett etter P1-verifisering** — omfanget er én kolonne, én toggle og én tekstlinje, og kodemålingen er allerede gjort. Køes av fabel/Kenneth.

## Kilde-notat

Fabels arbeidskopi i designprosjektet er **slettet og erstattet av en peker hit** (2026-07-21). **Denne fila er kanonisk.** P1-ordrens § 2D-referanse går via pekeren, så ingen spor er brutt.
