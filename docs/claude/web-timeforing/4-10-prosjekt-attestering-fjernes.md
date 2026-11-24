> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.10. Seksjonsnumrene er de samme som før delingen.

### 4.10 «Attestering» under Prosjekt fjernes — hva som blir dødt (B29 B, versjon 9)

**Kenneth 2026-11-20:** B29 → B. *«fjern eventuell kode som nå er, eller skal bli død.»*

Lista er målt mot develop @ `a5483f48`. For hver post er kallere søkt i web, telefon, API med tester og
`packages/*`. `PA` = `apps/web/src/app/dashbord/[prosjektId]/timer/attestering`, `BU` =
`apps/web/src/components/attestering/attestering-buckets.tsx`.

**Rekkefølgen er ufravikelig.** Prosjektets side er i dag den eneste veien en prosjektleder har til
attesteringen. Den fjernes derfor **sist i w10 del B**, etter at firmaets side er åpnet for prosjektledere (§ 4.6)
og isolasjonstestene er flyttet og grønne. Fjernes den før, mister prosjektlederen attesteringen.

**A. Blir dødt — fjernes**

| # | Hva | Hvor | Kallere målt |
|---|---|---|---|
| **DK1** | Prosjektets attesteringsside | `PA/page.tsx` (123 linjer) | Eneste inngang er menypunktet (DK4) og omdirigeringen fra `godkjenning` (DK3). Ingen lenker fra Mine timer, dagssiden, rapporten, e-post, varsler eller telefonen. Fila blir en omdirigering (del C). |
| **DK2** | Prosjektets detaljside for én dag | `PA/[id]/page.tsx` (48 linjer) | Lenkes bare fra DK1 (`:120`). Fila blir en omdirigering (del C). |
| **DK3** | Den gamle omdirigeringen fra «godkjenning» | `apps/web/src/app/dashbord/[prosjektId]/timer/godkjenning/page.tsx:8` | Peker til DK1. Pekes rett til firmaets side, så ingen sendes to ganger. |
| **DK4** | Menypunktet «Attestering» under Prosjekt | `SE:180–187` (elementet), `:259–260` (adressen), `:48` (`MODUL_EIERSKAP`) | Margen, mobilmenyen, ⇄-paringen og søket får punktet fra samme liste (`NS:128`, `Toppbar.tsx:46–49`, `KontekstChip.tsx:107`, `hooks/useSokRegistry.ts:111–115`). De trenger ingen egen endring. |
| **DK5** | Feltet `kreverTimerLeder` og sjekken som bruker det | `SE:64`, `:319–322`, `:357–358` | Bare DK4 bruker feltet. |
| **DK6** | Spesialtilfellet for aktiv seksjon, og typen | `apps/web/src/hooks/useAktivSeksjon.ts:60–63`; `apps/web/src/kontekst/navigasjon-kontekst.tsx:27` | Slår bare til for DK4. Kommentaren i `KontekstChip.tsx:117–118` rettes. |
| **DK7** | Serverens liste for ett prosjekt, `hentTilAttestering` | `D:5765–5937` | Web: bare DK1 (`PA/page.tsx:29`). Telefonen: ingen. `packages/*`: ingen. Seks steder i web nullstiller bare hurtiglageret og må fjernes samtidig, ellers feiler typesjekken: `AD:92`, `:614`, `AttesteringDetalj_Edit.tsx:221`, `SplittRadModal.tsx:200`, `AT:232`, `RedigerRadModal.tsx:337`. API-testene står i del D. |
| **DK8** | Serverens flagg for ett prosjekt, `kanAttestere` | `D:5940–5944` | Web: DK1 (`:27`), DK2 (`:18`) og DK5 (`SE:319`). Telefonen: ingen (den bruker `kanAttestereFirma`). Én API-test (del D). |
| **DK9** | Hjelperne `krevProsjektLeder` og `erProsjektLeder` | `D:263`, `:246` | Bare DK7 og DK8 kaller dem. ⚠️ Regelen de bærer (aktivt medlem med admin eller «kan attestere», FA3) flyttes til den nye hjelperen for omfanget (§ 4.6 punkt 3) før de slettes. |
| **DK10** | Hjelperen `dagsnormerFor` | `D:1425` | Bare DK7 (`:5812`). ⚠️ Før sletting: bekreft at firmaets liste gir dagsnormen tabellen viser som merke. |
| **DK11** | Kodeblokkene i DK7 for navneskjul og for prosjekt og kort-id på utlegg | `D:5795–5806`, `:5814–5849`, `:5924–5928` | Bare i DK7. ⚠️ Innholdet flyttes til firmaets liste i del B (FA11). Hjelperen `navnSynlighet` (`D:371–384`) består; detaljkallet bruker den (`D:6421`). |
| **DK12** | i18n: `timer.attestering.beskrivelse` og `timer.attestering.prosjekt.hjelp.laast` | `nb.json:732`, `:5833`, og de 14 andre språkfilene | Bare DK1 (`PA/page.tsx:69`, `:73`). |
| **DK13** | «Én tabell pr. firma» på prosjektets side | `PA/page.tsx:35–42`, `:111–123` | Bare DK1. ⚠️ Se § 4.6 punkt 9: ingen som attesterer for flere firma, skal miste tilgang. |
| **DK14** | **Død i dag, før B29:** `ProsjektSectionAttest`, `EcoBucketAttest` og radkomponentene de alene bruker | `BU:580`, `:693`; `BU:136`, `:160`, `:335`, `:475` | Ingen kallere utenfor fila (søkt av Fabel). En test vokter at de ikke brukes (`attestering-tabell-modell.test.ts:313`). `radIKontekst` (`BU:32–40`) og typene i samme fil er i bruk og består. Koderen måler hver eksport før den slettes. |
| **DK15** | Docs som beskriver prosjektets side som noe som finnes | `hjelpetekster.md:378–384`, `:328`, `:338`; `timer.md:127`, `:750`, `:776`, `:819`, `:1073`, `:1078`; `web.md:56`; `api.md:40`; `arkitektur.md:388`; `redesign-paritetssjekkliste.md:109`, `:222`, `:225`; `prosjektkort-kortid-spec.md:2222`, `:2227` | Rettes i samme commit. `api.md:40` nevner også `hentTilGodkjenning` og `kanGodkjenne`, som ikke finnes i koden. De strykes. |

**B. Ser dødt ut, men består**

| Hva | Hvor | Hvorfor det består |
|---|---|---|
| `prosjektKontekst` i tabellen og detaljsiden, med «dagens Attester tar bare prosjektets del» | `AT:147–150`, `:193–194`, `:217`, `:459–480`, `:753`; `AD:51–58`, `:111`, `:483`, `:683–694`; `BU:32–40`; `AM:640–656` | Bare prosjektets side setter den i dag. **Del B gjør den til en mengde prosjekter** og bruker den for prosjektlederen på firmaets side (§ 4.6 punkt 3 og 4). Den slettes ikke. |
| Teksten «Attester prosjektets del» | `timer.attestering.tabell.attesterProsjektetsDel`, `nb.json:5831`; `AT:469` | Følger grenen over. Teksten må passe flere prosjekter; koderen foreslår ny ordlyd i løsningen før kode. |
| `navnSynlighet`, `prosjekterMedTilgang`, `attesteringsFirmaer`, `kanAttestereFravaer` | `D:371–384`, `:313`, `:279`, `:351–360` | Brukes av detaljkallet, handlingene og den nye hjelperen. |
| `nav.timerAttestering` | `nb.json:30` | Brukes av søket (`dype-sider.tsx:45`). |
| `timer.attestering.tittel`, `.ingenSedler`, `.ingenTilgang` og `timer.attestering.tabell.hjelp.*` | `nb.json:731–734` | Deles med firmaets side og telefonen. |
| Listenøkkelen `"timer-attestering"` for lagret kolonneoppsett | `AT:78` | Har samme navn som menypunktet, men er noe annet. B26 A gir den ny nøkkel i del A. |
| Retten prosjektlederen har på serveren, firmavalget for fravær (F1) og bryteren «kan attestere» på personkortet | `D:297–303`; `firma/innstillinger/page.tsx:997`; `oppsett/brukere/_components/PersonKort.tsx:136` | De er grunnlaget for omfanget i § 4.6. |

**C. Gamle adresser sender videre**

Mønsteret finnes: en `page.tsx` som bare kaller `redirect()` og står for eldre bokmerker
(`apps/web/src/app/dashbord/[prosjektId]/timer/[id]/page.tsx:8–10`; med id: `firma/malarkiv/[malId]/page.tsx:7–9`).

| Gammel adresse | Sender til |
|---|---|
| `/dashbord/[prosjektId]/timer/attestering` | Firmaets attestering (adressen del B velger, § 4.6 punkt 7) |
| `/dashbord/[prosjektId]/timer/attestering/[id]` | Firmaets detaljside for samme dag, med samme id |
| `/dashbord/[prosjektId]/timer/godkjenning` | Firmaets attestering, direkte |

- Prosjektet tas ikke med som filter. Det var alternativ A i B29, og Kenneth valgte B.
- `apps/web/src/hooks/__tests__/sok-dekning.test.ts:70–78` går gjennom alle sider og krever at hver enten er
  søkbar eller står i unntakslista. De to nye omdirigeringene føres i lista, og grunnen for `godkjenning` rettes.
  Ellers feiler testen.

**D. Tester — kravene flyttes, de slettes ikke**

Testene under kaller `hentTilAttestering` eller `kanAttestere`. De som er merket 🔴, bærer isolasjon mellom firma
og prosjekter. Kravet skrives om mot firmaets liste med prosjektleder-omfang, og skal være grønt **før** DK7 og
DK8 slettes. Ingen 🔴-test slettes uten at den nye er vist rød uten sperren.

| Test | Hva den bærer |
|---|---|
| 🔴 `apps/api/src/routes/timer/prosjektliste-isolasjon.test.ts` (hele fila, `:177–229`) | Firmagrensen (lederen i A ser ikke B sin sedel), R13 (rader på prosjekt uten tilgang røper ikke navn eller nummer), feltene tabellen trenger. |
| 🔴 `apps/api/src/routes/timer/attestering-navn-vedlegg.test.ts:196`, `:213`, `:219` | Samme navneskjul for underprosjekt og byggeplass i lista. Testene for detaljen (`:203`, `:229`, `:241–260`) står urørt. |
| 🔴 `apps/api/src/routes/timer/firmagrense-attestering.test.ts:197–200`, `:212–215`, `:306–309` | H1 (A-leder ser ikke B sin sedel), ansattnummer fra sedelens firma (M7). |
| 🔴 `apps/api/src/trpc/firmaadmin-eierfirma.test.ts:117–126` | Firmaadministrator i et deltakerfirma får ikke attesteringsrett. Flyttes til hjelperen for omfanget. |
| 🔴 `apps/api/src/routes/fravaer-uten-prosjekt.integration.test.ts:565–572` (TF5) | F1: fravær uten prosjekt i prosjektlederens kø, i begge stillinger av firmavalget. |
| `apps/api/src/routes/kortid-d2a.integration.test.ts:355`, `:393`, `:456`, `:477` | «Alle tre leserne gir samme kort-id» — blir to lesere, eller tre med prosjektleder-omfanget. |
| `apps/api/src/routes/fravaer-normtak.integration.test.ts:567` (TF18); `apps/api/src/routes/w7-egne-timer.integration.test.ts:381–387` | Normbruddet og «egne timer» vises i lista. Flyttes til firmaets liste. |
| 🔴 `apps/web/src/__tests__/attestering-tabell.test.tsx:300–325`, `:382–390`, `:781`, `:832` | T30/R13: tabellen er låst til prosjektet, dagens «Attester» tar bare prosjektets del, egen sedel er utenfor. Skrives om til en mengde prosjekter. |
| `apps/web/src/__tests__/attestering-tabell-modell.test.ts:127–132` | Et kort på et annet prosjekt kan ikke velges. Skrives om til en mengde. |

**Bakoverkompatibilitet:** telefonen kaller verken `hentTilAttestering` eller `kanAttestere` (søkt av Fabel i
`apps/mobile`). Ingen eldre app mister noe når de to kallene fjernes. Web og API deployes sammen.

**Ikke målt:** `ProsjektSectionAttest` og `EcoBucketAttest` er søkt, ikke bygget uten. Om firmaets liste i dag
har prosjekt på utleggsradene (DK11) er ikke lest til bunns. Linjene i del D er målt av leseagent; stikkprøvd er
alle kallene til `hentTilAttestering` og `kanAttestere`, `SE:178–188`, `:258–261`, `:317–323`, `:355–359`,
omdirigeringen i `godkjenning`, de tre i18n-nøklene, `sok-dekning.test.ts:70–78` og `dype-sider.tsx:43–50`.
