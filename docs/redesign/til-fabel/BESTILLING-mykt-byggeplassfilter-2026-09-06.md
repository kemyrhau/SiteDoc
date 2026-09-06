# Bestilling til fabel — dokumenter uten byggeplass vises overalt, og UI-et sier det ikke

**Fra cowork 2026-09-06. Kenneth-funn på telefon mot PROD, rett etter OTA `42ef3059`.**
Saken har stått som **«ikke vedtatt noe sted»** i masterplanen siden 04.09. Nå traff den brukeren.

## Kenneths ord, ordrett

> *«Jeg kan velge Hele prosjektet og ser dokumenter på tvers av byggeplasser. Jeg kan velge et
> prosjekt → og ser fremdeles dokumenter på tvers av byggeplasser → konsekvens → dette skaper en
> usikkerhet hvor jeg egentlig er innlogget.»*
>
> *«Eller hvorfor vises dokumenter uten entydig byggeplasstilknytning. Er det min dokumentflyt
> som gjør det → da er det kanskje slik det må være?»*

🟢 **Hans andre setning er riktig diagnose.** Det er ikke dokumentflyten — det er at dokumenter
uten byggeplass er **prosjekt-dokumenter**, og de vises under hver byggeplass.

## Målt — det er bevisst kode, uten et skrevet vedtak

```ts
// apps/api/src/routes/sjekkliste.ts:186
...(input.byggeplassId
  ? { OR: [{ byggeplassId: input.byggeplassId }, { byggeplassId: null }] }
  : {}),
```

**Mykt filter:** velger du byggeplass, får du dens dokumenter **pluss alle prosjekt-dokumenter**.

**I Kenneths skjermbilder:** BEF2, BEF3 og BEF4 (kun «Byggeledelse», ingen byggeplass) dukker
opp under **Lakselv Lufthavn**, **Lavangen Kommune** OG **Hitt hjem test**. De ser identiske ut
med dokumentene som faktisk hører til byggeplassen.

⚠️ **Tegninger filtrerer HARDT** på byggeplass (kontrollplans funn B, `ba944c86`). **To flater,
to regler, ingen av dem forklart i UI.**

## Hvorfor det er verre enn en filterdetalj

Kenneths egne ord: *«dette skaper en usikkerhet hvor jeg egentlig er innlogget»*.

🔴 **Kontekst-chippen lover en avgrensning systemet ikke holder.** Den sier «Viser kun denne
byggeplassen — trykk for hele prosjektet», og så viser lista dokumenter fra hele prosjektet.
**Det er samme klasse som `Project.status`** (FL-raden): UI-et lover noe koden ikke gjør.

**Og det treffer piloten:** en anleggsgartner som står på Lakselv Lufthavn og ser dokumenter fra
Lavangen Kommune i samme liste, kan fylle ut feil dokument.

## Coworks lesning — men designet er ditt

**Det myke filteret er sannsynligvis riktig oppførsel.** Et prosjekt-dokument *gjelder* alle
byggeplasser; å skjule det ville gjort det uoppdagbart når man står på en byggeplass.

**Feilen er at lista ikke skiller dem.** Tre mulige former:

| | Form | Vurdering |
|---|---|---|
| **A** | 🟢 **Vis tilhørighet på raden** — prosjekt-dokumenter merkes «Hele prosjektet» | Coworks anbefaling. Minst inngripende, løser usikkerheten |
| B | **Grupper lista** — «På denne byggeplassen» / «Gjelder hele prosjektet» | Tydeligst, men mer vertikal plass på mobil |
| C | Hardt filter, som tegninger | 🔴 Skjuler dokumenter som gjelder. Cowork fraråder |

🔴 **Og uansett form: chip-teksten må slutte å love noe den ikke holder.** «Viser kun denne
byggeplassen» er ikke sant når lista også viser prosjekt-dokumenter.

**Spørsmålet til deg:** skal tegninger og dokumenter ha **samme** regel? I dag er den ene hard
og den andre myk, og ingen av delene er vedtatt.

## Tre mindre funn fra samme runde — cowork tar dem som ordre, ikke design

Nevnt for fullstendighet. **Ingen krever design:**

1. **Pil ved siden av «Innboks» gjør ingenting.** Kenneth: *«ved trykk bør den åpne innboks.»*
2. **Firmanavn kan ikke endres i kontaktkortet.**
3. 🟡 **Dokumentflyt ser ulik ut på mobil og web.** Web viser faggruppe → flyt → roller med
   struktur; mobil viser en flatere liste. **Kan være riktig etter feltarbeid-skillet** — cowork
   måler før noe bestilles. **Si fra hvis du har en mening.**

## Kontekst

> **Kenneth om resten av runden:** *«Mye av dette er veldig bra.»*

OTA `42ef3059` er ute og verifisert: utloggingen virker fra alle skjermer, byggeplass-velgeren
laster, og signaturarbeidet fra i natt er på telefonen.

— cowork
