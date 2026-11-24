> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.14. Seksjonsnumrene er de samme som før delingen.

### 4.14 Tilbake-knappene på web (versjon 13, w14)

> **Kenneth 2026-11-20 (§ 8.15), ordrett:** «#1 timer -> #2 åpne 19.11 -> #3 tilbake til oversikt -> #4 Hvilken side
> gikk jeg tilbake til? denne kommer ikke opp i sidemeny. be fabel sjekke alle tilbake knapper. Sjekk om
> tilbakeknappen "husker" hvilken side som var brukt tidligere slik at tilbake virkelig er tilbake, og ikke en side
> som ikke eksisterer slik som eksemplet over.»

🟡 Revisjon uten kode. Målt mot develop @ `4fe7b0d6`. Ingenting er klikket gjennom i nettleser; alt er lest i koden.
Forkortelser i denne delen: `W/` = `apps/web/src/app/dashbord/`, `K/` = `apps/web/src/components/`,
`L/` = `apps/web/src/lib/`.

#### Del A — svaret på «hvilken side gikk jeg tilbake til?»

Du havnet på **«Mine timer»** (`/dashbord/timer/mine`). Tre ting til sammen ga det du så:

1. **Knappen husker ikke.** «Tilbake til oversikt» på dagen er en fast lenke til Mine timer, uansett hvor du kom
   fra (`W/timer/[id]/page.tsx:1054`). Det samme gjelder etter sletting av dagen (`:462`) og når dagen ikke finnes
   (`:523`).
2. **Mine timer står ikke i sidemenyen.** Den ligger i brukermenyen oppe til høyre (`K/layout/Toppbar.tsx:153–165`)
   og er tatt ut av sidemenyen med vilje (FM5/K2, `K/layout/sidebar-elementer.tsx:210–212`). Siden finnes, men
   ingen rad i sidemenyen lyser når du står på den (`apps/web/src/hooks/useAktivSeksjon.ts:52–56`).
3. **Teksten sier ikke hvor du havner.** «Tilbake til oversikt» (`timer.tilbake`) brukes for Mine timer også når
   du kom fra prosjektets Timer.

Dagen kan åpnes fra fem steder, og bare to av dem er Mine timer: prosjektets Timer (`W/[prosjektId]/timer/page.tsx:204`),
Mine timer (`W/timer/mine/page.tsx:341`, `:583`), «+ Registrer timer» (`L/registrerTimer.ts:64–73`; knappen står
både på prosjektets Timer `:110` og på Mine timer `:321`), skjemaet «Ny dagsseddel» (`W/timer/ny/page.tsx:147`) og
den gamle adressen (`W/[prosjektId]/timer/[id]/page.tsx:9`).

**Menyen:** ordren ba om målet målt med ny navigasjon av og på. Bryteren finnes ikke lenger (migreringen
`20260910120000_drop_ny_navigasjon`; ingen treff på `nyNavigasjon` i `apps/web/src`). Det er én meny, og
tabellen under gjelder den.

#### Del B — alle tilbake-knappene (TK1–TK27)

Målt: 27 filer har ikonet `ArrowLeft` eller `ChevronLeft`. 14 av dem har en knapp som bytter side; resten er steg i
en veiviser, forrige uke, forrige bilde og liknende (del C). `router.back()` finnes fem steder i tre filer.
`TilbakeLenke` brukes ett sted, `Nivaabanner` med tilbake fire steder.

**Fast adresse — knappen går alltid til samme side:**

| # | Knapp | `fil:linje` | Går til | Kan åpnes fra | Riktig tilbake? |
|---|---|---|---|---|---|
| **TK1** | «Tilbake til oversikt» på dagen | `W/timer/[id]/page.tsx:1054` | Mine timer | de fem stedene i del A | 🔴 Nei, når du kom fra prosjektets Timer. Målet står i brukermenyen, ikke i sidemenyen. |
| **TK2** | samme, når dagen ikke finnes | `:523` | Mine timer | som TK1 | 🔴 som TK1 |
| **TK3** | etter «Slett» på dagen | `:462` | Mine timer | som TK1 | 🔴 som TK1 |
| **TK4** | «Tilbake til oversikt» på «Ny dagsseddel» | `W/timer/ny/page.tsx:218` | Mine timer | «+ Ny dagsseddel» på prosjektets Timer og på Mine timer (`K/timer/RegistrerTimerKnapp.tsx:89`), gammel adresse (`W/[prosjektId]/timer/ny/page.tsx:10`) | 🔴 Nei, fra prosjektets Timer |
| **TK5** | «Avbryt» samme sted | `:368` | Mine timer | som TK4 | 🔴 som TK4 |
| **TK6** | pil-knappen i dokumentleseren | `W/[prosjektId]/dokumenter/[dokumentId]/les/page.tsx:133`, `:198` | Mapper, uten valgt mappe | mappen du sto i (`W/[prosjektId]/mapper/page.tsx:762`; mappen ligger i adressen, `:137`) og dokumentsøket med Ctrl+K (`L/dokument-sok-ctrlk.ts:36`) | 🔴 Nei. Fra en mappe havner du på Mapper uten mappen åpnet. Fra søket havner du på en side du ikke var på. |
| **TK7** | «← HMS» på HMS-avvik og RUH | `W/[prosjektId]/oppgaver/[oppgaveId]/page.tsx:701–711` (adressen `:319`) | prosjektets HMS | prosjektets HMS (`W/[prosjektId]/hms/page.tsx:197`, `:487`, `:504`) og **Firma › HMS** (`W/firma/hms/page.tsx:155–162`) | 🔴 Nei, fra Firma › HMS: du havner i prosjektets liste, i en annen del av menyen |
| **TK8** | «← HMS» på SJA | `W/[prosjektId]/sjekklister/[sjekklisteId]/page.tsx:705–715` (adressen `:171`) | prosjektets HMS | prosjektets HMS (`hms/page.tsx:207`, `:495`) og Firma › HMS (`firma/hms/page.tsx:160`) | 🔴 som TK7 |
| **TK9** | etter «Slett» på oppgave | `oppgaver/[oppgaveId]/page.tsx:387` | Oppgaver eller HMS, eller dokumentet oppgaven ble laget fra | lista, HMS, Firma › HMS, en sjekkliste | 🟠 Feil bare fra Firma › HMS |
| **TK10** | etter «Slett» på sjekkliste | `sjekklister/[sjekklisteId]/page.tsx:212` | Sjekklister eller HMS | lista (`sjekklister/page.tsx:304`, `:911`), tegningen (`tegninger/page.tsx:569`, `:2631`), kontrollplanen (`K/kontrollplan/PunktStartHandling.tsx:77`, `:115`), HMS, Firma › HMS | 🟠 Feil fra tegningen, kontrollplanen og Firma › HMS |
| **TK11** | «Tilbake til firmaer» | `W/admin/firmaer/[id]/page.tsx:121`, `:101` | firmalista (SiteDoc-admin) | firmalista (`W/admin/firmaer/page.tsx:168`) og lenken på Mine timer (`W/timer/mine/page.tsx:482`) | 🟠 Feil fra Mine timer |
| **TK12** | pil-knappen på maskinimporten, og «Ferdig» | `W/maskin/import/page.tsx:143`, `:165`, `:527` | Maskin og utstyr | Maskin og utstyr (`W/maskin/page.tsx:128`) og Innstillinger (`L/innstillinger-kort.tsx:196`) | 🟠 Feil fra Innstillinger |
| **TK13** | pil-knappen på vareimporten, og «Ferdig» | `W/firma/varelager/import/page.tsx:156`, `:535` | Varelager | Varelager (`W/firma/varelager/page.tsx:200`) og Innstillinger (`L/innstillinger-kort.tsx:163`) | 🟠 Feil fra Innstillinger |
| **TK14** | «← Maskin og utstyr» på en maskin | `W/maskin/[id]/page.tsx:202`, `:181` | Maskin og utstyr | bare maskinlista (`W/maskin/page.tsx:289`) | ✅ |
| **TK15** | «← Maskin og utstyr» på «Ny maskin», og etter lagring | `W/maskin/nytt/page.tsx:210`, `:232`, `:253`, `:101`, `:110` | Maskin og utstyr | bare maskinlista (`W/maskin/page.tsx:135`, `:261`) | ✅ |
| **TK16** | «Tilbake til firmaarkivet» på en firmamal | `W/firma/innstillinger/malforvaltning/[malId]/page.tsx:41–47` | Malforvaltning | bare Firmaarkiv-fanen (`…/_components/FirmaarkivFane.tsx:180`) | ✅ for firmaadministrator. Fanen ligger ikke i adressen (`…/malforvaltning/page.tsx:35`); for SiteDoc-admin er det ikke målt hvilken fane som åpnes. |
| **TK17** | «Tilbake til HMS-maler» | `W/oppsett/produksjon/hmsmaler/[id]/page.tsx:56–62` | HMS-maler | bare mallista (`W/oppsett/produksjon/_components/MalListe.tsx:425`) | ✅ |
| **TK18** | «Tilbake til oppgavemaler» | `W/oppsett/produksjon/oppgavemaler/[id]/page.tsx:56–62` | Oppgavemaler | som TK17 | ✅ |
| **TK19** | «Tilbake til sjekklistemaler» eller «Tilbake til PSI-oppsett» | `W/oppsett/produksjon/sjekklistemaler/[id]/page.tsx:58–66` | Sjekklistemaler, eller PSI-oppsett når malen er en PSI-mal | mallista og PSI-oppsett (`W/oppsett/produksjon/psi/page.tsx:51`, `:304`) | ✅ Gjetter ut fra maltypen, og gjetningen treffer de to inngangene |
| **TK20** | «Tilbake til dashbord» når prosjektet ikke finnes, og «Til prosjektvelger» | `W/[prosjektId]/layout.tsx:84–89`, `:72–77` | prosjektvelgeren | feilside | ✅ |

**Knappen husker — adressen sier hvor du kom fra:**

| # | Knapp | `fil:linje` | Husker | Uten huskelapp | Riktig tilbake? |
|---|---|---|---|---|---|
| **TK21** | «Tilbake til oversikt» i attesteringen, og etter retur og gjenåpning | `W/attestering/[id]/page.tsx:24–42` → `K/timer/AttesteringDetalj.tsx:216`, `:134`, `:93`, `:564` | visning, uke, fane og firma (`?fraVisning`, `?fraUke`, `?fraFane`, `?firma`), satt av lista (`W/attestering/page.tsx:317`). Lista speiler de samme valgene i adressen (`:177–192`). | Attestering, standardvisning | ✅ Dette er mønsteret som virker. |
| **TK22** | «Tilbake til <dokumentet>» på en oppgave laget fra en sjekkliste | `W/[prosjektId]/oppgaver/[oppgaveId]/page.tsx:689–698` (leser `?returnerTil`, `:312–319`) | sjekklisten oppgaven ble laget fra (`K/OpprettOppgaveModal.tsx:186–194`, `sjekklister/[sjekklisteId]/page.tsx:1259`) | knappen vises ikke | ✅ Vakten er svakere enn i TK23: den godtar alt som starter med `/`, ikke bare `/dashbord/`. |
| **TK23** | «Tilbake til maler» på papirkurven | `W/[prosjektId]/papirkurv/page.tsx:168` (`K/nivaa/TilbakeLenke.tsx:23–45`) | siden du kom fra (`?retur`, bare adresser under `/dashbord/`), tekst fra `?kilde` | knappen vises ikke | ✅ Den delte komponenten. Brukt ett sted (`MalListe.tsx:1299`). |

**Historikk — knappen går ett steg tilbake i nettleseren (`router.back()`):**

| # | Knapp | `fil:linje` | Kan åpnes fra | Riktig tilbake? |
|---|---|---|---|---|
| **TK24** | «Tilbake» på utskrift av sjekklister | `W/[prosjektId]/sjekklister/skriv-ut/page.tsx:80`, `:112` | Sjekklister (`sjekklister/page.tsx:434`) | ✅ fra lista. 🟠 Åpnet i ny fane eller fra bokmerke finnes ingen forrige side i appen: knappen gjør ingenting eller går ut av SiteDoc. |
| **TK25** | «Avbryt» og retur etter valgt punkt i tegningen | `W/[prosjektId]/tegninger/page.tsx:1776`, `:1327` | et tegningsfelt i en sjekkliste eller oppgave (`K/rapportobjekter/TegningPosisjonObjekt.tsx:47`) og et kontrollplanpunkt (`K/kontrollplan/RedigerPunktDialog.tsx:531–533`) | ✅ Historikk er riktig her: du skal tilbake til skjemaet du sto i. 🟠 Siden tåler full innlasting med `?posisjonsvelger` (`:266–279`), og da finnes ingen forrige side. |
| **TK26** | «Avbryt» på «Nytt prosjekt» | `W/nytt-prosjekt/page.tsx:123` | prosjektvelgeren (`W/page.tsx:102`, `:130`), Firma › Prosjekter (`W/firma/prosjekter/page.tsx:66`), firmaoppsettet (`W/firma/oppsett/page.tsx:168`), Kom i gang (`W/kom-i-gang/page.tsx:46`) | ✅ fra alle fire. 🟠 Åpnet direkte: som TK24. |

**Sider uten tilbake-knapp:**

- **TK27.** En vanlig oppgave og en vanlig sjekkliste har ingen tilbake-knapp (bare «← HMS» på HMS-dokumenter og
  TK22). Brukeren går tilbake med sidemenyen eller nettleseren. Sidene åpnes fra lista, tegningen,
  kontrollplanen og Firma › HMS. Ikke med i w14 (del F).

#### Del C — knapper med pil som ikke bytter side

Disse er lest og står som de er. De er steg tilbake i en veiviser, forrige uke eller måned, forrige bilde eller en
visning på samme side:

`W/oppsett/brukere/_components/BrukergruppeFane.tsx:114` (tilbake til gruppelista på samme side) ·
`W/oppsett/byggeplasser/page.tsx:1545` (vis serietabellen igjen) · `W/maskin/import/page.tsx:402`, `:457` ·
`W/firma/varelager/import/page.tsx:403`, `:460` · `W/firma/kompetanse/page.tsx:1462`, `:1521` ·
`K/kontrollplan/ImportFremdriftsplanDialog.tsx:377`, `:558`, `:567` · `K/mengde/import-dialog.tsx:739` ·
`W/[prosjektId]/sjekklister/page.tsx:957` og `W/[prosjektId]/oppgaver/page.tsx:1110` (tilbake i opprett-vinduet) ·
`W/admin/firmaer/[id]/ProsjekterFane.tsx:253` (forrige side i lista) · `W/firma/oppsett/page.tsx:218` og
`W/firma/timer/oppsett/page.tsx:224`, `:239` (forrige steg) · `W/[prosjektId]/timer/page.tsx:115`,
`W/attestering/page.tsx:363`, `W/firma/kalender/page.tsx:166`, `K/kontrollplan/UkeVelger.tsx:126` (forrige uke
eller måned) · `W/[prosjektId]/tegning-3d/page.tsx:764` (forrige PDF-side) · `K/BildeLightbox.tsx:74`,
`K/rapportobjekter/FeltDokumentasjon.tsx:299` (forrige bilde).

#### Del D — knappene som kan sende deg et annet sted enn du kom fra

1. 🔴 **Dagen og «Ny dagsseddel»** (TK1–TK5): fra prosjektets Timer til Mine timer. Det du så.
2. 🔴 **Dokumentleseren** (TK6): fra en mappe til Mapper uten mappen; fra søket til Mapper.
3. 🔴 **HMS-dokumenter åpnet fra Firma › HMS** (TK7, TK8, og etter sletting TK9, TK10): til prosjektets HMS.
4. 🟠 **Sjekkliste slettet fra tegningen eller kontrollplanen** (TK10): til Sjekklister.
5. 🟠 **Firmasiden for SiteDoc-admin åpnet fra Mine timer** (TK11): til firmalista.
6. 🟠 **Importsidene åpnet fra Innstillinger** (TK12, TK13): til Maskin og utstyr eller Varelager.
7. 🟠 **Historikk-knappene åpnet direkte** (TK24–TK26): ingen forrige side å gå til.

**To funn ved siden av knappene:**

- **Prosjektets Timer husker ikke uka.** Uka og statusfilteret ligger bare i siden, ikke i adressen
  (`W/[prosjektId]/timer/page.tsx:55–56`). Kommer du tilbake fra en dag i en tidligere uke, står lista på
  denne uka igjen, uansett hvordan tilbake-knappen bygges. Mine timer husker filteret sitt selv
  (`W/timer/mine/page.tsx:144–153`), og attesteringen har valgene i adressen (TK21).
- **Sidemenyen lyser feil på dagen.** På dagen og på «Ny dagsseddel» lyser «Dashbord» i sidemenyen, fordi
  adressen ikke har et prosjekt i seg (`apps/web/src/hooks/useAktivSeksjon.ts:58–68`). På Mine timer lyser
  ingenting. Lest i koden, ikke sett i nettleser. Spørsmål B40.

#### Del E — én felles løsning: fire alternativer, rangert

| | Løsning | Slik virker den | Styrke | Svakhet |
|---|---|---|---|---|
| **A** (anbefalt) | **Lenken som åpner siden, sier hvor du kom fra.** | Lenken til en underside får med adressen du står på (`?retur=…`). Tilbake-knappen går dit. Mangler den (bokmerke, lenke i e-post, søk), går knappen til en fast reserve. Etter sletting og «Ferdig» brukes samme adresse. | Finnes alt i tre varianter (TK21–TK23), og den delte komponenten har vakten mot adresser utenfor SiteDoc. Husker også i ny fane og etter oppdatering av siden. Knappen kan si hvor den går: «Tilbake til Timer», «Tilbake til Mine timer». Samme oppførsel hver gang; kan testes uten nettleser. | Hver inngang må sende adressen med: om lag 16 lenker for knappene i del D. Adressen blir lengre. Lista står øverst når du kommer tilbake, som i dag. |
| **B** | **Nettleserens historikk, med fast reserve.** | Knappen går ett steg tilbake i nettleseren når forrige side er en side i SiteDoc; ellers til reserven. | Ingen endring i lenkene. Lista står der du rullet til. | Trenger en ny «husker» i rammen for å vite om forrige side er i SiteDoc. Mellomsider havner i historikken: fra «Ny dagsseddel» åpnes dagen med et nytt steg (`W/timer/ny/page.tsx:147`), og tilbake fra dagen ville gått til skjemaet. Ny fane husker ingenting. Teksten kan ikke si hvor knappen går. |
| **C** | **Fast adresse valgt ut fra sammenhengen.** | Dagen går til prosjektets Timer når et prosjekt er valgt i topplinja, ellers til Mine timer. | Én linje pr. knapp. | Gjetter. Kom du fra Mine timer med et prosjekt valgt, havner du feil den andre veien. |
| **D** | **Bare teksten rettes.** | «Tilbake til oversikt» blir «Til Mine timer». | Ærlig tekst, nesten ingen kode. | Tilbake er fortsatt ikke tilbake. |

**Anbefaling: A.** Den gjør det du ba om («husker hvilken side som var brukt»), den er alt i bruk og virker i
attesteringen, og den er den eneste som også husker i ny fane og kan si i teksten hvor du havner. B gir ett
fortrinn (rulleposisjonen), men krever ny mekanisme i rammen og har flere måter å gå feil på.

**A for hver type side:**

| Type side | I dag | Med A |
|---|---|---|
| Underside med flere innganger: dagen, «Ny dagsseddel», dokumentleseren, HMS-dokument, firmasiden for SiteDoc-admin, importsidene (TK1–TK13) | fast adresse | Knappen går til siden du kom fra, med teksten «Tilbake til <siden>». Åpnet direkte: reserven, som er adressen knappen har i dag. Etter sletting, lagring og «Ferdig»: samme sted som knappen. |
| Underside med én inngang (TK14–TK19) | fast adresse, riktig | Uendret. Ingen kode i w14. |
| Sider som alt husker (TK21–TK23) | egne parametre | Uendret oppførsel. Papirkurven bruker alt komponenten. Oppgavens `?returnerTil` får samme vakt som komponenten (bare `/dashbord/…`). Attesteringens lukkede sett står. |
| Historikk-knappene (TK24–TK26) | `router.back()` | Utskrift og «Nytt prosjekt» får `?retur` fra inngangene og går dit; åpnet direkte går de til Sjekklister og prosjektvelgeren. Punktvelgeren i tegningen beholder historikken, fordi skjemaet du kom fra skal stå som du forlot det; ved full innlasting går «Avbryt» til Tegninger. |
| Feilsider (TK2, TK20) | fast adresse | TK2 følger TK1. TK20 uendret. |
| Lista du kommer tilbake til | prosjektets Timer glemmer uka | Uka og statusfilteret på prosjektets Timer legges i adressen, som i attesteringen. Da bærer `?retur` uka med seg. |
| Knappene i del C og sidene uten knapp (TK27) | — | Uendret. |

**Mellomsider:** «Ny dagsseddel» åpner dagen selv (`W/timer/ny/page.tsx:147`). Den sender `?retur` videre, så
«Tilbake» på dagen går til lista du startet fra, ikke til skjemaet. De gamle adressene som videresender
(`W/[prosjektId]/timer/[id]/page.tsx`, `W/[prosjektId]/timer/ny/page.tsx`) sender parametrene videre på samme
måte som attesteringens gjør i dag.

#### Del F — w14, og hva som ikke er med

**Rekkefølge i delen:** (1) den delte komponenten og hjelperen, med tester som feiler først; (2) dagen,
«Ny dagsseddel» og de to listene — Kenneths tilfelle; (3) resten av del D. Delen kan bestilles som to hvis
orkestrator vil ha timeføringen for seg: punkt 1–2 først, punkt 3 etterpå.

**Tester som skal feile først:** vakten avviser adresser utenfor `/dashbord/` og adresser som starter med `//`;
uten `?retur` gir komponenten reserven; lenken fra prosjektets Timer til dagen bærer adressen med uka; etter
sletting av dagen går siden til samme adresse som knappen; «Ny dagsseddel» sender `?retur` videre til dagen.

**Ikke med:**

- Sidene uten tilbake-knapp (TK27) får ingen ny knapp. Det er en ny funksjon, ikke en retting.
- Knappene i del C.
- Hvor «Mine timer» står i menyen, og hva sidemenyen lyser på dagen (B40).
- `apps/api`, `packages/db` og `apps/mobile`. Ingen migrering.

**Mobil (bare målt):** appen bruker stabel-navigasjon, der tilbake er ett steg ned i stabelen. Målt 53 kall til
`router.back()` eller `goBack()` i 27 filer under `apps/mobile/app` og `apps/mobile/src`, og ingen `canGoBack()`.
Fire filer har tilbake-ikon uten slikt kall (`app/timer/index.tsx`, `app/(tabs)/boks.tsx`,
`src/components/IfcViewer.tsx`, `src/components/rapportobjekter/FeltDokumentasjon.tsx`); de er ikke lest. Om
noen knapp på mobil går til en fast side i stedet for tilbake, er ikke klassifisert (§ 10). Ingen mobilkode
foreslås (§ 8.13).
