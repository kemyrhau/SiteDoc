> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.18. Seksjonsnumrene er de samme som før delingen.

### 4.18 Slettede og korrigerte linjer: egen visning (versjon 24)

🟡 **Vedtatt 2026-11-23, ikke bygget, ikke bestilt.** Kenneth 2026-11-23: «B76: ja · B77: nei · B78: ja» (§ 8.26).
Inngangen er variant C. Bilde: `skisser-web-timeforing/v24-slettespor-varianter.png` (kilde `skisser-v24.html`),
tre varianter side om side. ⚠️ Variant A og B i bildet er ikke valgt. Leveransene SL1 og SL2 står i del C.

Kenneth 2026-11-23, om slettede linjer i attesteringskortet (S1): «s1 nei -> det hører ikke til i attesteringen
som da blir griset til. skal være egen visning». Om varer og utlegg i sporet (S2): «s2 ja-skal være egen
visning». Visningen står derfor ikke i attesteringskortet, og varer og utlegg skal med.

#### Del A — målt mot develop @ `cef5df0c` (filene er uendret på `1bb2d5e6`)

`D` = `apps/api/src/routes/timer/dagsseddel.ts`, `KL` = `apps/api/src/services/timer/kortLeser.ts`,
`ST` = `packages/db-timer/prisma/schema.prisma`. Målt av en leseagent; Fabel har lest linjene i SV1, SV3–SV5 og
SV7–SV10 og tillegg, delt reise, linje 2 og synken i SV2. Maskin og utlegg i SV2, SV6 og SV11 er ikke lest på nytt.

| # | Funn | Kode |
|---|---|---|
| SV1 | **Sporet fra R1 skrives to steder.** Når arbeideren sletter en timelinje eller «Slett jobben» på en returnert dag, lagres timer-, maskin- og tilleggsradene i `sheet_rad_historikk` med `hendelse: "slettet"` i `snapshot`, og hele raden følger med. | `D:5546-5561`, `D:4153-4167`, `D:2530-2538` |
| SV2 | **Fem andre sletteveier på returnert dag skriver ikke spor:** fjern én maskin, fjern ett tillegg, fjern ett utlegg, fjern en delt reise, og linje 2 når jobbens tid lagres på nytt. Appens slettinger kommer inn med synken og skriver heller ikke spor. | `D:12004-12028`, `D:6738-6760`, `D:7069-7091`, `D:5117`, `D:5814`, `D:11367-11396` |
| SV3 | **Varer og utlegg slettes uten at innholdet lagres.** «Slett jobben» logger bare id-ene i `activity_log` (`slett_kort`). Én slettet vare logges som `vare.slettet` med bare id-en. Ett slettet utlegg logges ikke. | `D:4169-4180`, `D:7333-7344`, `apps/api/src/routes/vareforbruk.ts:759-800` |
| SV4 | **`rad_type` er tekst uten sjekkregel.** Koden skriver `timer`, `tillegg` og `maskin`. Å skrive `utlegg` og `vare` krever kode, ikke migrering. `hendelse` er ikke en kolonne; den ligger i `snapshot`. Tabellen har indeks på dagsseddel, rad og radtype, og ingen kolonne for firma eller dato. | `ST:656-672` |
| SV5 | **Attestantens sletting har ingen markør.** Når attestanten fjerner en linje i «Rediger sedel», skrives en post uten `hendelse`, lik en retting. En leser må lete etter en levende rad for å se forskjellen. | `D:3803-3826` |
| SV6 | **Arbeiderens egne rettinger på returnert dag skriver ikke spor.** Det gjelder timer, tillegg og utlegg. | `oppdaterTimerRad`, `oppdaterTilleggRad`, `oppdaterUtleggRad` i `D` |
| SV7 | **Ingen leser gir slettede rader.** `lesRevisjoner` har ingen kallere. `hentRettedeFelter` («var 5,00» i attesteringen) og `lastKorrigeringsHendelser` («Korrigert av» hos arbeideren) hopper over postene `slettet` og `gjenaapnet`. En linje attestanten har slettet, finnes ikke lenger, så merket «Korrigert av» har ingen linje å stå på. | `apps/api/src/services/arkiv/logg-lesere.ts:160`, `KL:287`, `KL:520-548` |
| SV8 | **Attesteringslista viser bare sendte og attesterte dager.** En returnert dag som ikke er sendt på nytt, står ikke der, og en dag uten rader kan ikke åpnes i attesteringen. | `D:7366-7370`, `D:7780-7784` |
| SV9 | **Hvem attesterer:** firma-admin og sitedoc-admin ser hele firmaet; andre ser prosjektene der de er prosjektadmin eller har «kan attestere». | `attesteringsOmfang`, `D:310-341` |
| SV10 | **Arbeideren ser «Korrigert av»** på egne linjer andre har rettet, og ser ingen slettinger. | `apps/web/src/components/timer/KorrigertMerke.tsx`, `D:4423-4430` |
| SV11 | **Ingen lagringstid** er satt for historikken. | [gdpr-kartlegging.md](../gdpr-kartlegging.md) § revisjonsspor |

#### Del B — siden

1. **En egen side, «Slettet og korrigert».** Den hører til attesteringen og er bare lesing. Ingenting legges i
   attesteringskortet.
2. **Hvem ser den:** de som kan attestere, med samme omfang og samme navneskjul som attesteringen (SV9).
   Arbeideren ser siden for sine egne dager (B78 ja, punkt 7).
3. **Hva en hendelse viser:** merket Slettet eller Korrigert, linjetypen (timer, reise, maskin, tillegg, vare,
   utlegg), innholdet i linja (før og etter når den er korrigert), kortet (prosjekt, byggeplass,
   underprosjekt), hvem som gjorde det og når, og om dagen var returnert. Hendelsene står gruppert pr. dag og
   ansatt, med dagens status nå.
4. **Hvilke hendelser som er med:**
   - linjer arbeideren slettet på en returnert dag, alle linjetyper (R1 b3 og S2),
   - linjer attestanten slettet,
   - linjer en annen enn eieren har korrigert (de samme som gir merket «Korrigert av», B73).
   - **Ikke med:** endringer på et utkast som aldri er sendt, gjenåpning av attesterte linjer, og
     arbeiderens egne rettinger på en returnert dag (B77 nei). De spores ikke (SV6 står), og den rettede
     linja står i attesteringen med den nye verdien.
5. **Filter:** periode, ansatt, prosjekt og type (slettet, korrigert). Siden åpner på perioden attestanten står i.
6. **Der den åpnes (variant C, B76 ja):**
   - **Attestanten:** lenken «Slettet og korrigert» øverst i Attestering åpner siden på perioden attestanten
     står i. Dagsraden får merket «N slettet» på dager med slettede linjer. Et trykk på merket åpner siden
     filtrert på den dagen og den ansatte. Merket står i raden, ikke i kortet.
   - **En dag med bare korrigerte linjer får ikke merke.** Korrigeringene står alt i kortet («var 5,00», SV7)
     og på siden.
   - **Arbeideren:** lenken «Slettet og korrigert» i Mine timer (B78 ja).
   - ⚠️ Variant A (bare lenken) og variant B (merke som åpner et vindu, uten samleside) i bildet er ikke valgt.
     B alene når ikke en returnert dag som ikke er sendt på nytt (SV8).
7. **Arbeiderens side (B78 ja)** er samme side med bare egne dager: linjer andre har slettet eller korrigert,
   med navn og tidspunkt slik «Korrigert av» viser i dag (SV10), og linjer arbeideren selv slettet på en
   returnert dag. Uten filter på ansatt. Arbeideren ser aldri andres dager.

#### Del C — det som må bygges

| Del | Hva | Måling |
|---|---|---|
| Server 1 | **Sporet tettes:** hver slettevei på en returnert dag skriver en post med `hendelse: "slettet"`, også appens slettinger i synken. Attestantens sletting får samme markør. | SV2, SV5 |
| Server 2 | **Varer og utlegg i sporet** (S2 ja): radtypene `utlegg` og `vare`, med innholdet i linja. Varene ligger i en annen database enn historikken, så rekkefølgen og hva som skjer når det andre steget feiler, beskrives i koderens løsning før kode (som Server 4 og Server 9 i § 4.16). | SV3, SV4 |
| Server 3 | **En ny leser for siden,** med omfanget fra attesteringen. Den leser også returnerte dager og dager uten rader. Arbeideren får bare egne dager. Leseren gir også antall slettede linjer pr. dag til merket. | SV7, SV8, SV9 |
| Web 1 | **Siden «Slettet og korrigert»** med filter, og lenken i Attestering. Hjelpetekst på ?-ikonet bygges sammen med siden. | |
| Web 2 | **Merket «N slettet» på dagsraden** i Attestering. Det åpner siden på dagen og den ansatte. | B76 ja |
| Web 3 | **Lenken «Slettet og korrigert» i Mine timer.** Den åpner siden med arbeiderens egne dager. | B78 ja |
| Mobil | Ingen flate i appen. Appens slettinger får spor på serveren (Server 1). | SV2 |
| Migrering | **Ingen.** Ordren foreslo å samle en migrering for varer og utlegg med migreringen for B73 i D2c. Målingen viser at `rad_type` er tekst uten sjekkregel (SV4), så S2 trenger ikke migrering. Siden leser historikken via dagssedlene i perioden og bruker indeksen som finnes. Blir den treg på store firma, er `hendelse` som egen kolonne med indeks neste steg; den kan fylles fra `snapshot` og kan da gå sammen med migreringen i D2c. | SV4 |

- **Det som alt er slettet, kommer ikke tilbake.** Varer, utlegg og enkeltlinjer slettet før Server 1 og 2 er
  i drift, har ikke innhold i sporet. Siden viser ikke slike hendelser. Timer, maskin og tillegg slettet etter
  R1 (`641bcd41`) er med.
- **Samordning med D2f** (§ 4.16, «Korrigert av» alle steder): D2f lar historikken ta radtypene utlegg og
  vare for retting. Server 2 her bruker samme radtyper for sletting. Den som bygges først, legger dem inn.
- **Regel 10 kjøres uavhengig** for Server 1 og 2: de rører arbeiderens egne skriveveier og synken fra appen.

#### Del D — leveransene SL1 og SL2 (bestillingsklare, ikke bestilt)

To ordrer, SL1 før SL2. Ingen migrering og ingen kode i appen. Hjemmel for begge: Kenneth 2026-11-23 «s1 nei
-> det hører ikke til i attesteringen som da blir griset til. skal være egen visning», «s2 ja-skal være egen
visning» og «B76: ja · B77: nei · B78: ja». Linjenumrene er målt mot develop @ `1bb2d5e6`; koderen måler dem
på nytt. `D` = `apps/api/src/routes/timer/dagsseddel.ts`.

##### SL1 — sporet tettes, og varer og utlegg får innhold i sporet

- **Merke:** funksjonsendring uten ny flate. Bare server. Ingenting blir synlig før SL2.
- **Hva:** Server 1 og Server 2 i tabellen over.
- **Filer:**
  - `D`, sletteveiene som ikke skriver spor i dag (SV2): `fjernDeltReise` (`D:5117`), linje 2 i `lagreJobbTid`
    (`D:5605`, slettingen `D:5814`), `fjernTilleggRad` (`D:6738`), `fjernUtleggRad` (`D:7069`), maskinens
    `fjern` (`D:12004`) og slettingene i `syncBatch` (`D:10230`, `slettedeIder` `D:11367-11396`).
  - `D`, utlegg og varer i «Slett jobben»: `slettKortMedAlt` (`D:4135`, loggen `D:4169-4180`).
  - `D`, attestantens sletting i `utforRedigerSedelRader` (`D:3387`, posten `D:3803-3826`): markøren
    `hendelse: "slettet"` (SV5).
  - `apps/api/src/routes/vareforbruk.ts`, `slett` (`:759-800`).
  - Nye testfiler i `apps/api/src/routes/timer/`. `dagsseddel-slett-returnert.test.ts` (R1) står.
- **Delt logikk:** alle veiene skriver sporet gjennom `byggHistorikkPost` (`D:2509`), ikke hver sin kopi.
  Radtypene `utlegg` og `vare` er de samme som D2f bruker for retting (§ 4.16). Den som bygges først, legger
  dem inn.
- **Bevares:**
  - Slettingen virker som i dag for brukeren.
  - Sporet fra R1 for timelinje og «Slett jobben» (SV1).
  - Postene i `activity_log` (`slett_kort`, `vare.slettet`).
  - Synkens klassifisering av timer-slettinger (`slettet_telefon`) og at samme batch kan sendes to ganger.
- **Avgrensning:**
  - Arbeiderens slettinger spores bare på en returnert dag. Et utkast som aldri er sendt, spores ikke.
  - Arbeiderens egne rettinger spores ikke (B77 nei).
- **Før kode:** varene ligger i en annen database enn historikken. Koderen beskriver rekkefølgen og hva som
  skjer når det andre steget feiler (som Server 4 og Server 9 i § 4.16).
- **Ferdig når disse testene er grønne. De skal feile først:**
  1. Hver slettevei på en returnert dag gir nøyaktig én post med `hendelse: "slettet"` og hele raden i
     `snapshot`. Én test pr. vei: timelinje, «Slett jobben», maskin, tillegg, utlegg, delt reise, linje 2 ved
     ny lagring av jobbens tid, og vare.
  2. En sletting fra appen gjennom `syncBatch` på en returnert dag gir samme post. Samme batch sendt to ganger
     gir fortsatt én post.
  3. Et slettet utlegg og en slettet vare gir post med `rad_type` `utlegg` og `vare` og innholdet i linja, nok
     til å vise linja uten raden.
  4. Attestantens sletting i «Rediger sedel» gir `hendelse: "slettet"`. En retting gir fortsatt post uten
     markøren.
  5. En sletting på et utkast som aldri er sendt, gir ingen post.
  6. `hentRettedeFelter` og `lastKorrigeringsHendelser` gir samme svar som før på en dag som har de nye
     postene (SV7). Attesteringskortet og «Korrigert av» er uendret.
  7. En bruker i et annet firma kan ikke utløse eller lese posten.
- **Regel 10 kjøres uavhengig av Kontrolløren.** SL1 rører arbeiderens egne skriveveier og synken fra appen.
  Test 1–3 kjøres mot ekte database. En mocket test kvitteres «delvis — mock».
- **Verifisering:** tall og regler, altså funksjonstester. Ingen nettleser, og ingenting for Kenneth å se.

##### SL2 — siden «Slettet og korrigert», merket og lenkene

- **Merke:** funksjonsendring med ny flate. Server og web. Bestilles når SL1 er merget.
- **Hva:** Server 3, Web 1, Web 2 og Web 3 i tabellen over. Siden er beskrevet i del B punkt 1–7.
- **Filer:**
  - Ny leser i `apps/api/src/services/timer/`, og én prosedyre i `D`.
  - Ny side under `apps/web/src/app/dashbord/attestering/` (attestanten) og under
    `apps/web/src/app/dashbord/timer/mine/` (arbeideren), med én delt komponent i
    `apps/web/src/components/timer/`.
  - `apps/web/src/app/dashbord/attestering/page.tsx`: lenken ved overskriften (`:415`) og merket i dagsraden.
  - `apps/web/src/app/dashbord/timer/mine/page.tsx`: lenken.
  - `packages/shared/src/i18n/nb.json` og `en.json`, de andre språkene genereres.
  - `docs/claude/hjelpetekster.md`, `web.md` og `api.md`.
- **Delt logikk:**
  - Omfanget er `attesteringsOmfang` (`D:310-341`), ikke en ny kopi. Navneskjulet er attesteringens.
  - «Før → etter» på korrigerte linjer leses fra samme kilde som `hentRettedeFelter` og
    `lastKorrigeringsHendelser` (`apps/api/src/services/timer/kortLeser.ts:287`, `:520-548`).
  - Tallet i merket kommer fra leseren. Klienten teller ikke selv.
- **Bevares:** attesteringskortet er uendret (S1 nei). Dagsraden er lik, bortsett fra merket. «Korrigert av»
  i Mine timer står.
- **Ferdig når disse testene er grønne. De skal feile først:**
  1. Leseren gir en returnert dag som ikke er sendt på nytt, og en dag der alt er slettet (SV8).
  2. En bruker uten attesteringsrett på prosjektet får ikke hendelsene. Prosjektlederen får bare sine
     prosjekter, firma-admin får firmaet, og en bruker i et annet firma får ingenting.
  3. Arbeideren får bare egne dager, også når forespørselen ber om en annens.
  4. Hendelser uten innhold, slettet før SL1, vises ikke.
  5. En dag med tre slettede linjer gir merket «3 slettet». En dag uten slettede linjer og en dag med bare
     korrigerte linjer gir ikke merke.
  6. Attesteringskortet viser ingen slettede linjer.
- **Regel 10:** vanlig gate hos Kontrolløren. Web er rørt, så bygget kjøres kaldt.
- **Verifisering:** reglene med funksjonstester. Utseendet ser Kenneth på test:
  - Arbeideren sletter tre linjer på en returnert dag og sender på nytt. Attestanten åpner Attestering, ser
    «3 slettet» på dagen, trykker og ser de tre linjene.
  - Attestanten sletter en linje på en sendt dag. Arbeideren åpner Mine timer → «Slettet og korrigert» og ser
    linja med hvem og når.
- **Ikke målt:** hvor fort leseren er på et stort firma. Historikken har ingen kolonne for firma eller dato
  (SV4). Koderen måler på testdata og melder tallet. Blir den treg, er `hendelse` som egen kolonne med indeks
  neste steg, og den migreringen kan gå sammen med D2c.
