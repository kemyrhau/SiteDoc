# KS: HMS-terminologi polsk / litauisk / albansk — standardopsjoner

**Fra:** fabel · 2026-09-02
**Omfang:** de 18 `standardopsjon.*`-nøklene (RUH-observasjonstyper, alvorlighetsgrad, trafikklys/beslutning, status) i `packages/shared/src/i18n/{pl,lt,sq}.json`, linje 2070–2087 i alle tre filer.
**Metode:** hver term vurdert mot etablert fagspråk i landets HMS-regime (polsk BHP, litauisk DSS/VDI, albansk SSHP, lov 10237/2010), med anleggsplass-kontekst — dette er meldeflaten for farlige forhold, termene må være dem en fagarbeider kjenner fra eget lands vernearbeid.

## Hovedkonklusjon

Polsk er godt — den kanoniske BHP-termen for nestenulykke («Zdarzenie potencjalnie wypadkowe») er allerede på plass. **Litauisk og albansk har begge ødelagt nestenulykke-term** — selve kjernebegrepet i RUH-flaten:

- lt `Netoliese` betyr «i nærheten» (stedsadverb). Meningsløst som hendelseskategori.
- sq `Gati miss` er halvoversatt engelsk («nesten miss»). Ikke albansk.

I tillegg: lt `Atidaryti` er verbet «å åpne», ikke statusen «Åpent», og begge språk + polsk har «ikke behandlet» oversatt i feil register («uprosessert», som om det var data/matvarer, ikke en sak).

## Rettelser — SKAL (blokkerende for pilot)

| Nøkkel | Språk | I dag | Rett til | Hvorfor |
|---|---|---|---|---|
| `standardopsjon.nestenulykke` | lt | Netoliese | **Vos neįvykęs nelaimingas atsitikimas** | «Netoliese» = «i nærheten». Anbefalt term er den beskrivende standardfrasen («ulykke som så vidt ikke skjedde»); DSS-lovens kortform «riktas» finnes, men er mindre kjent blant fagarbeidere og bør ev. stå i parentes i hjelpetekst, ikke som label. |
| `standardopsjon.nestenulykke` | sq | Gati miss | **Incident pa pasoja** | «Gati miss» er ikke albansk. «Incident pa pasoja» (hendelse uten konsekvenser) er begripelig og brukt i SSHP-sammenheng; alternativ «Aksident i shmangur». |
| `standardopsjon.apent` | lt | Atidaryti | **Atvira** | «Atidaryti» er infinitiv «å åpne» (knappetekst), ikke sakstatus. «Atvira» matcher settet Uždaryta/Patvirtinta/Atmesta. |
| `standardopsjon.ikkeBehandlet` | lt | Neapdorotas | **Nenagrinėta** | «Neapdorotas» = uprosessert (data/råvarer) + feil genus mot resten av settet. «Nenagrinėta» = ikke behandlet (sak). |
| `standardopsjon.ikkeBehandlet` | sq | I pa përpunuar | **E patrajtuar** | Samme registerfeil («ubearbeidet»), i tillegg feilstavet (skal være ett ord). «E patrajtuar» = ikke behandlet. |
| `standardopsjon.ikkeBehandlet` | pl | Nieprzetworzone | **Nierozpatrzone** | «Nieprzetworzone» = uprosessert (data/mat). «Nierozpatrzone» = ikke behandlet (sak/søknad). |
| `standardopsjon.hoy` | sq | Lartë | **E lartë** | Manglende adjektivartikkel — bryter med «E ulët» / «E mesme» i samme liste. |

## Rettelser — BØR (konsistens og presisjon, ufarlige å ta samtidig)

| Nøkkel | Språk | I dag | Rett til | Hvorfor |
|---|---|---|---|---|
| `standardopsjon.godkjent` | pl | Zatwierdzony | Zatwierdzone | Genuskonsistens: statusene viser til «zgłoszenie» (intetkjønn) — «Częściowo zatwierdzone», «Otwarte», «Zamknięte» er alt intetkjønn. |
| `standardopsjon.avvist` | pl | Odrzucony | Odrzucone | Samme. |
| `standardopsjon.forbedringsforslag` | pl | Sugestia ulepszenia | Propozycja usprawnienia | «Sugestia ulepszenia» er dagligtale; «propozycja usprawnienia» er termen fra forbedringsarbeid/BHP. |
| `standardopsjon.farligForhold` | lt | Pavojinga būklė | Pavojingos sąlygos | «Būklė» = tilstand (typisk helsetilstand). «Pavojingos sąlygos» = farlige forhold på arbeidsplassen. |
| `standardopsjon.risikoobservasjon` | lt | Rizikos stebėjimas | Rizikos pastebėjimas | «Stebėjimas» = overvåking (aktivitet); «pastebėjimas» = en observasjon (enkelttilfelle) — det som meldes. |
| `standardopsjon.delvisGodkjent` | lt | Patvirtinta iš dalies | Iš dalies patvirtinta | Naturlig ordstilling. |
| `standardopsjon.avvik` | sq | Moskonformiteti | Moskonformitet | Bestemt form («avviket») som listeverdi; skal være ubestemt. |
| `standardopsjon.risikoobservasjon` | sq | Vëzhgimi i rrezikut | Vëzhgim rreziku | Samme — bestemt form. |
| `standardopsjon.underBehandling` | sq | Në vazhdim | Në shqyrtim | «Në vazhdim» = «pågående» (generelt); «Në shqyrtim» = under behandling/vurdering av en sak. |

## Vurdert OK (ingen endring)

- **pl:** Zdarzenie potencjalnie wypadkowe (kanonisk BHP-term for nestenulykke), Niebezpieczny stan, Obserwacja ryzyka, Niezgodność (ISO-term for avvik), Uwaga, Nie dotyczy, Niski/Średni/Wysoki/Krytyczny (konsistent mot «poziom»), Otwarte, W toku, Zamknięte, Częściowo zatwierdzone.
- **lt:** Žemas/Vidutinis/Aukštas/Kritinis (konsistent mot «lygis»), Tobulinimo pasiūlymas, Patvirtinta, Pastaba, Neatitikimas, Neaktualu, Atmesta, Vykdoma, Uždaryta.
- **sq:** E ulët/E mesme/Kritike, Gjendje e rrezikshme, Sugjerim për përmirësim, Miratuar, Vërejtje, Jo relevante, Miratuar pjesërisht, Refuzuar, Hapur, Mbyllur.

## Implementasjon

Ren streng-erstatting i tre filer, ingen kodeendring:

```jsonc
// pl.json
"standardopsjon.godkjent": "Zatwierdzone",
"standardopsjon.avvist": "Odrzucone",
"standardopsjon.ikkeBehandlet": "Nierozpatrzone",
"standardopsjon.forbedringsforslag": "Propozycja usprawnienia",

// lt.json
"standardopsjon.nestenulykke": "Vos neįvykęs nelaimingas atsitikimas",
"standardopsjon.farligForhold": "Pavojingos sąlygos",
"standardopsjon.risikoobservasjon": "Rizikos pastebėjimas",
"standardopsjon.delvisGodkjent": "Iš dalies patvirtinta",
"standardopsjon.ikkeBehandlet": "Nenagrinėta",
"standardopsjon.apent": "Atvira",

// sq.json
"standardopsjon.nestenulykke": "Incident pa pasoja",
"standardopsjon.hoy": "E lartë",
"standardopsjon.avvik": "Moskonformitet",
"standardopsjon.risikoobservasjon": "Vëzhgim rreziku",
"standardopsjon.ikkeBehandlet": "E patrajtuar",
"standardopsjon.underBehandling": "Në shqyrtim",
```

**Merk for cowork:** disse strengene inngår i alias-tabellen fra ordren om standardlabels — når kildestrengen i {pl,lt,sq}.json endres, må gjenkjenningstabellen oppdateres tilsvarende (én oppføring per streng). Verifiser at lesevisning av allerede lagrede verdier fortsatt treffer.

**Forbehold:** KS-en er gjort av Claude med HMS-/anleggskontekst, ikke av morsmålsbruker. lt «Vos neįvykęs nelaimingas atsitikimas» er lang (35 tegn) — sjekk at den ikke knekker mobile valglister; kortform «Riktas» er fallback hvis layout krever det. sq-termene for nestenulykke er minst standardiserte av de tre språkene; om piloten får albansktalende brukere, be én av dem bekrefte «Incident pa pasoja» i første uke.

## Rotårsak (til generate.ts)

Feilene oppsto fordi `generate.ts` sender løsrevne strenger til maskinoversettelse uten domenekontekst. Anbefaling til develop-løpet: gi oversettelsesjobben en kontekststreng per nøkkelprefiks (f.eks. `standardopsjon.*` → «norsk HMS-/anleggsterminologi, verdier i valglister»), så treffer også fremtidige nøkler. Egen ordre kan formuleres ved behov.
