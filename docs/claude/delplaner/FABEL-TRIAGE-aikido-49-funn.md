# FABEL-TRIAGE: Aikido-scan, alle 49 funn

Dato: 2026-08-12 · fra fabel · til cowork for backlogg
Grunnlag: fullt funnliste fra Kenneth + verifisering mot faktisk kode i SiteDoc-repoet.

## Hovedkonklusjon

49 funn koker ned til: **2 falske positive avvises, 4 reelle kodefunn fikses, 1 viktig rammeverks-bump, resten er dependency-bumps og header-config som tas i tre pakker.** Ingenting tyder på aktiv sårbarhet i egen kode utover punktene under. Anbefalt rekkefølge: Pakke A før pilot, B ved neste vedlikeholdsvindu, C er opprydding.

---

## Avvises i Aikido (falske positive — verifisert mot kode)

| Funn | Hvorfor |
|---|---|
| **NoSQL injection** (ftd-prosessering.ts, reisetidMatrise.ts +4) | Ingen NoSQL i stacken — Prisma mot Postgres. All rå-SQL er parameterisert: `$executeRaw` tagged template (ftd-prosessering.ts:2749) og `$executeRawUnsafe` med posisjonsparametre `$1/$2` (embedding-service.ts:112). Ingen strengbygging med brukerdata. Avvis med denne begrunnelsen. |
| **uuid «memory corruption/RCE»** | Kjent overdrevet advisory; uuid-biblioteket har ingen slik reell sårbarhet i bruksmønsteret her. Bump ved anledning, avvis som critical-kandidat. |

## PAKKE A — før pilot (reelle funn i egen kode + de viktigste)

1. **Next.js-bump** (critical, 10 t est.) — `next ^14.2.0`, utenfor sikkerhetsstøtte. Kjente kritiske CVE-er i 14-serien, bl.a. middleware-autorisasjonsbypass fikset i 14.2.25. **Tiltak: bump til nyeste 14.2.x nå; Next 15 planlegges etter pilot.** Dekker også «Next.js SSRF» (High) og trolig fast-uri/undici via lock-oppdatering.
2. **Eksponert API-nøkkel** (High) — verifisert: `GeoReferanseEditor.tsx:262` har Norkart/Webatlas `api_key=b8e36d51-…` hardkodet. Maptile-nøkler er synlige i nettleseren uansett, men den skal (a) ut av repo-historikk-flaten og inn i `NEXT_PUBLIC_`-env, (b) domenebegrenses hos Norkart, (c) roteres. 1 t.
3. **dangerouslySetInnerHTML** (Medium hos Aikido, **reelt viktigere**) — verifisert 9 forekomster i 4 filer: dokumentleser og les-siden rendrer `innhold`/`blokk.content` (tekst fra opplastede/oversatte dokumenter), tegninger/byggeplasser rendrer `svgInnhold` (SVG fra DWG-konvertering). Opplastet innhold → DOM uten sanitering er reell stored-XSS-flate. **Tiltak: DOMPurify på alle 9 (SVG-profil for tegningene).** 3 t.
4. **defusedxml i ftd-worker** (critical hos Aikido, reelt medium/DoS) — verifisert: `main.py:95-97` kjører `xml.etree.fromstring` på opplastet NS3459-XML. Entity-expansion-DoS. **Tiltak: `defusedxml.ElementTree`.** 30 min.
5. **starlette + python-multipart** — ftd-worker tar multipart-opplasting; kjente DoS-CVE-er. **Tiltak: pin `fastapi>=0.115` (drar starlette ≥0.40) + nyeste python-multipart.** 30 min.
6. **Web-headers på sitedoc.no** — HSTS (High), anti-clickjacking/X-Frame-Options (Medium), X-Powered-By av (Medium): tre proxy-linjer, 15 min samlet. **CSP (critical hos Aikido) tas som egen oppgave** — streng CSP brekker lett Next-hydrering og må testes; ikke hastetiltak, men skal på backloggen med frist før pilot-slutt.
7. **@fastify/static path traversal** (High) — API-et serverer filer. **Tiltak: bump @fastify/static til patchet versjon; verifiser at uploads-serving bruker sendFile med rot-lås.** 1 t.

## PAKKE B — neste vedlikeholdsvindu (dependency-bumps, transitive)

Én PR: `pnpm update` + `overrides` der transitivt. Omfatter: protobufjs (transitiv via @xenova/transformers — pollution-CVE krever ondsinnede .proto-filer vi ikke parser), next-auth beta-bump + @auth/core, find-my-way (kommer med fastify-bump), tar/tar-fs, brace-expansion, browserslist, undici, expo-file-system (mobile), sharp (bump), fast-xml-parser/-builder, csv-parse, nanoid, jose, ajv, yargs, js-yaml, picomatch, postal-mime, @ungap/structured-clone, onnxruntime-node, @fastify/forwarded, @expo/spawn-async, i18next, zod (pollution-advisory gjelder eksotisk bruk; bump uansett). Estimat samlet: 3-4 t inkl. regresjonskjøring.

**Unntak som krever beslutning: `xlsx` (SheetJS)** — pollution-CVE-en er reell og npm-versjonen får ikke fiks. Repoet har allerede `exceljs`. **Anbefaling: migrer xlsx-bruken til exceljs og fjern xlsx.** Egen backlogg-post.

## PAKKE C — infrastruktur/opprydding

- **Docker kjører som root** (Dockerfile.api, Dockerfile.ml, +1) — verifisert: ingen `USER`-linje i noen av dem. Legg til non-root user + chown av arbeidskatalog. 3 t inkl. test av volummounts.
- **CI: pinn 3rd-party Actions til sha** + `persist-credentials: false` på checkout. 15 min.
- **@fastify/cors defaults** (Low) — verifiser at origin er eksplisitt liste, ikke `true`. 15 min.
- **SSRF-hintene i page.tsx** (Low) — fetch med delvis dynamisk URL; gjennomgås i pakke B-PR-en, trolig interne kall.

## Forslag til backlogg-poster (7)

1. A1 Next 14.2.x-bump (før pilot)
2. A2-A5 Kodefunn-fiks: nøkkel-rotasjon, DOMPurify, defusedxml, fastapi-pin (før pilot, én PR mulig)
3. A6 Proxy-headers HSTS/XFO/X-Powered-By (før pilot)
4. CSP-innføring (egen, testkrevende)
5. B Dependency-bump-PR (vedlikeholdsvindu)
6. B-unntak: xlsx → exceljs-migrering
7. C Docker non-root + CI-pinning

— fabel
