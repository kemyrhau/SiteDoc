> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.7. Seksjonsnumrene er de samme som før delingen.

### 4.7 Reise — hører til prosjektet (versjon 9)

**Kenneth 2026-11-19 (B24):** kortet rettes samlet — «… utlegg, tillegg og eventuelt reise».

**Kenneth 2026-11-20, uenig i versjon 8:** *«En reisekostnad knyttes til en kostnad for et prosjekt. Det er
reisekostnaden til/fra et prosjekt og bør knyttes til prosjektet kostnaden tilhører.»*

⚠️ **Versjon 10: Kenneth svarte B32 → B og B33 → A (§ 8.10).** Punkt 2–5 under er snudd: reisen ligger i
jobbens kort. Det som gjelder, står i **§ 4.11**. Punkt 1, 6, 7 og 9 står. FA16–FA33 er målingene, og de står.

⚠️ Versjon 8 sa «reise hører til dagen, ikke til en jobb». Det var bare halve bildet. Målingen under viser at
reiseraden alt bærer et prosjekt, og at kostnaden og attesteringsretten følger det. Det attesteringen mangler, er å
vise det. Målt mot develop @ `a5483f48`. `RK` = `apps/web/src/app/dashbord/timer/[id]/ReiseKort.tsx`.

| # | Målt | Hvor |
|---|---|---|
| **FA16** | Reisetid er en vanlig timerad merket `erReise`. **Den bærer alltid et prosjekt** — en rad uten prosjekt kan ikke være reise. Den bærer også byggeplass, valgfritt underprosjekt, retning (ut eller retur), oppmøtested, kjøretid, avstand og kilde. Den har aldri kort-id. | `ST:241–254`, `:286–307`, `:317–318`; `D:4026–4029`; `prosjektkort-kortid-spec.md` § 2.2 (B1 = A) og G8 (`:1346`); `apps/api/src/services/timer/kortId.ts:231–232`. Skjemaet og `D:4029` er lest av Fabel. |
| **FA17** | Grupperingen legger reise i en egen bøtte før kort-id leses. Reise kan ikke havne i en jobb. | `packages/shared/src/utils/kortGruppering.ts:123–126` |
| **FA18** | ⚠️ Rettet i versjon 9. Attesteringen lager **én reiseblokk pr. dag**, uansett prosjekt. Den blå raden får prosjektnummer, underprosjekt og byggeplass fra den første reiselinja. Den sier ikke «Reise»; teksten finnes (`timer.attestering.tabell.type.reise`), men brukes ikke i tabellen. En dag med reise på to prosjekter viser derfor bare det første prosjektet på den blå raden. | `AM:473–494`; `AT:581–600`, `:724–745`; `AM:126`. Lest av Fabel. |
| **FA19** | Reise teller ikke som arbeid i maskinregelen (w9), i normen eller i taket. | `packages/shared/src/utils/reiseSkille.ts:85–109`; `maskinKapasitet.ts:31–33` |
| **FA20** | **Hvem setter prosjektet på reisen:** PC: Reisevinduet: se [vedtak-timer-web.md § Reisevinduet](../vedtak-timer-web.md). På telefonen føres reise i dag-seksjonen og får prosjektet med flest arbeidstimer den dagen. GPS-forslaget gir ut- og returreisen samme prosjekt: dagens ene destinasjon. Ingen av stedene har prosjektvelger på reisen. Serveren har ingen regel for hvilket prosjekt reisen skal ha. | `RK:171–188`; `apps/mobile/src/components/timer-detalj/prosjektkort/DagSeksjon.tsx:80–96`; `M/utils/dagsforslag.ts:1168–1171` (lest av Fabel), `:1407–1408`, `:1953–1986` (leseagent); `D:4013–4042` |
| **FA21** | I kortet for reiseblokken kan lønnsarten byttes til en hvilken som helst lønnsart, også en arbeidsart. Motsatt kan en arbeidslinje i en jobb byttes til en reiseart. | `RP:225–233`. Hva serveren da gjør med raden, er lest (`D:3185–3200`, `:3286–3287`), ikke kjørt. |
| **FA28** | **Kostnaden følger radens prosjekt i dag.** Timerapporten summerer timer på radens prosjekt og skiller ikke ut reise. Detaljeksporten har én linje pr. reiserad med prosjekt, fra-sted, til-sted, km og minutter. | `apps/api/src/routes/timer/rapport.ts:298–323`, `:631–668`. Målt av leseagent; summeringen er stikkprøvd. |
| **FA29** | **Attesteringsretten følger radens prosjekt, også for reise.** Det finnes ingen særregel for `erReise`. Reisen attesteres altså av lederen for prosjektet reisen står på. | `D:506–544`, `:279–306`, `:6931–6946`. Målt av leseagent; `krevAttesteringsrett` er stikkprøvd tidligere. |
| **FA30** | I visningen «Etter prosjekt» står reisen alt under prosjektet sitt: hvert kort deles på radens prosjekt. | `AM:693–720`. Lest av Fabel. |
| **FA31** | Fra-sted og til-sted er ikke egne felt. De utledes ved visning av retningen, oppmøtestedet og byggeplassen. Ruta vises på reiselinja som merke. | `apps/web/src/components/attestering/ReiseRadMerke.tsx:42–90`; `rapport.ts:635–640`. Målt av leseagent. |
| **FA32** | **Reise mellom to prosjekter finnes ikke i koden.** Retningen er bare ut eller retur. Vedtaket finnes: en mellometappe i ordinær tid er arbeidstid og bæres av prosjektet man kommer til (V9, Kenneth 2026-10-01). Det er ikke bygget. | `packages/shared/src/utils/reise.ts:28–29`; `timer-gps-helhetsplan.md:147`, `:406`; `timer-gps-lag3-4-spec.md` § 4.3 og M6 (`:46`). Vedtaket er lest av Fabel. |
| **FA33** | Reise hjemmefra kompenseres ikke. Reisen regnes fra kontor eller oppmøtested til byggeplass, og mellom byggeplasser. | `fase-0-beslutninger.md:1054` (T.10) |

**Slik gjelder det:**

1. **Reisen hører til prosjektet den går til eller fra.** Kostnaden, rapporten og attesteringsretten følger
   prosjektet på raden (FA28, FA29). Det er slik i dag og endres ikke.
2. ⚠️ **Snudd av B32 B (§ 4.11).** ~~Reisen hører ikke til en jobb.~~ Den har ikke kort-id (B1 = A og G8, Kenneth 2026-11-16). Et prosjekt kan ha
   flere jobber samme dag, og reisen gjelder prosjektet, ikke én av dem. Om dette skal snus, er **B32**.
3. ⚠️ **Utgått (B32 B).** ~~Attesteringen viser én blå rad «Reise» for hvert prosjekt~~ (anbefalt svar på B32). Bygges ikke.
   - Raden sier «Reise» og viser prosjektnummeret, underprosjektet når reisen har ett, og sum reisetimer.
   - Den står rett over den første jobben på samme prosjekt. Har prosjektet ingen jobb den dagen, står den først
     på dagen.
   - En dag med reise på to prosjekter får to rader «Reise», én for hvert prosjekt (i dag én, FA18).
   - Raden har ✓, ↩, ↺ og avkrysning, som en jobbrad (B24 B, B30 A). Reiselinjene under har ingen knapper.
   - En prosjektleder attesterer reisen på prosjektene han leder. Reise på et annet prosjekt står nedtonet og uten
     knapper, som andre rader utenfor omfanget hans (§ 4.6).
4. ⚠️ **Utgått (B32 B).** Reisen er del 8 i jobbens kort (§ 4.11 del C). ~~Den blå raden åpner et eget kort for reisen:~~
   - Hodet viser prosjektet og byggeplassen.
   - Ruta står der «Hva gjorde du?» står i jobbens kort: retning, fra-sted → til-sted, km, minutter og kilde
     (FA31). Reise har ingen beskrivelse; telefonen skriver den aldri (`M/utils/dagsforslagAnvend.ts:284`).
   - Fra og til er felt, og timene regnes ut, som i jobbens kort.
   - Lønnsartvalget tilbyr bare reisearter (punkt 6).
   - Underprosjektet vises, men kan ikke byttes i kortet («flytt hele jobben» tar ikke reise, `D:704`).
   - Maskiner, varer, tillegg og «Del opp» hører ikke hjemme der.
5. ⚠️ **Utgått: w12 er bygget (`c19cad6c`), og reisen står i jobbens kort.** Sto slik: en dag med én jobb og reise har to blå rader under dagsraden. Da åpner dagsraden ingenting; jobbraden åpner
   jobben og reiseraden åpner reisen (`AT:687`, `:705–706`). Slik er det i dag.
6. **Lønnsartvalget i kortet holder reise og arbeid fra hverandre** (FA21). ⚠️ Versjon 10: regelen leser
   linja, ikke kortet — en reiselinje tilbyr bare reisearter, og en arbeidslinje tilbyr ikke reisearter. Det er samme regel som i føringen (V4 og B6 i
   kort-id-specen). 🟡 Ikke bygget; w10 del A punkt A1.
7. **Reise mellom to prosjekter** er vedtatt (V9, FA32): tiden er arbeidstid og bæres av prosjektet man kommer
   til. Når det bygges (timer-GPS lag 4), blir etappen en arbeidslinje i jobben på det prosjektet, ikke en
   reiserad. Til da lager systemet ingen slik rad selv. Fører arbeideren den for hånd, havner den på prosjektet
   han velger. **Krever ikke svar.**
8. **En dag med to prosjekter:** telefonen legger i dag både ut- og returreisen på ett prosjekt (FA20). Etter
   ordene dine hører utreisen til prosjektet du reiser til, og returen til prosjektet du reiser fra. Det er
   **B33**. Det gjelder føringen på telefonen, ikke attesteringen, og ligger utenfor w10. ✅ Besvart A
   (§ 8.10); spesifisert i § 4.11 del G.
9. **Kilometer og kjøregodtgjørelse er ikke reisetid.** De føres som lønnsart pr. km eller som utlegg, og følger
   jobben de er ført på. Målt av leseagent, ikke stikkprøvd.

**Hvis B32 besvares med B** (reisen inn i jobbens kort), må dette til — ✅ besvart B; spesifisert i § 4.11:
- Reise får kort-id. Det snur B1 = A, § 2.2 og G8 i kort-id-specen, og serveren som tømmer kort-id på reise
  (`kortId.ts:231–232`, `D:1058`).
- Reiseradene som finnes, må få kort-id. Det er en migrering med backfill, som Kenneth kjører.
- Telefonens dag-seksjon og GPS-forslaget må velge jobb, ikke bare prosjekt.
- Det må finnes en regel for hvilken jobb reisen havner i når prosjektet har flere jobber samme dag, og for en
  dag der prosjektet har reise, men ingen jobb.
- ✓ på jobben attesterer da også reisen.
