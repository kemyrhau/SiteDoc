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
- PDF-ene er skannet uten tekstlag: kopier PDF-en inn i prosjektet, render sider som bilder (pdf.js-viewer, `kilder/pdf-viewer.html` finnes allerede) og les dem visuelt. Sidekart Del K: PDF-side = normside + 8. Rendring er treg (~45 s/side ved scale 1.6) — ta 4–5 sider per pulje.
- Del K innhold (normside): KA7 s.13 · KB2 Jord s.15 · KB4 Grasdekker s.42–44 (PDF 50–52, bekreftet) · KB5 Blomstereng s.44 · KB6 Trær/busker/stauder s.45 · KC3 s.? · KD1 s.? — slå opp i innholdsfortegnelsen (PDF-side 3–4) for eksakte sider før hver mal.

## Fast ordre-oppskrift (per mal)
Hver ordre inneholder, i denne rekkefølgen:
1. Header: metodereferanse (MAL-METODE), fil (`seed-bibliotek.ts`, kun malens blokk), `referanse`-nøkkel RØRES IKKE (idempotent upsert).
2. **Normfakta** — alt mal-Opus trenger: poster, tabellverdier, toleranser, hjemler (b/c/d/e-numre), normsidetall. Aldri påstå krav normen ikke stiller; prosjektspesifikke krav → pek til beskrivelsen.
3. **Feil som rettes** i dagens seed (målt mot normen).
4. **Full feltliste** med navn, felttype, alternativer, config og hjelpetekst per felt — under tre H-overskrifter: «Kontroll FØR utførelse» / «Kontroll UNDER utførelse» / «Kontroll ETTER utførelse».
5. **MK C-absorbering**: hva hver av malens rader i konverteringslista blir; radene strykes ved gate.
6. Rammer (arves): hjelpefunksjoner (`valg`/`trafikklys`/`desimal`/`felt`), aldri hardkodet JSON, `verifisert: false`, prod-gate urørt, ingen intern sjargong i kundetekst, i18n på nye synlige strenger.
7. Definition of Done: seed kjørt lokalt + idempotent re-kjøring, skjermbilde-bevis (MalBygger alle felter/faser + mobil utfyllingsvisning), avviksmelding.

## Designregler for feltene (destillat av MAL-METODE §1 — sjekk hver ordre mot disse)
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
Nybygg skjer ETTER at revisjonskøen under er ferdig, hvis ikke Kenneth prioriterer annerledes.

## Statustabell (fabel oppdaterer ved hver gate)

| # | Mal | Ordre | Bygget | Gatet | Notat |
|---|-----|-------|--------|-------|-------|
| 1 | KA7 | ordre-ka7-revisjon-fabel-2026-09-11.md **(v2, i 1510-zipen)** | – | – | v2 absorberer MK C :166–:168; 1445-zipen forkastet |
| 2 | KB2 | ordre-kb2-revisjon-fabel-2026-09-11.md (1830-zipen) | – | – | Retter lagtykkelser (Tabell K4) og planhet (Tabell K3, ikke ±30 mm) |
| 3 | KB4 – Grasdekker | ordre-kb4-revisjon-fabel-2026-09-12.md (1100-zipen) | – | – | Absorberer MK C :237/:240/:241/:244; fjerner fallkrav (KB2-krav), retter metodesett (Matrise KB4:2), legger til Formål + overtakelseskrav c4/c5 |
| 4 | KB6 | – | – | – | |
| 5 | KC3.1 | – | – | – | |
| 6 | KD1 | – | – | – | |
| 7 | FB2 | – | – | – | Del F: kopier `NS 3420 Del F` fra kilder/ og finn nytt sidekart |
| 8 | FC1 | – | – | – | |
| 9 | FD2 | – | – | – | |
| 10 | FE1 | – | – | – | Cowork-funn: :516/:529 metodekrav («maks 30 cm») i rene trafikklys — vurder feltform |
| 11 | FB4 | – | – | – | |
| 12 | FD3 | – | – | – | |

## Vedtakslogg (kort)
- 2026-09-11: KA7-format vedtatt som mønster (9 felter/3 faser, ETTER = konklusjon). Kenneth bekreftet kollapset åpning er ønsket presentasjon.
- 2026-09-11: mal-Opus opprettet som byggeansvarlig; fabel gater innhold, cowork gater teknisk + merge (MAL-METODE §3).
- 2026-09-11: MK C-absorberingsregel (MAL-METODE §4).
