---
name: k3-ordre
status: 🟢 KLAR FOR RELAY — ledd 2, tre klosser. Kloss 1+2 gates før kloss 3
eier: fabel (design + gate) · cowork (måling + testplan + merge) · redesign-Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-22
---



## 0. For deg som koder (les først)

**Hvem du er:** redesign-Opus, **ledd 3**. Kenneth ga prøvesteinen, fabel designet trakten, cowork målte inventaret. **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Arbeidstre/branch:** `feat/k3-kontekstvelger` fra develop.

**Fildisjunkt:** rør `KontekstChip.tsx` (trakten), `Toppbar.tsx` (fjern ByggeplassVelger), `SonetonetSidehode`-monteringer på 36 sider. **Ikke rør** flyt-/registrator-filer (`flytRolle.ts`, `statusHandlinger.ts`, `DokumentHandlingsmeny`) eller A-3bs `status-badge.tsx`/`perspektivEtikett.ts`.

**Tre klosser med STOPP mellom** (§ Kloss-deling nederst). **Ditt neste svar etter hver kloss: rapport + build-status, så vent på gate.** Kloss 1+2 gates av fabel før kloss 3 ruller.

**Mockupen** `P1 Nivåsignal Beslutningskart.dc.html` § 3a er fasit for trakten — du trenger den. Si fra til Kenneth om du ikke har den.

## Prøvestein (akseptkriterium, Kenneths scenario)
Kundetelefon: «jeg er i det prosjektet» → slå opp firma → prosjekt → byggeplass, i den rekkefølgen, uten å måtte vite hvor du står. Alle tre nivåer skal være synlige i trakten samtidig (valgte som sammenfoldede rader, aktivt som åpen liste) — ingen nivåer skjult.

## Leveranse (ÉN samlet runde — Kenneth-dømt: halvtilstand er feilen, ikke løsningen)
A. **Trakten** (erstatter dagens popover-innhold i KontekstChip): firma → prosjekt → byggeplass per § 3a. Låste prinsipper: ett nivå åpent om gangen; valgt nivå = sammenfoldet rad m/ «Endre»; Alle/Mine = filter-pille; firma-steg kun ved flere firmaer; firmabytte nullstiller nedover; «Hele prosjektet» default, bygg-steg kun når byggeplasser finnes; lister >6 = søk + rulleliste m/ «Sist brukt» øverst; gruppeetikett navngir prosjektet («Alle på 998 …»). Lukk ved prosjektvalg; byggeplass = valgfritt ettervalg.
B. **Tonet sidehode på ALLE sider**: SonetonetSidehode (eksisterende delt komponent, generisk sone-prop) monteres på cowork-målt inventar — 13 firma-sider + ~23 prosjekt-sider. Amber=firma / blå=prosjekt overalt. INGEN duplisering: kun montering av den delte komponenten; trengs varianter, endres komponenten, ikke kopier.
C. **ByggeplassVelger ut av toppbaren**: fjernes helt i ny nav (K1 skjulte den i firmakontekst; nå bor byggeplass i trakten). Gammel nav røres ikke.

## Krav
- Flagg-status: trakt + velgerfjerning bak `nyNavigasjon` (bor i nav-skallet); sidehode-utrullingen flagg-nøytral (vedtak 7-prinsippet: funksjon på felles sider).
- i18n: nye nøkler er ventet (nivåetiketter, søkeplaceholder, «Sist brukt», «Alle på …») — flagg nøklene FØR generator-kjøring; cowork koordinerer (A-3b pauset, men sperre-disiplinen står).
- Enkeltmålte premisser: side-inventaret (13+23) er cowork-målt — verifiser ved montering.
- 🔴 **RETTET KILDE for «Sist brukt» (Kenneth 2026-07-22):** IKKE sticky «sist besøkte» (én verdi). Kenneth: *«hver arbeider har 4-5 prosjekter de veksler mellom»*. **Cowork-måling: `Activity`-tabellen (`schema.prisma:1913`) har `actorUserId` + `projectId` + `createdAt` + indeks `[projectId, createdAt]` — dette er en spørring på eksisterende data, ikke ny logging.**

  **✅ v1 (Kenneth 2026-07-22, alternativ b): ENKEL «Sist brukt» — ingen vekting.** Liste over **distinkte prosjekter fra brukerens `Activity`, sortert på nyeste `createdAt` synkende, topp N.** Det er alt — «disse har du rørt sist, nyeste øverst». Løser 4-5-prosjekt-problemet (de dukker alle opp) uten scoring. Sticky beholdes som fallback når Activity er tom. Gjelder prosjekt- og byggeplass-steget. Ny tRPC-prosedyre; cowork skriver testplan (ledd 4).

  **v2 (oppfølger, IKKE i K3):** vektet recency+frekvens (nyeste høyest · 10d medium · 30d lavest · resten nedadgående). Finjusterer kun rekkefølgen i «Sist brukt»-seksjonen — trakten virker fullt ut med v1. Egen sak, egne vekter fabel-gates. **Bygg IKKE dette nå.**

  **🟡 OPPFØLGER — byggeplass-logging (Kenneth 2026-07-22):** `Activity` logger i dag `projectId`, ikke byggeplass, så byggeplass-«Sist brukt» er sticky (én verdi) i v1. **Kenneth: «senere må vi logge byggeplass også».** Når byggeplass-tilgang logges (targetType `bygning`/`byggeplass` i Activity, eller eget felt), kan byggeplass-«Sist brukt» bli en recency-liste som prosjekt-nivået. Egen sak — ført i [BACKLOG](BACKLOG.md) ved neste rens. Ikke i K3.
- Popover-headeren skal vise prosjektets firma (R2-vilkåret, admin-konsekvensen).
- DoD: build grønn → skjermbilder: trakt alle steg + minst 3 firma- og 3 prosjekt-sider m/ tonet sidehode + kundetelefon-gjennomklikk → fabel-designgate → dok-sync → cowork-merge. Statuskilde: verifisering/k3-verifiseringslogg.md (opprettes).

## Kloss 2c — to-linjers topplinje (Kenneth-forslag + fabel-gate 2026-07-22)

**Bakgrunn (K3-test, [verifiseringslogg Funn 1](verifisering/k3-verifiseringslogg.md)):** `KontekstChip.tsx:281` har `max-w-[220px] truncate`. Topplinja `{projectNumber} {name} · {byggeplass}` trunkerer byggeplass-suffikset bort for reelle numre («SD-ÅÅÅÅMMDD-NNNN», 16 tegn) → byggeplass-fiksen (kloss 2b) beseires i praksis. #9 var ikke feil byggeplass — prosjektet HETER «…Kenneth Myrhaug», og Røstbakken ble kuttet.

**Løsning — to-linjers topplinje, SD-nummer droppet (bor i trakt-radene + dokumentvisning):**
- **Prosjektkontekst:** linje 1 = **Firma**, linje 2 = **Prosjekt · Byggeplass**.
- **Firmakontekst:** kun linje 1 = **Firma** (ingen linje 2).

**Grammatikk (fabel-gate, ufravikelig):**
- **(a) Sonetonen følger AKTIV kontekst, aldri alle synlige nivåer.** Prosjektkontekst: linje 2 bærer **blå** chip + sonetone; linje 1 (Firma) er **dempet grå brødtekst — IKKE amber**. Amber finnes kun når firmakontekst er aktiv. To soneToner samtidig = intet signal. Firma-linja i prosjektkontekst er *informasjon* (kundetelefon-oppslaget), ikke et kontekst-claim.
- **(b) Split-chippen beholdes, ligger på den AKTIVE linja.** Prosjektkontekst: chip (▾ åpner trakten) + ⇄ (bytt nivå) på **linje 2**. Firmakontekst: chip + ⇄ på **linje 1**. Firma-linja i prosjektkontekst er **ren tekst — ingen tredje klikkmekanisme**.
- **Reverserer P1-vedtak 3** («prosjektkontekst viser kun eget nivå») — ført eksplisitt i [p1-nivasignal-vedtak § Vedtatt pkt 3](p1-nivasignal-vedtak.md). Prøvesteinen er ny fakta.

**Fil:** kun `KontekstChip.tsx` (topplinje-renderingen rundt l.281 + `entitetTekst`/`prosjektMedBygg`). SD-nummer ut av topplinje-strengen; behold i trakt-radene (`prosjektEtikett`) urørt.

**DoD kloss 2c:** build grønn + skjermbilde av begge kontekster (prosjekt: to linjer, blå på linje 2; firma: én linje, amber) med et LANGT prosjektnavn så byggeplassen beviselig overlever.

## Kloss-deling (stopp-punkter)
Kloss 1: A (trakten). Kloss 2: C + B på HMS-parets 2 sider (referansemontering). **Kloss 2c: to-linjers topplinje (over) — gate-korreksjon fra test.** Kloss 3: B resten (mekanisk utrulling) + **#6: utvid `PARBARE_SEKSJONER` med `timer`** (eneste øvrige samme-slug-par; kryss-konsept-par som ansatte↔mannskap = egen fabel-beslutning, ikke her). Rapportér etter hver kloss; fabel gater kloss 1+2+2c før kloss 3 ruller. **Kloss 2c + kloss 3 lander sammen i én test-deploy.**
