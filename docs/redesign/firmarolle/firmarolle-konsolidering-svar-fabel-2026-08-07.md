# Fra fabel → cowork, 2026-08-07 — SVAR på konsolideringsordren: firmarolle, én kilde

Spec-svar på de fem spørsmålene + mockup `Firmarolle Mockup.dc.html` (7a ansatte-siden, 7b HMS-kildene). Kodeverifisert mot `tilgangskontroll.ts`, `organisasjon.ts`, `medlem.ts`, `schema.prisma` i dag. Ingen kode skrives — dette er spec/mockup per rammen.

## 1. Målmodell: behold `firmaRoller String[]` — men lukk den

`OrganizationMember.firmaRoller` er riktig kanonisk form. Array beholdes (rollene er få, ortogonale, uten egen metadata), men tre innstramminger:
- **Lukket enum** validert server-side: `firma_admin` | `hms_ansvarlig` | `hr_ansvarlig`. Fri streng (`role: z.string().min(1)` i `tildelFirmaRolle`, organisasjon.ts:721) lukkes.
- **Én mutasjon** eier skriving. I dag skriver ≥3 steder, én eksplisitt merket «Speil av settFirmaAdmin» — speilingen fjernes, alle veier kaller samme prosedyre.
- **Tildelings-logg** (hvem ga hvem hvilken rolle når) — samme mønster som `FlytRettighetLogg`.

Egen rolle-tabell først den dagen roller trenger metadata (varighet, scope, delegering). Ikke nå.

## 2. De tre kildene

- **`User.role = "company_admin"`: utfases.** `User.role` reduseres til ren systemrolle (`user` | `sitedoc_admin`); firma-admin uttrykkes KUN som `firmaRoller: ["firma_admin"]` per medlemskap. Backfill: hver `company_admin`-bruker får `firma_admin` i firmaRoller på sitt/sine org-medlemskap; mangler medlemskap → rapportliste for manuell avgjørelse (aldri auto-opprett medlemskap — det ville la en utgått kolonne diktere sannheten den skal erstattes av).
- **`ProjectMember.erFirmaansvarlig`: beholdes, men omdefineres og guardes.** Den uttrykker noe reelt som IKKE er en firmarolle: «firmaets ansvarlige på dette prosjektet» — en prosjekt-utpeking. Vedtaket brytes ikke av at den finnes, men av at den GIR firma-lignende rett uten firma-forankring. Derfor: (a) den kan kun settes for brukere som er `OrganizationMember` i en org koblet til prosjektet (guard i `medlem.ts`-mutasjonen), (b) den gir kun prosjektretter (dagens `verifiserAdminEllerFirmaansvarlig`-flater), aldri firmaretter, (c) UI-et omtaler den som prosjekt-utpeking (7a viser den under «På prosjekter», lesevisning). Ren sletting avvises: den brukes i medlem/invitasjon/transfer-gates i dag, og behovet er reelt.

## 3. HMS-koblingen — den vi brenner oss på (mockup 7b)

`erHmsAdmin` går fra union av tre til **to eksplisitte kilder**:
1. Firmarolle `hms_ansvarlig` (fra firmaets ansatte — vises der)
2. Medlemskap i prosjektets HMS-gruppe / behandler-leddet (tildeles i prosjektet — vises i flyt-oppsettet)

**Prosjektadmin mister den implisitte behandlerretten** — det var den som gjorde at kmy «var» HMS-behandler uten at noen flate kunne vise hvorfor. Behandler blir i stedet UTPEKT av admin («Utpek behandler…»-banneret — admin kan utpeke seg selv eller andre); brukere melder seg aldri inn selv (Kenneth-vedtak 07.08). Utpekingen gjør retten eksplisitt (kilde 2). Hver behandlerrett er da sporbar til en flate der den kan ses og fjernes.
**Migrerings-guard:** prosjektadmins som faktisk HAR behandlet HMS-saker (finnes i saksloggen) meldes inn i HMS-gruppen av backfillen — ingen mister rett, retten blir bare synlig.

## 4. Ansatte-siden (mockup 7a)

Rad = chips per firmarolle (fra én kilde). Ekspandert rad skiller **«I firmaet» (avgjøres her, med konsekvens i klartekst)** fra **«På prosjekter» (lesevisning: prosjektroller, HMS-gruppe, firmaansvarlig-utpeking — endres i prosjektet, gir aldri firmarolle)**. «Bruker»-chipen dør; ingen rolle vises som «Ingen — ansatt». Dette er flaten som gjør kmy-tilfellet umulig: står det HMS-behandler på et prosjekt, står det I raden.

## 5. Migrering — ingen mister tilgang

Tre faser, samme disiplin som to-stegs-policyen:
- **A Backfill:** company_admin → firma_admin (pkt. 2); HMS-behandlere fra sakslogg → HMS-gruppe (pkt. 3); avvik → rapportliste, ikke auto-fiks.
- **B Dobbel-les med divergenslogg:** tilgangssjekkene leser union(gammel, ny) og logger hver divergens (hvem, hvilken sjekk, hvilken kilde ga retten). Union = ingen kan miste tilgang i denne fasen, per definisjon.
- **C Flipp:** når divergensloggen har vært tom i avtalt vindu, leses kun ny kilde; gamle kolonner beholdes døde én release før sletting.

## Tom-tilstanden på nye prosjekter (coworks risiko-spørsmål) — synlig fallback-regel, aldri tyst hull (mockup 7c)

Riktig innvending, og regel-medlemskapet fra Spor 2 dekker det meste alt: behandler = firmaets HMS-ansvarlige gjelder fra dag én på ETHVERT nytt prosjekt — har firmaet en `hms_ansvarlig`, finnes behandleren før første sak. Hullet er kun når OGSÅ firmaet mangler HMS-ansvarlig. Da:

- **Melderen blokkeres aldri** — en RUH får alltid en mottaker.
- **Fallback-regel:** er behandler-leddet reelt tomt (ingen HMS-gruppemedlemmer OG ingen firma-`hms_ansvarlig`), går saken til prosjektadmin — men som **synlig, navngitt regel**: den står i flyt-oppsettet («Ingen behandler ennå — saker går til prosjektadministrator»), merkes på hver sak den treffer («Hos prosjektadmin (fallback)»), og prosjektadmin varsles ved første sak. Kun admin utpeker behandler (seg selv eller andre) — aldri selvbetjent innmelding. Regelen opphører automatisk når leddet får et medlem.
- Forskjellen fra dagens implisitte union-rett er nettopp synligheten: retten kan ses, forklares og avvikles fra en flate. Samme klasse-fiks som 207-lærdommen — systemet sier fra i stedet for å feile tyst.

## Kenneths 207-spørsmål — avklart ved kodelesing

`hentTilgjengelige` (organisasjon.ts:84) **feiler ikke** for tom `firmaRoller` — den returnerer stille `[]` (`if (adminMedlemskap.length === 0) return [];`). Offeret på test er altså ikke en feil, men **usynlighet**: kmy får tom firma-velger og ser aldri firma-konteksten han reelt opererer i som HMS-behandler. 207-en må i så fall komme fra et annet kall — men den målbare skaden av tre-kilde-modellen er bekreftet: fungerende behandler, null firma-flate. Det er samme funn som 7b retter.
