---
name: k3-kontekstvelger-vedtak
status: 🔴 PRIORITERT (Kenneth test 2026-07-22) — halvtilstanden er inkonsistent, K3 gjør kontekstvelgeren ferdig. K1+K2 landet, ordre kan skrives nå
eier: fabel (design) · Kenneth (retning) · cowork (sekvensering + gate)
sist_verifisert_mot_kode: 2026-07-21
kilde: ført av cowork fra fabel-relay. Fabels arbeidskopi i designprosjektet — denne er kanonisk
---

# K3 — Kontekstvelgeren som trakt (firma → prosjekt → byggeplass)

## 🔴 PRØVESTEIN — kundetelefon-scenariet (Kenneth, test 2026-07-22)

> **Kenneth etter å ha sett P1+K1+K2 på test:** *«plassholderen til firmanavnet bytter mellom firmanavn og prosjekt → det oppleves som vanskelig å orientere seg. Når en kunde ringer og sier han er i det prosjektet → slå opp firma → deretter prosjekt og til slutt byggeplass → en kan ikke drive gjettelek med fremmede navn som en personlig ikke jobber med.»*

**Dette er akseptkriteriet K3 måles mot.** Trakten skal støtte et **oppslag ovenfra og ned** — firma → prosjekt → byggeplass — der hvert nivå er synlig og søkbart, slik at en som IKKE jobber i prosjektet daglig kan finne fram uten å kjenne navnene på forhånd. Dagens chip (P1-A: «topplinja viser kun eget nivå») gjør det motsatte: den skjuler de andre nivåene, så du må vite hvor du er for å forstå hva du ser.

**Halvtilstand-dommen (Kenneth, samme test):** *«funksjoner er delvis bygget og ikke sammenhengende, inkonsistent mellom HMS og andre sider».* P1-chippen + tonet sidehode (kun på HMS) + løs byggeplass-velger = inkonsistent. **Testing pauses til K3 lukker helheten.** K3 er ikke en oppfølger lenger — den er det som gjør kontekstvelgeren ferdig.

### 🔴 MANGEL BEKREFTET — tonet sidehode skal på ALLE sider (Kenneth 2026-07-22)

**Kenneth:** *«skal det tonede sidehodet rulles ut på alle sider samtidig med K3 → ja → allerede skal dette ligge i plan → hvis ikke → da er det en mangel».*

**Cowork-måling: det lå IKKE i planen.** `SonetonetSidehode` er brukt på nøyaktig to filer i dag (`[prosjektId]/hms/page.tsx` + `firma/hms/page.tsx`) — HMS var pilot, og utrulling til øvrige sider stod ingen steder. Det er mangelen.

**Krav lagt til K3-leveransen:** `SonetonetSidehode` rulles ut på **alle firma- og prosjektsider samtidig med K3**, ikke bare HMS. Sonetonen (amber=firma/blå=prosjekt) blir da et konsistent nivåsignal på hver side, ikke en HMS-særegenhet. Sideinventar: [MASTERPLAN § Flate-inventar](../../redesign/MASTERPLAN.md) — cowork måler eksakt liste ved ordreskriving.

---


> 🔴 **LIVE-BEVIS 2026-07-21 (Kenneth, test):** P1-chippen deployet til test, og Kenneth reagerte: *«strukturelt er dette endret fra fabel sin plan. Funksjon er heller ikke komplett. Dette var ikke det jeg sa ja til fabel om. Nå står firma mellom prosjekt og byggeplass. Dette føles ikke ferdig slik det står nå.»*
>
> **Cowork-måling:** den deployete `KontekstChip` har **ingen** byggeplass-trakt (grep tom, 167 linjer). Det Kenneth så som «fabels plan» (firma→prosjekt→byggeplass-trakt med «Endre»/«Sist brukt»/«Hele prosjektet») er **fabels K3-mockup, ikke deployet kode.** Deployet popover = gammel flat firma+prosjekt-liste; byggeplass-velgeren henger fortsatt løst i toppbaren (K1, ikke fikset).
>
> **Konsekvens:** live-tilstanden bekrefter at chippen ALENE — uten K1-fiks og K3-trakt — er en halvtilstand. Kenneths opprinnelige «K3 er P1s siste revisjon» var riktig vurdert; chip-lappen løste kun chip-innhold-avviket, ikke helheten Kenneth sa ja til.
>
> ✅ **AVKLART (Kenneth 2026-07-21):** P1 chip-nivå leverte bra — **beholdes.** Det som gjenstår er velger-trakten (mockupen). Kenneths ord: *«P1 har levert bra — unntatt mockupen. Jeg er ikke helt overbevist at fabels plan er svaret — men verdt et forsøk — for den gamle likte jeg helt ærlig ikke.»*
>
> **To føringer dette gir:**
> 1. **Trakten (K3) bygges — men som et forsøk, ikke som låst fasit.** Fabels plan er utgangspunktet fordi den gamle flate velgeren var utilfredsstillende, ikke fordi trakten er bevist riktig. Bygges den, verifiseres den mot Kenneths faktiske bruk før den låses — samme «fasit er brukeropplevelsen, ikke koden»-prinsipp.
> 2. **P1 chip-arbeidet står** (navn ute, nivåord inne, ⇄, tonet sidehode). K3 rører velgeren/popoveren, ikke chip-signalet.
>
> **Sekvensering uendret:** K1+K2 lander før K3 (K3 bygger på K2s navigasjonssemantikk). Om «P1 lukkes formelt nå» eller «forblir åpen til trakten er inne» er nå et bokføringsspørsmål, ikke et reelt veiskille — arbeidet fortsetter uansett gjennom K1→K2→K3.
>
> **Kenneth 2026-07-21:** *«K3 er den siste revisjonen av P1»* → P1 lukkes først når K3 er bygget, og designgaten på A+B+C er en **delgate**.
>
> **Fabel 2026-07-21:** *«K3-ordre skrives når P1 er lukket»* → P1 lukkes på sitt scope, K3 er **oppfølger**.
>
> **De to kan ikke begge stemme.** Cowork førte først Kenneths versjon som avgjort — det var for raskt. Fabel eier design-sekvenseringen og skal avklare. Konsekvensen er reell: står P1 åpen til K3 lander, blokkeres lukkingen av K1+K2+K3, og verifiseringsloggen holdes åpen i flere runder.

## Chip-innholdet rettes her (cowork-funn 2026-07-21)

Cowork sammenlignet implementasjonen mot fasit-bildene (`docs/redesign/fasit/01-`/`02-p1-fasit-r2-final.png`) og fant **ett avvik**:

| | Fasit (2a + 3a) | Bygget (A+B) |
|---|---|---|
| Topplinje | `A.Markussen AS` som **ren tekst** + chip `FIRMA ▾ \| ⇄` | Navnet **inne i** chippen, intet nivåord |
| Popover-rad (3a) | `FIRMA` (liten, farget) · **A.Markussen AS** (fet) · «Endre» | — |

**Designspråket er gjennomgående: nivåord + navn + handling.** Spec-teksten *«topplinja viser KUN eget nivå (firma: firmanavn; prosjekt: prosjekt + bygning)»* gjelder hvilken **entitet** som navngis — ikke chippens innhold.

**Hvorfor det betyr noe:** uten nivåordet bæres signalet av **farge alene**, og da svikter det for fargeblinde. Amber/blå skal forsterke teksten, ikke være eneste bærer.

**Rettes i K3**, ikke som egen lapp — K3 bygger om både chip og popover etter samme mønster.

> Utløst av Kenneths observasjon under P1-skjermbilderunden: *«nå blandes prosjekt og byggeplass i en salsasaus — alle ingredienser er synlig»*. Måling og bakgrunn: [kontekstvelger-funn-2026-07-21.md § K3](kontekstvelger-funn-2026-07-21.md).

## Tre vedtak (fabel 2026-07-21, «lås den»)

1. **Trakt-retningen er låst.** Én popover: **firma → prosjekt → byggeplass**. Kun **ett nivå åpent om gangen**. Et valgt nivå kollapser til en sammenfoldet rad med **«Endre»**.
2. **Den frittstående `ByggeplassVelger` fjernes i ny nav** — byggeplass bor i trakten. **K1-fiksen trengs likevel**, siden gammel nav beholder velgeren.
3. **Popoveren lukkes ved prosjektvalg.** Byggeplass er et **valgfritt ettervalg**, ikke et obligatorisk tredje steg.

## Låste prinsipper

| Prinsipp | Detalj |
|---|---|
| **Alle/Mine** | Er en **filter-pille**, ikke et eget nivå i trakten |
| **Firma-steget** | Vises **kun når brukeren har flere firmaer**. Ett firma → steget finnes ikke |
| **Firmabytte** | **Nullstiller nedover** — prosjekt og byggeplass tømmes |
| **«Hele prosjektet»** | Er default. **Bygg-steget vises kun når byggeplasser finnes** |
| **Lange lister** | Over 6 elementer: søkefelt + rulling + **«Sist brukt»**-seksjon |
| **Hierarkiet** | **Absolutt.** Gruppeetiketten navngir prosjektet |

## Sekvensering (cowork eier — bekreftet av fabel)

**K1 + K2 lander FØR K3.** Begrunnelse: K3 bygger på K2s navigasjonssemantikk. Bygges K3 først, bygges den på en semantikk som er i ferd med å endres.

**K3-ordren skrives etter at P1 er lukket** — ellers vokser P1 mens den verifiseres.

## Fasit ved ordreskriving

§ 3a i beslutningskartet + skjermbilder. **Begge ligger i designprosjektet, ikke i repoet** — må relayes av Kenneth til utførende Opus (jf. [MASTERPLAN § filkart](../../redesign/MASTERPLAN.md)).
