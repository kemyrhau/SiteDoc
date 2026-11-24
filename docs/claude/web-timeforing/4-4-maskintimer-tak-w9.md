> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.4. Seksjonsnumrene er de samme som før delingen.

### 4.4 Maskintimer høyst jobbens arbeidstimer (w9)

**Kenneth 2026-11-19:** *«arbeid 4,5 timer, maskin 7,5 timer -> det er ikke lov. Kun maskiner som heatwork eller
utleie maskiner/materiell kan ha timer/døgn leie uten at arbeidstimer tilsvarende eller flere er registrert.»*

✅ **Bygget:** w9 (`044fac2f`) og w9m (`3225e93c`) er merget. B21–B23 er besvart (§ 8.7). «I dag» i tabellene
under er koden før w9, og «bøtte» er det gamle taket pr. prosjekt og underprosjekt.

**Slik oppsto eksempelet (WM93–WM98):**
- Dagen ble lagt rett inn i test-basen med SQL 17.05.2026. Den har aldri vært gjennom serverens tak, og var i brudd
  fra første stund.
- Underprosjektet END-002 er satt senere, på en vei som ikke sjekker taket.
- Samme tilstand kan lages i dag uten SQL, på sju veier. Tre av dem gir eksempelet nøyaktig: ✂ på en timerad, bytte
  av underprosjekt på én timerad, og «Del opp» når maskinen er ført uten klokkeslett.
- Taket som finnes, er dessuten slakkere enn regelen: det regnes pr. prosjekt og underprosjekt, ikke pr. jobb, og
  pausen legges til.

**Regelen**

| Del | Forslag | Grunn |
|---|---|---|
| **Hva som sammenliknes** | På hver jobb (kort): summen av timene til maskinene som krever fører, er høyst jobbens arbeidstimer. | Kenneths ord. Én person fører én maskin om gangen. Serveren regner alt summen i dag (WM96). |
| **Arbeidstimer** | Jobbens timerader, ordinær tid og overtid. Reise og erstattede rader teller ikke. | Samme «arbeid» som taket og sperren R24 bruker i dag. |
| **Pausen** | Regnes ikke med. | Pausen ble lagt til 18.05. for døgn-maskiner, som går mens føreren har pause. Når de er unntatt, har den ingen grunn. Skjermen er alt vedtatt uten pausen (§ 8.1, følge 3). |
| **Unntatt** | Maskiner med enheten «døgn» (WM102). De telles ikke med og har ikke noe tak. | Kenneths ord: Heatwork og utleie. ⚠️ Dette endrer dagens regel: i dag kan en Heatwork ikke ha flere timer enn arbeidstimene pluss pausen (WM101). Omfanget er B21. |
| **Maskin uten satt enhet** | Krever fører, og følger regelen. | H15, vedtatt 16.11. |
| **Eldre rader uten jobb** | Følger bøtteregelen som i dag, med pausen. Døgn-maskinene tas ut der også. | De er ingen jobb (WM107), og skal ikke avvises strengere enn da de ble ført. |

Eksempelet etter regelen: END-002 har 4,5 t arbeid og kan ha høyst 4,5 t maskin. De siste 3,0 maskintimene hører til
TILL-001, der arbeidet er ført.

**Hvor regelen må håndheves**

| Lag | I dag | Endring | Fjerner noe? |
|---|---|---|---|
| **Delt regel** (`packages/shared/src/utils/maskinKapasitet.ts`) | Pr. bøtte, pausen lagt til, alle maskiner. | Pr. jobb, uten pausen, døgn-maskiner utenfor. Rader uten jobb som i dag. Server, PC og telefon bruker samme funksjon. | Nei. |
| **Serveren — de åtte stedene som sjekker i dag** (WM96) | Sjekker alle bøttene på sedelen. | Bruker den nye regelen. En skriving avvises bare når den lager eller øker et brudd på en jobb den rører. | Nei. ⚠️ I dag stopper et gammelt brudd all føring på dagen; det gjør det ikke lenger. |
| **Serveren — de sju veiene uten sjekk** (WM97) | Skriver uten å sjekke. | Alle sjekker regelen. ✂ og bytte av underprosjekt på én timerad avvises når maskinen blir stående igjen med flere timer enn arbeidet, med beskjed om å flytte hele jobben eller rette maskintimene først. | ⚠️ Ja: handlinger som går gjennom i dag, avvises. |
| **«Del opp»** (WM98) | To egne vakter med hull. | Regelen sjekkes for begge delene etter delingen. Forhåndsvisningen viser maskintimene pr. del. | Nei. |
| **Synken fra telefonen** (WM99, WM100) | Sjekker det telefonen sender, pr. bøtte med pausen. | Sjekker det som faktisk blir lagret. Om synken får den strengere regelen med en gang, er B22. | Avhenger av B22. |
| **PC — føringen** (dagssiden; jobben i w3) | Maskinvinduet sperrer pr. bøtte med pausen. Timerad-vinduet gir maskinen radens timer uten sjekk (WM105). | Ved timer-feltet: «høyst 4,5» = jobbens arbeidstimer minus de andre maskinene. Døgn-maskin: ingen grense. | Infolinja «Arbeid i gruppen …» går ut, som alt planlagt i § 5. |
| **PC — attesteringen** | Fritt tallfelt for maskintimer og arbeidstimer; bare bøtteregelen stopper (WM105). Intet avviksmerke (WM106). | Samme «høyst» ved feltene i den åpne registreringen. Nytt avviksmerke **«Maskin over arbeid»** på jobben, med «Maskin 7,5 t, arbeid 4,5 t» på hover. | ⚠️ Ja: advarselen «operatør pauser, maskin går videre» i «Rediger sedel» (`timer.rediger.maskinOverstigerMedPause`) går ut for maskiner som krever fører. |
| **Telefonen — Bekreft dag** | Hver maskin høyst kortets arbeidstimer; bøtta med pausen (WM105). Varsler ikke når arbeidstiden kuttes (WM108). | Summen av maskinene som krever fører, høyst jobbens arbeidstimer. Døgn-maskin uten grense. Varselet kommer når arbeidstiden kuttes, ikke først ved Bekreft. | Nei. |
| **Telefonen — dagskort-modus og dagsoversikten** | Pr. rad uten pausen, og pr. bøtte med pausen. | Samme delte regel. Sperren pr. rad står, men gjelder ikke døgn-maskiner. | Nei. Regelen er en regel om dataene og gjelder begge moduser; skjermene i firmavalget dagskort-modus endres ikke utover tallet grensen viser. |

**Det som er lagret (B23)**
- Rader som er attestert, røres ikke.
- Jobber som venter og bryter regelen, får merket «Maskin over arbeid». Forslaget er at de ikke kan attesteres før
  de er rettet eller returnert — samme mekanisme som sperren for normtak (WM106).
- Hvor mange jobber det gjelder i test og prod, er ikke målt. Tellingen må gjøres før delen bygges (§ 10).

**Eldre apper og vedtaket B4 fra 16.11. (B22)**
- B4 i kort-id-specen sier: «maskin-tak som i dag på server, pr. kort i skjermen», fordi et strengere servertak kan
  avvise sedler som er riktige i dag (`KS:591`, `:606`). **Kenneths ord 19.11. sier at slike sedler ikke er riktige.
  Regelen kan ikke holdes uten at serveren endres:** sju veier skriver forbi taket i dag, og PC-en har ingen regel pr.
  jobb. Blir w9 vedtatt, er B4 opphevet for serveren.
- En eldre app sperrer alt hver maskin til kortets timer i Bekreft dag. Den rammes bare i kanttilfeller: to maskiner
  som til sammen har flere timer enn jobben, en maskin som bruker pausen, og dagskort-modus.
- I de tilfellene avviser serveren hele dagen. Arbeideren ser et rødt felt «Avvist» med en tekst som ikke er oversatt,
  og må rette og lagre på nytt (WM100). Ingenting går tapt på telefonen.
- Unntaket for døgn-maskiner er en lettelse og kan gjelde alle veier fra første dag.

**Migrering?** Ingen med anbefalt svar på B21 (A): feltet finnes. Med B21 B trengs en ny kolonne på maskinen i
`packages/db-maskin`, som Kenneth kjører.

**Følger som ikke er spørsmål, men si fra hvis du mente noe annet:**
1. Regelen gjelder summen av maskinene på jobben, ikke hver maskin for seg.
2. Pausen regnes ikke med for maskiner som krever fører.
3. En døgn-maskin føres fortsatt i timer (WM104) og har ingen øvre grense på jobben.
4. Regelen gjelder begge moduser: prosjektkort-modus og firmavalget dagskort-modus.
5. En Heatwork eller et aggregat må stå som «Utleieobjekt» med enheten døgn i maskinregisteret for å være unntatt
   (H15). Står enheten tom, regnes maskinen som en maskin med fører.
