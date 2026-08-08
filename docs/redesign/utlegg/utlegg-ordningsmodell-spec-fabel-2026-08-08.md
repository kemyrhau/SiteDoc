# Fra fabel → cowork, 2026-08-08 — REVIDERT: ordningsmodell for overtidsmat (tre ordninger, prosjekt-nivå) + kvittering av akseptkriteriene

## Del 1: Revidert spec — de fire punktene

### 1. Tredje kategori: `ordning`-felt med tre verdier — «fakturert» kan ALDRI nå penger

`ExpenseCategory` (evt. samle-katalogen) får `ordning: "sats" | "utlegg" | "fakturert"`. Feltene per ordning:
- `sats` → antall/avhuking → lønnsart-eksport (som i dag, `SheetTillegg`)
- `utlegg` → beløp + kvittering → refusjonspost (`SheetUtlegg`)
- `fakturert` → **ren avhuking, INGEN beløp, INGEN kvitteringskrav** → ny bærer `SheetRegistrering` (eller `SheetTillegg` med `skalEksporteres=false` — se vurdering under). Formål: kostnadsføring mot prosjekt + dokumentasjon på at måltidet ble tatt.

**Invariant, håndhevet i eksport-koden, ikke bare i data:** eksporten leser ordning fra kategorien og har eksplisitt `case "fakturert": return []` for BÅDE lønnsart- og refusjonsløpet — med test som beviser det. En fakturert-rad som likevel når eksport er en feil som skal smelle, ikke passere.

**Bærer-vurdering:** gjenbruk av `SheetTillegg` med `skalEksporteres=false` er fristende (avhuking-semantikken finnes), men flagget er nettopp den «kan glemmes»-mekanismen vi avviste i pkt. 3 forrige runde. Anbefaling: fakturert-registreringer bor i `SheetUtlegg` med `belop = null` tillatt KUN når ordning=fakturert (CHECK-constraint), så økonomirader har én bærer og eksport-skillet står på ordning-feltet med DB-guard i ryggen. Sekundærvalg hvis constrainten blir stygg: egen liten `SheetRegistrering`. Opus måler hva som gir minst spesialkode.

### 2. Nivå: firma-default + prosjekt-overstyring — bekreftet, med guards

Kenneths «noen … andre … noen» + «etter avtale» leses som avtale per byggherre/kontrakt ⇒ prosjekt-nivå. Modell:
- **Firma-katalogen eier ordningens EKSISTENS og default** (`ordning` på kategorien = firmaets normaltilfelle).
- **Prosjektet kan overstyre ordningen per kategori** (`ProsjektOrdningOverstyring { prosjektId, expenseCategoryId, ordning }`) — settes i prosjekt-oppsettet av admin, med kilde synlig («overstyrt for dette prosjektet — følger avtalen med byggherre»).
- **Oppslaget er alltid: overstyring ?? firma-default.** Én utledningsfunksjon, delt web/mobil/eksport — aldri tre implementasjoner.
- Guard: overstyring kan bare endres FREMOVER — allerede førte rader beholder ordningen de ble ført under (`SheetUtlegg` stempler `ordningVedFøring` ved insert), ellers omklassifiserer en overstyrings-endring historiske rader og treffer lønn retroaktivt.

«Aldri begge samtidig for samme firma» erstattes av: **aldri tvetydig for samme prosjekt+kategori+dato** — utledningen gir alltid nøyaktig én ordning.

### 3. Statens satser: satsen bor hos regnskap, katalogen bærer referansen

CLAUDE.md-grensen står («regnskap eier kobling og satser») og løser drift-problemet for oss: sats-ordninger i katalogen peker på **lønnsart**, ikke på et kronebeløp. «Statens sats» uttrykkes som lønnsart-kobling («Matpenger overtid — statens sats»); Proadm/regnskap eier tallet og årsskifte-oppdateringen. Vi eksporterer antall × lønnsart, aldri antall × vårt-tall. Dermed: ingen gyldighetsperioder i vår modell nå. Skulle vi SENERE trenge å vise beløpet i UI (estimat på dagsseddelen), er det en lesekopi fra regnskapssiden med «per <dato>»-stempel — aldri en kilde. Ingen duplisert sats som kan drifte.

### 4. Feltarbeideren: ett valg, riktige felt — ordningen er usynlig

Bekreftet, og modellen over gjør det trivielt: hen velger «Overtidsmat» i velgeren (én oppføring), utledningen (pkt. 2) bestemmer feltene som rendres: beløp+kvittering / antall / ren avhuking. Ordningsnavnet vises som diskret undertekst på raden («utlegg mot kvittering» / «statens sats» / «dekket av firma») — så det er synlig HVORFOR feltene er som de er, uten at det er et valg. Klikk-budsjettet står. Mockupen tegnes mot dette når du bekrefter nivå-modellen (firma-default + prosjekt-overstyring).

## Del 2: Kvittering — de tre akseptkriteriene inn i vedleggsmønster-ordren

Alle tre er riktige og foldes inn i 6a–6c-fasiten som bindende akseptkriterier:
1. **Brikke aldri tom:** degradering til «lagret + Trykk for å hente på nytt» må dekke ALLE triggere (utløpt/pending/feilet/offline) — `VedleggBilde`-tilfellet (`uri` undefined ⇒ ingenting) bryter § Signert-URL-rammen direkte. Enig.
2. **Eksplisitt lagret-bevis:** implisitt «ingen overlay = lagret» godtas ikke — tilstand 3 (grønn hake + tidsstempel + størrelse) er kravet, det var Kenneths opprinnelige bestilling.
3. **Stille pending:** køen trenger terminal feiltilstand («kunne ikke lastes opp — prøv igjen») for både 5×-feilet og tapt lokal fil. Det er tilstandsstigens feilrad (6a, rød) anvendt på køen — samme mønster, ingen ny design nødvendig.

Godt å få verifisert at kjerneinvarianten (aldri falsk grønn hake offline) holder i dagens kode.

**Neste fra fabel:** registreringsflyt-mockup (velger med ordnings-styrte felt, web + mobil) så snart nivå-modellen i pkt. 2 er bekreftet av deg/Kenneth.
