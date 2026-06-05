---
name: historikk-2026-06
description: Arkiv av deployete/ferdigstilte PR-er og saker fra juni 2026.
sist_verifisert_mot_kode: 2026-06-05
---

# Historikk — juni 2026

Arkiv av ferdigstilt arbeid. Aktivt arbeid ligger i [STATUS-AKTUELT.md](STATUS-AKTUELT.md).

## § Mobil hentMineMedlemskap-bug (sitedoc_admin + standalone-/prosjekt-uten-firma-brukere) — FIKSET + verifisert i TestFlight build #29 (2026-06-02)

**Symptom (rapportert fra build #27/#28 TestFlight):** Bruker ser tom Hjem-skjerm med evig «Henter prosjekter…»-spinner, ingen prosjekter, ingen firma-velger. Gjelder prosjektadmin/medlemmer som ikke er `OrganizationMember`.

**Rotårsak (avdekket 2026-06-02 via Expo-simulator + iOS Console-diagnose):** Klienten gatet prosjekt-lasting på valgt firma — `enabled: !!valgtFirmaId` i `hjem.tsx` og `ProsjektVelger.tsx`. Bruker uten firma (eller med flere firmaer der ingen var auto-valgt) → query disabled → TanStack `isLoading=true` permanent → evig spinner. Serveren (`prosjekt.hentMine`) var aldri problemet — den returnerer alltid brukerens prosjekter (`members.some.userId`), med firma-filter kun når `organizationId` sendes.

**Fiks (2 deler):**

1. **Server-fallback** (commit `17e0419e`, prod-merge `21555a5c`, prod-deploy 2026-06-02): `hentMineMedlemskap` (`apps/api/src/routes/organisasjon.ts`) utleder firmaer fra `ProjectMember → Project.primaryOrganizationId` når bruker har 0 `OrganizationMember`-rader. Lukker firma-velger for prosjekt-medlemmer uten org-medlemskap. Live i prod.

2. **Klient-fiks** (commit `9e1bbf02`): `enabled: !!valgtFirmaId || (!lasterFirmaer && firmaer.length === 0)` i `hjem.tsx:116` + `ProsjektVelger.tsx:25`. 0-firma-brukere (kun standalone-prosjekt) får nå prosjektene lastet uten firmavalg — serveren returnerer alle prosjektene uten firma-filter. Diagnose-logging fjernet fra `FirmaKontekst.tsx` (commit `d9d90322`).

**Deploy + bygg:**
- Prod-server (web+api): prod-merge `21555a5c`, deployet 2026-06-02 (HTTP 200 `sitedoc.no` + `api.sitedoc.no/health`).
- EAS build #29 (iOS, commit `9e1bbf02`), submittet til TestFlight (submission `362bac68`).

**Verifisert 2026-06-02 (Kenneth, TestFlight build #29):** «Velg prosjekt» viser alle prosjekter brukeren er medlem av. Bekreftet fungerende i release-bygg.

**Bi-funn under sesjonen:**
- «Ukjent bruker»-meldingen ved utlogging kommer fra `mer.tsx` (`bruker?.name ?? "Ukjent bruker"`). Vises kortvarig når `setBruker(null)` rendres før navigasjon til logg-inn. Forventet adferd, ikke bug.
- Sist brukte firma + prosjekt persisteres allerede i SecureStore (`FirmaKontekst.tsx` + `ProsjektKontekst.tsx`) og gjenopprettes ved oppstart — appen åpner sist brukte prosjekt automatisk ved normal gjenåpning. «Velg prosjekt» vises kun etter fersk innlogging (intet lagret valg ennå).
- Re-login etter ny build skyldtes sletting+reinstall (fersk install tømmer Keychain/SecureStore), ikke en build-bug. En vanlig TestFlight-*oppdatering* beholder innloggingen.

**Diagnose-vei-lærdommer:**
- `console.log` fra et Hermes release-/TestFlight-bygg når **ikke** fram til Mac Console.app (kun native os_log-støy vises). Diagnose-logging i release-bygg er en blindvei — bruk dev-build mot Metro, eller les koden.
- Dev-login (`/dev-login`) returnerer 404 mot prod (kun test/lokal). Native Google-OAuth round-tripper ikke i Expo Go/`expo start` (custom URL-scheme ikke registrert) — kun i standalone/dev-client-bygg.

## § OAuth-innlogging: account-linking + orphan-guard + duplikat-opprydding — DEPLOYET TIL PROD 2026-06-05

Tre sammenhengende auth-forbedringer. Rotmekanisme: firma-ansatte logget inn med privat Gmail i stedet for invitert jobb-e-post → tomme orphan-kontoer uten firma/prosjekt som låste e-poster og ga «ser ingenting»-opplevelse. I tillegg kunne inviterte `@firma.no`-kontoer (User-rad uten OAuth-konto) ikke logge inn første gang pga `OAuthAccountNotLinked`.

### 1. Google↔Microsoft account-linking (prod-merge `e12355d9`)
`allowDangerousEmailAccountLinking: true` på begge OAuth-tilbydere i `apps/web/src/auth.ts`. Lar bruker logge inn med enten Google eller Microsoft 365 på samme e-post og lande på samme konto — fjerner `OAuthAccountNotLinked`. **Reverserer H3-audit (2026-05-27)**; trygt fordi begge IdP-er (Google + Microsoft) verifiserer e-post-eierskap, så den klassiske konto-overtakelse-vektoren (useriøs tilbyder) ikke gjelder.

### 2. signIn-guard mot orphan-kontoer (prod-merge `f6522a94`, commit `ef5906bb`)
Blokkerende `signIn`-callback i `auth.ts`: slipper kun gjennom hvis **(a)** eksisterende `canLogin`-User på e-posten (case-insensitiv), **(b)** ventende `ProjectInvitation`, **(c)** allerede koblet OAuth-konto via `accounts` (returnerende bruker — kritisk for e-postendringer), **(d)** `sitedoc_admin` (dekket av a). Ellers `return false` → **ingen User opprettes**, e-posten forblir fri. Feilmelding `auth.feil.AccessDenied`: «Du har ikke tilgang. Bruk e-posten du ble invitert med, eller kontakt administrator.» (14 språk). **Verifisert på test.sitedoc.no:** uinvitert innlogging (`kmy@sitedoc.no`) avvist, `sitedoc_test` users uendret (27), ingen User-rad opprettet → `return false` hindrer opprettelsen, ikke bare sesjonen. **Gjelder kun web-OAuth; mobil (`mobilAuth.byttToken`) er IKKE dekket — eget oppfølgingspunkt.**

### 3. Duplikat-/orphan-opprydding (prod-DB, read-only FK-sjekk før hver DELETE)
- A.Markussen: slettet typo-konto «Mathias Jensen 2» (`mathias.jenssen989@gmail.com`, 0 innlogginger) — medlemskap var duplikat av jobbkontoen `mathias@amarkussen.no`.
- Slettet gmail-orphans `malinbacklund89@gmail.com` og test-orphan `kmy@sitedoc.no`.
- Beholdt (per beslutning): `mathias.jensen989@gmail.com` (personlig login) + `mathias@amarkussen.no` (jobb) som to separate gyldige kontoer.

### 4. Mobil orphan-guard (oppfølger) — DEPLOYET TIL PROD 2026-06-05 (prod-merge `f3a16cef`, commit `91fa7867`)
Tilsvarende guard lagt til i `mobilAuth.byttToken` (`apps/api/src/routes/mobilAuth.ts`): før User-opprettelse sjekkes samme a/b/c/d-regler som web-guarden — (a) eksisterende canLogin-bruker (case-insensitiv), (b) ventende `ProjectInvitation`, (c) allerede koblet konto (slått opp før opprettelse → returnerende bruker), (d) sitedoc_admin (dekket av a). Ellers `TRPCError FORBIDDEN` med samme melding. Mobil-innlogging lager ikke lenger orphan-kontoer. Både web- og mobil-OAuth er nå dekket.
