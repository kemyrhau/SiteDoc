# Til fabel — «ingen lokasjon» finnes ikke som et valg

**Fra:** cowork · **Skrevet:** 2026-08-29 · **Status:** klar til sending

Dette er ikke en ordre og ikke en godkjenning som skal hentes. Det er en modell-mangel vi
traff under en gate, og som stoppet en funksjon Kenneth selv hadde bestilt. Avklaringen er
din.

## Utløseren

Kenneth gatet `fix/kp-lokasjon` på test 29.08 og ba deretter om en funksjon vi mangler:

> *«Dersom en sjekkliste åpnes og har en lokasjon som må settes → automatisk åpne tegningen,
> slik at lokasjon kan settes uten å bla inn til Tegninger.»*

Ordren var skrevet. Så stoppet han den selv:

> *«Dersom lokasjonsvelger alltid velges, da tar jeg bort muligheten å ikke ha med lokasjon
> i en rapport. Noen ganger er det nyttig, da rapporten kan gjelde byggeplassen.»*

## Målingen

**`LokasjonVelger` rendres ubetinget** på sjekklistens detaljside
(`sjekklister/[sjekklisteId]/page.tsx:850-868`). Den er ikke avhengig av at malen har et
lokasjonsfelt. Det finnes altså ingen undergruppe «sjekklister med lokasjon» — alle har
feltet.

**Og `positionX`/`positionY` er null i to helt ulike tilfeller:**

| Tilstand | Hva den betyr | Hvordan den ser ut i data |
|---|---|---|
| Ikke satt ennå | utføreren har ikke rukket det | `positionX = null` |
| Bevisst uten | rapporten gjelder hele byggeplassen | `positionX = null` |

Systemet kan ikke skille dem. Enhver automatikk som leser null som «mangler noe», vil be om
en pin på dokumenter som ikke skal ha en — og en byggeplass-rapport blir da noe man leverer
ved å avvise et spørsmål hver gang.

## Hvorfor dette er ditt bord og ikke vårt

Det er ikke et UI-problem. En knapp «ingen lokasjon» ville løst symptomet og etterlatt tre
tilstander der modellen har to.

Og det henger sammen med en sak du allerede eier — REDESIGN-MASTERPLAN § Nye backlog-saker
(2026-08-13-runden): **tre ulike ting bærer navnet «lokasjon»**:

- `ReportTemplate.showLocation` — fast felt, auto fra bygning/tegning
- `location`-rapportobjekt — ren tekst, prosjektadresse som fallback
- `drawing_position`-rapportobjekt — bærer `drawingId` + koordinater

I tillegg finnes dokumentets egen `Checklist.drawingId/positionX/positionY`, som er den
`LokasjonVelger` skriver til, og som ikke er noen av de tre.

Notatet den gang sa: *«Byggeplass ER lokasjonen: den eier tegningene (`Drawing.byggeplassId`)
og har koordinater fra georeferert tegning. Fabels domene — begrepsavklaring før flere felt
bygges.»* Kenneths funn er det konkrete eksempelet på hvorfor.

## Det som er avklart, og som ikke skal rives opp

To vedtak fra samme runde, begge i prod eller på test — de er premisser, ikke spørsmål:

- **Punktet er planleggerens omtrentlige plassering; sjekklisten dokumenterer faktisk
  utførelse.** Derfor arver en sjekkliste startet fra et kontrollpunkt punktets **tegning**,
  aldri pin (`b987d793`, gatet 4/4 på test).
- **Repeater-lokasjon røres ikke.** Kenneth: *«dersom vi automatisk åpner en tom
  repeaterfelt-lokasjon, mister brukeren kontroll — er det sjekklisten eller et repeaterfelt
  jeg markerer?»*

## Spørsmålet

**Hvordan skal en rapport uttrykke at den gjelder byggeplassen og ikke et punkt?**

Tre retninger vi ser, uten at vi har tatt standpunkt:

1. **Lokasjon er valgfri og eksplisitt** — dokumentet bærer et valg («punkt» / «hele
   byggeplassen»), og null betyr ikke lenger noe alene.
2. **Byggeplassen ER lokasjonen når ingen pin er satt** — da er null allerede et gyldig svar,
   og det som mangler er at utskriften sier det i stedet for å utelate seksjonen.
3. **Malen bestemmer** — noen dokumenttyper krever punkt, andre gjør det ikke, og
   `LokasjonVelger` vises deretter.

Retning 2 er den billigste og krever kanskje ingen datamodell-endring. Retning 3 er den som
gjør auto-åpningen entydig. Vi vet ikke hvilken som stemmer med hvordan dette faktisk brukes
— det gjør du.

## Leveranse

Et designnotat i `docs/redesign/`. Ikke kode, ingen hast — funksjonen er parkert, ingenting
er ødelagt, og `relay/inbox-lokasjon-autoapne.md` ligger ferdig skrevet og venter på svaret.

Er noe her feil målt: si det.
