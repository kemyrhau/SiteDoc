# TILLEGG 2 til KD1 — versjonsstempel og tekstbevis i stedet for skjermbilder

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`, branch `feat/mal-kd1-revisjon`, `d9c867a2`)
**Fra:** design-rollen · **Dato:** 2026-09-18 · **Grunnlag:** Kenneth-vedtak samme dag, nå i MAL-METODE §6a
(hovedtreet: `/Users/kennethmyrhaug/Documents/Programmering/SiteDoc/docs/claude/MAL-METODE.md`).

**Kun `kd1-test.sql` endres.** Ingen endring i branchen, seeden eller testen. Kenneth har **ikke** kjørt den forrige
versjonen av SQL-en — den skal erstattes.

## 1. Versjonsstempel

Metadata-UPDATE-en på `bibliotek_maler` skal også sette **`version = version + 1`**. Uten den ser verken Kenneth eller
firmaene at en ny versjon er ute. Rør ikke `versjon` (tekstkolonnen «1.0»).

## 2. Full utskrift — dette er tekstbeviset

Rett før `COMMIT`, erstatt dagens kontroll-SELECT med:

```sql
\x on
SELECT referanse, navn, beskrivelse, version, verifisert
  FROM bibliotek_maler WHERE referanse = 'KD1';
SELECT o.sort_order, o.type, o.label,
       o.config->'options'    AS alternativer,
       o.config->>'helpText'  AS hjelpetekst
  FROM bibliotek_mal_objekter o
  JOIN bibliotek_maler b ON b.id = o.template_id
 WHERE b.referanse = 'KD1'
 ORDER BY o.sort_order;
```

Behold tellingen (`objektrader=13, datafelt=10, headings=3, har_asfalt=f`) hvis du vil, men den skal ikke erstatte
utskriften. Test lokalt at fila parser (`psql -f`) før du leverer.

## 3. Skjermbilder utgår

Punkt 6 i ordrens DoD (skjermbilder) utgår. Kenneth kjører SQL-en, limer utskriften til design-rollen, og gaten
kjøres på den. Kenneth ser selv på malen i et testprosjekt når han vil. **Ikke let etter en måte å ta skjermbilder på.**

## Lever

De tre enlinjerne, uendret form. Si hva `version` var før og hva den blir.
