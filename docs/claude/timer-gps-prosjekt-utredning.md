---
name: timer-gps-prosjekt-utredning
status: agenda
sist_verifisert_mot_kode: 2026-06-23
---

# Utredning: Timer-registrering, GPS, prosjekt-tilknytning og dag-flyt

> **Session-klar agenda** for en dedikert utredningssesjon. Samler beslutningene som dukket
> opp 2026-06-13 rundt R4 (reisetid-matrise) + EAS-enhet-test. Ingen kode tas før beslutningene
> er fattet. Rekkefølgen er **avhengighets-ordnet**: Beslutning 1 styrer resten.

## Formål

Avgjøre hvordan timer-modulen håndterer **prosjekt-tilknytning + GPS-dagflyt**, forankret i
to-produkt-modellen og byggherreforskriften §15. Spenningen: SiteDoc er opprinnelig et
**prosjektstyringsverktøy** (streng prosjekt-isolasjon), mens timer-modulen behandler prosjekt
som en *etikett* arbeider velger. De kolliderer når valgt prosjekt ≠ faktisk posisjon.

## Forankring (les først)

- `terminologi.md § 0` — to-produkt-modell (firmamodul vs prosjektmodul; timer isolerer på org)
- `fase-0-beslutninger.md § T.8` — innsjekk-prosjektforslag (**🟡 under revurdering**)
- `mannskap.md` — PSI/§15 innsjekk-utsjekk, byggherreforskriften, 12t auto-utsjekk
- `domene-arbeidsflyt.md` — virkelig arbeidsflyt (styrende)
- `timer.md § Reise og oppmøtested` — R1–R4 reise-modell, «aldri auto-rad»
- `OPPSUMMERING-timer-arkitektur.md § D (G1)` — **GPS = friksjonsfjerner + bevis, ikke hard port**

## Kode-fakta (verifisert 2026-06-13)

- Tid registreres mot `valgtProsjekt` (`StartSluttDagKort:442`) **uansett fysisk posisjon**.
- «Start dag»-GPS identifiserer **kun oppmøtested (kontor)** — ikke byggeplass/prosjekt. Byggeplass-GPS = **1c-mobil, gjenstår**.
- **Ingen** validering av valgt prosjekt mot GPS-posisjon i dag.
- Dagsseddel-status: `draft → sent → accepted` (`draft/returned` redigerbar, `sent/accepted` låst). Innsending = `draft→sent`; leder-attestering = `→accepted`.
- T.8 i dag: innsjekk = **hint** i prosjekt-velger; arbeider oppretter dagsseddel + rader **eksplisitt**; innsjekk trigger **aldri** auto-dagsseddel/rader.

---

## 2026-06-23 — kode-review + justering

Uavhengig kode-sjekk (Opus) av tilstanden siden 2026-06-13. Endrer status på Beslutning 2–6 og fastsetter neste byggbare runde.

### Verifiserte funn

- **L1 byggeplass-GPS ferdig.** `byggeplassLocal`-cache med navn + `lat/lng/radiusM` (alle nullable) — `apps/mobile/src/db/schema.ts:364`. `identifiserByggeplass()` Haversine point-in-circle — `byggeplassKatalog.ts:79`. Server `bygning.hentForFirma` leverer `latitude/longitude/radiusM` → caches lokalt (`byggeplassKatalog.ts:30,61`). Byggeplass **identifiseres kun ved Start** (`StartSluttDagKort.tsx:168`, i `startDag`) — ved slutt fanges kun `endLat/endLng`, ingen ny byggeplass-deteksjon. **Én arbeidsdag = én byggeplass.**
- **Auto-utkast (Slice 3) live** — `genererForslag()` → `opprettDagsseddelForSegment` lager draft + auto-rader (`StartSluttDagKort.tsx`).
- **R4 reisetid-matrise live** (`reisetidMatriseKatalog.ts`, `resolverPrimaerByggeplass`) · **UF-1 multi-prosjekt live** (GPS velger nærmeste blant flere prosjekter, `StartSluttDagKort.tsx:455-462`).
- **Sedel-nivå byggeplass: server + sync ferdig.** `dagsseddelLocal.byggeplassId` finnes (`schema.ts:90`); mobil-sync sender det (`timerSync.ts:223`); `syncBatch`-input tar imot på sedel-nivå (`dagsseddel.ts:3026`) og **propagerer til alle rader** ved skriving (`createMany`: `byggeplassId: lokal.byggeplassId ?? null` — `dagsseddel.ts:3369` timer, `:3398` maskin). **Eneste manglende ledning:** `opprettDagsseddelForSegment` hardkoder `byggeplassId: null` (`dagsseddelOpprett.ts:107`) → GPS-byggeplassen på `arbeidsdagLocal` kopieres ikke inn i auto-utkastet.
- **Per-rad byggeplass: IKKE server-klart.** `syncBatch` rad-input (`timer`/`maskiner`) har kun `projectId`, ikke `byggeplassId` (`dagsseddel.ts:3039-3073`) — byggeplass kommer kun fra sedel-nivå og propageres ned. `sheetTimerLocal`/`sheetMachineLocal` (mobil rad-tabeller) mangler `byggeplassId` (kun `projectId`, `schema.ts:126,155`). Ekte per-rad krever derfor **både** server-input-utvidelse **og** mobil rad-tabeller.
- **§15/innsjekk-utsjekk + OS-region-monitoring: ikke bygd** (0 treff på `innsjekk`/`utsjekk`/`mannskap`/`startGeofencing`/region-monitoring). Geofence i dag er kun Haversine point-in-circle ved Start, ikke kontinuerlig OS-overvåking.

### Justert status, Beslutning 2–6

| Beslutning | Status etter review |
|---|---|
| **B2** — prosjekt-mismatch advisory | **Byggbar nå** (sedel-nivå). Byggeplass-deteksjon finnes; mangler å koble soft advarsel. |
| **B3** — dag-flyt-overganger (ankomst/avreise) | Trenger **OS-geofence** (region monitoring) — ikke bygd. |
| **B4** — §15-presence vs lønnstid | Lønns-laget **live** (auto-utkast); **§15-presence gated** (Fase 4 Mannskap + juridisk sign-off). |
| **B5** — autoritet arbeider-valg vs GPS | = **dagens oppførsel** (arbeider-valg autoritativt, GPS advarer/foreslår, jf. G1). |
| **B6** — multi-byggeplass-dager | = **byggeplass-registrering**, fases (sedel-nivå nå, per-rad/splitt-dag som oppfølger). |

### Vedtak — B2+B6 sedel-nivå-runde (neste, byggbar til TestFlight)

1. **Kopier `arbeidsdag.byggeplassId` → draft** i `opprettDagsseddelForSegment` (1 linje; erstatter hardkodet `null`).
2. **Byggeplass-velger** m/ pil-til-høyre + blå topp-oversikt (sedel-nivå overstyring av GPS-forslaget).
3. **Mismatch-advisory** (soft, ikke-blokkerende — Beslutning 2).

Sedel-nivå er allerede server-klart (sync + propagering); denne runden er ren mobil + den ene draft-linja.

### Parkert (eksplisitt)

- **Per-rad byggeplass / «splitt dagen mellom byggeplasser»** (prosjekt-101-behovet) = **Beslutning 6-oppfølger.** Krever server `syncBatch` rad-input + mobil rad-tabeller (`sheetTimerLocal`/`sheetMachineLocal.byggeplassId`). Begrunnelse: `@@unique(userId, dato)` på `DailySheet` → sedel-nivå = én byggeplass/dag; splitt-dagen krever per-rad-modell.
- **Underprosjekt** (dokumentflyt-utledet, distinkt fra byggeplass) · **multi-leg reise** → Fase 3.
- **§15-presence + OS-region-monitoring** → Fase 4 Mannskap + juridisk sign-off.

---

## BESLUTNING 1 (avgjør resten) — T.8: konservativ vs auto-utkast

> **✅ VEDTATT 2026-06-20: Alternativ B (auto-utkast).** Modulen bygger seg selv (draft fra dag-flyt), viser arbeider alt, korrigerbart, godkjennes ved innsending (`draft→sent`). Styrer Del 2/3 + BESLUTNING 2–6. Foldet til `fase-0 § T.8`; «aldri auto-rad» → «aldri auto-innsending» ved bygging av Del 3.

**Spørsmål:** Hvem skriver timer-radene, og hvor ligger godkjennings-punktet?

| | Hvem skriver utkastet | Godkjennings-punkt |
|---|---|---|
| **A. Konservativ (dagens T.8)** | Arbeider oppretter manuelt (GPS = hint) | Ved opprettelse + innsending |
| **B. Auto-utkast (Kenneths forslag)** | Systemet auto-skriver fra GPS-dagflyt (draft) | Ved **innsending** (`draft→sent`) |

**Invariant (begge):** Arbeider godkjenner før noe blir *endelig* (innsending/attestering). Ingen lønn uten menneskelig godkjenning.

**Avveiing:** A = tryggest mot feil auto-rader, men mer manuelt (mer tasting). B = mye lavere friksjon («dagen fyller seg selv»), men hviler på at innsendings-gjennomgangen faktisk gjøres nøye.

**Konsekvens:** Velges B må «aldri auto-rad»-formuleringen i T.8 + 1c-mobil-noten (`timer.md:416`) revideres til «aldri auto-*innsending*». Styrer hele dag-flyt-designet under.

---

## BESLUTNING 2 — Prosjekt-mismatch (valgt prosjekt ≠ faktisk posisjon)

**Scenario:** Arbeider velger Prosjekt A, men er fysisk på Prosjekt B.

**Konsekvens i dag (udetektert):** feil prosjekt-kostnad (kjerne for prosjektverktøy), feil reise-forslag (R4 bruker A's byggeplass), feil §15-mannskaps-oversikt.

| Alternativ | Avveiing |
|---|---|
| **GPS-advisory (anbefalt, jf. G1)** | byggeplass-GPS detekterer B → soft advarsel ved mismatch → arbeider bekrefter/bytter. Balansert. |
| Status quo (kun valg) | Korrumperer kostnad + §15. Ikke holdbart. |
| Hard GPS-gate | For rigid — GPS upålitelig, bryter legitime kryss-prosjekt-dager. |

**Avhengighet:** 1c-mobil (byggeplass-GPS).

---

## BESLUTNING 3 — Dag-flyt-overgangene (ankomst + avreise)

**Scenario:** Kontor (A valgt) → kjør til B → ankomst B (reise→arbeid + prosjekt-bytte) → forlater B (utsjekk).

**Spørsmål:** Hvordan signaliseres overgangene? Popup? Auto? Timeout-fallback?

Se **Beslutning 4** (to-lags-modellen) — den gir svaret på «hvis ubesvart». Kort: popup ved ankomst/avreise; auto-fallback skiller §15-presence (kan auto-logges) fra lønnstid (utkast, ikke auto-commit med mindre Beslutning 1 = B).

**Åpent:** popup-design, terskel for «forlatt byggeplass», sammenheng med 12t auto-utsjekk.

---

## BESLUTNING 4 — To-lags-modell: §15-presence vs lønnstid

Geofence-overgangene driver **to lag med ulik commit-semantikk:**

| Lag | Hva | «Hvis ubesvart» |
|---|---|---|
| **§15-presence** (innsjekk/utsjekk per byggeplass) | Dokumentasjon, rettslig forpliktelse (GDPR art. 6(1)(c), byggherreforskriften §15). Primær nytte: katastrofe-mønstring. | **Kan auto-logges** (presedens: 12t auto-utsjekk). |
| **Lønnstid** (reise→arbeid, prosjekt-bytte) | Påvirker lønn. | **Konservativ T.8:** ikke auto. **Auto-utkast (B):** utkast skrives, bekreftes ved innsending. |

**Nøkkel:** §15-presence (nærvær) er mindre sensitiv enn lønnstid og kan automatiseres uavhengig av Beslutning 1. Lønnslaget følger Beslutning 1.

**Privacy-by-design (prinsipp):** Appen lagrer **kun inn/ut-hendelser, aldri bevegelsesspor.** Geofence-evalueringen skjer i OS-laget (iOS/Android region monitoring) — appen mottar og persisterer bare selve overgangs-eventet (innsjekk/utsjekk med tidspunkt + byggeplass), ikke kontinuerlig posisjon. Eventene mapper direkte til **PSI/§15-nærværsdata** (rettslig forpliktelse, GDPR art. 6(1)(c) — byggherreforskriften §15), ikke til en sporings-logg. Dette **de-risker feature-en betydelig** personvernmessig (ingen bevegelseshistorikk = ingen sporings-profil), men **juridisk sign-off på rettsgrunnlaget gjenstår** før implementasjon. Skiller seg fra «kontinuerlig GPS-sporing» (eksplisitt ut av scope, se under).

**Avhengighet:** Fase 4 Mannskap (PSI innsjekk/utsjekk-tabeller).

---

## BESLUTNING 5 — Autoritet: arbeider-valg vs GPS

Forankret i **G1: GPS = friksjonsfjerner + bevis, ikke hard port.** Arbeider-valg bør forbli autoritativt (legitime kryss-prosjekt-tilfeller: forberedelser, materialhenting, flytting). GPS detekterer + advarer/foreslår. Bekreft at dette holder for alle lagene over.

---

## BESLUTNING 6 — Multi-byggeplass-dager

Arbeider beveger seg mellom flere byggeplasser/prosjekter samme dag. Hvordan håndteres flere reise→arbeid-segmenter + flere §15-innsjekk/utsjekk på én dagsseddel? (R4 primær-byggeplass-regel er deterministisk per *prosjekt* — multi-prosjekt-dag trenger egen håndtering.)

---

## Avhengigheter (oppsummert)

- **Fase 1c-mobil** (byggeplass-GPS) — forutsetning for Beslutning 2, 3, 6.
- **Fase 4 Mannskap** (PSI innsjekk/utsjekk) — forutsetning for §15-laget (Beslutning 4).
- **Beslutning 1** styrer «aldri auto-rad»-formuleringen i T.8 + `timer.md:416`.

## Ut av scope (ikke i denne utredningen)

- Maskinkost-fordeling, ProAdm-eksport (OPPSUMMERING G5).
- Kontinuerlig GPS-sporing (🔴 personvern — BACKLOG, bygges ikke uten juridisk vurdering).
- Fra/til → HMS-register (G4, uavklart).
