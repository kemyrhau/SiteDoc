---
name: dagsoversikt-beskrivelse-spec
description: Spesifikasjon for en oversiktlig dagsseddel i prosjektkort-modus (#9), påkrevd «Hva gjorde du i dag?» pr. prosjekt i Bekreft dag (#10/11), og pluss-knappen som åpner Bekreft dag-flyten. Vedtatt K1–K4. Egen isoleringsbeslutning for dagskortet (I2 først).
sist_verifisert_mot_kode: 2026-11-07 (`develop` @ `b3e96829`)
eier: fabel (kontroll-Claude) — orkestrator gater kode; Kenneth har vedtatt K1–K4 (§ 7)
status: 🟢 VEDTATT 2026-11-07 (Kenneth, K1–K4) — ingen kode ennå. Rekkefølge: I2 (egen leveranse) → ORDRE 35 Redesign bygger § 2, § 3 og § 10.
---

# Oversiktlig dagsseddel (#9), påkrevd «Hva gjorde du i dag?» (#10/11) og pluss-knappen → Bekreft dag

> **Kenneth 2026-11-07, ordrett (test av L3-A/L3-D/L3-D2 på telefon):**
> - *«#9 her ble dagen uoversiktlig. Hva er registrert. Mangler enkel oversikt. Denne har for mange farger og små og
>   stor skrift om hverandre uten å vise bruker hva som er registrert strukturert.»*
> - *«I #10/11 får jeg først skrive hva jeg gjorde i dag. Dette er en av de viktigste tingene.»*
> - *«Isoler dagskort og prosjektkort fra hverandre slik at dagskort ikke påvirkes av nye endringer.»*
>
> **Kenneth 2026-11-07, etter test av ORDRE 34 (`b3e96829`) på telefon (via orkestrator):**
> - GPS-utfyllingen: *«Start Dag varianten er veldig bra»* — enkel, flere varer.
> - Han savnet at han **ikke ble pålagt** å skrive hva han hadde gjort før innsending eller Ferdig.
> - *«Pluss-knappen»* skal gi **samme funksjon** som det han får ved Start dag med GPS.
> - Om oversikten (med et annet systems prosjektvise timeliste som eksempel — én rad pr. prosjekt med timer og tekst,
>   og en sum): *«jeg sier ikke at vi skal hit med vår timeregistrering. men jeg ber om enkel oversikt. som viser at
>   maskintimer er fylt ut og dersom det er aktuelt med varer/materiell, at også dette er fylt ut».*

Hjemmel: ordre fra orkestrator 2026-11-07 (`relay/inbox-fabel.md`, spec-ordren og oppdateringsordren etter Kenneths
vedtak). Bygger på [timer-gps-lag3-4-spec.md](timer-gps-lag3-4-spec.md) § 3.2 (form A), § 3.5 (maskin/varer pr.
prosjekt) og [mobil-dagsseddel-ui-spec.md](mobil-dagsseddel-ui-spec.md) § 7b (prosjektkort L2, T.12 beskrivelse pr.
rad). Fargeregel: [ui-standarder.md § Feltstatus](retningslinjer/ui-standarder.md). Mikrotekst:
[tooltip-hjelpetekst-veileder.md § 3a](retningslinjer/tooltip-hjelpetekst-veileder.md). Isolering:
[dagskort-isolert-vakt.test.ts](../../apps/mobile/src/components/timer-detalj/dagskort-isolert-vakt.test.ts) (ORDRE 34).

Skisser: [skisser-dagsoversikt/](skisser-dagsoversikt/) — `oversikt-a-b.png` (#9: i dag · **A vedtatt** · B forkastet)
og `bekreft-beskrivelse-a-b.png` (#10/11: i dag · **A vedtatt** · A med sperre). Kilde `skisser.html?fig=oversikt|beskrivelse`.
Første telefon i hver figur er **målt tilstand** med dagens farger og skriftstørrelser, så forskjellen synes.

ORDRE 34 (Redesign) er **merget** i `c92e73e5` (develop `b3e96829`): maskin uten mengde, varevelger som holdes åpen,
lokal pausehode-synk, **overtid som kan redigeres** i Bekreft dag (`bekreft-dag.tsx:662-717`), fraksjonsnavn i seed.
Overtid-redigering videre («Legg til overtid») eies av **ORDRE 35** (Redesign) og omtales her bare som lenke (§ 3.5).

---

## 1. Målt tilstand (2026-11-07, `b3e96829`)

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
| Chips «Arbeid 4,0 t» «Maskin 3,0 t» «Varer 2 linjer» | `:228-247`, `:279-285` | `bg-gray-100` | `text-sm` + `text-sm font-semibold` |
| «Nytt prosjektkort» | `:112-122` | `text-sitedoc-primary` (#1e40af) | `text-base font-semibold` |
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

### 1.2 Bekreft dag (#10/11) — `app/timer/bekreft-dag.tsx` (865 l. etter ORDRE 34)

| Element | Linje | Farge | Skrift |
|---|---|---|---|
| Topplinje «dato · start–slutt · sum» + «Norm» | `:416-427` | hvit kort | `text-sm font-semibold` + `text-xs text-gray-500` |
| `Valgfelt` Prosjekt / Byggeplass / Aktivitet | `:708-730` (komponent) | `border-gray-200`, feil `border-red-400 bg-red-50` | etikett `text-xs text-gray-500`, verdi `text-sm font-medium` |
| `DatoKort` → `ReiseLinje` | `:603-752` | Car #6b7280 | `text-xs text-gray-600` |
| Arbeidsblokk «Arbeid · X t» + `FraTilTidFelt` | `:645-660` | `bg-gray-50`, Trash2 #dc2626 (`:651`) | `text-sm font-semibold`, felt `text-base` |
| OT-merke (Pressable, ORDRE 34) + redigeringspanel | `:662-674` / `:675-717` | `bg-amber-100 text-amber-800` | `text-xs font-medium` |
| Pause ± | `:718-746` | `border-gray-300` | `text-sm text-gray-700` |
| `BekreftDagTilleggSeksjon` «Maskin og varer» | `:516-517` | knapper `border-gray-300` | `text-sm font-semibold` / `text-sm font-medium` |
| Bekreft / Ikke nå | `:546-556` | `bg-blue-600` / `border-gray-300 bg-white` | `text-base font-semibold` |

**Funn F6:** skjermen har **ingen beskrivelse** (0 treff på `beskrivelse` i fila). `bekreft` (`:256`) → `bekreftDag`
(`src/utils/bekreftDag.ts:67`) → `anvendDagsforslag` (`src/utils/dagsforslagAnvend.ts:35`), som i
`db.insert(sheetTimerLocal).values({...})` (`:141-170`) **ikke setter `beskrivelse`**. Feltet finnes først i
`TimerRadModal` på sedelen etterpå (`TimerSeksjon.tsx:1796-1810`) — tre klikk unna (kort → rad → felt).

**Funn F7 — datafelt:** prosjektkortets beskrivelse er **pr. timer-rad**: `sheetTimerLocal.beskrivelse`
(`src/db/schema.ts:166`, «T.12 fritekst per rad»), skrevet via `settInnTimerRad` (`nyTimerRad.ts:226`) og
`db.update(sheetTimerLocal).set({...beskrivelse})` (`TimerSeksjon.tsx:318-335`). Dagskortet har i tillegg en
**sedel-kommentar** `dailySheetLocal.beskrivelse` (`schema.ts:116`), redigert i `ArbeidstidSeksjon`/`RedigerArbeidstidModal`
(«Kommentar», `timer.felt.beskrivelse`). Kortskjermen (B) leser/skriver ikke sedel-kommentaren.
Ordren sier «samme datafelt som beskrivelsen på prosjektkortet, ikke et nytt» → **`sheetTimerLocal.beskrivelse`** (§ 3.4).

**Funn F8 — Bekreft dag krever en åpen arbeidsdag.** Params er `arbeidsdagId, sluttIso, endLat?, endLng?,
sisteSegmentKilde?` (`:86-92`) — ingen `dato` eller `sheetId`. `dag` hentes fra `arbeidsdagLocal` og krever
`status === "paagaar"` (`:133-149`); ellers vises «Ingen åpen arbeidsdag å bekrefte» (`:369-378`,
`timer.bekreftDag.ingenAapenDag`). Skjermen åpnes fra **ett** sted: `StartSluttDagKort.tsx:81-90`
(`router.push({pathname: "/timer/bekreft-dag", params: {...}})`), utløst av «Slutt dag» (`:213-226`) eller
glemt-dag-varianten (`:99-122`, slutt estimert fra firmatider eller start + norm, `sisteSegmentKilde = "system"`).
«Start dag» skriver bare `arbeidsdagLocal` med `status: "paagaar"` (`useArbeidsdag.ts:143-185`). Start = trykk-tidspunktet
(`useArbeidsdag.ts:164`), slutt = `sluttIso`. Uten GPS er `fangGps` null (`useArbeidsdag.ts:51-65`); GPS påvirker bare
sted/prosjekt/reise-forslaget (`dagsforslagInput.ts:153-176`), ikke tidene. **Konsekvens for § 10:** pluss-flyten kan
ikke gjenbruke skjermen slik den er — den trenger en manuell inngang uten `arbeidsdagId`.

**Funn F9 — firmastandard-tider finnes, men brukes ikke som forslag i Bekreft dag.** `organizationSettingLocal`
`standardStartTid` («07:00»), `standardSluttTid` («15:00»), `standardPauseMin` (30) (`src/db/schema.ts:607-611`), fallback
`STANDARD_ARBEIDSTID_FALLBACK` (`packages/shared/src/utils/arbeidstidDefault.ts:19-23`), leses av
`hentArbeidsdagTiderLokalt` (`src/services/kalenderKatalog.ts:144-165`). I Bekreft dag går de bare inn i `effektivPerDato`
(`dagsforslagInput.ts:236-245`) som pausereferanse (`dagsforslag.ts:920-923`). Som start/slutt-forslag brukes de i dag kun
i de manuelle løpene: `dagsseddelOpprett.ts:91-103`, `TimerSeksjon.tsx:1127-1154` (ny rad: fra = seneste `tilTid` eller
firmastart, til = firmaslutt), `StartSluttDagKort.tsx:104-121` (glemt dag).

### 1.3 Alle «+»-innganger til ny timeregistrering (målt, mobil `apps/mobile/`)

| # | Inngang | Fil:linje | Hva skjer i dag | § 10 |
|---|---|---|---|---|
| P1 | **Timer-hjem FAB «+»** (tab `app/(tabs)/timer-oversikt.tsx:8` og stack `app/timer/index.tsx:7` rendrer `DagsseddelListe`) | `src/components/DagsseddelListe.tsx:300-306` (Plus 28 #fff, blå sirkel h-14 w-14) | `setVisNyRad(true)` → `<NyTimerRadFlyt onLukk>`; dato = `iDag()` (`NyTimerRadFlyt.tsx:29`) | **Endres** |
| P2 | `NyTimerRadFlyt` (ORDRE 17) | `src/components/timer-detalj/NyTimerRadFlyt.tsx:75-99`, `:164-177`, `:183-247` | ikke ansatt → Alert; `startvalgForNyRad` (`nyTimerRad.ts:142`: innlogget prosjekt → GPS) ellers `ProsjektVelgerModal`; så `<TimerRadModal opprettelse={{…}}>`; Lagre = finn-eller-opprett sedel (`:219-236`) → `router.push('/timer/{sheetId}?aapnetEksisterende=1')` (`:153`), i kortmodus videre til `/timer/{sheetId}/kort/{pid}` (`:155-157`) | **Erstattes** av § 10 |
| P3 | **Prosjektkortet** `app/timer/[id]/kort/[projectId].tsx` → `ProsjektGruppe visHeader={false}` i `ProsjektkortKontekst` (`:306-328`) → `TimerSeksjon` | `TimerSeksjon.tsx:513-524` (tom bøtte, blå «Legg til timer-rad», Plus 16 #fff) og `:565-578` (med rader, stiplet «+ Legg til timer-rad», Plus 12 #1e40af) | `setRedigerRadId(null); setVisModal(true)` → `<TimerRadModal>` (`:581-655`) uten `opprettelse`; Lagre → `settInnTimerRad` (`:217-252`) | **Endres i kortmodus** (prop/kontekst, § 10.4) |
| P4 | **Samlesiden** «Nytt prosjektkort» | `ProsjektkortSamleside.tsx:112-122` (`timer.prosjektkort.nyttKort`, «+» strippet `:119`) → `onNyttKort` → `[id].tsx:1290` `setVisLeggTilProsjekt(true)` → `ProsjektVelgerModal` `:1431-1448` → `router.push('/timer/{id}/kort/{pid}')` `:1437-1441` | Åpner tomt kort; der finnes P3 | **Endres** (§ 10.3) |
| P5 | «+ Vareforbruk» på prosjektkortet | `kort/[projectId].tsx:333-341` (`timer.prosjektkort.nyVare`) → `KortVareforbrukModal` `:354-369`, gate `kanForeVare` `:223-227` | Varer, ikke timer | Uendret |
| P6 | Hjem-skjermen «+» | `app/(tabs)/hjem.tsx:356-357` | Bare sjekkliste/oppgave | Uendret |
| P7 | `HjemTimerChip` | `src/components/HjemTimerChip.tsx:119/139/153/171` | Ingen «+»; lenker til `/timer`, `/timer/{id}`, startDag | Uendret |
| P8 | «Mine timer» mobil | `app/timer/mine.tsx:291` (åpnes fra `mer.tsx:271`) | Ingen «+»; rad-trykk → `/timer/{id}` | Uendret |
| P9 | «Mine timer» web | `apps/web/src/app/dashbord/timer/mine/page.tsx:302-320` → `/dashbord/timer/ny` → `ny/page.tsx:144-146` (`?nyttProsjekt=…&aapnetEksisterende=1`) | Web-skjema | Uendret (web utenfor scope) |
| P10 | **Dagskortet** «+ Legg til prosjekt» | `app/timer/[id].tsx:1340-1349` (Plus 14 #1e40af, `timer.leggTilProsjekt` — i18n-teksten har alt «+ », ikonet dobler det) → `ProsjektVelgerModal` `:1431-1448`, tom gruppe `ekstraProsjektIder` `:1443-1445` | Dagskort | **Uendret (isoleringskrav)** |
| P11 | Dagskortets `TimerSeksjon`-knapper (samme kode som P3, via `ProsjektGruppe.tsx:341-357` → `EcoBucket`), `TilleggSeksjon.tsx:142-153`, `UtleggSeksjon.tsx:140-150`, header-«+» `TimerSeksjon.tsx:496-507` (kun `visHeader`) | se P3 | `TimerRadModal` | **Uendret (isoleringskrav)** — P3-endringen gates på `ProsjektkortKontekst` |

Maskin har ingen egen «+» via `ProsjektGruppe` (`MaskinSeksjon.tsx:233` krever `visHeader`); ny maskin føres i rad-modalen
(`ProsjektGruppe.tsx:359-363`, `TimerSeksjon.tsx:1820`). `StartSluttDagKort.onNyRad` er koblet (`DagsseddelListe.tsx:226`)
men ignoreres (`_onNyRad`, `StartSluttDagKort.tsx:21-25`).

### 1.4 Hva som styrer «Maskin» og «Varer» i dag (grunnlag for § 2.1-regelen)

- **Maskin:** `harEquipmentCache` = `equipmentLocal` har rader for firmaet (`[id].tsx:206, :283-288`,
  `kort/[projectId].tsx:120-125`, `NyTimerRadFlyt.tsx:129-139`, `BekreftDagTilleggSeksjon.tsx:71-81` som `harEquipment`).
  Fylles fra `maskin.equipment.list`; tom når Maskin-modulen er av **eller** firmaet ikke har utstyr
  (`maskinKatalog.ts:22-25, :40-92`; refresh `TimerSyncProvider.tsx:114`). `harMaskinforerbevis` (`maskinKatalog.ts:101-116`,
  default true) er et **mykt varsel** (`MaskinSeksjon.tsx:218`), ingen gate. Rad-modalens maskinseksjon vises ved
  `harEquipmentCache` (`TimerSeksjon.tsx:1820`), ellers «ingen tilgjengelig» (`:1905`). **Det finnes ingen per-bruker
  maskinkapabilitet** (0 treff på `maskinTillatt`, `kanMaskin`, `maskinKapabilitet`, `erMaskinforer` o.l. i `apps/`,
  `packages/`); `useFirmamodulSkjult` (`useFirmamodul.ts:21-28`) brukes bare med `"timer"`.
- **Varer:** `prosjektIderMedVarelager` fra `vareforbruk.katalogForFirma` (`vareKatalog.ts:40-76`, lokalt
  `hentVarelagerProsjekterLokalt` `:94-97`). `visVareforbrukKnapp = erRedigerbar && prosjektIder.includes(projectId)`
  (`packages/shared/src/utils/prosjektkort.ts:169-178`), brukt `kort/[projectId].tsx:223-227`.
- **Bekreft dag:** `tilleggSynlighet` (`bekreftDagTillegg.ts:74-82`): `maskin = projectId != null && harEquipment`,
  `varer = projectId != null && varelagerProsjektIder.includes(projectId)`, `seksjon = maskin || varer`
  (gate `bekreft-dag.tsx:516`). `tilleggTilstand` (`:166-177`): `varerTillatt = !startSendt && timerRader.some(projectId)`.
  Knapper «+ Maskin» ved `synlig.maskin` (`BekreftDagTilleggSeksjon.tsx:130-137`), «+ Varer» ved
  `synlig.varer && tilstand.varerTillatt` (`:139-146`).
- **Samlesidens chips** er rene data-signaler (`ProsjektkortSamleside.tsx:228-247`): Arbeid alltid, Maskin når
  `summer.maskin > 0`, Varer når `summer.varer` ikke er null (`telteKortVarer` ikke-tom, `:224`), Reise/Utlegg > 0.
  `beregnKortSummer` (`prosjektkort.ts:65-94`), `telteKortVarer` (`prosjektkortMobil.ts:126-131`, filtrerer projectId +
  `syncStatus !== "avvist"`).

### 1.5 Radikoner på prosjektkortet (Kenneths telefonbilde 07.11)

`TimerRadVis` (`TimerSeksjon.tsx:700-948`) tegner pr. rad, bare når `redigerbar` (`:863-887`, hitSlop 8, `p-1.5`):
**Pencil** 16 #6b7280 (`:866-870`) → `onRediger` (`setRedigerRadId(rad.id); setVisModal(true)`, `:551-554`);
**Split** 16 #6b7280 (`:873-877`) → `onSplitt` → `SplittRadModal radType="timer"` (`:556`, `:684-695`);
**Trash2** 16 #dc2626 (`:880-884`) → `onSlett` → `fjern(rad.id)` **uten bekreftelse**, med tombstone (`:557`, `:455-487`).
Dekor: Pencil 12 #9ca3af foran beskrivelsen (`:853`), Car 15 (`:824`), ChevronRight 16 (`:903`), CheckSquare/Square 18 på
matpause (`:922-926`, `:940`). **Hovedraden er en `View`, ikke `Pressable` (`:817-818`)** — trykk på raden åpner ingenting.
Bare sekundærlinja «Prosjekt · Byggeplass» er trykkbar (`:894-904`, min-h 44) → `ProsjektByggeplassVelgerModal`
(`:555`, `:660-676`); byggeplassbytte lagres direkte, prosjektbytte går via full `TimerRadModal` (`:415-453`).
Samme mønster i `MaskinSeksjon.tsx:340-436` (Pencil `:414`, Split `:421`, Trash2 `:428`; rad `View` `:385`),
`TilleggSeksjon.tsx:283/290/297` (`View` `:260`) og `UtleggSeksjon.tsx:261/264` (`View` `:231`). `ProsjektGruppe.tsx` tegner
ingen rad-ikoner selv (bare ChevronDown/Right `:151-155` ved `visHeader`). Dette er den «blandede skriften» i bildet:
beskrivelse `text-xs italic`, tid `text-sm`, ikoner i tre farger på hver rad.

---

## 2. Oversikt over dagen (#9) — **vedtatt A (K1)**

Mål: hver dag svarer på «hva er registrert?» uten å åpne kort — og viser *at* maskin og varer er fylt ut der det er
aktuelt (Kenneth 07.11). Regler:

**R1 Én sum.** Dagsummen står én gang, øverst, i vanlig tekst. `SummeringsBanner` (`:994`), toppTekst-boksen
(`:75-82`) og den blå sum-boksen (`:159-170`) faller bort **i kortmodus** (dagskort-grenen beholder alle tre, § 5).
**R2 Én farge.** Amber (`#f59e0b` kant/prikk, `#b45309` tekst) brukes for og bare for «Ikke sendt», «Returnert» og
«Mangler». Ingen grønn, gul, oransje eller blå flate i innholdet. Send-knappen er mørk nøytral (`bg-gray-900`), ikke blå,
så den ikke konkurrerer med statusfargen. Regelen følger [ui-standarder.md § Feltstatus](retningslinjer/ui-standarder.md):
«kant og prikk, aldri fyll», «fargen erstatter aldri teksten».
**R3 To skriftstørrelser i innholdet.** Prosjektnavn `text-base font-semibold text-gray-900`; alt annet `text-sm`.
Etiketter `text-gray-500`, verdier `text-gray-900`, tall `tabular-nums`. `text-[10px]`-badges og `text-xs` utgår.
**R4 Verdier, ikke bare tall.** Maskin viser maskinnavn, varer viser navn · mengde, arbeid viser fra–til.
**R5 Ingen radikoner.** Se § 2.5.

### 2.1 A — faste linjer pr. prosjekt (VEDTATT)

Ett kort pr. prosjekt med **alltid de samme linjene i samme rekkefølge**, etikett-kolonne 72 px grå:

```
2041 Lillestrøm skole                       ● Returnert
Lillestrøm skole
Arbeid        07:24–11:30 · 4,0 t
Maskin        Hjulgraver 8 t · 3,0 t
Varer         Knust fjell 0–32 · 4 t
              Fiberduk · 60 m
Beskrivelse   Graving grøft nordside, lagt fiberduk
```

- **Arbeid** og **Beskrivelse** vises alltid. **Maskin** og **Varer** vises **bare når de er aktuelle** for prosjektet
  (regel under); tomt-men-aktuelt = «–» i `text-gray-400`, så hullet synes. Reise (og Utlegg) vises bare når ført,
  etter Beskrivelse.
- **«Aktuelt» — presis regel (Kenneth: «viser at maskintimer er fylt ut og dersom det er aktuelt med varer/materiell,
  at også dette er fylt ut»):**

  | Linje | Vises når (ELLER) | Kode-referanse (målt § 1.4) |
  |---|---|---|
  | Maskin | (a) firmaet har utstyr i lokal cache: `harEquipmentCache` / `harEquipment` · (b) maskin er ført på prosjektet i dag: `summer.maskin > 0` | (a) `[id].tsx:206,283-288`, `BekreftDagTilleggSeksjon.tsx:71-81`, `maskinKatalog.ts:40-92` · (b) `prosjektkort.ts:65-94` |
  | Varer | (a) prosjektet har varelager: `prosjektIderMedVarelager.includes(projectId)` · (b) varer er ført på prosjektet i dag: `telteKortVarer(...)` ikke-tom | (a) `vareKatalog.ts:94-97`, `prosjektkort.ts:169-178` · (b) `prosjektkortMobil.ts:126-131` |

  (a) er samme signal som styrer «+ Maskin»/«+ Varer» i Bekreft dag (`tilleggSynlighet`, `bekreftDagTillegg.ts:74-82`),
  så oversikten og Bekreft dag er enige om hva som er aktuelt. (b) sikrer at ført data aldri skjules selv om cachen er
  tom (offline, modul slått av etterpå). **Ingen per-bruker maskinkapabilitet finnes i koden** (§ 1.4); regelen kan ikke
  bruke en — og skal ikke innføre en (ville være ny rettighetsmodell, utenfor ordren). Blir en slik kapabilitet vedtatt
  senere, legges den inn som (c) i samme ELLER.
- Arbeid: ett segment pr. linje (`fra–til · timer`); overtid som egen underlinje «overtid 50 % fra 14:30 · 1,0 t»
  (visning her; redigering og «Legg til overtid»: ORDRE 35). Flere byggeplasser (L4): byggeplassnavn etter tiden på
  hvert segment.
- «Mangler» (amber tekst + 3 px amber venstrekant på linjen) kun der regelen i § 2.3 slår inn.
- Sum-kort øverst: «**Sum i dag** 8,1 t arbeid · 3,0 t maskin · 0,5 t reise», under «Norm 7,5 t · ramme 06:52–15:31 ·
  pause 30 min», så statusordet («● Ikke sendt» / «Sendt 15:40» / «● Returnert»). Rammen med «Endre»/byggeplass flyttes
  hit fra den stiplede boksen (én boks mindre). Maskin-summen vises bare når maskin er aktuelt for minst ett prosjekt.
- **Trykk på en linje åpner redigering** (§ 2.5). Trykk på prosjektnavnet åpner kortskjermen som før (§ 2.4).
- **«+ Nytt prosjektkort»** under kortene åpner Bekreft dag-flyten for datoen (§ 10.3), ikke lenger tomt kort.

### 2.2 B — kvittering (FORKASTET, K1)

Samme data uten etiketter, tomme kategorier utelatt. Forkastet av Kenneth 2026-11-07 fordi en tom kategori er usynlig:
arbeideren kan ikke se forskjell på «ingen maskin i dag» og «glemte maskinen», og «mangler» måtte sies med egen linje.
Beholdes i `skisser.html` (`oversiktB`) som referanse, merket forkastet.

### 2.3 Hva «mangler» betyr (amber) — **K3 vedtatt: ja**

| Tilstand | Markering | Kilde |
|---|---|---|
| Sedel ikke sendt (draft) | «● Ikke sendt» i sum-kortet | `sedelStatus` |
| Kort returnert | «● Returnert» ved prosjektnavnet | `kortStatus()` (`prosjektkort.ts:136-148`) |
| **Arbeid > 0 og ingen beskrivelse på noen arbeidsrad for prosjektet** | «Mangler» på Beskrivelse-linjen + amber venstrekant | § 3.1 (**K3 ja**, Kenneth 2026-11-07) |
| Sync-feil på en rad | «● Ikke sendt: …» på linjen | `syncStatus` (som `VareforbrukLesListe` i dag) |

Siden beskrivelsen er **påkrevd** i Bekreft dag (§ 3.1), oppstår «Mangler» i praksis bare for rader som er laget utenom
Bekreft dag (redigering som tømmer feltet, web, eldre sedler). Markeringen beholdes fordi Send-knappen på oversikten ikke
sperres av den (K3 er visning; sperren gjelder Bekreft/Ferdig i Bekreft dag). Trykk på «Mangler»-linjen åpner redigering
av prosjektets første arbeidsrad med fokus i beskrivelsesfeltet (§ 2.5).

«Attestert» vises som grått ord («Attestert 7. nov»), ikke grønt badge — grønn er ingen handling for arbeideren.

### 2.4 Hva som ikke endres

Kortskjermen `/timer/[id]/kort/[projectId]` (B-skjermen) er uendret. Trykk på prosjektnavnet åpner den som før. Toppbaren
med `TimerStatusMerkelapp` er felles med dagskortet og endres ikke (§ 5).

### 2.5 Fjernes fra oversikten: radikoner (Kenneth 07.11)

Kenneths telefonbilde av prosjektkortet viser blyant-, splitt- og søppelikon på hver rad og blandet skrift (målt § 1.5).
Vedtak: **oversikten får ingen radikoner.** Endring skjer ved å trykke på linjen.

- Linjene Arbeid / Maskin / Varer / Beskrivelse i oversikten er `Pressable` (min-h 44, hele bredden), **uten** Pencil,
  Split, Trash2 eller dekor-Pencil. Ingen ChevronRight — hele kortet er ett visuelt stykke.
- Trykk på **Arbeid**-segment → `TimerRadModal` for den raden (samme modal som Pencil åpner i dag, `TimerSeksjon.tsx:551-554`).
  Trykk på **Maskin**-linje → maskin-radens modal (`MaskinSeksjon.tsx:251`). Trykk på **Varer**-linje → `KortVareforbrukModal`
  for linjen. Trykk på **Beskrivelse** → `TimerRadModal` for prosjektets første arbeidsrad, med fokus i beskrivelsesfeltet.
  Trykk på tom linje («–») → samme modal i opprettelses-modus for den typen (maskin: rad-modal med maskinseksjon;
  varer: `KortVareforbrukModal`).
- **Splitt** og **slett** flyttes inn i redigeringsmodalen som handlinger nederst («Del opp raden», «Slett raden» med
  bekreftelsesmodal etter [ui-standarder.md](retningslinjer/ui-standarder.md) — i dag sletter Trash2 uten bekreftelse,
  `TimerSeksjon.tsx:455-487`). `SplittRadModal` gjenbrukes uendret.
- Gjelder **bare oversikten** (den nye komponenten, § 5 I2). `TimerRadVis` i `TimerSeksjon` beholder ikonene for
  dagskortet (P11) og for kortskjermen `kort/[projectId]` inntil den vedtas endret (§ 9).

---

## 3. «Hva gjorde du i dag?» i Bekreft dag (#10/11) — **vedtatt A (K2), PÅKREVD**

### 3.1 Plassering og felles regler

- Ett felt pr. prosjekt, rett under arbeidstiden (under pause-raden i prosjektets **første** arbeidsblokk, dvs. etter
  `:718-746`). Ved L4 med flere segmenter på samme prosjekt gjentas ikke feltet. Hvert prosjekt i forslaget får sitt eget
  felt.
- Etikett: «Hva gjorde du i dag?» (`timer.felt.radBeskrivelse` er i dag «Hva gjorde du?» — gjenbrukes, se § 6).
- **PÅKREVD (Kenneth 2026-11-07, strengere enn K3):** «Bekreft og lagre» sperres til **hvert prosjekt med arbeid > 0**
  har en beskrivelse (ikke-tom etter trim). Prosjekter som bare har reise, eller der arbeidsblokken er fjernet (Trash2
  `:651`, `arbeidFjernet`), krever ingen beskrivelse. Det samme gjelder «Ferdig» i pluss-flyten (§ 10, samme skjerm,
  samme knapp).
- **Slik vises sperren (feltstatus-regel + mikrotekst § 3a):**
  1. Før første forsøk: feltet er nøytralt (`border-gray-300`), ingen rød markering — påkrevd-tomt markeres først etter
     lagreforsøk ([ui-standarder.md § Feltstatus](retningslinjer/ui-standarder.md)). Knappen er **aktiv** (ikke nedtonet),
     så arbeideren får forklaringen i stedet for en død knapp.
  2. Trykk på Bekreft med tomt felt: ingen lagring; feltet får `border-red-400 bg-red-50` (samme som `Valgfelt`-feil,
     `bekreft-dag.tsx:708-730`), skjermen ruller til første tomme felt og setter fokus (tastatur opp), og under feltet
     står mikroteksten (rød `text-xs`):
     **«Skriv hva du gjorde på {{prosjekt}} før du bekrefter. Lederen din ser det på sedelen.»**
     — § 3a: *hvor* (sedelen), *hvem får ballen* (lederen din, relasjonell benevnelse), *hva ser motparten* (teksten).
  3. Når feltet fylles, forsvinner rød ramme og tekst umiddelbart (ikke vent på nytt forsøk). Ved flere prosjekter
     markeres alle tomme felt samtidig; rull til det første.
  4. Ingen Alert, ingen toast (ui-standarder: ingen bannere uten tydelig behov).
- **Gjelder også offline:** sperren er en ren lokal vakt i skjermen (`bekreft`, `:256`) over forslagets `beskrivelse`
  pr. prosjekt — ingen server-kall, ingen synk-avhengighet. `bekreftDag()` (`bekreftDag.ts:67`) skal i tillegg avvise
  et forslag med arbeid > 0 og tom beskrivelse (returnerer `{ type: "manglerBeskrivelse", projectIds }`), så vakten holder
  også om skjermen omgås (test § 8.14).
- Fritekst er lov, men forslagene gjør det til ett trykk i det vanlige tilfellet.

**Forslagskilde (offline-trygg, lokal DB):** de 2 sist brukte **distinkte** `sheetTimerLocal.beskrivelse` for samme
`projectId` siste 30 dager (nyeste først, `beskrivelse IS NOT NULL AND erReise = 0`), + aktivitetsnavnet fra forslaget
som tredje chip når det ikke alt er blant de to. Ingen server-kall. Første gang på et prosjekt: bare aktivitetschipen.
Framtid (ikke nå): firma-standardbeskrivelser pr. aktivitet (`OrganizationSetting`), jf. «forhåndsdefinerte valg».

### 3.2 A — chips + felt, synlig i blokken (VEDTATT)

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
- Sperret tilstand (§ 3.1 pkt. 2): feltet `border-red-400 bg-red-50`, mikrotekst under, chips uendret (ett trykk på en
  chip løser sperren).

### 3.3 B — velgerrad → ark (FORKASTET, K2)

Rad i `Valgfelt`-stil som åpner et ark. Forkastet av Kenneth 2026-11-07: spørsmålet blir gjemt bak en rad og dobler
klikkene i det vanlige tilfellet (P4). Skissen er tatt ut av figuren og erstattet med A i sperret tilstand.

### 3.4 Datafelt og skriving

- **Feltet er `sheetTimerLocal.beskrivelse`** — det samme som prosjektkortets rad-beskrivelse (§ 1.2 F7). Ikke et nytt
  felt, ingen schema-endring.
- `Dagsforslag` får `beskrivelse: string | null` **pr. prosjekt** (ikke pr. segment); `anvendDagsforslag` skriver verdien
  på prosjektets **arbeidsrader** i `db.insert(sheetTimerLocal)` (`dagsforslagAnvend.ts:141-170`). Reise- og mellomrader
  får `null` som i dag.
- Oversikten (§ 2) viser prosjektets **distinkte** beskrivelser (én linje pr. distinkt verdi); vanligvis én.
- Sedel-kommentaren `dailySheetLocal.beskrivelse` er **uendret og utenfor scope** (dagskortets felt, § 5).
- Kortskjermens `TimerRadModal` fortsetter å redigere samme felt pr. rad — ingen endring der.

### 3.5 Overtid → ORDRE 35

Overtid-merket (`:662-674`) og redigeringspanelet (`:675-717`, ORDRE 34) ligger **over** pause-raden; beskrivelsesfeltet
kommer **under** pause, så rekkefølgen i blokken er tid → overtid → pause → beskrivelse. «Legg til overtid» og videre
overtid-oppførsel: **ORDRE 35 (Redesign)** — ikke spesifisert her.

---

## 4. Klikktelling (P4)

| Flyt | I dag | Vedtatt (A + påkrevd) |
|---|---|---|
| Bekreft dag, ett prosjekt, beskrivelse som passer et forslag | 2 (beskrivelse ikke mulig) | **3** |
| Bekreft dag, ett prosjekt, beskrivelse skrevet selv | 2 + 3 (kort → rad → felt) + tekst | 3 + tekst |
| Bekreft dag, ett prosjekt, uten beskrivelse | 2 | **sperret** (ikke mulig) |
| Ny registrering fra «+» (P1), GPS-prosjekt kjent, forslag passer | «+» → modal → Lagre = 3 (ingen beskrivelse) | «+» → chip → Bekreft = **3** (med beskrivelse) |
| Ny registrering fra «+» (P1), prosjekt må velges | «+» → velger → prosjekt → Lagre = 4 | «+» → prosjekt → chip → Bekreft = **4** |
| Se hva som er registrert på et prosjekt (maskin/varer/beskrivelse) | 1–2 (kort → rad) | **0** |
| Rette en arbeidsrad fra oversikten | 2 (kort → blyant) | **1** (trykk på linjen) |

Pluss-flyten koster ikke mer enn i dag, men gir beskrivelse, maskin og varer i samme skjerm.

---

## 5. 🟢 VEDTATT — isolering av dagskort fra prosjektkort (K4 = I2, Kenneth 2026-11-07)

**Kenneth:** *«Isoler dagskort og prosjektkort fra hverandre slik at dagskort ikke påvirkes av nye endringer.»*

**Målt deling i dag:** `app/timer/[id].tsx` bærer begge modusene i én fil (bryter `kortModus` `:591-596`; grener `:1007`,
`:1270-1356`, `:1359/:1370`, `:1435-1439`). `ProsjektGruppe`, `VareforbrukLesListe`, `TimerSeksjon`, `SummeringsBanner`
og `FraTilTidFelt` importeres av begge sider. Kortskjermen (`kort/[projectId].tsx`) importerer `ProsjektGruppe` og
`KortHode`. `ProsjektkortKontekst` (`prosjektkortKontekst.ts:9-13`) er den eneste eksisterende isoleringsmekanismen og
virker **inne i** delte komponenter, ikke mellom skjermene. ORDRE 34 innførte vakt-testen
`dagskort-isolert-vakt.test.ts` (leser `[id].tsx`, `KortVareforbrukModal.tsx`, `MaskinSeksjon.tsx` som tekst og asserts
at dagskortet ikke inneholder `forblirApen`, `fortIDag`, `overtidValg`, `overtidFra`, `overtidLonnsartId`, `stegOvertidFra`).

**Vedtak (K4 = I2):** prosjektkortet flyttes ut av `[id].tsx` i **en egen leveranse FØRST** (Redesign, ORDRE 35), før
§ 2, § 3 og § 10 bygges:

- Hele kortModus-grenen ut av `[id].tsx` til egen skjermfil `app/timer/[id]/prosjektkort.tsx` (eller komponent
  `ProsjektkortSkjerm.tsx` som `[id].tsx` returnerer tidlig på `kortModus`). Delte byggeklosser (`FraTilTidFelt`,
  `TidFeltBoks`, velgere) forblir delt; alt som *tegner* kort (KortHode, den nye oversikten § 2, VareforbrukLesListe-bruk i
  kortmodus) lever under `timer-detalj/prosjektkort/`.
- **Gate for I2-leveransen:** diff i dagskort-grenen = 0 linjer; snapshot-test som rendrer `[id]` i dagskort-modus og
  sammenligner mot `b3e96829`; `ProsjektkortKontekst` beholdes for `TimerSeksjon`/`TimerRadModal` som fortsatt deles
  fra kortskjermen; vakt-testen utvides med navnene § 2/§ 3/§ 10 innfører (`ProsjektkortDagsoversikt`,
  `manuellDato`/`opprinnelse`, `manglerBeskrivelse`, `aapneBekreftDagForDato` o.l.) — assert at `[id].tsx` ikke inneholder dem.
- Konsekvens: `SummeringsBanner`, toppTekst og blå sum-boks fjernes **bare** fra kortmodus. Dagskort-brukere ser ingen
  forskjell. P10/P11 (dagskortets «+»-innganger) er uendret.
- Ikke isolert med dette vedtaket (må vedtas separat hvis ønsket): `ProsjektGruppe` og `TimerSeksjon` brukt fra
  kortskjermen (`kort/[projectId].tsx`). En endring der treffer begge i dag — derfor gates § 10.4 (P3) på
  `ProsjektkortKontekst` med dagens oppførsel som default.
- I1 (to linjer i `[id].tsx`) er **ikke** valgt.

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
| `timer.dagsoversikt.nyRegistrering` | «+ Legg til timer» | § 10.3 (erstatter `timer.prosjektkort.nyttKort` i oversikten) |
| `timer.dagsoversikt.delOpp` / `.slettRad` / `.slettRadBekreft` | «Del opp raden» / «Slett raden» / «Raden fjernes fra sedelen din. Lederen din ser den ikke.» | § 2.5 (handlinger i modalen) |
| `timer.bekreftDag.beskrivelse.etikett` | «Hva gjorde du i dag?» | § 3 (eller endre `timer.felt.radBeskrivelse` → samme tekst begge steder, K-spørsmål til Redesign) |
| `timer.bekreftDag.beskrivelse.placeholder` | «Skriv selv …» | § 3.2 |
| `timer.bekreftDag.beskrivelse.paakrevd` | «Skriv hva du gjorde på {{prosjekt}} før du bekrefter. Lederen din ser det på sedelen.» | § 3.1 sperre-mikrotekst |
| `timer.bekreftDag.manuell.tittel` | «Legg til timer» | § 10 topplinje i manuell modus |
| `timer.bekreftDag.manuell.hint` | «Tidene er firmaets standard. Rett dem før du bekrefter.» | § 10.2 (erstatter «Tidene kommer fra stemplingen …» i manuell modus) |
| `timer.bekreftDag.manuell.velgProsjekt` | «Velg prosjektet du jobbet på» | § 10.2 (tom-prosjekt-sperre, gjenbruker `Valgfelt`-feil) |

Nøkler som **slutter** å brukes i kortmodus: `timer.prosjektkort.toppTekst`, `timer.prosjektkort.sumIDag`,
`timer.prosjektkort.nyttKort` (beholdes i fila — dagskort/web kan bruke dem). `timer.bekreftDag.beskrivelse.sistBrukt` /
`.skrivSelv` (B) utgår.

---

## 7. Vedtak (Kenneth 2026-11-07)

| # | Spørsmål | Vedtak |
|---|---|---|
| K1 | Oversikt: A faste linjer eller B kvittering? | **A.** Maskin og Varer bare når aktuelle (§ 2.1-regelen). B forkastet. |
| K2 | Beskrivelse i Bekreft dag: A chips + felt eller B velgerrad → ark? | **A — og PÅKREVD.** Bekreft/Ferdig sperres til hvert prosjekt med arbeid > 0 har beskrivelse, også offline (§ 3.1). B forkastet. |
| K3 | Tom beskrivelse på prosjekt med arbeid > 0 = «Mangler» (amber) i oversikten? | **Ja** (§ 2.3). |
| K4 | Isolering: I1 to linjer eller I2 egen skjermfil først? | **I2.** Egen leveranse først (Redesign, ORDRE 35), så § 2/§ 3/§ 10 (§ 5). |
| — | Pluss-knappen | **Åpner Bekreft dag-flyten** for valgt dato, samme funksjon som Start dag med GPS (§ 10). |
| — | Radikoner | **Fjernes** fra oversikten; endring ved trykk på linjen (§ 2.5). |

Åpent mot Redesign (ikke Kenneth): om `timer.felt.radBeskrivelse` («Hva gjorde du?») skal endres til «Hva gjorde du i
dag?» så `TimerRadModal` og Bekreft dag bruker samme ord.

---

## 8. Tester / DoD (gate for kode-leveransene)

**Oversikt (§ 2)**
1. Kortmodus, dag med 2 prosjekter: skjermen viser **én** sum; `SummeringsBanner`, toppTekst og blå sum-boks er ikke
   rendret (`queryByText` på «herav», «prosjektkort ·», «Sum i dag … av»).
2. Hvert kort viser Arbeid og Beskrivelse alltid; Maskin bare når `harEquipmentCache` **eller** `summer.maskin > 0`;
   Varer bare når `prosjektIderMedVarelager.includes(projectId)` **eller** `telteKortVarer` ikke-tom. Fire tilfeller pr.
   linje (cache ja/nei × ført ja/nei) → vises i 3 av 4, skjult kun ved nei/nei.
3. Maskin-linjen viser maskinnavn + timer; vare-linjen viser navn · mengde · enhet, én linje pr. vare.
4. Ingen annen fargeklasse enn gray-/amber- i oversiktens innhold (snapshot/regex-test på `className`).
5. Returnert kort → «● Returnert» amber; ikke sendt sedel → «● Ikke sendt» amber; attestert → grått ord.
6. (K3) Arbeid > 0 uten beskrivelse → «Mangler» + amber venstrekant; med beskrivelse → teksten, ingen amber.
7. **Radikoner:** oversikten rendrer ingen `Pencil`, `Split`, `Trash2` (`queryAllByTestId`/ikon-mock = 0); trykk på
   Arbeid-linje åpner `TimerRadModal` med radens id; trykk på «Mangler» åpner modalen med fokus i beskrivelse; «Slett
   raden» i modalen viser bekreftelse før `fjern`.
8. Oversikten viser samme tekst som `TimerRadModal` for raden (samme felt — endring i modalen synes på oversikten).

**Beskrivelse i Bekreft dag (§ 3)**
9. Forslag med 1 prosjekt: ett beskrivelsesfelt under pause-raden; 2 prosjekter → to felt; L4 to segmenter samme
   prosjekt → ett felt.
10. Chips: lokal DB med 3 distinkte beskrivelser på prosjektet siste 30 dager → 2 nyeste + aktivitet; 0 → bare aktivitet;
    trykk på chip fyller feltet; redigert tekst beholdes ved Bekreft.
11. `anvendDagsforslag` med `beskrivelse: "x"` på prosjekt P → alle P-arbeidsrader får `beskrivelse = "x"`, reise-/mellomrader
    `null`.
12. **Sperre:** Bekreft med tomt felt på prosjekt med arbeid > 0 → ingen `bekreftDag`-kall, feltet får `border-red-400`,
    mikroteksten `timer.bekreftDag.beskrivelse.paakrevd` med prosjektnavn vises, fokus i feltet. Fyll feltet → rød ramme
    og tekst borte uten nytt trykk. Prosjekt med bare reise / fjernet arbeid → ingen sperre. To prosjekter, ett tomt →
    bare det tomme markeres.
13. **Offline:** samme test med nettverk av (synk-provider mocket utilgjengelig) → identisk oppførsel; ingen fetch.
14. `bekreftDag()` kalt direkte med forslag der et prosjekt har arbeid > 0 og `beskrivelse` tom → returnerer
    `{ type: "manglerBeskrivelse", projectIds: [P] }`, skriver ingenting til DB.

**Pluss-flyten (§ 10)**
15. P1 (FAB) → `router.push` til `/timer/bekreft-dag` med `{ dato, opprinnelse: "manuell" }`; `NyTimerRadFlyt` rendres
    ikke fra FAB-en. Samme for P4 («+ Legg til timer» i oversikten) med sedelens dato.
16. Manuell modus uten arbeidsdag: skjermen viser forslag med start/slutt/pause fra `hentArbeidsdagTiderLokalt(orgId, dato)`
    (firmastandard 07:00–15:00/30 eller `STANDARD_ARBEIDSTID_FALLBACK`), ikke «Ingen åpen arbeidsdag». Prosjekt tomt →
    `Valgfelt`-feil «Velg prosjektet du jobbet på» ved Bekreft. Innlogget prosjekt (`startvalgForNyRad`) → forhåndsvalgt.
17. Manuell modus, maskin/varer: «+ Maskin» vises ved `harEquipment`, «+ Varer» ved varelager på valgt prosjekt — samme
    `tilleggSynlighet` som Start dag; beskrivelse påkrevd som i test 12.
18. **Eksisterende sedel for datoen:** (a) draft → nye rader appendes, `utvidArbeidstidsvindu` utvider vinduet, hode-pause
    flettes, maskin/varer skrives til sedelen; overlapp med eksisterende rad → `vekForOverlapp` + varsel som i dag;
    (b) sendt/godkjent → lesemodus/`blokkertSendt` som i dag, ingen skriving; (c) ingen sedel → opprettes via
    `finnEllerOpprettDagsseddel`. Etter Bekreft: `router.replace('/timer/{sheetId}')` + i kortmodus videre til oversikten.
19. **Dagskort-isolering:** `[id].tsx:1340-1349` («+ Legg til prosjekt») og `TimerSeksjon`-knappene i dagskort-modus
    (`ProsjektkortKontekst` = false) åpner fortsatt `ProsjektVelgerModal`/`TimerRadModal`, ikke bekreft-dag.
    `dagskort-isolert-vakt.test.ts` utvidet (§ 5) er grønn.
20. `NyTimerRadFlyt` har etter leveransen **ingen** kallere fra «+»-innganger (grep i test: 0 treff utenom egne tester);
    `TimerRadModal` brukes bare med `eksisterendeRad != null` fra oversikten.

**Isolering (§ 5, I2-leveransen)**
21. Snapshot av `[id]` i dagskort-modus fra `b3e96829` er identisk etter leveransen; `git diff` i dagskort-grenen = 0 linjer.
22. Klikktelling § 4 verifisert i test: Bekreft med chip = 3 trykk; «+» → chip → Bekreft = 3 trykk.

---

## 9. Ut av scope

- Sedel-kommentaren `dailySheetLocal.beskrivelse` (dagskortets «Kommentar»).
- Dagskortet `app/timer/[id].tsx` dagskort-gren, P10/P11 (Kenneths isoleringskrav).
- Kortskjermen `kort/[projectId].tsx` sine egne radikoner i `TimerSeksjon`/`MaskinSeksjon` (§ 2.5 gjelder oversikten;
  kortskjermen vedtas separat), `ProsjektGruppe`, `TimerRadModal` (ut over § 2.5-handlingene).
- Web-visningen av dagsseddel/prosjektkort og web-«Mine timer» (P9).
- Overtid («Legg til overtid», videre redigering) — ORDRE 35.
- Per-bruker maskinkapabilitet (finnes ikke; ny rettighetsmodell krever eget vedtak).
- Firma-standardbeskrivelser pr. aktivitet (framtidig forhåndsdefinert valg, § 3.1).
- Redigering av en eksisterende rad: fortsatt `TimerRadModal` (§ 10.5) — ikke bekreft-dag.

---

## 10. Pluss-knappen åpner Bekreft dag-flyten (Kenneth 2026-11-07)

**Kenneth:** pluss-knappen skal gi *samme funksjon* som Start dag med GPS («veldig bra», enkel, flere varer).

### 10.1 Prinsipp

Alle «+»-innganger til **ny** timeregistrering (P1, P3 i kortmodus, P4 — § 1.3) åpner `/timer/bekreft-dag` for valgt
dato i stedet for `NyTimerRadFlyt`/`TimerRadModal`. Skjermen, forslaget, maskin/varer-seksjonen og den påkrevde
beskrivelsen (§ 3) er **de samme** som ved Slutt dag. Det gamle skjemaet (`TimerRadModal`) brukes bare til å **redigere en
eksisterende rad** (§ 2.5, § 10.5).

### 10.2 Ny manuell modus i `bekreft-dag.tsx` (funksjonsendring, hjemmel: ordren 2026-11-07)

Målt (§ 1.2 F8): skjermen krever i dag en `paagaar`-arbeidsdag og kan ikke åpnes uten. Derfor:

- **Params:** i tillegg til dagens (`arbeidsdagId, sluttIso, endLat, endLng, sisteSegmentKilde`) godtas
  `{ dato: "YYYY-MM-DD", opprinnelse: "manuell", projectId?: string }`. Med `opprinnelse = "manuell"` leses ingen
  `arbeidsdagLocal`; «Ingen åpen arbeidsdag» (`:369-378`) vises ikke.
- **Tider uten GPS:** start og slutt forhåndsutfylles fra `hentArbeidsdagTiderLokalt(orgId, dato)`
  (`kalenderKatalog.ts:144-165` → `organizationSettingLocal.standardStartTid/-SluttTid/-PauseMin`, fallback
  `STANDARD_ARBEIDSTID_FALLBACK`) — samme kilde som `dagsseddelOpprett.ts:91-103`. Finnes det alt arbeidsrader på sedelen
  for datoen, settes start = seneste `tilTid` (som `TimerSeksjon.tsx:1127-1154`, «fortsett der du slapp»), slutt =
  firmaslutt; er seneste `tilTid` ≥ firmaslutt, settes slutt = start + 1 t. Pause = firmastandard bare når sedelen ikke
  alt har hode-pause (ellers 0, så hode-pausen ikke dobles — jf. ORDRE 34 lokal pausehode-synk). Tidene rettes i
  `FraTilTidFelt` som i dag (`:654-660`). Hint-teksten under forslaget byttes til `timer.bekreftDag.manuell.hint`.
- **Forslaget** bygges med `beregnDagsforslag` fra et syntetisk input: ett segment `dato start–slutt`, `sluttTidKilde =
  "bruker"`, ingen GPS-punkter (`endLat/endLng` tomme → ingen reise, ingen stedsforslag), `sisteSegmentKilde = "system"`.
  `kappGlemtDagSlutt`/`splittVedMidnatt` (`dagsforslag.ts:693-713`) virker uendret.
- **Prosjekt:** `projectId`-param (fra P3/P4) → forhåndsvalgt og låst som på kortskjermen (`prosjektLaast`,
  `prosjektkortMobil.ts:145-157`). Uten param: `startvalgForNyRad` (`nyTimerRad.ts:142` — innlogget prosjekt via GPS/innsjekk)
  → forhåndsvalgt; ellers tomt `Valgfelt` Prosjekt, og Bekreft med tomt prosjekt gir `Valgfelt`-feil
  (`border-red-400 bg-red-50`, `:708-730`) med `timer.bekreftDag.manuell.velgProsjekt`. Byggeplass/aktivitet som i dag.
- **Maskin, varer, beskrivelse:** uendret fra Start dag — `tilleggSynlighet` (§ 1.4), `BekreftDagTilleggSeksjon`, § 3
  påkrevd beskrivelse. Overtid-merke/redigering som ORDRE 34 (merket vises når tidene krysser firmaslutt/norm).
- **Ikke ansatt:** samme sjekk som `NyTimerRadFlyt.tsx:75-88` (`erAnsattIValgtFirma`/`hentLagretAnsattStatus`) **før**
  navigasjon, i inngangen — Alert som i dag.
- **Bekreft:** `bekreftDag(db, forslag, ctx)` med `arbeidsdagId: null`, `sluttIso` = valgt slutt, `endLat/endLng` null.
  `bekreftDag` hopper over `arbeidsdagLocal`-avslutning når `arbeidsdagId` er null (ingen arbeidsdag å lukke). Resten
  (`anvendDagsforslag`, `rensTillegg`, `maskinBrudd`, `playVek`) uendret. Navigasjon etter suksess:
  `router.replace('/timer/{sheetId}')` som i dag (`:283`); i kortmodus lander det på oversikten (§ 2) — kortskjermen
  åpnes ikke automatisk.
- Topplinje i manuell modus: `timer.bekreftDag.manuell.tittel` («Legg til timer»), dato-rad som i dag.

### 10.3 Inngangene som endres (§ 1.3)

| # | Fil:linje | Ny oppførsel |
|---|---|---|
| P1 | `DagsseddelListe.tsx:300-306` | `router.push({ pathname: "/timer/bekreft-dag", params: { dato: iDag(), opprinnelse: "manuell" } })` etter ansatt-sjekk. `NyTimerRadFlyt` fjernes fra `DagsseddelListe` (og slettes når den ikke har flere kallere — test 20). |
| P4 | `ProsjektkortSamleside.tsx:112-122` → ny oversikt (§ 2) | Knappen heter «+ Legg til timer» (`timer.dagsoversikt.nyRegistrering`) og åpner bekreft-dag med sedelens `dato`. `ProsjektVelgerModal` i `[id].tsx:1431-1448` brukes ikke lenger fra kortmodus (dagskort-grenen beholder den, P10). |
| P3 | `TimerSeksjon.tsx:513-524`, `:565-578` **når `ProsjektkortKontekst` = true** | Åpner bekreft-dag med `{ dato, opprinnelse: "manuell", projectId }`. Når konteksten er false (dagskort, P11): uendret `TimerRadModal`. Gaten er en prop `nyRadHandling?: () => void` fra `ProsjektGruppe`/kortskjermen, default = dagens oppførsel (jf. `feedback_dagskort_isolert`: delt komponent får prop med dagens default + vakt-test). |

### 10.4 Isolering mot dagskortet

- P10 (`[id].tsx:1340-1349`) og P11 endres **ikke**. `TimerSeksjon` får ingen ny default-oppførsel; bare kortskjermen
  sender `nyRadHandling`. Vakt-testen (§ 5) asserts at `[id].tsx` ikke inneholder `nyRadHandling`, `opprinnelse` eller
  `bekreft-dag`.
- `StartSluttDagKort` (Start/Slutt dag) er uendret; `_onNyRad` forblir ubrukt.

### 10.5 Når det allerede finnes en seddel for datoen (fletting, målt)

`bekreftDag` → `anvendDagsforslag` (`dagsforslagAnvend.ts`) håndterer dette i dag, og pluss-flyten gjenbruker det uendret:

- `finnEllerOpprettDagsseddel` (`dagsseddelOpprett.ts:67-89`) returnerer eksisterende sedel **urørt** med
  `eksisterte: true`; ny sedel får start/slutt/pause fra argumentene.
- **Sendt/godkjent sedel:** hoppes over med `blokkertSendt` (`dagsforslagAnvend.ts:117-125`); forslaget merker segmentet
  `blokkert` (`dagsforslag.ts:849-852`); er alle segmenter blokkert viser skjermen lesemodus (`bekreft-dag.tsx:402,
  :435-446`) med lenke til sedelen. Pluss-flyten på en sendt dag ender altså i lesemodus — som i dag for `TimerRadModal`
  (`erRedigerbar` false).
- **Draft/returned:** radene **appendes** (`:141-170`); `utvidArbeidstidsvindu` (`:130-139`, `:222-257`) utvider sedelens
  `startAt`/`endAt` bare utover (endAt kun når `sluttTidKilde === "bruker"` — manuell modus setter «bruker», så en
  senere slutt flyttes); hode-pause flettes (`:173`); maskin/varer skrives til start-sedelen når den ikke er blokkert
  (`:177-179`). **Overlapp** med eksisterende manuell rad: play-raden viker (`vekForOverlapp`, `dagsforslag.ts:955-961`)
  → `playVek`-varsel (`:1127-1131`, `bekreft-dag.tsx:302-308`). I manuell modus er «fortsett der du slapp» (§ 10.2)
  standard, så overlapp oppstår bare når brukeren selv retter tidene bakover.
- `aapnetEksisterende` er **ikke** en flette-mekanisme: den finnes bare som query-param satt av `NyTimerRadFlyt.tsx:153`
  og lest av dagskortet (`[id].tsx:189, :222-224, :1046-1056`) for notisen `timer.dagFinnes.notis`. Pluss-flyten setter den
  ikke; oversikten (§ 2) viser i stedet de nye radene direkte.
- Redigering av en rad som alt finnes går aldri via bekreft-dag — trykk på linjen (§ 2.5) → `TimerRadModal`.

### 10.6 Rekkefølge og eierskap

1. I2-leveransen (§ 5) — Redesign, ORDRE 35, egen gate.
2. § 2 oversikt + § 2.5 ingen radikoner + § 10.3 P4 — i den nye skjermfila.
3. § 3 påkrevd beskrivelse + § 10.2 manuell modus i `bekreft-dag.tsx` + § 10.3 P1/P3.
4. Overtid «Legg til overtid» — ORDRE 35, utenfor denne spec-en.

Hvert steg gates mot vakt-testen (§ 5) og testene i § 8.
