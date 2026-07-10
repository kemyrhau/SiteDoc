---
tittel: Dokumentasjons-standard — presens krever referanse
status: STYRENDE
sist_verifisert_mot_kode: 2026-07-09
gjelder: alle filer i docs/claude/
---

# Dokumentasjons-standard

**Kort:** En setning i `docs/claude/` som sier at systemet *gjør* noe, må bære
enten en kode-referanse eller en status-markør. Uten det leses den som fasit —
også når den bare var en intensjon.

## Bakgrunn

`timer.md` beskrev 2026-07-09 fire ting som ikke fantes, med samme sikkerhet som
det som fantes. Ingen var løgn da de ble skrevet — men alle ble lest som fasit,
også av kontroll-laget. Kenneth ser ikke hva øktene skriver og kan ikke lese alt.
Regelen må derfor binde ved **skrivetidspunktet**, ikke ved gjennomlesning.

De fire (se `timer.md` etter retting `c875ee6f`):

| Sted | Påstand | Virkelighet |
|---|---|---|
| `:263` | ③b-fallbacken velger «laveste-rekkefolge ordinær» | Fantes — men i migrering `20260705120000_lonnsart_overtidsnivaa` Steg 2, ikke i `20260605180000` som funn-forfatteren så på. Vag «migreringen» kostet en runde. |
| `:517` | Eksport joiner katalog for lønnsart-kode/navn/pris | Ikke implementert. `timer-rapport-eksport.ts` er en lederrapport (`Ansatt`/`Ansattnr`/`Dato`/`Timer`), ingen `kode`. |
| `:534` | «Eksport-modulen kaster tydelig feilmelding ved eksport-tid» | Modulen finnes ikke (adaptere «❌ Ikke startet»). |
| `:536` | «Lønns-/økonomisystem matcher uten rekonfigurasjon» | Generalisering. Sant kun for A.Markussen (firmaegne koder), ikke universelt. |

## Regelen

### 1. Presens krever referanse

En setning som sier at systemet gjør noe, må bære **enten** en kode-referanse
(`fil:linje` eller migreringsnavn) **eller** en status-markør. Uten det er den
ikke en påstand om systemet — den er en **intensjon**, og den vil bli lest som en
påstand.

### 2. Markører

| Markør | Betydning |
|---|---|
| ⚠️ **UTKAST** | Atferd/format ikke avklart |
| 🟡 **PLANLAGT** | Avklart, ikke bygget |
| ❌ **IKKE IMPLEMENTERT** | Beskrevet, bevisst utsatt |

Uten markør leses setningen som **«bygget og verifisert»**.

### 3. Vage referanser er verre enn ingen

Skriv `20260705120000_lonnsart_overtidsnivaa`, ikke «migreringen» — det finnes to,
og forvekslingen kostet en runde 2026-07-09. En vag referanse gir falsk trygghet:
leseren tror påstanden er sjekket.

### 4. Negative påstander krever uttømmende søk

«Finnes ikke», «kalles aldri», «ingen kodevei» skal **aldri** hvile på ett grep.
Enumerer kandidatmengden først (alle migreringer, alle kallsteder), og oppgi i
teksten eller commit-meldingen hva som ble søkt gjennom. Ett grep over feil (for
gammel) migrering var nettopp rotårsaken til `:263`-feilen.

### 5. Håndheves på ny prosa, retro-fylles ved berøring

Regelen gjelder ufravikelig for **ny** prosa. Eksisterende filer retro-fylles når
de likevel røres — samme mekanikk som YAML-header-regelen
([oppryddings-plan-2026-04-28.md § P0.1](oppryddings-plan-2026-04-28.md)).

### 6. Gate-plikt (kontroll-laget)

Ved hver docs-commit **plukkes de nye presens-påstandene ut**, et utvalg
verifiseres mot koden, og gate-rapporten oppgir hvilke som ble sjekket.
«Docs-only, ingen secrets» er **ikke lenger tilstrekkelig** som gate for
dokumentasjon.

## Anvendt

Rettingen `c875ee6f` (2026-07-09) er referanse-eksempelet: `:517`/`:534` fikk
⚠️ UTKAST / ikke-bygget-markør, `:536` ble omformulert fra faktum til antakelse,
`:263` fikk navngitt migrering + presisering om at fallbacken velger *posisjon*,
ikke *betydning*.
