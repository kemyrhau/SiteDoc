# Utskriftsformer — to nå-krav til dokgen-kontrakten + backlogg

Dato: 2026-08-15 · fra fabel · vedtatt av Kenneth 2026-08-15
Bygger på: `FABEL-SVAR-utskriftsformer.md` (2026-08-12, typologien) og inbox-blokken «UTSKRIFTSFORMER: samlet kravspec fra prod-bruk» (2026-08-13).

## Nå-krav — inn i dokgen-kontrakten som bygges nå

Disse er arkitekturkrav på kontrakten, ikke nye leveranser. De koster nesten ingenting nå og er dyre å ettermontere.

**N1. Payloaden er en LISTE av dokumenter, aldri ett dokument.**
Enkeltutskrift = liste med ett element. Sammenhengende utskrift av flere rapporter (Kenneths krav 5) blir da «send flere i samme payload» — samme mal, samme pipeline. Kontrakt: `{ mal, dokumenter: [...] }`.

**N2. Malbegrepet er flertall fra dag én.**
`mal` er et navngitt felt i payloaden, ikke implisitt. Full rapport (arkivform), én-linje-liste og minimert arbeidsliste er tre maler over samme data — ikke tre systemer. Dokgen skal kunne rute på malnavn selv om bare arkivformen finnes i første leveranse.

Relatert, allerede drøftet 2026-08-15 (ikke vedtatt som ordretekst ennå): container-kontrakten — navngitte blokker i malen (prosjektnummer, prosjektnavn, logo, …), hver med synlighetsflagg i payloaden og valgfri ramme; blokker vokser med innhold (standard HTML-atferd), `break-inside: avoid` mot kapping. Tas inn når neste dokgen-ordre formuleres.

## Backlogg — egne bestillinger senere, i anbefalt rekkefølge

1. **Klient-knapp** (allerede neste steg — ikke ny).
2. **Utvalgsvindu:** liste over sjekklister med avkryssing → velg hvilke som skrives ut. Ren klient-UI, bygger på knappen.
3. **Minimert arbeidsliste-mal:** per rapport — første bilde + emnefelt/første tekstfelt + status + skrivefelt, for håndverker uten telefon / som vil ha papir. Pilotverdi: papir på byggeplass er reelt. (= «Utvidet»-formen i coworks kravspec-blokk, krav 5b.)
4. **Én-linje-liste-mal:** én rad per rapport, viser hvilke rapporter som finnes. (= Tabellrapport i typologien / krav 5a. Logg utelates i samleformene, jf. Kenneths tidligere vedtak.)
5. **Excel-eksport:** eget spor — ikke Playwright, ikke dokgen-malen. Enkel xlsx-generering (f.eks. exceljs) rett fra rapportdataene, én rad per rapport. Liten, separat bestilling.

## Avgrensning

- Ingen kode bestilles med dette notatet; N1/N2 føres inn i dokgen-ordren når den går til Opus.
- Kravene 1–4 i coworks kravspec-blokk (tomme objekter, logg-valg, avsenderfirma, varianter per dokumenttype) er ikke behandlet her — de står åpne i inboksen og spec-es i arkivmal-sporet.
