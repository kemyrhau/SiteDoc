# Funn: impersonering-bugs + visjon for prosjektoppsett

**Dato:** 2026-06-11 · **Avdekket:** test.sitedoc.no (impersonering, første gang) · **Eier:** TIMER (app-kode i `apps/web`)
**Diagnostisert av:** NY-SERVER-sporet (kontroll, kun lesing). Ikke fikset — dokumentert for TIMER.

## Kontekst

Impersonering **fungerer** (banneret «Du imperserer: Kari Firmaadmin» er korrekt, og man ser Kari sin kontekst). Men onboarding-/«kom i gang»-siden henger ikke med under impersonering. To funn.

## BUG-1 — Hilsen viser feil navn under impersonering (uavhengig, bør fikses)

- **Fil:** `apps/web/src/app/dashbord/kom-i-gang/page.tsx:33,68`
- **Symptom:** Mens man imperserer Kari Firmaadmin, viser hilsenen «Hei, **Kenneth Myrhaug**!» (den ekte admin-en), ikke den imperserte brukeren.
- **Årsak:** Hilsenen henter navn fra `useSession()` (NextAuth klient-sesjon), som returnerer den **faktiske** innloggede brukeren. Impersonering er implementert server-side i tRPC-konteksten (`impersonatedUserId`, jf. `apps/api/src/trpc/context.ts:91-101`) — `useSession()` er ikke impersonering-bevisst. Banner/autorisasjon bruker tRPC-konteksten og er derfor riktige; hilsenen spriker.
- **Omfang:** Gjelder all impersonering, ikke bare onboarding. Bør fikses uavhengig av prosjektoppsett-omstruktureringen (hent navn fra en impersonering-bevisst kilde, f.eks. `hentImpersoneringStatus` / tRPC `me`).

## BUG-2 — «Kom i gang med ditt første prosjekt» vises selv med valgt prosjekt (erstattes av redesign)

- **Fil:** `apps/web/src/app/dashbord/kom-i-gang/page.tsx:40-48`
- **Symptom:** Onboarding-siden («ditt første prosjekt» + «Start gratis prøveperiode») rendres selv om brukeren har et eksisterende prosjekt valgt (Markussen Boligfelt B12 / Bygg B12).
- **Årsak:** Redirecten bort fra siden fyrer **kun hvis `erSitedocAdmin`** er sann. Under impersonering av en company_admin er `erSitedocAdmin = false` → ingen redirect → siden rendres. Siden mangler en «har brukeren allerede prosjekt?»-guard, så også en vanlig (ikke-imperser) company_admin med prosjekt kan treffe denne.
- **Merk:** «Opprett testprosjekt» er `trpc.prosjekt.opprettTestprosjekt` (linje 53) — en reell onboarding-funksjon.
- **Anbefaling:** Sannsynligvis erstattet av prosjektoppsett-omstruktureringen under — vurder å folde inn der i stedet for en isolert guard-fiks.

---

## Visjon: omstrukturert prosjektoppsett på firmanivå (Kenneth, 2026-06-11)

Mål: gjøre «opprett nytt prosjekt» smart på **firmanivå**, slik at mye er forhåndsvalgt fra firmaets eget oppsett.

**To moduser:**
1. **Førstegangs-oppsett (steg for steg):** firmaet går gjennom en veiviser for å sette opp sin **firma-mal** for nye prosjekter.
2. **Daglig bruk:** opprett nytt prosjekt fra firma-malen — mye er allerede valgt.

**«Malprosjekt» per firma (redigerbart):** hvert firma har ett malprosjekt som holder standardoppsettet, og som kan redigeres. Malen inneholder:
- Grunnoppsett **dokumentflyt**
- **Moduler** firmaet skal ha
- **Sjekklister, oppgaver** og **HMS/Godkjenning** firmaet bruker

**Ved nytt prosjekt** arves malen (forhåndsvalgt), og dette må fylles inn **hver gang, i riktig rekkefølge:**
1. **Prosjektnavn**
2. **Ny byggeplass**
3. **Tegninger** til prosjektet

> Relatert eksisterende konsept: mal-/template-tankegangen i `MALBYGGER.md` (dokumenttyper/maler) — TIMER bør samkjøre «malprosjekt per firma» med eksisterende malbygger-arkitektur. Onboarding-siden (`kom-i-gang`) og «nytt-prosjekt»-flyten bør redesignes rundt dette.
