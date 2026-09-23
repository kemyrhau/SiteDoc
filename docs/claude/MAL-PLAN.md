# MAL-PLAN — komplett plan for revisjon og nybygging av sjekklistemaler fra NS 3420

**Referansenavn: MAL-PLAN.** Målsti i repo: `docs/claude/MAL-PLAN.md`. Søsterdokument til `docs/claude/MAL-METODE.md` (MAL-METODE = roller/regler/kvalitetsprinsipper; MAL-PLAN = rekkefølge, status og oppstartsprosedyre). Fabel oppdaterer statustabellen ved hver gate og leverer revidert MAL-PLAN i samme zip.

## Oppstart av ny samtale (fabel etter /clear eller compact)

Kenneth skriver: «les MAL-PLAN» (+ vedlegger dokumentene eller peker til repo). Fabel gjør da, i rekkefølge:
1. Les `FABEL-RAMMEVERK.md`, `REDESIGN-MASTERPLAN.md`, `docs/claude/SAMARBEIDSREGLER.md` (standard oppstart).
2. Les `docs/claude/MAL-METODE.md` og denne (`docs/claude/MAL-PLAN.md`).
3. Finn neste mal i statustabellen under (første rad som ikke er «Gatet»).
4. Les normkapitlet fra PDF i `kilder/ns3420/` (se «Lese normen» under) og dagens mal i `packages/db/prisma/seed-bibliotek.ts`.
5. Skriv selvbærende ordre etter MAL-METODE §3, lever som zip (`til-repo-YYYY-MM-DD-HHMM/` med full målsti i chat).

Ingenting annet trengs — MAL-METODE + MAL-PLAN + normen + seed-fila er hele konteksten.

## Lese normen (praktisk, for fabel)
- PDF-ene ligger i `kilder/ns3420/` i hovedtreet (gitignorert — derfor er ordrene selvbærende).
- PDF-ene er skannet uten tekstlag: kopier PDF-en inn i prosjektet, render sider som bilder (pdf.js-viewer, `kilder/pdf-viewer.html` finnes allerede) og les dem visuelt. Sidekart Del K: PDF-side = normside + 8. Del F: PDF-side = normside + 12 (innhold PDF 3–10). Rendring er treg (~45 s/side ved scale 1.6) — ta 4–5 sider per pulje.
- Del K innhold (normside): KA7 s.13 · KB2 Jord s.15 · KB4 Grasdekker s.42–44 (PDF 50–52, bekreftet) · KB5 Blomstereng s.44 · KB6 Trær/busker/stauder s.45 · KC3 s.? · KD1 s.? — slå opp i innholdsfortegnelsen (PDF-side 3–4) for eksakte sider før hver mal.

## Fast ordre-oppskrift (per mal)
Hver ordre inneholder, i denne rekkefølgen:
1. Header: metodereferanse (MAL-METODE), fil (`seed-bibliotek.ts`, kun malens blokk), `referanse`-nøkkel RØRES IKKE (idempotent upsert).
2. **Normfakta** — alt mal-Opus trenger: poster, tallkrav, toleranser, hvor faktumet står (normside). **Som egen sammenstilling per valg i malen, ikke avskrift av standardens tabeller** (MAL-METODE §7b). Aldri påstå krav normen ikke stiller; prosjektspesifikke krav → pek til beskrivelsen.
3. **Feil som rettes** i dagens seed (målt mot normen).
4. **Full feltliste** med navn, felttype, alternativer, config og hjelpetekst per felt — under tre H-overskrifter: «Kontroll FØR utførelse» / «Kontroll UNDER utførelse» / «Kontroll ETTER utførelse».
5. **MK C-absorbering**: hva hver av malens rader i konverteringslista blir; radene strykes ved gate.
6. Rammer (arves): hjelpefunksjoner (`valg`/`trafikklys`/`desimal`/`felt`), aldri hardkodet JSON, `verifisert: false`, prod-gate urørt, ingen intern sjargong i kundetekst, i18n på nye synlige strenger.
7. Definition of Done: seed kjørt lokalt + idempotent re-kjøring (eller unit-garantien), revisjons-SQL med versjonsøkning og full utskrift (tekstbevis, MAL-METODE §6a), avviksmelding. *Ingen skjermbilder — Kenneth 2026-09-18.*

## Designregler for feltene (destillat av MAL-METODE §1 — sjekk hver ordre mot disse)
- 🔴 **Egne krav, ikke standarden (MAL-METODE §7b, Kenneth 2026-09-18):** navn = kode + egne ord (koden beholdes) · hjelpetekster uten tabell-/punktkoder · én linje «Faglig grunnlag: NS 3420-K:2024, post <kode>» i beskrivelsen · aldri (nesten-)ordrett normtekst.
- Predefinerte svar først: trafikklys og enkeltvalg; tallfelt (decimal m/enhet) der normen har måltall; fritekst er unntaket.
- Hjelpetekst = normkravet der arbeideren står: tall, toleranser, hjemmel (f.eks. «KB2.2 c1: minst 2 % fall») — og «Ta bilde» der foto er beviset.
- Ikke bak inn faste toleranser i config når kravet varierer (jf. planhet Tabell K3) — kravet står i hjelpeteksten, arbeideren fører målt verdi.
- Minst ett felt som sier HVA som er levert (type/formål/materiale) — ellers viser dokumentet bare at «noe» ble gjort.
- ETTER-fasen bærer konklusjonen: krav oppfylt + dokumentasjonskrav levert / ferdig-flate-kontroll.
- 8–10 felter er normalen; sjekklisten skal åpne kollapset per fase (telleren «x av y» gir oversikt ved utfylling over tid).
- list_single-alternativer kan bære kravverdien i etiketten («Grasplen (20 cm)») når det sparer arbeideren for oppslag.

## Nye maler fra NS 3420 (kapitler uten eksisterende mal)
Samme løype som revisjon, med to tillegg:
1. Fabel foreslår først AVGRENSNING (hvilke poster malen dekker, hva den ikke dekker) og får Kenneths OK før ordren skrives — en mal per naturlig arbeidsoperasjon, ikke per normkapittel.
2. Ordren spesifiserer ny `referanse`-nøkkel (kapittelkode, f.eks. «KB5»), navn på formen «KB5 – <normtittel eller arbeidsoperasjon>», og plassering i biblioteks-kategorien sammen med søsknene.
Nybygg skjer ETTER at revisjonskøen under er ferdig, hvis ikke Kenneth prioriterer annerledes. **Kenneth 2026-09-18: KD2 og KM2 foran Del F.**

## Statustabell (fabel oppdaterer ved hver gate)

| # | Mal | Ordre | Bygget | Gatet | Notat |
|---|-----|-------|--------|-------|-------|
| 1 | KA7 | ordre-ka7-revisjon-fabel-2026-09-11.md (v2) | ✓ merget 2026-09-11 (`27dbdaed`) | ✓ | |
| 2 | KB2 | ordre-kb2-revisjon-fabel-2026-09-11.md + v2 | ✓ merget 2026-09-12 (`27bc701a`) | ✓ | Kravsvar mot varierende flate — mønster for fall/planhet |
| 3 | KB4 – Grasdekker | ordre-kb4-revisjon-fabel-2026-09-12.md | ✓ merget 2026-09-12 (`0a4e7ea3`) | ✓ | |
| 4 | KB6 – Planting | (v2) | ✓ merget 2026-09-13 (`c3a92b7a`) | ✓ Kenneth 2026-09-13 | |
| 5 | KC3.1 | port + fix | ✓ merget 2026-09-18 | ✓ | 8 felt etter vedtaket «sjekkliste = utført arbeid» (domene-arbeidsflyt.md, 2026-09-18) |
| 6 | KD1 – Belegg av stein og heller | ordre-kd1-revisjon-fabel-2026-09-18.md (+ TILLEGG) | ✓ merget 2026-09-18 | ✓ | 10 felt, asfalt ut (egen mal fra Del J senere) |
| 7 | KD2 – Setting av kantstein (NY) | ordre-kd2-ny-mal-design-2026-09-18.md | ✓ merget | ✓ | Første mal med generell SQL-generator |
| 8 | KM2 – Mur av stein i terreng (NY) | ordre-km2-ny-mal-design-2026-09-18.md | ✓ merget | ✓ | Beskrivelsesstyrt (ingen normtall). Nytt kapittel KM. Gabioner ute |
| 9 | FD1 – Graving av byggegrop (omkodet fra FB2) | ordre-fd1-omkoding-design-2026-09-19.md | ✓ merget 2026-09-19 (`5ac878ff`) | ✓ | Seed-kodene i Del F fulgte ikke normen (verken 2008 eller 2024). Kapitler rettet: FB Markrydding, FD Uttak av løsmasser. Generator: standard per mal + `--fra` |
| 10 | FS2 – Utlegging av masser i lag (omkodet fra FD2) | ordre-fs2-omkoding-design-2026-09-19.md | ✓ merget 2026-09-19 | ✓ | Fylling (FS1) + lag (FS2) i én mal. Nytt kapittel FS |
| 11 | FD2 – Graving av grøft (NY) | ordre-fd2-ny-mal-design-2026-09-19.md | ✓ merget 2026-09-20 | ✓ | Koden ble ledig da gamle FD2 ble FS2 |
| 12 | FH1 – Sprengning i dagen (omkodet fra FC1) | ordre-fh1-omkoding-design-2026-09-19.md | ✓ merget 2026-09-20 (runde A) | ✓ | Nytt kapittel FH. Tomt kildekapittel FC slettet |
| 13 | FS3 – Legging og gjenfylling i grøft (omkodet fra FE1) | ordre-fs3-omkoding-design-2026-09-19.md | ✓ merget 2026-09-20 (runde A) | ✓ | FS3, ikke FV3. Fall og trykkprøve flyttet til Del U. Tomt FE slettet. **Del F ferdig omkodet** |
| 14 | UM1 – Legging av VA-ledninger (NY) | ordre-um1-ny-mal-design-2026-09-19.md | ✓ merget 2026-09-20 (runde B) | ✓ | **Tredje standard: NS 3420-U:2019.** Nytt kapittel UM |
| 15 | UU1 – Prøving av VA-ledninger (NY) | ordre-uu1-ny-mal-design-2026-09-19.md | ✓ merget 2026-09-20 (runde B) | ✓ | Egen mal fordi prøving ofte gjøres av andre enn leggerne (Kenneth). Kapittel UU |
| 16 | UP1 – Setting av kum i grunnen (NY) | ordre-up1-ny-mal-design-2026-09-20.md | ✓ merget 2026-09-20 (runde C) | ✓ | Kapittel UP. **VA-kjeden komplett: FD2 → UM1 → UP1 → FS3 → UU1** |
| 17 | FB1 – Markrydding og avtaking av vekstjord (NY) | ordre-fb1-ny-mal-design-2026-09-20.md | ✓ merget 2026-09-20 (runde C) | ✓ | Fyller kapittelet FB, som sto tomt etter omkodingen |
| 18 | FF1 – Avretting (NY) | ordre-ff1-ny-mal-design-2026-09-20.md | ✓ `fe97e498` (runde D) | ✓ klar for merge | Nytt kapittel FF. Malen de andre F-malene peker til |
| 19 | JH2 – Asfaltdekke (NY) | ordre-jh2-ny-mal-design-2026-09-20.md | ✓ `fe97e498` (runde D) | ✓ klar for merge | **Fjerde standard: NS 3420-J:2008.** Første mal som navngir N200 (§7c). Lukker asfalthullet fra KD1 |
| 20 | FB4 – Spunting og avstiving | – | – | – | PARKERT: spunt står ikke i Del F (mangler normdel). Låst i malfasiten 2026-09-20, men **ikke voktet** av §7b (K-filtrert vakt) — ved revisjon: egen vakt eller plass i en F-vakt |
| 21 | FD3 – Grunnforsterkning | – | – | – | PARKERT: hører til NS 3420-G:2019 kap. GB. Samme vaktmangel som FB4 |

**Status 2026-09-20:** 21 maler i fire standarder — K (8), F (8), U (3), J (1). To parkert. Neste kandidater står i
`docs/redesign/status-designsporet-2026-09-20.md`.

**Arbeidsform fra 2026-09-20:** to maler per runde i én branch (samlerunde-tillegget), innholdsgate på lokal
`skriv-mal`-utskrift låst av malfasiten (§8), SQL mot test per runde og alltid når generatoren endres (§8b).

## Vedtakslogg (kort)
- 2026-09-19: Del F-kodene i seed rettes til normen (Kenneth): FB2→FD1, FD2→FS2, FC1→FH1, FE1→FS3, ny FD2 grøft. Samme bibliotekrad (lån beholder id). Tomme feil-kapitler (FC, FE) slettes. FB4 og FD3 parkert.
- 2026-09-19: Etter Del F: Del U rørledning i grøft (Kenneth).
- 2026-09-11: KA7-format vedtatt som mønster (9 felter/3 faser, ETTER = konklusjon). Kenneth bekreftet kollapset åpning er ønsket presentasjon.
- 2026-09-11: mal-Opus opprettet som byggeansvarlig; fabel gater innhold, cowork gater teknisk + merge (MAL-METODE §3).
- 2026-09-11: MK C-absorberingsregel (MAL-METODE §4).
- 2026-09-19: §7b-retting av KA7, KB2, KB4, KB6 og KC3.1 i én samlet runde (ordre-7b-retting-fem-maler-design-2026-09-19.md, Kenneth-gatet). Bare tekst; KC3.1 minimalt.
- 2026-09-18: KD2 Kanter og KM2 Murer i terreng (nye maler) prioriteres foran Del F-revisjonene (Kenneth). Tabellen over oppdatert mot develop samme dag — den hadde stått uendret siden 13.09.
