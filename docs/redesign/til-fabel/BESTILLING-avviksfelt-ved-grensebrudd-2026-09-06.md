# Bestilling til fabel — avviksfelt når en måling bryter kravet

**Fra cowork 2026-09-06. Kenneth-krav samme kveld, målt mot kode av cowork.**
Henger på DG-designnotatet ditt (`designnotat-pdf-grensekrav-fabel-2026-09-06.md`) — samme
grenseverdier, samme resolver.

## Kravet, med Kenneths ord

> **Kenneth 2026-09-06:** *«Vi trenger da ekstra felt ved rødt → overstiger
> maksverdi / under minimumsverdi → målt avvik.»*

Og bakgrunnen, fra samme samtale:

> *«Malobjektet må kunne definere avvikene som da kommer.»*

**Tre ting i den setningen, og de er ikke det samme:**

1. **Utløseren:** en måling utenfor krav skal åpne felt — slik et rødt trafikklys gjør i dag.
2. **Retningen:** *over maks* og *under minimum* er to forskjellige tilstander.
3. **Innholdet:** avviket skal være **målt**, ikke bare påstått.

## 🟢 Målt: strukturen finnes allerede — det er utløseren som mangler

| Lag | Tilstand | Belegg |
|---|---|---|
| Datamodell | `parentId` er generisk — hvilket som helst felt kan være barn av hvilket som helst felt | `MalObjekt` |
| «Aksepterer barn» | Spør **kun** om `conditionActive === true`, **ikke om felttypen** | `MalBygger.tsx:145` |
| Validering | Usynlige felt er unntatt påkrevd-sjekken — avviksfelt blir ikke krevd når alt er OK | `useSjekklisteSkjema.ts:250-266` |
| 🔴 **Utløseren** | **Låst til valg.** `conditionValues` fylles fra `config.options[0]`; evalueringen sammenligner strenger | `MalBygger.tsx:353` · `useSjekklisteSkjema.ts:261` |

**Et måltall har ingen `options`.** Et desimalfelt kan altså *ha* barn, men det finnes ingen vei
til å slå på betingelsen og ingen regel å evaluere.

🟢 **Kostnaden er derfor én ny utløsertype og én evalueringsgren.** Alt annet virker.

## Coworks anbefaling — form A, ikke form B

| | Form | Vurdering |
|---|---|---|
| **A** | 🟢 **Utløseren utvides, strukturen består.** Tallfeltet får `conditionActive` med utløser «utenfor krav» i stedet for en verdiliste. Avviksfeltene er **vanlige malobjekter**, dratt inn som barn i malbyggeren | **Anbefalt** |
| B | Objektet eier avviksfeltene i sin egen `config` | 🔴 **Bryter Kenneths eget vedtak 05.09:** *«malene må bruke de malene som finnes i malbyggeren — vi må ikke benytte snarveger og hardkode.»* Form B gir to slags felt: de som er objekter, og de som er definert inne i et objekt |

## 🔴 Retningen — coworks kall, du kan overprøve

Kenneth skiller *over maks* fra *under minimum*. Cowork foreslår:

**Én utløser («utenfor krav»), med retningen tilgjengelig som tilstand.**
Malbyggeren kan da velge:
- **Enkel bruk (standard):** ett sett avviksfelt, uansett retning
- **Delt bruk (valgfritt):** ulike felt for over/under, når remediet faktisk er forskjellig

**Hvorfor ikke to utløsere fra start:** for en komprimeringsgrad ≥ 95 % finnes ikke «over
maks» — å tvinge malbyggeren til å konfigurere to grener der bare én kan inntreffe er friksjon
uten gevinst. **Men å bygge det som én tilstand med kjent retning foregriper ingenting** — den
delte varianten kan legges på senere uten å endre datamodellen.

⚠️ **Cowork har tatt dette valget** framfor å sende Kenneth et spørsmål. Er du uenig, er det
din designsak.

## 🟡 «Målt avvik» — ett spørsmål cowork ikke kan avgjøre

Systemet **kjenner** avviket: verdien er 14 mm, kravet er ≤ 10 mm, avviket er 4 mm.

Skal avviksfeltet da:
- **(a)** vises som **beregnet tekst** («Avvik: 4 mm over krav») — brukeren skriver ikke tallet,
  og kan ikke skrive feil tall
- **(b)** være et **felt brukeren fyller** — som da kan motsi den målte verdien
- **(c)** begge: beregnet avvik vist, pluss fritekst «årsak / tiltak»

**Coworks lesning av «målt avvik» er (c)** — tallet beregnes, og det brukeren tilfører er
*hvorfor* og *hva som gjøres*. Men formuleringen kan leses som (b), og forskjellen er hvorvidt
et avvikstall kan avvike fra målingen det beskriver. **Ditt design.**

## Sammenhengen du bør se

Dette og **Vei B** (et valg som setter min/maks på et annet felt) krever **samme
grense-resolver**. Vei B setter grensen; dette reagerer på at den brytes. Og DG-notatet ditt
viser grensen i PDF-en.

🔴 **Tre saker, én resolver.** Cowork anbefaler at du designer dem sammen — ellers bygges
resolveren tre ganger med tre litt ulike former, som er nøyaktig drift-klassen vi brukte i går
på å rydde (`TILBEHOR_REN_FJERNING`, PDF-tvillingen, tre kopier av endringslogg-generatoren).

## Status på de tre

| Sak | Hvor |
|---|---|
| **DG — PDF viser grensekrav** | Designnotat levert 06.09. Cowork har kost-sjekket snapshotet: 🔴 **må lagres SIDESTILT med `verdi`, ikke inni** — inni brekker `harFeltVerdi`, seksjonstelleren og påkrevd-vakten |
| **Vei B — betinget konfigurasjon** | Kostnadsmålt, ikke bygget. Venter MalBygger-UI-design |
| **Dette — avviksfelt ved brudd** | Ny. Ingen ordre skrevet |

## Ikke bestilt

Ordre. **Cowork skriver den når du har designet**, og de tre bør komme som én ordre hvis
resolveren er felles.
