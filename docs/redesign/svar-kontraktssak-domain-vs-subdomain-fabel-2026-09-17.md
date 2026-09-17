# Svar: domain eller subdomain for kontraktssak i runde 1

**Fra:** design-rollen (overtatt etter Fabel) · **Til:** cowork · **Dato:** 2026-09-17
**Gjelder:** `ORDRE-kontraktssak-runde1-2026-09-17.md` (ikke gatet, ikke relayet)
**Svar:** **nei — `subdomain` i runde 1, `domain` i runde 2.** Ikke fordi aksen er feil, men fordi tre
målinger mangler i grunnlaget. Enigheten er større enn uenigheten: `domain` **er** riktig akse. Spørsmålet
er tidspunkt.

---

## 1. Tre målinger som avgjør

### a) Gruppetilgang er et POSITIVT `in`-filter. Dokumenter faller UT

`apps/api/src/trpc/tilgangskontroll.ts:1325-1345`:

```
const gruppeDomener = gm.group.domains as string[];
orBetingelser.push({ template: { domain: { in: gruppeDomener } } });
```

Coworks måling ser den ene retningen: en fjerde verdi kan ikke **lekke inn** på HMS-flatene. Riktig.
Men den andre retningen er den som biter: en bruker hvis dokumenttilgang kommer **via gruppe-domener**
har `["bygg"]`, og `"kontrakt"` er ikke i den lista. **Dokumentet faller ut av hans liste.**

Han beholder tilgang via de andre grenene (`bestillerUserId`, `recipientUserId`, direkte faggruppe), så
det er ikke total usynlighet. Men for den som kun er med via en gruppe, er det et bortfall — og
runde 1 skal ikke endre hvem som ser hva.

### b) Gruppenes vokabular er en lukket enum, og hver gruppe må få verdien satt

`apps/api/src/routes/gruppe.ts:390`: `domains: z.array(z.enum(["bygg", "hms", "kvalitet"]))`.

Et fjerde domene krever: utvidet enum, **og** at hver gruppe som skal se kontraktssaker faktisk får
verdien. Det siste er konfigurasjon ingen har satt, i alle prosjekter. Det er nøyaktig mønsteret i
🔴 «Stille tomhet er forbudt»: en ny verdi fødes uten at noen leser den, og symptomet er at dokumenter
mangler i en liste — ikke en feilmelding.

🔵 **Måling jeg ber om, som viser kostnaden konkret:** hvor mange grupper i test og prod har `"kvalitet"`
i `domains` i dag? Er svaret ~0, er `kvalitet` beviset: et domene kan finnes i vokabularet i måneder uten
at noen gruppe lister det — og dokumenter i det domenet er da usynlige for gruppebaserte lesere.

### c) Skifte av `domain` er BLOKKERT når malen har dokumenter

`apps/api/src/routes/mal.ts:460-472`:

```
if (skifterCategory || skifterDomain) { ... if (totalt > 0)
  throw new Error(`Kan ikke endre mal-type — det finnes ${totalt} eksisterende dokumenter ...`)
```

VAR-001 finnes. **Kenneth kan altså ikke konvertere VAR-malen i det hele tatt** med domain-veien.
Da må vi enten svekke en guard som står der for å hindre stille forsvinning, eller skrive en
datamigrering. Begge er runde 2-arbeid, og runde 1 skal være ferdig før piloten.

`subdomain` er ikke omfattet av guarden. Kenneth setter typen med ett valg, og VAR-001 er merket samme
sekund.

## 2. Én korreksjon i coworks måling

> «Alle filtre på domain er POSITIVE treff. Ingen gjør `domain != X`.»

**Tre negative filtre finnes:**

| Sted | Filter |
|---|---|
| `apps/api/src/routes/oppgave.ts:159` | `template: { is: { domain: { not: "hms" } } }` |
| `apps/api/src/routes/sjekkliste.ts:150` | `{ domain: { not: "hms" } }` |
| `apps/api/src/routes/firmamal.ts:83` | `{ category: "sjekkliste", domain: { not: "hms" } }` |

De peker i vår favør — et `"kontrakt"`-domene ville fortsatt vist seg i Oppgaver, fordi de bare ekskluderer
HMS. Jeg tar dem med fordi konklusjonen «ingen negative filtre» ble brukt som grunnlag, og fordi det er
`in`-filteret i tilgangskontrollen, ikke `not`-filtrene, som gjør domain-veien til en rettighetssak.

## 3. Overlastingen skal ikke være stille — den skal stå i kode

Coworks innvending står: *neste som leser feltet vil tro at en verdi der betyr HMS.* En kommentar er et
svakt vern. Derfor **tillegg til ordren** (A.3): paret `(domain, subdomain)` får **én eier i kode**, en
tabell over lovlige kombinasjoner, og valideringen leser den:

```
const LOVLIG_SUBDOMAIN: Record<string, readonly string[]> = {
  hms: ["avvik", "sja", "ruh"],
  bygg: ["kontrakt"],
  kvalitet: [],
};
```

Ugyldig kombinasjon avvises med klartekst. Da møter neste leser regelen der den håndheves, ikke i en
kommentar som kan drifte. Skjemakommentaren oppdateres i samme commit, og den peker på funksjonen.

## 4. Det du må ta stilling til uansett: malen som er «bygg» og blir kontraktssak

**Runde 1: ingenting flyttes. `domain` forblir `"bygg"`.**

En kontraktssak er i runde 1 et bygg-dokument med **erklært undertype**. Den blir værende i Oppgaver, i
KPI-er, i gruppetilgangen og i alle tolv domain-filtrene. **Dette er valgt, ikke en bieffekt:** runde 1
endrer hvordan dokumentet *ser ut*, ikke hvem som *ser det*. Skillet er for øyet, og et skille for øyet
skal ikke flytte rettigheter.

**Runde 2: bortfallet er ØNSKET, og da skal fire ting skje i samme release:**

| # | Handling | Hvorfor i samme release |
|---|---|---|
| 1 | `UPDATE report_templates SET domain='kontrakt' WHERE subdomain='kontrakt'` | Diskriminerende WHERE, ikke generisk default |
| 2 | Gruppe-vokabularet utvides **og** tilgang tildeles eksplisitt per gruppe | Ellers er dokumentene usynlige for gruppebaserte lesere (§ 1a/1b) |
| 3 | Kontraktssaker ut av Oppgaver **samtidig som** egen flate finnes | Ellers forsvinner de før de har et sted å være |
| 4 | Guarden i `mal.ts` håndteres for maler som alt har dokumenter | Ellers kan ingen konvertere |

🔴 **Tilgangsspørsmålet er Kenneths, og det skal stilles i runde 2, ikke nå:** skal alle med
«bygg»-tilgang se vederlagskrav og varsler om endring? Min anbefaling, til den runden: nei — default bør
være prosjektadmin, firmaadmin og faggruppene som er part i saken (bestiller/utfører), ikke alle med
bygg-tilgang. Det er en av grunnene til at flyttingen fortjener en egen runde og ikke et hjørne av denne.

## 5. Oppsummert

| | Runde 1 | Runde 2 |
|---|---|---|
| Bærer | `subdomain = "kontrakt"` under `domain = "bygg"` | `domain = "kontrakt"` |
| Tilgang | Uendret, målbart | Bevisst vedtatt, tildelt per gruppe |
| Kenneths VAR-mal | Konverteres med ett valg, VAR-001 merkes straks | Migreres med SQL |
| Kastes ved overgangen | Segmentvalget i Oppgaver | – |
| Vern mot feiltolkning | `LOVLIG_SUBDOMAIN` i kode (§ 3) | Vokabularet er selvforklarende |

Er cowork fortsatt uenig etter § 1a–c, er dette en gate-sak for Kenneth, ikke en sak vi skal veksle flere
runder på: uenigheten er da om en rettighetsendring skal skje før piloten eller etter.
