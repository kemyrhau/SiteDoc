# API — tRPC-routere og prosedyrer

Alle routere i `apps/api/src/routes/`:

| Router | Prosedyrer |
|--------|-----------|
| `prosjekt` | hentMine, hentAlle (filtrert på medlemskap), hentMedId, opprett (auto-admin, auto-tilknytt firma), opprettTestprosjekt (m/standardgrupper+moduler), oppdater |
| `entreprise` | hentForProsjekt, hentMedId, opprett, oppdater, slett |
| `sjekkliste` | hentForProsjekt (m/statusfilter + buildingId-filter), hentMedId (m/changeLog), opprett, oppdater (metadata + entrepriser, kun draft), oppdaterData (m/automatisk endringslogg), endreStatus, slett (kun draft, blokkeres ved tilknyttede oppgaver) |
| `oppgave` | hentForProsjekt (m/statusfilter), hentForTegning (markører per tegning), hentMedId (m/template.objects+kommentarer), hentForSjekkliste, hentKommentarer, leggTilKommentar, opprett (m/tegningsposisjon, templateId påkrevd), oppdater (m/entrepriser, kun draft), oppdaterData, endreStatus, slett (kun draft) |
| `mal` | hentForProsjekt, hentMedId, opprett, oppdaterMal, slettMal, leggTilObjekt, oppdaterObjekt, oppdaterRekkefølge, sjekkObjektBruk, slettObjekt |
| `bygning` | hentForProsjekt (m/valgfri type-filter), hentMedId, opprett (m/type), oppdater, publiser, slett |
| `tegning` | hentForProsjekt (m/filtre), hentForBygning, hentMedId, opprett, oppdater, lastOppRevisjon, hentRevisjoner, tilknyttBygning, settGeoReferanse, fjernGeoReferanse, slett |
| `dokumentflyt` | hentForProsjekt, opprett, oppdater, slett, leggTilMedlem, fjernMedlem |
| `arbeidsforlop` | _(bakoverkompatibilitet for mobil)_ hentForProsjekt, hentForEnterprise, opprett, oppdater, slett, leggTilStegMedlem, fjernStegMedlem |
| `mappe` | hentForProsjekt (m/tilgangsoppføringer), hentDokumenter, opprett, oppdater, slett, hentTilgang, settTilgang |
| `medlem` | hentForProsjekt, hentMineEntrepriser, leggTil (m/invitasjon), fjern, oppdater (navn/e-post/telefon/rolle), oppdaterRolle, sokBrukere |
| `gruppe` | hentMineTillatelser, hentMinTilgang, hentForProsjekt, opprettStandardgrupper, opprett, oppdater, slett, leggTilMedlem (m/invitasjon), fjernMedlem, oppdaterEntrepriser, oppdaterDomener |
| `invitasjon` | hentForProsjekt, validerToken, aksepter, sendPaNytt, trekkTilbake |
| `vaer` | hentVaerdata (Open-Meteo proxy: latitude, longitude, dato → temperatur, værkode, vind) |
| `modul` | hentForProsjekt, aktiver (oppretter maler+objekter automatisk), deaktiver (soft-deactivate) |
| `organisasjon` | hentMin, hentForProsjekt (firma via OrganizationProject), hentMedId, hentProsjekter, hentBrukere, oppdater (m/organizationId for sitedoc_admin), leggTilProsjekt, fjernProsjekt |
| `mobilAuth` | byttToken (public, OAuth→sesjon), verifiser (m/tokenrotasjon), loggUt (sletter sesjon) |
| `bilde` | hentForProsjekt (alle bilder via sjekklister + oppgaver, m/tilgangsfilter, inkl. parent+tegningsdata), opprettForSjekkliste |
| `admin` | erAdmin, hentAlleProsjekter (m/sjekkliste-/oppgavetellere), hentAlleOrganisasjoner, opprettOrganisasjon, oppdaterOrganisasjon, settBrukerOrganisasjon, tilknyttProsjekt, fjernProsjektTilknytning, opprettProsjekt, hentProsjektStatistikk, slettProsjekt, slettUtlopteProsjekter, hentAlleBrukere |

## Auth-nivåer

`publicProcedure` (åpen) og `protectedProcedure` (krever autentisert userId i context). Context bygges i `context.ts` som verifiserer Auth.js-sesjonstokens. De fleste routere bruker `protectedProcedure` med tilleggs-sjekker fra `tilgangskontroll.ts`.

**Autorisasjonssjekker per router:**
Alle routere som opererer på prosjektdata har `verifiserProsjektmedlem`-sjekk. For prosedyrer som ikke tar `projectId` direkte (f.eks. `mal.hentMedId` med template-ID), slås prosjekt-ID opp fra entiteten først. Spesifikke sjekker:
- `sjekkliste`, `oppgave`: `verifiserDokumentTilgang` (entreprise + domain)
- `invitasjon.sendPaNytt/trekkTilbake`: `verifiserAdmin`
- `prosjekt.oppdater`: `verifiserAdmin`
- `endreStatus`: bruker `ctx.userId` som `senderId` (ikke bruker-input)
- `medlem.sokBrukere`: krever `projectId` + prosjektmedlemskap

## Filopplasting

`/upload`-endepunkt (REST, ikke tRPC) i `apps/api/src/routes/upload.ts`:
- Krever autentisert sesjon (sjekker cookie/Authorization-header)
- Tillatte filtyper: `.pdf`, `.dwg`, `.dxf`, `.ifc`, `.png`, `.jpg`, `.jpeg`
- Maks 100 MB per fil
- UUID-baserte filnavn (forhindrer path traversal)
- Rate limiting: 30 forespørsler/minutt per IP
- Filer serveres med `X-Content-Type-Options: nosniff`

## Rate limiting

Minnebasert rate limiter i `apps/api/src/utils/rateLimiter.ts`. Automatisk opprydding hvert 5. minutt.

| Endepunkt | Grense | Per |
|-----------|--------|-----|
| `/upload` | 30/min | IP |
| `mobilAuth.byttToken` | 10/min | IP |
| `invitasjon.validerToken` | 20/min | IP |
| `invitasjon.aksepter` | 10/min | IP |

## Gratis-grenser

- Maks 10 sjekklister per prosjekt (sjekkes i `sjekkliste.opprett`)
- Maks 10 oppgaver per prosjekt (sjekkes i `oppgave.opprett`)
- `sitedoc_admin` har bypass

## Prøveperiode og testsider

- 30 dager aktiv prøveperiode fra `createdAt` for prosjekter uten `organizationProjects`
- Etter 30 dager: prosjektet deaktiveres (`status: "deactivated"`)
- Etter 90 dager (30 aktiv + 60 grace): prosjektet slettes permanent
- `admin.slettUtlopteProsjekter` — deaktiverer >30 dager, sletter >90 dager uten firma
- Prøveperiode-banner i prosjektoversikt (gul/rød varsling ≤14 dager, rød ved deaktivert)

**Testside-opprettelse (`prosjekt.opprettTestprosjekt`):**
- Én-klikks opprettelse fra `/dashbord/kom-i-gang`
- Prosjektnavn: `"Testside " + brukerens navn`
- Auto-oppsett: standardgrupper + alle moduler (Godkjenning, HMS-avvik, Befaringsrapport) med maler og objekter
- Bruker blir automatisk admin
- Auto-tilknyttes brukerens firma hvis det finnes

**Admin-oversikt:** `/dashbord/admin/testsider` — viser kun prøveprosjekter (uten firma), splittet i aktive/deaktiverte
