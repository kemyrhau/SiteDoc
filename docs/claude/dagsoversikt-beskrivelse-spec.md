---
name: dagsoversikt-beskrivelse-spec
description: Spesifikasjon for en oversiktlig dagsseddel i prosjektkort-modus (#9) og «Hva gjorde du i dag?» pr. prosjekt i Bekreft dag (#10/11), med skisser A/B. Egen isoleringsbeslutning for dagskortet.
sist_verifisert_mot_kode: 2026-11-07 (`develop` @ `b995b8bb`)
eier: fabel (kontroll-Claude) — orkestrator gater, Kenneth vedtar A/B og § 5
status: ⚠️ UTKAST TIL GATE — ingen kode. Venter Kenneths valg (§ 7 K1–K4).
---

# Oversiktlig dagsseddel (#9) og «Hva gjorde du i dag?» i Bekreft dag (#10/11)

> **Kenneth 2026-11-07, ordrett (test av L3-A/L3-D/L3-D2 på telefon):**
> - *«#9 her ble dagen uoversiktlig. Hva er registrert. Mangler enkel oversikt. Denne har for mange farger og små og
>   stor skrift om hverandre uten å vise bruker hva som er registrert strukturert.»*
> - *«I #10/11 får jeg først skrive hva jeg gjorde i dag. Dette er en av de viktigste tingene.»*
> - *«Isoler dagskort og prosjektkort fra hverandre slik at dagskort ikke påvirkes av nye endringer.»*

Hjemmel: ordre fra orkestrator 2026-11-07 (`relay/inbox-fabel.md`). Bygger på [timer-gps-lag3-4-spec.md](timer-gps-lag3-4-spec.md)
§ 3.2 (form A), § 3.5 (maskin/varer pr. prosjekt) og [mobil-dagsseddel-ui-spec.md](mobil-dagsseddel-ui-spec.md) § 7b
(prosjektkort L2, T.12 beskrivelse pr. rad). Fargeregel: [ui-standarder.md § Feltstatus](retningslinjer/ui-standarder.md).

Skisser: [skisser-dagsoversikt/](skisser-dagsoversikt/) — `oversikt-a-b.png` (#9: i dag · A · B) og
`bekreft-beskrivelse-a-b.png` (#10/11: i dag · A · B). Kilde `skisser.html?fig=oversikt|beskrivelse`.
Første telefon i hver figur er **målt tilstand** med dagens farger og skriftstørrelser, så forskjellen synes.

ORDRE 34 (Redesign, parallelt): maskin uten mengde, varevelger som husker, pause-feil, **overtid som kan redigeres**,
fraksjonsnavn. Overtid er med i skissene her som linje/merke; oppførselen eies av ORDRE 34. ORDRE 34 finnes ikke som
post i `relay/` pr. 2026-11-07 — kun som merknad i ordren til Fabel.

---

## 1. Målt tilstand (2026-11-07, `b995b8bb`)

### 1.1 Samlesiden i prosjektkort-modus (#9) — `app/timer/[id].tsx` → `ProsjektkortSamleside`

Skjermen velges av `kortModus = lesTimerModusLokalt(sedel.organizationId) === "prosjektkort"` (`[id].tsx:591-596`) og
tegner da `ProsjektkortSamleside` (`:1270-1271`). Men **`SummeringsBanner` rendres i begge moduser** (`:994`, fast over
ScrollView), og `TimerStatusMerkelapp` ligger i toppbaren (`:963`). Resultat på én flate:

| Element | Fil:linje | Farge | Skrift |
|---|---|---|---|
| Status-merke i toppbar (Venter / Konflikt / Synkronisert) | `TimerStatusMerkelapp.tsx:14-16` | `bg-yellow-100 text-yellow-800` / `bg-red-100 text-red-700` / `bg-green-50 text-green-700` | — |
| **Sum nr. 1** «8,10t av 7,50t registrert» + «herav maskin» | `SummeringsBanner.tsx:35-66` | grå / grønn / gul / blå etter norm | `text-sm` + `text-xs` |
| **Sum nr. 2** «2 prosjektkort · 8,1 t i dag» | `ProsjektkortSamleside.tsx:75-82` | `bg-gray-50` | `text-sm text-gray-700` |
| Kortnavn + status-badge «Returnert»/«Attestert» | `:253-267` | `bg-orange-100 text-orange-700` / `bg-green-100 text-green-700` | `text-base font-semibold` + **`text-[10px]`** |
| Byggeplass under navnet | `:270` | `text-gray-500` | `text-sm` |
| Chips «Arbeid 4,0 t» «Maskin 3,0 t» «Varer 2 linjer» | `:279-285` | `bg-gray-100` | `text-sm` + `text-sm font-semibold` |
| «+ Nytt kort» | `:113-121` | `text-sitedoc-primary` (#1e40af) | `text-base font-semibold` |
| Dagens ramme (stiplet) + «Endre» + byggeplass | `:126-157` | `border-dashed`, lenke `text-sitedoc-primary` | `text-sm` |
| **Sum nr. 3** «Sum i dag 8,1 t av 7,5 t · maskin · reise» | `:159-170` | `bg-blue-50 text-sitedoc-primary` | `text-sm` |
| Send-knapp + hint | `:174-187` | `bg-blue-600 text-white` | `text-base font-semibold` + `text-xs text-gray-500` |

**Funn F1:** dagsummen står **tre ganger** (banner, topptekst, blå boks) med tre forskjellige formater
(«8,10t av 7,50t», «8,1 t i dag», «8,1 t av 7,5 t»).
**Funn F2:** 7 fargeflater (gul merke, gul/grønn/blå banner, oransje badge, blå lenke ×2, blå boks, blå knapp) + grå chips.
**Funn F3:** 5 skriftstørrelser (`text-[10px]`, `xs`, `sm`, `base`, `lg`-tittel) uten regel for hva som er hva.
**Funn F4:** chipsene viser bare *tall* — ikke hvilken maskin, hvilke varer, eller noen beskrivelse. For å se *hva*
som er registrert må arbeideren åpne kortet (`/timer/[id]/kort/[projectId]`) og der radene (`TimerRadModal`).
**Funn F5:** beskrivelse vises ingen steder på samlesiden. Kortskjermen viser radens beskrivelse som
`text-xs italic text-gray-600` med blyant-ikon (`TimerSeksjon.tsx:850-857`).

### 1.2 Bekreft dag (#10/11) — `app/timer/bekreft-dag.tsx` (804 l.)

| Element | Linje | Farge | Skrift |
|---|---|---|---|
| Topplinje «dato · start–slutt · sum» + «Norm» | `:408-427` | hvit kort | `text-sm font-semibold` + `text-xs text-gray-500` |
| `Valgfelt` Prosjekt / Byggeplass / Aktivitet | `:708-730` | `border-gray-200`, feil `border-red-400 bg-red-50` | etikett `text-xs text-gray-500`, verdi `text-sm font-medium` |
| `DatoKort` → `ReiseLinje` | `:596-689` | Car #6b7280 | `text-xs text-gray-600` |
| Arbeidsblokk «Arbeid · X t» + `FraTilTidFelt` | `:627-660` | `bg-gray-50`, Trash2 #dc2626 | `text-sm font-semibold`, felt `text-base` |
| OT-merke | `:652` | `bg-amber-100 text-amber-800` | `text-xs font-medium` |
| Pause ± | `:655-670` | `border-gray-300` | `text-sm text-gray-700` |
| `BekreftDagTilleggSeksjon` «Maskin og varer» | `:510` | knapper `border-gray-300` | `text-sm font-semibold` / `text-sm font-medium` |
| Bekreft / Ikke nå | handlingsfelt | `bg-blue-600` / `border-gray-300 bg-white` | `text-base font-semibold` |

**Funn F6:** skjermen har **ingen beskrivelse** (0 treff på `beskrivelse` i fila). `bekreft` (`:255`) → `bekreftDag`
(`src/utils/bekreftDag.ts:67`) → `anvendDagsforslag` (`src/utils/dagsforslagAnvend.ts:35`), som i
`db.insert(sheetTimerLocal).values({...})` (`:142-166`) **ikke setter `beskrivelse`**. Feltet finnes først i
`TimerRadModal` på sedelen etterpå (`TimerSeksjon.tsx:1796-1810`) — tre klikk unna (kort → rad → felt).

**Funn F7 — datafelt:** prosjektkortets beskrivelse er **pr. timer-rad**: `sheetTimerLocal.beskrivelse`
(`src/db/schema.ts:166`, «T.12 fritekst per rad»), skrevet via `settInnTimerRad` (`nyTimerRad.ts:226`) og
`db.update(sheetTimerLocal).set({...beskrivelse})` (`TimerSeksjon.tsx:318-335`). Dagskortet har i tillegg en
**sedel-kommentar** `dailySheetLocal.beskrivelse` (`schema.ts:116`), redigert i `ArbeidstidSeksjon`/`RedigerArbeidstidModal`
(«Kommentar», `timer.felt.beskrivelse`). Kortskjermen (B) leser/skriver ikke sedel-kommentaren.
Ordren sier «samme datafelt som beskrivelsen på prosjektkortet, ikke et nytt» → **`sheetTimerLocal.beskrivelse`** (§ 3.3).

---

## 2. Oversikt over dagen (#9)

Mål: hver dag svarer på «hva er registrert?» uten å åpne kort. Begge skisser deler disse reglene:

**R1 Én sum.** Dagsummen står én gang, øverst, i vanlig tekst. `SummeringsBanner` (`:994`), toppTekst-boksen
(`:75-82`) og den blå sum-boksen (`:159-170`) faller bort **i kortmodus** (dagskort-grenen beholder alle tre, § 5).
**R2 Én farge.** Amber (`#f59e0b` kant/prikk, `#b45309` tekst) brukes for og bare for «Ikke sendt», «Returnert» og
«Mangler». Ingen grønn, gul, oransje eller blå flate i innholdet. Send-knappen er mørk nøytral (`bg-gray-900`), ikke blå,
så den ikke konkurrerer med statusfargen. Regelen følger [ui-standarder.md § Feltstatus](retningslinjer/ui-standarder.md):
«kant og prikk, aldri fyll», «fargen erstatter aldri teksten».
**R3 To skriftstørrelser i innholdet.** Prosjektnavn `text-base font-semibold text-gray-900`; alt annet `text-sm`.
Etiketter `text-gray-500`, verdier `text-gray-900`, tall `tabular-nums`. `text-[10px]`-badges og `text-xs` utgår.
**R4 Verdier, ikke bare tall.** Maskin viser maskinnavn, varer viser navn · mengde, arbeid viser fra–til.

### 2.1 A — faste linjer pr. prosjekt (anbefalt)

Ett kort pr. prosjekt med **alltid de samme linjene i samme rekkefølge**, etikett-kolonne 72 px grå:

```
2041 Lillestrøm skole                       ● Returnert
Lillestrøm skole
Arbeid        07:24–11:30 · 4,0 t
Maskin        Hjulgraver 8 t · 3,0 t
Varer         Pukk 0–32 · 4 t
              Fiberduk · 60 m
Beskrivelse   Graving grøft nordside, lagt fiberduk
```

- Linjene Arbeid · Maskin · Varer · Beskrivelse vises **alltid**; tomt = «–» i `text-gray-400`. Reise (og Utlegg) vises
  bare når ført, etter Beskrivelse.
- Arbeid: ett segment pr. linje (`fra–til · timer`); overtid som egen underlinje «overtid 50 % fra 14:30 · 1,0 t»
  (visning her, redigering ORDRE 34). Flere byggeplasser (L4): byggeplassnavn etter tiden på hvert segment.
- «Mangler» (amber tekst + 3 px amber venstrekant på linjen) kun der regelen i § 2.3 slår inn.
- Sum-kort øverst: «**Sum i dag** 8,1 t arbeid · 3,0 t maskin · 0,5 t reise», under «Norm 7,5 t · ramme 06:52–15:31 ·
  pause 30 min», så statusordet («● Ikke sendt» / «Sendt 15:40» / «● Returnert»). Rammen med «Endre»/byggeplass flyttes
  hit fra den stiplede boksen (én boks mindre).
- Fordel: det som mangler **synes som et hull** i en fast struktur — Kenneths «hva er registrert» besvares linje for linje.
  Ulempe: 4–6 linjer pr. kort også på en enkel dag.

### 2.2 B — kvittering (verdi venstre, tall høyre)

Samme data uten etiketter: hver registrering er én rad, tallet høyrestilt. Tomme kategorier utelates. Beskrivelse i kursiv
under en tynn skillelinje. Sum-kortet som to kolonner (Arbeid 8,1 t / Maskin 3,0 t / Reise 0,5 t).

- Fordel: kortere og kvitteringsaktig; en enkel dag er to rader.
- Ulempe: en tom kategori er **usynlig**. «Mangler» må da legges til som egen amber-linje («● Beskrivelse mangler»), og
  arbeideren kan ikke se forskjell på «ingen maskin i dag» og «glemte maskinen». Bryter med Kenneths «strukturert».

**Anbefaling: A.** Begrunnelse: ordren ber om «faste linjer i samme typografi», og A er den eneste av de to der fravær er
synlig uten ekstra markør. B beholdes som fallback hvis A oppleves for lang på telefon med 3+ prosjekter.

### 2.3 Hva «mangler» betyr (amber)

| Tilstand | Markering | Kilde |
|---|---|---|
| Sedel ikke sendt (draft) | «● Ikke sendt» i sum-kortet | `sedelStatus` |
| Kort returnert | «● Returnert» ved prosjektnavnet | `kortStatus()` |
| Arbeid > 0 og ingen beskrivelse på noen arbeidsrad for prosjektet | «Mangler» på Beskrivelse-linjen + amber venstrekant | § 3.3 (**K3**, Kenneth vedtar) |
| Sync-feil på en rad | «● Ikke sendt: …» på linjen | `syncStatus` (som `VareforbrukLesListe` i dag) |

«Attestert» vises som grått ord («Attestert 7. nov»), ikke grønt badge — grønn er ingen handling for arbeideren.

### 2.4 Hva som ikke endres

Kortskjermen `/timer/[id]/kort/[projectId]` (B-skjermen) er uendret. Trykk på kortet åpner den som før. Toppbaren med
`TimerStatusMerkelapp` er felles med dagskortet og endres ikke (§ 5).

---

## 3. «Hva gjorde du i dag?» i Bekreft dag (#10/11)

### 3.1 Plassering og felles regler

- Ett felt pr. prosjekt, rett under arbeidstiden (under pause-raden i prosjektets **første** arbeidsblokk). Ved L4 med
  flere segmenter på samme prosjekt gjentas ikke feltet. Hvert prosjekt i forslaget får sitt eget felt.
- Etikett: «Hva gjorde du i dag?» (`timer.felt.radBeskrivelse` er i dag «Hva gjorde du?» — gjenbrukes, se § 6).
- Valgfritt: tom beskrivelse **blokkerer ikke** Bekreft (feltstatus-regel: valgfritt tomt = ingen markering på skjermen).
  Konsekvensen vises først i oversikten (§ 2.3, K3).
- Fritekst er lov, men forslagene gjør det til ett trykk i det vanlige tilfellet.

**Forslagskilde (offline-trygg, lokal DB):** de 2 sist brukte **distinkte** `sheetTimerLocal.beskrivelse` for samme
`projectId` siste 30 dager (nyeste først, `beskrivelse IS NOT NULL AND erReise = 0`), + aktivitetsnavnet fra forslaget
som tredje chip når det ikke alt er blant de to. Ingen server-kall. Første gang på et prosjekt: bare aktivitetschipen.
Framtid (ikke nå): firma-standardbeskrivelser pr. aktivitet (`OrganizationSetting`), jf. «forhåndsdefinerte valg».

### 3.2 A — chips + felt, synlig i blokken (anbefalt)

```
Hva gjorde du i dag?
[Graving grøft nordside] [Masseutskifting] [Anleggsarbeid]
┌──────────────────────────────────────────────┐
│ Graving grøft nordside, lagt fiberduk        │
└──────────────────────────────────────────────┘
```

- Chip-rad (`rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm`) over et `TextInput` (multiline, `min-h-[40px]`,
  `border-gray-300 text-base`, placeholder «Skriv selv …»).
- Trykk på chip → fyller feltet (erstatter, ikke appender); teksten kan redigeres etterpå. Chip for teksten som alt står i
  feltet vises valgt (`bg-gray-100`).
- Klikk: forslag passer = **+1** pr. prosjekt. Skrive selv = +1 (fokus) + tekst + Ferdig (tastatur).
- Fordel: spørsmålet er **synlig** uten å lete («en av de viktigste tingene»); billigste utfall er ett trykk.
  Ulempe: arbeidsblokken blir ~90 px høyere pr. prosjekt.

### 3.3 B — velgerrad → ark

Rad «Hva gjorde du i dag? · Velg eller skriv ›» i samme `Valgfelt`-stil som Prosjekt/Byggeplass/Aktivitet. Trykk åpner
`Valgliste`-arket (`rounded-t-2xl`) med «Sist brukt på prosjektet» (2–3 rader, aktivitetsnavn merket) og «Eller skriv selv»
med tekstfelt + Ferdig nederst.

- Klikk: billigste utfall = **+2** (rad + valg). Skrive selv = rad + felt + tekst + Ferdig.
- Fordel: blokken holder seg kort, mønsteret finnes alt på skjermen. Ulempe: spørsmålet er gjemt bak en rad, og det
  dobler klikkene i det vanlige tilfellet.

**Anbefaling: A.** Begrunnelse: P4 klikk-tak (maks 2, ideal 1) og Kenneths vekting av feltet. B kun hvis Kenneth
prioriterer en kort blokk over synlighet.

### 3.4 Datafelt og skriving (gjelder både A og B)

- **Feltet er `sheetTimerLocal.beskrivelse`** — det samme som prosjektkortets rad-beskrivelse (§ 1.2 F7). Ikke et nytt
  felt, ingen schema-endring.
- `Dagsforslag` får `beskrivelse: string | null` **pr. prosjekt** (ikke pr. segment); `anvendDagsforslag` skriver verdien
  på prosjektets **arbeidsrader** i `db.insert(sheetTimerLocal)` (`dagsforslagAnvend.ts:142-166`). Reise- og mellomrader
  får `null` som i dag.
- Oversikten (§ 2) viser prosjektets **distinkte** beskrivelser (én linje pr. distinkt verdi); vanligvis én.
- Sedel-kommentaren `dailySheetLocal.beskrivelse` er **uendret og utenfor scope** (dagskortets felt, § 5).
- Kortskjermens `TimerRadModal` fortsetter å redigere samme felt pr. rad — ingen endring der.

### 3.5 Overtid (visning her, oppførsel ORDRE 34)

Merket «OT 50 % fra 14:30 · 1,0 t» beholdes i arbeidsblokken over beskrivelsesfeltet. Redigering (trykk → endre
starttid/prosent) spesifiseres av ORDRE 34; denne spec-en krever bare at merket får plass **over** beskrivelsesfeltet,
slik at rekkefølgen i blokken er: tid → overtid → pause → beskrivelse.

---

## 4. Klikktelling (P4)

| Flyt | I dag | A | B |
|---|---|---|---|
| Bekreft dag, ett prosjekt, uten beskrivelse | 2 | 2 | 2 |
| + beskrivelse som passer et forslag | — (ikke mulig) | **3** | 4 |
| + beskrivelse skrevet selv | 2 + 3 (kort → rad → felt) + tekst | 3 + tekst | 4 + tekst |
| Se hva som er registrert på et prosjekt (maskin/varer/beskrivelse) | 1–2 (kort → rad) | **0** | 0 |

---

## 5. 🔴 VEDTAK — isolering av dagskort fra prosjektkort (Kenneth må godkjenne)

**Kenneth:** *«Isoler dagskort og prosjektkort fra hverandre slik at dagskort ikke påvirkes av nye endringer.»*

**Målt deling i dag:** `app/timer/[id].tsx` bærer begge modusene i én fil (bryter `kortModus` `:591-596`; grener `:1007`,
`:1270-1356`, `:1359/:1370`, `:1435-1439`). `ProsjektGruppe`, `VareforbrukLesListe`, `TimerSeksjon`, `SummeringsBanner`
og `FraTilTidFelt` importeres av begge sider. Kortskjermen (`kort/[projectId].tsx`) importerer `ProsjektGruppe` og
`KortHode`. `ProsjektkortKontekst` (`prosjektkortKontekst.ts:9-13`) er den eneste eksisterende isoleringsmekanismen og
virker **inne i** delte komponenter, ikke mellom skjermene.

**Vedtak som foreslås:** *Denne spec-en (§ 2 + § 3) rører ikke dagskortet.* Konkret:

- I1 (minimum, i samme leveranse som § 2): den nye oversikten bor i en ny komponent `ProsjektkortDagsoversikt.tsx`
  (erstatter `ProsjektkortSamleside` i kortmodus). `[id].tsx` berøres på nøyaktig to steder: import-bytte i
  kortModus-grenen (`:1271`) og `{!kortModus && <SummeringsBanner …/>}` (`:994`). `ArbeidstidSeksjon`, `ProsjektGruppe`,
  `TimerSeksjon`, den blå sedel-boksen og dagskortets Send-knapp endres ikke. **Gate:** `git diff` på `[id].tsx` viser
  kun de to linjene; test som rendrer `[id]` i dagskort-modus og sammenligner mot snapshot fra `b995b8bb`.
- I2 (anbefalt, egen docs+kode-leveranse **før** § 2/§ 3 bygges): flytt hele kortModus-grenen ut av `[id].tsx` til egen
  skjermfil `app/timer/[id]/prosjektkort.tsx` (eller komponent `ProsjektkortSkjerm.tsx` som `[id].tsx` returnerer tidlig
  på `kortModus`). Delte byggeklosser (`FraTilTidFelt`, `TidFeltBoks`, velgere) forblir delt; alt som *tegner* kort
  (KortHode, ProsjektkortDagsoversikt, VareforbrukLesListe-bruk i kortmodus) lever under `timer-detalj/prosjektkort/`.
  **Gate:** diff i dagskort-grenen = 0 linjer; snapshot-test som over; `ProsjektkortKontekst` beholdes for
  `TimerSeksjon`/`TimerRadModal` som fortsatt deles fra kortskjermen.
- Konsekvens: `SummeringsBanner`, toppTekst og blå sum-boks fjernes **bare** fra kortmodus. Dagskort-brukere ser ingen
  forskjell.
- Ikke isolert med dette vedtaket (må vedtas separat hvis ønsket): `ProsjektGruppe` og `TimerSeksjon` brukt fra
  kortskjermen (`kort/[projectId].tsx`). En endring der treffer begge i dag.

**K4 til Kenneth:** I1 (minst inngrep, to linjer i `[id].tsx`) eller I2 (egen fil, null linjer, én ekstra leveranse først)?
Anbefaling **I2** — det er det eneste som gjør «ikke påvirkes av nye endringer» til en mekanisk gate og ikke en vane.

---

## 6. i18n-nøkler (nb + en, generer `--only`)

| Nøkkel | nb | Bruk |
|---|---|---|
| `timer.dagsoversikt.sumIDag` | «Sum i dag» | § 2 sum-kort (etikett; verdier `{{arbeid}} t arbeid · {{maskin}} t maskin · {{reise}} t reise`) |
| `timer.dagsoversikt.normRamme` | «Norm {{norm}} t · ramme {{fra}}–{{til}} · pause {{pause}} min» | § 2 |
| `timer.dagsoversikt.ikkeSendt` / `.sendt` / `.returnert` / `.attestert` | «Ikke sendt» / «Sendt {{tid}}» / «Returnert» / «Attestert {{dato}}» | statusord |
| `timer.dagsoversikt.linje.arbeid` / `.maskin` / `.varer` / `.beskrivelse` / `.reise` / `.utlegg` | «Arbeid» … | etikett-kolonnen (gjenbruk `timer.prosjektkort.kolonne.*` der de finnes) |
| `timer.dagsoversikt.mangler` | «Mangler» | § 2.3 |
| `timer.dagsoversikt.overtid` | «overtid {{prosent}} % fra {{fra}} · {{timer}} t» | § 2.1 |
| `timer.bekreftDag.beskrivelse.etikett` | «Hva gjorde du i dag?» | § 3 (eller endre `timer.felt.radBeskrivelse` → samme tekst begge steder, K-spørsmål til Redesign) |
| `timer.bekreftDag.beskrivelse.placeholder` | «Skriv selv …» | § 3.2 |
| `timer.bekreftDag.beskrivelse.sistBrukt` / `.skrivSelv` | «Sist brukt på prosjektet» / «Eller skriv selv» | § 3.3 (B) |

Nøkler som **slutter** å brukes i kortmodus: `timer.prosjektkort.toppTekst`, `timer.prosjektkort.sumIDag`
(beholdes i fila — dagskort/web kan bruke dem).

---

## 7. Spørsmål til Kenneth (vedtak)

| # | Spørsmål | Anbefaling |
|---|---|---|
| K1 | Oversikt: **A** faste linjer eller **B** kvittering? | A |
| K2 | Beskrivelse i Bekreft dag: **A** chips + felt eller **B** velgerrad → ark? | A |
| K3 | Skal tom beskrivelse på et prosjekt med arbeid > 0 vises som «Mangler» (amber) i oversikten? Ja = amber betyr «noen må ta stilling» også her; nei = beskrivelse er rent valgfri og linjen viser «–». | Ja |
| K4 | Isolering: **I1** to linjer i `[id].tsx` eller **I2** egen skjermfil først? | I2 |

Åpent mot Redesign (ikke Kenneth): om `timer.felt.radBeskrivelse` («Hva gjorde du?») skal endres til «Hva gjorde du i
dag?» så `TimerRadModal` og Bekreft dag bruker samme ord.

---

## 8. Tester / DoD (gate for kode-leveransen)

1. Kortmodus, dag med 2 prosjekter: skjermen viser **én** sum; `SummeringsBanner`, toppTekst og blå sum-boks er ikke
   rendret (`queryByText` på «herav», «prosjektkort ·», «Sum i dag … av»).
2. Hvert kort viser linjene Arbeid/Maskin/Varer/Beskrivelse i den rekkefølgen også når Maskin og Varer er tomme («–»).
3. Maskin-linjen viser maskinnavn + timer; vare-linjen viser navn · mengde · enhet, én linje pr. vare.
4. Ingen annen fargeklasse enn gray-/amber- i oversiktens innhold (snapshot/regex-test på `className`).
5. Returnert kort → «● Returnert» amber; ikke sendt sedel → «● Ikke sendt» amber; attestert → grått ord.
6. (K3 ja) Arbeid > 0 uten beskrivelse → «Mangler» + amber venstrekant; med beskrivelse → teksten, ingen amber.
7. Bekreft dag, forslag med 1 prosjekt: ett beskrivelsesfelt under pause-raden; 2 prosjekter → to felt; L4 to segmenter
   samme prosjekt → ett felt.
8. Chips: lokal DB med 3 distinkte beskrivelser på prosjektet siste 30 dager → 2 nyeste + aktivitet; 0 → bare aktivitet;
   trykk på chip fyller feltet; redigert tekst beholdes ved Bekreft.
9. `anvendDagsforslag` med `beskrivelse: "x"` på prosjekt P → alle P-arbeidsrader får `beskrivelse = "x"`, reise-/mellomrader
   `null`; uten beskrivelse → `null` som i dag (eksisterende tester uendret).
10. Oversikten viser samme tekst som `TimerRadModal` for raden (samme felt — endring i modalen synes på oversikten).
11. **Isolering (§ 5):** snapshot av `[id]` i dagskort-modus fra `b995b8bb` er identisk etter leveransen; `git diff --stat`
    på `[id].tsx` ≤ 2 linjer (I1) eller 0 linjer i dagskort-grenen (I2).
12. Klikktelling § 4 verifisert i test: Bekreft med chip = 3 trykk.

---

## 9. Ut av scope

- Sedel-kommentaren `dailySheetLocal.beskrivelse` (dagskortets «Kommentar»).
- Kortskjermen `kort/[projectId].tsx`, `ProsjektGruppe`, `TimerSeksjon`, `TimerRadModal`.
- Web-visningen av dagsseddel/prosjektkort.
- Overtid-redigering, maskin uten mengde, varevelger som husker, pause-feil, fraksjonsnavn (ORDRE 34).
- Firma-standardbeskrivelser pr. aktivitet (framtidig forhåndsdefinert valg, § 3.1).
