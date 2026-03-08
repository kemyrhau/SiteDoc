# API — tRPC-routere og prosedyrer

Alle routere i `apps/api/src/routes/`:

| Router | Prosedyrer |
|--------|-----------|
| `prosjekt` | hentMine, hentAlle (filtrert på medlemskap), hentMedId, opprett (auto-admin, auto-tilknytt firma), oppdater |
| `entreprise` | hentForProsjekt, hentMedId, opprett, oppdater, slett |
| `sjekkliste` | hentForProsjekt (m/statusfilter + buildingId-filter), hentMedId (m/changeLog), opprett, oppdater (metadata + entrepriser, kun draft), oppdaterData (m/automatisk endringslogg), endreStatus, slett (kun draft, blokkeres ved tilknyttede oppgaver) |
| `oppgave` | hentForProsjekt (m/statusfilter), hentForTegning (markører per tegning), hentMedId (m/template.objects+kommentarer), hentForSjekkliste, hentKommentarer, leggTilKommentar, opprett (m/tegningsposisjon, templateId påkrevd), oppdater (m/entrepriser, kun draft), oppdaterData, endreStatus, slett (kun draft) |
| `mal` | hentForProsjekt, hentMedId, opprett, oppdaterMal, slettMal, leggTilObjekt, oppdaterObjekt, oppdaterRekkefølge, sjekkObjektBruk, slettObjekt |
| `bygning` | hentForProsjekt (m/valgfri type-filter), hentMedId, opprett (m/type), oppdater, publiser, slett |
| `tegning` | hentForProsjekt (m/filtre), hentForBygning, hentMedId, opprett, oppdater, lastOppRevisjon, hentRevisjoner, tilknyttBygning, settGeoReferanse, fjernGeoReferanse, slett |
| `arbeidsforlop` | hentForProsjekt, hentForEnterprise, opprett, oppdater, slett, leggTilStegMedlem, fjernStegMedlem |
| `mappe` | hentForProsjekt (m/tilgangsoppføringer), hentDokumenter, opprett, oppdater, slett, hentTilgang, settTilgang |
| `medlem` | hentForProsjekt, hentMineEntrepriser, leggTil (m/invitasjon), fjern, oppdater (navn/e-post/telefon/rolle), oppdaterRolle, sokBrukere |
| `gruppe` | hentMineTillatelser, hentMinTilgang, hentForProsjekt, opprettStandardgrupper, opprett, oppdater, slett, leggTilMedlem (m/invitasjon), fjernMedlem, oppdaterEntrepriser, oppdaterDomener |
| `invitasjon` | hentForProsjekt, validerToken, aksepter, sendPaNytt, trekkTilbake |
| `vaer` | hentVaerdata (Open-Meteo proxy: latitude, longitude, dato → temperatur, værkode, vind) |
| `modul` | hentForProsjekt, aktiver (oppretter maler+objekter automatisk), deaktiver (soft-deactivate) |
| `organisasjon` | hentMin, hentForProsjekt, hentMedId, hentProsjekter, hentBrukere, oppdater, leggTilProsjekt, fjernProsjekt |
| `admin` | erAdmin, hentAlleProsjekter (m/sjekkliste-/oppgavetellere), hentAlleOrganisasjoner, opprettOrganisasjon, oppdaterOrganisasjon, settBrukerOrganisasjon, tilknyttProsjekt, fjernProsjektTilknytning, opprettProsjekt, hentProsjektStatistikk, slettProsjekt, slettUtlopteProsjekter, hentAlleBrukere |

## Auth-nivåer

`publicProcedure` (åpen) og `protectedProcedure` (krever autentisert userId i context). Context bygges i `context.ts` som verifiserer Auth.js-sesjonstokens. De fleste routere bruker `protectedProcedure` med tilleggs-sjekker fra `tilgangskontroll.ts`.

## Gratis-grenser

- Maks 10 sjekklister per prosjekt (sjekkes i `sjekkliste.opprett`)
- Maks 10 oppgaver per prosjekt (sjekkes i `oppgave.opprett`)
- `sitedoc_admin` har bypass

## Prøveperiode

- 30 dager fra `createdAt` for prosjekter uten `organizationProjects`
- `admin.slettUtlopteProsjekter` — sletter prosjekter eldre enn 30 dager uten firma
- Prøveperiode-banner i prosjektoversikt (gul/rød varsling ≤14 dager)
