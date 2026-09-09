# Svar: Kontakter-flaten — tre nivåer, provenans, forslagslag, navn

**Fra:** fabel · **Dato:** 2026-09-08 · **Rev. 2 (kveld):** funksjonsinventar + rolle/attestering/batch-knapp/filtre inn i mockup · **Rev. 3:** kapabilitets-seksjon + admin-avgrensning (cowork-krav 08.09) · **Svar på:** `docs/redesign/fabel-kontakter-ia.md` (cowork 2026-09-08)
**Mockup for gating:** `Kontakter IA Mockup.dc.html` (designprosjektet) — interaktiv: fane-bytte, gruppe-åpning, personkort, forslagsstripe.
**Status:** 🟡 VENTER Kenneth-gate på mockup + navnevalg (§ 5). Ingenting bygges før gate.

> Kenneths IA-notat 2026-09-08 (arv-regler + skisse kontakter/brukergrupper/personkort) er
> innarbeidet — dette svaret er notatet gjort konkret.

## 1. De tre nivåene (bestilling pkt 1)

**Nivå 1 — Kontakter (fane 1).** Ren liste: navn · e-post · telefon · firma · faggruppe.
Alt redigerbart her (faggruppe = egenskap ved personen, vedtatt; `ed21b640` finnes).
UT av raden: flyt-chips, attestering, gruppe-kolonner, gruppeoverskrifter med tre ikoner.
Radklikk → personkort (nivå 3).

**Nivå 2 — Brukergrupper (fane 2).** Kort per gruppe: navn + medlemsnavnene opplistet
(kun navn) + to små ikoner (les/rediger) + tilgangs-chips. Åpnet gruppe viser medlemmer
(klikk navn → personkort) og tilganger delt i **Domener** (Bygg/HMS/Kvalitet — `domains`
finnes, chipsene flyttes hit) og **Prosjektmoduler**. `+`-ikonet i gruppeoverskriften på
kontaktlista fjernes (Kenneth-vedtak § 4 i bestillingen).

**Nivå 3 — Personkort (slide-over, nås fra begge faner).** Fire seksjoner:
kontaktinfo (redigeres her) · brukergrupper (chips) · **Deltar i dokumentflyter** (visning
med provenans, § 2) · lenke «Administrer deltakelse i Dokumentflyt-oppsettet →».
Flyt-deltakelse redigeres ALDRI her — én redigeringsplass per relasjon, som vedtatt.

> ⚠️ **PRESISERT 2026-09-09 — les før du bygger på denne linja.** Kenneth tiltrådte fabels
> refinering: **flyt-deltakelse kan LEGGES TIL fra personkortet via den delte velgeren; endring
> og fjerning bor fortsatt i Dokumentflyt-oppsettet.**
> Full begrunnelse: [fabel-kontakter-ia.md § 4](fabel-kontakter-ia.md) og
> [kp-modal-avvik-svar-fabel-2026-09-09.md § 3](kp-modal-avvik-svar-fabel-2026-09-09.md).

## 2. Provenans på flyt-listen (pkt 2)

Hver flyt-rad på personkortet får én sekundærlinje i klarspråk — ingen tekniske ord:

- Direkte: **«Lagt til direkte»**
- Via gruppe: **«Følger av brukergruppen Sitedoc Ledelse»**
- Via faggruppe: **«Følger av faggruppen Rørlegger»**

Samme flyt kan stå to ganger (direkte + arvet) — det vises som to rader, for det ER to
koblinger; å slå dem sammen gjenskaper dagens provenans-tap. «Følger av»-formuleringen
forklarer også implisitt hvorfor den ikke kan fjernes fra personkortet.

## 3. Forslagslaget (pkt 3) — ikke-blokkerende, to lag

**Lag 1 — stripe etter handling.** Etter vellykket tilføyelse (uansett inngang) vises en
lukkbar stripe over lista: «{Navn} er lagt til i kontaktlista. Vil du også gi henne
tilhørighet? [+ Brukergruppe] [+ Dokumentflyt] [Senere]». Innholdet varierer med inngangen
(bestillingens § 5-tabell): fra gruppe → foreslå kun flyt; fra flyt → foreslå kun gruppe.
Aldri modal, aldri obligatorisk steg — «Senere» og X koster null (effektivitets-gate pkt 3:
sikkerhetsnett finnes, ekstra bekreftelse forbudt).

**Lag 2 — tomtilstand på personkortet.** Kortets seksjoner sier selv hva som mangler:
«Ikke i noen brukergruppe · legg til» / «Deltar ikke i noen dokumentflyt ennå». Det er den
kontekstuelle veilederen for brukeren som kommer tilbake om tre uker — uten mas i lista
(ingen persistent «ufullstendig»-badge på kontaktrader; mange kontakter skal legitimt aldri
inn i en flyt).

## 4. Gap 2 — e-post-vei i dokumentflyten (pkt 4)

**Ja, flyten skal ha e-post-vei — via den delte invitasjonsmodalen fra anbefaling A**
(`dokumentflyt-medlem-analyse-2026-07-28.md`): én modal begge steder, alltid komplett
(e-post/navn → firma påkrevd → brukergruppe forhåndsvalgt → faggruppe valgfri); åpnet fra
flyten forhåndsutfylles flyt+rolle. «Legg til i flyt» som tvunget andre steg gjenskaper
akkurat glemsel-problemet Kenneth beskriver. Konsekvens for forslagslaget: stripen etter
flyt-invitasjon trenger bare foreslå gruppe (firma og kontakt er alt komplett). Sekvenseres
med PM-interim som allerede rutet (funn A er ellers regelbrudd-produsent mot «firma påkrevd»).

## 5. Navnet (pkt 5) — anbefaling: **Brukergruppe**

- Det er hva koden og DB sier (`category: "brukergrupper"`) — navnet UI-et ikke er uenig med.
- Kortets innhold er folk først (navneliste), tilganger som egenskap — «Brukergruppe»
  beskriver objektet, «Tilgangsgruppe» beskriver én av egenskapene og over-lover (gruppen
  brukes også som flyt-deltaker og kontaktorganisering).
- Kenneths eget IA-notat bruker «brukergruppe» gjennomgående.
- «Kontaktgruppe» kolliderer med at gruppen bærer tilganger — den er mer enn en adresseliste.

⚠️ **Dette reverserer min egen anbefaling fra `brukeroppsett-dokumentflyt-redesign-retning.md`
§ 2 (2026-08-04: «Gruppe → Tilgangsgruppe»).** Begrunnelse for snuoperasjonen: den gang var
grepet å eksponere tilgangskjeden på eksisterende flate; med egen gruppefane der tilganger
vises eksplisitt som seksjon, trengs ikke navnet til å bære den jobben. Retning-dokumentets
§ 2 oppdateres når Kenneth har valgt. Kenneth eier valget.

## Klikk-telling (hyppigste handling, mot effektivitets-gaten)

Finn telefonnummer til en person: i dag 0 klikk men visuell skanning av 9-kolonners rad i
gruppert liste; ny flate 0 klikk (kolonnen står i en 5-kolonners liste). Se hvilke flyter en
person er i og hvorfor: i dag umulig (chips uten kilde); ny 1 klikk (radklikk → personkort).
Full telling per handling settes i ordren når design er gatet.

## Funksjonsinventar — dagens `oppsett/brukere` → nytt design (rammeverk-gate)

> Kenneth-bestilling 08.09 kveld: «ta en ekstra sjekk om vi klarer å erstatte denne med nytt
> design». Målt mot skjermbilde test.sitedoc.no 08.09 + `page.tsx`. Hver linje avgjøres
> eksplisitt; «flyttet» = bevart på nytt sted.

| Dagens funksjon | Avgjørelse |
|---|---|
| Gruppert liste m/gruppeoverskrifter (navn, antall, Auto, 3D, domener-chips) | **Flyttet** → Brukergrupper-fanen; Auto-merke på kortet, domener i gruppedetalj. 3D-badge følger med på kortet |
| Kollaps per gruppe | **Erstattet** — flat kontaktliste + egen gruppefane gjør kollaps unødvendig |
| Person duplisert per gruppe (Kenneth 2 rader) | **Bevisst fjernet** — flat liste, én rad per person (rotårsaken til «kaos») |
| Flyt-chips per rad (uten kilde) | **Erstattet** → personkortets flyt-liste MED provenans (§ 2) |
| Kolonner e-post/telefon/firma | **Bevart** i lista |
| Navn-redigering (blyant) | **Flyttet** → personkortet |
| Rolle (Medlem/Admin) | **Flyttet** → personkortets kapabilitets-seksjon (redigerbar) |
| Attestering-markør | **Flyttet** → personkortets kapabilitets-seksjon |
| Faggrupper redigerbar per rad (+/×) | **Flyttet** → personkortet (kolonnen i lista er visning) |
| Tilgangsgruppe-kolonne (chips, +1) | **Erstattet** → personkortets Brukergrupper-seksjon + gruppefanen |
| `+`-ikon i gruppeoverskrift | **Bevisst fjernet** (Kenneth-vedtak § 4) → «+ Legg til medlem» i gruppedetalj, delt modal |
| Filter: søk / rolle / faggruppe / tilgangsgruppe | **Bevart** — søk + faggruppe- + brukergruppe-nedtrekk i lista (rolle-filter utgår: to verdier, søk + personkort dekker; Kenneth kan kreve den inn) |
| «+ Ny tilgangsgruppe» | **Flyttet** → «+ Ny brukergruppe» på gruppefanen |
| «Legg til fra firmaet» (batch) | **Bevart** — knapp ved «+ Ny kontakt» |
| «+ Ny kontakt» | **Bevart** |
| Forklaringsbanner «To uavhengige ting …» | **Erstattet** — provenans-linjene og gruppedetaljens Tilganger-seksjon forklarer in situ; hjelpe-? beholdes |
| HMS-grupper som grupperad (`erHmsGruppe`) | **Flyttet** → kort på gruppefanen m/HMS-domene-chip |
| canLogin/HMS-kort-data på user | **Bevart** (personkortet; ikke tegnet i mockup — tas i ordren) |

Konklusjon: **ja, nytt design erstatter siden fullt** — ingen funksjon tapes; to bevisste
fjerninger (duplikatrader, `+`-ikonet) er Kenneth-vedtak. Inventaret gjentas i ordren.

## Rev. 3-tillegg (cowork-krav før lås)

**Kapabilitets-seksjon på personkortet.** Rolle og attestering er ikke kontaktinfo — de er
kapabiliteter i prosjektet, og det blir flere (PSI-nivå, godkjenner-fullmakter, …). Egen
seksjon «Kapabiliteter i prosjektet» mellom kontaktinfo og brukergrupper: én rad per
kapabilitet (navn · verdi · rediger), datadrevet liste så nye kapabiliteter er en rad, ikke
en redesign. Lagt inn i mockupen.

**Avgrensning — sitedoc_admin hører ikke hjemme her.** Kontakter-siden forvalter PROSJEKTETS
personer: kontaktinfo, faggruppe, brukergrupper, prosjektkapabiliteter, flyt-provenans.
sitedoc_admins fulle oversikt (alle firmaer/prosjekter/tillatelser) bor i `/dashbord/admin`
(del 10/K11). Regelen som holder grensen: **en seksjon hører på personkortet kun hvis verdien
er scopet til prosjektet.** Global tilstand lenkes eventuelt («Administrer i Admin →»), vises
aldri inline. Uten denne grensen vokser siden tilbake til dagens kaos.

## Åpent (eiere)

- **Kenneth:** gate mockup (tre nivåer + provenans-ordlyd + forslagsstripe) · velge navn (§ 5)
- **fabel:** etter gate — ordre-utkast med funksjonsinventar av dagens brukere-side
  (rammeverk-krav: omskriving av eksisterende flate) + full klikk-telling
- **cowork:** sekvensere funn A-fiksen (delt invitasjonsmodal) mot PM-interim
