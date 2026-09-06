# Til fabel — fire funn fra malgjennomgangen 2026-09-05

**Fra cowork. Kenneth-gatet samme dag.** Kopi i repoet; meldingen ble relayet.

Kenneth ba om en kritisk gjennomgang av de eksisterende NS 3420-malene før flere bygges. Fire
funn kom ut, og alle er design — ingen er skrevet som kodeordre.

## Kontekst: hva vi faktisk har

**Målt i `seed-bibliotek.ts`, ikke lest i dokumentasjonen (som har driftet):**

| | |
|---|---|
| Standarder | **2** — NS 3420-K og **NS 3420-F** (F er ikke nevnt i `kontrollplan.md` i det hele tatt) |
| Maler | **12** — seks K, seks F |
| Felt totalt | **83** — 34 `traffic_light`, 29 `list_single`, 20 `decimal`, **0 `text_field`** |
| Felt per mal | 4–9 (regelen sier maks ~10 ✅) |
| I test-DB | **6** (kun K). **F-malene er aldri seedet noe sted** |
| I prod | **0** |

Reglene ligger i [`kontrollplan.md` § Felttype-regler (KRITISK)](../../claude/kontrollplan.md) og
følges bedre enn dokumentasjonen antyder.

---

## A. 🔴 Kollapsbare fase-seksjoner — TREDJE forekomst av «velger ved skala»

**Kenneth 2026-09-05:** *«Kan vi utnytte overskrift → den vil minimere underliggende felter.»*

**Målt:** `OverskriftObjekt.tsx` er fire linjer — bare en `<h3>`. Feltene under er ikke barn, de er
søsken i en flat liste. Kollaps krever at rendringen grupperer felt mellom heading-grenser.

**Løser tre ting samtidig:** trafikklysenes plassbruk (funn B) · maler på 9–16 felt · og det gjør
den tunge veien i funn C levelig.

🔴 **Men risikoen er større her enn i en velger, og Kenneth har godkjent løsningen:**

I lån-dialogen er en skjult mal harmløs — du søker den fram. **I en sjekkliste kan en kollapset
seksjon bli glemt, og da står det uutfylte kontrollpunkter i et kvalitetsdokument som ser ferdig
ut.** Headeren må derfor bære status:

```
▸ FØR      3 av 3 utfylt   ✓
▾ UNDER    1 av 3 utfylt
▸ ETTER    0 av 3          ⚠
```

✅ **Kenneth-gatet 05.09:** *«Jeg liker din idé om status på headeren → ja.»*

**Ditt kall:** dette er tredje forekomst av kollapsbare grupper — etter lån-dialogen (AM 4b) og
byggeplassvelgeren (BL). Du sa 05.09 at delt komponent avgjøres når **to reelle flater** finnes.
Nå er det tre. **Men denne er ikke en velger** — det er et skjema man arbeider i, og statuskravet
gjelder bare her. Hører den under «velger ved skala», eller er den sin egen sak?

---

## B. 🟡 Trafikklys tar for mye plass

**Kenneth 2026-09-05:** *«Jeg liker ikke trafikklys så godt → lysene er for store i bruk.»*

**34 av 83 felt** er trafikklys. Det er ikke en detalj.

**Cowork-observasjon, til din vurdering:** reglene i `kontrollplan.md` foretrekker allerede
`list_single` med informative valg framfor trafikklys. Erstattes de, blir dokumentet **mer presist
samtidig** — «komprimeringsskade observert» sier noe «rødt lys» ikke gjør. Eksempel fra KB2:

| I dag | Kan bli |
|---|---|
| 🚦 Leveringsdokument kontrollert | «Kontrollert – i samsvar med Tabell K2» · «Avvik i dokumentasjon» · «Dokumentasjon mangler» |
| 🚦 Jord ikke komprimert | «Ikke komprimert» · «Lett pakket – akseptabelt» · «Komprimeringsskade observert» |

**Åpent for deg:** er problemet komponentens *størrelse* (design), eller at trafikklys er *feil
verktøy* for de fleste av de 34 (innhold)? Svaret avgjør om dette er en UI-justering eller en
malrevisjon.

---

## C. 🔴 Betinget KONFIGURASJON finnes ikke — kun betinget synlighet

**Funnet i KB2:** velger du «Grasplen (15 cm vekstjord)» i formålsfeltet, **vet malen at
lagtykkelsen skal være 15 cm**. Men lagtykkelse-feltet har verken `min` eller `maks` — brukeren må
huske valget og lese hjelpeteksten.

**Målt mekanikk** (`useSjekklisteSkjema.ts:236-258`, speilet i mobil):

```
forelder.config.conditionActive + conditionValues[]
  └─ barn VISES når forelderens verdi matcher (rekursivt, maks 10 nivåer)
```

Den kan vise/skjule. Den kan **ikke** sette `min`/`maks`.

**To veier:**

**Vei A** — åtte varianter av lagtykkelse-feltet, én per planteformål, hver med sin `min`. Virker i
dag, ingen kodeendring. Malen går fra 9 til 16 felt, og hver variant vedlikeholdes for hånd.
*(Funn A gjør denne levelig — variantene skjules i en kollapset seksjon.)*

**Vei B** — la forelderens valg sette `min`/`maks` på barnet. Malen forblir 9 felt.

🔴 **Coworks anbefaling er B, og grunnen er at den løser en KLASSE:** i NS 3420 varierer fall med
arealtype, planhet med belegningstype, komprimering med masse. Vei A løser KB2 og etterlater et
vedlikeholdsproblem i hver av de neste hundre malene.

**Kostnaden er ikke målt ennå** — den treffer skjema-hookene (web + mobil), validering og
PDF-visningen (som må vise hvilket krav som gjaldt).

---

## D. 🟡 Alle tolv maler er «AI-utkast», og feltet som skulle spore kontroll er dødt

**Ikke i en kommentar — i `beskrivelse`, som kunden ser:**

```
«Utlegging av vekstjord — kontroll iht. Tabell K4 (AI-utkast)»
«Bergsprengning — salveplan, rystelser, profil (AI-utkast)»
```

Tolv av tolv. **Ingen er fagverifisert.**

Og `BibliotekMal.verifisert` — kolonnen med kommentaren *«True når malen er verifisert mot
kilde-norm»* — er **død**: settes ikke i seed, leses ikke i api eller web. Samme klasse som
`ansvarsmerke`.

**Coworks vurdering:** «AI-utkast» hører ikke i kundesynlig tekst. Statusen hører i `verifisert`,
og UI-et bør vise utkast som utkast. **Men hvordan en uverifisert mal skal se ut — og om den i det
hele tatt skal kunne lånes — er ditt kall.**

⚠️ **Kenneth verifiserer selv mot kilden** (han leser NS 3420 daglig). Gjennomgangen av KB2 samme
dag ga to rettelser og **to tilfeller der cowork tok feil** — malen var bedre enn førsteinntrykket.
Fagkontrollen virker; den mangler bare et sted å registreres.

---

## Hvor dette hører i køen

Din rekkefølge fra 05.09 står: **LP → EX → AG → BL**. Ingen av de fire over er bestilt inn i den.

**Coworks lesning:** A og B er små og treffer hver eneste mal vi bygger heretter — de har verdi
tidlig. C er større og henger sammen med hvor mange maler vi faktisk skal bygge. D er en
prosess-sak som kan vente til det finnes maler å verifisere.

Men rekkefølgen er din.
