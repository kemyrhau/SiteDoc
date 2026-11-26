> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.6. Seksjonsnumrene er de samme som før delingen.

### 4.6 Én attestering på firmanivå — også for prosjektledere (versjon 8)

**Kenneth 2026-11-19:** *«hvordan er det for prosjektleder for 4 prosjekter -> må han bytte prosjekt for å attestere
andre prosjekter enn der han er innlogget? Hvis svaret er ja -> bør attestering flyttes til firmaattestering der
prosjektleder får opp sine ansatte i sine prosjekter.»*

**Svaret er ja.** En prosjektleder for fire prosjekter må i dag åpne fire sider. Firmaets side er stengt for ham.
Denne delen sier hvordan firmaets side åpnes for prosjektledere. Den erstatter w10 punkt 3 fra versjon 7 (uke, år
og faner på prosjektets side), som ikke bygges.

Målt mot develop @ `57770fc0`. `TK` = `apps/api/src/trpc/tilgangskontroll.ts`, `NS` =
`apps/web/src/components/layout/NavSidebar.tsx`, `SE` = `apps/web/src/components/layout/sidebar-elementer.tsx`, `FN` =
`apps/web/src/components/layout/firma-nav.tsx`.

| # | Målt | Hvor |
|---|---|---|
| **FA1** | Prosjektets liste tar ett prosjekt. Den henter bare sedler som venter, uten periode. | `D:5765–5778` |
| **FA2** | Firmaets liste krever firmaadministrator (eller sitedoc_admin). Den henter firmaets egne sedler, med periode og status. | `D:5954–6021`; `TK:910–931` |
| **FA3** | «Prosjektleder» er ingen rolle. Det er et aktivt prosjektmedlem med rollen admin eller med «kan attestere». Retten gjelder bare timer fra firma der han selv er aktiv ansatt (H1). | `D:246–261`, `:279–306` |
| **FA4** | Ingen funksjon gir «alle prosjekter brukeren kan attestere på». Alle hjelperne tar ett prosjekt om gangen. | `D:246`, `:279`, `:5940–5944` |
| **FA5** | Handlingene krever ikke firmaadministrator. De sjekker retten pr. rad: `attesterRader` (`D:6946`), `returnerRader` (`:7137`), `gjenaapneRader` (`:7500`), `gjenaapneAttestering` (`:7240–7247`), `attester` (`:8143`), `returner` (`:8287–8294`), `rettRadFelt` (`:7370`), `redigerSedelRader` (`:2963`), `splittRad` (`:7612`), `delJobb` (`:6711`) og `flyttTimerRadEco` (`:6581`). Alle har også sperren for egne timer (w7). | Målt av leseagent; `krevAttesteringsrett` (`D:506–544`) er stikkprøvd. |
| **FA6** | Bare to kall er stengt for prosjektlederen: lista `hentTilAttesteringFirma` (`D:5979`) og flagget `kanAttestereFirma` (`D:6257–6266`). Flagget styrer firmaets side (`FS:188`), firmaets detaljside (`firma/timer/attestering/[id]/page.tsx:39`, `AD:81`) og telefonens attestering (`apps/mobile/app/timer/attestering/index.tsx:74`, `mer.tsx:75`). | |
| **FA7** | Firmaets side ligger bak to rammer for firmaadministrator: `apps/web/src/app/dashbord/firma/layout.tsx:23`, og fanene i `firma/timer/layout.tsx:26–36`. | |
| **FA8** | «Attestering» står ikke i venstremargen under Firma. Den er en fane på Firma › Timer. Firma-sonen i margen er tom for den som ikke er firmaadministrator (`FN:82`); bare Maskin vises uten adminrolle (`NS:131`, `:139–141`). | |
| **FA9** | Prosjektets side låser tabellen til ett prosjekt (`prosjektKontekst`). Dagens «Attester» tar da bare linjene på prosjektet, og linjer på andre prosjekter står nedtonet uten knapper. Navnet på et annet prosjekt vises bare når brukeren har tilgang til det (R13). Siden tegner én tabell pr. firma. | `AT:459–480`, `:790`, `:878`; `D:5827–5849`; `PS:35–43` |
| **FA10** | Firmaets side har visningene Sedler, Etter prosjekt og Etter ansatt, og husker visning, uke og fane i adressen. Filtrene i tabellhodet (blant dem pr.nr. og ansatt) ligger ikke i adressen. | `FS:156–179`; `AT:168`, `:757–760` |
| **FA11** | De to listene svarer ulikt. Bare firmalista har ukenorm, overtidsgrunnlag og reisetimer (`D:6233–6246`). Bare prosjektlista skjuler navn og har prosjekt og kort-id på utlegg (`D:5795–5806`, `:5924–5928`). | Målt av leseagent. |
| **FA12** | Ukeavviket regnes i nettleseren av sedlene lista ga. | `FS:224–252` |
| **FA13** | Firmaets innstillinger leses med krav om firmaadministrator (`apps/api/src/routes/organisasjon.ts:1152–1155`, `:47–54`). Tabellen og «Rediger»-vinduet leser tidsrundingen derfra (`AT:227`, `RedigerRadModal.tsx:137`). En prosjektleder får derfor ikke firmaets tidsrunding i dag. Lest, ikke kjørt. | |
| **FA14** | En ansatt uten adminrolle får firmaet sitt valgt automatisk når han er medlem av ett firma. Er han medlem av flere, er ingen firma valgt, og han kan ikke bytte. | `apps/web/src/kontekst/firma-kontekst.tsx:76–88` |
| **FA15** | Telefonen har attestering bare for firmaadministrator, på tvers av prosjekter, med de samme to kallene som i FA6. | `apps/mobile/app/timer/attestering/index.tsx:74–83` |

**Slik skal det være:**

1. **Én side.** Firmaets attestering er stedet der timer attesteres. Alle som kan attestere, bruker den samme
   siden med de samme verktøyene: uke, år, «Denne uka», fanene «Venter» og «Attestert», visningene Sedler, Etter
   prosjekt og Etter ansatt, og «Velg parameter».
2. **Hvem ser hva:**

   | Hvem | Ser | Kan attestere |
   |---|---|---|
   | Firmaadministrator og sitedoc_admin | Alle firmaets sedler i uka, som i dag. | Alt, som i dag. |
   | Prosjektleder (FA3) som er aktiv ansatt i firmaet | Sedlene i firmaet som har minst én rad på et prosjekt han leder. | Radene på prosjektene han leder. Rader på andre prosjekter på de samme sedlene står nedtonet og uten knapper, og prosjektnavnet vises bare når han har tilgang til prosjektet (R13, som på prosjektets side i dag). |
   | Alle andre | Ingenting. Menypunktet vises ikke. | — |

   Fravær uten prosjekt følger F1 som i dag (`D:329–362`): prosjektlederen kan attestere det bare når firmaet har
   slått på valget, og bare på en sedel som har en rad på et av prosjektene hans. En sedel med bare fravær ser han
   ikke. Egne timer følger w7 som i dag.
3. **Firma-grensen håndheves på serveren, på ett sted.** En ny hjelper gir omfanget for (bruker, firma): *alle*,
   eller en liste med prosjekter. Lista er prosjektene der brukeren er aktivt medlem med admin eller «kan
   attestere», firmaet deltar i prosjektet, og brukeren er aktiv ansatt i firmaet. Tom liste betyr ingen tilgang.
   - Hjelperen skal gi samme svar som `attesteringsFirmaer` gir pr. prosjekt (`D:279–306`). En test sammenlikner
     de to for hver rad lista returnerer, så listen og handlingene aldri kan være uenige.
   - `hentTilAttesteringFirma` bruker hjelperen i stedet for `autoriserAdminForFirma`. Med omfang *alle* svarer
     den som i dag. Med en prosjektliste henter den firmaets sedler med rad på et av prosjektene, uten grenen for
     sedler med bare fravær, og med navneskjulet prosjektlista har i dag (`navnSynlighet`, `D:371–384`).
   - Svaret sier hvilke prosjekter som er brukerens. Tabellens `prosjektKontekst` blir en mengde prosjekter i
     stedet for ett.
   - `kanAttestereFirma` beholder betydningen av `kanAttestere` (firmaadministrator). Omfanget kommer i et nytt
     felt. Telefonen og eldre apper leser det gamle feltet og oppfører seg som før (FA15).
4. **Handlingene endres ikke på serveren** (FA5). I tabellen tar dagens «Attester», ↩ og «Gjenåpne» for en
   prosjektleder bare radene på prosjektene hans, slik prosjektets side gjør i dag (`AT:459–480`). Kallene for
   hele sedelen brukes bare med omfang *alle*.
5. **Ukeavvik og ukeoversikt vises ikke for prosjektlederen i w10.** De regnes av sedlene lista ga (FA12).
   Prosjektlederen får ikke den ansattes sedler fra andre prosjekter, så summen for uka ville blitt for lav og
   merket feil. Prosjektets side har dem ikke i dag, så ingenting forsvinner. Om prosjektlederen skal se den
   ansattes hele uke, er et eget spørsmål som ikke stilles nå.
6. **Menyen.** Firma-sonen i venstremargen får punktet **«Attestering»**. Det vises for firmaadministrator og for
   prosjektleder med omfang, når firmaet har timer-modulen. For en prosjektleder uten adminrolle er det eneste
   punkt i Firma-sonen (sammen med Maskin når firmaet har den modulen). Fanen «Attestering» på Firma › Timer står
   for firmaadministrator. Søket (`dype-sider.tsx:43–50`) følger samme vilkår som menypunktet. Menypunktet
   «Attestering» under Prosjekt fjernes (B29 B), så navnet står bare ett sted i margen.
7. **Prosjektlederen slipper bare inn på attesteringen.** Siden ligger bak firmaadministrator-rammen (FA7).
   Kravet er at ingen annen firmaside åpnes for ham, og at han ikke ser fanene Oppsett, Lønnsarter, Aktiviteter,
   Tillegg og Utleggskategorier. Koderen foreslår hvordan i løsningen før kode. Anbefalt: attesteringen får en
   rute utenfor firmaadministrator-rammen, så sperren i `firma/layout.tsx` står urørt, og den gamle adressen
   sender videre. Detaljsiden for én dag følger med (FA6).
8. **Prosjektets side fjernes** (B29 → B, § 8.9). Den, detaljsiden, menypunktet og serverens kall for ett
   prosjekt tas ut, og gamle adresser sender videre til firmaets side. Lista over hva som blir dødt, hva som
   består, og testene som må flyttes, står i § 4.10. Fjerningen gjøres sist i del B, når prosjektlederen har
   firmaets side.
9. **Den som attesterer for flere firma,** ser ett firma om gangen. Er han ikke firmaadministrator, kan han i dag
   ikke velge firma (FA14). Prosjektets side viser i dag én tabell pr. firma (FA9). Kravet er at ingen mister
   tilgang: koderen måler om tilfellet finnes i testdata, og foreslår velger eller én tabell pr. firma.
10. **Firmaets tidsrunding** skal gjelde også når en prosjektleder retter fra–til (FA13). Lista sender den med,
    slik den alt sender «rediger ved attestering» (`redigerTillatt`).
11. **Telefonen røres ikke.** Der er attesteringen fortsatt bare for firmaadministrator. Om prosjektlederen skal
    attestere på telefonen, er ikke en del av w10 (attestering i volum hører på PC, `ordre-og-agent.md` § 5 PARITET).

**Tester som må til** (attestering er lønn; regel 10 kjøres uavhengig):
- Prosjektlederen får ikke en sedel uten rad på prosjektene sine.
- Han får ikke et annet firmas sedler på eget prosjekt (H1), og ingenting fra et firma der han ikke er aktiv ansatt.
- En rad på et prosjekt han ikke leder, kommer uten navn når han ikke har tilgang, og kan ikke attesteres
  (serveren avviser).
- Fravær uten prosjekt følger F1 i begge stillinger av firmavalget.
- Firmaadministrator får nøyaktig samme svar som før endringen.
- Omfanget er likt `attesteringsFirmaer` pr. prosjekt.
- `kanAttestereFirma.kanAttestere` er usann for prosjektlederen (telefonen).
