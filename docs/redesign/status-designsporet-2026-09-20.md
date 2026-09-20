# Status for designsporet — hva som er gjort, hva som står åpent

**Fra:** design · **Dato:** 2026-09-20 · **Formål:** beslutningsgrunnlag for hva vi tar videre, så valget ikke tas én
mal om gangen uten oversikt. Målt mot `origin/develop` samme dag.

---

## 1. Malbiblioteket

**21 maler i fire standarder:** NS 3420-K (8), -F (8), -U (3), -J (1). To maler er parkert.

**Det som ble ryddet underveis:** kodene i Del F fulgte ikke normen i det hele tatt — graving lå under markrydding, og
kapitlene FC og FE fantes ikke. Alle fem er omkodet på samme bibliotekrad, så firmaer som har lånt malene, beholdt
koblingen. To tomme kapitler er slettet.

**Arbeidsformen er nå:**
- to maler per runde i én branch
- innholdet gates på en lokal utskrift, ikke ved å seede for å lese
- hele malteksten er låst i en fasitfil — endres et tegn uten ordre, blir testen rød
- SQL mot test kjøres per runde, og alltid når generatoren er endret

**Hva biblioteket dekker i dag:** hele VA-kjeden (graving, legging, kum, gjenfylling, prøving), grunnarbeidene
(markrydding, byggegrop, sprengning, fylling, avretting), asfalt, og anleggsgartnerarbeidene fra Del K.

## 2. Åpne saker, rangert

### A. Små og synlige for kunden (raskest verdi)

| Sak | Hvor | Omfang |
|---|---|---|
| Statusmenyen viser råteksten «dismissed» i stedet for «Avvist» | `firma-hurtig-modal.tsx`, BACKLOG | Én linje — nøkkelen finnes, den brukes bare ikke |
| Kapittel-lista mangler tiebreaker i sorteringen | `bibliotek.ts:37`, BACKLOG | Sorter på tall, deretter kode |
| Skjermleser sier «Dokumenttype», dialogen sier «Dokumentklasse» | kontraktssak-oppfølger, BACKLOG | Ett ord, to språkfiler |

### B. Etterslep fra runder som er levert

- **«Lest»-merket bruker `title=`**, som standarden vår forbyr. Oppfølger etter statusfargene.
- **«Kopier mal» i mallista** fikk ingen forklaring da de andre sperrede knappene fikk det.
- **FB4 og FD3 er låst i fasiten, men ikke voktet** av normkodevakten. Ordnes når de revideres.
- **Ingen flate viser malinnhold som tekst.** I dag leses innholdet bare gjennom SQL-utskriften. Kenneth har godkjent
  en superadmin-visning, men ikke nå.

### C. Flere maler — hullene som står igjen

| Kandidat | Hvor | Hvorfor |
|---|---|---|
| Vannhåndtering (FJ) | Del F | Lensing og drenering i byggegrop. HMS-nært og ofte udokumentert |
| Sikring av berg (FP1) | Del F | Rensk, bolting og nett — hører sammen med sprengningsmalen |
| Opplasting og transport av masser (FM) | Del F | Massehåndtering og leveringsavgift, det som gir tvist om mengder |
| Blomstereng (KB5), renner (KD3) | Del K | Hull i anleggsgartner-delen |
| Grunnforsterkning (GB) | NS 3420-G:2019 | Låser opp den parkerte FD3. Normdelen finnes i `kilder/` |
| Spunt | Egen normdel | Låser opp den parkerte FB4. **Normdelen mangler — må skaffes** |
| Betong (Del L), tetting og tekking (Del S), drift (Del Z/ZK) | Egne deler | Store felt, ikke påbegynt |

## 3. Designs anbefaling

1. **Ta A-sakene først.** Tre små saker som til sammen er under en dags arbeid, og alle tre er synlige for brukeren
   eller for den som leser biblioteket. De har ligget i backloggen mens vi har bygget maler.
2. **Deretter FJ og FP som én runde.** Da er Del F i praksis dekket for det vi driver med, og sprengningsmalen får
   følget sitt.
3. **Vurder Del G (grunnforsterkning) etterpå.** Den låser opp en av de parkerte malene, og normdelen har vi.
4. **Spunt krever at normdelen skaffes** — ingenting skjer med FB4 før den er på plass.

Det som ikke haster: Del L, S, Z og ZK. De er store, og ingen av dem er etterspurt.
