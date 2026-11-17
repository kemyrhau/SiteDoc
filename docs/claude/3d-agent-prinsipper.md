---
name: 3d-agent-prinsipper
description: Styrende prinsipper for 3D-web- og 3D-mobil-agenten — hard grense mot DWG/DXF, arbeidsform, Kenneths funnliste og filkart. Leses ved hver oppstart, compact og /clear.
sist_verifisert_mot_kode: 2026-11-16
---

# 3D-agentene — prinsipper

> 🔴 **Leses av 3D-web og 3D-mobil ved HVER oppstart, compact og /clear** — før posten i innboksen
> ([SAMARBEIDSREGLER § /clear-REGELEN punkt C](SAMARBEIDSREGLER.md)). Fila er Kenneths bestilling
> 2026-11-16; endres bare av orkestrator etter Kenneths beslutning.

## 1. Hard grense — DWG/DXF røres ikke

> **Kenneth 2026-11-16:** *«ikke rør deler av koden som tilhører konvertering av dwg til dxf, samt dxf filer.»*

Utenfor 3D-agentenes område (målt med `git ls-files` 2026-11-16):

| Lag | Filer |
|---|---|
| API | `apps/api/src/services/dwgKonvertering*.ts` · `apps/api/src/services/ezdxf/**` · `apps/api/src/routes/dwg-kapasitet.test.ts` · `apps/api/test-fixtures/dwg/**` |
| Web | `apps/web/src/components/tegning/DxfViewerTegning.tsx` + `__tests__/dxf-viewer-*` · `apps/web/src/lib/dxfWorkerFactory.ts` · `apps/web/src/lib/ezdxfSvgVisning.ts` · `apps/web/src/workers/dxfViewerWorker.entry.ts` · `apps/web/scripts/build-dxf-worker.mjs` · `apps/web/src/app/dxf-viewer-smoketest/**` |
| Mobil | `apps/mobile/src/components/DxfViewerTegningMobil.tsx` · `DxfMaleVerktoylinje.tsx` · `apps/mobile/app/dxf-webgl-debug.tsx` |
| DB | migreringer med `dwg`/`dxf` i navnet |

- Gjelder også fil som ikke står her, men som importerer fra eller skriver til disse.
- Trenger en 3D-fiks noe i disse filene (delt komponent, delt kontekst, delt kamera-kode): **STOPP og meld** til orkestrator før du endrer.

## 2. Arbeidsform

1. **Mål først, ingen kode i første runde.** Første leveranse pr. funn er måling + rotårsak + løsningsforslag med ord. Kode først etter orkestratorens ordre (Kenneth godkjenner funksjonsendringer, [SAMARBEIDSREGLER § 5](SAMARBEIDSREGLER.md)).
2. **Test vs prod-forskjell er et måleobjekt, ikke en gjetning.** Kenneth melder at samme gest virker på test og ikke på prod. Det kan være modellen (enheter, koordinat-origo, størrelse, IFC-skjema), data eller kodeversjon. Mål build-hash (`/version`) og modellfil på begge før du forklarer.
3. **Bevar funksjoner.** Det som virker i dag (f.eks. pan på test, snitt på mobil) skal virke etterpå. Fjerner du noe udiskutert: STOPP og meld.
4. **Paritet web ↔ mobil der det hører hjemme.** Egenskaper og måling er samme funksjon på begge flater; ta del i felles logikk via `@sitedoc/shared` og navngi den ([SAMARBEIDSREGLER § 6b](SAMARBEIDSREGLER.md)). Web-agenten og mobil-agenten melder hverandres berøringsflate til orkestrator, ikke direkte.
5. **Verifisering:** et tall eller en regel → test. Et utseende eller en gest → skjermbilde/opptak av Kenneth på test (mobil: Kenneth på telefon, [mobil.md](mobil.md)); si «dette kunne jeg ikke se» når du ikke kan.
6. **Regel 10** før «klar for merge». Egen feature-branch, aldri `develop`/`main`.
7. **3D-filer kan være store.** Ikke commit modellfiler. Testmodeller hentes fra test-prosjektet; ikke generer egne IFC-filer (Kenneth: be om ekte fil).

## 3. Kenneths funnliste (2026-11-16)

Status fylles inn av orkestrator ved merge. ⚪ ikke målt · 🔵 målt · 🟢 merget.

### Web (`test.sitedoc.no` → 3d-visning)

| # | Funn | Status |
|---|---|---|
| W1 | 3D-visningen fyller bare deler av skjermen; verre på høyere oppløsning (lerretet slutter ~y=700 av 1213 px) | 🟢 merget `470f9d57` (ikke deployet) |
| W2 | Snitt virker dårlig eller ikke på PC | 🟢 (1)(2) merget `470f9d57` (ikke deployet). hovertekst «Dobbeltklikk på en flate for å lage snitt» 🟢 merget `23427bdb` |
| W3 | Egenskapskortet viser for få egenskaper — mange lagrede vises ikke | 🔵 type-egenskaper kastes (`tred-viewer-kontekst.tsx:838-876`), kortet kuttes av W1; felles uttrekk med M5 (2) |
| W4 | Pan med høyre museknapp virker ikke | 🟢 merget `470f9d57` (ikke deployet) |
| W5 | Måling i modellen mangler | 🔵 fravær målt; felles med M6. **Kenneth 2026-11-16: første runde = punkt–punkt med avstand + høydeforskjell, uten snapping** |
| W6 | Med Snitt aktivert: zoomer man inn, begynner modellen å drifte ned og ut av skjermen når man nærmer seg (Kenneth 2026-11-16) | 🟢 merget `23427bdb`: rotårsak `ctrl.forward()` flyttet vannrett + camera-controls' egen hjul-dolly på samme hakk; hjulet går nå langs blikket |

### Mobil

| # | Funn | Status |
|---|---|---|
| M1 | Pan virker ikke i én modell på prod; i en annen modell på test virker den | 🟢 merget `5266492e` · samme viewer-kode på test og prod; **Kenneth 2026-11-16: test og prod er to forskjellige modeller** → modellavhengig. **Prod-modellen (Kenneth 2026-11-16): ikke georeferert, omtrent samme størrelse som test-modellen, åpner liten og litt ned mot venstre, nær midten** |
| M2 | Zoom med to fingre er 50–60 % for rask på prod, OK på test | 🟢 merget `5266492e` · som M1 |
| M3 | Rotere objektet virker ikke på prod, virker på test | 🔵 som M1. **Kenneth 2026-11-17:** rotasjon virker på begge, men rundt et punkt utenfor bygget; inne i bygget forsvinner det ut av skjermen og zoom nær er for rask (ønske: rask langt unna, sakte nær). Objekter langt unna bygget er ofte feil-eksport (arkitektens informasjonsfiler). 🟢 § 3b merget `5266492e` (ikke deployet). |
| M4 | Saks / «beskjær bygget» er svært ustabil | 🔵 dobbelttapp gir objektvalg + nye plan; kameralås under dra må måles på touch |
| M5 | Objektinfo viser ingen detaljer, egenskaper eller mål | 🟢 (1) merget `1dfb6191` (ikke deployet); (2) bare direkte attributter, felles uttrekk med W3 |
| M6 | Måling mangler | 🔵 fravær målt; felles med W5 |

W3 og M5 deler kilde i **klienten** (web-ifc i nettleseren), ikke i `ifcMetadata.ts` (som bare lagrer fil-metadata). Felles uttrekk legges i `@sitedoc/shared` av 3D-web; 3D-mobil bruker det.

## 3b. Vedtak om kamera og objekter langt unna (Kenneth 2026-11-17, «Ja til begge»)

Gjelder **både web og mobil** (paritet):
1. **Rotasjon skjer rundt punktet midt på skjermen**: flaten som ligger midt i bildet (raycast fra skjermsenter). Treffer midten ingenting, holdes samme avstand som sist. Brukeren sentrerer selv det hun vil se på. Erstatter «rundt berøringspunktet» (gate (81) `3977c19d`) og webens «rundt eget ståsted».
2. **Zoom-farten følger avstanden til flaten midt på skjermen**: rask langt unna, sakte nær («som en hyperbelfunksjon», Kenneth). Brukeren skal kunne gå inn i bygget uten at det forsvinner ut av bildet.
2b. **Zoom går mot midten av skjermen på både web og mobil — som prøve** (Kenneth 2026-11-17: *«ja, midten på begge -> la oss prøve det. normalt liker jeg zoom mot muspeker og zoom mot midt mellom fingre -> det er egentlig bedre»*). Web-hjulet går langs blikket; mobil får `dollyToCursor = false`. Vurderes på nytt etter Kenneths test; snus det, er alternativet zoom mot muspeker (web) og mot midt mellom fingrene (mobil).
3. **Objekter langt unna bygget skjules som standard**, med bryteren «Vis objekter langt unna». Begrunnelse (Kenneth): ofte feil-eksport DWG→IFC; arkitekter legger informasjonsfiler langt unna tegningen. Innramming og kamera ser bort fra dem uansett. Utligger-regelen er én ren funksjon i `@sitedoc/shared`, brukt av begge flater.

🟢 Mobil: punkt 1, 2, 2b, 3 merget `5266492e`. Web: punkt 1 og 2b merget `23427bdb`; punkt 2 og 3 merget `4a5e1663`. Deployet test `59606595` og prod `2319102e` 2026-11-17.

### 3c. Kenneths test 2026-11-17 og vedtak «kjør i–v»

Testet på test (test-modellen) og prod (prod-modellen), web og telefon. Virker: lerret fyller skjermen, høyre-pan, Snitt uten drift, ?-hjelp, språkbytte, pan med to fingre i begge modeller, bryteren for objekter langt unna. Feil:
- Zoom inne i bygget for treg på web og mobil (utenfor OK).
- Prod-modellen: innzoomet roterer bildet rundt et punkt utenfor bygget (web + mobil). Test-modellen: OK.
- Mobil åpner modellen for liten: test-modellen ~30 % for liten, prod-modellen liten midt på.
- Objektinfo på mobil («3D»): kortet viser bare navnet («Tak»), ingen egenskaper (Kenneth: «a») = W3/M5 (2), ikke i denne runden.

**Vedtak (Kenneth 2026-11-17: «a, kjør i–v»):**
- (i) Pinch på mobil i riktig fart: camera-controls måler fingeravstand fra midtpunkt til finger 2, så én enhet er 16 px, ikke 8.
- (ii) Zoom-kurven: `ZOOM_NAERHET_M` 5 → 1, `ZOOM_MIN_STEG_M` 0,02 → 0,05 (web + mobil). Steg pr. enhet: 50 m 2,45 · 20 m 0,95 · 10 m 0,45 · 5 m 0,21 · 2 m 0,07 · 1 m 0,05.
- (iii) Diagnoselinje `?diag=1` på mobil: avstand, steg, om trykket kommer fram, om modellen lastes fra lagret kopi.
- (iv) Orbit-punktet holdes innenfor byggets boks (ren funksjon i `@sitedoc/shared/tred`, web + mobil).
- (v) Innramming på mobil: modellen skal fylle skjermen ved åpning; finn hvorfor prod-modellen åpner enda mindre.

🟢 (i)–(v) merget `000f08c1` (gate (88)), ikke deployet. Tillegg: kameraet flyr ikke lenger forbi bygget når skjermmidten bommer (`ctrl.distance`). Prod-modellen kan bare verifiseres av Kenneth i prod.

### 3d. Test 2026-11-17 (`3b0f1abb` på test) og vedtak om snittpilen

Kenneth: web *«svært bra funksjonalitet på test»*; telefon: modellen fyller skjermen, zoom og bevegelse *«fungerer godt»*. Lastetiden på telefon er fortsatt lang (ikke språkfiler — bare nb lastes; motor + `web-ifc.wasm` + modell). Diagnoselinjen viser om modellen kommer fra lagret kopi.

**Feil:** snittpilen står i klikkpunktet (`@thatopen/components` 3.3.3 `createPlaneFromIntersection`, `index.mjs:16464`). Zoomer eller panorerer man inn i et rom, havner pilen utenfor bildet, på web og telefon.

**Vedtak (Kenneth 2026-11-17: «ja, bygg snittpilen»):** når kameraet slipper etter zoom, pan eller rotasjon, flyttes pilen i samme plan dit planet krysser skjermmidten (står planet parallelt med siktet: nærmeste punkt på planet). Snittet endres ikke — samme normal, punkt i samme plan, via offentlig `setFromNormalAndCoplanarPoint` (`:16015`). Ikke mens pilen dras. Ren funksjon i `@sitedoc/shared/tred`, brukt av web-viseren og `mobil-viewer` (rulles ut med web-deploy, ikke OTA). 🟢 Merget `1b3edab6` (gate (92)), ikke deployet. Åpent: står planet bak kameraet (kameraet har krysset planet), havner pilen utenfor bildet — vurderes etter Kenneths test.


## 4. Filkart (målt 2026-11-16)

| Lag | Filer |
|---|---|
| Web | `apps/web/src/app/dashbord/layout.tsx` · `apps/web/src/app/dashbord/[prosjektId]/layout.tsx` (lerretet monteres her) · `apps/web/src/app/dashbord/[prosjektId]/3d-visning/` (`page.tsx`, `komponenter/EgenskapsPopup.tsx`, `komponenter/FilterChipBar.tsx`, `hjelpefunksjoner.ts`, `konstanter.ts`, `typer.ts`) · `apps/web/src/app/dashbord/[prosjektId]/tegning-3d/page.tsx` · `apps/web/src/kontekst/tred-viewer-kontekst.tsx` · `apps/web/public/web-ifc*.wasm` |
| Mobil | 🔴 **Motoren er web-siden `apps/web/src/app/mobil-viewer/page.tsx`** i WebView — fikser rulles ut med web-deploy, ikke OTA. Eies av 3D-mobil · `apps/mobile/app/3d-visning.tsx` · `apps/mobile/app/tegning-3d.tsx` · `apps/mobile/src/components/IfcViewer.tsx` · `apps/mobile/src/services/ifcCache.ts` |
| API | `apps/api/src/services/ifcMetadata.ts` |
| Design | `docs/redesign/designnotat-3d-koordinatfesting-design-2026-09-23.md` · `docs/redesign/ordre-3d-koordinatetiketter-design-2026-09-26.md` |

Kartet er utgangspunkt, ikke fasit — mål importene selv.

## 5. Agentene

| Agent | Eier | Innboks |
|---|---|---|
| **3D-web** | W1–W5, web-delen av felles egenskaps-/målelogikk | `relay/inbox-3d-web.md` |
| **3D-mobil** | M1–M6, mobil-delen | `relay/inbox-3d-mobil.md` |

Begge leverer SJEKKPUNKT nederst i `relay/inbox-orkestrator.md`. Kode gates av Kontrollør.
