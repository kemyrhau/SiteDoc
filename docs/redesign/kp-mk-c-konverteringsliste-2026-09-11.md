---
tittel: MK C — konverteringslista for de 34 trafikklysene (fase 1: beslutningsgrunnlag)
status: 🟡 TIL FABEL-GATE
opprettet: 2026-09-11
forfatter: kontrollplan (MK C)
gjelder: packages/db/prisma/seed-bibliotek.ts
sist_verifisert_mot_kode: 2026-09-11
---

# MK C — konverteringslista for de 34 trafikklysene

**Fase 1 av 2. Dette dokumentet KONVERTERER IKKE — det er beslutningsgrunnlaget fabel
gater på.** Konverteringen er fase 2, egen ordre, etter gate.

Alle 34 trafikklys ligger i **én fil**: `packages/db/prisma/seed-bibliotek.ts`
(1 `trafikklys()`-definisjon `:115` + 34 kall). Ingen i `seed.ts` eller `kontrollplan.md`.

---

## 1. Kriteriet — sitert ordrett (fabels, ikke mitt)

Kilde: `docs/redesign/designnotat-grenseresolver-tillegg2-kravtype-maalingforst-fabel-2026-09-06.md:23-31`.

> Konverteringsgjennomgangen av de 34 trafikklysene (MK B+D, fabel-gatet liste) får et
> TRINN FØR list_single-spørsmålet:
>
> 1. **Kan utfallet MÅLES?** → `decimal`/`integer` med grense i klarspråk. Fargen beregnes;
>    tallet følger med i dokumentet og kan etterprøves av byggherren. («Komprimeringsgrad:
>    93 %, krav ≥ 95 %» slår «Er komprimeringen god nok?» — sannere dokumentasjon, og
>    avviksfeltet utløses automatisk ved brudd.)
> 2. Ellers: **kan utfallet navngis?** → `list_single` med informative valg (som før).
> 3. Ellers: trafikklyset består (ren skjønnsvurdering).

Operasjonalisering jeg har brukt, konsekvent på alle 34:

- **tall + grense** — kun når et *fysisk måltall* kan avleses og etterprøves (ikke et
  binært «utført/ikke»).
- **`list_single`** — når utfallet har *distinkte navngitte tilstander med ulik
  oppfølging* (f.eks. «overberg» vs «underberg»), altså der navngivning gir informasjon
  fargene ikke gir.
- **behold trafikklys** — ren skjønnsvurdering (visuell kvalitet), *eller* binært
  «utført/ikke / godkjent/ikke» der `list_single` bare ville gitt farge-synonymer.
  🟢 Fullgodt svar — «en konvertering uten målbart utfall gjør malen dårligere, ikke bedre».

---

## 2. Hovedfunn (les dette før tabellen)

🔴 **Trinn 1 (tall + grense) treffer 0 av de 34.**
Grunn: seedforfatteren har **allerede** trukket ut alt målbart i egne `desimal()`-felt
(fall %, lagtykkelse cm, komprimeringsgrad %, planhet mm, rystelse mm/s, ledningsfall ‰,
vertikalitet mm/m, stagkraft kN, setning mm osv.). De 34 gjenværende trafikklysene er
**verifikasjons-, godkjennings- og skjønnspunkter** — ikke skjulte målinger.

**Konsekvens for fabels estimat:** designnotatets antakelse om at «kriteriet flytter en
andel fra list_single til tall+grense» gjelder i praksis ikke for *denne* batchen — de
målbare feltene var aldri trafikklys. Bevegelsen her går trafikklys → `list_single`, ikke
trafikklys → tall.

### Fordeling

| Kategori | Antall |
|---|---|
| tall + grense (`integer`/`decimal`) | **0** |
| `list_single` | **8** |
| behold trafikklys | **26** |
| **Sum** | **34** |

`behold`-tallet fordeler seg på 12 rene skjønnsvurderinger + 13 binære «utført/godkjent» +
1 multi-tall-kvittering (`:353`, se kant 1).

---

## 3. De 34 radene (i malrekkefølge)

Forslag-koder: **T** = behold trafikklys · **L** = `list_single` · **G** = tall+grense.
Alle helpText er sitert ordrett; «—» = ingen helpText i seeden.

### NS 3420-K

#### KA7 – Gjenbruk av materialer

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| KA7 :166 | Dokumentasjon på opprinnelse | — | **L** | Distinkte tilstander med ulik oppfølging: foreligger / delvis (suppleres) / mangler. Opsjoner: `["Foreligger – komplett", "Delvis – suppleres", "Mangler"]` |
| KA7 :167 | Lagringsplass godkjent | — | **T** | Binær godkjenning/beslutning — `list_single` gir kun farge-synonymer |
| KA7 :168 | Materialer rengjort | — | **T** | Ren skjønnsvurdering av renhet |

#### KB2 – Jordarbeider

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| KB2 :200 | Leveringsdokument kontrollert | «Jord skal tilfredsstille Tabell K2 og Figur K3. Kontroller dokumentasjon fra leverandør.» | **L** | Dokumentkontroll med distinkte utfall. Opsjoner: `["Foreligger – iht. Tabell K2", "Foreligger – avvik", "Mangler"]` |
| KB2 :214 | Jord ikke komprimert | «KB2.2: Det er viktig at jorda kun pakkes lett og ikke påføres komprimeringsskader.» | **T** | Ren skjønnsvurdering (er jorda skadet av pakking?) — ikke måltall |
| KB2 :222 | Overflate jevn, fritt for ugras | «KB c1: Ferdig overflate skal ha jevne flater og skråninger. Dverganger mellom ulike flatetyper skal være jevne.» | **T** | Visuelt skjønn |

#### KB4 – Grasdekke

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| KB4 :237 | Jordlag løsgjort og finplanert | — | **T** | Skjønn på forbehandling |
| KB4 :240 | God kontakt frø/plen mot jord | — | **T** | Visuelt skjønn |
| KB4 :241 | Vannet etter legging/såing | — | **T** | Binært utført/ikke |
| KB4 :244 | Klippet jevnlig frem til overtakelse | «KB a1/c3: Prisen inkluderer skjøtsel frem til overtakelse.» | **T** | Binært utført/ikke (over tid) |

#### KB6 – Planting

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| KB6 :259 | Saftspente og fuktige ved ankomst | — | **L** | Distinkt mellomtilstand med egen handling (vannes vs returneres). Opsjoner: `["Saftspente og fuktige", "Noe tørre – vannes straks", "Uttørket – returneres"]` |
| KB6 :263 | Rothalsen over jordoverflate | «KB6.1 c1: Rothalsen skal ligge over jordoverflaten etter planting og setting av jord.» | **L** | Posisjon med distinkt utbedring. Opsjoner: `["Over jordoverflaten", "I nivå – akseptabelt", "Under – må heves"]`. (Terskel, ikke gradert måltall → ikke G) |
| KB6 :265 | God kontakt rot og jord | — | **T** | Visuelt skjønn |
| KB6 :266 | Rotbløyte utført | — | **T** | Binært utført/ikke |
| KB6 :267 | Plantefelt fritt for ugras | — | **T** | Visuelt skjønn |
| KB6 :268 | Oppbinding/støtte montert | «Ref. KC3.1 for krav til oppstøtting.» | **L** | «Ikke nødvendig» er en egen legitim tilstand fargene ikke skiller fra «montert». Opsjoner: `["Montert", "Ikke nødvendig for dette treet", "Mangler"]` |

#### KC3.1 – Oppstøtting av trær

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| KC3.1 :282 | Støtte plassert korrekt | — | **T** | Skjønn på plassering |
| KC3.1 :283 | Bindmateriale skadefritt for bark | «Bruk myk stropp eller gummibeskyttelse – aldri ståltråd direkte mot bark.» | **T** | Skjønn (skader bindingen barken?) |
| KC3.1 :285 | Kontrollert etter 1 sesong | — | **T** | Binært utført/ikke (oppfølgingssjekk) |

#### KD1 – Utendørsbelegg

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| KD1 :306 | Fuger – rette linjer/jevne kurver | «KD1 c5: Gjennomgående fuger skal danne rette linjer eller jevne kurver.» | **T** | Visuelt geometrisk skjønn (planhet/sprang måles allerede i egne desimalfelt :308/:310) |

### NS 3420-F

#### FB2 – Graving

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| FB2 :353 | Graveprofil kontrollert | «FB2 c1: Kontroller at tegning viser korrekt dybde, bredde og skråningsvinkel. Mål opp og merk med stikk.» | **T** | 🔴 **Multi-tall-kant (se § 4.1).** FØR-kvittering på at profilen er merket; selve profilavviket måles i `:383` desimal. Ikke 1:1 → beholdes som verifikasjon |
| FB2 :387 | Gravebunn godkjent for neste operasjon | «FB2 c5: Bunn skal godkjennes av ansvarlig før fundament, ledning eller fylling legges. Fotodokumenter.» | **T** | Godkjenning/hold-point (beslutning) |
| FB2 :389 | Grøft sikret | «Åpne grøfter skal sikres med sperring og skilting. Sikre mot overvann og ras ved nedbør.» | **T** | Skjønn/binært sikret |

#### FC1 – Sprengning

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| FC1 :410 | Rystelsesmåler plassert | «FC1 b2: Plasser rystelsesmåler på nærmeste bygning/konstruksjon. Dokumenter avstand og grenseverdi (typisk 20 mm/s bolig, NS 8141).» | **T** | Binært plassert/ikke; selve rystelsen måles i `:414` desimal |
| FC1 :426 | Rensk utført og dokumentert | «FC1 c3: All løs stein skal fjernes fra skjæring/tak/vegger. Rensk med maskin eller manuelt. Fotodokumenter resultat.» | **T** | Binært utført/ikke |

#### FD2 – Fylling og komprimering

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| FD2 :458 | Underlag klargjort | «FD2 b2: Underlag skal være fritt for snø, is, organisk materiale og stående vann. Overflate jevnet.» | **L** | Distinkte klargjøringstilstander med ulik utbedring. Opsjoner: `["Klargjort – rent og jevnet", "Krever rensk", "Stående vann – må dreneres"]` |

#### FE1 – Ledningsgrøfter

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| FE1 :496 | Eksisterende ledninger påvist | «FE1 b1: Bestill kabelpåvisning fra netteier. Merk i terreng med spray/stikk. Grav forsiktig innenfor 1 m fra påvist kabel.» | **L** | Sikkerhetskritisk stopp-punkt med distinkte utfall. Opsjoner: `["Påvist og merket", "Ingen kjente ledninger i området", "Ikke påvist – stopp graving"]` |
| FE1 :516 | Gjenfylling lagvis | «FE1 c3: Gjenfyll i lag à maks 30 cm. Ikke slipp stein direkte på rør. Bruk beskyttelsesmasse min. 15 cm over ledning.» | **T** | Skjønn på metodeetterlevelse |
| FE1 :527 | Innmåling utført | «FE1 c5: Innmål topp rør, bunn grøft og alle knekkpunkt. Lever innmålingsdata til ledningseier (SOSI/GML).» | **T** | Binært utført + levert |
| FE1 :529 | Varselbånd og merking | «FE1 c6: Legg varselbånd 30 cm over ledning. Farge: blå=vann, brun=spillvann, grønn=drenering, rød=el, gul=gass.» | **T** | Binært lagt/ikke |

#### FB4 – Spunting og avstiving

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| FB4 :550 | Nabokontroll utført | «FB4 b2: Tilstandsregistrering av bygninger og konstruksjoner innenfor influensområdet. Foto + rapport før oppstart.» | **T** | Binært utført/ikke |
| FB4 :575 | Spuntvegg stabil | «FB4 c5: Visuell kontroll av deformasjon, lekkasje og erosjon bak spunt. Fotodokumenter.» | **T** | Visuelt skjønn (avvik måles i egne desimalfelt :554/:564) |

#### FD3 – Grunnforsterkning

| Mal :linje | Label | helpText | Forslag | Begrunnelse |
|---|---|---|---|---|
| FD3 :595 | Grunnundersøkelse verifisert | «FD3 b2: Kontroller at geoteknisk rapport dekker aktuelt område. Sjekk at antatt jordart og lagfølge stemmer med observert.» | **L** | Distinkte verifikasjonsutfall med ulik oppfølging. Opsjoner: `["Dekker området – stemmer med observert", "Avvik i jordart – avklar med geotekniker", "Rapport mangler for området"]` |
| FD3 :619 | Bæreevne dokumentert | «FD3 c5: Geotekniker har signert at bæreevne er tilstrekkelig for planlagt konstruksjon.» | **T** | Binært signert/ikke (dokumentasjonspunkt) |

**De 8 `list_single`-forslagene:** `:166, :200, :259, :263, :268, :458, :496, :595`.

---

## 4. De fire kantene — min vurdering

### 4.1 Multi-tall (`:353` «Graveprofil kontrollert»)

🔴 Feltet dekker dybde, bredde OG skråningsvinkel — **én-til-flere, ikke 1:1.**
Min vurdering: **behold trafikklys.** To grunner:

1. `:353` er en **FØR-kvittering** på at profilen er tegnet/merket korrekt. Det faktiske
   profilavviket måles allerede **UNDER** i `:383 «Avvik fra prosjektert profil (mm)»`
   (desimal). Å splitte `:353` i tre tallfelt+grense ville *duplisere* :383 og tredoble
   feltantallet.
2. Skulle man likevel tallfeste FØR-kontrollen, blir det tre felt (dybde/bredde/vinkel)
   med hver sin grense — **koster mer enn det ser ut til**, og det målbare utfallet finnes
   allerede nedstrøms. Anbefaling: ikke konverter.

### 4.2 `integer` finnes ikke i seedens union

`FeltDef` (`seed-bibliotek.ts:101`) tillater kun
`traffic_light | decimal | list_single | heading`.
🟢 **Godt nytt: jeg foreslår 0 heltallsfelt** (og 0 tall+grense i det hele tatt). Unionen
trenger derfor **ikke** utvides for denne batchen. Kravet melder seg først når/hvis fase 2
tar inn måltallsfelt fra andre kilder — da må `integer` legges til (egen, additiv endring).
Jeg gjør ingen endring nå.

### 4.3 Grense støttes kun av `integer`/`decimal`

Bekreftet: `FeltKonfigurasjon.tsx:153-154` rendrer `GrenseKonfig` bare for de to typene.
🟢 Siden jeg foreslår 0 tall+grense i denne batchen, trengs **ingen grense-config** her.
Masterplanens påstand står.

### 4.4 Rekkefølge ved betinget grense (Vei B)

Regelen: styrende `list_single` må ha **samme `parentId` og lavere `sortOrder`** enn
grensefeltet (`FeltKonfigurasjon.tsx:539-542`).
🟢 **Ingen av mine 8 `list_single`-forslag er styrende for et nedstrøms grensefelt** — jeg
foreslår ingen betingede grenser (Vei B) i denne batchen. Rekkefølge-regelen binder derfor
ingen av forslagene, og det oppstår ingen `sortOrder`-konflikt. Punktet er ikke-utløst her.

---

## 5. Prod-spørring (Kenneth kjører før fase 2 bestilles)

🔴 Prod-gaten er lest i **kode** (`seed-bibliotek.ts:628-637`: `erProd && !verifisert →
continue`), **ikke** verifisert mot prod-DB. Kjør denne mot **prod-DB `sitedoc`** (ikke
`sitedoc_test`):

```sql
SELECT referanse, verifisert, opprettet
FROM bibliotek_maler
WHERE referanse IN
  ('KA7','KB2','KB4','KB6','KC3.1','KD1','FB2','FC1','FD2','FE1','FB4','FD3')
ORDER BY referanse;
```

**Forventet i prod: 0 rader** (prod-gaten hopper over uverifiserte maler).

- 0 rader → antakelsen holder: seed-endringen i fase 2 treffer kun test/lokal, og
  eksisterende prosjektmaler (frosne snapshots, `firmamal.ts:106/:330`) berøres uansett
  ikke. Trygt å bestille fase 2.
- ≥1 rad → prod-gaten har ikke holdt (f.eks. tidligere manuell verifisering). **STOPP** og
  meld til fabel før fase 2 — da kan konverteringen treffe prod-innhold.

Ekstra kontrollspørring (bør også gi 0 i prod) — teller alle uverifiserte bibliotekmaler:

```sql
SELECT count(*) FROM bibliotek_maler WHERE verifisert = false;
```

---

## 6. Hva jeg IKKE fikk målt

- **Prod-DB.** Prod-gaten er kun lest i kode. Spørringen i § 5 må kjøres av Kenneth.
- **NS 3420-normens faktiske tallkrav.** Jeg klassifiserte mot seedens `label` + `helpText`,
  ikke mot fulltekst-normen. Har et «skjønns»-felt (f.eks. `:263` rothalse-posisjon) et
  eksplisitt talltoleranse-krav i NS 3420, kan det flyttes fra T/L til G. Fagkontrollen i
  fase 2 bør bekrefte at ingen av de 26 T-feltene skjuler et normfestet måltall.
- **UI-/PDF-rendering.** Jeg har ikke kjørt web/mobil/arkiv-PDF for å se `list_single` vs
  trafikklys visuelt — utenfor denne rene analyse-ordren (ingen flate berøres, jf.
  paritetsmatrisen).
- **Resolver-lesernes seks kallsteder.** Stoler på coworks måling
  (`FeltKonfigurasjon.tsx:432-585` + `grenseSjekk.ts`); ikke re-verifisert linje for linje,
  da denne batchen ikke rører resolveren (0 grensefelt foreslått).
