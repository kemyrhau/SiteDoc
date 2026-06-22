---
name: mobil-dagsseddel-ui-spec
description: Mål-spec for mobil dagsseddel-UI (v2-overhaul). Konsoliderer T.7-layout + låste beslutninger + device-funn til én konkret verifiserbar målbilde. Det A.Markussen sjekker mot.
sist_verifisert_mot_kode: 2026-06-22
---

# Mobil dagsseddel-UI — mål-spec (v2)

> **Formål:** Én konkret målbeskrivelse for hvordan dagsseddel-skjermen på mobil
> skal se ut og oppføre seg etter UI-overhaulen. Dette er **fasiten A.Markussen
> verifiserer mot** ved pilotering. Den konsoliderer det spredte underlaget
> (T.7-layout, Slice 1–4, T.11/T.12, reise R4, device-funn 2026-06-21) til ett
> sted. Spec = målbilde; leveransen skjer i U-serie-slices (§ 6).
>
> **Status (2026-06-22):** Datalaget + grunnflyten er **deployet** (Slice 1–4,
> T.11, T.12, R4 på server; mobil i build `3f1622f7`). De fleste gjenstående
> slices er **ren UI/UX** (U1–U3 — ingen ny schema/flyt). **Unntak: U-flyt
> (§ 6) er en reell flyt-endring** — multi-økt-append + glemt-dag-robusthet
> retter rotårsaker i auto-utkast-genereringen, ikke bare presentasjon. Ingen
> låst beslutning endres; U-flyt operasjonaliserer T.8 «aldri auto-innsending /
> alltid korrigerbart» for fler-økt- og glemt-dag-tilfellene.

---

## 1. Designprinsipper (styrende)

Fra CLAUDE.md + global UI-policy — alle U-slices måles mot disse:

1. **Renest mulig UI** — hvert element rettferdiggjør sin eksistens. Ingen
   toasts/bannere/animasjoner uten tydelig behov; subtile signaler.
2. **Forhåndsdefinerte valg fremfor fritekst** — knapper, nedtrekk, sjekkbokser.
   Fritekst kun som valgfritt tilleggsfelt (produksjonsbeskrivelse, utlegg-kommentar).
3. **Ett-klikk / minst mulig inntasting** — alt som kan utledes, utledes (auto-utkast,
   forhåndsvalgt lønnsart, sist-brukt maskin øverst, auto-foreslått enhet).
4. **Adaptive nedtrekk** — fritekstsøk i velgere når listen passerer 7 elementer
   (allerede implementert — § 5).
5. **Flagg, ikke blokkér** — varsler (arbeidstid, maskinførerbevis) er informative,
   stopper aldri lagring/innsending.
6. **Mobil-først** — feltarbeideren skriver ikke gjerne lange skjemaer.

---

## 2. Mål-layout (v2)

Topp-til-bunn. Referanse-mockup (kilde: `timer.md:330–354`), utvidet med **topp-sum**:

```
┌─────────────────────────────────────────────┐
│  Dagsseddel — 16. apr 2026      [status]     │  ← konvolutt-header
│  Arbeidstid 07:00–17:00 · Pause 30 min       │
│  ▸ Sum i dag: 10,0 t av 7,5 t  ●grønn        │  ← TOPP-SUM (NY, funn b)
├─────────────────────────────────────────────┤
│  ▾ E6 Kvænangsfjellet · Tømrer    10,0 t     │  ← gruppe-header (v2: byggeplass
│      [ECO: 1234 · Tilleggsarbeid]            │     + faggruppe + ECO-badge)
│    ▸ Timelønn · Anleggsarbeid 07–11   4,0 t  │  ← timer-rad m/ chevron-affordance
│        «Støpte fundament, B-akse»            │     (fritekst T.12)
│    ▸ Timelønn · Anleggsarbeid 11.30–17 6,0 t │
│    [+ Legg til timer-rad]                    │
│    ↳ herav maskin: Gravemaskin EQ-042 5,0 t  │  ← maskin nestet (soft-skjul)
│    └─ gruppe-sum 10,0 t                       │  ← gruppe-footer (v2)
│  [+ Legg til prosjekt]                       │
├─────────────────────────────────────────────┤
│  Tillegg                                     │
│   ☑ Overtidsmat (auto: timer > 9t)           │
│   ☐ Skifttillegg 30%  ▾                      │
│   ▸ Utlegg (kategori · beløp · kvittering)   │
├─────────────────────────────────────────────┤
│  Dag-kommentar (valgfri) [_______________]   │
│  [Lagre utkast]        [Send til leder]      │
└─────────────────────────────────────────────┘
```

**Strukturelle invarianter (låst, endres ikke av v2):**
- Dagsseddel = **én per (bruker, dag)**; **prosjekt ligger per rad**, ikke som
  sedel-header (T.1/T.7, prod 2026-05-12).
- Gruppering: **prosjekt → ECO → rader**. «+ Legg til prosjekt» åpner ny gruppe.
- To handlingsknapper: **Lagre utkast** / **Send til leder** — sistnevnte styres
  av `OrganizationSetting.tillattSelvAttestering`.

---

## 3. Element-for-element målkrav

| Element | Målkrav (v2) | Status i dag |
|---|---|---|
| **Topp-sum** | Dagens totale registrerte timer vises **øverst** (under arbeidstid), m/ «X t av Y t» + grønn når ≥ norm. Synlig uten å scrolle. | ❌ `SummeringsBanner` ligger **nederst** (funn b) |
| **Gruppe-header** | Viser byggeplass + ECO-badge; kollapsbar; gruppe-sum til høyre. **Faggruppe = oppfølger (IKKE U1-scope)** — finnes ikke i lokal cache, krever utvidelse av prosjekt-sync (`prosjektLocal` + `refreshProsjektKatalog` + server-payload); spores i [BACKLOG](BACKLOG.md). | ✅ U1 (`19a4a224`): byggeplass + kollaps + ECO-badge-chip + gruppe-sum. Faggruppe utsatt. |
| **Velger-felt** | Alle velger-bokser (prosjekt, lønnsart, aktivitet, ECO, utstyr, enhet, tillegg) har synlig **chevron-affordance** → tydelig at de er trykkbare/redigerbare. | ❌ rendres som ren tekstboks (funn a, 10 bokser) |
| **Timer-rad** | lønnsart · aktivitet · fra/til · timer · ECO + valgfri **fritekst** (produksjonsbeskrivelse). | ✅ (T.12 fritekst deployet) |
| **Maskin-rad** | Nestet under gruppen, «↳ herav maskin». **Soft-skjul** når Equipment-cache tom. **Soft-varsel** ved manglende maskinførerbevis (ikke blokkér). **«+ Legg til maskin» synlig når cache er populert.** | 🟡 logikk deployet (T.11 + soft-skjul). **Device-funn #4:** «+ Legg til maskin» manglet på enhet — verifisert årsak: knappen finnes (`MaskinSeksjon.tsx:152/189`) men gates av `redigerbar && harEquipmentCache`; **tom Equipment-cache** ga ingen knapp, ikke manglende affordance. Re-test etter EQ-042-seed + re-login (cache-refresh) bekrefter. |
| **Tillegg** | Auto-forslag fra regler (overtidsmat/natt/helg) + manuelle. Avhuking vs antall. | ✅ |
| **Utlegg** | Kategori + beløp + valgfritt kvitteringsbilde. | ✅ (Funn #2 vedlegg deployet) |
| **Auto-utkast** | Ved «Slutt dag»: draft m/ arbeidstid (total − reise, split Timelønn/Overtid) + reise-rad fra R4. Alt synlig som `draft`, **aldri auto-innsending**. | ✅ (Slice 3/R4 deployet) |
| **Arbeidstid-varsel** | Seddel > terskel (default 13t) → gult varsel, kan fortsatt sende. | ✅ (Slice 4b-2) |
| **Build-identifikator** | Diskret `v{semver} · {commit} · {dato}` på Mer-skjerm + login (feilsøking). | ✅ (versjons-footer, neste build) |

---

## 4. Låste beslutninger UI-en må respektere (endres IKKE)

| Ref | Beslutning | Kilde |
|---|---|---|
| **T.1/T.7** | Én sedel per (bruker, dag); prosjekt per rad; UI gruppert prosjekt→ECO. | fase-0 § T.7 (`886–968`) |
| **T.8 / Slice 3** | Auto-utkast er **draft-only**, aldri auto-innsending; arbeider godkjenner. | fase-0 § T.8 (`970–1001`) |
| **T.11** | Maskinførerbevis = **soft-flagg** (kategori `TRUCK-/MASKINFØRERBEVIS`), aldri hard gating. | fase-0 § T.11 |
| **T.12** | Produksjonsbeskrivelse = **fritekst** per timer-rad. Numerisk mengde på timer-rad er **forkastet**. | fase-0 § T.12 |
| **Slice 1–4** | Prosjekt-per-rad, fritekst-parity, auto-utkast, midnatt-splitt, glemt-dag-prompt, `sluttTidKilde` + arbeidstids-varsel. | timer.md + historikk-2026-06 |
| **Reise R4** | Reise-forslag fra `ReisetidMatrise` (primær-byggeplass per prosjekt). | timer.md § Reise |
| **T.5** | Tidsrunding via `OrganizationSetting.tidsrundingMinutter` (15/30/60/null). | fase-0 § T.5 |
| **Lønnsart Variant B** | Manuell rad: arbeider velger lønnsart selv (ingen auto-split). Auto-split kun i auto-utkast. | timer.md:356 |

---

## 5. Allerede oppfylt (ikke rør i v2)

- **Fritekstsøk i velgere** når liste > 7 elementer (lønnsart/aktivitet/ECO/utstyr).
  Utstyr søkbar på både nummer og navn. (`timer.md:366–377`)
- **Soft-skjul av maskin-seksjon** når Equipment-cache tom.
- **T.11 soft-varsel** (arbeider + leder), **T.12 fritekst**, **Funn #2 utlegg-vedlegg**.

---

## 6. Leveranseplan — U-serie (UI-overhaul)

> **Navne-presisering:** Mai-2026-«U1/U2» (leder-timerrapport / CSV-eksport) er
> **urelatert og lukket**. «U-serie» her = UI-overhaulen for dagsseddel-skjermen.

| Slice | Innhold | Dekker funn | Akseptanse |
|---|---|---|---|
| **U1** ✅ | **Topp-sum + v2-layout** (`19a4a224`). Dag-total øverst («X t av Y t», grønn ved ≥ norm). v2 gruppe-header (byggeplass + ECO-badge + gruppe-sum), kollapsbar. **Faggruppe utsatt** (oppfølger — krever prosjekt-sync-utvidelse, ikke ren UI). | (b) + (c-struktur) | Sum synlig uten scroll; hver gruppe viser byggeplass + ECO-badge + sum. |
| **U2** ✅ | **Velger-affordance** (`1f612c13`). Delt `VelgerFelt`-komponent med chevron-ikon, brukt på alle 10 modal-velgere (prosjekt/lønnsart/aktivitet/ECO/utstyr/enhet/tillegg). Ingen ny i18n-streng. | (a) | Alle velgere viser chevron; arbeider oppfatter dem som trykkbare. |
| **U3** ✅ | **Visuell finpuss** mot mockup. Ny delt `TidFeltBoks` med **`Clock`-ikon-affordanse** på alle 6 tid-felt (`FraTilTidFelt`×4 + `ArbeidstidSeksjon`-modal×2 — picker-logikk bevart i forelder); finpuss B1–B3 (konsistent badge-chip, dempet uppercase-labels → `font-medium`, kort-stil gruppe-header); myk kollaps-animasjon (Reanimated `FadeIn/FadeOut` + `LinearTransition`, ingen ny avhengighet). Grønn topp-sum-prikk (B4) droppet. Ingen ny i18n, ingen flyt/schema. | (c-rest) + tid-felt | Skjerm matcher v2-mockup; tid-feltene ser trykkbare ut; ingen funksjonell endring. |
| **U-flyt** | **Multi-økt / kladd-robusthet** (flyt-endring — se § 6.1). Multi-økt-append + kladd-påminnelse + glemt-dag-signal-stige. | flyt-funn #2 + #5 | Andre «Start dag» samme døgn appender til eksisterende draft; glemt fler-døgns økt kappes (ikke 160 t); usendt kladd gir mild påminnelse. |

**Sekvensering:** **U1–U3 (visuelle) først** — A.Markussen vurderer mot designet
**nå**. **U-flyt før reell test (aug/sept)** — ekte arbeidere treffer multi-økt +
glemt-dag der, ikke i design-gjennomgangen. U-flyt sitt **buildable-nå-omfang** =
signal-stige-trinn **2 + 7 + 8** + multi-økt-append + kladd-påminnelse (resten av
stigen er modul-avhengig, § 6.1).

Hver slice: egen commit på develop → dual-review → test-build → device-verifisering.
**U1 starter når denne spec'en er bekreftet.**

### 6.1 U-flyt — multi-økt / kladd-robusthet (detalj)

Flyt-endring, ikke presentasjon. Operasjonaliserer T.8 for fler-økt- og glemt-dag-tilfeller.

> **Status (2026-06-22): UF-0 + UF-1 + UF-2 på develop.**
> - **UF-0** — delt `finnEllerOpprettDagsseddel` (`apps/mobile/src/services/dagsseddelOpprett.ts`):
>   find-or-create per `(userId, dato)` + org-backfill + arbeidstid-prefill. Begge inngangspunkter
>   (`ny.tsx` + `opprettDagsseddelForSegment`) ruter gjennom den. Fikser 🔴 duplikat-dagsseddel/sync-stuck.
> - **UF-1 (A multi-økt-append)** — andre «Slutt dag» samme døgn appender den nye øktens rader til
>   eksisterende **redigerbar** draft + utvider arbeidstid-vinduet (`utvidArbeidstidsvindu`). Er dagen
>   alt **sendt/godkjent** → ingen append (ville gi server-konflikt), arbeider varsles
>   (`timer.appendSendt.*`); endring krever recall (UF-4).
> - **UF-2 (C/D glemt-dag-cap)** — ny ren util `kappGlemtDagSlutt` (`dagsegment.ts`): universell
>   enkelt-skift-cap FØR `splittVedMidnatt` i `genererForslag` (chokepoint for ALLE slutt-baner).
>   Spenn > hard-cap (trinn 8, konstant `MAKS_ENKELTSKIFT_TIMER=16`) → kappes til start +
>   sesongjustert dagsnorm (trinn 7, `effektiv.dagsnorm`), `sluttTidKilde="system"` → kontroll-badge.
>   Fjerner 160 t-rotårsaken (blind N×24t-splitt av glemt avslutning). Legitimt nattskift (< cap) urørt.
> **Gjenstår denne planen:** UF-3 kladd-påminnelse (B). **UF-4 recall (E)
> utsatt til egen server-runde** — krever ny tRPC-mutasjon (`sent→draft`, ingen `cancelled`-status
> finnes), ingen migrering. Se [BACKLOG](BACKLOG.md).

**A. Multi-økt-append.** Andre «Start dag» samme døgn skal **finne og appende til
eksisterende draft-dagsseddel** (ny økt = nye rader på samme sedel), ikke opprette
ny / no-op.
- **Rotårsak (verifisert):** `opprettDagsseddelForSegment` (`StartSluttDagKort.tsx:549–589`)
  har lokal idempotens — finner eksisterende sedel for `(userId, segment.dato)` og
  **returnerer den uten å appende** den nye øktens rader (`return eksisterende.id`,
  linje 589). Server håndhever `@@unique([userId, dato])` (`db-timer/schema.prisma:172`).
  Er den eksisterende sedelen allerede `sent`, lander arbeider på en **ikke-redigerbar**
  sedel → opplevd som «dagen er frosset» (#5).
- **Presisering:** Kladden **er allerede redigerbar** i draft-tilstand (`[id].tsx:147`,
  `status === "draft" || "returned"`). Det er **kun appenden** (andre økt → nye rader på
  samme draft) som mangler — pluss en policy for når sedelen alt er sendt.

**B. Kladd-påminnelse.** Mild varsel ved **usendt draft** («du har en kladd til
innsending»). **Distinkt fra glemt-dag-prompt** (Slice 4b-1 = «glemte å avslutte
økten»); dette = «økten er avsluttet, men kladden er ikke sendt».

**C. Glemt-dag-signal-stige.** Prinsipp: **bruk best tilgjengelige signal som
korrigerbart forslag, med flagget kilde; aldri auto-arbeid på ikke-startede dager.
Universell enkelt-skift-cap på ALLE sluttbaner** (ikke bare gjenopprett-banen).
- **Rotårsak 160 t (verifisert):** en sluttbane med `slutt = nå` + `splittVedMidnatt`
  (`dagsegment.ts:38–76`) deler et fler-døgns spenn **blindt** dag-for-dag (while-løkke
  uten øvre grense, linje 61) → N døgnsedler à ~24 t.
- **Fiks (✅ UF-2):** ny ren util `kappGlemtDagSlutt` (`dagsegment.ts`) kalt FØR `splittVedMidnatt`
  i `genererForslag` skiller **nattskift** (kort, < hard-cap → split som før) fra **glemt avslutning**
  (spenn > hard-cap → **kapp** til start + sesong-dagsnorm, ikke split). `splittVedMidnatt` forblir ren.

  | Trinn | Signal | Status |
  |---|---|---|
  | (2) | Neste «Start dag» **kapper** forrige uavsluttede økt | ✅ Dekket: glemt-dag-prompt (Slice 4b-1) + universell cap (UF-2) gjør normal-slutt-banen trygg |
  | (7) | Sesongjustert normaldag (vinter 7 / sommer 8 / ellers 7,5 t, firma-setting) | ✅ **UF-2** — kapp-lengde = `effektiv.dagsnorm` (sesongjustert via summertid-kalender) |
  | (8) | Hard AML/tariff-cap (absolutt øvre grense) | ✅ **UF-2** — `MAKS_ENKELTSKIFT_TIMER=16` (konstant; firma-setting krever server+migrering → egen runde) |
  | (1) | Byggeplass-geofence-utgang / PSI-utsjekk | Modul-avhengig (juridisk sign-off gjenstår — se [timer-gps-prosjekt-utredning.md](timer-gps-prosjekt-utredning.md)) |
  | (3) | Planlagt skift | Modul-avhengig (Planlegger) |
  | (4) | Kollega-/skift-slutt | Modul-avhengig (Mannskap/PSI) |
  | (5) | 12 t PSI-auto-utsjekk | Modul-avhengig (Fase 4 Mannskap) |

  Alle trinn er **korrigerbare forslag med flagget kilde** — aldri tause auto-tall.

---

## 7. Akseptansekriterier — A.Markussen-sjekkliste

På fersk test-build, fysisk enhet:

- [ ] **Topp-sum** vises øverst på sedelen; oppdateres når rad legges til/endres.
- [ ] Hver **prosjektgruppe** viser byggeplass + ECO-badge + gruppe-sum. *(Faggruppe = senere oppfølger, ikke U1.)*
- [ ] Alle **velger-felt** har synlig chevron — oppleves som redigerbare.
- [ ] **Timer-rad** har fritekst-felt for produksjonsbeskrivelse.
- [ ] **Maskin-seksjon** vises kun når firmaet har utstyr; **soft-varsel** ved manglende
      maskinførerbevis (registrering ikke blokkert).
- [ ] **Auto-utkast** ved «Slutt dag» fyller arbeidstid + reise som `draft` (ikke sendt).
- [ ] **Arbeidstid-varsel** ved > terskel; kan fortsatt sende.
- [ ] To knapper: **Lagre utkast** + **Send til leder** (sistnevnte per firma-innstilling).
- [ ] **Build-identifikator** synlig (Mer + login) for feilsøking.

---

## 8. Ut av scope (ikke i denne spec'en)

- GPS-drevet prosjekt-/innsjekk-automatikk (se [timer-gps-prosjekt-utredning.md](timer-gps-prosjekt-utredning.md) — egne beslutninger, juridisk sign-off gjenstår).
- **Geofence-drevet** multi-byggeplass-dag (flere reise→arbeid-segmenter fra geofence, GPS-utredning Beslutning 6). NB: **manuell** multi-økt samme dag («Start dag» igjen) er **ikke** ut av scope — det er **U-flyt § 6.1**.
- Web dagsseddel-UI (egen paritets-vurdering; denne spec'en er mobil).
- Eksport/ProAdm, maskinkost-fordeling, lønnsart-fordelingsmotor (T.9 droppet).

---

## Kilder

- `docs/claude/fase-0-beslutninger.md` — T.5, T.7 (`886–968`), T.8 (`970–1001`), T.11, T.12
- `docs/claude/timer.md` — dagsseddel-flyt + mockup (`301–377`)
- `docs/claude/BACKLOG.md` — device-funn (`67–73`)
- `docs/claude/historikk-2026-06.md` — Slice 1–4 + reise R1–R4 prod-deploy
- Kode: `apps/mobile/app/timer/[id].tsx` + `apps/mobile/src/components/timer-detalj/`
