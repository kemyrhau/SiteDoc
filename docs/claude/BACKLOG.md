---
name: BACKLOG
description: Konsolidert backlog — alt planlagt men ikke ferdig, kategorisert. STATUS-AKTUELT.md eier kun aktivt arbeid (maks 3 PR).
sist_verifisert_mot_kode: 2026-05-16
---

# Backlog

All planlagt-men-ikke-startet eller deprioritert arbeid samles her, slik
at STATUS-AKTUELT.md kan holdes kort (kun aktive PRs). Nye oppgaver
plasseres i riktig kategori. Når en oppgave startes, flyttes den til
STATUS-AKTUELT.md § Pågående arbeid; ferdige PRs flyttes videre til
`historikk-YYYY-MM.md` etter prod-deploy.

Legenda: 🔴 ikke startet · 🟡 delvis · ⏸️ parkert · ❓ trenger avklaring.

## 1. Teknisk gjeld

### MASKIN-TIMER KOBLING — arkitektursvikt (høy prioritet)

Kenneth-avklaring 2026-05-16: Maskintimer er en del av arbeidsdagen,
ikke additivt. `sum(SheetMachine.timer) ≤ sum(SheetTimer.timer)` per sedel.

Nåværende feil: maskin og timer faktureres som to separate summer.
Korrekt: maskin er utstyrsbidrag av samme tidsperiode.

Krever:
1. Server-validering: `maskin.timer ≤ total worker.timer` ved opprett/oppdater
2. UI: vis maskin som underpost av timer-seksjonen, ikke separat
3. Attestering: `splittRad` på maskin bør validere mot timer-totalsum
4. Mobil: samme logikk

Tas i planleggingssesjon — ingen videre koding i mellomtiden.

Se [fase-0-beslutninger.md T.7](fase-0-beslutninger.md) for full spec (låst 2026-05-16) — flytskille arbeidstaker/attestering/Byggherre-godkjenning + dagsseddel-struktur per prosjekt+ECO.

### Dokumentflyt send-modal redesign (høy prioritet — grunnleggende UX)

**Oppdaget 2026-05-25** ved gjennomgang av mobilens `DokumentHandlingsmeny.tsx`. Gjelder både oppgave og sjekkliste (samme komponent).

**Problemet:** Dagens send-modal blander fire konseptuelle kategorier i én flat ActionSheet-liste uten visuell separasjon:

| # | Kategori | Eksempler |
|---|---|---|
| A | Flyt-progresjon i AKTIV flyt | Send til primær, Svar avsender, Send tilbake |
| B | Flyt-bytte til ANNEN flyt | «Andre faggrupper» = annen dokumentflyt |
| C | Godkjenner-respons | Godkjenn, Avvis |
| D | Admin-livssyklus | Godkjenn (forced), Lukk, Trekk tilbake, Gjenåpne |

Konsekvens: brukeren kan ikke se forskjell på «send neste boks i samme flyt» og «forlat denne flyten og bytt til en annen» — to fundamentalt ulike handlinger ser identiske ut. ⚙-tegnet brukes som visuell separator for admin-handlingene, semantisk feil (tannhjul = innstillinger, ikke livssyklus).

**Kjerneinnsikt (Kenneth 2026-05-25):** Brukeren mangler kontekst om HVOR de er i flyten. Send-knapp uten å se boksene/leddene gir ingen orientering. Flyten må visualiseres øverst i send-modalen med brukerens egen boks markert — først da gir «videre» og «tilbake» mening.

**Designbeslutninger låst:**

1. **Flyt-visualisering øverst i modal:** `[Tømrer] → [Byggherre] → [Ledelse]` med markering av brukerens boks. Brukeren ser umiddelbart hvor de står og hvor det går.
2. **«Videre» / «Send tilbake» får semantikk** fordi boksene er synlige — dagens ord-baserte knapper uten kontekst kan tolkes vilkårlig.
3. **Admin-handlinger collapsed under «MER ▾»:** Godkjenn (forced), Lukk, Gjenåpne, Trekk tilbake skjules som standard. Reduserer kognitiv støy for den vanlige flyt-handlingen. Distinkte lucide-ikoner per handling, ikke ⚙.
4. **Gruppenavn i labels:** «Send til Byggherre» (mottaker-navn) > «Send». Forutsigbar konsekvens uten å lese fint.
5. **Flyt-bytte er sekundær handling:** Egen «Flytt til annen flyt»-undermeny (dropdown + søk når ≥3 alternativer). Ikke blandet inn i primær flyt-progresjon. Bekreftelses-modal kreves («Oppgaven flyttes fra X til Y. Forrige flyt forlates»).

**Åpne spørsmål — må avklares før implementasjon:**

- **Mottaker-navn:** Skal vi vise PERSONEN/gruppen som faktisk får oppgaven («Send til Per Hansen (Tømrer)») i stedet for kun gruppenavn? Mer informativt, men lengre tekst på mobil.
- **Videresend ferdig oppgave vs flyt-bytte:** Når status=`approved`/`closed` viser dagens UI «Videresend ▾». Det er konseptuelt forskjellig fra flyt-bytte under aktiv behandling. Skal disse to ha ulik label? («Videresend som referanse» vs «Flytt til ny flyt»)
- **Mobil ActionSheet → custom Modal:** Dagens `ActionSheetIOS` støtter kun flat liste. Gruppert layout + dropdown + søk + flyt-visualisering krever custom `Modal`-komponent (samme mønster som `FirmaVelger`/`ProsjektVelger`). Dette er en større endring i UI-mønster enn skissert.

**Avhengighet:** Variant 3 må implementeres server-side først — ny tRPC-prosedyre `oppgave.hentTilgjengeligeFlyter` (+ tilsvarende for sjekkliste) som returnerer `{ gjeldende, andre[], kanFlytte }` filtrert på brukerens tilgang (admin/registrator/har-ballen/cross-flyt-medlem). Klient bruker `andre[]` i «Flytt til annen flyt»-dropdown. Spec klar; venter på design-runden over.

**Tilgangs-utvidelse i samme runde (`endreStatus` server):** Dagens regel tillater kun admin/registrator å bytte flyt. Utvides til også å tillate «har ballen» (`userId === recipientUserId` eller medlem av `recipientGroup`) og «cross-flyt-medlem» (medlem av både gammel og ny flyt).

**Berører:**
- `apps/mobile/src/components/DokumentHandlingsmeny.tsx` — full omskriving
- `apps/api/src/routes/oppgave.ts` — ny prosedyre + utvidet endreStatus
- `apps/api/src/routes/sjekkliste.ts` — speilet endring
- `packages/shared/src/i18n/*` — nye nøkler for «Flyt», «Flytt til annen flyt», «Mer», bekreftelses-tekst
- Server-tilgangskontroll-helper for å sjekke flyt-medlemskap

**Estimat:** Server ~45 min, mobil-UI ~3 timer (oppgave), sjekkliste ~30 min (gjenbruk). I18n auto-oversett. Totalt ~5 timer Opus-arbeid + EAS-bygg.

### Datamodell og migrasjon

- **P-KRITISK-1 — Sentralbiblioteket ikke seedet i prod** 🔴 — se [oppryddings-plan-2026-04-28.md § P-KRITISK-1](oppryddings-plan-2026-04-28.md). Lovpålagt grunnpakke skal auto-seedes ved firma-opprettelse.
- **P-KRITISK-2 — `FtdChangeEvent` og `FtdTnotaChangeLink` mangler i prod** 🔴 — se [oppryddings-plan-2026-04-28.md § P-KRITISK-2](oppryddings-plan-2026-04-28.md).
- **P-KRITISK-3 — `BibliotekMal` mangler 4 fase-0-besluttede felt** 🔴 — `kategori`, `domene`, `kobletTilModul`, `verifisert`. Se [oppryddings-plan-2026-04-28.md § P-KRITISK-3](oppryddings-plan-2026-04-28.md).
- **DB-naming-audit alias-rydding** 🟡 — etter mobil-app-oppdatering kan alias-feltene fjernes. Se [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md).
- **Cross-package svake FK orphan-deteksjon** 🔴 — `db-maskin` referer til `User.id` via String uten cascade. Backlog-oppgave per [arkitektur-syntese.md § 6.1](arkitektur-syntese.md).
- **Organization vs OrganizationPartner — strategi D (DB-cleanup, 6-8t)** 🔴 — skall-firmaer i test-DB. Strategi C `Organization.erKunde` implementert 2026-05-03. Audit per rad gjenstår.

### Refaktor og rydding

- **40 åpne P-oppgaver i [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md)** 🟡 — P2 faggruppe-rename, P3 drift-detaljer, P4 Kenneth-drøftinger, P5 svakhet-reparering.
- **Firma-administrasjons-navigasjon strukturell rydding (~10-12t)** 🔴 — 3 lag: ~10 ruter trenger `organizationId` som input, ~10 sider må sende `useFirma().valgtFirma.id`, rename av «Firmainnstillinger» → «Prosjekteier». Ikke-blokkerende.
- **Header-koordinering: firma-bytte nullstiller ikke prosjekt** 🔴 — observert 2026-05-03. Kompleksitet lav-middels (~2-3t).
- **Nye integrasjonstester for `tilgangskontroll.ts`** 🔴 — etter O-5c er gammel test-fil slettet (16/22 broken). Integrasjonstester mot test-DB med OrganizationMember-fikstur er planlagt.
- **T7-2b3 audit-log payload utvidelse** 🔴 — før/etter-snapshots per rad i Activity-tabell.
- **Returnert→pending-reset ved `sendTilAttestering`** 🔴 — når arbeider sender returnert sedel på nytt, tilbakestilles ikke `attestertStatus` automatisk.

### Mobil og sync

- **Pre-eksisterende timerSync.ts baseline-feil (linje 308, 334)** 🟡 — `string | null` mot lokal `.notNull()`. Akseptert som baseline, ikke prioritert.

### Attestering-rediger-flyt — inkonsistens (oppdaget 2026-05-17, LØST 2026-05-17 via T7-5d)

**Status:** ✅ Adressert. T7-5d (merge `9727c7f9` på develop) erstatter RedigerSeddelModal med RedigerRadModal. Penn-klikk åpner nå kun prosjekt+ECO-bucken, ikke hele sedelen i side-i-modal. AttesteringDetalj renset for modal-spesifikke props. Detaljer i [STATUS-AKTUELT.md § T7-4g + T7-5d](STATUS-AKTUELT.md).

Original diagnose beholdt under for historikk.

---

### Attestering-rediger-flyt (original diagnose)

**Stop og planlegg.** Etter T7-4f-bunken har vi to overlappende redigeringsstier som skaper forvirring. Diagnose og anbefalt arkitektur:

#### Hva skjer teknisk etter penn-klikk i SeddelKort

Penn-ikonet er en `<Link>` til `/dashbord/firma/timer/attestering/[id]?rediger=1`. Next.js gjør full sidebytte til detalj-siden (`apps/web/src/app/dashbord/firma/timer/attestering/[id]/page.tsx`), som monterer `AttesteringDetalj`. `useSearchParams()` leser `?rediger=1` og setter `redigerModus=true` via `useEffect` — **men kun hvis `sheet.redigerTillatt=true`**.

`sheet.redigerTillatt` kommer fra `OrganizationSetting.tillattRedigerVedAttestering`, **default `false`**. Hvis firmaet ikke har slått den på, ignoreres `?rediger=1` og siden vises read-only med en liten advarsel-banner.

#### Hva mangler i edit-modus-flyten

**Teknisk:** ingenting. Lagre-knapp (`AttesteringDetalj_Edit.tsx:481`), avbryt-knapp (linje 478), cache-invalidering — alt finnes.

**UX:**
- `redigerTillatt=false` → penn-ikonet «lyver». Brukeren ser ingen åpenbar tilbakemelding på hvorfor edit ikke aktiveres.
- Etter lagring blir bruker stående på detalj-siden i read-only. Forventer retur til listen.
- Ingen toast/badge på listen som bekrefter at sedelen ble endret.
- Edit-modus krever hele sedelen lastet — per-rad-edit-løfte fra penn-ikonet er overdrevet.
- Detalj-siden duplikerer ✓/↩-knappene fra listen — to måter å gjøre samme attestering på.

**Brukerens nåværende vei fra «vil endre én rad» til «endring lagret»:** 8 steg (klikk penn → vent navigasjon → sjekk redigerTillatt → endre → lagre → vent → klikk tilbake → se listen).

#### Korrekt arkitektur — anbefaling: **Modal overlay (Alternativ B)**

| Alternativ | Vurdering |
|---|---|
| A: Inline i listen | ❌ Liste-state blir kompleks. 50+ sedler × edit-state. Kataloger queries multipliseres per kort. Ytelse-risiko. |
| **B: Modal overlay** | ✅ Beholder list-kontekst. Gjenbruker `AttesteringDetaljEdit`. Lukk = umiddelbar retur. Per-rad-attestering fungerer i bred modal. |
| C: Sidebytte (dagens) | ❌ Tar bruker ut av list-kontekst (Kenneths hovedklage). Duplikate knapper. 8 steg. |

**Implementasjons-skisse (planlagt som T7-5b):**
- SeddelKort: penn-klikk åpner modal i stedet for å navigere
- Ny `<AttesteringDetaljModal>`-wrapper rundt eksisterende `AttesteringDetalj`-komponent
- `?rediger=1`-mønsteret avvikles for liste-bruk (kan beholdes for direktelink hvis aktuelt)
- Detalj-siden beholdes for bokmark/e-post-deeplinking, men blir tertiær

**Krever før implementasjon:**
1. Avklar om `tillattRedigerVedAttestering` skal være default `true` for nye firma (i dag default `false`)
2. Avklar om listens ✓/↩-knapper og modalens per-rad-checkboxer skal forenes til ett mønster
3. Vurder om detalj-siden bør slankes til kun det den gjør bedre enn modalen (per-rad multiselect, inline rediger), og fjerne det som duplikerer listen

**Status 2026-05-17:** T7-5b-1..4 + B-fixes implementert og deployet til test (se STATUS-AKTUELT.md). T7-5c (sammenheng-håndtering i splitt) åpen. Plasseres i `historikk` når hele bunken er deployet til prod.

### Kompakt sedel-layout — utnytt skjerm bedre (oppdaget 2026-05-17, ✅ T7-4g 2026-05-17)

**Status:** ✅ Forslag 1 implementert. T7-4g (merge `5c6347d9` på develop) reduserer SeddelKort-header til én linje (~48px) med default-kollapsing. Auto-expand ved tilleggHarKrav eller mertid. Action-rad fjernet. Detaljer i [STATUS-AKTUELT.md § T7-4g](STATUS-AKTUELT.md).

**Gjenstående:**
- Forslag 3 (periode-presets + faner + paginering) — egen oppfølger T7-4h
- Forslag 2 (view-toggle [Kort]/[Tabell]) — vurder etter Forslag 3

### B_ny — Lagre-knapp grå→grønn ved endring (oppdaget 2026-05-17, gjenstår på Edit-side)

**Status delvis:** Implementert i RedigerRadModal (T7-5d, via `harEndringer`-state i `RedigerRadModal.tsx`). Mangler fortsatt i `AttesteringDetalj_Edit.tsx:481` (full-sedel-edit på detaljsiden).

Spec sier knapp grå/inaktiv → grønn ved endring. Faktisk i Edit-side: blå fra start uavhengig av om noe er endret. Ingen samlet `harEndringer`-state.

**Fix-skisse:** Beregn `harEndringer = JSON.stringify(editTimer) !== JSON.stringify(initTimer) || ...` (samme mønster som RedigerRadModal) og pass som `disabled={!harEndringer || lagre.isPending}` + betinget className for grønn. Planlegges som T7-5f.

### Attestert-filter på attestering-listen (oppdaget 2026-05-17, FIX 4 fra Sonnet-plan)

Attestering-listen viser kun sedler med `status="sent"` — attesterte sedler (`status="accepted"`) forsvinner helt. Bruker mangler oversikt over hva som er attestert denne uka.

**Forslag:** Filter-toggle `[Venter på attestering ●3] [Attestert ●12]` over uke-navigasjonen. Attestert-fanen viser sedler i read-only.

**Krever:**
1. Server: utvid `hentTilAttesteringFirma` med `status?: "sent" | "accepted"` (default "sent" for bakover-kompat)
2. Klient: ny fane-state, to queries (en per fane), invalider begge ved attester-mutation
3. SeddelKort: ny `readOnly`-prop som skjuler ↩/✓/⋯ og per-rad penn/✂

Planlegges som T7-5e.

### Pause-modell på timer-rad — IMPLEMENTERT 2026-05-18 (pauseFra/pauseTil i daily_sheets)

**Faktisk implementasjon på develop 2026-05-18:** Pause med eksplisitt fra/til-vindu på sedel-nivå, ikke inline checkbox uten tider. Mer ambisiøst enn opprinnelig MVP-vedtak fordi maskin-validering for døgn-utleide maskiner (Heatwork-mønster) krevde å vite pause-lengde for invariant-justering.

**Schema (`packages/db-timer/prisma/schema.prisma`):**
- `DailySheet.pauseFra: String?` og `DailySheet.pauseTil: String?` (HH:MM, nullable). Migrasjon `20260517220000_add_pause_fra_til`.
- `pauseMin` beholdt som denormalisert sum for raskt oppslag. Server beregner `pauseMin = Math.round((pauseTil - pauseFra) / 60)` ved hver oppdatering.

**Klient-flyt (RedigerRadModal):**
- Checkbox auto-hukes ved overlap mellom rad.fraTid/tilTid og sheet.pauseFra/pauseTil.
- Klikk på checkbox når ingen pause finnes lager default 30 min midt i rad-intervallet (se § Pause-default).
- `beregnTimerMedPause(fraTid, tilTid, pauseFra, pauseTil)` returnerer `(til-fra) - pauseMin/60` ved overlap.
- Sheet-level state — endring fra én rad reflekteres på alle overlapp.

**Server-validering (utvidet):**
- `validerMaskinUnderArbeid(timer, maskin, pauseMin)` — pause-buffer på maskin-invarianten (se § utleie_enhet-prinsipp).
- `redigerSedelRader`-mutation aksepterer `pauseFra/pauseTil` i input + oppdaterer DailySheet i samme transaksjon.

**Bakgrunn (opprinnelig analyse):** Pause-data-analyse på 3 sedler i test-DB viste tre ulike praksiser (gap mellom rader / pause trukket fra første timer-rad / pause trukket fra maskin-rad også). Sedel B brøt maskin-timer-koblingen. Eksplisitt pause-vindu var nødvendig for å gi maskin-validering riktig kontekst.

**Kjente begrensninger — se egne seksjoner:**
- Stille overskriving av manuelt-justert rad.timer (T7-5h)
- Default pause-vindu er midtpunkt — bør være firma-konfigurerbar
- Multi-rad-overlap ikke server-validert
- utleie_enhet-prinsipp ikke håndhevet i UI ennå

### Stille overskriving av manuelt-justert rad.timer (oppdaget 2026-05-18, foreslås som T7-5h)

`beregnTimerMedPause` i `RedigerRadModal.tsx` overskriver `rad.timer` fra `rattid − pauseMin/60` ved hver pause- eller fra/til-endring. Hvis arbeidstaker har gjort manuell justering (f.eks. registrert 7.0t på en 8t-periode for å trekke 60 min lang lunsj som ikke er registrert som pause-vindu), forsvinner den justeringen uten varsel ved første pause-toggle eller fra/til-edit.

**Eksempel:**
- Lagret: rad 07:00–15:00, timer=7.00 (manuelt trukket 60 min)
- Bruker klikker pause-checkbox → default 30 min vindu → recompute: 8.0 − 0.5 = **7.5**
- Manuelt-justerte 7.00 erstattes med 7.5 uten advarsel

**Fix-skisser:**
- (A) Init-deteksjon: hvis lagret `rad.timer ≠ rattid − sheet.pauseMin/60`, anta manuell justering — krev eksplisitt brukerbekreftelse før recompute.
- (B) «Lås timer»-toggle på rad: pause-endring overskriver kun ulåste rader.
- (C) Toast-varsel når recompute endrer eksisterende timer-verdi.

**Foreslås som T7-5h.** Ikke blokker for prod-deploy av pause-modell-bunken — eksisterende sedler beholder verdien til bruker aktivt endrer pause eller fra/til.

### Pause-vindu default er midtpunkt av rad-intervallet (oppdaget 2026-05-18)

`togglePause` i `RedigerRadModal.tsx` lager default `[midt − 15 min, midt + 15 min]` når checkbox aktiveres uten eksisterende pause-vindu. For rad 07:00–15:00 blir det 10:30–11:30, ikke 11:30–12:00 som norsk lunsj-konvensjon antyder.

**Eksisterende schema-felter** (`packages/db/prisma/schema.prisma:253-255`):
- `OrganizationSetting.standardStartTid` (default "07:00")
- `OrganizationSetting.standardSluttTid` (default "15:00")
- `OrganizationSetting.standardPauseMin` (default 30)

**Mangler:** `standardPauseFra` / `standardPauseTil` (eller `standardPauseStart`) er **ikke** i schema. Default-midtpunkt brukes som fallback fordi vi ikke har konfigurerbart pause-tidspunkt.

**Forslag:**
- Utvid `OrganizationSetting` med `standardPauseFra: String?` (eller la `standardPauseMin + standardPauseFraOffset` utlede tidspunktet).
- Endre `togglePause` til å bruke firma-default hvis satt, ellers midtpunkt.
- Migrasjon additiv (nullable).

### Multi-rad-overlap pause — ikke håndtert (oppdaget 2026-05-18)

Hvis flere timer-rader overlapper samme pause-vindu (f.eks. 07:00–12:00 + 11:30–15:00 med pause 11:45–12:00), trekkes pause-min fra hver rad isolert i `beregnTimerMedPause`. Server-validering (`validerMaskinUnderArbeid` med pauseMin-buffer) regner pause kun én gang per bucket — det er konsistent for invarianten, men klient-summering kan vise dobbel-trukket pause.

Sjeldent i praksis (typisk én sammenhengende rad per dag), ikke server-blokk. Vurdere om recompute bør splitte pause-fradraget på tvers av overlappende rader, eller om det er en arbeider-feil å registrere overlappende rader uten å selv justere pause.

### utleie_enhet-prinsipp som styrende for maskin-validering (vedtatt 2026-05-18)

**Vedtak:** `equipment.utleie_enhet ∈ {'doegn', 'time'}` er det styrende skillet for hvordan maskin-timer relaterer seg til arbeidstimer — ikke et hypotetisk «kreverForer»-flagg eller «mannsbetjent vs autonom»-konsept.

**Bakgrunn (verifisert mot test-DB 2026-05-18):**
- `maskin.equipment`-tabellen har ALLEREDE feltene `er_utleieobjekt: boolean`, `utleie_enhet: text` ('doegn' | 'time'), `utleiepris_per_dogn`, `utleiepris_per_time`.
- Det finnes **ikke** noe `krever_foerer`-felt. Tidligere foreslåtte spesialtilfeller (Heatwork som «autonom», CAT 320 som «mannsbetjent») var gjettet uten datagrunnlag.

**Konsekvens for maskin-invariant per (projectId, ECO)-bucket:**
- `utleie_enhet = 'doegn'`: maskin går mens operatør pauser → invariant tillater `maskin ≤ arbeid + pauseMin/60`. Heatwork 7626 (9.00t maskin / 8.50t arbeid + 0.50t pause = 9.00t) er innenfor.
- `utleie_enhet = 'time'`: maskin styres av operatør → faller naturlig under `maskin ≤ arbeid` (pause-buffer brukes ikke fordi maskin pauser når operatør pauser).
- `er_utleieobjekt = false`: intern bruk, ikke fakturert utleie — invariant gjelder uansett som baseline.

**Implementasjon-status 2026-05-18:**
- Server-invariant er utvidet med `pauseMin`-buffer universelt (`validerMaskinUnderArbeid` tar pauseMin). Maskin-utleie-enhet brukes ikke i invariantsjekken — gjelder for alle.
- UI-info-warning i `KompaktMaskinRad` viser fortsatt «⚠ Maskintimer overstiger arbeidstimer» når over arbeidstimer, uten å hensynta `utleie_enhet`. Ikke blokker, men kan misforstås for døgn-utleide.

**Åpne avklaringer:**
- Skal invariant være ulik for `utleie_enhet='time'` (strengere: `maskin ≤ arbeid`, ingen pause-buffer)? I så fall: kreves split av sjekken per maskin-rad basert på equipment-data.
- Skal UI-warning skjules for `utleie_enhet='doegn'`-rader når maskin > arbeid (forventet)?

**Foreslås som styrende prinsipp i fase-0-beslutninger.md.**

### B5 — Sum-indikator (maskin-av-arbeid) mangler i SeddelKort (oppdaget 2026-05-17)

`EcoBucketAttest` har grønn/rød validerings-rad («Maskintimer X av arbeidstimer Y») i `attestering-buckets.tsx:634-648`. Brukes kun i detalj-siden via ProsjektSectionAttest, IKKE i listens SeddelKort. Maskin > arbeid synlig i modal men ikke i listen.

**Fix-skisse:** Legg til samme validerings-logikk i SeddelKort's sum-rad eller som egen rad nederst.

### Detalj-siden vs modal — slankhetsvurdering (vedtatt 2026-05-17)

Detaljsiden beholdes fullt funksjonell (sammenheng-prinsipp krever det). Reverserer tidligere skissert slanking. Detaljsiden er riktig sted for kompleks redigering der sammenhenger må vurderes (multi-rad-utvalg på tvers av ECO, full sedel-overblikk).

### i18n: `pause.toggleHint` (fr) — «saut» i stedet for «pause» (oppdaget 2026-05-23)

Auto-oversettings-skriptet (`packages/shared/src/i18n/generate.ts`) oversatte engelsk «pause» til fransk «saut» (hopp) for nøkkelen `timer.rediger.pause.toggleHint`. Google Translate forveksler her «pause» (avbrudd) med «skip/leap» i kontekst av rad-redigering.

**Status:** Kosmetisk avvik, brukere forstår fortsatt kontekst fra omkringliggende UI. Ikke blokkerende.

**Fix-skisse:** Manuell rettelse i `packages/shared/src/i18n/fr.json` — bytt til standard fransk «pause» (samme ord som engelsk og norsk). Verifiser også andre `pause.*`-nøkler i fr.json for samme problem.

### i18n: `timer.gruppe.maskinAvArbeid` — engelsk kildetekst er klønete (oppdaget 2026-05-23)

Engelsk kildetekst mangler verb-bro mellom `{{maskin}}h` og `{{arbeid}}h`-variablene («Machine hours {{maskin}}h of work hours {{arbeid}}h»). Auto-oversetting produserer ord-for-ord-versjoner som er gramatisk dårlige på alle 13 målspråk (de/fr/sv/pl verifisert — alle har samme problem).

**Status:** Semantikken er forståelig, men formuleringen er klønete på alle språk inkludert norsk.

**Fix-skisse:** Forbedre engelsk kildetekst først — f.eks. «{{maskin}}h machine hours of {{arbeid}}h worked» eller egen formulering med klar struktur. Deretter re-kjør auto-oversettings-skriptet med `--force` for nøkkelen, eller manuell rettelse i hver språkfil. Vurder samtidig om norsk kildetekst (nb.json) bør være primær — i dag er en.json master, men nb leveres separat, så kildeendring må gjøres begge steder.

## 2. Halvferdige features

### 3D/IFC/georeferanse

Status og roadmap dokumentert i Claude-memory (`project_3d_status.md`,
`project_3d_roadmap.md`, `project_3d_viewers.md`). 3D/IFC tilhører
separat chat per `feedback_3d_annen_chat`.

- **3D Fase 1 — Web layout-level viewer-persistering** 🔴 — flytt `SammenslattIfcViewer` til prosjekt-layout, vis/skjul basert på rute. Eliminerer re-lasting ved 3D ↔ Tegninger-bytte.
- **3D Fase 2 — Mobil IFC-visning i React Native** 🔴 — WebView med web-vieweren er enklest. Offline-støtte via forhåndslast.
- **3D Fase 3 — Live site-view (AR/3D på byggeplass)** 🔴 — ARKit (iOS) / ARCore (Android). GPS + kompass for grov posisjonering, manuell justering for presisjon.
- **Test absolutt `treDTilTegning`** 🟡 — markør-offset-fixen kan ha løst hele problemet. Ikke testet etter fix.
- **Fjern 3D debug-logging** 🟡 — `tegningTil3D` og `treDTilTegning` logger til console når debug ferdig.
- **Fragment-caching verifisering** 🟡 — sjekk at 2. lasting er raskere.

### Tegning/PDF

- **Split-view pdf.js-migrering** 🔴 — PDF iframe-begrensninger i nåværende implementasjon. Planlagt migrering til pdf.js.

### Timer-relatert

- **Attestering edit-modus bugs (oppdaget 2026-05-16)** 🔴 — to bugs blokkerer prod-deploy av T7-2c-bunken + T7-2d:
  1. Fra-tid viser «0:» i stedet for korrekt tid (f.eks. 07:00). Sannsynlig tidsformat-initialiseringsfeil.
  2. Timer-endring fungerer ikke i edit-modus — input aksepterer ikke ny verdi eller verdien lagres ikke.
  Rootcause ukjent for begge — krever kartlegging neste sesjon i `RedigerTimerRad`/`RedigerMaskinRad` + `AttesteringDetalj_Edit`.
- **T7-3c geo-forslag-utvidelser** ❓ — historikk-baserte forslag (sist brukte prosjekt). Mye av geo-forslag-leveransen kom i T7-3b2. Egen sub-PR eller forkastes.
- **`OrganizationMemberPermission` (modul-tilgang per ansatt)** 🔴 — låst i [fase-0-beslutninger.md](fase-0-beslutninger.md). Designet klart, ikke startet.

### Attestering-liste — expanded inline-visning (oppdaget 2026-05-16)

Attestering-listen viser kun rad-antall, ikke innhold. Prosjektleder
må åpne enkelt-sedel for å verifisere timeføring.

Ønsket: alle registreringer synlige inline + redigering tilgjengelig
direkte fra listen.

- Alternativ A: expandable rader (default expanded).
- Alternativ B: to-panel-visning (liste + detalj side om side).

### Onboarding og brukerveileder

- **Onboarding-veileder (forutsetning for A.Markussen)** 🟡 — Runde 1 (a)+(b)+(c) deployet til prod 2026-05-02. Resterende: full guidet flyt for ny bruker. Se [onboarding-veileder.md](onboarding-veileder.md).
- **Prosjektoppsett-veileder** 🟡 — steg-for-steg ny bruker etter prosjektopprettelse. Se [prosjektoppsett-veileder.md](prosjektoppsett-veileder.md).
- **Testbrukere i test-DB** 🔴 — Ola Tømrer (worker), Per Prosjektadmin, Kari Firmaadmin, Tore SiteDocAdmin. Planlagt etter Timer er ferdig.

### Søk og mobil

- **Adaptivt søk for sjekklister/oppgaver/HMS/RUH** 🔴 — krever kode-utforskning. Se [adaptiv-sok-plan.md](adaptiv-sok-plan.md).
- **Dokumentflyt mobil** 🔴 — finner ikke arbeidsforløp (bruker-basert vs entreprise-basert matching).
- **Oppgave-mobil rettighetsoppfølger** 🔴 — `apps/mobile/app/oppgave/[id].tsx` mangler `rettighetInput`, samme bug som sjekkliste-fix 2026-05-08.

## 3. Fremtidige faser

Detaljert plan: [arkitektur-syntese.md § 5](arkitektur-syntese.md).
Beslutningsgrunnlag: [fase-0-beslutninger.md](fase-0-beslutninger.md).
Aktiv Fase: 0 (firma-fundament) er i hovedsak ferdig — gjenstående §-E-steg dokumentert der.

### Fase 0.5 — Byggeplass + Avdeling-fundament

- To åpne arkitektur-prinsipper besluttes (default-byggeplass, FK vs jsonb) per [byggeplass-strategi.md](byggeplass-strategi.md). NULL = «hele prosjektet» allerede vedtatt (A.30).
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups` — erstattes av m2m-koblingstabell
- `Avdeling`-tabell i `packages/db` (kjernen)
- `User.avdelingId` valgfri
- Forbered byggeplassId-felt på fremtidige Timer/Mannskap/Varelager-modeller

### Fase 1 — Maskin med modul-gateway (under bygging)

- Refaktor maskin-rutene til `modulProcedure('maskin')` — må gjøres før prod-deploy
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- UI for maskin-sjekkliste på maskin-detalj-side
- Manuell trigger fra maskinregister (auto-trigger fra service-varsel utsettes til Fase 7)

### Fase 2 — Mal-promotering

- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek»
- «Start fra firma-mal»-valg ved opprettelse

### Fase 3 — Timer-modul (inkluderer Kompetanseregister)

- Lønnsarter, arbeidstidskalender (delvis startet via T9-bunken), dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)
- Steg 4c — Godkjenning UI (parkert 2026-05-03, venter på A.Markussen-input / ProAdm API)

### Fase 4 — PSI-utvidelse + mannskaps-vy

- Innsjekk/utsjekk-mekanikk
- Mannskaps-vy aggregerer PSI-tilstedeværelses-data per byggeplass
- §15-liste-eksport, HMS-kort-validering, geofence-innsjekk
- `eksternSystem`-felt på Psi
- 12t auto-utsjekk
- **HMS-tilgang for arbeidsgiver på andres prosjekter (juridisk gap A.27)** — løses her per [fase-0-beslutninger.md](fase-0-beslutninger.md).

### Fase 5 — Varelager-modul

- Goods, GoodsCategory, GoodsLocation
- Vareforbruk på dagsseddel (kobler til Timer-modul)
- Saldo-håndtering
- Strekkode-skanning (mobil)

### Fase 6 — Avansert

- DO-kobling (Kompetanse ↔ Equipment-validering)
- AI-ukeplan (Timer + Mannskap + Maskin)
- Strekkode-skanning utvidelser

### Fase 7 — Prosjekthotell-utvidelser (parallelt spor)

- Møtemal (ny dokumenttype)
- Månedsrapport (auto-aggregering)
- HMS-statistikk på firma-nivå
- Street View for byggeplass (eget prosjekt)
- Auto-trigger maskin-sjekkliste fra service-varsel (forutsetter Varsling-modul)

### Etter Fase 1 + Fase 3

- **Aktivitetsfeed på dashboard** — bruker eksisterende Activity-tabell, polling via tRPC, konfigurerbar periode (default 10 dager) + hendelsestyper + GDPR-retensjon i `OrganizationSetting`. Ekstern partner-feed-scope krever egen designrunde. Se [aktivitetsfeed.md](aktivitetsfeed.md).

### Tverrgående

- **Superadmin-oversikt over firma-moduler** 🔴 — fakturerings-orientert. Egen feature-sesjon.
- **Vis som bruker (impersonering)** 🔴 — sitedoc_admin velger firma, deretter bruker, og ser appen fra brukerens perspektiv. Kun for sitedoc_admin. Egen sesjon.
- **Import-modul (HR-data)** 🔴 — datainfrastruktur, mater Timer med ansattnummer, hmsKortNr osv.
- **AI-integrasjon** 🔴 — Copilot plugin, MCP server, innebygd assistent. Se [ai-integrasjon.md](ai-integrasjon.md).
- **Fremdriftsplanlegger** 🔴 — ressursplanlegging, kompetanse, bemanning, forslag-motor. Etter timer+maskin+HR. Se [planlegger.md](planlegger.md).
- **AI-drevet ukeplan** 🔴 — utvidelse av planlegger Fase 4.
- **Dokumentsøk + OCR plan** 🟡 — OCR-fallback, dokumentasjon per post (splitting).
- **NS 3420 kontrollmaler** 🔴 — auto-genererte sjekklistemaler fra NS 3420 via OCR/søkemotor.
- **Cross-prosjekt-deling** ❓ — UE med eget prosjekt deler sjekklister til hovedentreprenør. Flere tilnærminger drøftes.

## 4. Kundeønsker ikke startet (A.Markussen)

Liste mottatt 2026-05-06. Se også [STATUS-AKTUELT.md § Kundeønsker](STATUS-AKTUELT.md).

- **#1 Sjekkliste for service koblet til timetall og status** 🟡 — DB-feltet `nesteServiceTimer` finnes i `packages/db-maskin/prisma/schema.prisma:188`. Mangler UI på maskin-detaljside + serviceintervall-konfigurasjon + sjekkliste med automatisk oppdatering.
- **#5 Registrering av HMS-gruppe på brukere** ⏸️ — parkert.
- **#7 Rettighetsmatrise med rolle-styring (Prosjektleder + Bas)** 🔴 — ny rolle-modell + matrise-UI. Eksisterende roller dekker ikke `Prosjektleder`/`Bas` som DB-roller.
- **#9 Justeringer på SJA (signatur/lesetilgang/deltaker)** 🔴 — utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for prosjektmedlemmer, selv-påmelding som deltaker.
- **#10 «Flere personer»-feltet på SJA — definere hvem som er valgbare** 🔴 — felt-konfigurasjon for å begrense valgbare personer per SJA-mal.
- **#11 Pushvarsel/SMS til ansattliste** 🔴 — ny varslingstjeneste (SMS-leverandør-integrasjon), målgruppe-velger, kostnadsavklaring.

## Vedlikehold

Når en oppgave startes: flytt linje til [STATUS-AKTUELT.md § Pågående
arbeid](STATUS-AKTUELT.md). Når oppgaven er prod-deployet: flytt videre
til `historikk-YYYY-MM.md`. Se også [DOC-MAP.md](DOC-MAP.md) og
[CLAUDE.md § Dokumentasjons-regler](../../CLAUDE.md).
