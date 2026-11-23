# Utils — Delte verktøyfunksjoner (cross-platform)

## Oversikt

5 filer med verktøyfunksjoner brukt av web, mobil og API. Eksporteres via `index.ts`.

## Funksjoner

### `generateProjectNumber(sequentialNumber)` → `string`

Format: `SD-YYYYMMDD-XXXX`. Brukes ved prosjektopprettelse. 4-sifret padded løpenummer.

### `isValidStatusTransition(current, next)` → `boolean`

Tilstandsmaskin for dokumentstatus. Brukes på server (API-validering) og klient (knapp-visning).

```
draft → sent → received → responded → approved   (Godkjent = stoppsted i FLYTEN)
                                       approved → draft (Gjenåpne — Reg + P-adm)
                                       approved → closed (Lukk — KUN admin)
received → dismissed (Avvis, begrunnelse påkrevd) · received → draft (Trekk tilbake, F2)
             dismissed → draft (Gjenåpne) · dismissed → closed (Lukk — KUN admin)
closed → draft (Gjenåpne) · closed → deleted (Slett, via slettevakt)
```

**H6-REVISJON — «Lukk» som slette-port (Kenneth-vedtak 2026-08-21, fabel-svar):** H6s opprinnelige
«Godkjent lukkes ALDRI» gjaldt Lukk som en KONKURRERENDE terminal ved siden av Godkjent. Med Lukk
gjeninnført som *administrativ exit + eneste port til sletting* er dette ikke lenger en konflikt:
Godkjent er fortsatt stoppsted i FLYTEN (ingen får ballen videre), mens Lukk tar dokumentet UT av
flyten til `closed`. Sletting krever `draft` ELLER `closed` (slettevakt) — alt annet må Lukkes først.
- **Lukk** (`approved→closed`, `dismissed→closed`): **KUN admin** (sitedoc_admin + prosjektadmin).
  I klienten gatet av `posisjonHandlingTillatt` (`closed`→`false`); admin får den via `erAdmin`-
  snarveien i `hentPosisjonFiltrertHandlinger`. Server-gaten er `verifiserRetningsrett` (admin-bypass
  :836/:848), IKKE `ROLLE_HANDLINGER_DEFAULTS`.
- **Gjenåpne** (`approved/dismissed/closed→draft`): registrator + prosjektadmin (uendret F4/H6).
- **Slett** (`closed→deleted`): via slett-mutasjonens `verifiserDokumentTilgang` (tilgang-haver),
  ikke handlingsmenyen (`deleted`→`false` i posisjon-path).
- `cancelled` er retirert (0 prod-rader, målt): `hentStatusHandlinger("cancelled")` → `[]`,
  rolle-raden fjernet, `draft→cancelled` ute av statusmaskinen.
Nye mikrotekst-nøkler: ingen (`handling.lukk`/`handling.slett`/`flythjelp.handling.lukk` fantes;
sistnevntes tekst omskrevet til ny semantikk + regenerert for 13 språk).

**Gjenåpne-vedtak (Kenneth 2026-09-26) — begrunnelse ved gjenåpning:** Gjenåpning
(`approved/closed/dismissed → draft`) KREVER en ikke-tom begrunnelse — den endrer et ferdig
kvalitetsdokument, og arkivet skal bære HVORFOR. **Trekk tilbake** (`received → draft`) krever den
IKKE — det angrer din egen usendte ball, ingen mottaker finnes å forklare noe til. Begge har
`nyStatus="draft"`, så `statusKreverBegrunnelse(nyStatus, fraStatus?)` tok en ny valgfri `fraStatus`
for å skille dem. Uten `fraStatus` faller draft tilbake til «ikke påkrevd» (bakoverkompat med
enkelt-arg-kallere). HMS-gjenåpne (`hmsGjenapne`, ruter til `responded`)
guardes med samme delte regel via kanonisk form `statusKreverBegrunnelse("draft", fraStatus)`.
`hmsLukk` forblir valgfri — administrativ exit, ikke tilbakesending.

**F3 Merge «Under arbeid»:** `rejected` er merget inn i `in_progress` — Send tilbake
(responded→in_progress) ruter direkte til Under arbeid, ingen Gjenoppta. `rejected`-rader
migreres til `in_progress` (`20260725130000_merge_underarbeid_rejected`).

**F5 Send/Videresend-paring (beslutning 6):** Send (`handling.send`→`sent`, fram i flyten)
aktiveres overalt der Videresend finnes — `received→sent`, `responded→sent` (for-staget i F3),
`approved→sent`. Rett: received→sent = utfører + P-adm; responded/approved→sent = godkjenner + P-adm.
Ren kode, ingen migrering, ingen ny mikrotekst-nøkkel (`flythjelp.handling.send` gjenbrukt).

### `hentStatusHandlinger(status)` → `StatusHandling[]`

**Fil:** `statusHandlinger.ts` — Mapper status til handlingsknapper for mobil-UI.

```typescript
interface StatusHandling {
  tekst: string           // Knappetekst (norsk)
  nyStatus: DocumentStatus
  farge: string           // Inaktiv Tailwind-farge
  aktivFarge: string      // Aktiv/trykket farge
}
```

Returnerer tom array for `cancelled` (retirert). **H6-revisjon (2026-08-21):** `closed` er IKKE lenger tomt — det gir Gjenåpne (→draft) + Slett (→deleted); `approved`/`dismissed` gir Gjenåpne + Lukk (→closed, kun admin i klienten). `responded` gir Godkjenn + Send tilbake (→ in_progress) + Videresend. **§8A-fiks (2026-07-29):** F5s «Send fram» (`received`/`responded`/`approved` → `sent`) er fjernet — den var en recipient-løs no-op (server auto-konverterte `sent→received` og nullstilte recipient). Framover fra `received` = Besvar/Godkjenn. `draft→sent` (førstegangs-send) og `in_progress→sent` (Send på nytt) er urørt.

### Georeferanse (`georeferanse.ts`)

Similaritetstransformasjon for tegning ↔ GPS-konvertering. 4 funksjoner:

| Funksjon | Input | Output | Beskrivelse |
|----------|-------|--------|-------------|
| `beregnTransformasjon(ref)` | 2 referansepunkter | `Transformasjon` | Beregner transformasjonsmatrise |
| `gpsTilTegning(gps, t)` | GPS + matrise | `{x, y}` (0-100) | GPS → tegningsposisjon (clampet) |
| `tegningTilGps(pixel, t)` | Posisjon + matrise | `{lat, lng}` | Tegning → GPS (ikke clampet) |
| `erInnenforTegning(gps, t, margin?)` | GPS + matrise + margin(10%) | `boolean` | Er GPS innenfor tegningen? |

**Matematikk:** 2D similaritetstransformasjon (skalering + rotasjon + translasjon). `cosLat` kompenserer for lengdegradskompresjon ved høye breddegrader (viktig for Norge, 58°–71°N).

**Feil-håndtering:** Kaster error ved identiske referansepunkter (`denom === 0`) eller degenerert matrise.

### `vaerkodeTilTekst(code)` → `string`

**Fil:** `vaer.ts` — WMO Code Table 4677 → norsk tekst. 28 koder (0–99). Returnerer "Ukjent" for ukjente koder. Brukes i vær-rendering (web + mobil).

### `beregnSynligeMapper(mapper, bruker)` → `SynligeMapperResultat`

**Fil:** `mappeTilgang.ts` — Beregner synlige mapper med arv-logikk.

```typescript
// Input
interface BrukerTilgangInfo {
  userId: string
  erAdmin: boolean
  entrepriseIder: string[]
  gruppeIder: string[]
}

// Output
interface SynligeMapperResultat {
  synlige: Set<string>  // Mapper med full tilgang
  kunSti: Set<string>   // Mapper synlige kun som sti til barn (grå, lås-ikon)
}
```

**Algoritme:**
1. Admin → alle synlige
2. `custom`-modus → sjekk entreprise/gruppe/bruker-match i `accessEntries`
3. `inherit`-modus → rekursivt oppover til `custom` eller rot
4. Rot med `inherit` = åpen for alle
5. Forelder-mapper til synlige barn → `kunSti` (trestruktur bevares)

**Cache:** `tilgangCache` Map forhindrer gjentatt rekursjon. Sirkulær-referanse håndtert med tidlig `false`-markør.

### Append-only felt-låsing (`feltLaasing.ts`) — KUN oppgave

Delt kilde for append-only-låsing i **oppgave**-hookene (web + mobil). **Sjekkliste bruker den IKKE** (vedtatt 2026-07-16): spec `dokumentflyt.md § 2` sier oppgave = append-only fra opprettelse, sjekkliste = redigerbar for den som har ballen + admin/registrator. `04f6d295` slo på låsen for alle fire hooks; feil for sjekkliste (låste innsendte felt permanent, også for admin) → fjernet fra sjekkliste-hookene.

| Funksjon | Input | Output | Beskrivelse |
|----------|-------|--------|-------------|
| `harFeltVerdi(verdi)` | `unknown` | `boolean` | Har feltet en reell (ikke-tom) verdi? Tom streng/null/tom array → false |
| `beregnLaasteFelter(serverData)` | `Task.data` | `Set<string>` | Objekt-IDer med server-bekreftet verdi → låst |

**Kritisk (mobil):** kall `beregnLaasteFelter` med SERVER-data, aldri lokal usynket SQLite — ellers låses egen offline-kladd. Klient-lås; server håndhever ikke append-only. Se `apps/mobile/src/hooks/CLAUDE.md`.

### Kollisjons-reset (`kollisjonReset.ts`) — alle fire hooks

Delt avgjørelse for hva et felt skal VISE etter en feltvis kollisjon (web + mobil, sjekkliste + oppgave). Feltvis kollisjons-deteksjon (`ae7725f9`) skrev server-vinneren tilbake i feltet **ubetinget** — skrev brukeren videre mens lagringen var i luften, forsvant tegnene under fingrene (Kenneths `BHO-004`-observasjon 08.09; cowork målte at det var denne resetten, ikke `beregnLaasteFelter`).

| Funksjon | Input | Output | Beskrivelse |
|----------|-------|--------|-------------|
| `verdiErLik(a, b)` | `unknown, unknown` | `boolean` | JSON-sammenligning (arrays/objekter/primitiver, `null`≡`undefined`) — samme «endret?»-begrep som mobilens dirty-diff |
| `løsKollisjonsVerdi({naavaerende, sendt, server})` | verdier | `{verdi, reDirty}` | Re-dirty (`naavaerende` ≠ `sendt`) → behold brukerens tekst; ellers server-vinneren |

**Avgjørelse (Kenneth-linje «ingenting forsvinner»):** re-dirty tekst står — neste lagring gir en ny kollisjon som håndteres normalt, og den tapende verdien er alt bevart som tilføyelse server-side. Re-dirty måles på VERDI-diff (ikke web-only `endredeRef`), så web og mobil har ETT signal og ikke divergerer. **Funksjonen avgjør KUN verdien** — `basisRef` avanseres ALLTID til server-verdien av hver hook (basis = det serveren har, ellers tapes neste kollisjon). Basis-representasjonen er rå verdi (web) / FeltVerdi-objekt (mobil), så den biten bor i hooken.

### Signaturfelt (`signaturVerdi.ts`)

Én delt kilde for lesning + visning av `signature`-feltverdier (web + mobil). Fabel-vedtak
2026-09-05: signaturen bærer nå navn + tidspunkt, ikke bare bildet.

| Funksjon | Input | Output | Beskrivelse |
|----------|-------|--------|-------------|
| `lesSignaturVerdi(verdi)` | `unknown` | `SignaturVerdi \| null` | Bakoverkompat: legacy rå data-URL-**streng** → `{dataUrl, alt null}`; nytt **objekt** → validert. Tomt/ugyldig → `null` |
| `formaterSignaturLinje(sig)` | `SignaturVerdi` | `string \| null` | «navn ?? Ukjent · dd.mm.åååå kl. hh:mm». `null` for legacy (streng uten tidspunkt) → ingen linje |
| `signaturTidspunktNaa(dato?)` | `Date` | `string` | Lokal ISO-8601 med offset — brukes ved signering så veggklokken vises likt på tvers av flater/tidssoner |

**KRAV (fabel):** tre flater skal ikke hver for seg avgjøre streng-vs-objekt. Web + mobil
importerer herfra. **PDF speiler logikken lokalt** (`packages/pdf/src/hjelpere.ts` →
`lesSignaturVerdiPdf`/`formaterSignaturLinjePdf`) fordi `packages/pdf` er null-avhengigheter
(felt.ts:90) — endres denne, endres speilet.

### Opsjon-normalisering (`opsjon.ts`)

`normaliserOpsjon(opsjon)` → `{ value, label }`. Delt kilde for valg-opsjoner
(`list_single`/`list_multi`/trafikklys `config.options`) og grense-resolverens
variant-matching. Godtar strenger (`"Ja"`) og objekter (`{value, label}`); gir alltid
`{ value, label }` slik at flatene og resolveren har ETT sannhetsbegrep om en opsjon.

Trukket hit 2026-09-06 fra fire uavhengige kopier (web `rapportobjekter/typer.ts`, de to
mobil-komponentene `EnkeltvalgObjekt`/`FlervalgObjekt`, PDF `hjelpere.ts`). Web + mobil
importerer herfra. **PDF speiler logikken lokalt** (`packages/pdf/src/hjelpere.ts`) fordi
`packages/pdf` er null-avhengigheter — voktet av paritetstest
(`apps/web/src/__tests__/pdf-shared-tvilling-paritet.test.ts`). Endres denne, endres speilet.

### Dokumentnummer (`dokumentnummer.ts`)

`formaterNummer(prefix, nummer, format?)` → `string | null`. **Én kilde for visning av et
dokumentnummer på tvers av flater** — ikke ett utseende, men ÉN funksjon med parametre. `null`
når `nummer == null` (men `0` slipper gjennom med vilje — «SJA0»/«SJA-000» er gyldig).

`DokumentnummerFormat`: `separator` (default `""`), `pad` (padStart-bredde, default `0`),
`visPrefiks` (default `true`; `false` = alltid bart nummer), `manglerPrefiks` (`"null"` default /
`"nummer"` — hva når prefiks er tomt men skal vises). De tre tilsiktede formene:

| Flate | format | Resultat |
|-------|--------|----------|
| Mobil kompakt (default, uten 3. arg) | `{}` | `SJA12`, `null` uten prefiks |
| Web-detaljhode/skriv-ut/papirkurv/MalBygger | `{separator:"-", pad:3, manglerPrefiks:"nummer"}` | `SJA-012` / `012` |
| Web-listekolonne (prefiks er egen kolonne) | `{pad:3, visPrefiks:false}` | `012`, kall `?? "—"` |

Samlet 2026-09-08 fra fire uavhengige kopier (mobil-liste, web-full-form ×5, web-listekolonne ×3,
papirkurv). **Papirkurv var drift** — sto upadda «SJA-12», eneste full-form uten pad; rettet til
«SJA-012». Mobil re-eksporterer fra `DokumentRadHjelpere.tsx` (søke-uthevingen `MedUtheving` blir i
mobil — react-native `Text`). 🔴 `packages/pdf` har en **tvungen** tvilling (`hjelpere.ts:formaterNummer`,
arg-rekkefølge `(nummer, prefix)`) fordi pakken er null-runtime-avhengigheter — endres logikken her,
må speilet følge. Alt voktet av test (`dokumentnummer.test.ts`, per form + 0-regelen).

### Betinget synlighet (`betingelse.ts`)

To lag: `erBetingelseOppfylt` svarer på **verdimatchen** alene (matcher forelderens svar
barnets utløsersett — per barn: barnets `conditionOwnValues` vinner, ellers arves forelderens
`conditionValues`). `erObjektSynlig(objekt, alleObjekter, hentVerdi)` er lagt **OVER** den og
svarer på **hele** synlighetsspørsmålet.

| Funksjon | Beskrivelse |
|----------|-------------|
| `erBetingelseOppfylt(forelder, barn, forelderVerdi)` → `boolean` | Verdimatch. Barnets eget sett vinner, ellers arves forelderens. Rå `includes` (streng = enkeltvalg, array = flervalg) |
| `harEgetUtloserSett(barn)` → `boolean` | Har barnet ≥1 verdi i `conditionOwnValues`? Tomt/fravær → arver forelderen |
| `erObjektSynlig(objekt, alleObjekter, hentVerdi)` → `boolean` | **Hele vurderingen i én kilde:** rekursjon oppover (barn av skjult forelder er skjult, maks 10 nivåer), `conditionActive`-av, repeater-unntak, `utenfor_krav`-avviksregel, og til slutt verdimatchen via `erBetingelseOppfylt`. `hentVerdi(id)` gir feltets svar direkte (ikke FeltVerdi-objekt) |
| `settForelderBetingelseVerdier(objekter, parentId, verdier)` → `T[]` | Malbygger-transform: setter KUN forelderens `conditionValues`, rører ikke barnas sett |

**Én kilde de fem kaller:** de fire synlighets-hookene (web+mobil × sjekkliste+oppgave)
kaller `erObjektSynlig` — hookens `sjekkSynlighet`-blokk (som lå firedoblet og identisk) er
borte. Rapport-byggeren (dokgen) kaller den samme, så skjerm og rapport per definisjon ikke kan
være uenige om hva som var synlig. Fasit er sannhetstabellen i `betingelse.test.ts` (generert
fra koden: tre med forelder, to søsken der ett har eget sett og ett arver, og et barnebarn).
`SynlighetsObjekt` er en strukturell type (løsere enn appenes `RapportObjekt`) så `@sitedoc/shared`
slipper å avhenge av dem.

### Grense + resolver (`grenseSjekk.ts`)

Grenseverdier for `integer`/`decimal` — delt kilde for MalBygger-editor, utfyllings-rendering
(web + mobil) og PDF-oppslagsbyggeren.

| Funksjon | Beskrivelse |
|----------|-------------|
| `normaliserGrense(config)` → `Grense` | Norsk kanonisk (`min/maks/toleranse/desimaler/enhet`), engelsk (`max/unit/decimals`) som fallback |
| `harGrense` / `grenseStatus` / `formaterGrense` | Aktiv grense? · status mot verdi (`under/over/utenfor_toleranse/ok`) · språknøytral etikett (`≥/≤/±/–`) |
| `lesKravType(config)` → `KravType \| null` | Eksplisitt `config.kravType` (`minst/hoyst/mellom/toleranse`) vinner; ellers UTLEDES fra satte felter (bakoverkompat, ingen backfill). Utledning kan ikke skille «Minst 30» fra «glemte maks» → MalByggeren skriver den eksplisitt (trinn 2) |
| `beregnAvvik(verdi, grense)` → `{avvik, retning} \| null` | Målt avvik ved brudd (trinn 3 del C): tallet (verdi − grensen den brøt, rundet til desimaler) + retning (`under/over/utenfor_toleranse`). `null` innenfor/tom |
| `byggAvvikLinje(t, verdi, grense)` → `string \| null` | Utfyllings-linje «Avvik: 4 mm over krav — beregnet, kan ikke endres» (web+mobil Heltall/Desimal). Tar `t`-callback (pakken er i18n-fri). PDF bygger sin egen norske variant i `grenseSnapshot.avvikTekst` |
| `utenforKravOppfylt(forelder, forelderVerdi, hentVerdi)` → `boolean` | Avviksfelt-utløser (trinn 3 del C): true når tallfelt-forelderens verdi bryter kravet. Delt av alle fire synlighets-hooks (web+mobil × sjekkliste+oppgave). `hentVerdi` gir styrende felts verdi (Vei B) i samme scope |
| `byggKravHerkomst(t, objekt, forelderVerdi, styrende)` → `string \| null` | Utfyllings-linje som sier HVOR et betinget krav kom fra: «Krav ≥ 25 mm — følger av Materialstatus: Delvis sortert.» `null` når standardkravet gjelder (ingen variant traff) eller styrende felt er navnløst. Delt av web + mobil Heltall/Desimal (`styrendeFelt`-prop). Tar `t`-callback |
| `løsGrense(objekt, forelderVerdi)` → `Grense` | **Vei B-resolver — eneste inngang** for utfylling (web+mobil), PDF-oppslag (trinn 3 del A: `services/arkiv/grensesnapshot.ts`) og server-frys ved lagring (trinn 3 del B: `services/grenseLagring.ts`). Tar **verdien** til styrende felt, ikke konteksten (kallstedet henter fra `rad.felter[styrendeId].verdi` i repeater / `hentFeltVerdi(styrendeId).verdi` på rot). Uten `styrendeFeltId`/`grenseVarianter` → standardgrense (identisk med `normaliserGrense`, bakoverkompat). Med varianter: matcher styrende verdi mot varianttabellen (`normaliserOpsjon` på begge sider), overstyrer TALLENE; tom celle arver standard; `enhet`/`desimaler` alltid felles. Ingen treff → standard (aldri stille sletting; foreldreløse varianter vises i MalBygger, trinn 2) |

Grensene BLOKKERER aldri innsending — et avvik er et gyldig funn.

### Stedsmodell (`sted.ts`) — LAG 1-A (2026-10-02)

Én kilde for «hvor er jeg, og hvor langt er det dit» — erstatter to haversine-kopier
(`apps/mobile/src/utils/geo.ts` slettet, `dagsforslag.ts`-kopien slettet) og to speilede
GPS-gjenkjennings-funksjoner. Rene funksjoner, ingen DB/RN/Node. Kontrakt A1–A6 i
`docs/claude/timer-gps-lag1-spec.md § 2`.

| # | Funksjon | Beskrivelse |
|---|----------|-------------|
| A1 | `avstandM(a, b)` → `number` | Haversine i hele meter. Eneste avstands-def. (`georeferanse.avstandMeter` er en EGEN ekvirektangulær for tegning — rør den ikke) |
| A2 | `gjenkjennSted<T extends Geofence>(pos, kandidater)` → `Treff<T> \| null` | Nærmeste der `avstandM ≤ radiusM`. `pos==null`→`null`. Kaller filtrerer bort ukomplette geofencer |
| A3/A4 | `tolkStart` / `tolkSlutt(pos, oppmøtesteder, byggeplasser)` → `TolketSted` | Union `kontor`/`byggeplass`/`utenfor`/`ukjent`. Kontor vinner når begge treffer (V15). `pos==null`→`ukjent`, ALDRI `utenfor` (H11) |
| A5 | `velgDestinasjon(args)` → `Destinasjon` | Sluttsted-byggeplass → kontekst → nøyaktig én byggeplass med punkt → ellers `ukjent`. ALDRI primærbyggeplass/nærmeste-uten-grense/`prosjekter[0]` |
| A6 | `GEOFENCE_GRENSER` | De tre radius-spennene (oppmøtested 10–5000, byggeplass-API 1–100000, modal 25–500) + V17-polygon-/trasé-konstanter. API-validatorene (`byggeplass.ts`/`oppmotested.ts`) importerer den — binder, dokumenterer ikke bare. Tall uendret |

🔴 **A5 wires inn i reisekjeden (`beregnDagsforslag`) først i LAG 1-B.** I L1-A bygges/testes den,
og `resolverPrimaerByggeplass` er SLETTET i L1-B (`2e993250`) — A5 erstattet den. GPS-punkt-typen heter `GpsPunkt`
(`Punkt` er opptatt av piksel-{x,y} i `maaling.ts`). Fasit: `sted.test.ts`.

### Oppmøtested med perioder (`oppmote.ts`, POST 2026-11-15 (12))

Delt mellom API, web og mobil (offline). Datoer er ISO `YYYY-MM-DD`-strenger; sammenlign aldri `Date`.

| Funksjon | Beskrivelse |
|----------|-------------|
| `løsOppmote(dato, prosjektId, perioder, gpsStartKontorId)` → `OppmoteResultat` | Bindende rekkefølge: byggeplass-periode på dagens prosjekt → GPS-kontor → midlertidig → fast → `ikkeValgt`. Én test pr. trinn i `oppmote.test.ts` blir rød når trinnet fjernes |
| `finnFastOppmotested(perioder)` | Id-en til det åpne faste stedet, ellers `null` |
| `trengerOppmoteValg(antallAktiveKontorer, perioder)` | `true` når ≥ 2 aktive kontorer og intet fast sted — styrer «Hvor møter du vanligvis?» |
| `finnPeriodeKonflikt(ny, øvrige)` | Overlapp innen samme slag (byggeplass pr. prosjekt, midlertidig, fast). Server og admin-UI bruker samme regel |
| `tilIsoDato(d)` | `Date`/streng → `YYYY-MM-DD` (UTC) |
| `finnOverforinger(dato, perioder)` → `Overforing[]` | Ut-overføring første dag og retur siste dag i en midlertidig eller byggeplass-periode, fra hjemstedet (`løsOppmote` uten perioden; `ikkeValgt` eller samme kontor gir ingenting). Mellomdager gir ingenting. Brukes av mobilens Bekreft dag (L2). Del B: åpen midlertidig kontorperiode tåles (gir ingen retur før `tilDato` settes); periode med `kilde='overforing'` gir aldri «ut» — Tur-raden i reise-kortet opprettet den |
| `periodeDatoFraOverforing(dato, fraTid, retning)` | Kl. 12-regelen (POST (13) del B): Tur før 12:00 → periode fra samme dag, ellers dagen etter; Retur før 12:00 → slutt dagen før, ellers samme dag. Manglende `fraTid` = 00:00. Klienten regner ut datoen, serveren bruker den som gitt |
| `leggTilDager(dato, n)` | `YYYY-MM-DD` ± n dager i UTC (ingen tidssone-drift) |
| `byggOverforingOppslag(args)` → `DagsforslagOverforingOppslag[]` | Slår opp overføringens kontor-/byggeplass-ende, navn og kjøretid (kontor↔kontor eller matrise) for hver dato. Flyttet hit fra mobil `dagsforslag.ts` (som re-eksporterer) i L2 commit 8, så web-`ReiseKort` og mobil deler samme oppslag |
| `erApenOverforing(p)` | Åpen midlertidig kontorperiode med `kilde='overforing'` (del B) |
| `planleggOverforing(perioder, {handling, oppmotestedId, dato, tilDato?, medSluttdato?, periodeId?})` → `OverforingPlan` | Del B: én regel for server, mobil og web — `ingen`/`konflikt`/`lukket`/`slettet`/`opprettet`. Rører kun egen overføring; uten web-feltene (mobilen) bare den åpne, som før O16. `medSluttdato` (web): også egne med sluttdato — lukkes ikke senere enn den slutter, og en egen periode helt etter en ny med `tilDato` står urørt. `periodeId` (web, `slutt`): nettopp den perioden. Åpen admin-midlertidig → `konflikt`. `tilDato` (O16 «Til og med») bare ved `start` |
| `kontorOverforingOppsett(dato, prosjektId, perioder, aktiveKontorIder)` / `kontorOverforingRetning(oppsett, tilId)` | Del B: hva reise-kortet tilbyr (`null` ved < 2 kontorer, byggeplass-periode eller `ikkeValgt`); fast kontor = retur, ellers tur |
| `erEgenOverforing(p)` / `finnEgenOverforing(perioder, dato)` | O16 R1: arbeiderens egen midlertidige periode (`kilde='overforing'`), med eller uten sluttdato; den som dekker datoen, ellers den tidligste senere |
| `overforingKonflikt(perioder, plan)` | O16 R3: perioden en «opprettet»-plan overlapper etter at den egne er lukket/slettet. Server og web bruker samme regel |
| `gjeldendeMidlertidig(dato, perioder)` | O16: midlertidig kontorperiode som gjelder på datoen (samme valg som `løsOppmote` trinn 3) |
| `gjelderFraForslag(valg, dato, startTid)` / `sisteDagForslag(valg, dato, startTid)` / `avsluttSisteDagForslag(dato)` | O16 pkt 2: forslag i web-reisevinduets blå boks. Tur: sedelens dato / dagen før; retur: dagen etter / sedelens dato; tur 3: kl. 12-regelen (R7a). «Avslutt»: dagen før (R7b) |
| `planleggOppmoteBytte(a)` → `OppmoteBytte` | O16: hva kontorvalget i web-reisevinduet gjør — `ingen`/`start`/`slutt`/`admin`, med kallet til `oppmotePeriode.overforing`, «forkortes»/«fjernes», overlapp og ugyldig dato. Mobil bruker den ikke |
| `planleggAvslutt(perioder, sisteDag, periodeId)` → `{ kall, fjernes }` | O17 (vedtak pkt 22): «Avslutt» med «Siste dag» — `kall` er det web sender (`periodeId`, V2), `fjernes` = perioden når planen sier «slettet» (Siste dag før `fraDato`). Teksten og kallet regnes fra samme plan. Fasit: `oppmote-o17.test.ts` |

### Tegning-nedlasting (`tegningNedlasting.ts`, 2026-10-10)

ÉN kilde for filnavn-regelen ved nedlasting av tegninger — brukt av web (enkeltfil,
`download`-attributt) og api (hver zip-oppføring, `routes/tegningNedlasting.ts`).

| Funksjon | Beskrivelse |
|----------|-------------|
| `byggTegningNedlastingsnavn({tegningsnummer, navn, revisjon, fileUrl})` → `string` | `tegningsnummer` (fallback `navn`) + `_rev<REV>` + EKTE endelse fra URL-en (stien er sannhet, ikke `fileType`). Saniterer (beholder bindestrek/punktum/æøå) |
| `unikNedlastingsnavn(ønsket, brukt)` → `string` | Kollisjon → `-2`/`-3` FØR endelsen (muterer `brukt`). Deterministisk, samme konvensjon som `unikArkivSti` i eksport-arkivet |
| `filendelseFraUrl(url)` → `string` | Endelse (med punktum) fra URL/sti, ignorerer query-signatur |

Fasit: `tegningNedlasting.test.ts`.

### Reise-kort (`reiseManuell.ts`) — del B-tillegg

`løsReiseKort`/`løsOverforingKort` tar valgfrie `naar` (`forArbeid`/`etterArbeid`), `startTid` og `sluttTid` (w15b): tidene kan rettes, klassifiseringen står på firmaets kjøretid.

`kontorReiseRute(reiseRegel)` → `{ fraKontorId, tilKontorId } | null` (O17, vedtak pkt 21): kjennetegnet på en reise mellom to kontorer (tur 3) — ruten i `reiseRegel.overforing` med kontor i begge ender, lest defensivt. Ikke `reiseKilde`, som bare er «overforing» over terskel. Web (kortliste, attestering) og api (eksport) bruker den. Mobil bruker den ikke.

**O19 (vedtak pkt 23–25), bare web:** `tillatDeling: { omvendt: "fram" | "bak" }` gjør at en reise over midnatt får `deles` i stedet for sperren `utenforDognet`; «bak» bare når Start er skrevet, «fram» når Slutt er skrevet eller regnet (`krysserMidnatt`). Mobil sender den ikke og sperrer som før. `delVedMidnatt({dato, vei, fraTid, tilTid})` → del 1 (start–24:00) og del 2 (00:00–slutt) med dato, `null` når en del er 0 min. `lesMidnattDel(reiseRegel)` leser paret `{delId, del}`; `midnattPartnerDato(sedelDato, reiseRegel)` gir den andre delens dato (merket «fortsetter»/«fortsatt fra»). `finnReiseSomEnderPaaKontor(ny, dagsrader)` (pkt 25): kontorreisen som overlapper og ender på et kontor. `pauseBeregning` lar del 2 (00:00) og del 1 (–24:00) stå utenfor pausevinduet og «Arbeidstid i dag». Fasit: `reiseManuell-o19.test.ts`.

`medOverforingPeriodeId(spor, periodeId)` setter `reiseRegel.overforing.periodeId` når perioden er kjent ved lagring (ny id ved start, lukket periode ved slutt); `null` → sporet urørt.

### Reisekjede (`reiseKjede.ts`, ordre 2026-11-15 (17))

| Funksjon | Hva |
|----------|-----|
| `sekvenserReisekjede(kort: KjedeKort[])` → `KjedeKort[]` | Legger overføring/reise/arbeid etter hverandre uten overlapp, minutter fra midnatt. Rettet kort (`rettet`, `rettetFra`/`rettetTil`) er fast punkt; beregnede naboer flytter seg. Uten retting står arbeid fast, reisene legges bakover og returen framover. Ingen klemming mot døgnet. Fasit: `reiseKjede.test.ts` |
| `finnOverlappVarsel(rader)` → `OverlappVarsel \| null` (`tidsromValidering.ts`) | Første overlapp mellom rader med begge tider (til > fra), via `finnTidsromKonflikt`. Brukes til varsel i prosjektkortet (mobil + web). Fasit: `tidsromValidering.test.ts` |

### Prosjekt- og byggeplassvelger (`standardByggeplass.ts`, `prosjektByggeplassValg.ts`, ordre 2026-11-15 (18))

- `velgTimerByggeplass({ byggeplassIder, lagret, gpsNaermeste? })` → id | null: forbrukerverdien for mobil Bekreft dag, innsjekk og ny timer-rad. Lagret valg i lista, så GPS, ellers null — aldri «første» (GATE (42) vilkår 2). Ukjent liste (0 ider) gir renset lagret verdi. `velgByggeplassUtenGjett` er samme funksjon.
- `velgFilterByggeplass(...)`: toppfilteret (web + mobil) — ny innsjekk → GPS → sist valgte → null («Velg byggeplass»). Aldri «første».
- `rensLagretByggeplassValg(id)` → id | null: tom verdi og den utgåtte strengen eldre app-versjoner lagret for «hele prosjektet» (før TILLEGG (22), 2026-11-15) leses som intet valg (null). Verdien eksporteres ikke; den finnes kun som lest legacy-data.
- `prosjektByggeplassValg.ts` er ren velgerlogikk for mobil `ProsjektVelger` og web `KontekstChip`:
  - `velgByggeplassKilde`: server eller lokal katalog;
  - `antallByggeplasser`;
  - `vedProsjektTrykk`: markér, eller velg direkte ved 0 byggeplasser;
  - `vedByggeplassTrykk`: prosjekt + byggeplass, lagret på riktig prosjekt-id;
  - `erByggeplassAvhuket`;
  - `oppdaterBygningMap`.
- Tester med negativkontroll ligger i `.test.ts` ved siden av.

### Byggeplass ikke valgt (`byggeplassIkkeValgt.ts`, ORDRE 2026-11-15 (20) + (20b))

- `visByggeplassIkkeValgt({ byggeplassId, antallByggeplasser, kanRedigere })` → `boolean`: linja «Byggeplass ikke valgt · Velg» på web og mobil.
- `byggeplassByttInput(naavaerendeOmfang, nyByggeplassId)`: oppdater-input ved bytte av byggeplass — nullstiller tegning, punkt og område, og omfang `omrade`/`punkt`. Brukt av web-chipen og mobil sjekkliste/oppgave.

## Fallgruver

- `gpsTilTegning` clamper til 0-100 — bruk `erInnenforTegning` for å sjekke gyldighet først
- `tegningTilGps` clamper IKKE — kan returnere ugyldige koordinater
- `beregnSynligeMapper` kjøres klient-side — alle mapper med tilgangsdata MÅ hentes først
- `isValidStatusTransition` brukes på BEGGE sider (server + klient) — hold logikken synkronisert
