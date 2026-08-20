# Designnotat: attestering — sammenligningsvisninger + ukenorm/overtidsregel (AM ORDRE 2)

**Fabel, 2026-08-20.** Grunnlag: `docs/claude/na-rapport-attestering-2026-08-20.md` (alle fil:linje-referanser derfra). Dette er designet til implementeringsordre — bygging starter først etter Kenneth-aksept.

---

## D1. Ukenorm — bygges som avledet oppslag, aldri lagret verdi

Nå-rapporten §3c: 37,5/40 er emergent av dagsvindu × arbeidsdager. Det designet bevarer:

**`beregnUkenorm(organizationId, ukestart): { norm: number, perDag: dagsnorm[] }`** i `packages/shared` — summerer `dagsnorm(dato)` via t4-oppslaget for ukens arbeidsdager (man–fre; helligdag/halvdag/firma_fri-rader reduserer normen for sin dag). Ingen ny lagring, ingen ny innstilling: sesong, halvdager og helligdager virker automatisk fordi de allerede bor i `ArbeidstidsKalender`.

- **Overgangsuker regnes blandet:** en uke der sommertid starter onsdag får norm = 2 vinterdager + 3 sommerdager. Dette er en konsekvens av modellen, ikke et valg — og den skal stå i UI-et (norm vises per uke, ikke som fast tall).
- Shared-funksjonen tar dagsnorm-oppslaget som **injisert avhengighet** (server: `hentEffektivArbeidstid`; mobil: `hentEffektivArbeidstidLokal`) — samme regnestykke, to datakilder, null duplisert regel.
- 37,5/40 skal aldri forekomme som literal i koden.

## D2. Overtidsregel + attestantvarsel

Regel (Kenneth-vedtak, presisert): overtid kan ikke føres når ukesum ordinære timer < gjeldende ukenorm. Ved ukesum ≥ norm der noe er ført med overtidstillegg, varsles attestant.

- **Håndheving ved føring:** myk sperre — overtidslønnsart kan ikke velges/genereres for en uke under norm; melding viser gjeldende norm og ført sum. (Hard DB-sperre avvises: etterregistrering og korrigeringer må kunne passere — attestanten er kontrollpunktet.)
- **Attestantvarsel:** badge på SeddelKort + banner i detalj når (a) uken har overtidsrader, eller (b) ukesum > norm uten overtidsrader (motsatt feil — for mye ført som ordinært). Varselet viser: norm for uken, sum ordinært, sum overtid. Kun varsel — blokkerer ikke attestering (samme prinsipp som dagens 13-timersvarsel, schema-feltet finnes).
- **Forutsetning — klassifisering flyttes til server først** (nå-rapport §5), med Kenneth-presisering 2026-08-20: **backstoppen skiller beregning fra overstyring.** Serveren kjører shared-klassifiseringen for alle rader uansett føringsvei og lagrer resultatet som *beregnet klassifisering* (varslingsgrunnlag) — men **endrer aldri `lonnsartId` på rader der brukeren har satt den** (nedtrekket `timer/[id]/page.tsx:1637` web, tilsvarende mobil). Lønnsartvalget er en menneskelig handling; uoppfordret automatikk overskriver den ikke (domene-arbeidsflyt.md). Avviker beregnet klassifisering fra valgt lønnsart, er det en del av det attestantvarselet (over) skal vise — ikke noe systemet retter stille. Mobil beholder lokal beregning som offline-forhåndsvisning; server er fasit for varseltallene.

## D3. De to visningene — én flate, to pivoter

Bygges inn i web firma-attestering (`firma/timer/attestering/page.tsx`) som **visningsvelger: Sedler (dagens) · Per prosjekt · Per ansatt**. Ikke ny side — lederen står allerede her, og uke-navigasjonen (:308-338) gjenbrukes.

- **Per prosjekt:** rader = prosjekter, kolonner = ukedager + ukesum, celler = sum timer alle ansatte. Ekspander prosjekt → per ansatt i det prosjektet. Kilde: `hentTilAttesteringFirma`-data re-bøttet klientside (uke-bøtte fra `sedel.dato`), eller `firmaPeriodeRapport` (:41-217) — valget tas i implementering etter scope-fiksen (neste punkt).
- **Per ansatt:** rader = ansatte, kolonner = ukedager + ukesum + **norm-kolonne** (D1) med avviksmarkering; ekspander ansatt → per prosjekt. Dette er flaten attestantvarselet (D2) bor i.
- Celle-klikk åpner dagens sedel-detalj — aggregatvisningene er *oversikt og inngang*, attestering skjer fortsatt på sedel/rad (batch-knappene «Attester gruppe (N)» gjenbrukes per pivot-rad).
- **API-forutsetninger (fra §2, må inn i samme ordre):** (1) `erstattet`-filter i `hentTilAttestering` (:2070 — dobbelttelling er en bug uansett dette designet); (2) multi-status i ett kall (`sent`+`accepted` for å vise komplett uke); (3) scope-avklaring partner vs. eid: visningene skal bruke **samme scope som attestering** (`projectOrganizations`, partner-inkludert) — `firmaPeriodeRapport` kan ikke brukes ukorrigert (:60 eier-scope). Kenneth-spørsmål kun hvis dette viser seg å endre hvem som ser hva.
- Mobil: attesterings-aggregatene bygges web-først (leders flate er web); mobil-lista arver kun varselbadgen (D2) nå. Mobil-paritet tas i paritetsmatrise-sporet.

## D4. Klikk (DoD-tall)

Før: 3 klikk hel sedel / 5+ én rad (§7). Etter-krav: hel sedel ≤ 3 (uendret), én rad ≤ 4 (detalj åpnes fra celle: celle → checkbox → attester valgte + inngang), attester en ansatts hele uke ≤ 3 (pivot-rad-batch). Telles ved designgate mot bygget flate.

## D5. Småsaker som følger med ordren

- **Fallback-konstant:** 3 TS-forekomster → én eksportert shared-konstant (server `arbeidstid.ts:33-35`, mobil `kalenderKatalog.ts:31-33`, web `ny/page.tsx:85-86`); Prisma-literal består (§6). Verdien endres ikke.
- **Web detaljside-hullet (M8):** `timer/[id]/page.tsx:390-393` skal lese t4 (tRPC `organisasjon.hentEffektivArbeidstid`) i stedet for flat dagsnorm — ellers viser detaljsiden feil norm i sommertid mens varselet (D2) regner rett.
- **Innstillings-UX:** Standard arbeidstid-panelet får (a) indikator når aktiv sommertid-periode overstyrer («Sommertid aktiv 02.05–XX.XX via firmakalender», lenke dit), (b) markering når vist verdi er systemfallback og ikke firmaets egen lagrede. i18n-nøklene for ufullstendig sommertid-par finnes; advarselen skal også vises her, ikke bare i kalenderen.

## Rekkefølge i implementeringsordren

1. API-fikser (erstattet-filter, multi-status, scope) + shared: klassifiserings-backstop på server, `beregnUkenorm`, fallback-konstant.
2. D3-visningene web.
3. D2-varsel (krever 1).
4. D5 UX-punktene.
Fabel-designgate etter 2 og etter 3, klikktelling ved siste gate.

**Umålt i dette notatet:** ingenting — alle fakta-påstander er fra nå-rapporten (kodeverifisert 2026-08-20); designvalgene D1–D4 er valg, ikke påstander.
