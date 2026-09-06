# ORDRE — lokasjonOmfang: «hele byggeplassen» som gyldig svar

**Skrevet av cowork 2026-09-04** fra fabels gatede grunnlag. Fabel eier designet; denne fila er
utførelsen.

**Grunnlag (les begge — de er vedtatt, ikke forslag):**
- [`designnotat-lokasjonsmodellen-fabel-2026-09-04.md`](designnotat-lokasjonsmodellen-fabel-2026-09-04.md) — Kenneth-vedtatt 04.09
- [`TILLEGG-ordre-lokasjonomfang-L9-2026-09-04.md`](TILLEGG-ordre-lokasjonomfang-L9-2026-09-04.md) — L9, Kenneth-vedtatt 04.09 kveld

**Låser opp:** `relay/inbox-lokasjon-autoapne.md`, som har stått ⛔ ON HOLD siden 2026-08-29.

## Hvorfor — Kenneths eget eksempel, og det er styrende

> **Kenneth 2026-09-04:** *«Denne observasjonen gjelder ikke ett punkt — den gjelder hele
> anlegget. Dette kan være rett for f.eks. → alle gatelysene mangler merking.»*

Én observasjon, hundre lyspunkt. En pin ville ikke bare vært unødvendig — den ville **påstått at
funnet gjelder ett sted**. Samme klasse: feil armaturtype gjennom hele anlegget, en strekning
uten kostdekning, manglende skilting langs en vei.

I dag lagres «gjelder alt» og «ikke bestemt ennå» som samme tomme verdi. **PDF-en skriver «Ikke
utfylt» der Kenneth mente «gjelder hele byggeplassen»** — en byggherre leser det som en glipp.
Det er samme prinsipp som EXIF-vedtaket samme døgn: *et dokument skal ikke påstå noe usant, og et
tomt felt der noe var ment er en usann påstand.*

## Modellen

Nytt nullable felt på **`Checklist` og `Task`**:

```
lokasjonOmfang: "punkt" | "byggeplass" | null
```

| Verdi | Betyr | Visning i web + PDF |
|---|---|---|
| `null` | ikke valgt ennå | «Ikke satt» — auto-åpning kan trigge |
| `"byggeplass"` | bevisst hele byggeplassen | 🔴 **«Gjelder hele byggeplassen»** — seksjonen utelates ALDRI stille |
| `"punkt"` + koordinater | pin satt | som i dag |

## DB-migrering — FORHÅNDSGODKJENT av Kenneth 04.09

Konsekvensen var forelagt før vedtak; **ikke stopp for godkjenning.** Kravet består:
to-stegs migrasjons-policy — **kun ADD COLUMN, ingen DROP, ingen NOT NULL, ingen backfill.**
Eksisterende rader beholder `null` og dagens atferd uendret.

## Krav

**1. Feltet + visningen.** `lokasjonOmfang` på begge tabeller, eksponert gjennom API, vist i web
og i arkiv-PDF (`packages/pdf`). 🔴 **Paritetsregelen:** samme informasjon på alle tre flater —
web, mobil og PDF. En fiks som lander på én flate er ikke levert.

**2. «Gjelder hele byggeplassen» som handling i `LokasjonVelger`.** Én affordance ved siden av
pin-setting. **Aldri en obligatorisk bekreftelse** — dobbel sikring er forbudt (effektivitets-
gaten). Mikrotekst etter [tooltip-hjelpetekst-veileder § 3](../claude/retningslinjer/tooltip-hjelpetekst-veileder.md).

**3. Auto-åpning av tegning — kun `status = "draft"`.** Kenneth-vedtak 04.09: et godkjent eller
sendt dokument skal aldri nages om en pin; det er ferdig.
Betingelsen er: `showLocation` er på **OG** `lokasjonOmfang == null` **OG** `status == "draft"`.
🔴 **Auto-åpnet tegning må ha synlig utvei** (avbrytbarhets-regelen), og **å lukke uten å velge
lagrer INGENTING** — lukking er ikke det samme som «byggeplass».

**4. Paritetsfiks: oppgavesiden mangler `showLocation`-gaten.**
Målt av fabel og verifisert av cowork 04.09: sjekkliste-detalj gater på
`showLocation !== false` (`dashbord/[prosjektId]/sjekklister/[sjekklisteId]/page.tsx:873-874`).
**Oppgavesiden rendrer `LokasjonVelger` ubetinget** — null treff på `showLocation` i hele
oppgave-flaten. Det er et hull, ikke en modellbeslutning. Gi den samme gate.

**5. L9 — sticky tegning i repeater-feltpin.** Åpner brukeren feltpin-velgeren i en rad uten
tegning, forhåndsvelges sist brukte tegning. **Kun TEGNINGEN — aldri pin/koordinater**, samme
prinsipp som tegningsarven fra kontrollpunkt (`b987d793`): en arvet pin ville påstått en
plassering ingen har satt.

Kildeprioritet (fabels innstilling — **verifiser mot koden**):
1. Forrige repeater-rads tegning i samme dokument
2. Ellers dokumentets dokumentlokasjon-tegning
3. Ellers ingen default

🔴 **Aldri på tvers av dokumenter** — en «sist brukt» fra et annet dokument kan peke på feil
byggeplass.

## 🔴 L9 rører en mekanisme Kenneth FREDET 28.08 — les dette før du bygger

Kenneth 2026-08-28, om repeater-lokasjon:

> *«Ikke rør den. Lokasjon sammen med repeater fungerer perfekt i dag. Uansett hva målingen sier
> om mekanismen bak (kobling eller sesjonstilstand), skal dagens oppførsel bevares.»*

**Coworks måling 04.09:** dagens «rad 2 lander på samme tegning som rad 1» kommer fra
`aktivTegning` i `ByggeplassKontekst` (`byggeplass-kontekst.tsx:83`). Den leses **kun av
tegningssiden** (`tegninger/page.tsx`), ikke av repeater-feltet. `TegningPosisjonObjekt`
navigerer til tegningssiden, og uten tegning på raden sendes ingen parameter — så siden bruker
sist aktive tegning **fra sesjonen**. Altså: dagens oppførsel ER på tvers av dokumenter.

**Kenneths nyere bestilling (04.09) overstyrer fredningen** — han ber selv om sticky tegning, og
fabels presisering retter en reell svakhet. Men:

🔴 **Dagens oppførsel skal bevares som ATFERD selv om mekanismen endres.** Rad 2 skal fortsatt
lande på rad 1s tegning. Det som endres er at kilden blir dokument-avgrenset og forutsigbar i
stedet for sesjonstilstand.

🔴 **Akseptkrav:** du skal kunne vise at repeater-flyten er uendret. Regresjonstestene finnes:
`rad-oppgave-lokasjon.test.tsx`, `rad-oppgave-lokasjon-glue.test.tsx`,
`repeater-rad-oppgave.test.tsx`. Alle grønne, og **si i rapporten hvilke av disse filene du har
rørt** — rører du ingen, si det:

```
RepeaterObjekt.tsx · TegningPosisjonObjekt.tsx · byggeplass-kontekst.tsx
tegninger/page.tsx · sjekklister/[sjekklisteId]/page.tsx
```

**L7 står uendret:** ingen AUTO-ÅPNING av tom repeater-lokasjon. L9 er en default *inne i*
velgeren brukeren selv åpnet. Kenneths premiss — *«er det sjekklisten eller et repeaterfelt jeg
markerer?»* — er ikke rørt.

## Begrepsrydding — fire ting, fire navn (bruk disse heretter)

Lukker masterplan-restansen «tre ting heter lokasjon»:

| Kode | Begrep |
|---|---|
| `Checklist/Task.drawingId/positionX/Y` + `lokasjonOmfang` | **dokumentlokasjon** |
| `location`-rapportobjekt (fritekst) | **lokasjonstekst** |
| `drawing_position`-rapportobjekt (per felt) | **feltpin** |
| `ReportTemplate.showLocation` | **lokasjonsbryter** |

**Ingen nye felt får hete «lokasjon»** uten ett av disse.

## Klikk-budsjett (DoD — rapportér FAKTISKE tall)

- Sette «gjelder hele byggeplassen»: **≤ 2 interaksjoner**
- Feltpin på rad 2..n med samme tegning som forrige: **1 interaksjon spart per rad** (før/etter)

## Verifisering (DoD)

1. Rad 2 uten tegning → velger åpner med forrige rads tegning forhåndsvalgt, **ingen pin**
2. Rad 1 i dokument med dokumentlokasjon-tegning → den forhåndsvelges
3. Rad 1 i dokument uten tegning → ingen default (som i dag)
4. Bruker bytter tegning på rad 2 → rad 3 forhåndsvelger den NYE
5. Dokument med `lokasjonOmfang="byggeplass"` → **PDF og web sier «Gjelder hele byggeplassen»**, ikke «Ikke utfylt»
6. Godkjent dokument uten lokasjon → **ingen auto-åpning**
7. Oppgavemal med `showLocation=false` → LokasjonVelger vises ikke (paritetsfiksen)
8. Regresjon: de tre repeater-testene grønne

## Mål premisset selv

Alt over er gatet mot kode av cowork 04.09, men **din ordre er input, ikke fasit.** Særlig krav 5:
kildeprioriteten er fabels innstilling, ikke en måling. Avviker koden — **SI DET, ikke gjett.**

Sjekk treets alder først: `git log --oneline -1` skal vise `origin/develop`-tippen eller nyere.

## Gate før push

```sh
cd ~/Documents/Programmering/SiteDoc-dokgen && pnpm install && \
for p in db db-timer db-maskin db-varelager; do pnpm --filter @sitedoc/$p exec prisma generate; done && \
pnpm --filter @sitedoc/web build && pnpm --filter @sitedoc/mobile typecheck && \
cd apps/mobile && pnpm lint
```

Push egen branch — **aldri `develop`**. Meld hash.

🔴 **Leveringsvei:** web + server-rendret PDF → prod-deploy, ikke `eas update`. Mobil-delen av
paritetskravet når derimot brukeren via OTA.
