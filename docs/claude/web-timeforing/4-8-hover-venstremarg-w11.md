> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.8. Seksjonsnumrene er de samme som før delingen.

### 4.8 Hover-forklaring på menypunktene i venstremargen (versjon 8, w11)

**Hjemmel: Kenneth 2026-11-19** (§ 8.8). Alle menypunktene i venstremargen skal ha en kort forklaring av hva siden
gjør og hvem den er for, særlig der samme navn står både under Prosjekt og Firma.

Målt mot develop @ `57770fc0`:

| # | Målt | Hvor |
|---|---|---|
| **FA22** | Det finnes én venstremarg. Flagget for ny navigasjon er fjernet. Menyen har tre deler: Prosjekt, Firma og «Innstillinger» nederst. | `apps/web/src/app/dashbord/layout.tsx:52`; `NS:249–301` |
| **FA23** | Menypunktene er data, ikke hardkodet: `SidebarElement` (`SE:54–65`, lista `:67–239`) og `FirmaNavElement` (`FN:33–40`, lista `:42–65`). «Innstillinger» er hardkodet (`NS:287–300`). De samme listene brukes av søket og av mobilmenyen (`Toppbar.tsx:46–56`). | Målt av leseagent; `FN:33–65` og `SE:166–190` er stikkprøvd. |
| **FA24** | I full bredde har menypunktene ingen hover-tekst. I smal bredde vises bare ikonet, med navnet som nettleserens `title` (`NS:166`, `:201`, `:290`). | Målt av leseagent. |
| **FA25** | `Tooltip` i `packages/ui/src/tooltip.tsx` har tittel og tekst over flere linjer, forsinkelse, og vises ved tastaturfokus og ved trykk på berøringsskjerm. Den brukes alt i attesteringen (`AT:1059`). | Målt av leseagent. |
| **FA26** | Samme navn står to steder i dag: **Timer** (`nav.timer` under Prosjekt, `firmaNav.timer` under Firma) og **HMS** (`nav.hms`, `firmaNav.hms`). **Attestering** står bare under Prosjekt i margen; under Firma er den en fane (FA8). Med § 4.6 punkt 6 og B29 B (§ 8.9) står den bare under Firma. | `SE:173–187`; `FN:49`, `:58` |
| **FA27** | Bare 8 av sidene har ?-hjelp. To menypunkter heter noe annet enn siden de åpner: «Fakturering» åpner «Lagring», og «Firmaprofil» åpner «Innstillinger» (hardkodet). | Målt av leseagent, ikke stikkprøvd. |

**Regelen for teksten** (føres inn i `tooltip-hjelpetekst-veileder.md` av ordren som bygger den):
- Første setning sier hva siden gjør. Andre setning sier hvem den er for, når det ikke er alle på prosjektet.
- Høyst to korte setninger. Navnet på menypunktet gjentas ikke.
- Står samme navn to steder, sier teksten hva som skiller dem, og peker til det andre stedet.
- «pr.» bare i sats og enhet; ellers «etter» og «for hvert» (veilederen § 5).

**Hvor i koden:**
- Nytt valgfritt felt `hjelpNokkel` ved siden av `labelKey` i `SidebarElement` (`SE:56`) og `FirmaNavElement`
  (`FN:34`).
- Nøklene heter `nav.hjelp.<navn>` og `firmaNav.hjelp.<navn>`, med samme `<navn>` som i `labelKey`. De legges i
  `nb.json` og `en.json` og genereres til de andre språkene med `--only`.
- Raden pakkes i `Tooltip` der den tegnes: `renderRad` (`NS:155–178`), `renderFirmaRad` (`NS:194–211`) og
  «Innstillinger» (`NS:287–300`). Tooltipen står til høyre for menyen. I full bredde viser den teksten. I smal
  bredde viser den navnet som tittel og teksten under, og erstatter `title` (veilederen § 2: `title` skal ut).
- Mobilmenyen (`Toppbar.tsx:259–306`) får ikke hover: et trykk der åpner siden. ❌ med grunn: berøringsskjerm.
- Telefon-appen har egen meny og er ikke med.

**Tekstene.** De to første tabellene er punktene med samme navn to steder. «Kilde» er det teksten bygger på.

| Menypunkt | Nøkkel | Tekst | Kilde |
|---|---|---|---|
| Prosjekt › **Timer** | `nav.hjelp.timer` | Dine egne timer på dette prosjektet. Her registrerer du timer og ser dagene dine. | `[prosjektId]/timer/page.tsx:103–110`; alle prosjektmedlemmer når modulen er på (`SE:173–179`) |
| Firma › **Timer** | `firmaNav.hjelp.timer` | Oppsett for timeføringen i hele firmaet: lønnsarter, aktiviteter og tillegg. For firmaadministrator. Egne timer fører du under Prosjekt › Timer. | `firma/timer/layout.tsx:26–36`, `:83`; `FN:58`, `:82` |
| ~~Prosjekt › **Attestering**~~ | — | ⚠️ Utgår (B29 B, § 8.9): menypunktet fjernes, så det får ingen tekst. Nøkkelen `nav.hjelp.timerAttestering` lages ikke. | § 4.10 |
| Firma › **Attestering** (nytt, § 4.6) | `firmaNav.hjelp.attestering` | Attester timer for alle prosjektene du leder, uke for uke. Firmaadministrator ser hele firmaet. | § 4.6 punkt 2 og 6. Etter B29 B er dette det eneste stedet timer attesteres på PC. |
| Prosjekt › **HMS** | `nav.hjelp.hms` | Meld avvik, SJA og RUH på dette prosjektet, og se det som er meldt. | `[prosjektId]/hms/page.tsx:360–434` |
| Firma › **HMS** | `firmaNav.hjelp.hms` | HMS samlet for alle firmaets prosjekter. For firmaadministrator og HMS-ansvarlig. | `firma/hms/page.tsx:145–148`, `:176–177` |

Resten av Prosjekt-sonen:

| Menypunkt | Nøkkel | Tekst | Kilde |
|---|---|---|---|
| Dashbord | `nav.hjelp.dashbord` | Oversikt over det valgte prosjektet: faggrupper, maler og medlemmer. | `[prosjektId]/page.tsx:218–294` |
| Sjekklister | `nav.hjelp.sjekklister` | Prosjektets sjekklister. Opprett, fyll ut og følg opp. | `sjekklister/page.tsx:430–436` |
| Oppgaver | `nav.hjelp.oppgaver` | Prosjektets oppgaver. Opprett, svar og følg opp. | `oppgaver/page.tsx:325–333` |
| Tegninger | `nav.hjelp.tegninger` | Åpne tegningene, mål på dem, og lag oppgaver og kontrollpunkter rett på tegningen. | `tegninger/page.tsx` |
| 3D | `nav.hjelp.3d` | Prosjektets IFC-modeller i 3D. Klikk på et objekt for å se egenskapene. | `3d-visning/page.tsx:297–298` (sidens egen hjelp) |
| Tegning+3D | `nav.hjelp.tegning3d` | Tegning og 3D-modell side om side. | `tegning-3d/page.tsx` |
| Bilder | `nav.hjelp.bilder` | Prosjektets bilder, plassert på kart og tegning. | `bilder/page.tsx:1097–1136` |
| Mapper | `nav.hjelp.mapper` | Prosjektets dokumenter i mapper. Last opp og last ned. | `mapper/page.tsx:468–493` |
| Kontrollplan | `nav.hjelp.kontrollplan` | Kobler sjekklister til områder, frister og ansvarlig faggruppe, og viser fremdriften. | `kontrollplan/page.tsx:263–265` (sidens egen hjelp) |
| Økonomi | `nav.hjelp.okonomi` | Kontrakter, mengder og notaer for prosjektet. | `okonomi/page.tsx:91–209` |
| Dokumentsøk | `nav.hjelp.sok` | Søk i prosjektets dokumenter, med ord eller med AI. | `sok/page.tsx:15–57` |
| PSI | `nav.hjelp.psi` | Hvem som har signert prosjektets sikkerhetsinstruks. | `psi/page.tsx:95–103` |
| Mannskap | `nav.hjelp.mannskap` | Hvem som er på byggeplassen nå. | `mannskap/page.tsx:88–93` |
| Vareforbruk | `nav.hjelp.vareforbruk` | Varer brukt på dette prosjektet. Registrer og rett. | `vareforbruk/page.tsx:109–267` |
| Papirkurv | `nav.hjelp.papirkurv` | Slettede sjekklister og oppgaver. De kan gjenopprettes i 90 dager. | `papirkurv/page.tsx:176` |
| Kontakter | `nav.hjelp.kontakter` | Personene på prosjektet, gruppert etter faggruppe. | `kontakter/page.tsx:146` |

Resten av Firma-sonen (alle er for firmaadministrator unntatt Maskin; teksten sier det bare der det skiller):

| Menypunkt | Nøkkel | Tekst | Kilde |
|---|---|---|---|
| Oversikt | `firmaNav.hjelp.oversikt` | Nøkkeltall og firmainformasjon. For firmaadministrator. | `firma/page.tsx:62` |
| Prosjekter | `firmaNav.hjelp.prosjekter` | Alle firmaets prosjekter. Her opprettes nye. | `firma/prosjekter/page.tsx:64–141` |
| Ansatte | `firmaNav.hjelp.ansatte` | Firmaets ansatte og tilgangene deres. Inviter og deaktiver. | `firma/ansatte/page.tsx:83–96` |
| Avdelinger | `firmaNav.hjelp.avdelinger` | Firmaets avdelinger. Brukes i ansattlister, eksport og maskinansvar. | `firma/avdelinger/page.tsx:69` |
| Oppmøtesteder | `firmaNav.hjelp.oppmotesteder` | Faste kontorer og verksteder med GPS-radius. Brukes til å kjenne igjen hvor dagen starter. | `firma/oppmotesteder/page.tsx:59–103` |
| Kompetanse | `firmaNav.hjelp.kompetanse` | Sertifikater, kurs og opplæring for hver ansatt. | `firma/kompetanse/page.tsx:94` |
| Moduler | `firmaNav.hjelp.moduler` | Slå firmamoduler av og på. Gjelder alle firmaets prosjekter. | `firma/moduler/page.tsx:140` |
| Malforvaltning | `firmaNav.hjelp.malforvaltning` | Firmaets maler og SiteDocs maler: hva de bygger på, og hva som endres når du redigerer. | `malforvaltning/page.tsx:63` |
| Timer-rapport | `firmaNav.hjelp.timerRapport` | Timer i firmaet etter ansatt, prosjekt og periode. Eksporter til Excel, CSV eller PDF. | `firma/timer/rapport/page.tsx:773–784` |
| Kalender | `firmaNav.hjelp.kalender` | Helligdager, fellesferie og halvdager for firmaet. | `firma/kalender/page.tsx:154` |
| Varelager | `firmaNav.hjelp.varelager` | Firmaets varer og varekategorier. | `firma/varelager/page.tsx:73–83` |
| Fakturering | `firmaNav.hjelp.fakturering` | Lagringsplassen firmaets filer bruker, for hvert prosjekt. Bare for SiteDoc-administrator. | `firma/fakturering/page.tsx:30–32`; `FN:62` |
| Firmaprofil | `firmaNav.hjelp.innstillinger` | Firmainformasjon, arbeidstid, reise og standardtilganger. | `firma/innstillinger/page.tsx:285–349` |
| Integrasjoner | `firmaNav.hjelp.integrasjoner` | Koblinger til eksterne tjenester for firmaet. | `firma/innstillinger/integrasjoner/page.tsx:37` |
| Maskin | `nav.hjelp.maskin` | Firmaets maskiner og utstyr. For alle i firmaet; firmaadministrator legger til. | `maskin/page.tsx:122–259`; `NS:139–141` |
| Innstillinger (nederst) | `nav.hjelp.innstillinger` | Alle innstillinger for firma og prosjekt på ett sted. Du ser bare det du har tilgang til. | `innstillinger/page.tsx:115–120` |

Tekstene for Timer, Attestering og HMS bygger på sider og sperrer som er lest. De andre bygger på leseagentens
gjennomgang av hver side (overskrift, beskrivelse og hva siden lar deg gjøre) og er ikke stikkprøvd. Koderen holder
hver tekst mot siden før nøkkelen legges inn, og melder avvik i stedet for å skrive om.
