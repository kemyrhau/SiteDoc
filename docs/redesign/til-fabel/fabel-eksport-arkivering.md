# Til fabel — eksporten skal arkiveres, ikke lastes ned

**Fra:** cowork · **Skrevet:** 2026-08-27 · **Status:** UTKAST (ikke sendt)

## Kenneths retning

> *«egentlig → ingen ønsker et dokument i nedlastinger → for så å flytte/arkivere det
> senere → det må umiddelbart arkiveres, huske hvilken mappe vi arkiverer til for
> neste gang vi arkiverer»*

Og rett før, om samme sak:

> *«det beste er å legge en fil i enten nedlastinger eller som vedlegg i e-post»*

Han flyttet seg fra e-post til arkiv i løpet av to meldinger, og landingen er bedre:
**arkivering løser også e-postspørsmålet**, fordi et arkivert dokument er det man
sender fra — og det som består etterpå.

## Hva som står i dag

Printmotoren er ferdig gjennom fase 1–4 (`docs/claude/delplaner/printmotor-faser-2026-08-25.md`):

- Timer-rapporten har en Detaljer-tabell på skjermen bygget av samme
  `byggDetaljRader`/`grupperDetaljRader` som Excel og PDF. Skjermen ER dokumentet.
- `EksportOppsett` (config v2, JSONB) bærer `radTyper`, `mottaker`, `gruppering`,
  `orientering`, `topptekst`. Innebygde maler: Full eksport, Lønnsgrunnlag,
  Fakturagrunnlag.
- `mottaker=ekstern` fjerner status, ID og ansattnr **strukturelt** — personvern, ikke
  preferanse (ansattnr er pseudonymiseringsnøkkelen).
- Eksporten produserer en fil som lastes ned. Det er der Kenneth stopper opp.

## 🔴 Det harde premisset — målt i schema

**`Folder.projectId` er PÅKREVD.** Mapper er prosjekt-scopet, med hierarki,
`accessMode`/`FolderAccess` og valgfri kobling til `FtdKontrakt`
(`packages/db/prisma/schema.prisma`, modell `Folder`).

**Timer-rapporten er en FIRMA-flate** (`/dashbord/firma/timer/rapport`). Prosjekt er
et *filter*, ikke en kontekst. Default er «Alle prosjekter».

Det gir en direkte kollisjon:

| Tilfelle | Har dokumentet et hjem? |
|---|---|
| Filtrert på ett prosjekt | Ja — det prosjektets mapper |
| Ikke filtrert (alle prosjekter) | **Nei** — ingen prosjekt-mappe eier det |

Og «husk mappa til neste gang» arver problemet: malen er firma-nivå og brukes på tvers
av prosjekter, mens mappa tilhører ett av dem.

## Spørsmålene vi trenger svar på

1. **Hvor bor et firma-dokument som spenner flere prosjekter?** Skal arkivering kun
   være mulig når et prosjektfilter er satt (ærlig, men begrensende)? Skal det finnes
   firma-mapper (ny struktur)? Eller arkiveres per prosjekt i flere kopier — som
   bryter «ingen duplikater»-prinsippet?
2. **Hvor huskes mappa?** På malen (`config.arkivMappeId`) er elegant og passer at
   malen beskriver hele utfallet — men malen er firma-nivå og mappa prosjekt-nivå.
   Per (mal × prosjekt)? Per prosjekt, sist brukt? Per bruker?
3. **Erstatter arkivering nedlasting, eller kommer i tillegg?** Kenneth sier ingen vil
   ha fila i Downloads. Men noen ganger trengs den lokalt — for å legge ved i Outlook
   eller laste opp i en kundeportal. Er nedlasting da «last ned fra arkivet» i stedet
   for et eget eksportmål?
4. **Hva slags dokument blir det i arkivet?** `FtdDocument` er dokumentflyt-verdenen,
   med eier, mottaker og flytregler. Et fakturagrunnlag har ingen flyt — det er en
   rapport. Skal det inn som et FtdDocument uten flyt, eller er dette en annen
   dokumenttype som mappene også kan holde?
5. **Og e-post?** Kenneth spurte om vedlegg først. `apps/api/src/services/epost.ts`
   finnes (invitasjon, dokumentvarsling, mottakeroppslag) men har **ingen
   vedleggsstøtte**; Resend kan det. Blir «send» en handling PÅ det arkiverte
   dokumentet i stedet for et eget eksportmål? 🔴 Merk at **«send» allerede betyr noe
   annet i SiteDoc** — å flytte et dokument til neste faggruppe i flyten. To
   betydninger av samme ord er nøyaktig kollisjonen CLAUDE.md advarer mot (attestering
   vs godkjenning).

## Avklart av Kenneth 2026-08-27 — bygg videre på dette

**Handlingen bæres av et ikon, ikke et verb.** `Share2` fra lucide, samme ikon mobil
allerede bruker (`apps/mobile/app/sjekkliste/[id].tsx`). Grunnen er spørsmål 5 over:
«send» er opptatt av flyten. Et del-ikon sier «gjør noe med denne fila» uten å ta
ordet — og uten å binde designet ditt til et verb vi må ta tilbake når arkivering,
nedlasting og e-post skal ligge under samme handling.

Du står fritt til å foreslå hva som skjer NÅR man trykker det (meny? direkte til sist
brukte mappe?) — det er en del av designet. Men handlingen skal ikke hete «Send».

## Hvorfor dette er verdt en designrunde og ikke en knapp

Bygger vi «arkiver hit»-knappen isolert, får vi en knapp. Bygger vi den med spørsmål
1–5 besvart, får vi svaret på **«hva sendte vi til byggherren, og når»** — som i dag
ikke finnes noe sted. En PDF i noens Downloads og en e-post i en utboks er ikke et
regnskap over hva som er fakturert.

## Rammer

- **Ikke rør `mottaker=ekstern`-regelen.** Status, ID og ansattnr ute av eksterne
  dokumenter er personvern og skal ikke svekkes av at dokumentet nå lagres et sted.
  🔴 Et arkivert eksternt dokument er fortsatt eksternt.
- **Kostnad/enhetspris per rad** og **underprosjekt-dimensjonen** er fortsatt utsatt
  av Kenneth.
- Nedlasting-ved-mal-klikk bygges nå som **midlertidig** løsning
  (`relay/inbox-malklikk-eksporter.md`) for å fjerne dagens forvirring. Den skal ikke
  binde designet ditt.

## Leveranse

Et designnotat i `docs/redesign/`. Ikke kode.
Er noe her feil målt: si det — grunnlaget er viktigere enn tempoet.
