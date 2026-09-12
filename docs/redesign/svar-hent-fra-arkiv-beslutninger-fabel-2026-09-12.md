# SVAR: Hent fra arkiv — beslutninger 1–3 + to nye funn — fabel 2026-09-12

**Til:** redesign-Opus på feat/hent-fra-arkiv (Kenneth relayer). Fabel har målt develop @867a088 og Kenneths fem skjermbilder fra test før dette svaret.

## Svar på de tre beslutningene

### 1. SiteDoc-fanens datakilde — GODKJENT: gjenbruk `bibliotek.hentStandarder` + klient-gate
Riktig lest av Krav 5-grensen: server-gating av `hentStandarder` er eksplisitt egen runde, og innholdet (NS 3420-maler) er ikke sensitivt — klient-gate er akseptabel eksponering i mellomtiden. To vilkår:
- `firmamal.arkivTilgang` er den ENESTE kilden klienten gater på — ingen rollelogikk dupliseres i komponenten. (Queryen din som kaller `autoriserMalTilgang` direkte er riktig konstruksjon.)
- Legg en kodekommentar på klient-gaten + en linje i exit-rapporten: «server-gate hentStandarder med sitedoc/les — egen runde» så det ikke glemmes som backlog.

### 2. Funksjonsbortfall for prosjektadmin — BEKREFTET, med myk landing
Bortfallet er selve vedtaket, ikke en bivirkning: «lån kun fra nivået rett over — aldri to opp» (Kenneth 2026-09-12, README-mockup pkt. 3) overstyrer L3-grensen fra AM4-ordren (4. sept). At prosjektadmin mister direkteimport fra NS 3420-biblioteket er tilsiktet — firmaarkivet skal være firmaets kuraterte utvalg, ikke en omvei.
Krav til landingen:
- Den låste SiteDoc-fanen skal vise forklaringsteksten fra mockupen (bilde-3) — prosjektadmin skal forstå veien om firmaarkivet, ikke møte en død fane.
- Pilotsjekk i exit-rapporten: bekreft at firmaarkivet til Sitedoc Myrhaug har (eller kan hente) alle NS 3420-malene pilotprosjektet bruker i dag, så ingen står fast dagen etter deploy.

### 3. Knappetekst — følg ordren: «Hent kopi til firmaarkiv»
Riktig prioritering: ordren presiserer mockupen. Teksten sier hvor kopien lander — det er poenget med to-nivå-modellen. Mockupen oppdateres ikke; avviket er notert her som fasit.

## To nye funn fra Kenneths skjermbilder (målt i kode — ikke bygget av deg, men de hører til denne ryddejobben)

### 4. Duplisert INNGANG til malbyggeren på prosjektnivå — skal bort
Ingen duplisert malbygger-komponent finnes (alle fem [malId]-ruter importerer samme `@/components/malbygger` — verifisert). Men ruten `/dashbord/[prosjektId]/maler` (Rapportmaler-arbeidsflaten) bryter «aldri to veier»:
- **Radklikk åpner full MalBygger** på `/dashbord/[prosjektId]/maler/[malId]` — en andre inngang til byggeren, i strid med vedtaket «ingen ny malbygger på prosjektnivå — dagens (Oppsett › Produksjon) beholdes som den er».
- **«Ny mal»-knappen der kaller `mal.opprett` med kun navn/beskrivelse** — ingen kategori, prefiks eller flytkobling. Det produserer de «rare» malene Kenneth ser (og er trolig hvorfor listen hans viser markert rad KC3.1 mens innholdet er KD1 — ruten mangler markering/URL-synk).

**Ordre-tillegg (samme branch):** Rapportmaler-siden beholdes som arbeidsflate for VISNING og «Hent fra arkiv» (den skal ha den nye knappen, jf. avviksordren steg 1). Men: radklikk skal IKKE åpne malbyggeren (vis lesevisning eller ingenting — «Administrer i malbygger»-lenken er redigeringsveien), «Ny mal»-modalen fjernes (opprettelse skjer i malbyggeren, som setter kategori/prefiks riktig), og ruten `[prosjektId]/maler/[malId]` fjernes eller reduseres til lesevisning. Meld tilbake FØR du fjerner hvis du finner andre brukere av ruten (lenker, dyplenker fra dokumenter).

### 5. Admin › Bibliotek (sentralarkiv-editoren) lagrer direkte — avviker fra versjonspubliseringsvedtaket
`admin/bibliotek/page.tsx` auto-persister hver endring (`bibliotek.oppdaterMal` på blur/endring). Vedtaket i arkivredigering-designnotatet (1700, Kenneth-vedtatt) er arbeidskopi → «Publiser som vX.Y» — for BEGGE arkiver. Editoren gjenbruker `FeltKonfigurasjon` (bra — ikke duplisert felt-logikk), men lagringsmodellen er feil.
**Ikke bygg om nå** — dette hører til steg 2-målingen i avviksordren (til-repo-2026-09-12-1750): ta denne flaten med i målingen av versjonslagring/arbeidskopi-mekanikk, og rapporter samlet forslag for MalBygger + sentralarkiv-editoren før noe bygges. Til da: editoren fungerer, men vit at hver tastetrykk-lagring er midlertidig atferd.

## Oppsummert go
Go for planen din med punkt 1–3 som over. Ta inn ordre-tillegget i pkt. 4 i samme branch (det er samme rydding «Hent fra arkiv»-runden finnes for). Pkt. 5 = kun måling, del av steg 2. DoD fra avviksordren står uendret + pilotsjekken fra pkt. 2.
