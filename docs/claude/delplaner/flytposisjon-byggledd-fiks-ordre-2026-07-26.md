---
name: flytposisjon-byggledd-fiks-ordre
status: 🟢 BYGGEORDRE for kode-Opus — fiks flyt-posisjon-headeren (byggLedd kollapser på steg=1). Ren kode. 2026-07-26
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (flytposisjon-header merget, men brutt)
opphav: fabel-verifisering på test — headeren viser kun ÉN boks + variant-C overalt. Rotårsak (cowork-målt): byggLedd grupperer på `steg`, men `steg=1` for alle medlemmer → én ledd.
---

# Byggeordre — fiks flyt-posisjon-headeren (rolle-rekkefølge)

**Rotårsak:** `byggLedd` (`apps/web/src/lib/flyt-ledd.ts`) grupperer medlemmer på `m.steg`. Men `steg` er ikke populert — alle medlemmer har default `steg=1`, så alle roller kollapser til ÉN ledd. Konsekvens: kun én boks vises, og `aktivtIndex === ledd.length-1` blir sant for hvert dokument → variant-C (deaktivert Send + utveier) slår inn universelt. Dette er H1 i praksis (posisjon ikke kodet).

## Ufravikelig
- **INGEN migrering** — ren kode. Ikke rør STATUS-AKTUELT/BACKLOG. Ikke merge — push feature-branch.
- **Ikke bygg stasjonsrelativ steg-omnøkling** (det er posisjonsutredningen). Dette er interim for dagens faste rolle-modell.
- Norsk bokmål, `t()`-i18n, ingen `any`.

## Scope
1. **`byggLedd` — sekvensér på kanonisk rolle-rekkefølge, ikke `steg`:** grupper medlemmer på `rolle`, ordne på kanonisk rang **registrator → bestiller → utfører → godkjenner**. Manglende roller utelates (2-rolle-flyt gir 2 ledd, 4-rolle gir 4). Behold medlems-hover (flere medlemmer i én rolle-ledd) og rolle-etiketten. (Når posisjonsutredningen populerer distinkte `steg`, byttes sekvenseringen tilbake til `steg` — noter det i kode-kommentar.)
2. **`finnAktivtIndex` — rolle-bevisst:** resolve aktiv ledd fra hvem/hvilken rolle som holder dokumentet nå (recipient + status). For et «Mottatt»-dokument hos bestiller skal aktiv ledd = bestiller-ledden. Verifiser at aktiv-markeringen lander på riktig rolle-boks.
3. **Variant-C kun på faktisk siste ledd:** etter fiksen skal deaktivert Send + utveier-fotnote KUN vises når dokumentet reelt er ved siste ledd (`aktivtIndex === ledd.length-1` med FLERE ledd). Verifiser mot fabels design: fotnoten er en forklaring («Siste ledd — ingen neste mottaker. Bruk Godkjenn/Send tilbake/Lukk»), ikke en handlingsliste som duplikerer knapperaden; deaktivert Send er integrert i raden, ikke et løst brødsmule-element.

## DoD — GATE ER RENDRET UTFALL PÅ TEST (ikke kode-artefakter/syntetiske tester)
- [ ] `byggLedd` sekvenserer på rolle-rang; `finnAktivtIndex` rolle-bevisst. Enhets-test med ekte-lignende data (alle `steg=1`, distinkte roller) som beviser flere ledd.
- [ ] web typecheck + test grønt.
- [ ] Vis diff. Push `feat/flytposisjon-byggledd-fiks`. Ikke merge.
- [ ] **FØR merge: verifiser på test (deployet) med EKTE data** — full ledd-rad synlig (4-rolle-flyt viser 4 bokser, 2-rolle viser 2), aktiv boks på riktig rolle, variant-C KUN ved faktisk siste ledd. Skjermbilde. (Denne gaten erstatter forrige runde der syntetiske tester passerte mens ekte data brøt.)
- [ ] Ikke rør STATUS/BACKLOG.
