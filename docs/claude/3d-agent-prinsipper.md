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
| W1 | 3D-visningen fyller bare deler av skjermen; verre på høyere oppløsning (lerretet slutter ~y=700 av 1213 px) | ⚪ |
| W2 | Snitt virker dårlig eller ikke på PC | ⚪ |
| W3 | Egenskapskortet viser for få egenskaper — mange lagrede vises ikke | ⚪ |
| W4 | Pan med høyre museknapp virker ikke | ⚪ |
| W5 | Måling i modellen mangler | ⚪ |

### Mobil

| # | Funn | Status |
|---|---|---|
| M1 | Pan virker ikke i én modell på prod; i en annen modell på test virker den | ⚪ |
| M2 | Zoom med to fingre er 50–60 % for rask på prod, OK på test | ⚪ |
| M3 | Rotere objektet virker ikke på prod, virker på test | ⚪ |
| M4 | Saks / «beskjær bygget» er svært ustabil | ⚪ |
| M5 | Objektinfo viser ingen detaljer, egenskaper eller mål | ⚪ |
| M6 | Måling mangler | ⚪ |

W3 og M5 deler sannsynligvis kilde (`ifcMetadata.ts`) — mål det før to ulike fikser lages.

## 4. Filkart (målt 2026-11-16)

| Lag | Filer |
|---|---|
| Web | `apps/web/src/app/dashbord/[prosjektId]/3d-visning/` (`page.tsx`, `komponenter/EgenskapsPopup.tsx`, `komponenter/FilterChipBar.tsx`, `hjelpefunksjoner.ts`, `konstanter.ts`, `typer.ts`) · `apps/web/src/app/dashbord/[prosjektId]/tegning-3d/page.tsx` · `apps/web/src/kontekst/tred-viewer-kontekst.tsx` · `apps/web/public/web-ifc*.wasm` |
| Mobil | `apps/mobile/app/3d-visning.tsx` · `apps/mobile/app/tegning-3d.tsx` · `apps/mobile/src/components/IfcViewer.tsx` · `apps/mobile/src/services/ifcCache.ts` |
| API | `apps/api/src/services/ifcMetadata.ts` |
| Design | `docs/redesign/designnotat-3d-koordinatfesting-design-2026-09-23.md` · `docs/redesign/ordre-3d-koordinatetiketter-design-2026-09-26.md` |

Kartet er utgangspunkt, ikke fasit — mål importene selv.

## 5. Agentene

| Agent | Eier | Innboks |
|---|---|---|
| **3D-web** | W1–W5, web-delen av felles egenskaps-/målelogikk | `relay/inbox-3d-web.md` |
| **3D-mobil** | M1–M6, mobil-delen | `relay/inbox-3d-mobil.md` |

Begge leverer SJEKKPUNKT nederst i `relay/inbox-orkestrator.md`. Kode gates av Kontrollør.
