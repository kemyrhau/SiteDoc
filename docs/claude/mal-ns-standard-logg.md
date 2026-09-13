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

## Kategori 1 — eksterne NS-standarder (sist målt 2026-09-13)

Felt som viser til en fremmed NS-standard i navn, hjelpetekst eller valgopsjoner.

| Mal | Rad | Felt | Standard | Målbar verdi i teksten? |
|---|---|---|---|---|
| KB2 – Vekstjord på terreng | 3 | Varedeklarasjon kontrollert | NS 2890 | ✅ Delvis — gir pH 5,5–7,0, uten rotugras. NS 2890 gjelder deklarasjonens format. |
| KB6 – Planting | 2 | Plantekvalitet | **NS 4400** | ❌ **Nei** — «tilfredsstille NS 4400 … kontroller mot beskrivelsen». Ingen målbar verdi. |
| FC1 – Sprengning/rystelser | 2 | Rystelsesmåler plassert | NS 8141 | ✅ Ja — «typisk 20 mm/s bolig». |
| FC1 – Sprengning/rystelser | 3 | Maks rystelsesnivå (mm/s) | NS 8141 | ✅ Ja — 20 / 35 / 70 mm/s per kategori, målbart tallfelt. |

**Åpen kandidat (❌ — ingen målbar verdi):** KB6 rad 2 (Plantekvalitet → NS 4400). Per
MAL-METODE § 7a løses dette IKKE ved å gjengi NS 4400 — kunden verifiserer mot standarden
selv (sentralt ansvar), ev. angir kriteriene i prosjektbeskrivelsen.

## Kategori 2 — felt som forutsetter at kunden angir noe i prosjektbeskrivelsen (sist målt 2026-09-13)

Ikke en mangel — dette er med vilje (MAL-METODE § 1: prosjektspesifikke krav peker til
beskrivelsen, ikke en universell tallverdi malen ikke kan kjenne). Datagrunnlag for
kundeoversikten «hva du må angi selv». Dekker foreløpig de reviderte malene (KA7/KB2/KB4/KB6);
ureviderte maler (KC3.1, KD1, F-serien) er ikke målt for dette ennå.

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

## Reproduserbar sjekk (kjør mot arkivet, ikke fila)

`helpText`/`options` ligger under `config` i `mal_innhold`. Kjør mot DB-en som bærer
arkivet (lokal `sitedoc`, eller `sitedoc_test` på server-ny):

```sql
SELECT m.referanse, t.ord AS radnr, t.elem->>'label' AS felt,
       coalesce(t.elem->'config'->>'helpText','') ||
         coalesce(' | opsjoner: ' || (t.elem->'config'->>'options'),'') AS tekst
FROM bibliotek_maler m,
     jsonb_array_elements(m.mal_innhold) WITH ORDINALITY AS t(elem, ord)
WHERE coalesce(t.elem->'config'->>'helpText','') ~ 'NS ?[0-9]'
   OR coalesce(t.elem->'config'->>'options','') ~ 'NS ?[0-9]'
ORDER BY m.referanse, t.ord;
```

`radnr` er 1-indeksert posisjon i `mal_innhold` (samme rekkefølge som feltene vises).
Treff må deretter vurderes for hånd mot «Målbar verdi i teksten?»-kolonnen — regex
finner NS-referansen, ikke om det finnes en målbar verdi ved siden av.

Kategori 2 (delegerer til prosjektbeskrivelsen):

```sql
SELECT m.referanse, t.ord AS radnr, t.elem->>'label' AS felt
FROM bibliotek_maler m,
     jsonb_array_elements(m.mal_innhold) WITH ORDINALITY AS t(elem, ord)
WHERE t.elem->'config'->>'helpText' ~* 'beskrivelse|postgrunnlag|posten i'
ORDER BY m.referanse, t.ord;
```
