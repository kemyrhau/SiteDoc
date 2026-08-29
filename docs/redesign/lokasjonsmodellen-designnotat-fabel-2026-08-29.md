# Designnotat: lokasjonsmodellen — «gjelder byggeplassen» som gyldig svar

**Fra:** fabel · **Dato:** 2026-08-29 · **Svar på:** relay/fabel-lokasjonsmodellen.md (cowork 2026-08-29)
**Status:** forslag — venter Kenneth-vedtak på to spørsmål nederst. Ingen kode i denne runden.

## Anbefaling (kort)

**Retning 3 styrer, retning 2 gir semantikken.** Malen bærer ett nytt begrep,
**lokasjonskrav**, med to verdier:

- **`punkt`** — dokumentet skal ha pin på tegning. Null i `positionX` betyr «ikke satt ennå».
  Auto-åpne-tegning-funksjonen (Kenneths bestilling) gjelder KUN her — og blir dermed entydig.
- **`byggeplass`** — byggeplassen ER lokasjonen. Null er et gyldig, ferdig svar. Utskriften
  skriver «Lokasjon: hele byggeplassen — {byggeplassnavn}» i stedet for å utelate seksjonen.
  Ingen automatikk maser om pin.

Ingen tredje tilstand i data. Ingen ny bekreftelse i utfylling (effektivitets-gaten:
defaults over valg — utføreren tar aldri stilling til modus, det gjorde malbyggeren).

## Spørsmål til Kenneth (avgjør formen)

1. **Er lokasjonskravet en egenskap ved dokumenttypen (malen)?** Eller må én og samme mal
   kunne gi både punkt-dokumenter og byggeplass-dokumenter? Sier du det siste, faller
   retning 3 og vi må til retning 1 (eksplisitt valg per dokument = ett klikk mer for alle).
2. **Default for eksisterende maler:** `byggeplass` (ingen mas, dagens oppførsel bevart) er
   mitt forslag — malbygger skrur på `punkt` der det trengs. Enig?

---

## Grunnlag (målt mot koden 2026-08-29)

Coworks målinger verifisert, alle holder:

- `LokasjonVelger` rendres ubetinget på sjekklistens detaljside
  (`sjekklister/[sjekklisteId]/page.tsx:852`) — ingen malfelt-betingelse. Alle sjekklister
  har feltet.
- `Checklist.drawingId/positionX/positionY` er nullable (`schema.prisma:1082-1084`);
  null skiller ikke «ikke satt ennå» fra «bevisst uten».
- `harAktivLocation` beregnes i `mal.ts:221-235,248` men har **ingen konsument**
  (søkerom: `apps/web/src`, `apps/mobile/src`, `apps/mobile/app` — grep på navnet, null treff).
- `ReportTemplate.showLocation` finnes allerede som mal-nivå-bryter (`schema.prisma:955`,
  MalBygger.tsx:882-892: «Skjult» / «settes auto fra bygning») — presedens for at malen
  styrer lokasjonsatferd.

**Nyanse cowork bør se (enkeltmålt):** `harAktivLocation` måler `location`-rapportobjekter,
og kommentaren i `mal.ts:218-220` sier at aktiv location krever *posisjon* ved opprettelse
på mobil — dvs. flagget er allerede en spire til «malen bestemmer», men for rapportobjektet,
ikke for toppnivåfeltet `Checklist.drawingId`. De to må ikke blandes i implementasjonen.

## Hvorfor denne kombinasjonen

- **Retning 1 alene** (valg per dokument) bryter effektivitets-gaten: hvert dokument får et
  obligatorisk valg utføreren må ta, også der svaret er gitt av dokumenttypen. En
  HMS-runde-byggeplass skal ikke levere seg selv ved å avvise et spørsmål.
- **Retning 2 alene** gjør auto-åpningen umulig: er null alltid gyldig, finnes det aldri noe
  som «mangler», og funksjonen Kenneth bestilte kan ikke fyre.
- **Kombinasjonen** gir begge: byggeplass-rapporter er ferdige uten pin, punkt-dokumenter
  får entydig automatikk. Infrastrukturen finnes (`showLocation`-mønsteret i malbygger;
  `harAktivLocation`-beregningen som mal for avledning).

## Premisser som står (røres ikke)

- Punktet er planleggerens omtrentlige plassering; sjekklisten dokumenterer faktisk
  utførelse — arv tegning, aldri pin (`b987d793`, gatet 4/4).
- Repeater-lokasjon røres ikke. Lokasjonskravet gjelder toppnivåfeltet; repeater-flyten er
  utenfor.

## Utenfor denne runden

- Selve auto-åpne-ordren — skrives først når spørsmål 1–2 er vedtatt
  (`relay/inbox-lokasjon-autoapne.md` ligger klar hos cowork og oppdateres da med
  lokasjonskrav-gatingen).
- Begrepsopprydding «tre ting heter lokasjon» (masterplan-backlog 2026-08-13) — dette
  notatet er første delsvar (toppnivåfeltet får semantikk), resten står i backlog.
- Per område / per rom (Kenneth 2026-08-28): `KontrollplanPunkt.omradeId` finnes; «rom»
  finnes ikke som begrep. Notert som retning, bygges ikke nå.
