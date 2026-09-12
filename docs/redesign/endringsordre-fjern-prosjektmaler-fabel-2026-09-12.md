# ENDRINGSORDRE: [prosjektId]/maler FJERNES (vei b) — fabel 2026-09-12

**Til:** redesign-Opus på feat/hent-fra-arkiv (Kenneth relayer). **Endrer:** pkt. 4 i svar-hent-fra-arkiv-beslutninger-fabel-2026-09-12.md (1835-leveransen) + BACKLOG §2372-lukkingen fra TILLEGG 3.

## Vedtak (Kenneth 2026-09-12, kveld)
Ordren valgte BACKLOG §2372 vei (a) — rendyrke `[prosjektId]/maler` til lese-og-bruk. Kenneth har nå sett flaten på test og vedtar **vei (b): flaten FJERNES**. Begrunnelse:
1. Siden blander sjekkliste/oppgave/HMS i én liste — brudd på tre-liste-prinsippet (L9), og forvirrende («HMS og oppgaver blandet inn i et sjekkliste-malarkiv»).
2. Den gjør ingenting Oppsett › Produksjon ikke gjør bedre — «Administrer i malbygger» er allerede bare en lenke dit.
3. Aktive sjekklister i prosjektet har egen flate (Sjekklister) — visningsbehovet er dekket der.

## Ordre
1. **Fjern ruten** `[prosjektId]/maler` (+ `[malId]`-underruten og layout). Server-redirect til `/dashbord/oppsett/produksjon/sjekklistemaler` for gamle lenker/bokmerker — ikke 404.
2. **Pek dashbord-kortet** (og alle andre innganger) til Oppsett › Produksjon. Kjør grep etter ruten (`/maler`-lenker, `brukIProsjekt`-krysslenken i MalListe som peker til `/dashbord/{id}/maler` — fjern eller repek den) og rapporter alle treff.
3. **«Hent fra arkiv»** lever videre kun på Oppsett › Produksjon-listene (alle tre faner) — allerede bygget der (verifisert på test). Ingen funksjon tapes: gaten er prosjektadmin begge steder.
4. **Rydd død kode:** «Ny mal»-modalen og `mal.opprett`-kallet uten kategori/prefiks forsvinner med flaten (det var kilden til prefiksløse maler). Ubrukte i18n-nøkler for flaten fjernes.
5. **BACKLOG:** §2366/§2372 lukkes med **vei (b)** (ikke (a) som TILLEGG 3 antok) + branch/hash, i samme commit. MalBygger-mistankestrykingen fra TILLEGG 3 står uendret.

## DoD
- Redirect verifisert (gammel URL lander på Oppsett), dashbord-kort peker riktig, grep-rapport over fjernede innganger.
- Build + tester grønne; skjermbilde av Oppsett-listen med «Hent fra arkiv» som eneste malinngang.
- Fabel-gate før «klar for commit».
