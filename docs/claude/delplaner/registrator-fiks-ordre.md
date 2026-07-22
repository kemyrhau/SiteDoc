---
name: registrator-fiks-ordre
status: 🟢 KLAR FOR RELAY — specen er rettet, koden står igjen. Sekvenseres etter A-3b Del 1b
eier: Kenneth (domenesannhet) · cowork (måling + ordre) · fabel (A-3b-konsekvens) · kode-Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-21
---

# Ordre — registrator skal ikke ha administratorrettigheter

> Grunnlag: [registrator-rolleforveksling.md](registrator-rolleforveksling.md) (måling) + [dokumentflyt.md § Rollematrisen](../dokumentflyt.md) (Kenneths spec, rettet 2026-07-21).

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus, **ledd 3 (koding)**. Kenneth ga domenemodellen, cowork målte og rettet specen, fabel gater. **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Branch:** `fix/registrator-rettigheter` fra develop.

**Dette er sikkerhetsnær kode.** `erTillattForRolle` er serverens rollevalidering. En feil her åpner eller stenger tilgang for ekte brukere.

**Leveranse i to faser — STOPP mellom:**
1. **Fase A — admin får egen kanal.** Ingen rettighet fjernes ennå. Etter fase A oppfører systemet seg **identisk**, men admin går ikke lenger via «registrator». Stopp og lever.
2. **Fase B — registrators admin-makt fjernes.** Først når fase A er verifisert.

**Ditt neste svar:** fase A + bevis på at ingenting endret oppførsel.

## 1. Defektet

Implikasjonen skal gå **én vei**. I dag går den begge:

| Implikasjon | Vurdering |
|---|---|
| admin → har registrator-rolle | ✅ **Riktig. Ikke rør denne.** Kenneth: *«dette er ok, dette er ikke feil»* |
| registrator → får admin-rettigheter | ❌ **Feil.** Det er denne som skal bort |

**Kenneths modell** ([dokumentflyt.md § Rollematrisen](../dokumentflyt.md)):

> **Du redigerer bare din egen del. Alle leser alt.** Administrator er unntaket — han skriver i alle delene.

Registrator: **oppretter** sin egen del, **leser** alt annet. Ikke mer.

## 2. Den tekniske knuten — derfor to faser

`utledMinRolle` (`flytRolle.ts:62`) mapper **admin → "registrator"**. Begge statushandling-funksjonene tar **kun** `rolle`:

```
hentRolleFiltrertHandlinger(status, rolle)          ← ingen erAdmin
erTillattForRolle(rolle, gjeldendStatus, nyStatus)  ← ingen erAdmin
```

«registrator» er derfor **admins eneste kanal** inn i dem. Strykes registrator-grenen uten videre, **mister admin sine rettigheter**.

**Derfor: gi admin kanalen først (fase A), fjern registrators makt etterpå (fase B).** Aldri motsatt, aldri samtidig.

## 3. Fase A — admin får egen kanal (null atferdsendring)

1. `hentRolleFiltrertHandlinger` og `erTillattForRolle` tar **`erAdmin: boolean`** som eksplisitt parameter.
2. Grenene blir `if (erAdmin || rolle === "registrator")` — **begge** foreløpig. Ingen mister noe.
3. Alle kallsteder oppdateres til å sende `erAdmin`. **Inventér dem først og oppgi antallet** — både server og klient.

**Verifikasjon fase A:** oppførselen skal være **bit-identisk**. Kjør eksisterende tester + `tilgangsmatrise.test.ts`. Endres én rad, har du gjort noe mer enn du skulle.

## 4. Fase B — registrators admin-makt fjernes

0. **🔴 KRITISK (cowork-funn 2026-07-21) — registrator MÅ kunne sende sitt eget dokument.** `ROLLE_HANDLINGER` har i dag **ingen** `registrator`-nøkkel. Fjernes admin-disjunktet uten å legge til en, kan en ren registrator **ikke** gjøre `draft → sent` — brudd på Kenneths modell «oppretter → sender». **Legg til i `ROLLE_HANDLINGER`:**
   ```
   registrator: { draft: new Set(["sent", "deleted"]) }
   ```
   Registrator kan da **sende og slette sin egen kladd** (matrisens «oppretter» + Kenneths «sletting kun i kladd av bruker»), men **ingen andre overganger** — kan ikke godkjenne, besvare eller avvise. Nøyaktig «oppretter + sender, resten leser».

1. `flytRolle.ts:179` → `if (erAdmin) return "admin";` *(registrator-disjunktet strykes)*
2. `statusHandlinger.ts:85` → `if (erAdmin) return alle;`
3. `statusHandlinger.ts:105` → `if (erAdmin) return true;`
4. **INGEN spesial-gren i `utledDokumentRettighet`.** ⚠️ **RETTET 2026-07-21 (cowork + Kenneth) — den opprinnelige teksten sa «registrator → `leser`, uavhengig av ballinnehav», og den MOTSA § 5b + Kenneths matrise.**

   **Kenneth 2026-07-21:** *«holder vi oss langs matrisen — eneste [er at] registrator må få rediger i tillegg til opprett sjekkliste/oppgave».* Registrator skal altså **redigere sin egen sjekkliste/oppgave, ikke bare lese.**

   Etter at admin-disjunktet er fjernet fra steg 1, **faller registrator gjennom den eksisterende steg 2–7-logikken**, som gir nøyaktig dette av seg selv:
   - med ball + sjekkliste → steg 6-7 → **`redigerer`** (Kenneths tilføyelse)
   - med ball + oppgave → **`redigerer`** (append håndheves av `erFeltLåst`)
   - egen kladd med ball → steg 3 → **`redigerer`**
   - uten ball → steg 4 → `leser` (matrisens «les» for andres del)
   - approved/closed/cancelled → steg 2 → `leser`

   **En egen leserett-gren over-restringerer** (registrator-med-ball ville feilaktig få `leser`) og skal **ikke** legges til. «Minst leserett»-gulvet er allerede garantert — `utledDokumentRettighet` returnerer aldri `null`.
5. `ROLLE_PRIORITET.registrator` flyttes **ned**, under `godkjenner`. En oppretter skal ikke slå en godkjenner ved flertreff. **Foreslå eksakt verdi og begrunn — fabel gater tallet.**

   ⚠️ **KOBLET FUNN (registrator-Opus 2026-07-21, cowork-verifisert) — ordren manglet dette:** `flytRolle.ts:92` har en short-circuit `if (rolle === "registrator") return "registrator"` som returnerer på første treff og **ignorerer prioritet helt.** Uten å fjerne den er punkt 5 **effektløs.** Fjern short-circuiten i steg 2. Loop-logikken (`prioritet <= bestePrioritet → continue`, streng `>`) gir da rekkefølge-uavhengig, korrekt resultat. Verdien må være **≥ 1** (`bestePrioritet` starter på 0 → `registrator: 0` ville aldri registrert). Kommentarene :51-54 og :91 må omskrives — de påstår «registrator er høyest».

   ✅ **FABEL-GATET TALL 2026-07-21:** `registrator: 1, bestiller: 2, utforer: 3, godkjenner: 4`.
   **Begrunnelse (fabel, ført):** ved flertreff skal brukeren se dokumentet fra sin **mest ansvarstunge posisjon** i flyten. Godkjenner er siste kontrollpunkt og vinner over utfører, som vinner over bestiller (som alt har levert sin handling ved send). Matcher perspektivmatrisens logikk: etiketten svarer på «hva venter på MEG», og ansvaret ligger tyngst hos den som ennå skal handle sent i flyten.
   **Verifiseringsvilkår (fabel):** flertreff-testene må dekke **begge** retninger av tabellen — `registrator+utfører → utfører` OG `bestiller+godkjenner → godkjenner` — ikke bare det ene eksempelet i forslaget.
6. `utledMinRolle:62` (admin → registrator) **beholdes uendret.**

## 5. Testkrav — begge retninger, ellers bytter vi én feil mot en annen

`tilgangsmatrise.test.ts` utvides med rader for **ikke-admin registrator**:

| Skal bevises | Rad |
|---|---|
| **Registrator REDIGERER egen del** (Kenneth-tilføyelse) | Registrator **med ball** + sjekkliste (ikke godkjent) → **`redigerer`** |
| Registrator redigerer egen oppgave | Registrator **med ball** + oppgave → **`redigerer`** (append via erFeltLåst) |
| Leseretten er gulvet | Registrator **uten** ball → `leser` (ikke `null`, ikke `redigerer`) |
| Leseretten overlever terminal status | Registrator, `approved`/`closed` → `leser` |
| Admin-makten er borte | Registrator har **ikke** `admin`-rettighet lenger (kun edit-when-ball, ikke overstyring) |
| Server-gaten stengt for statusovergang | `erTillattForRolle(registrator, …)` → `false` der `ROLLE_HANDLINGER` ikke gir rollen overgangen |
| Admin er uendret | Admin på hver rad → identisk med før fiksen |

**Uten den siste raden er ikke fiksen verifisert** — den er hele poenget med tofase-oppdelingen.

## 5b. Registrators redigeringsrett når ballen kommer TILBAKE (Kenneth 2026-07-21)

> Kontrollspørsmål fra Kenneth: *«Hvis en oppgave kommer tilbake til registrator — kan de redigere?»* Svaret er ulikt for oppgave og sjekkliste, og fiksen må bevare begge.

**Regelen (Kenneth):**
- **Oppgave:** en utfylt oppgave skal **ikke redigeres etter sending** — kun **tilføye** ny info/kommentar. (Append-only.)
- **Sjekkliste:** skal **alltid kunne redigeres der den er, helt til den er godkjent** — da låst, og må **låses opp** for videre redigering.

**Kode-status (cowork-målt 2026-07-21) — begge regler intakte, men merk:**
- Sjekkliste-låsen: `utledDokumentRettighet` steg 2 (`flytRolle.ts:182`) — `approved` → `leser` for alle. Opplåsing = statusovergang tilbake fra `approved`. ✅
- Oppgave append-only: håndheves **kun klient-side** (`erFeltLåst()` i oppgave-hooken; `flytRolle.ts:173`: *«server oppdaterData håndhever ikke append-only i dag»*). Regelen er strengere enn serveren garanterer. **Ikke registrator-fiksens ansvar — men ikke bygg noe som stoler på server-håndhevet append-only.**

**Hvorfor dette treffer fiksen:** i dag gir steg 1 registrator `"admin"`, som **hopper over** append-only- og ball-sjekkene. En registrator kan derfor i UI redigere en sendt oppgave — **brudd på Kenneths regel.** Etter fiksen faller registrator til steg 3–7, der `dokumentType` styrer henne inn i append-only for oppgave og full redigering for sjekkliste, **når hun har ballen.** Fiksen bringer altså registrator *i tråd* med regelen.

**Testkrav (legges til § 5-matrisen):**

| Skal bevises | Rad |
|---|---|
| Registrator med ballen på **sjekkliste** (ikke godkjent) → `redigerer` | full felt-redigering, som før |
| Registrator med ballen på **oppgave** → `redigerer` = **append-only** (ikke overskriv) | `dokumentType="oppgave"`-grenen |
| Registrator på **godkjent sjekkliste** (`approved`) → `leser` | låst til opplåsing |
| Registrator **uten** ballen → `leser` (begge typer) | eier del, men ikke tur |

**Avvik-plikt:** faller noen av disse ut som `null` (ingen tilgang) i stedet for `leser`/`redigerer`, har fiksen tatt for mye. Registrator beholder **alltid** minst leserett i egen flyt (§ 5b i [dokumentflyt.md § Rollematrisen](../dokumentflyt.md)).

## 6. Ufravikelig

- **Ikke rør `utledMinRolle:62`** (admin → registrator). Kenneth har uttrykkelig godkjent den.
- **Ikke «rydd» rollemodellen** utover punktene over. Ser du noe annet som virker galt: **flagg, ikke fiks**.
- Ingen datamodell-endring. Ingen migrering.
- Ingen i18n-endring forventet. Endres det, flagg.
- Rør ikke `packages/ui/src/status-badge.tsx` eller `perspektivEtikett.ts` — A-3b eier dem.

## 7. Kjent konsekvens for A-3b (fabel avgjør timing)

A-3bs perspektivmatrise har en **REGISTRATOR-kolonne** bygget på at registrator er superbruker (`utledPerspektiv` — registrator dominerer ballinnehav). Etter denne fiksen er registrator en *deltaker med leserett*, ikke en superbruker.

**Perspektivet er fortsatt meningsfullt** — den som opprettet og venter på svar har et eget syn på dokumentet — men etikettene kan trenge revisjon. **Fabel eier avveiningen:** lukk A-3b først på dagens modell og revider etterpå, eller stans A-3b nå.

**Cowork-anbefaling:** la A-3b fullføre Del 1b (kvitteringen — helt uavhengig av rollemodellen), og ta avgjørelsen før Del 1c.

## 8. DoD

Fase A → cowork-gate (bit-identisk oppførsel bevist) → Fase B → matrisen grønn begge retninger → `pnpm --filter @sitedoc/shared test` + `next build` grønn → push → cowork-review → fabel-gate → dok-sync (`registrator-rolleforveksling.md` merkes løst) → «klar for commit».
