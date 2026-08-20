---
tittel: NÅ-rapport attestering — faktagrunnlag for fabels AM ORDRE 2-designrunde
status: faktakartlegging
type: rapport
opprettet: 2026-08-20
opprettet_av: dokgen
sist_verifisert_mot_kode: 2026-08-20
formaal: >
  Levere fabel faktagrunnlaget han mangler for å designe to attesterings-visninger
  (timer per prosjekt / timer per ansatt) + ukenorm-/overtidsregel med attestant-varsel.
  Ikke design — kun fil:linje-fakta.
---

# NÅ-rapport: attestering (AM ORDRE 2)

**Ingen design i dette dokumentet.** Fabel eier designet. Under: hva som finnes,
hvor det bor, hva som mangler — med fil:linje. Alle linjenumre verifisert mot kode
2026-08-20.

---

## 1. Dagens attesteringsflater — hva lederen faktisk ser samtidig

Fire flater (web × 2 lister + delt detalj; mobil × 1 liste + 1 detalj). Alle attesterer
på **dagsseddel-nivå** (én ansatt × én dag) eller **rad-nivå** — aldri "en ansatts hele
uke aggregert" i én operasjon.

### 1a. Web firma-liste (hovedflaten)
`apps/web/src/app/dashbord/firma/timer/attestering/page.tsx` — `FirmaAttesteringSide` (:106)

| Egenskap | Verdi | Fil:linje |
|----------|-------|-----------|
| Enhet i lista | Ett `SeddelKort` = én ansatt × én dag | `SeddelKort.tsx` montert :485 |
| Gruppering | **Per prosjekt** (`ProsjektGruppe`), header m/ sum arbeids-/maskintimer | :198-221, rendres :394-406, sum :448-482 |
| Tidsvindu | **Én uke**, uke-navigasjon | `getUkestart`/`getUkeslutt` :65-77, UI :308-338 |
| Ser samtidig | Alle firmaets ansatte i valgt uke, gruppert per prosjekt | query `hentTilAttesteringFirma` :135-154 |
| Filtre | Prosjekt · ansatt · avdeling | :341-378 |
| Faner | "Venter" (`status="sent"`) vs "Attestert" (`accepted`, read-only) | :120, :262-306 |

### 1b. Web prosjekt-liste
`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/page.tsx` — `AttesteringSide` (:35)
Flat tabell, én rad per dagsseddel (kolonner Dato·Ansatt·Aktivitet·Timer·#Rader·Handlinger, :107-112). Alle sedler for **ett** prosjekt (:46-49). Ingen uke-filter, ingen gruppering, ingen ansatt-filter. `/godkjenning` = redirect (`godkjenning/page.tsx:8`).

### 1c. Web detalj (delt)
`apps/web/src/components/timer/AttesteringDetalj.tsx` (:52) — per-rad checkbox (:43-50), én sedel, rader gruppert per prosjekt/ECO (`attestering-buckets.tsx`).

### 1d. Mobil liste (kun firma-kontekst — bekrefter M6)
`apps/mobile/app/timer/attestering/index.tsx` — `AttesteringListeSide` (:37). Firma via `useFirma().valgtFirmaId` (:40-41, kommentar :30-35 "speil av web"). Én `SedelKort` per dagsseddel (:88-95). **Flat, ugruppert** liste (query UTEN uke-filter :50-54) — **dårligere** enn web-firma (ingen prosjekt-gruppering, ingen uke-navigasjon, ingen filtre). Inngang `mer.tsx:199-205` (gated `kanAttestereFirma`).

### 1e. Mobil detalj
`apps/mobile/src/components/timer-attestering/AttesteringDetaljMobil.tsx` (:49) — per-rad `RadCheckbox` (:296-350), actionbar "Attester/Returner valgte" (:362-395). Ingen edit/ECO-flytting (web-only).

### Kan lederen se de to ønskede visningene i dag?
- **Per prosjekt, alle ansatte**: delvis — web-firma grupperer per prosjekt (:198-221, sum :212-220), men viser dag-kort ikke aggregert tidstabell, kun én uke + én status.
- **Per ansatt**: kun i **rapport**-flate, ikke attestering — `firma/timer/rapport/page.tsx`, `AnsattRad` (:13-30) m/ `totalTimer`, `perProsjekt` (:22-28).
- **Finnes IKKE**: attesterings-vy med én ansatts uke aggregert på tvers av prosjekter, eller prosjekt-vy som aggregerer timer per dag/uke på tvers av ansatte.

---

## 2. Kan spørringene aggregeres uten nye endepunkter?

Hent-prosedyrer i `apps/api/src/routes/timer/dagsseddel.ts`; aggregering i `rapport.ts`.

- **`hentTilAttestering`** (:2057-2097): input `{projectId}` (:2058), `krevProsjektLeder` (:2060), KUN `status="sent"` (:2065-2066). Return: flat dagsseddel-liste, `timer[]` **uten** `erstattet`-filtrering (:2070 → dobbelttelling-risiko) + `ansatt` + `totaltimer` + `antallRader`.
- **`hentTilAttesteringFirma`** (:2165-2326): input `{organizationId, fraOgMed?, tilOgMed?, status:"sent"|"accepted"}` (:2167-2177), `autoriserAdminForFirma` (:2180), firma-prosjekter via `projectOrganizations` (**partner-inkludert** :2182-2189). Return: rader filtrert `!= "erstattet"` (:2217, korrekt sum), hver rad m/ `.project{id,name,projectNumber,internalProjectNumber}` (:2297-2308) + `ansatt{…avdelingId}` + `prosjekt` + `dagsnorm` (:2318-2323).

**Datamodell** (`packages/db-timer/prisma/schema.prisma`): `DailySheet` (:150) har `userId`(:154)+`dato`(:163), **ikke** `projectId` (droppet T.1 :156-157). `SheetTimer` (:212) har `projectId`(:221)+`timer`(:237)+`lonnsartId`(:215), arver `userId`/`dato` fra sedel.

**Svar:** Begge aggregeringer (per prosjekt / per ansatt, per dag/uke) er mulige **uten nye endepunkter** — `dato×userId×projectId×timer` er komplett. Det som mangler er ikke data, men:
- Ingen liste-kall dekker mer enn ÉN status samtidig (aldri kladd, aldri sent+accepted).
- `hentTilAttestering` filtrerer ikke `erstattet` → naiv sum dobbelttelller redigerte rader.
- Uke-bøtte finnes ikke i retur — må avledes klientside fra `sedel.dato` (`@db.Date`).
- **Scope-avvik**: attestering bruker `projectOrganizations` (partner), mens aggregerings-prosedyren under bruker `primaryOrganizationId` (kun eide) — ulikt datagrunnlag.

**Aggregering finnes allerede** i `rapport.ts`: `firmaPeriodeRapport` (:41-217, input `{organizationId,fra,til,prosjektId?,ansattId?}`) gir serverside `perProsjekt` (:190-198) + `perDag` (:199-201) + `statusFordeling{kladd,sent,attestert}` per ansatt, scope `primaryOrganizationId` (:60). `hentFirmaProsjekterMedTimer` (:223-252, `groupBy projectId`), `hentFirmaAnsatteMedTimer` (:258-294, `groupBy userId`). Ingen ren ukesrapport — uke avledes fra `perDag`.

---

## 3. Ukenorm og sesong — to virkninger som må holdes fra hverandre

### 3a. Hvor sesong-dataene bor
`ArbeidstidsKalender` (`packages/db/prisma/schema.prisma:2458-2486`). Typer (:2463): `helligdag | fellesferie | klemdager | sommertid_start | sommertid_slutt | halvdag | firma_fri`.

Sesong-vindu bæres av **radenes egne felter** — `sommertid_start`/`sommertid_slutt`-rader har `standardStartTid`/`standardSluttTid`/`pauseMin` (:2473-2475). Kommentar :2467-2468 gir *eksempel*: sommer 07:00–15:30 pause 30, tilbake til vinter 07:00–14:30. **Datoene som skiller sesongene er `dato`-feltet på selve start/slutt-radene** — ingen faste kalenderdatoer i koden, alt er firma-konfigurerbart per år (`aar`-felt :2461, `@@unique([organizationId, dato])` :2482).

### 3b. Vintertid = fravær av aktiv sommertid — BEKREFTET
Det finnes **ingen `vintertid`-type** i enum (:2463), og grep på hele kodebasen gir null `vintertid`-treff i logikk. Mekanikken (`apps/api/src/services/timer/arbeidstid.ts:56-98`): finn siste aktive `sommertid_start ≤ dato` (:57-71) OG bekreft aktiv `sommertid_slutt ≥ dato` samme år (:76-85); **kun** hvis begge finnes overstyres tidsfeltene fra start-raden (:87-97). Ellers står firma-default (`OrganizationSetting`) urørt. Vinter er altså **default-tilstanden**, ikke en periode. `sommertid_slutt`-radens egne tidsfelter representerer "tilbake til vinter", men er bare virksomme som *slutt* på sommervinduet — utenfor vinduet gjelder OrganizationSetting.

### 3c. Ingen ukenorm-oppslag i shared — BEKREFTET
Det finnes **ingen** ukesnorm/uke-akkumulering noe sted. `beregnDagsnorm = (sluttTid − startTid − pauseMin)/60` (`arbeidstid.ts:104-113`) er rent **per dag**. Ukenormen 37,5/40 er **emergent, ikke lagret**:
- Vinter default `07:00–15:00`, pause 30 → dagsnorm 7,5 t → 7,5 × 5 = **37,5 t/uke**.
- Sommer (eks. `07:00–15:30`, pause 30) → dagsnorm 8,0 t → 8,0 × 5 = **40 t/uke**.

Tallene 37,5 og 40 forekommer **ikke** i arbeidstids-kode — de er produktet av dagsvinduet × arbeidsdager. `klassifiserArbeidstid` (`packages/shared/src/utils/lonnsregel.ts:41-55`) er dagsavgrenset (input `{arbeidstimer, dagsnorm}`) og har ingen inngang for uke-akkumulert timeantall. En ukesregel finnes ikke i kontrakten i dag.

### 3d. De to virkningene — hold dem fra hverandre
Kalenderen (via `hentEffektivArbeidstid`) overstyrer **samme rad** to konsumenter leser ulikt:

| Virkning | Konsumerer | Brukes til |
|----------|-----------|-----------|
| **Klokkeslett** | `startTid` / `sluttTid` / `pauseMin` | Forhåndsutfylling av dagskort (Fra/Til/pause) |
| **Norm** | `dagsnorm` (avledet av de tre over) | Terskel for overtidsklassifisering (→ implisitt ukenorm ved × arbeidsdager) |

Begge kommer fra samme `EffektivArbeidstid`-objekt (:24-29), men mater forskjellige flater. En sommertid-endring flytter *begge* samtidig — dagskort-prefill OG overtidsterskel — fordi de er koblet gjennom `beregnDagsnorm`. Rapporten skiller dem her fordi de har ulike konsumenter og ulike gap (§ 4).

---

## 4. Hvor t4-logikken (`hentEffektivArbeidstid`) kalles fra — og hvor den burde men ikke

**Kanonisk kilde (server):** `hentEffektivArbeidstid` (`apps/api/src/services/timer/arbeidstid.ts:37`), eksponert som tRPC `organisasjon.hentEffektivArbeidstid` (`apps/api/src/routes/organisasjon.ts:834-845`).
**Mobil-speil (bevisst duplisering for offline, dokumentert):** `hentEffektivArbeidstidLokal` (`apps/mobile/src/services/kalenderKatalog.ts:137`, kommentar :124 "Lokal speil av …arbeidstid.ts", cache via `firma.kalender.hentForMobil` :56).

### Kaller den i dag
| Flate | Kall-sted | Kilde |
|-------|-----------|-------|
| API (opprett-prefyll) | `dagsseddel.ts:980` | server |
| **Web /ny (opprett)** | `timer/ny/page.tsx:72` (tRPC) | server ✅ |
| Mobil detalj | `app/timer/[id].tsx:225` | lokal |
| Mobil GPS-dagskort | `StartSluttDagKort.tsx:195, 523, 738` | lokal |
| Mobil maskin/timer-seksjon | `MaskinSeksjon.tsx:490, 509` · `TimerSeksjon.tsx:982, 1000` | lokal |
| Mobil opprett/matpause | `dagsseddelOpprett.ts:92` · `matpause.ts:57` | lokal |

**Presisering til premisset:** web **/ny** (opprett-siden) kaller t4 (`page.tsx:72`, prefyller Fra/Til/pause fra kalender-effektiv verdi :77-89). Det er ikke "hele web" som mangler t4.

### Burde lese den, men gjør ikke (gap-liste fabel ba om)
1. **Forhåndsutfylling av dagskort — web DETALJ**: `timer/[id]/page.tsx` kaller **ikke** t4. Kommentar :316 nevner `hentEffektivArbeidstidLokal` men siden bruker `sheet.startAt/endAt` (server-baket) eller flat `OrganizationSetting.dagsnorm` (:390-393). Dette er M8-gapet — mobil-detalj re-beregner, web-detalj ikke. (Web /ny er OK; web /[id] er hullet.)
2. **Carve/klassifisering av overtid**: kjører KUN i mobil-GPS (§ 5). Web/server konsulterer aldri `dagsnorm` fra t4 for overtidssplitt.
3. **Attestantvarsel**: finnes ikke (ingen ukenorm-/40-t-varsel eksisterer). Ville trengt t4-avledet ukenorm — som ikke finnes som oppslag (§ 3c).
4. **Ukenorm-beregning**: ingen flate leser t4 for uke-sum — t4 gir kun per-dag `dagsnorm`, aldri ukesbøtte.

---

## 5. Overtidsklassifisering — M4 verifisert (STEMMER)

De tre delte funksjonene i `packages/shared/src/utils/` (ikke duplisert): `klassifiserArbeidstid` (`lonnsregel.ts:41`), `velgOvertidLonnsart` (`lonnsregel.ts:73`), `carveArbeidstider` (`carveArbeidstid.ts:47`).

Uttømmende grep (packages+apps): **eneste kall-sted er mobil GPS-auto-gen** — `StartSluttDagKort.tsx`: `carveArbeidstider` :790, `klassifiserArbeidstid` :797, `velgOvertidLonnsart` :805, gated `if (arbeidstimer>0)` :764.
- **apps/api: null kall** på de tre. Server setter web-rader inn as-is (`tilfoyTimerRad` handler `dagsseddel.ts:1099`, insert :1204 — ingen klassifisering, ingen backstop).
- **apps/web: null kall.** Web fører timer med **manuelt** valgt lønnsart (`TimerRadDialog` `dashbord/timer/[id]/page.tsx:1558`, `<select>` :1944, default `erStandardvalg` :1629-1637).

**Konklusjon:** M4 stemmer — web-førte rader får aldri overtidslønnsart automatisk. **Konsekvens for fabels føring:** klassifiseringen må flyttes til en delt kilde som kalles uansett føringsvei (naturlig sted: server ved lagring/attestering, siden både web og mobil-sync passerer den), FØR attestantvarsel bygges. Varsling på ulikt beregnede tall (mobil klassifiserer, web ikke) ville vært verre enn ingen varsling.

---

## 6. Fallback-konstanten (07:00–15:00/30) — kan den leses fra ett sted?

Verdien er **riktig** (= systemets default, gir 7,5 t). Fire forekomster:

| Sted | Fil:linje | Rolle |
|------|-----------|-------|
| Server | `apps/api/src/services/timer/arbeidstid.ts:33-35` | `DEFAULT_*`-konstanter, sikkerhetsnett når `OrganizationSetting` mangler |
| Mobil | `apps/mobile/src/services/kalenderKatalog.ts:31-33` | sikkerhetsnett når offline-cache er tom |
| Web /ny | `apps/web/src/app/dashbord/timer/ny/page.tsx:85-86` | fallback når ingen firma-kontekst (`!orgId`) |
| Schema-default | `packages/db/prisma/schema.prisma:361-363` | `standardStartTid @default("07:00")` m.fl. — DB-nivå |

**Faktisk mulighet:** De tre TS-forekomstene (server/mobil/web) **kan** samles til én eksportert konstant i `packages/shared` og importeres alle tre steder (shared bundles inn i alle apps). Mobil trenger fortsatt sin egen import, men fra samme kilde. **Schema-defaulten kan IKKE**: Prisma `@default(...)` krever literal — den kan ikke importere en TS-konstant og forblir en separat literal av nødvendighet. Så maksimalt: fire → to kilder (én shared TS-const + én Prisma-literal). (Konstatering — ingen endring foreslått; verdien skal bli stående, ikke endres til 15:30.)

---

## 7. Klikktelling — dagens attesteringsflate (før-tall)

Antakelse: leder innlogget, firma-kontekst valgt.

**Korteste vei (web firma-flate, hel sedel = alle rader i ett):**

| Steg | Handling | Fil:linje |
|------|----------|-----------|
| 1 | "Timer" i firma-sidemeny → `/dashbord/firma/timer` | `components/layout/firma-nav.tsx:50` |
| 2 | Underfane "Attestering" | `dashbord/firma/timer/layout.tsx:31` |
| 3 | ✓ på `SeddelKort` → `attester.mutate({id})` | `SeddelKort.tsx:317-335` → `page.tsx:398-401` |

**= 3 klikk** (hel sedel via `timer.dagsseddel.attester`).
- **Én RAD alene**: + ⋯-meny + "Rediger"→detalj (`SeddelKort.tsx:364-374`) + checkbox + "Attester valgte" → **5+ klikk**.
- **Batch pr. prosjekt**: "Attester gruppe (N)" i header attesterer alle i klikk 3 (`page.tsx:467-480`).
- **Dyp-lenke** (`dype-sider.tsx:46-52`) kan kutte steg 1-2 til ett hopp.
- **Prosjekt-flate**: ✓ i tabellrad (`[prosjektId]/timer/attestering/page.tsx:160-170`) + krever at prosjekt først velges (+1).

---

## Oppsummering (faktatabell)

| Spørsmål | Svar | Nøkkel-fil:linje |
|----------|------|------------------|
| Ser lederen "per prosjekt, alle ansatte"? | Delvis (gruppert dag-kort, én uke/status) | `firma/timer/attestering/page.tsx:198-221` |
| Ser lederen "per ansatt"? | Kun i rapport, ikke attestering | `firma/timer/rapport/page.tsx:13-30` |
| Aggregerbart uten nye endepunkter? | Ja — data komplett; `firmaPeriodeRapport` aggregerer allerede | `rapport.ts:41-217` |
| Hvor bor sesong-data? | `ArbeidstidsKalender`-rader, datoer i `dato`-feltet | `schema.prisma:2458-2486` |
| Vintertid = egen type? | Nei — fravær av aktiv sommertid | `arbeidstid.ts:56-98` |
| Ukenorm 37,5/40 lagret? | Nei — emergent av dagsvindu × arbeidsdager | `arbeidstid.ts:104-113` |
| Hvor kalles t4? | API :980, web /ny :72, mobil ×9 lokalt | `arbeidstid.ts:37` |
| Hvor mangler t4? | Web-detalj, overtidscarve, attestantvarsel, ukenorm | `timer/[id]/page.tsx:390-393` |
| M4 (kun mobil klassifiserer)? | Stemmer — web/server ingen backstop | `StartSluttDagKort.tsx:790-805` vs `dagsseddel.ts:1099` |
| Fallback-konstant single-source? | 3 TS → 1 shared mulig; Prisma-default må forbli literal | `arbeidstid.ts:33-35` m.fl. |
| Klikk leder → attestert (før) | 3 (hel sedel) / 5+ (én rad) | `SeddelKort.tsx:317-335` |
