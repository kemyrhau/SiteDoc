---
tittel: Fase M-3a — felttype-matrise (MalBygger → utfylling web/mobil)
status: 🟢 MÅLT (del 1) + 🟢 BYGGET (del 2 — F1/F2/F4 + kollaps + kopiér-mal)
sist_verifisert_mot_kode: 2026-07-16
gjelder_branch: feat/faseM-3a-del2
eier: cowork/fabel
scope: Del 1 = felttype-matrise (målt). Del 2 = gap-bygging levert (branch feat/faseM-3a-del2); F3 + F2-rest + F4-rest → BACKLOG.
---

# Fase M-3a — felttype-matrise

Måler hver opprettbar felttype langs fem akser (a–e) mot koden på `develop`.
Input: [fase-M-forarbeid-testmaler-ns3420-malbygger-2026-07-16.md](fase-M-forarbeid-testmaler-ns3420-malbygger-2026-07-16.md) § c.
Rapporten er **input, ikke fasit** — hver rad er målt på nytt her.

## Metode (hva hver kolonne betyr)

- **(a) Opprettbar** — vises i `FeltPalett` og kan dras inn. Måles mot `SKJULTE_TYPER`/`PSI_TYPER`-filteret.
- **(b) Config-UI** — hvilke `config`-nøkler har faktisk redigerings-input i `FeltKonfigurasjon.tsx`. `label`/`required`/`helpText` er universelle (alle typer) og listes ikke per rad. «kun default» = nøkkel finnes i `defaultConfig` men har INGEN UI-input.
- **(c) Web-render** — nøkkel i `KOMPONENT_MAP`, `apps/web/.../RapportObjektRenderer.tsx`. ❌ = faller til `UkjentObjekt`.
- **(d) Mobil-render** — nøkkel i `KOMPONENT_MAP`, `apps/mobile/.../RapportObjektRenderer.tsx`.
- **(e) Verdi lagres+vises** — **IKKE VERIFISERT. Krever kjørende app** (localhost eies av redesign-Opus). Markeres per rad: `app` = trenger runtime-sjekk, `N/A` = typen har ingen brukerverdi (ren visning) så det finnes ingenting å lagre, `blokkert-kode` = kan umulig lagre riktig fordi (c)/(d) mangler — bevist i kode, trenger ikke app.

Kilde-linjer:
- (a): `apps/web/src/components/malbygger/FeltPalett.tsx:34,37,45-48`
- (b): `apps/web/src/components/malbygger/FeltKonfigurasjon.tsx:83-322`
- typeliste + defaultConfig: `packages/shared/src/types/index.ts:19-286`
- (c): `apps/web/src/components/rapportobjekter/RapportObjektRenderer.tsx:36-60`
- (d): `apps/mobile/src/components/rapportobjekter/RapportObjektRenderer.tsx:37-65`

**27 typer totalt** (`REPORT_OBJECT_TYPES`, types:19-47). 2 skjult fra palett (`zone_property`, `room_property`, FeltPalett:37) → **25 opprettbare** i normal modus. I PSI-modus vises kun 7 (`PSI_TYPER`, FeltPalett:34).

---

## Matrise

| Type | (a) Palett | (b) Config-UI (utover label/req/help) | (c) Web | (d) Mobil | (e) Runtime-behov |
|---|:--:|---|:--:|:--:|---|
| `heading` | ✅ | — (ingen; `{}`) | ✅ | ✅ | N/A — ren visning, ingen verdi |
| `subtitle` | ✅ | — (ingen; `{}`) | ✅ | ✅ | N/A — ren visning, ingen verdi |
| `text_field` | ✅ | `multiline` ✅ (K:126) | ✅ | ✅ | app |
| `list_single` | ✅ | `options` ✅ (K:119) | ✅ | ✅ | app |
| `list_multi` | ✅ | `options` ✅ (K:119) | ✅ | ✅ | app |
| `integer` | ✅ | `enhet`+`min`+`maks` ✅ (del 2, `FeltKonfigurasjon.tsx`) | ✅ | ✅ | app |
| `decimal` | ✅ | `enhet`+`min`+`maks`+`toleranse`+`desimaler` ✅ (del 2) | ✅ | ✅ | app |
| `calculation` | ✅ | `formula` ❌ kun default (K: ingen blokk) | ✅ (readonly) | ✅ (readonly) | app |
| `traffic_light` | ✅ | `options` (4 lys) ❌ kun default (K: ingen blokk) | ✅ | ✅ | app |
| `date` | ✅ | — (`{}`) | ✅ | ✅ | app |
| `date_time` | ✅ | — (`{}`) | ✅ | ✅ | app |
| `person` | ✅ | `role` ✅ (K:151) | ✅ | ✅ | app |
| `persons` | ✅ | `role` ✅ + `max` ✅ (del 2, F4) | ✅ | ✅ | app |
| `company` | ✅ | `role` ✅ (K:151) | ✅ | ✅ | app |
| `attachments` | ✅ | `maxFiles` ✅ (K:160); `acceptedTypes` kun default | ✅ | ✅ | app |
| `bim_property` | ✅ | `propertyName` ❌ kun default (K: ingen blokk) | ✅ | ✅ | app |
| `zone_property` | ❌ skjult | — (`{}`) | ✅ | ✅ | blokkert-opprett — ikke i palett |
| `room_property` | ❌ skjult | — (`{}`) | ✅ | ✅ | blokkert-opprett — ikke i palett |
| `weather` | ✅ | — (`{}`) | ✅ | ✅ | app |
| `signature` | ✅ | — (`{}`) | ✅ | ✅ | app |
| `repeater` | ✅ | — (`{}`; barn via `parentId`, ikke config) | ✅ | ✅ | app |
| `location` | ✅ | — (`{}`) | ✅ | ✅ | N/A — visning; skjult i utfylling (web:31) |
| `drawing_position` | ✅ | `buildingFilter` ✅ + `disciplineFilter` ✅ (K:172) | ✅ | ✅ | app |
| `info_text` | ✅ | `content` ✅ (K:194) | ❌ | ✅ | N/A web (visning), N/A mobil (DISPLAY, d:32) |
| `info_image` | ✅ | `imageUrl` ✅ + `caption` ✅ (K:209) | ❌ | ✅ | N/A web, N/A mobil (DISPLAY, d:32) |
| `video` | ✅ | `url` ✅ (K:256) | ❌ | ✅ | N/A — visning (avspilling), ingen verdi |
| `quiz` | ✅ | `question`+`options`+`correctIndex` ✅ (K:269) | ✅ (del 2, F2) | ✅ | app |

`K:` = `FeltKonfigurasjon.tsx`-linje. `web:`/`d:` = renderer-linje.

### Sammendrag

- **Opprettbar (a):** 25/27 (2 skjult).
- **Egen config-blokk (b):** 14 typer har minst én typespesifikk input (text_field, list_single, list_multi, integer, decimal, person, persons, company, attachments, drawing_position, info_text, info_image, video, quiz) — fordelt på 10 kodeblokker (list ×2 og int/dec ×2 og person/persons/company ×3 deler blokk). Forarbeidet oppga «11 av 25» (blokk-telling); målt her per **type** = 14, per **blokk** = 10. Uenigheten er kun tellemåte, ikke funn.
- **Web-render (c):** 24/27 nøkler etter del 2 (quiz lagt til). Mangler fortsatt: `info_text`, `info_image`, `video` (ren visning → BACKLOG).
- **Mobil-render (d):** 27/27 nøkler. Ingen mangler.

---

## Funn-liste (styrer del 2 — prioritert)

**F1 — `decimal`/`integer` grenseverdier har ingen editor. [MÅLT del 1 → LØST del 2]**
Del 1-funnet: `FeltKonfigurasjon.tsx` redigerte KUN `unit`; `min`/`max`/`decimals`/`toleranse` var usynlige i verktøyet.
**Del 2-løsning (branch feat/faseM-3a-del2):**
- **Nytt premiss del 1 ikke fanget** (leste kode, ikke seed): NS3420-malene er seedet med NORSKE nøkler `enhet`/`min`/`maks`/`toleranse` (`seed-bibliotek.ts:30-31`), ikke `unit`/`max`. Nøkkel-mismatch avgjorde løsningen.
- **Vedtak (Kenneth 2026-07-16):** norsk kanonisk skrives (`enhet`/`min`/`maks`/`toleranse`/`desimaler`), engelsk (`unit`/`max`/`decimals`) leses som fallback. Ett lesested: `@sitedoc/shared/utils/grenseSjekk.ts` (`normaliserGrense`/`grenseStatus`/`formaterGrense`, med test). defaultConfig oppdatert til norsk kanonisk.
- Editor: `FeltKonfigurasjon.tsx` (min/maks/enhet + decimal: desimaler/toleranse). Render: web+mobil `Heltall/DesimaltallObjekt` viser grense (≥ ≤ ±) + amber-markering utenfor. **Blokkerer ikke innsending** (avvik = gyldig funn). NS3420-maler renderer nå korrekt uten at seed røres.

**F2 — PSI-instruksjonstyper mangler på web. [MÅLT]**
`info_text`, `info_image`, `video`, `quiz` er opprettbare (palett) og fullt konfigurerbare, men fraværende i web `KOMPONENT_MAP` (`RapportObjektRenderer.tsx:36-60`) → faller til `UkjentObjekt`. Mobil har alle fire (`d:61-64`). Konsekvens per type:
- `info_text`/`info_image`/`video` = ren visning → på web vises «ikke støttet» i stedet for innholdet (kosmetisk/innholdstap, ingen data tapt).
- `quiz` = **har en brukerverdi (svar)**. På web kan verdien **umulig lagres/vises** — dette er `blokkert-kode`, bevist uten app. Om quiz skal brukes utenfor PSI/mobil er dette en reell datagap.

**F3 — `calculation.formula` og `traffic_light.options` har ingen editor. [MÅLT]**
Begge har innhold i `defaultConfig` (`types:163,169-176`) men ingen blokk i `FeltKonfigurasjon.tsx` (grep: ingen `objekt.type === "calculation"`/`"traffic_light"`). → Formel kan ikke skrives i MalBygger (beregningsfelt er ubrukelig uten seed/import); trafikklysets farger/labels er låst til de 4 default-verdiene. Forarbeidet flagget begge; bekreftet.

**F4 — `bim_property.propertyName`, `persons.max`, `attachments.acceptedTypes` — default uten UI. [MÅLT]**
- `bim_property`: `propertyName` (`types:218`) har ingen blokk → BIM-egenskap kan ikke knyttes til en navngitt egenskap i MalBygger.
- `persons`: `max` (`types:200`) — kun `role` har UI (K:151); maks-antall kan ikke settes.
- `attachments`: `acceptedTypes` (`types:212`) — kun `maxFiles` har UI (K:160); filtype-begrensning kan ikke settes.
Forarbeidet nevnte `bim_property` og `attachments`; **`persons.max` er nytt funn her.**

**F5 — `zone_property`/`room_property`: skjult, men fullt rendret. [MÅLT]**
Begge er i `KOMPONENT_MAP` på både web (`web:53-54`) og mobil (`d:54-55`), men skjult fra palett (`FeltPalett.tsx:37`). → Kan ikke opprettes i dag, men eksisterende/importerte objekter av disse typene rendres korrekt begge steder. Ingen handling nødvendig for del 2 med mindre kvalitet/kontrollplan trenger dem.

**F6 — 8 opprettbare typer har ingen typespesifikk konfig utover label/påkrevd/hjelpetekst. [MÅLT]**
`heading`, `subtitle`, `date`, `date_time`, `weather`, `signature`, `repeater`, `location` — alle `defaultConfig: {}` og ingen blokk i `FeltKonfigurasjon`. Dette er korrekt (typene trenger ikke config), listet for fullstendighet slik at tom output ikke tolkes som manglende sjekk. `repeater`s nesting styres via `parentId` + `BetingelseBjelke`, ikke config-editoren.

---

## Rader IKKE verifisert — og hvorfor

**Hele akse (e) er uverifisert.** Ingen rad i (e)-kolonnen er kjørt mot app — localhost:3100/3001 eies av redesign-Opus (per ordre). Nedbrytning:

- **Trenger faktisk runtime-sjekk (`app`):** 17 typer med brukerverdi som rendres begge steder — text_field, list_single, list_multi, integer, decimal, calculation, date, date_time, person, persons, company, attachments, bim_property, weather, signature, repeater, drawing_position. For disse kan koden bekrefte at de *rendres*, men ikke at verdien *round-tripper* (lagres → hentes → vises). Del 2 må drive dem i appen.
- **Trenger IKKE app (avgjort i kode):**
  - `heading`, `subtitle`, `location`, `video` — ingen brukerverdi (N/A).
  - `info_text`, `info_image` — DISPLAY-typer, ingen verdi (N/A).
  - `quiz` på web — VAR `blokkert-kode` (manglet i web-renderer). **Løst i del 2** (F2): lagt til KOMPONENT_MAP → runtime-behov nå `app`.
  - `zone_property`, `room_property` — ikke opprettbare; runtime moot uten legacy-data.

**Prinsipp anvendt (negativ kontroll):** en type som ikke rendres i (c)/(d) kan ikke lagre en verdi der — derfor er F2/quiz-web et bevisbart funn, ikke en uverifisert rad. Motsatt: ingen (e)-`app`-rad er merket ✅; det ville vært en gjettet ✅, som er verre enn ingen rad.

## Avvik mot forarbeidet (§ c)

- Forarbeid: «config-editor 11 av 25». Målt: 14 typer / 10 blokker. Tellemåte-forskjell, ikke motstrid (se Sammendrag).
- Forarbeid nevnte ikke `persons.max` uten UI → lagt til (F4).
- Forarbeid: PSI-typer «mangler i KOMPONENT_MAP» — bekreftet, men presisert at det gjelder **kun web** (mobil har alle fire) og at **kun `quiz` gir datatap** (de tre andre er ren visning) (F2).
- Alle øvrige forarbeid-flagg (`calculation.formula`, `traffic_light.options`, `integer/decimal.min/max/decimals`, `attachments.acceptedTypes`, `bim_property.propertyName`) bekreftet mot kode.

---

## Del 2 — gap-bygging levert (branch feat/faseM-3a-del2, 2026-07-16)

Sperren hevet (del6b fase 1 merget). Bygget mot del 1-matrisen + Kenneth-vedtak (norsk kanonisk grense-nøkkel):

- **F1** grenseverdier: delt normaliser `grenseSjekk.ts` (norsk kanonisk + engelsk fallback) + editor-UI + web/mobil-render m/amber-markering. Se F1-funnet over.
- **F2** quiz: `QuizObjekt.tsx` (web) + registrert i KOMPONENT_MAP → web-datatapet lukket. `info_text`/`info_image`/`video` (ren visning) → BACKLOG.
- **F4** `persons.max`: input i person-blokken (kun `persons`).
- **pkt 2** kollapsbare heading-seksjoner: `seksjoner.ts` (delt, `grupperMedOverskrift`) + `UtfyllingSeksjoner` web+mobil, utledet fra flat rekkefølge + rot-heading UTEN datamodell-endring. Nesting bevart; web print-trygt.
- **pkt 4** kopiér-mal: `mal.kopier` (to-pass parentId-remap + dokumentflyt-koblinger) + aktivert `MalListe.tsx`-knapp.
- **Config-editor-telling (nevner definert):** 10 typespesifikke blokker / 14 typer / nevner **25 opprettbare → 14/25**.

**Restanse → BACKLOG:** F2-rest (info/video web-render), F3 (`calculation.formula` + `traffic_light.options`), F4-rest (`bim_property.propertyName`, `attachments.acceptedTypes`), pkt 2-rest (MalBygger-feltliste-kollaps — ikke billig, dnd-kit).

**Verifikasjon:** `next build` grønn, shared-tester grønne, web+api typecheck rent, mobil-typecheck uendret (null nye feil). Runtime-verifisering (skjermbilder) på test etter deploy — kontroll-Claude, ikke Opus' egenrapport.

**Oppfølger — enhet-fallback-regresjon (branch fix/pdf-enhet-fallback, 2026-07-16):** Del 2-editoren skriver `enhet` og sletter `unit`, men **flere lesere leste kun `config.unit`** og mistet dermed enheten så snart en integer/decimal-mal ble redigert + lagret. Ekte regresjon (rammet av editor-skrivingen): `packages/pdf/src/felt.ts:78` (utskrift) + `RapportObjektVisning.tsx:247` (int/decimal-visning). Samme klasse, defensivt fikset: `RapportObjektVisning.tsx:260` + web/mobil `BeregningObjekt` (calculation). Alle lest om til `enhet ?? unit`. `packages/pdf` beholder null-avhengigheter (duplisert `??`, ikke import). **Lærdom:** F1-render-verifiseringen dekket bare de to renderne jeg endret (Heltall/Desimaltall) — ikke søsken-lesere av samme nøkkel i andre visnings-/print-flater. Nøyaktig «✅ beviser kobling, ikke nøkkel-match» én etasje ned.

*Del 1 slutt (kode-avlesning). Del 2 levert i kode; runtime-verifisering på test utestående.*
