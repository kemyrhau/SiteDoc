# Designnotat — utvidet HMS-arbeid (vernerunder, maskin-/utstyrskontroll) (fabel, 2026-07-28)

> Kenneth-funn under mobiltest del 6b fase 2: HMS-flaten dekker meldingstypene (avvik/SJA/RUH), men ikke utvidet HMS-arbeid — vernerunder, kontroll av maskiner og utstyr. Disse er normale oppgaver/sjekklister på lik linje med prosjekt-dokumentene.

## Nå-bilde [MÅLT mot migreringer]
- `report_templates.category` ∈ {oppgave, sjekkliste, hms}; `domain` er separat felt (migrering 20260724140000: meldingstypene ble `category='hms'`, `domain='hms'` BEVART; opprett-modalene filtrerer på category, mobil leser domain).
- Konsekvens: en vernerunde-mal kan ALLEREDE lages som vanlig sjekkliste med `domain='hms'` — normal flyt, normal utfylling, ingen ny mekanisme. **Gapet er kun synlighet:** HMS-flatene (web-tiles + mobil-fanene Avvik/SJA/RUH) viser bare category='hms'-dokumenter; HMS-merkede sjekklister/oppgaver drukner i de generelle listene.

## Designforslag (fabel)
HMS-flaten får to lag, samme side:
1. **Meldinger** — dagens avvik/SJA/RUH (category='hms', «Meld HMS»-inngangen urørt).
2. **HMS-arbeid** — vanlige oppgaver/sjekklister med `domain='hms'` (vernerunder, maskin-/utstyrskontroll, annet utvidet HMS-arbeid). Mobil: egen fjerde fane «HMS-arbeid» (eller seksjon under fanene — avgjøres på skisse); web: egen liste/tile på HMS-siden. Radene lenker til de normale utfyllings-/detaljskjermene.

Prinsipper:
- **Ingen ny dokumentklasse** — HMS-arbeid ER sjekklister/oppgaver; kun domene-merket visning. Delte kilder (samme lister/renderere med domain-filter, jf. fase 1-FilterPanel).
- Maler bygges i vanlig MalBygger med domene-valg (nå-sjekk: finnes domain-velger i MalBygger i dag, eller settes domain kun ved seed/bibliotek?).
- Fase M-koblingen: NS3420-biblioteket + vernerunde-/maskinkontroll-maler er samme bibliotek-mekanikk — malene hører til fase M-produksjonen, visningen hører til denne saken.

## Avgrensning
- Maskin-/utstyrskontroll KAN ha kobling til maskinregisteret (db-maskin) — det er egen sak, ikke denne; første versjon er ren mal-basert sjekkliste.
- Rutes som **del 6b fase 2b** (liten visnings-sak, mobil+web) ELLER inn i fase 3-ordren — cowork sekvenserer. Krever Kenneth-vedtak på: (a) fjerde fane vs seksjon på mobil, (b) skal «Meld HMS»-inngangen også tilby «Start vernerunde» o.l. (opprett fra HMS-arbeid-laget)?

## Kenneth-beslutning trengs
1. Fane eller seksjon på mobil-HMS?
2. Opprett-inngang for HMS-arbeid fra HMS-siden (i tillegg til vanlig sjekkliste-opprett)?
3. Rutes som fase 2b nå eller inn i fase 3?
