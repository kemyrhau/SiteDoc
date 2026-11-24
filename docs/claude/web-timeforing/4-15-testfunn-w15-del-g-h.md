> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.15 del G–H. Seksjonsnumrene er de samme som før delingen.

#### Del G — w15 i seks leveranser (versjon 17 og 18)

✅ **Status 2026-11-21 (versjon 20):** w15a (`d5ae514e`), w15b (`cee0c03e`), w15c (`a690363d`), w15d (`94fe0b77`),
w15f (`bda2aae4`), F68 (`6ab36520`) og w15g (`4e2680ce`) er merget til develop. w15e er utgått. Kolonnen «Venter
på» og avsnittene om rekkefølge under er historikk. Migreringen for w15c kjører Kenneth, og tellingen i del F
kjøres før den. Appen (w15gm) venter på web.

Navnene w15a–w15d står. ⚠️ **w15e er utgått** (§ 8.20). **w15f er ny:** prosjektet kan byttes på en reise
som finnes, med pennen på dagssiden og i attesteringen. **w15g er ny:** attesteringskortet i
informasjonsstatus får penn i stedet for åpne felt, vinduet «Rediger arbeid» står som jobben åpnet for
redigering, og arbeideren ser merket «Korrigert av [navn]» i timelisten ved hver lagring
(versjon 19; ⚠️ snur versjon 18: ingen e-post).

| Del | Innhold | Rører | Migrering · mobil | Venter på |
|---|---|---|---|---|
| **w15a** | **Åpent kort (B41 A).** Jobben som nettopp ble laget, er åpen etter «+ Registrer timer» (F1–F5). Vinduet åpnes ikke av seg selv på første jobb. `?registrer`, `?nyttProsjekt` og `?eksisterte` fjernes fra adressen når flyten har kjørt; `?retur` står. | `WS`, testen for siden, `timer.md`, `web.md`. | Nei · nei | Merget til develop (`d5ae514e`). |
| **w15b** | Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md). | `RK`, `MR`, `RM` med tester, `WS`, i18n, hjelpeteksten, `timer.md`, `shared-pakker.md` | Nei · nei | Merget til develop (`cee0c03e`). |
| **w15c** | **Reisens kort på serveren (B43 B, B44, B47 A, B48 A).** Regelen i del E: byggeplassen og et valgt underprosjekt er krav; reise uten underprosjekt står i jobben på byggeplassen. `sikreKortId`, ny utfylling av reiser som finnes, paritetstesten, tellingen og gate-SQL (del F). Reise til annet kontor etter arbeid i eget kort (del E punkt 6; ⚠️ utgått, § 8.22 punkt 2 og 3, fjernes i leveransen i § 9). **Ingen kolonne.** | `RV` og `reiseKort.test.ts`, `KI`, `D` bare der testene pr. skrivevei krever det, ny migrering i `packages/db-timer/prisma/migrations/`, `apps/api/src/routes/reise-kortid-migrering.integration.test.ts`, `kortid-skriveveier.integration.test.ts`, `AM` bare for F31 med test, `relay/sql/` (tellingen), `timer.md`, `api.md`, `shared-pakker.md`, kort-id-specen (§ 2.3). Ikke `WS`, `RK`, `MR` eller `RP`, ikke `apps/mobile`. | **Ja: en utfylling, bare data, Kenneth kjører.** Ikke mobil. | Merget til develop (`a690363d`). B47 og B48 er besvart (§ 8.20). Regel 10 kjøres uavhengig: delen flytter rader mellom kort som attesteres. |
| **w15d** | **Dagssiden viser reisen.** Reiselinja får egen tegning: merket «Reise», stedet og klokka, uten aktivitet og matpause; underprosjektet vises når det avviker fra jobbens. Hodet viser sted og klokkeslett på alle kort, og regner byggeplassen av arbeidet. Et kort uten arbeid sier «Reise» i hodet og har «+ Timer», «+ Reise» og «+ Tillegg/Utlegg» (B45 A); med en timerad har det alle fem, som en jobb (presisert i § 8.19). Teksten under lønnsarten i timerad-vinduet (del C punkt 4). Pennen på en reise: koderen måler hvilke felt «Rediger timer-rad» har for en reiserad (`WS:1461`); tid, byggeplass og underprosjekt skal kunne rettes der, og kan prosjektet ikke byttes, meldes det før kode. | `WS` (`renderLinjer`, `JobbKortRamme`, lenkerekka `:2004–2033`, `TimerRadDialog` bare teksten), i18n, hjelpeteksten for siden, `timer.md`, `web.md` | Nei · nei | Merget til develop (`94fe0b77`). |
| **w15e** | ⚠️ **Utgått (§ 8.20).** Sto slik: «Flytt til …» på reiselinja (B46 B). | — | — | — |
| **w15f** | **Prosjektet kan byttes på en reise som finnes (§ 8.20).** Pennen på reiselinja har fem felt på dagssiden og i attesteringen (del E, `v17-reiselinje.png`). **Server:** `oppdaterTimerRad` tar imot prosjekt for reiserader, med sjekkene til en ny rad og medlemskap på målprosjektet; `rettRadFelt` holder underprosjektet mot prosjektet (F51). **Dagssiden:** prosjektfeltet i pennen åpnes for reise, med linja «havner i». **Attesteringen:** reiselinja i del 8 er tekst med ✎; vinduet har de fem feltene; de åpne feltene og «Føres på» på reiselinja tas ut; prosjektlista har prosjektene attestanten kan attestere. **Linja «havner i»** ser også kort som bare har maskin, tillegg eller utlegg (F55). Tabellen står i del F. Firmavalget er uendret. | `D` (`oppdaterTimerRad`, `utforRedigerSedelRader`), `WS` (`TimerRadDialog`, kallet til reisevinduet `:1457–1470`), `RK`, `MR`, `RP` (del 8), attesteringssiden bare for prosjektlista (koderen måler hvor omfanget leses), i18n, hjelpeteksten for dagen og for attesteringen, `timer.md`, `api.md`, `web.md`, `hjelpetekster.md`, testene i del H. Ikke `RV`, ikke `KI`, ikke `apps/mobile`. | Nei · nei | Merget til develop (`bda2aae4`). Gikk etter w15d (samme fil, `WS`) og w15c (`D`, og regelen linja viser). Regel 10 kjøres uavhengig: delen flytter kostnad mellom prosjekter og rører attestantens rett. |
| **w15g** | **Attesteringskortets to tilstander, og merket «Korrigert av» hos arbeideren (Kenneth 2026-11-21, § 8.20).** **Informasjonsstatus (kortet):** timelinjene, maskinlinjene og tilleggslinjene er tekst med ✎; vinduet har feltene pennen på dagssiden har for linjetypen; de åpne feltene tas ut i samme commit (F63, F65). ⚠️ Snur w10 del A punkt A1. **Åpnet for redigering («✎ Rediger jobben» → «Rediger arbeid»):** feltene står åpne, ingen penn; vinduet får bare linja som sier hva arbeideren ser (F66). Koderen måler F67 og melder før kode. **Merket:** «Korrigert av [navn]» med tidspunkt settes ved hver lagring, uansett tilstand. Arbeideren ser det på linja på dagen, med hvert felt før → etter under, og som «Korrigert av [navn]» på dagen i Mine timer. Tekstene står i del F. **Ingen e-post, ingen push og ingen løkke** (versjon 19; ⚠️ snur versjon 18). Kilden utvides (F76–F78, F80): arbeiderens to lesere får de korrigerte feltene; prosjekt, byggeplass og underprosjekt regnes som korrigerte felt; bytte av underprosjekt leses fra loggen; arbeiderens merke regner fra første korrigering. Tabellene og `v17-kortet-to-tilstander.png` står i del F. Firmavalget er uendret. | `RP` (del 1, 2, 4 og 6), `RRM` (bare linja om hva arbeideren ser), `D` (`hentMedId` og `list`; ikke veiene som retter, attesterer eller returnerer), `apps/api/src/services/timer/kortLeser.ts` (feltlista, underprosjekt fra loggen, første korrigering), `WS` (merket i `renderLinjer` og `ReiseLinje`), `apps/web/src/app/dashbord/timer/mine/page.tsx`, i18n, hjelpeteksten for dagen, for Mine timer og for attesteringen, `timer.md`, `api.md`, `web.md`, `hjelpetekster.md`, kort-id-specen (R21), testene i del H. Ikke `apps/api/src/services/epost.ts`, ikke `apps/api/src/server.ts`, ikke `apps/mobile`. | Nei · nei (appen er w15gm, § 9) | Merget til develop (`4e2680ce`). w15f er merget (develop `bda2aae4`), F68 er merget (develop `6ab36520`), og B49 er besvart (§ 8.20). Regel 10 kjøres uavhengig: arbeiderens lesere får nye felt, og de skal bare nå eieren. |

**Prosjektet byttes ikke i w15d.** Koderen målte det i løsningen (F46, F47), og orkestrator bekreftet det
2026-11-21. Det er w15f.

**«Del opp» med begge kortene åpne (versjon 23)** er ikke en del av w15. Leveransene står i § 4.16 del G og i § 9.

**Firmavalget «Rediger ved attestering» endres ikke i w15f eller w15g** (Kenneth 2026-11-21, § 8.20).

✅ **F68 er merget (`6ab36520`):** «Lagre endringer» sender byggeplassen uendret. Sto slik: F68 rettes for seg,
før w15c er deployet. Bestilt 2026-11-21 som egen retting (`feat/web-timer-f68`,
ordre versjon 18). «Lagre endringer» i «Rediger arbeid» ser ut til å
tømme byggeplassen på radene (lest, ikke kjørt), og etter w15c følger kortet byggeplassen. Koderen skriver
testen først (del H punkt 34). Er den grønn mot dagens kode, strykes F68. Er den rød, sender vinduet radens
byggeplass uendret. Rører `RRM` og testen. Ingen migrering, ikke mobil.

**Hvorfor w15g er egen leveranse:** w15f er det Kenneth ba om for reisen, og er ferdig uten w15g. w15g
bygger om resten av kortet og legger til merket for alle rettinger. Begge rører `RP`, `D` og `WS`, så
de går etter hverandre. ⚠️ Versjon 18 sa at varselet ikke kunne komme før pennen; det gjaldt e-posten.
Kortet og merket står likevel i samme leveranse: Kenneth tester dem sammen, og begge rører hjelpetekstene.

**Appen (w15gm):** merket «Korrigert av» i appen er egen leveranse etter w15g og står i § 9 som «venter på
web». Målt i F82. Koden er ikke planlagt.

**Hvorfor w15f er egen leveranse og ikke en del av w15c:**

- w15f rører `WS`, som w15d bygger i nå. w15c rører ikke `WS` og kan gå ved siden av w15d. Lagt sammen
  måtte migreringen vente på w15d.
- w15c har en migrering Kenneth kjører, og en regel som skal i gate for seg. w15f har ingen migrering.
- Begge rører `D`. w15f går derfor etter w15c, og testene for prosjektbyttet skrives mot regelen som
  gjelder.
- Rettingen av linja «havner i» (F55) ligger i w15f av samme grunn: radene sendes inn fra `WS`.

**Rekkefølgen** (⚠️ historikk: alle leveransene er merget, se status øverst i del G). w15a og w15b er merget. **w15d → w15f → w15g** går etter hverandre, fordi alle rører
`WS`. **w15c** rører ikke `WS` og kan bestilles nå, ved siden av w15d. w15f venter på begge. w15d kan bygges før
w15c er deployet, men dagen på bilde 8 blir først to kort når w15c er ute og utfyllingen er kjørt.
i18n-generatoren kjøres ikke samtidig i to deler. Koderen leverer løsning med skjermbilde før kode i w15d,
w15f og w15g.

**Kenneth ser etterpå:**

- **w15a:** «+ Registrer timer» fra prosjektets Timer på en ny dag. Jobben er åpen.
- **w15b:** Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md).
- **w15c:** dagen på bilde 8 har to kort, og attesteringen har én rad «Reise» for turen til Narvik.
- **w15d:** kortet for turen sier «Reise · Narvik · 12:00–15:00» i hodet, og jobben sier «sommerfeldtsgt 65
  · 07:00–12:00». Reisekortet har tre lenker.
- **w15f:** pennen på hjemreisen → bytt prosjekt til Prosjekt 1050 → reisen står i eget kort på Prosjekt
  1050. I attesteringen står reisen som tekst med ✎; vinduet har Start kl., Slutt kl., Prosjekt,
  Byggeplass og Underprosjekt.
- **w15g:** kortet åpner med tekst på alle linjer, og hver linje har ✎. «✎ Rediger jobben» åpner vinduet
  med feltene åpne, uten penn. Retter attestanten slutten på en linje, står «Korrigert av Kari Leder
  21.11. kl. 14:32» på linja hos arbeideren, med «Slutt kl. 15:35 → 15:50» under. Mine timer sier
  «Korrigert av Kari Leder» på dagen. Ingen e-post går.

#### Del H — tester som skal feile først

1. **Regelen** (`reiseKort.test.ts`): eksempelet i del E rad for rad; reise til en byggeplass uten jobb gir
   `null`; byggeplassen går foran underprosjektet; prosjekt uten byggeplasser gir jobben. Testene i
   `reiseKort.test.ts:90–111` låser dagens rekkefølge og snus.
2. **Serveren, pr. skrivevei** (ekte Postgres): en reise til en byggeplass uten jobb har egen kort-id etter
   kallet. Føres en jobb der, har reisen jobbens. Slettes jobben, har reisen egen igjen. En attestert reise
   flyttes ikke.
3. **Utfyllingen:** en fast dagsseddel med reise i en jobb på en annen byggeplass (ikke attestert, og
   attestert), reise i riktig jobb, og reise som skal til en annen jobb på samme byggeplass. Riktig kort pr.
   rad, kjørt to ganger gir samme svar, `updated_at` og alle andre felt er urørt, og gate-SQL gir 0.
   Fixturen må ha minst én rad som flyttes; en tom migreringsfil gir rød test.
   - **Paritet:** samme dagssedler gjennom regelen og gjennom de to migreringene gir samme kort.
4. **Attesteringen:** en dag med én jobb og ett reisekort sier «1 jobb». ✓ på jobben sender ikke reisens
   id. ✓ på reisekortet sender bare reisens. ✓ på dagen sender alt.
5. **Isolasjon:** reisen kobles aldri til en jobb på en annen dagsseddel, et annet prosjekt eller et annet
   firma (testen finnes, § 4.11 del H punkt 6, og står).
6. **Eldre app:** synk med reise uten kort-id til en byggeplass uten jobb. Reisen står i eget kort etter
   hver synk, og ingenting avvises.
7. ⚠️ Tester regelen som er utgått (§ 8.22 punkt 2 og 3); testen står til leveransen i § 9 fjerner koden.
   **Reise til annet kontor:** før dagens første arbeid står den i første jobb på prosjektet. Etter at
   arbeidet er begynt, står den i eget kort, med en kort-id som ikke er lik noen jobbs (F25). Returen
   står i jobben man drar fra (B44).
8. **Dagssiden:** etter flyten er den nye jobbens kort åpent, og adressen har ikke `registrer` (w15a). Et
   kort uten arbeid viser de tre lenkene etter B45 A. Får kortet en timerad, viser det alle fem, også
   «+ Maskin» og «+ Vare» (Kenneths presisering, § 8.19). `dagskort-vakt.test.tsx` er grønn (w15d).
9. **Underprosjektet (B44, B48 A):** en reise med underprosjekt som ingen jobb på byggeplassen har, gir
   `null` fra regelen og egen kort-id på serveren. En reise uten underprosjekt står i jobben på
   byggeplassen, også når jobben har underprosjekt.

⚠️ **Punkt 10–17 i versjon 16 er utgått (§ 8.20).** De testet valgt kort, «Flytt til …» og
`valgt_kort_id`. Numrene brukes ikke på nytt.

18. **Kort-id fra klienten leses ikke (w15c):** «Legg til timer-rad» med reise som lønnsart og en ny
    kort-id, på et sted dagen har jobb. Reisen står i jobben. Uten jobb på stedet står den i eget kort.
19. **«Føres på» (w15c;** ⚠️ valget er tatt ut av kortet i w15f, og underprosjektet byttes i vinduet bak ✎**):** attestanten bytter underprosjekt på en reise i en jobb. Har dagen en jobb med
    det underprosjektet på byggeplassen, står reisen der. Ellers står den i eget kort.
20. **Pennen, serveren (w15f, ekte Postgres):** `oppdaterTimerRad` med nytt prosjekt, byggeplass og
    underprosjekt på en reise. Raden har de nye verdiene og samme id. Retning, oppmøtested, kjøretid og
    kilde er urørt. Kort-id er jobben på det nye stedet, eller egen når dagen ikke har jobb der. Rød i
    dag: inngangen har ikke feltet.
21. **Pennen avviser (w15f):** prosjekt på en arbeidsrad; prosjekt i et annet firma (isolasjon); prosjekt
    arbeideren ikke er medlem av; byggeplass eller underprosjekt som hører til det gamle prosjektet;
    attestert reise; låst dagsseddel. Én test pr. avvisning.
22. **Attesteringen, serveren (w15f):** `rettRadFelt` med nytt prosjekt på en reise. Prosjektleder med rett
    på begge prosjektene: lagret, historikkpost skrevet, kort-id etter regelen. Uten rett på målprosjektet:
    avvist. Firmavalget av: avvist. Egen dagsseddel i et firma med B15 «Nei»: avvist. Prosjekt i et annet
    firma: avvist.
23. **Underprosjektet følger prosjektet (F51):** `rettRadFelt` med bare nytt prosjekt på en reise som har
    underprosjekt og ingen byggeplass. Raden skal ikke stå med underprosjektet fra det gamle prosjektet.
    Koderen kjører testen mot dagens kode først og melder om den er rød.
24. **Pennen, skjermen (w15f):** prosjektfeltet er åpent for en reiserad og låst for en arbeidsrad. Bytte
    av prosjekt tømmer underprosjektet og foreslår byggeplass. Linja «havner i» følger feltene. Kallet
    sender prosjekt, byggeplass og underprosjekt sammen.
25. **Attesteringen, skjermen (w15f):** reiselinja i del 8 er tekst og har ingen åpne felt. En reise som
    venter, har ✎; vinduet har start, slutt, prosjekt, byggeplass og underprosjekt. Prosjektlista har
    bare prosjektene attestanten kan attestere. «Lagre» sender ett kall; «Avbryt» sender ingen. Med
    firmavalget av er bare underprosjektet åpent i vinduet, og det kan lagres. En attestert reise har
    ingen ✎.
26. **Linja «havner i» (F55, w15f):** en dag der et kort bare har maskin eller tillegg, og en reise under
    terskelen på samme sted. Linja sier det kortet serveren velger.
27. **Firmavalget dagskort-modus:** `dagskort-vakt.test.tsx` er grønn etter w15f.
28. **Merket, serveren (w15g):** etter en retting på en annens dagsseddel gir arbeiderens leser for dagen
    (`hentMedId`) de korrigerte feltene for raden: felt, verdi før og etter, hvem og når. Lista bak Mine
    timer (`list`) gir pr. dag hvem som korrigerte sist, og om flere har korrigert. En dag uten retting har
    ingen. En annen bruker enn eieren får dem ikke fra de to leserne (isolasjon). Én test pr. vei i F60.
    Testene feiler mot dagens kode (F80).
29. **Merket, skjermen (w15g):** linja har «Korrigert av Kari Leder 21.11. kl. 14:32» med feltene under,
    før → etter. Mine timer har «Korrigert av Kari Leder» på dagen, og «Korrigert av Kari Leder m.fl.» når
    to har korrigert. Uten navn står «Korrigert ved attestering». En linje uten retting har ikke merke.
30. ⚠️ **Utgått i versjon 19 (§ 8.20).** Testet e-posten. Nummeret brukes ikke på nytt.
31. **Firmavalget står:** testene fra w5 (`w5-retting-ved-attestering.integration.test.ts`) er grønne
    etter w15f og w15g.
32. **Kortet i informasjonsstatus (w15g):** kortet har ingen felt som kan skrives i. Hver ventende timelinje,
    maskinlinje og tilleggslinje har ✎ når firmavalget er på. Vinduet retter fra, til, pause og lønnsart
    på en timelinje, timer på en maskinlinje og antall på en tilleggslinje: én test pr. felt som kunne
    rettes i kortet før (F63). «✎ Rediger jobben», «Del opp», ✂ og underprosjekt-knappene finnes.
33. **Åpnet for redigering (w15g):** vinduet «Rediger arbeid» har feltene åpne og ingen ✎. Feltene er de
    samme som før w15g (F66). «Lagre endringer» med to rettede linjer gir merket «Korrigert av» på begge
    hos arbeideren. «Avbryt» gir ingen. Vinduet har linja som sier hva arbeideren ser.
34. **Byggeplassen står (F68, egen retting):** en ventende timerad og en maskinrad med byggeplass, og en
    rad i en annen jobb på samme dagsseddel. «Lagre endringer» med én rettet time. Alle radene har
    byggeplassen sin etterpå, og kort-id er uendret. Testen kjøres først mot dagens kode. Merget (develop
    `6ab36520`).
35. ⚠️ **Utgått i versjon 19 (§ 8.20).** Testet to utløsere for samme e-post.
36. ⚠️ **Utgått i versjon 19 (§ 8.20).** Testet nettet etter 24 timer.
37. **«Korrigert av» for sted (w15g):** etter et prosjektbytte på en reise i attesteringen har linja
    merket hos arbeideren, med prosjektet før og etter (F77). Etter et bytte av underprosjekt, på én rad
    og for hele jobben, har linjene merket med underprosjektet før og etter (F78). Testene feiler mot
    dagens kode.
38. ⚠️ **Utgått i versjon 19 (§ 8.20).** Testet at gamle rettinger ikke ga e-post.
39. **Første korrigering (w15g, F76):** en linje rettet 15:35 → 15:40 → 15:50 står hos arbeideren som
    15:35 → 15:50, med navnet og tidspunktet fra siste korrigering. En linje rettet fram og tilbake har
    ikke merke; er det dagens eneste, har dagen ikke merke i Mine timer. Attestantens «var …» er uendret.
40. **Merket står etter attestering (w15g):** en korrigert linje som så er attestert, har fortsatt merket
    hos arbeideren.

Testene for «Del opp» med begge kortene åpne (versjon 23) står i § 4.16 del G.
