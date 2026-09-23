---
tittel: NS-standard-logg for sjekklistemaler
status: STYRENDE
sist_verifisert_mot_kode: 2026-09-13
gjelder: alle maler i packages/db/prisma/seed-bibliotek.ts
eier: mal-Opus (vedlikeholdsplikt — se MAL-METODE § 7)
---

# NS-standard-logg for sjekklistemaler

**Formål:** holde oversikt over hvert sjekkliste-felt som viser til en **ekstern
NS-standard** (NS 4400, NS 2890, NS 8141, NS 4417, …) i feltnavn, hjelpetekst eller
valgopsjoner. Poenget er å se hvor en arbeider blir **henvist til en standard han
sjelden har foran seg** i stedet for å få en **konkret, målbar størrelse han kan
kontrollere i felt** (MAL-METODE § 1: informativ om kravet der arbeideren står).

**Avgrensning:** loggen dekker **eksterne** standarder. **NS 3420-K selv** er IKKE med
— den er selve sjekklistegrunnlaget, og postreferansene («KB4 c4», «KB2.2 c1») er
interne, ikke oppslag i en fremmed standard.

**🔴 Vedlikehold er mal-Opus' plikt (MAL-METODE § 7):** hver gang en mal bygges eller
revideres og en ekstern NS-referanse **legges til, endres eller fjernes**, oppdateres
denne loggen i **samme branch/commit** som mal-endringen. Høy viktighet.

**Hvordan NS-krav uttrykkes — se MAL-METODE § 7a (STYRENDE):** referer med utgave/år,
gjengi aldri ordlyden (opphavsrett + drift); sjekklistene holdes rene for lovtekst og
ansvarsfraskrivelser; ansvaret for å verifisere mot gjeldende standard legges på kunden
ÉN gang sentralt. **Denne loggen er datagrunnlaget for den framtidige kundeoversikten**
(«last ned avvik i sjekklister») — kundevisningen bygges når UI er klart, ikke nå.

## Kolonne «Målbar verdi i teksten?»

- **❌ Nei** = feltet punkter arbeideren til standarden/beskrivelsen uten en verdi han
  kan måle/kontrollere. **Kandidat for fabel** til å gjengi de konkrete kriteriene så
  arbeideren slipper å slå opp i en standard han ikke har.
- **✅ Ja / Delvis** = feltet gir en konkret verdi (mm/s, pH, mm, %) selv om det også
  nevner en standard. Utenfor problemet.

## Kategori 1 — eksterne NS-standarder (sist målt 2026-09-19)

Felt som viser til en fremmed NS-standard i navn, hjelpetekst eller valgopsjoner.

> **§7b-retting 2026-09-19 (design-rollen, gatet av Kenneth):** KB2 (NS 2890) og KB6 (NS 4400) er
> fjernet fra hjelpetekstene — malene fremstår nå med SiteDocs egne krav, uten eksterne NS-referanser.
> Radene er derfor strøket herfra. KC3.1s konklusjon mistet samtidig «(egen post, ZK2.7112)» → «(egen
> oppgave)», så feltet bærer ingen NS 3420-ZK-referanse lenger; raden er strøket. **Flagget til design:**
> ordren nevnte bare KB2/KB6 — KC3.1-raden er tatt ut fordi §6-endringen fjernet ZK-referansen den beskrev.

| Mal | Rad | Felt | Standard | Målbar verdi i teksten? |
|---|---|---|---|---|
| FC1 – Sprengning/rystelser | 2 | Rystelsesmåler plassert | NS 8141 | ✅ Ja — «typisk 20 mm/s bolig». |
| FC1 – Sprengning/rystelser | 3 | Maks rystelsesnivå (mm/s) | NS 8141 | ✅ Ja — 20 / 35 / 70 mm/s per kategori, målbart tallfelt. |

*(KD1 – Belegg av stein og heller har INGEN ekstern NS-standard i felttekst etter §7b-revisjonen
2026-09-18: hjelpetekstene nevner kun produktmerkingen brukeren ser på pallen — F1, klasse 3 merket
D, FP100 — ikke produktstandardene NS-EN 1338/1339/1341/1342/1344. NS 3420-K:2024 i beskrivelsens
«Faglig grunnlag» teller ikke, jf. § 7 pkt 3. Derfor ingen KD1-rad her.)*

**Åpen kandidat — LØST 2026-09-19 (§7b-retting):** KB6 rad 2 (Plantekvalitet) refererte tidligere
NS 4400 uten målbar verdi. Referansen er nå fjernet fra hjelpetekst og alternativ («Godkjent – iht.
plantelista»); kvalitetskriteriene ligger i plantelista/beskrivelsen (kundens ansvar, jf. § 7a). Ingen
åpne eksterne-standard-kandidater blant K-malene per denne målingen.

## Kategori 2 — felt som forutsetter at kunden angir noe i prosjektbeskrivelsen (sist målt 2026-09-18)

Ikke en mangel — dette er med vilje (MAL-METODE § 1: prosjektspesifikke krav peker til
beskrivelsen, ikke en universell tallverdi malen ikke kan kjenne). Datagrunnlag for
kundeoversikten «hva du må angi selv». Dekker foreløpig de reviderte malene (KA7/KB2/KB4/KB6/KC3.1/KD1);
ureviderte maler (F-serien) er ikke målt for dette ennå.

| Mal | Rad | Felt |
|---|---|---|
| KA7 | 1 | Type materiale |
| KA7 | 2 | Materialstatus |
| KA7 | 5 | Materialer rengjort |
| KA7 | 6 | Materialer sortert |
| KA7 | 7 | Godkjenningskriterier i beskrivelsen oppfylt |
| KA7 | 8 | Dokumentasjonskrav levert |
| KB2 | 1 | Formål / planteformål |
| KB2 | 8 | Fall minst 2 % mot avrenning |
| KB4 | 2 | Metode |
| KB4 | 3 | Frø/ferdigplen kontrollert og dokumentert |
| KB4 | 6 | Vannet etter legging/såing |
| KB4 | 8 | Markdekningsgrad (%) |
| KB6 | 1 | Plantegruppe |
| KB6 | 2 | Plantekvalitet |
| KB6 | 10 | Krav oppfylt og dokumentasjon levert |
| KC3.1 | 1 | Metode |
| KC3.1 | 2 | Materiell kontrollert mot beskrivelsen |
| KC3.1 | 8 | Krav oppfylt og dokumentasjon levert |
| KD1 | 1 | Belegningstype (opsjon «Annet – se beskrivelsen») |
| KD1 | 3 | Settelag (opsjon «Annet – se beskrivelsen») |
| KD1 | 5 | Fall mot avrenning (permeabelt belegg: fallet står i beskrivelsen) |
| KD1 | 7 | Fugebredde (opsjon «iht. beskrivelsen» — tegl, permeabelt, bruddheller, over 150 mm) |

## Reproduserbar sjekk (kjør mot arkivet, ikke fila)

🔴 **Oppdatert 2026-09-19:** innholdet bor nå i **`bibliotek_mal_objekter`** (rad-modellen), ikke i
`mal_innhold` — seeden fryser `mal_innhold` til `[]` (jf. MAL-METODE §6a). En sjekk mot `mal_innhold`
returnerer derfor tomt uansett. `helpText`/`options` ligger under `config` på objekt-radene. Kjør mot
DB-en som bærer arkivet (`sitedoc_test` på server-ny, eller en fullt migrert lokal DB):

```sql
SELECT m.referanse, o.sort_order AS radnr, o.label AS felt,
       coalesce(o.config->>'helpText','') ||
         coalesce(' | opsjoner: ' || (o.config->>'options'),'') AS tekst
FROM bibliotek_maler m
JOIN bibliotek_mal_objekter o ON o.template_id = m.id
WHERE coalesce(o.config->>'helpText','') ~ 'NS ?[0-9]'
   OR coalesce(o.config->>'options','') ~ 'NS ?[0-9]'
ORDER BY m.referanse, o.sort_order;
```

`radnr` = `sort_order` (samme rekkefølge som feltene vises; heading-rader teller med). Treff må
deretter vurderes for hånd mot «Målbar verdi i teksten?»-kolonnen — regex finner NS-referansen, ikke
om det finnes en målbar verdi ved siden av. Regex-en fanger heller ikke bar «ZKxxxx» eller «Tabell K»
/ «Matrise K» — utvid mønsteret ved behov (`§7b-vakten` i `packages/db/prisma/mal-7b.test.ts` dekker
alle disse programmatisk over de eksporterte K-malene).

Kategori 2 (delegerer til prosjektbeskrivelsen):

```sql
SELECT m.referanse, o.sort_order AS radnr, o.label AS felt
FROM bibliotek_maler m
JOIN bibliotek_mal_objekter o ON o.template_id = m.id
WHERE o.config->>'helpText' ~* 'beskrivelse|postgrunnlag|posten i'
ORDER BY m.referanse, o.sort_order;
```
