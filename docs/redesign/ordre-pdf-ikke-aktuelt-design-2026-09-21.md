# Ordre: tre tilstander i rapporten — besvart, ikke utfylt, ikke aktuelt

**Til:** cowork velger agent (app-sporet) · **Fra:** design · **Dato:** 2026-09-21
**Branch-forslag:** `feat/pdf-ikke-aktuelt` fra `origin/develop` **etter at `feat/betinget-per-barn` er merget** — den
delte synlighetsfunksjonen er forutsetningen.
**Gatet av Kenneth 2026-09-21.** Skal inn **før** JH2 bygges med betingede felt.
**Bakgrunn:** redesigns måling 2026-09-21: et barn som aldri ble vist, skrives i dag «Ikke utfylt» i rapporten.

---

## 1. Hvorfor

Rapporten skiller i dag mellom besvart og tomt. Med betingede felt oppstår en tredje tilstand som ikke har noe navn:
feltet ble **aldri vist**, fordi vilkåret ikke slo til.

«Ikke utfylt» er da en usann påstand. Den sier at noen glemte noe. Havner rapporten i en tvist, leser byggherren de
radene som hull i kontrollen, og entreprenøren kan ikke motbevise det ut fra dokumentet. Å skjule feltene helt er
bedre, men da mister leseren at spørsmålet fantes.

**Vedtatt løsning: tre tilstander.**

| Tilstand | Når | Vises som |
|---|---|---|
| Besvart | feltet var synlig og fylt ut | verdien, som i dag |
| Ikke utfylt | feltet **var synlig**, men står tomt | «Ikke utfylt», som i dag — dette skal fortsatt synes |
| **Ikke aktuelt** | feltet ble **aldri vist** (vilkåret slo ikke til) | «Ikke aktuelt», med kort begrunnelse |

**Begrunnelsen** skal vise hvorfor, hentet fra svaret som styrte det. Form: «Ikke aktuelt – forelderens spørsmål:
forelderens svar», for eksempel «Ikke aktuelt – Underlaget består av: Ubundet lag». Da er dokumentet selvforklarende
for en som leser det to år senere.

## 2. Hva som skal bygges

1. **Rapporten bruker den delte synlighetsfunksjonen** fra `@sitedoc/shared` (`betingelse.ts`, ny fra
   `feat/betinget-per-barn`) — **ikke** en egen vurdering. App og rapport skal ikke kunne si ulike ting om hva som var
   synlig. Det er hele poenget med at funksjonen ble samlet ett sted.
2. **Sammenstillingen** (`apps/api/src/services/arkiv/sammenstilling.ts`) bygger i dag fra alle malobjekter uten
   synlighetsfilter. Den må vurdere hvert barn mot forelderens lagrede svar og merke det som ikke aktuelt når vilkåret
   ikke slo til.
3. **Rendreren** (`packages/pdf/src/felt.ts`, fem steder med «Ikke utfylt») skiller de to tomme tilstandene. «Ikke
   aktuelt» skal være visuelt roligere enn «Ikke utfylt» — den er ikke en mangel.
4. **i18n:** ny nøkkel for «Ikke aktuelt» i `nb.json` og `en.json`, deretter
   `pnpm dlx tsx src/i18n/generate.ts --only <nøkkelen>` fra `packages/shared`. Husk fella: endrer du en eksisterende
   verdi, må den slettes fra målspråkene først — `--only` fyller bare det som mangler.

## 3. Grenser

- **Ingen endring i hva som lagres.** Tilstanden utledes ved rendring, den skrives ikke til databasen.
- **Felt uten forelder** er uendret: tomt er «Ikke utfylt», som i dag.
- **Repeater-rader og `utenfor_krav`-avviksfelt** skal oppføre seg som før. Er du i tvil om et tilfelle, meld det i
  stedet for å velge.
- Ingen migrering. Prod-gaten røres ikke.

## 4. Definition of Done

1. Tre tilstander i rapporten, med begrunnelse på «Ikke aktuelt».
2. **Rød først:** en test med en mal der ett barn aldri ble vist og ett var synlig og tomt — den skal vise «Ikke
   utfylt» for begge før endringen, og riktig tilstand for hver etter.
3. Regresjon: eksisterende rapporter uten betingede felt er **byte-likt** uendret. Vis det.
4. **Tekstbevis:** de tre tilstandene gjengitt fra en generert rapport, limt i leveransen. Ingen skjermbilder.
5. Gate-tall via `pnpm exec turbo run test --force`, web build og mobil typecheck.
6. Diff: `sammenstilling.ts`, `packages/pdf/src/felt.ts`, i18n-nøkkelen og tester. Rører du noe annet, meld hvorfor.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

Design gater at de tre tilstandene er riktige og at begrunnelsen er lesbar for en byggherre. Cowork gater teknisk.
