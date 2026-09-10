# ORDRE: Kontakter-flaten — tre nivåer (redesign-Opus)

**Fra:** fabel · **Dato:** 2026-09-08 · **Rev. 2:** ren UI-ordre — server finnes (`medlem.registrer`, 663fb256; funn A lukket) · **Rev. 3:** cowork-verifisert mot kode 08.09, kandidatmengde + flytboks-presisering inn · **Status:** Kenneth-gatet design + navn 08.09 (mockup godkjent i sin helhet)
**Grunnlag:** `docs/redesign/fabel-kontakter-ia.md` (cowork-bestilling) + `docs/redesign/kp-kontakter-ia-svar-fabel-2026-09-08.md` (rev. 3) + mockup `Kontakter IA Mockup.dc.html` (designprosjektet — skjermbilder følger relay)
**Flate:** `apps/web/src/app/dashbord/oppsett/brukere/page.tsx` (web only — kontakt-/gruppeadmin er kontorarbeid; mobil røres ikke)
**Flagg:** siden er felles funksjonalitet, ikke nav-skall → bygges flagg-nøytralt (flagg-prinsippet).

## Mål

Erstatt dagens grupperte 9-kolonners kontaktliste med tre nivåer: ren kontaktliste ·
brukergrupper som kort · personkort med provenans. Rotårsak som løses: raden bærer avledet
data fra tre hierarkier uten kilde (bestillingens § 2).

## DESIGNLÅS (kvitter «designavvik: ingen» eller list forslag FØR koding)

1. **Navn (Kenneth-vedtak 08.09): «Brukergruppe»** overalt i UI — erstatter all
   «Tilgangsgruppe»-tekst (i18n-nøkler oppdateres, begge språk). DB-kategorien
   `brukergrupper` står urørt.
2. **To faner:** Kontakter · Brukergrupper. Ingen gruppert listevisning; én rad per person.
3. **Kontaktliste-kolonner:** navn · e-post · telefon · firma · faggruppe (fargeprikk).
   Ingen flyt-chips, rolle-, attestering- eller gruppekolonner. Radklikk → personkort.
4. **Filtre:** søk + faggruppe-nedtrekk + brukergruppe-nedtrekk. Rolle-filter utgår.
5. **Knapper:** liste: «Legg til fra firmaet» + «+ Ny kontakt»; gruppefane: «+ Ny brukergruppe».
6. **Gruppekort:** navn + merker (Auto / HMS-domene) + medlemsnavnene opplistet (klikkbare →
   personkort) + les/rediger-ikoner + tilgangs-chips. Åpnet gruppe: medlemsliste (klikkbar) +
   Tilganger delt i Domener og Prosjektmoduler + «+ Legg til medlem».
7. **Personkort (slide-over), seksjonsrekkefølge låst:** Kontaktinfo (e-post/telefon/firma/
   faggruppe — redigeres HER) · **Kapabiliteter i prosjektet** (KRAV: datadrevet radliste som
   tåler vekst — modellen vokser via kapabilitetsfelter på `ProjectMember` (`kanAttestere` og
   `erFirmaansvarlig` finnes alt, målt av cowork), aldri via nye roller; en ny kapabilitet
   skal koste én rad i lista, ikke en redesign. Start-innhold: Prosjektrolle, Attesterer timer) ·
   Brukergrupper (chips) · Deltar i dokumentflyter (visning m/provenans) · lenke
   «Administrer deltakelse i Dokumentflyt-oppsettet →».
8. **Provenans-ordlyd eksakt** (i18n): «Lagt til direkte» / «Følger av brukergruppen {navn}» /
   «Følger av faggruppen {navn}». Samme flyt med to koblinger vises som to rader.
9. **Flyt-deltakelse redigeres ALDRI fra personkortet eller lista** (Kenneth-vedtak § 4 i
   bestillingen). `+`-ikonet i gruppeoverskrift finnes ikke lenger.
10. **Delt invitasjonsmodal** («+ Legg til medlem» i gruppe): søk eksisterende ELLER e-post →
    firma (påkrevd, forhåndsvalgt = inviterers) → faggruppe (valgfri) → brukergruppe
    forhåndslåst fra konteksten. Synlig Avbryt (avbrytbarhets-gaten). Servervei LÅST:
    `medlem.registrer` (663fb256) — én transaksjon, fire bindinger. Ingen serverendringer i
    denne ordren; UI-et kaller den som den er.
11. **Forslagslag, ikke-blokkerende:** lukkbar stripe etter vellykket tilføyelse, innhold etter
    inngang (fra kontaktliste: foreslå gruppe+flyt; fra gruppe: kun flyt; fra flyt: kun
    gruppe). Aldri modal, aldri obligatorisk steg. Tomtilstander på personkortet («Ikke i noen
    brukergruppe · legg til» / «Deltar ikke i noen dokumentflyt ennå»). Ingen persistent
    ufullstendig-badge i lista.
12. **Admin-avgrensning (regel, cowork-tiltrådt):** en seksjon hører på personkortet kun hvis
    verdien er scopet til prosjektet. sitedoc_admins oversikt bor i `/dashbord/admin`; global
    tilstand lenkes, vises aldri inline.

## Server — finnes allerede, røres ikke

Fase 1 er bygget og merget: `medlem.registrer` (663fb256) — én komplett registrerings-
prosedyre, fire bindinger i én transaksjon (faggruppe, brukergruppe, dokumentflyt, org).
`medlem.leggTil` og `gruppe.leggTilMedlem` er slettet, fire kallere migrert; funn A lukket.
**Denne ordren er UI-et.**

**Flytboksen (presisering, cowork-målt):** FUNKSJONEN «start i en dokumentflyt, registrer ny
person, vær tilbake i flyten med henne i rollen» virker ALLEREDE — `dokumentflyt-komponenter.tsx:316`
kaller `medlem.registrer` med `flytBindinger` (:342), atomisk siden 663fb256. Den skal IKKE
bygges i denne ordren, og den venter ikke på del 8 — del 8 er kun REDESIGN av flytboksens UI.
Kenneths akseptansekriterium er altså alt oppfylt; rør ikke flytboks-stien.

## Funksjonsinventar (gate: leveransen sjekkes linje for linje)

Fullt inventar med avgjørelser (18 linjer, bevart/flyttet/erstattet/bevisst fjernet) står i
`kp-kontakter-ia-svar-fabel-2026-09-08.md` rev. 3 § Funksjonsinventar — det er del av denne
ordren. To bevisste fjerninger (Kenneth-vedtak): duplikatrader per gruppe · `+`-ikonet i
gruppeoverskrift. Alt annet bevares eller flyttes som angitt.

## Klikk-budsjett (rapporter faktiske tall ved levering)

| Handling | I dag | Budsjett |
|---|---|---|
| Finne telefonnummer | 0 klikk, skanning av 9-kolonners gruppert rad | 0 klikk, 5-kolonners flat rad |
| Se hvilke flyter en person er i + hvorfor | umulig (chips uten kilde) | 1 klikk |
| Eksisterende kontakt inn i gruppe | skjult `+` i gruppeoverskrift + nedtrekk | ≤ 4 interaksjoner (fane → kort → + Legg til → velg → Legg til) |
| Ny person rett inn i gruppe | to flater (kontakt først, så gruppe) | ≤ 5 interaksjoner i én modal |

## Verifisering (DoD)

1. Build grønn (`pnpm --filter @sitedoc/web build`)
2. i18n komplett begge språk — rename Tilgangsgruppe→Brukergruppe. Kandidatmengde MÅLT av
   cowork 08.09: 14 linjer nb.json (samme sett en.json) · web 4 filer (varianter:
   tilgangsgrupper ×4, tilgangsgruppeId ×4, tilgangsgruppe ×3, TilgangsgruppeId ×3,
   Tilgangsgruppe ×3, TilgangsgruppeForModal ×2) · mobil 1 fil. DB-kategorien er ALLEREDE
   `brukergrupper` — ingen migrering/backfill; renamet er rent UI + variabelnavn.
   ⚠️ `TilgangsgruppeForModal` er et komponent-/typenavn: MELD hvis rename treffer noe
   utenfor de fire filene før du fortsetter
3. Skjermbilder: kontaktliste · gruppefane · åpnet gruppe · personkort (person m/arvet OG
   direkte flyt, f.eks. to-kilders tilfellet) · invitasjonsmodal · forslagsstripe
4. Task-walkthrough mot klikk-budsjettet
5. Regresjonssjekk: eksisterende mutasjoner (faggruppe legg til/fjern `ed21b640`,
   gruppe-CRUD, `medlem.registrer` fra alle innganger) virker uendret
6. Exit-protokoll a–d til fabel

## Ikke i denne ordren

Faggruppe som egen flate (vedtatt bort) · mobil · flytboks-redesign (del 8) ·
sitedoc_admin-flater (del 10/K11) · retning-dokumentets § 2-oppdatering (fabel fører selv).
