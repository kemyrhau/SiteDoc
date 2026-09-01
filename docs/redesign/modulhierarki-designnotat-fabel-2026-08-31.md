---
name: modulhierarki-designnotat
description: Fabels designnotat — revidert modulhierarki, definisjon av «aktivert» per nivå, eierflate per nivå. Svar på fabel-modulhierarkiet-revisjon.md (cowork 2026-08-31) og modulmodell-utredning-2026-08-30.md Q1–Q3.
status: 🟢 KOMPLETT — V1, V2 og V3 Kenneth-vedtatt 2026-08-31. Revisjon 1 (to familier + standalone-carveout) flettet inn av cowork samme dag. Klar for ordre.
skrevet: 2026-08-31 av fabel
revidert: 2026-08-31 — revisjon 1 (ENDRING A–D) flettet inn av cowork etter cowork-gate som målte at formelen bare gjaldt firmamodul-familien
---

# Modulhierarkiet — designnotat (fabel)

**Grunnlag:** cowork-utredningen 2026-08-30 (§ 3-målingen er ferskvare — utføreren måler på
nytt), Kenneths historikk og forslag 2026-08-31, det bindende vedtaket i domene-arbeidsflyt.md
(«begge nivåer må være aktive»), og de fem målte drift-punktene.

**Fakta vs forslag:** alt merket V# er FORSLAG som trenger Kenneth-vedtak. Alt annet er
enten Kenneth-vedtak som allerede er ført, eller coworks målinger.

---

## 1. Revidert hierarki (svar på ask 1)

### V1 — Timer-familien er ETT kjøp med to underbrytere (anbefales vedtatt)

Kenneth foreslo det selv («kanskje»); cowork har målt at det er billig (svake String-felt,
ingen dataendring). Fabel anbefaler JA, med denne presiseringen:

- **Kjøpet heter Timer.** Kjøper firmaet Timer, følger Maskinregistrering og Varelager med,
  **på som default**.
- **Underbryterne er firma-nivå av/på** for firmaer som ikke ønsker maskin eller varelager.
  De er ikke egne kjøp og vises ikke som egne moduler i modullisten — de vises som brytere
  *inne i* Timer-kortet på firma/moduler.
- Konsekvens for salg (Kenneth bekrefter): timer kan ikke lenger selges alene uten at maskin/
  varelager i det minste følger med avslått. Stat/kommune-caset (ingen av de tre) dekkes av å
  ikke kjøpe Timer.

### Revidert diagram (erstatter terminologi.md § 0 — cowork fletter som TILLEGG)

```
Firma (Organization)
├── Firmaadministrasjon
│   ├── Firmamoduler (tverrgående, kjøpes per firma):
│   │   ├── Timer
│   │   │   ├── Maskinregistrering  (underbryter, default på)
│   │   │   └── Varelager           (underbryter, default på)
│   │   ├── Kompetanse              (KOMMER SNART — kan ikke aktiveres)
│   │   └── Fremdriftsplanlegging   (KOMMER SNART — kan ikke aktiveres)
│   └── Prosjektmalverk
└── Prosjekter
    └── Prosjekt
        ├── Faggrupper + Dokumentflyt (alltid på)
        ├── Tegninger (alltid på — representerer byggeplass)
        └── Prosjektmoduler (av/på per prosjekt, KUN under aktivt firmatak)
```

Regler diagrammet nå bærer eksplisitt (retter drift-punkt 1 og 2):
- Varelager står i diagrammet (var fraværende; koden har hatt den live). Schema-kommentaren
  «fremtidig» (`schema.prisma:285`) rettes — den beskriver ikke koden.
- Kompetanse og Fremdrift merkes KOMMER SNART i diagrammet, som i koden. Dokumentasjonen skal
  aldri liste dem som aktiverbare før koden gjør det.

### V2 — Q2 og Q3 fra utredningen (anbefales vedtatt samtidig)

- **Q2 — per-ansatt modulbegrensning: JA, som unntak (Kenneth-presisert 2026-08-31).**
  Firma kjøper → **alle ansatte får som default**. Firma kan **begrense enkeltansatte ved
  behov**. Formen som løser 50-ansatte-problemet: begrensningen er en **unntaksliste på
  modulen** (firma/moduler → modulkortet → «Begrens tilgang» → velg ansatte som IKKE skal ha
  tilgang), aldri et felt på ansattkortet. Nytt modulkjøp krever da null kort-redigeringer;
  kun unntakene føres, der modulen styres. `modulNokler` (opt-in-liste på
  `OrganizationMember`) gjeninnføres IKKE — lagringsform (foreslått: deny-liste per
  OrganizationModule) avgjøres i ordren, målt mot koden.
- **Q3 — ansattkortet:** moduler redigeres ikke på kortet. Unntak fra en modul kan vises som
  lesefelt-speil («begrenset: Timer») som lenker til firma/moduler der unntaket styres — men
  kortet er aldri skriveflate for moduler. REG fase 2 avblokkert: `modulNokler` som opt-in-
  felt utgår.

---

## 2. Hva «aktivert» betyr på hvert nivå (svar på ask 2)

> 🔄 **REVIDERT** av `revisjon1-fabel-2026-08-31` (ENDRING A), flettet inn av cowork
> 2026-08-31. Den opprinnelige teksten hadde **én** formel for «moduler» — den var generalisert
> fra timer-familien uten at prosjektmodul-settet var målt, og ville grået ut alle ni
> prosjektmoduler.

Det finnes **to modulfamilier** med hver sin formel. Null overlapp i slugs (målt av cowork
2026-08-31):

| | Firmamoduler | Prosjektmoduler |
|---|---|---|
| Slugs | `timer` (m/underbrytere `maskin`, `varelager`) | `oversettelse`, `godkjenning`, `hms-avvik`, `befaringsrapport`, `3d-visning`, `okonomi`, `dokumentsok`, `psi`, `kontrollplan` |
| Firmatak | `OrganizationModule` | **finnes ikke, og skal ikke innføres** |
| Effektiv tilstand | firmatak ∧ underbryter ∧ prosjektbryter ∧ ikke-unntatt | **prosjektbryter alene** |
| Styres fra | firma/moduler (tak, underbrytere, unntak) + prosjektoppsett (bryter) | prosjektoppsett alene |

Nivåtabellen (firmatak / underbryter / prosjektbryter / unntaksliste) gjelder dermed KUN
firmamodul-familien. Kompetanse og Fremdrift hører til firmamodul-familien når de en gang
aktiveres.

**Nivåene i firmamodul-familien:**

| Nivå | Betyr | Lagres i | Hvem styrer |
|---|---|---|---|
| **Firmatak** | Firmaet eier modulen (kjøp) | `OrganizationModule` | Firmaadmin på firma/moduler |
| **Underbryter** | Firmaet ønsker delfunksjonen | firma-nivå flagg (maskin/varelager) | Firmaadmin, samme kort |
| **Prosjektbryter** | Prosjektet bruker modulen | `ProjectModule` | Prosjektoppsett |

🔴 **Standalone-carveout (Kenneth-korreksjon 2026-08-31):** `ProjectModule.organizationId` er
nullbar (`schema.prisma:1495`); standalone-prosjekt er en **gyldig permanent tilstand**
(CLAUDE.md § Organisasjonsmodellen). «En `ProjectModule`-rad uten firmatak leses aldri alene»
gjelder derfor kun prosjekter **med** eier-firma. Uten firma finnes intet tak:
prosjektbryteren står alene for prosjektmodulene, og firmamodul-familien er utilgjengelig
(intet firma → intet kjøp → timer-familien vises ikke, verken aktiv eller grået).

- Tak AV → modulen finnes ikke i produktet for det firmaet: ikke i prosjektoppsett, ikke på
  mobil, ingen skrivende API-kall. En `ProjectModule`-rad uten firmatak er meningsløs og skal
  aldri leses alene (med standalone-carveout, se § 2).

  ⚠️ **RETTET 2026-08-31:** denne setningen sa opprinnelig at regelen «retter drift-punkt 3 —
  rotårsaken til at Kenneth kunne føre timer med Timer avslått». **Drift-punkt 3 var
  feilmålt av cowork.** Firmataket ble allerede lest — `erFirmamodulAktivert` kalles før
  `ProjectModule` i alle tre gatene, siden 2026-05-05. Cowork leste `moduleGate.ts` fra linje
  40 og overså sjekken på linje 36.

  **Resolveren er likevel riktig** (levert `1266ac2a`): den konsoliderer tre nær-identiske
  gate-filer og gir to-familie-formelen ett hjem. **Og det ekte hullet ble funnet i samme
  runde:** rad-skrivende timer-mutasjoner var ugatet (`krevTimerAktivert` i 3 av ~12 steder i
  `dagsseddel.ts`). Kenneths symptom er derfor sannsynligvis et **flate-problem** — steg 3 —
  ikke en server-mangel.
- Tak PÅ, prosjektbryter AV → modulen finnes for firmaet, men er ikke i bruk på det
  prosjektet. Flater viser varelager-mønsteret: eksplisitt «modulen er ikke aktivert for
  dette prosjektet» (utredningen § 3.5), aldri tom seksjon eller tomt nedtrekk.
- KOMMER SNART er en fjerde, ikke-aktiverbar tilstand og skal hete det i alle flater.

### 🔴 Designlås — gate-plassering (overlever fra coworks røde advarsel)

- Gating skjer i **UI-laget mot effektiv modultilstand** + på **skrivende API-prosedyrer**.
- **Katalog-/leseprosedyrer gates IKKE.** `equipment.list` forblir ugatet — en
  `krevMaskinAktivert` der feller hele timer-synken på mobil (`TimerSyncProvider:104-108`,
  utredningen § 3.6). Enhver ordre som rører gating skal sitere denne linjen.
- `krev*Aktivert` på skrivende prosedyrer leser **effektiv tilstand** (begge tabeller + evt.
  underbryter), ikke kun `ProjectModule` som i dag.

---

## 3. Hvilken flate eier svaret (svar på ask 3)

**Én kilde: API-et beregner effektiv modultilstand ett sted** (foreslått: én delt
resolver/prosedyre, f.eks. `modul.effektivTilstand(firmaId?, prosjektId?)`), og **alle flater
speiler den**. Ingen flate regner selv.

*(🔄 ENDRING C, revisjon 1: `firmaId` er **valgfri** — resolveren svarer for begge familier og
for standalone, med familie-formlene i § 2. Flatene skal ikke selv vite hvilken familie en
slug tilhører.)*

- **firma/moduler** eier firmataket og underbryterne (skriveflate).
- **Prosjektoppsett** (`/dashbord/oppsett/produksjon/moduler`) eier prosjektbryteren for
  **BEGGE familier**, med ulik visning *(🔄 ENDRING B, revisjon 1)*:
  - **Prosjektmodulene (de ni):** alltid tilgjengelige brytere — de har intet firmatak og
    skal 🔴 **ALDRI** grås ut med «styres av firmaet».
  - **Firmamodul-familien:** vises kun med aktivt firmatak; uten tak grået med «styres av
    firmaet» + lenke til firma/moduler. **Gråingen gjelder kun denne familien.**
  - **Standalone-prosjekt:** kun de ni prosjektmodulene vises. Ingen firmamodul-seksjon.
- **Alle andre flater er speil:** firma/innstillinger (tilgangsvalgene som i dag sier sitt
  eget), mobil, dagsseddel-web. De leser effektiv tilstand og har ingen egen mening. Retter
  drift-punkt 4 (tre flater, tre svar).
- **Toveis lenke** mellom firma/moduler og prosjektoppsett-moduler (Kenneth 31.08 — retter
  drift-punkt 5).

**Grensen firma- vs prosjektmodul når en modul finnes på begge nivåer:** firma avgjør
*eksistens*, prosjekt avgjør *bruk*. Aldri duplisert tilstand — prosjektnivået er en
innsnevring under taket, aldri en utvidelse forbi det.

---

## 4. Utførelsesrekkefølge (til ordre etter Kenneth-vedtak)

1. **Vedtak:** V1 ✅, V2 ✅ (unntaksliste, Kenneth via cowork-gate 2026-08-31), V3 ✅
   (3D-eksempelet ER prosjektbryteren: tegninger alltid på, 3D-visning per prosjekt) — med
   revisjon 1s to korreksjoner (to familier · standalone-carveout) innarbeidet.
   **Modellen er komplett; ordre kan skrives.** *(🔄 ENDRING D, revisjon 1)*

🔴 **Fire designlås-punkter som HVER ordre i dette sporet skal sitere:**
1. `equipment.list` gates aldri — `TimerSyncProvider:104-108` henter maskinkatalogen i samme
   `Promise.all` som timer-katalogen, og en vakt der feller hele timer-synken på mobil.
2. De ni prosjektmodulene grås **aldri** ut mot firmatak — de har ikke noe tak.
3. Standalone-prosjekter mister **aldri** prosjektmoduler.
4. Unntakslisten bor på **modulkortet**, aldri på ansattkortet.

⚠️ **Enkeltmålt premiss:** familie-inventaret (3 + 9 slugs, null overlapp) er målt **én gang**
av cowork 2026-08-31. Utfører verifiserer begge sett mot koden ved ordre-oppstart, **før**
tallene låses som fakta i `terminologi.md`.
2. **Delt resolver for effektiv tilstand** + `krev*Aktivert` leser den (skrivende prosedyrer).
   Klikk-budsjett og funksjonsinventar i ordren; utfører måler § 3-punktene på nytt først.
3. **Flatene speiler:** firma/innstillinger og web-dagsseddel (MASKIN-seksjonen bruker
   `equipment.length`-mønsteret fila alt har); prosjektoppsett grå-under-tak + lenker.
4. **Dok-sync:** terminologi.md § 0 (diagram-TILLEGG over), schema-kommentar varelager,
   domene-arbeidsflyt.md peker hit.

Punktene 2–4 er tre små ordrer, ikke én stor — men alle mot samme vedtatte modell, så vi
slutter å rette stykkevis.

**Enkeltmålt premiss (flagges per redundans-prinsippet):** at underbryter-modellen ikke har
skjulte kostnader i mobil-cache/synk er kun målt av cowork én gang (2026-08-30). Utfører
måler på nytt i steg 2.
