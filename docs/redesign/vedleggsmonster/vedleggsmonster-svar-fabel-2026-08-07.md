# Fra fabel → cowork, 2026-08-07 — Vedleggsmønster: mockup + svar på de fire spørsmålene

Designsaken fra i dag (Kenneths kvitteringstest) er besvart med mockup: `Vedleggsmønster Mockup.dc.html` (seksjon 6a–6c). Ett mønster for alle vedleggsflater — timer-kvittering, HMS-bilder, sjekkliste-dokumentasjon, utlegg, maskin-service.

**Prinsipp: tilstanden bor PÅ brikken, aldri i en toast.** Vedlegget viser selv hvor det er i stigen valgt → lastes opp → lagret.

## Svar på de fire spørsmålene

1. **Ser jeg at filen er der?** Alltid miniatyr for bilder — rendret fra det LOKALE fil-objektet (object-URL) fra første sekund, så forhåndsvisningen finnes før opplastingen er ferdig. PDF/ikke-bilde får dokument-brikke med filtype-merke + sidetall; klikk åpner. (6b)

2. **Ser jeg at den er LAGRET, ikke bare valgt?** Tre synlige tilstander på brikken (6a): «Kun på denne enheten» (stiplet ramme) → progressbar → grønn hake + «Lagret 07.08 14:32 · 1,2 MB». Feil er aldri stille: rød brikke + «filen er IKKE lagret» + Prøv igjen. Offline mobil: tilstand 1 sier «Lastes opp når du er på nett» — aldri falsk grønn hake.

3. **Kan jeg legge ved før raden er lagret?** Anbefaling **alternativ (a)** (6c): opplasting tillates i opprett-flyten, filen lastes opp straks og **bindes til raden ved lagring** (fileUrl → rad i samme mutasjon som lagrer raden). Upload-endepunktet er alt rad-uavhengig, så dette er binding, ikke ombygging. Avbrutt opprettelse → ubundne filer ryddes etter 24 t. Alternativ (b) anbefales ikke — det bevarer omveien. Dagens synlig-men-døde knapp forsvinner som klasse.

4. **Fjerne/bytte?** × direkte på brikken; bytt = fjern + legg til. Ingen lagre-og-gjenåpne.

## Signert-URL-rammen (designbetingelsen)
Utløpt 5-min-URL degraderer ALDRI til feiltilstand: metadata i DB vet at filen ER lagret, så brikken beholder trygg «lagret»-tilstand og viser «Trykk for å hente på nytt» — ny signert URL hentes ved klikk (6b, tredje brikke). Skillet lagret-tilstand (DB-metadata) vs. visnings-URL (flyktig) er bærebjelken i mønsteret.

## Klikk-budsjett
Legg ved kvittering + se at den sitter = **2 handlinger**: velg fil → se grønn hake. Ingen lagre-først-omvei, ingen gjenåpning.

**Neste:** Kenneth godkjenner mockupen visuelt → du skriver Opus-ordren mot den (og B-fiksene hans — stille retur, maskert feil — koder mot dette mønsteret i stedet for punktplaster).

## Tillegg: vedleggene lagres på TRE ulike mønstre (kodeverifisert, treffer fillagrings-sporet)

1. **Egen vedleggstabell:** `SheetTilleggVedlegg` (timer) — rad per fil, `fileUrl` + metadata, flere per rad. Riktig mønster.
2. **`fileUrl`-felt på fagobjektet:** `Drawing` (+`originalFileUrl`), `PointCloud`, `DrawingRevision`, `Image`, `FtdDocument`. Én fil per objekt.
3. **JSON-array uten relasjon:** `AnsattKompetanse.vedlegg` og `ServiceRecord.vedlegg` (maskin) — `[{url, filename, uploadedAt}]` i Json-felt. Ingen fil→eier-relasjon.

**Konsekvens for Fase 1** (timer + kompetanse + maskin = mønster 1 + 3 + 3):
- **Migrering:** pekere i Json-felt oppdateres ikke av kolonne-baserte skript. Opus rapporterte feltene som «normalt tomme» — en no-op oppdages ikke ved kjøring i dag, men den dagen et sertifikat lastes opp. Sjekkpunkt før Fase 1-lukking: bekreft at skriptet faktisk traverserer Json, ellers dokumenteres det som kjent begrensning — ikke dekning.
- **Authz ved emisjon:** M1-mønsteret autoriserer via record-id (`signerTilleggVedlegg({vedleggId})`). En fil i en Json-array HAR ingen id — signeringen treffer strengen (dyp traversering), men retten til signering har ingenting å feste seg i. Midlertidig Fase 1-løsning: authz mot eier-raden (AnsattKompetanse/ServiceRecord-id) i stedet for fil-id.

**Konvergens = EGEN ORDRE foran Fase 1b** (vedtatt av Kenneth — Fase 1 er nær ferdig og skal ikke svelge datamodell-endring). Fabels foreløpige svar på isoleringsspørsmålet, til den ordren:

En felles `Vedlegg`-tabell må bære BEGGE isoleringsgrenser eksplisitt, ikke velge én: **både `projectId?` og `organizationId` som kolonner, der `organizationId` alltid er satt** (denormalisert fra eieren ved innsetting) og `projectId` er satt for prosjekteide vedlegg. Da authz-es firmamodul-vedlegg (kompetanse, maskin-service) på `organizationId` og prosjektvedlegg på `projectId` — samme spørring-mønster som i dag, ingen join gjennom polymorf eier for å finne grensen. Den polymorfe eier-referansen (`eierType` + `eierId`) brukes til livssyklus (slett eier → slett vedlegg, opprydding av ubundne), ALDRI til authz — authz leser kun de to denormaliserte grense-kolonnene. Invariant som guards: et vedlegg med `projectId` må tilhøre et prosjekt i samme `organizationId`. Detaljeres i konvergens-ordren.
