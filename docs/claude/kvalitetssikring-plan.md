---
name: kvalitetssikring-plan
description: 🟢 VEDTATT 2026-08-31 — fire lag mot regresjoner, rangert etter hva de garanterer. Utløst av tre regresjoner på én dag som alle kompilerte grønt.
sist_verifisert_mot_kode: 2026-08-31
---

# Kvalitetssikring — fire lag mot regresjoner

> **Kenneth 2026-08-31:** *«Er det mulig å gjøre en kvalitetssikring på endringer på en slik
> måte at vi sikrer at vi ikke skader funksjoner som fungerer?»* … *«la oss prøve — det er på
> tide med en ny tilnærming.»*

## Hvorfor dagens nett ikke fanget noe

**Tre regresjoner 2026-08-31. Alle kompilerte grønt. Alle passerte regel 10.**

| Regresjon | Hva den var | Hvorfor typer/tester bommet |
|---|---|---|
| Tegningsmodalen kunne ikke lukkes (bygg 46) | Geometri — header under Dynamic Island | Ingen type beskriver «knappen er truffbar» |
| Tekstfelt låst (bygg 47) | Importbytte `SafeAreaView` | Identiske typer, identisk signatur |
| Timer kastet ved manglende lønnsart | Tidlig `return` som var korrekt etter egen logikk | Koden gjorde det den var skrevet for |

🔴 **Lærdommen: flere enhetstester ville ikke hjulpet.** Alle tre var **atferd**, synlig kun
når en enhet eller et menneske rørte flaten. Nettet må derfor legges et annet sted enn der vi
instinktivt legger det.

## Målt utgangspunkt (2026-08-31)

| Pakke | Testfiler | Kjøres i CI? |
|---|---|---|
| `apps/api` | **29** | 🔴 **NEI — pakken mangler `test`-script** |
| `apps/web` | 29 | ✅ |
| `packages/shared` | 25 | ✅ |
| `packages/pdf` | 10 | ✅ |
| **`apps/mobile`** | **0** | — |
| E2E (Playwright, `tests/e2e/`) | 10 filer | ❌ ikke i CI |

**To funn:** 29 API-tester er skrevet og har aldri kjørt automatisk — de mangler ett linjes
script. Og mobilen, der alle tre regresjonene skjedde, har null dekning.

---

## Lag 1 — gjør feilklassen ULOVLIG (eneste som garanterer)

**Prinsipp:** når vi finner en feilklasse, spør *«kan denne gjøres umulig?»* før
*«kan vi teste for den?»*.

**Presedens, samme dag:** `no-restricted-imports` som forbyr `SafeAreaView` i `apps/mobile`
(`.eslintrc.json`, levert i `b852c2ea`). Den kan ikke glemmes, og den virker for enhver
fremtidig agent — inkludert cowork, som innførte feilen.

**Dette er det eneste laget som fjerner en feilklasse permanent.** De tre andre reduserer
sannsynlighet.

🔴 **Kjent hull:** lint-scriptet er `eslint src/` — `apps/mobile/app/` er **ikke** dekket.
Fire modalfiler der er dermed ubeskyttet. Utvides til `eslint src/ app/` i egen runde;
utvidelsen flagger også legitime skjerm-røtter, som må ryddes eller unntas bevisst.

### Kandidater til nye regler (ikke besluttet)

- `<Modal>` uten `presentationStyle` → tvungen eksplisitt verdi. iOS-defaulten er
  `fullScreen`, og det var **den skjulte defaulten** som gjorde `TekstfeltObjekt` rammet uten
  å se sånn ut i koden.
- Direkte `prisma.<modell>.count()` i slettevakter uten at både medlemmer og avhengige rader
  telles — vanskeligere å uttrykke som lint, men verdt å vurdere som kodegjennomgangs-punkt.

---

## Lag 2 — simulator-røyktest FØR hvert EAS-bygg (største gevinst)

**Oppsettet finnes og er bevist.** Simulator-Opus målte 2026-08-31 insets til pikselen,
skilte fullScreen fra pageSheet, og svarte på fire spørsmål med tall — uten et eneste
skjermbilde i kontekst.

🔴 **Alle tre av dagens regresjoner ville blitt fanget her, før bygget.**

**Form:** fast flyt-liste, kjørt av simulator-agent, rapportert som **tekst**
(`idb ui describe-all` + Metro-logg). Skjermbilde kun når spørsmålet er visuelt
(SAMARBEIDSREGLER § 10c — én skjermbilde-tung runde brukte 46 % av ukebudsjettet).

### Røykliste v1 — ti flyter (forslag, justeres etter første kjøring)

1. Logg inn → dashbord laster
2. Åpne sjekkliste → fyll et tekstfelt → «Ferdig» er truffbar → verdien består
3. Repeater: legg til rad → sett tegningsposisjon → bekreft → kom ut uten app-drap
4. Legg kommentar + bilde på et felt
5. Forstørr et bilde → lukk igjen
6. Opprett nytt dokument fra plussknappen
7. Åpne en oppgave → send til neste ledd
8. HMS-registrering → opprett og lagre
9. Timer: åpne dagsseddel → legg til rad → lagre
10. Drep appen midt i utfylling → start → utkastet består

**Per flyt rapporteres:** nådde jeg målet, hvor mange trykk, og — for hver skjerm med
kontroller øverst — er de truffbare (`idb ui tap`, ikke øyemål).

**Gate:** listen kjøres **før** `eas build`, ikke etter. Ett funn = bygget utsettes.

---

## Lag 3 — slå på det vi allerede har (billigst)

1. **`apps/api` mangler `test`-script.** Legg til `"test": "vitest run"` → 29 tester begynner
   å gate i CI. 🔴 **Forventes å avdekke røde tester** som ingen har sett — det er poenget,
   men det er en egen ryddejobb, ikke en drive-by.
2. **`apps/mobile` har verken tester eller script.** Ikke skriv suiter for syns skyld —
   lag 2 dekker atferden bedre. Men et par rene enhetstester på `feltLaasing`-klassen og
   `flytPosisjon.nesteLedd` ville fanget logikk vi har brutt to ganger.
3. **E2E kjøres ikke i CI.** Ti Playwright-filer finnes. Vurder om de er vedlikeholdt nok til
   å slås på, eller om de skal arkiveres — en testsuite som ikke kjører er verre enn ingen,
   fordi den ser ut som dekning.

---

## Lag 4 — det vi IKKE gjør

**Ingen skriftlig funksjonsliste som eget dokument.** Den blir foreldet og lest av ingen.
Røyklisten i lag 2 **er** funksjonslisten — forskjellen er at den kjøres.

---

## Rekkefølge

| # | Tiltak | Kostnad | Fanger |
|---|---|---|---|
| 1 | `test`-script i `apps/api` | minutter | logikkfeil i 29 eksisterende tester |
| 2 | Røykliste v1 + fast kjøring før EAS | én runde å skrive, ~20 min per bygg | **alle tre av dagens regresjoner** |
| 3 | Lint-scope utvidet til `app/` | én runde | fremtidige `SafeAreaView`-i-modal |
| 4 | Nye lint-regler når feilklasser finnes | løpende | permanent, per klasse |

## Ærlig begrensning

**Ingenting av dette hindrer at en fiks bryter noe i et hjørne ingen har tenkt på.** Lag 1 er
øverst nettopp fordi det er det eneste som fjerner en feilklasse i stedet for å redusere
sannsynligheten for at den slipper gjennom.

Røyklisten dekker ti flyter av flere hundre. Den er valgt fordi de ti er de piloten faktisk
bruker — ikke fordi de er nok.
