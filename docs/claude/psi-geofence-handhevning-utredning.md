---
name: psi-geofence-handhevning-utredning
description: Utredning + designforslag for PSI/§15-geofence-håndheving som dynamisk innstilling. Grunnlagsdokument for en kommende, større sesjon om prosjekt- vs firma-innstillinger. IKKE bygget — parkert Kenneth-vedtak 2026-07-15.
status: 🟡 PARKERT — grunnlagsdokument for kommende innstillings-sesjon
sist_verifisert_mot_kode: 2026-07-15
---

# PSI/§15-geofence-håndheving — utredning (parkert)

> **🟡 PARKERT (Kenneth-vedtak 2026-07-15).** Ingenting av dette er bygget. Går inn i en
> egen, større sesjon om prosjekt- vs firma-innstillinger. Dette dokumentet er
> grunnlaget for den sesjonen. Den LIVE per-rad geofence-indikatoren på byggeplasser-
> siden (egen leveranse) er IKKE en del av dette — den viser kun om geofence er satt.

## Fakta (verifisert mot kode 2026-07-15)

**Hvor PSI slås av/på:** PSI er en **prosjektmodul** (`ProjectModule`, unik
`[projectId, moduleSlug="psi"]`, felt `config Json?`). Slås av/på **per prosjekt** via
`/dashbord/oppsett/produksjon/moduler`. PSI *konfigureres* på PSI-oppsett-flaten
`apps/web/src/app/dashbord/oppsett/produksjon/psi/page.tsx` (per prosjekt). Det finnes
**ingen firma-wide PSI-toggle** (PSI er ikke i `OrganizationModule` — kun timer/maskin/
varelager). Byggeplasser arver PSI fra prosjektet.

**(a) INGEN server-geofence-sjekk finnes i dag.** §15-innsjekk-modellen `PsiTilstedevarelse`
(`packages/db/prisma/schema.prisma`, `@@map("psi_tilstedevarelse")`) har `byggeplassId?` og
`kilde String @default("manuell")` (manuell|qr|geofence|hmskort|app) — men **ingen koordinat-
felt og ingen avvik-felt**. Innsjekk-mutasjonen (`apps/api/src/routes/mannskap.ts`, `z.object`
med `projectId/byggeplassId/kilde`) tar **ingen GPS-koordinat**. `kilde="geofence"` er derfor
**kun en etikett** — det utføres ingen avstandssjekk. Mobil §15-innsjekk
(`apps/mobile/src/components/MannskapInnsjekkKort.tsx`) sjekker inn på **manuelt valgt**
byggeplass (`valgtBygningId`) med `kilde:"app"`.

**Den ENE geofencen:** `Byggeplass.latitude/longitude/radiusM` (schema, kommentert «GPS-
identifikasjon av byggeplass i timer (1c-mobil)»). Settes av «Geofence (GPS)»-inngangen på
byggeplasser-siden (`bygning.settGeofence`). Leses i dag **kun av mobil-timer** for auto-
identifikasjon av byggeplass (Haversine, `apps/mobile/src/services/byggeplassKatalog.ts`).
Det finnes **ingen separat PSI-koordinat**.

**Firma-innstillinger** bor i `OrganizationSetting` (per firma, `organizationId @unique`).

## Designforslag (til den kommende sesjonen)

### Datamodell — anbefaling: per FIRMA
Nytt felt `OrganizationSetting.psiGeofenceNivaa String @default("av")` (verdier `av`/`c`/`b`/`a`).
Begrunnelse: §15-etterlevelse er en firma-bred POLICY (samme lov alle byggeplasser); per
byggeplass gir policy-drift + admin-byrde; per prosjekt gir N konfig-steder. Plassering av UI:
PSI-oppsett-flaten, tydelig merket firma-omfang.

### Nivåer
| Nivå | Atferd | Server | Klient |
|---|---|---|---|
| **Av** | ingen GPS-bruk | — | — |
| **C — Forslag** | GPS foreslår nærmeste byggeplass; ingen blokk/avvik | — | haversine → forhåndsvelg |
| **B — Advarsel** *(anbefalt default)* | innsjekk tillates alltid; avvik utenfor geofence logges + synlig i §15-oversikt | valider avstand → `geofenceAvvik=true` + `avstandM` | vis advarsel, la fortsette |
| **A — Blokkering** | innsjekk avvises utenfor geofence (unntak: uten geofence + offline) | avvis (`PRECONDITION_FAILED`) | blokk knapp + feil |

**Default B:** §15-oversikten forblir intakt (ingen utestenging), feil byggeplass/juks blir
synlig, men GPS-slingring utestenger ikke en ærlig arbeider. A som default er for streng;
C for svak; Av mister poenget.

### (b) Server vs klient + juks-grense
**Server-autoritativ:** klienten sender GPS-koordinat, **serveren** beregner avstand mot
`Byggeplass`-geofence (Haversine) og setter avvik/blokk. Klient-only ville vært triviell å
omgå. **Juks-grense (ikke oversell):** serveren kan **ikke hindre GPS-spoofing** (rootet
enhet / mock-location) — den registrerer den *påståtte* koordinaten og **flagger**, men
**hindrer ikke**. A/B beskytter mot ærlige feil + synliggjør åpenbare avvik, ikke mot
determinert svindel.

### (c) Byggeplass uten geofence + offline
- **Byggeplass uten geofence låser ALDRI.** `latitude/longitude/radiusM == null` → hopp over
  håndheving på ALLE nivåer (også A). Innsjekk tillates, ingen avvik. En byggeplass uten satt
  geofence skal aldri kunne blokkere §15-innsjekk.
- **Offline fail-open.** Offline §15-innsjekk MÅ alltid gå gjennom (lov + ingen dekning på
  anlegg). Klient beregner geofence offline (cachet koord + enhets-GPS), lagrer påstått
  resultat, synker senere; server re-validerer ved synk (B: logg avvik; **A: «tillatt med
  avvik-flagg», IKKE retroaktiv blokk** — kan ikke ta tilbake en fysisk innsjekk). Ingen
  geofence-sjekk skal stå mellom arbeideren og en §15-innsjekk pga. nett eller GPS.

### UI-skisse (PSI-oppsett-flate)
```
Geofence-håndheving (§15)                    Gjelder alle firmaets byggeplasser
──────────────────────────────────────────────────────────────────────
◉ Av             Ingen GPS-sjekk. Innsjekk registreres uten posisjon.
○ Forslag (C)    GPS foreslår nærmeste byggeplass. Ingen advarsel eller logg.
○ Advarsel (B)   Innsjekk tillates alltid, men avvik utenfor geofencen
   ⟨ANBEFALT⟩    logges og vises i §15-oversikten.
○ Blokkering (A) Innsjekk utenfor geofencen avvises. Byggeplasser uten
                 geofence og innsjekk uten nett slippes alltid gjennom.
```

### Omfang når (hvis) bygget
- Schema (additivt, to-stegs-policy): `OrganizationSetting.psiGeofenceNivaa` +
  `PsiTilstedevarelse.geofenceAvvik Boolean?` + `avstandM Int?`.
- Server: innsjekk-input + `latitude/longitude`; Haversine mot byggeplass-geofence; nivå fra
  `OrganizationSetting`; skip når geofence null; A avviser online.
- Web: nivåvelger i PSI-oppsett + firma-mutasjon; §15-oversikt viser avvik-flagg + avstand.
- Mobil: send GPS ved innsjekk; C/B/A-atferd; offline fail-open + synk-revalidering.
