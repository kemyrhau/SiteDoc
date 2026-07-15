---
tittel: Dokumentasjons-standard — presens krever referanse
status: STYRENDE
sist_verifisert_mot_kode: 2026-07-09
gjelder: alle filer i docs/claude/
---

# Dokumentasjons-standard

**Kort:** En setning i `docs/claude/` som sier at systemet *gjør* noe, må bære
enten en kode-referanse eller en status-markør. Uten det leses den som fasit —
også når den bare var en intensjon.

## Bakgrunn

`timer.md` beskrev 2026-07-09 fire ting som ikke fantes, med samme sikkerhet som
det som fantes. Ingen var løgn da de ble skrevet — men alle ble lest som fasit,
også av kontroll-laget. Kenneth ser ikke hva øktene skriver og kan ikke lese alt.
Regelen må derfor binde ved **skrivetidspunktet**, ikke ved gjennomlesning.

De fire (se `timer.md` etter retting `c875ee6f`):

| Sted | Påstand | Virkelighet |
|---|---|---|
| `:263` | ③b-fallbacken velger «laveste-rekkefolge ordinær» | Fantes — men i migrering `20260705120000_lonnsart_overtidsnivaa` Steg 2, ikke i `20260605180000` som funn-forfatteren så på. Vag «migreringen» kostet en runde. |
| `:517` | Eksport joiner katalog for lønnsart-kode/navn/pris | Ikke implementert. `timer-rapport-eksport.ts` er en lederrapport (`Ansatt`/`Ansattnr`/`Dato`/`Timer`), ingen `kode`. |
| `:534` | «Eksport-modulen kaster tydelig feilmelding ved eksport-tid» | Modulen finnes ikke (adaptere «❌ Ikke startet»). |
| `:536` | «Lønns-/økonomisystem matcher uten rekonfigurasjon» | Generalisering. Sant kun for A.Markussen (firmaegne koder), ikke universelt. |

## Regelen

### 1. Presens krever referanse

En setning som sier at systemet gjør noe, må bære **enten** en kode-referanse
(`fil:linje` eller migreringsnavn) **eller** en status-markør. Uten det er den
ikke en påstand om systemet — den er en **intensjon**, og den vil bli lest som en
påstand.

### 2. Markører

| Markør | Betydning |
|---|---|
| ⚠️ **UTKAST** | Atferd/format ikke avklart |
| 🟡 **PLANLAGT** | Avklart, ikke bygget |
| ❌ **IKKE IMPLEMENTERT** | Beskrevet, bevisst utsatt |

Uten markør leses setningen som **«bygget og verifisert»**.

### 3. Vage referanser er verre enn ingen

Skriv `20260705120000_lonnsart_overtidsnivaa`, ikke «migreringen» — det finnes to,
og forvekslingen kostet en runde 2026-07-09. En vag referanse gir falsk trygghet:
leseren tror påstanden er sjekket.

### 4. Negative påstander krever uttømmende søk

«Finnes ikke», «kalles aldri», «ingen kodevei» skal **aldri** hvile på ett grep.
Enumerer kandidatmengden først (alle migreringer, alle kallsteder), og oppgi i
teksten eller commit-meldingen hva som ble søkt gjennom. Ett grep over feil (for
gammel) migrering var nettopp rotårsaken til `:263`-feilen.

### 5. Håndheves på ny prosa, retro-fylles ved berøring

Regelen gjelder ufravikelig for **ny** prosa. Eksisterende filer retro-fylles når
de likevel røres — samme mekanikk som YAML-header-regelen
([oppryddings-plan-2026-04-28.md § P0.1](oppryddings-plan-2026-04-28.md)).

### 6. Gate-plikt (kontroll-laget)

Ved hver docs-commit **plukkes de nye presens-påstandene ut**, et utvalg
verifiseres mot koden, og gate-rapporten oppgir hvilke som ble sjekket.
«Docs-only, ingen secrets» er **ikke lenger tilstrekkelig** som gate for
dokumentasjon.

### 7. Linjenumre rotner — bruk fil + distinkt kodestreng

En `fil:linje`-referanse er sann i **én commit**. `page.tsx` vokste 1 800 → 2 500
linjer på én kveld (bolk e/f/g, 2026-07-09/10) — hver referanse inn i den fila
drev. Skriv derfor **fil + distinkt kodestreng** å søke etter, ikke linjenr:
`apps/api/src/routes/prosjekt.ts` + søk `opprett: opprettProsjektProcedure`.
Migreringer refereres ved **mappenavn** (stabilt), f.eks.
`20260705120000_lonnsart_overtidsnivaa`, ikke linjenr i `migration.sql`.

**Funn 2026-07-10:** fire `fil:linje`-referanser i CLAUDE.md hadde drevet
uoppdaget (`prosjekt.ts:163/:246`, `admin.ts:229`, `MapperPanel.tsx:154` — tre
pekte på feil/tom/meningsløs linje) og ble kopiert **verbatim** inn i api.md
under trimmen. Rettet til fil + søkestreng i samme runde.

### 8. Hukommelse er ikke kilde

En påstand du «vet» er en **hypotese** til den er verifisert mot kode. Verifiser
mot git-objektet (`git show origin/<branch>:<fil>`) **før** teksten går inn i en
relé eller en commit — også kontroll-laget. Hukommelse og relé-tekst reflekterer
det som var sant da de ble skrevet, ikke nødvendigvis nå.

Eksplisitt: **positive påstander om vakter og sperrer krever enumerert
kandidatmengde av alle skrivesteder.** Et grep på funksjonsnavnet beviser at
vakten *finnes*, ikke at den *dekker* alle veier. «`sjekkTimerOverlapp` finnes»
sier ingenting om at `syncBatch` (mobilens skrivevei) omgår den — det ser du
først når du teller alle `sheetTimer`-skrivesteder og sjekker hvilke som ligger
bak vakten (jf. regel 4). Bolk (g) ble gatet grønn på nettopp denne feilen:
«overlapp-vakt gjelder mobil-innsending allerede» var usann fordi vakten aldri
ble kalt fra `syncBatch`.

**Funn 2026-07-10:** BACKLOG § Mobil Microsoft-auth hevdet i ni dager at en
Azure-sjekkliste blokkerte MS-login. Påstanden var aldri verifisert og ble
motbevist av én innlogging.

### 9. Én kilde eier status — alle andre peker

Status på en tråd (lukket / verifisert / hvem godkjente / 8/8) bor i **ett**
dokument: statuskilden (typisk verifiseringsloggen eller rapporten for den
tråden). Alle andre dokumenter kan si **«lukket» og peke** til kilden — men
gjengir **ikke detaljene** (dato, hvem godkjente, tellingen). Detaljer duplisert
ut av kilden er frø til neste drift: kilden oppdateres, kopien blir liggende.

To feiltilstander, ulik hastegrad:

| Tilstand | Eksempel 2026-07-15 | Hastegrad |
|---|---|---|
| **Stale** | STATUS-AKTUELT bar «gjenstår 8 K13-skjermbilder» mens `k13-sokdekning-rapport.md` (kilden) sa LUKKET. Redesign-økta var i ferd med å fange åtte unødvendige skjermbilder på en tråd som var ferdig. | Akutt — skjult aktivt arbeid, konkret bortkastet innsats. |
| **Duplikat** | En annen fil bar en **korrekt** K13-statuskopi. Ikke stale i dag — men samme detalj to steder betyr at neste oppdatering av kilden etterlater en stale kopi. | Lav nå, garantert drift senere. |

Regelen: **hvem som helst kan si «lukket» + peke; ingen andre enn kilden gjengir
detaljene.** En duplikat er ikke feil i dag, men den er en stale-drift som ennå
ikke har skjedd — fjern den, eller reduser den til «lukket → [kilde]».

**En peker skal navngi hvilket tre den løses i** — repo-sti eller designprosjekt.
En bar sti som *ser ut som* en repo-sti, men bor et annet sted, er en peker til
ingenting for den som leser. Og en peker til ingenting er verre enn en kopi:
kopien kan i det minste leses, om enn stale. Belegg — første anvendelse av denne
regelen brøt seg selv på nettopp dette: STATUS-AKTUELT pekte på
`verifisering/K13-verifiseringslogg.md` som statuskilde. Filen finnes — men i
designprosjektet «Sitedoc redesign tips», ikke i repoet (0 treff på
«verifiseringslogg» i hele `origin/develop`). Skriv derfor
«[designprosjekt: Sitedoc redesign tips] K13-verifiseringslogg.md», ikke en bar
sti som løser seg i feil tre.

### 10. Lesbarhet er anti-drift — ingen NY linje over ~600 tegn

Ingen **ny eller endret** linje skal overstige **~600 tegn**. Eksisterende brudd
ryddes når filen røres av annen grunn — **ikke** som egen runde. Skriver du en ny
arkiv-oppføring, skal også den være lesbar; ingen unntaksliste trengs.

Dette er ikke estetikk: **tunge dokumenter drifter mer.** Når en oppdatering
koster å skrive og linja er umulig å lese, blir «docs senere» det rasjonelle
valget — og driften gjemmer seg i massen.

Belegg 2026-07-15:

- `STATUS-AKTUELT:30` = **11 725 tegn** på én linje — kostet to merge-konflikter
  og skjulte K13-stale-statusen (regel 9) på én dag. Ingen slurvet; ingen kunne
  lese den. `STATUS.md:14` = **29 408 tegn** (changelog i ett felt, aldri lest).
- **Scopet er diffen, ikke korpuset — og det er ikke en snarvei.** Samme awk mot
  hele korpuset ga **321 brudd** (målt på `origin/develop` = `81ddd90f`,
  2026-07-16, etter at STATUS-AKTUELT:30 og STATUS:14/15 ble brutt opp; tallet
  var 322 før den oppryddingen — et øyeblikksbilde, ikke en konstant). Toppen av
  **27 filer**, sum = 321: BACKLOG 92 · historikk-2026-05 87 · timer 38 ·
  STATUS-AKTUELT 15 · historikk-2026-07 13 · STATUS 13 · redesign-paritetssjekk-
  liste 12 · parallell-arbeid-lock 7 (resten fordelt på 19 filer til). En gate
  som feiler 321 ganger blir ignorert dag to. Arkivene er dessuten append-only
  ved design — korpus-rydding ville motsi det. Derfor: gaten ser bare det du
  faktisk skriver.

**Verbatim flytting er ikke forfatting.** Flytter du eksisterende innhold uendret
til et arkiv, er det ikke en ny linje — det er den samme linja som bytter fil, og
arkiverings-plikten («ingen omskriving av historikk») veier tyngre. Rasjonalet
bak §10 er at tunge dokumenter drifter fordi oppdatering koster; et arkiv
oppdateres aldri, så det drifter ikke. Grensen går ved **forfatting**: alt du
formulerer nytt — også nye arkiv-oppføringer — skal være lesbart. Unntaket
gjelder transport av eksisterende tekst, ikke skriving av ny.

Belegg: `41abb325` (2026-07-16) flyttet 29 408 + 2 609 tegn verbatim til
historikk-docs.md og utløste §10-sjekken. Commiten var korrekt; regelen manglet
distinksjonen. Gate-rutinen: et treff som er ren transport av eksisterende arkiv-
tekst passerer — men verifiser at det faktisk er verbatim, ikke ny prosa.

**Mekanisk sjekk (gate-rutinen) — diff-basert, ikke korpus:**

```sh
git diff --cached -U0 -- docs/claude/ | awk '/^\+[^+]/ && length($0)-1 > 600 { print "  " length($0)-1 " tegn: " substr($0,2,70) "…" }'
```

Tom output = grønt. Treff = bryt linja/blokka opp før commit (ny linje per sak,
egen overskrift per tråd). Kjøres som del av docs-gaten (§6), på linje med
presens-uttrekket.

## Anvendt

Rettingen `c875ee6f` (2026-07-09) er referanse-eksempelet: `:517`/`:534` fikk
⚠️ UTKAST / ikke-bygget-markør, `:536` ble omformulert fra faktum til antakelse,
`:263` fikk navngitt migrering + presisering om at fallbacken velger *posisjon*,
ikke *betydning*.
