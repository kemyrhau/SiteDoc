# Ordre: rapporten skal utelate felt som aldri gjaldt jobben

**Til:** cowork velger agent (app-sporet) · **Fra:** design · **Dato:** 2026-09-21
**Branch-forslag:** `feat/pdf-ikke-aktuelt` fra `origin/develop` **etter at `feat/betinget-per-barn` er merget** — den
delte synlighetsfunksjonen er forutsetningen.
**Gatet av Kenneth 2026-09-21.** Skal inn **før** JH2 bygges med betingede felt.
**Bakgrunn:** redesigns måling 2026-09-21: et barn som aldri ble vist, skrives i dag «Ikke utfylt» i rapporten.

---

## 1. Hvorfor

Rapporten skiller i dag mellom besvart og tomt. Med betingede felt oppstår en tredje situasjon: feltet ble **aldri
vist**, fordi vilkåret ikke slo til. I dag skrives det «Ikke utfylt» — en usann påstand om at noen glemte noe.

**Kenneths vedtak 2026-09-21:** felt som aldri ble vist, **skal ikke stå i rapporten i det hele tatt.** Et spørsmål som
ikke var en del av valgene for denne jobben, er støy for den som leser sluttrapporten.

**Kenneths begrunnelse, som er selve regelen:** rapporten skal vise **de valgene og kravene som faktisk gjaldt arbeidet
som ble utført**. Det følger vedtaket om at en sjekkliste dokumenterer utført arbeid, ikke alt som kunne vært gjort.

Design foreslo først en egen «Ikke aktuelt»-rad med begrunnelse. Kenneth valgte utelatelse. Den ene innvendingen — at
malens fulle omfang blir usynlig — dekkes av én setning, se § 2 pkt 4.

🔴 **Skillet som må bygges riktig:** et felt der **«Ikke aktuelt» er et svar**, skal BLI STÅENDE. Da har en fagperson
sett på forholdet og konkludert — f.eks. «Siltskjørt: Ikke aktuelt» eller «Bånd og nett: Ikke aktuelt». Det er
dokumentasjon av en vurdering, og byggherren skal se at den ble gjort. Det som utelates, er felt som **aldri ble vist**:
legger du på ubundet bærelag, er klebing ikke et spørsmål noen skal ta stilling til — de riktige spørsmålene er om
underlaget er tilstrekkelig komprimert og tilstrekkelig plant.

| Tilstand | Når | I rapporten |
|---|---|---|
| Besvart | feltet var synlig og fylt ut | verdien, som i dag |
| Ikke utfylt | feltet **var synlig**, men står tomt | «Ikke utfylt», som i dag — dette er en reell mangel og skal synes |
| Aldri vist | vilkåret slo ikke til | **utelates helt** |

## 2. Hva som skal bygges

1. **Rapporten bruker den delte synlighetsfunksjonen** fra `@sitedoc/shared` (`betingelse.ts`, ny fra
   `feat/betinget-per-barn`) — **ikke** en egen vurdering. App og rapport skal ikke kunne si ulike ting om hva som var
   synlig. Det er hele poenget med at funksjonen ble samlet ett sted.
2. **Sammenstillingen** (`apps/api/src/services/arkiv/sammenstilling.ts`) bygger i dag fra alle malobjekter uten
   synlighetsfilter. Den skal vurdere hvert barn mot forelderens lagrede svar og **utelate** det når vilkåret ikke slo
   til.
3. **Tomme seksjoner:** blir en fase- eller gruppeoverskrift stående alene fordi alle feltene under er utelatt, skal
   overskriften også utelates. En tom overskrift er like mye støy som raden var.
4. **Én setning om filtreringen**, plassert der rapporten forklarer seg selv (f.eks. under sjekklistens tittel eller i
   bunnteksten): *«Felt som ikke gjaldt dette arbeidet, er utelatt.»* Den skal bare vises når noe faktisk er utelatt.
   Da vet leseren at listen er filtrert, i stedet for å lure på om noe er fjernet i ettertid. Egen i18n-nøkkel.
5. **i18n:** nye nøkler i `nb.json` og `en.json`, deretter
   `pnpm dlx tsx src/i18n/generate.ts --only <nøklene>` fra `packages/shared`. Husk fella: endrer du en eksisterende
   verdi, må den slettes fra målspråkene først — `--only` fyller bare det som mangler.

## 3. Grenser

- **Ingen endring i hva som lagres.** Tilstanden utledes ved rendring, den skrives ikke til databasen.
- **Felt uten forelder** er uendret: tomt er «Ikke utfylt», som i dag.
- **Repeater-rader og `utenfor_krav`-avviksfelt** skal oppføre seg som før. Er du i tvil om et tilfelle, meld det i
  stedet for å velge.
- Ingen migrering. Prod-gaten røres ikke.

## 4. Definition of Done

1. Aldri-viste felt utelates, tomme overskrifter faller bort, og setningen om filtrering vises når noe er utelatt.
2. **Rød først:** en test med en mal der ett barn aldri ble vist og ett var synlig og tomt — før endringen står begge
   som «Ikke utfylt»; etter skal det første være borte og det andre stå igjen.
3. Regresjon: eksisterende rapporter uten betingede felt er **byte-likt** uendret. Vis det.
4. **Tekstbevis:** de tre tilstandene gjengitt fra en generert rapport, limt i leveransen. Ingen skjermbilder.
5. Gate-tall via `pnpm exec turbo run test --force`, web build og mobil typecheck.
6. Diff: `sammenstilling.ts`, `packages/pdf/src/felt.ts`, i18n-nøkkelen og tester. Rører du noe annet, meld hvorfor.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

Design gater at riktig felt forsvinner og at «Ikke utfylt» fortsatt står der det skal. Cowork gater teknisk.
