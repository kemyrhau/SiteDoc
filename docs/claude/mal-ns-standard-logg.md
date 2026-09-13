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

## Kolonne «Målbar verdi i teksten?»

- **❌ Nei** = feltet punkter arbeideren til standarden/beskrivelsen uten en verdi han
  kan måle/kontrollere. **Kandidat for fabel** til å gjengi de konkrete kriteriene så
  arbeideren slipper å slå opp i en standard han ikke har.
- **✅ Ja / Delvis** = feltet gir en konkret verdi (mm/s, pH, mm, %) selv om det også
  nevner en standard. Utenfor problemet.

## Logg (sist målt 2026-09-13)

| Mal | Rad | Felt | Standard | Målbar verdi i teksten? |
|---|---|---|---|---|
| KB2 – Vekstjord på terreng | 3 | Varedeklarasjon kontrollert | NS 2890 | ✅ Delvis — gir pH 5,5–7,0, uten rotugras. NS 2890 gjelder deklarasjonens format. |
| KB6 – Planting | 2 | Plantekvalitet | **NS 4400** | ❌ **Nei** — «tilfredsstille NS 4400 … kontroller mot beskrivelsen». Ingen målbar verdi. |
| FC1 – Sprengning/rystelser | 2 | Rystelsesmåler plassert | NS 8141 | ✅ Ja — «typisk 20 mm/s bolig». |
| FC1 – Sprengning/rystelser | 3 | Maks rystelsesnivå (mm/s) | NS 8141 | ✅ Ja — 20 / 35 / 70 mm/s per kategori, målbart tallfelt. |

**Åpne kandidater for fabel (❌):** KB6 rad 2 (Plantekvalitet → NS 4400).

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
