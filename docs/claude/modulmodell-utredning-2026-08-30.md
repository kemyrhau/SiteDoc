---
name: modulmodell-utredning
description: 🟡 UTREDNING — hva en modul ER (firmakjøp vs ansatt-tilgang), og hva koden faktisk gjør når en modul mangler. Grunnlag for fabel-beslutning. Målingen er ferskvare — mål på nytt før beslutning.
sist_verifisert_mot_kode: 2026-08-30
---

# Modulmodellen — utredning til fabel

**Status:** 🟡 UTREDNING — ikke besluttet, ikke bygget.
**Skrevet:** 2026-08-30 av cowork, på Kenneths regi.
**Blokkerer:** REG fase 2 (`feat/reg-fase2`) — feltet `modulNokler` er tatt ut av den runden
i påvente av denne avklaringen.

> 🔴 **MÅLINGEN ER FERSKVARE OG SKAL IKKE STOLES PÅ SENERE.**
> Alt under § 3 er målt 2026-08-30 og beskriver koden **den dagen**. Vi koder videre i
> timer-, maskin- og registreringsflatene. **Mål på nytt før beslutningen tas** — bruk
> § 3 som liste over *hvor* man måler, ikke som fasit på *hva* som står der.

---

## 1. Spørsmålet

Kenneth, 2026-08-29, ordrett:

> *«Hva er en modul? → det er en tilgang firmaet kjøper → det er ikke en ansatt som
> bestemmer om han skal ha tilgang på modulen eller ikke. Modulen gis til alle ansatte →
> ikke bare til en eller 5 ansatte. Moduler → firma kjøper → firma tildeler ansattilgang.
> Kortet kan derfor bare speile hvilke tilganger firmaet eier.»*

Og problemet han stilte, som er det avgjørende:

> *«Firmaet har 50 ansatte og alle ferdig registrert → firmaet kjøper 2 nye moduler → må
> 50 ansattkort redigeres for at disse får tilgang?»*

Svaret på det siste kan ikke være ja. Det er hele grunnen til at `modulNokler` tas ut av
fase 2 i stedet for å bygges ferdig.

**Kenneths andre premiss, samme dag:**

> *«Maskin og varelager tilhører modulen timer. For de fleste firmaer trenges alle tre
> modulene. Stat og kommune trenger ikke timer, maskiner og varelager.»*

Det peker mot at timer-familien er **ett kjøp**, ikke tre — men det er ikke besluttet.

---

## 2. Hva som skal avgjøres

Tre spørsmål, i rekkefølge. Nr. 1 avgjør de to andre.

**Q1 — Er timer-familien ett kjøp eller tre?**
Kenneth sier de fleste firmaer trenger alle tre, og at stat/kommune ikke trenger noen av
dem. Det er en beskrivelse av **salg**, ikke av kode. Koden i dag har tre uavhengige
modulflagg per firma (målt: A.Markussen AS har `maskin`, `timer` og `varelager` alle
aktive i prod). Slår vi dem sammen til ett kjøp, forsvinner spørsmålet om hva som skjer
når maskin mangler mens timer finnes — men vi mister muligheten til å selge timer alene.

**Q2 — Finnes det et reelt behov for å begrense en modul per ansatt?**
Kenneths formulering sier nei: firmaet kjøper, alle ansatte får. Er det svaret, skal
`modulNokler` ikke finnes på `OrganizationMember` i det hele tatt, og 50-ansatte-problemet
oppstår aldri. Men det er verdt å teste mot to tilfeller før det låses:
- En innleid som skal føre timer, men ikke se firmaets utstyrsregister.
- Et firma som kjøper maskin for anleggsavdelingen og ikke vil at kontoret skal se den.

Hvis begge er hypotetiske, er svaret nei og saken er enkel.

**Q3 — Hva blir da igjen på ansattkortet?**
Går `modulNokler` ut, står registreringen igjen med stilling, avdeling, firmaroller,
status og prosjekttilgang. Det er fortsatt en meningsfull flate — men fabel bør si om
kortet skal **vise** firmaets moduler som lesefelt («dette firmaet har timer og maskin»),
eller om moduler ikke hører hjemme på kortet overhodet.

---

## 3. Hva koden gjør i dag (målt 2026-08-30 — mål på nytt)

Kenneth spurte: *«Hva skjer dersom maskin mangler som modul? Kollapser timefunksjonen?»*

**Nei. Men koden skiller nesten aldri «ikke kjøpt» fra «ingen data».**

### 3.1 Datalaget tåler det

`SheetTimer.vehicleId` er nullbar. `SheetMachine.vehicleId` er `NOT NULL`, men selve raden
er valgfri — en dagsseddel uten maskinrader er gyldig. Alle koblinger på tvers av
db-pakker er svake `String`-felt uten `REFERENCES` (A.20-mønsteret). En dagsseddel lagres
fint uten et eneste maskinfelt.

Rapport og PDF tåler tomt: `rapport.ts` gater på `if (vehicleIder.length > 0)`, og
`packages/pdf/timer-rapport.ts` dropper maskintimer-kolonnen når den ikke finnes.

**Motsatt vei:** maskin vet ingenting om dagsseddel. `Vareforbruk.dagsseddelId` er nullbar
og sendes ikke av noen klient.

### 3.2 API-et gater timer, men ikke maskin-i-dagsseddel

`krevTimerAktivert` står på dagsseddel-routerens innganger. **Maskin-subrouteren inne i
dagsseddelen har ingen `krevMaskinAktivert`.** `krevMaskinAktivert` finnes og brukes — men
bare i `maskin/import.ts` og tre steder i `maskin/equipment.ts` (skrivende prosedyrer).

Det som faktisk stopper en skriving er en **datasjekk**, ikke en modulsjekk:
`verifiserKjoretoyTilhørerFirma()` svarer *«Maskin/utstyr finnes ikke i firmaets
register»*. Sant, men det er ikke svaret på hvorfor.

🔴 **`equipment.list` er ikke modul-gatet.** Det er ikke en forglemmelse man bør «rette» i
forbifarten — se § 3.5.

### 3.3 Web viser en seksjon som ikke kan fylles

`apps/web/src/app/dashbord/timer/[id]/page.tsx`: MASKIN-seksjonen rendres på `{!rad && …}`
— altså for **hver ny rad**, uten modulsjekk og uten sjekk på om utstyrslista er tom.
Brukeren får en kollapsbar seksjon, åpner den, og finner et nedtrekk med bare «—».

**Samme fil gjør det riktig et annet sted:** utstyrsvalget over rendres på
`{erInternt && equipment && equipment.length > 0 && …}`. Mønsteret finnes i fila; det er
bare ikke brukt på maskin-seksjonen.

### 3.4 Mobilen gjør det best

`TimerSeksjon.tsx` skjuler seksjonen når maskin-cachen er tom, og viser en forklarende rad
i stedet for et tomt nedtrekk. Det er dokumentert som bevisst soft-skjul i
`maskinKatalog.ts`.

**Drift funnet:** `packages/db-timer/prisma/schema.prisma` (kommentaren over `SheetMachine`)
sier *«Soft-skjul i UI: seksjon vises kun når Maskin-modul er aktivert for firmaet»*.
Web gjør ikke det. Kommentaren beskriver en regel bare mobilen følger.

### 3.5 Varelager er det eneste stedet som svarer ærlig

Varelager er **ikke** en del av dagsseddelen — null referanser. Men
`krevVarelagerForProsjekt` (`apps/api/src/routes/vareforbruk.ts`) er **det eneste stedet i
kodebasen som eksplisitt skiller «ikke kjøpt» fra «ingen data»**: *«Varelager-modulen er
ikke aktivert for dette prosjektet»*. Varelager-flaten er også den grundigst gatede —
`krevVarelagerAktivert` står på `vare.ts`, `vareKategori.ts` og `vareImport.ts` i tillegg.

Det er mønsteret de andre to modulene mangler.

### 3.6 🔴 Latent felle — ikke gate `equipment.list` uten å måle mobilen

Mobilens `TimerSyncProvider` henter maskinkatalogen i **samme `Promise.all` som
timer-katalogen**. Det går bra i dag kun fordi `equipment.list` ikke er modul-gatet.
Legger noen på `krevMaskinAktivert` der, feiler hele timer-synken på mobil for et firma
som har timer men ikke maskin.

**Dette er den eneste målte veien der «maskin mangler» faktisk kan velte timer.** Den er
ikke åpen i dag, men den er én linje unna.

---

## 4. Coworks lesning

Målingen sier at **teknisk er de tre modulene uavhengige** — timer virker uten maskin og
varelager, og de virker uten timer. Kenneths premiss om at maskin og varelager «tilhører
timer» er derfor et **salgs- og domenepremiss**, ikke en beskrivelse av koden.

Det som mangler er ikke funksjon, det er **forklaring**. Et firma med timer og uten maskin
får i dag en tom seksjon på web uten å få vite hvorfor.

Anbefalt rekkefølge, hvis fabel er enig:

1. **Avgjør Q1 og Q2 først.** De er domenespørsmål og koster ingen kode.
2. **Deretter én liten runde på web-symptomet** — skjul MASKIN-seksjonen når utstyrslista
   er tom, med samme mønster som fila allerede bruker. Det er riktig uansett hva Q1 og Q2
   svarer.
3. **Så eventuelt varelager-mønsteret** — en eksplisitt «modulen er ikke aktivert»-melding
   der det er relevant. Men ikke som en generell utrulling: § 3.6 viser at modul-gater lagt
   på feil sted brekker mobil-synk.

**Ikke gjør:** en generell «legg `krevMaskinAktivert` overalt»-runde. Den ville lukket et
ikke-problem og åpnet et reelt.

---

## 5. Hva som er tatt ut i mellomtiden

`modulNokler` (`String[]` på `OrganizationMember`) er fjernet fra ordren for REG fase 2.
Migreringen var kun kjørt lokalt og var ikke committet, så det kostet ingenting å ta den
ut. `prosjektTilgang` består — den er per-person av natur og berøres ikke av dette
spørsmålet.

Backlog-post: [BACKLOG.md § 2 → Modulmodellen](BACKLOG.md).
