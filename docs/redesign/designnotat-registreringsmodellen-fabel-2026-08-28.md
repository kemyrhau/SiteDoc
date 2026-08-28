# Designnotat — registreringsmodellen: firmamal, ansatt-livssyklus, prosjekttilgang

**Fra:** fabel · **Dato:** 2026-08-28 · **Status:** til Kenneths valg → deretter ordre
**Svar på:** `relay/fabel-registreringsmodellen.md` + Kenneths chat-melding 2026-08-28
(«her gir vi han nøklene → kun her» med skjermbilde av `/dashbord/firma/ansatte`).
**Reviderer:** `designnotat-nytt-prosjekt-innhold-fabel-2026-08-28.md` § svar 2/4 —
se § 6. Coworks målinger bestrides ikke; to egne tilleggsmålinger i § Fakta.

## Fakta (tillegg til coworks måling, fabel-verifisert 2026-08-28)

- `OrganizationMember` (schema:214): `ansattRolle` (String, «ansatt|bas|prosjektleder|
  daglig_leder»), `firmaRoller` (String[], «firma_admin|hms_ansvarlig|hr_ansvarlig»),
  `ansattnummer`, `avdelingId` — bevisst String/String[] «slik at verdier kan utvides
  uten migrasjon». **Registreringen har altså allerede et hjem**; den mangler status
  og nøkler, ikke en modell.
- `Avdeling` finnes (schema:2253) og henger på OrganizationMember. **Ikke målt:**
  om Project har avdelingId — avdelingsregelen i § 3 krever den (avhengighet, ikke
  antagelse: må måles i ordren).
- Per-ansatt modultilgang (timer/maskin/varelager) finnes ikke på OrganizationMember —
  moduler styres i dag på firma- og prosjektnivå, ikke per person.

## 1. Prinsippet: én registrering, ett sted

Kenneths setning er designet: **ansatte-siden er stedet der firmaet gir og tar
nøkler — kun der.** Alt annet (prosjektmedlemskap, flytroller, attestering) er
konsekvenser av registreringen, aldri steder man gir tilgang «på si».

Registreringen bor på `OrganizationMember` og består av:

| Felt | Status | Innhold |
|---|---|---|
| `status` | NY | `"aktiv"` \| `"deaktivert"` (String, repo-konvensjon) + `deaktivertDato` |
| `ansattRolle` | finnes | stilling |
| `avdelingId` | finnes | avdeling |
| `firmaRoller` | finnes | firma_admin, hms_ansvarlig, hr_ansvarlig |
| `modulNokler` | NY | String[]: `timer`, `maskin`, `varelager` — Kenneths fire nøkler minus «prosjekter», som er regelen under |
| `prosjektTilgang` | NY | `"alle"` \| `"avdeling"` \| `"manuell"` — se § 3 |

Prosjektnivået beholder det som ER prosjektspesifikt: faggruppe-kobling,
prosjektrolle (admin/medlem). Det flytter ikke til firmanivå.

## 2. Deaktivering — én sannhet ved porten, ikke vifteskriving

Coworks måling viser at `tilgangskontroll.ts:18` bare sjekker at ProjectMember-raden
finnes. Rotårsaksfiksen er **ikke** å skrive `periodeSlutt` på alle radene ved
deaktivering — det er N skrivinger som kan feile halvveis, og reaktivering må
gjette hvilke som skal nullstilles.

I stedet: **guarden leser ansettelsesstatus.** `verifiserProsjektmedlem` (og
søsken) sjekker ProjectMember-raden OG at brukerens OrganizationMember i
prosjektets firma har `status = "aktiv"`. Én fakta, ett sted, reversibel med én
skriving. `periodeSlutt` settes i tillegg ved deaktivering — som historikk-
markør for visning, aldri som tilgangskilde (den forblir ellers inert til
medlemskapshistorikk designes ordentlig).

Regler (coworks 🔴 kvittert):
- Reversibel: reaktivering = `status = "aktiv"`, tilgangen er tilbake uendret.
- Ingenting personen produserte røres — timer, sjekklister, bilder står
  (gdpr-kartlegging.md). Deaktivert bruker vises i historikk med navn.
- Deaktiverte vises i ansattelista bak filter («Vis sluttede»), slettes ikke.
- Deaktivering krever firma_admin; egen rad kan ikke deaktiveres (lockout-guard).
- Merk: multi-firma-bruker deaktiveres PER firma — status bor på medlemskapet,
  ikke på User. Modellen gir dette gratis.

## 3. Prosjekttilgang — regel per ansatt, evaluert ved to hendelser

Kenneths tre alternativer blir feltet `prosjektTilgang`, med firmadefault i
firmainnstillingene og per-ansatt overstyring på registreringen:

- **`alle`** — ansatt er medlem i alle firmaets aktive prosjekter.
- **`avdeling`** — medlem i prosjekter knyttet til sin avdeling. Krever
  prosjekt↔avdeling-kobling (måles/bygges i ordren; «Uten avdeling»-ansatte
  faller tilbake til `manuell`).
- **`manuell`** — medlem kun der noen har huket ham av: ved prosjektopprettelse
  (ansattliste med avhukinger i nytt-prosjekt-skjemaet) eller senere fra
  prosjektets medlemsside.

Regelen er en regel, ikke en engangsutrulling — den evalueres ved **to
hendelser**: nytt prosjekt opprettes (hvem kommer inn) og ny ansatt onboardes
(hvilke prosjekter får han). Den fjerner aldri medlemskap ved endring — å
stramme regelen fra `alle` til `manuell` gjelder fremover; fjerning av tilgang
er alltid en synlig handling (deaktivering eller manuell fjerning), aldri en
bieffekt.

## 4. Firmamalen — firmafakta, redigeres av firmaadmin

Cowork har rett i at forrige notat manglet livssyklus-premisset: kopi-fra-
forrige gjør standarden til et uhell, og en nyansatt må kobles inn i noe som
finnes på firmanivå. Firmamalen består av:

1. **Moduler** — finnes allerede: aktive OrganizationModule blir ProjectModule
   ved opprettelse (`prosjekt.ts:257`). Firmamalen gir dette et redigeringssted,
   ingen ny mekanikk.
2. **Standard faggruppe** — «(Firmanavn)», f.eks. «A.Markussen AS».
3. **Standard dokumentflyt** — Kenneths navnemønster: «Ama Ansatte → Ama
   Ledelse» (forkortelse redigerbar firmafakta, foreslås fra firmanavn).
4. **To standard brukergrupper** — «(Kort) Ansatte», «(Kort) Ledelse» — koblet
   til flytens roller (Registrator → Godkjenner).
5. **Brukergruppe-plassering per ansatt** — registreringen sier om personen er
   Ansatte eller Ledelse; onboarding kobler ham inn i riktig gruppe i
   prosjektene regelen gir ham. (Avledes av `ansattRolle`: daglig_leder/
   prosjektleder → Ledelse, ansatt/bas → Ansatte — overstyrbar.)

**Lagring:** egne rader på Organization-nivå (én modell `FirmaOppsett` med
faggruppe-/flyt-/gruppedefinisjoner som strukturert JSON, versjonert), som
materialiseres til ekte prosjektrader ved opprettelse — samme mønster som
`opprettTestprosjekt`s modulDef, bare firmaeid og redigerbar. **Rapportmaler
holdes UTENFOR firmamal v1** — de har bibliotek + kopi-fra-prosjekt, og å
legge dem i malen ville forutsatt ReportTemplate/OrganizationTemplate-
migreringen. Ingen avhengighet til den (🔴 kvittert).

**Malendring og eksisterende prosjekter: ingenting skjer.** Malen er en fødsel-
fakta. Retro-sync («tilby oppdatering») er to-sannheter-problemet fra
fremdriftsplan-saken i miniatyr — utsettes til noen faktisk ber om det.

**Redigering:** firmaadmin, på firmasidene (naturlig hjem: Firma → Oversikt
eller egen «Prosjektmal»-side ved siden av Moduler). Første gang firmaet mangler
mal: opprett-prosjekt fungerer som i dag (blankt + veileder) — malen er et
tilbud, ikke en port.

## 5. Onboarding — hva automatikken gjør og ikke

Inviter ansatt (finnes) → registreringen fylles ut i samme flyt: stilling,
avdeling, modulnøkler, prosjekttilgang, brukergruppe-plassering. Automatikken
gjør så NØYAKTIG det registreringen sier: oppretter ProjectMember i prosjektene
regelen gir, og legger personen i standard brukergruppe der. Ingenting annet.
Feil-tilgang-garden (coworks 🔴): automatikken gir aldri firmaroller, aldri
prosjektadmin, aldri attesteringsrett — det er alltid eksplisitte handlinger.

## 6. Forholdet til forrige notat (revisjon, ikke omkamp)

- **Firmamal er ryggraden** for standardoppsettet — «ingen firmamal-entitet»
  fra forrige notat trekkes; premisset var for smalt, som cowork selv påpeker.
- **Kopi-fra-prosjekt består som tillegg** for avviksprosjekter («Start fra:
  Firmamal (default når den finnes) | Blankt | Kopier fra …»). Kopiregelen
  (oppsett kopieres, innhold/lokasjon ikke; brukergruppe-skall) står uendret.
- **Blankt-som-default** gjelder nå bare firmaer uten mal. Medlemskopi-som-
  avhuking erstattes av tilgangsregelen i § 3 — regelen svarer på spørsmålet
  avhukingen prøvde å stille.
- Veilederen berøres ikke (dokgen-ordren tåler grønne steg ved fødsel), MEN se
  følgenotat om tegningskravet: `relay/fabel-tillegg-veileder-tegning-2026-08-28.md`.

## Faseforslag (verdi først, som printmotoren)

1. **Deaktivering + status-guard** — tilgangshullet er det eneste som haster
   (pilot: ekte ansatte). Liten, målbar, ingen avhengigheter.
2. **Registreringen på ansatte-siden** — status/nøkler/regel synlig og redigerbar.
3. **Firmamal + onboarding-automatikk** — krever 1+2.
4. Avdelingsregelen — når prosjekt↔avdeling er målt/bygget.

## Åpent for Kenneth

1. Firmadefault for `prosjektTilgang` hos A.Markussen: `alle` eller `manuell`?
   (50 ansatte, timeregistrering viktigst — `alle` gir minst friksjon for
   timeføring, `manuell` minst støy i dokumentflyt.)
2. Skal modulnøklene (timer/maskin/varelager) per ansatt håndheves i fase 2,
   eller er de registrerings-metadata først og håndheving senere? Håndheving
   berører mobil-flatene og bør måles før løfte.

---

## 🟢 KENNETH-VEDTAK 2026-08-28 — begge åpne punkter avgjort

**1. `prosjektTilgang`: `manuell` som firmadefault — men defaulten skal kunne endres
av firmaet selv.** Ikke hardkodet: A.Markussen skal kunne flytte den til `alle` eller
`avdeling` når de vil, og den gjelder da som utgangspunkt for nye ansatte. Regelen per
ansatt overstyrer fortsatt firmadefaulten.

Begrunnelse: prosjekttilgang i SiteDoc gir innsyn i prosjektets dokumenter, ikke bare
timeføring. `alle` som default ville gitt enhver ansatt innsyn i byggherre-
korrespondanse på alle prosjekter. Friksjonen ved `manuell` er reell — noen må legge
til folk før de kan føre timer — men den er synlig og rettes én gang, mens
oversharing er usynlig og rettes aldri.

🔴 **Konsekvens for fase 3:** onboarding-automatikken må gjøre friksjonen liten, ellers
blir `manuell` en daglig blokker. Det er der firmamalen tjener sitt brød.

**2. Modulnøkler registreres i fase 2, håndheves senere.** Fase 2 lagrer og viser hvem
som skal ha timer/maskin/varelager, uten å stenge noe. Håndheving berører mobilflatene
og skal måles før den loves — å stenge folk ute midt i en pilot er en dyr måte å
oppdage en feilkonfigurasjon på. Registreringen gir dataene til å se hva håndheving
faktisk ville gjort.

---

## 🟢 KENNETH-VEDTAK 2026-08-28 (2) — tilgangsmodellen i lag, og kryssfirma-spørsmålet

### Modellen, slik Kenneth formulerte den

```
User.canLogin                    ← porten: kan personen autentisere i det hele tatt
├─ Firmabruker (OrganizationMember, status="aktiv")
│    → prosjekter (ProjectMember) + moduler aktivert i prosjektet (ProjectModule)
│    → firma-flater: timer · varelager · maskin — dersom firmaet har dem
│      (OrganizationModule)
└─ Uten firma, eller ansatt i et EKSTERNT firma
     → kun prosjektet + modulene brukeren er gitt tilgang til
```

**Kenneths regel: samme forhold skal ikke sjekkes i to forskjellige kodeavsnitt.**

Målt 2026-08-28: `canLogin` er allerede riktig plassert som **portvakt** — den håndheves
ved autentisering (`apps/web/src/auth.ts:24`), så en deaktivert bruker kommer ikke inn.
Bruddet ligger i **kandidatfiltrene**: «hvem kan jeg velge blant» er håndskrevet seks
steder (`gruppe.ts:334`, `medlem.ts:189`/`:206`/`:572`, `organisasjon.ts:644`).

Det er der buggen oppsto: `hentLedigeFirmaBrukere` husket `canLogin` og glemte `status`,
slik at en deaktivert ansatt sto synlig og valgbar. Ikke uoppmerksomhet — regelen
«brukbar person i dette firmaet» finnes ikke noe sted og gjenskapes hver gang.
**Fiks: én delt hjelper, ikke seks rettede where-setninger.**

### Kryssfirma: kan firma B trekke folkene sine ut av firma A sitt prosjekt?

**Kenneth:** *«firma B må kunne deaktivere sine egne ansatte — de skal ikke få fortsette
som om de jobber i firma B ved å opprette oppgaver og sjekklister på vegne av et firma de
ikke er ansatt i. Dersom brukeren har en firma-e-post vil OAuth automatisk slutte å virke.
Dersom e-posten er privat, må kanskje firma A ta ansvar for sitt eget prosjekt.»*

Skaden er presist identifisert: ikke at hun *ser* prosjektet, men at hun **handler på
vegne av et firma hun ikke jobber i**.

**Vedtak: ingenting bygges.** To målinger avgjorde det:

1. **Det finnes ingen passord-innlogging.** `auth.ts` har kun Google og Microsoft Entra
   ID — ingen Credentials-provider. Dør firma-e-posten hos identitetsleverandøren, finnes
   det ingen bakvei inn. Kenneths OAuth-argument er ikke bare sannsynlig, det er lukket.
2. **En kirurgisk fiks er ikke uttrykkbar.** Cowork foreslo å kutte bindingen til firma
   B sin faggruppe og la prosjekttilgangen stå — men `Faggruppe` har `projectId` og
   **ingen `organizationId`**. En faggruppe vet ikke hvilket firma den representerer.

**Restrisiko, akseptert:** en person med **privat** e-post, deaktivert i firma B, kan
handle på vegne av B til firma A fjerner henne fra prosjektet. Firma A eide invitasjonen
og eier opprydningen. Prisen for å lukke den er `organizationId` på `Faggruppe` — en
modellendring for et kanttilfelle. **Tas ikke nå.**

🔴 **Dette er et vedtak, ikke et hull.** Finner noen det igjen: les dette avsnittet før du
starter arkitektur-diskusjonen på nytt.
