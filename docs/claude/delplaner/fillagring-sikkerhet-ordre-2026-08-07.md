# Fra fabel → cowork, 2026-08-07 — Fillagring/-serving: sikkerhets-ordre (steg 1) + backlogget driftssak (steg 2)

Kenneth ba fabel undersøke hvordan PDF-er/bilder/filer lagres, om de bør i objektlager med peker, og hvordan de sikres mot tyveri. Funn kodeverifisert mot repoet 07.08.

## Funn (nå-tilstand)

1. **Filer ligger IKKE i databasen — peker-arkitekturen finnes alt.** Ingen `Bytes`-felt i `schema.prisma`; alle fil-modeller lagrer `fileUrl` (`/uploads/<uuid>.<ext>`) + metadata (`fileSize`, `filename`). Binærfiler ligger på lokal disk i `uploads/` på API-serveren (`routes/upload.ts`). Base64 i kompetanse-/maskin-import er transient CSV/XLSX-parsing, ikke blob-lagring. Derivater (DWG→SVG, PDF→PNG, Potree) havner også i `uploads/`.

2. **Sikkerhetshullet er serveringen, ikke lagringen.** `server.ts` registrerer `@fastify/static` på `/uploads/` **uten autentisering eller autorisasjon**. Eneste beskyttelse er ugjettbart uuid-filnavn (security by obscurity). Konsekvens: enhver med en URL henter filen uten innlogging og uten firma-/prosjektsjekk — ingen tenant-isolasjon; URL-er lekker via delte lenker/logger/historikk.

3. **Opplasting er OK sikret:** sesjonssjekk (cookie/Bearer mot `session`-tabellen), rate-limit (30/min/IP), blokkerte kjørbare filtyper, 500 MB-grense, truncation-opprydding. Gap: ingen per-prosjekt-authz på opplasting og kun extension-blokkliste (ingen innholds-sniffing) — små tillegg, tas i samme ordre.

## Ordre S1 — Autorisert filserving (sikkerhetsfiks, prioriter)

**Mål:** ingen fil kan hentes uten gyldig sesjon + prosjekt-/firmatilgang. Uavhengig av objektlager-spørsmålet.

1. **Fjern den åpne `@fastify/static`-registreringen på `/uploads/`** og erstatt med autorisert serving:
   - **`GET /fil/*` proxy-endepunkt:** verifiser sesjon (samme mekanisme som `upload.ts`) → slå opp fil-pekeren mot eiermodellen (tegning/dokument/punktsky/…, som alle bærer prosjektId) → sjekk medlemskap via eksisterende tilgangskontroll (`trpc/tilgangskontroll.ts` — delt kilde, ikke dupliser) → stream fra disk med `Content-Disposition: inline` + `nosniff`.
   - **Kortlevde HMAC-signerte URL-er** (`?exp=&sig=`, 1–5 min, server-secret) for flater med mange requests (Potree-viewer, tegnings-tiles): API utsteder etter authz-sjekk; `/fil/*` godtar gyldig signatur uten ny DB-authz. Samme mønster som presigned URLs → gjenbrukes direkte i steg 2.
2. **Klient-sving:** web + mobil bygger fil-URL-er fra API-svar i dag (`/uploads/...`) — behold pekerformatet i DB, oversett til `/fil/`-URL (evt. signert) i API-responsene, så klientene ikke trenger å kjenne lagringsstedet.
3. **Nå-sjekk først (som alltid):** mål alle konsum-steder av `/uploads/`-URL-er (web, mobil, e-post-lenker?, Potree-metadata som refererer relative stier) — Potree/DWG-derivatene refererer interne stier som må fungere gjennom det nye endepunktet. Flagg hvis noen flate krever langlevde lenker (da er signert-URL-varianten svaret, ikke unntak fra authz).
4. Små tillegg i samme ordre: per-prosjekt-authz på `/upload` (klienten oppgir prosjektId, server sjekker medlemskap) + magic-bytes-sniffing på toppen av extension-blokklista.

**Fasit:** uinnlogget GET på kjent fil-URL → 401 · innlogget bruker uten prosjekttilgang → 403 · medlem → fil · Potree-viewer + tegningsvisning virker uendret · utløpt signert URL → 401.

## Sak S2 (BACKLOG, driftssak — ikke sikkerhet) — Objektlager med peker

Lokal disk er sårbar for diskvekst (500 MB punktskyer), backup og server-flytt/skalering — flytt til objektlager når det passer køen. Peker-modellen finnes alt; byttet er kun storage-driver:
- **Privat bucket** (Cloudflare R2 passer cloudflared-infraen; MinIO hvis data må bo on-prem — Kenneth avgjør datalokasjon), ingen offentlig tilgang, server-side kryptering, versjonering/soft-delete i tråd med papirkurv-ordningen (90 dager).
- Presigned URLs for ned-/opplasting — identisk mønster som S1s signerte URL-er, så S1-arbeidet gjenbrukes.
- `fileUrl` backfilles fra `/uploads/x` til bucket-nøkkel; `/fil/*`-endepunktet er uendret utad.

**Rekkefølgen er poenget: S1 før S2.** Objektlager uten S1 flytter bare hullet (offentlig bucket-URL i stedet for offentlig `/uploads/`).
