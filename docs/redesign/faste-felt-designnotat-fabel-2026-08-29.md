# Designnotat: FASTE FELT i malbyggeren — koble på, rydde ut

**Fra:** fabel · **Dato:** 2026-08-29 · **Svar på:** relay/fabel-faste-felt.md (cowork 2026-08-29)
+ Kenneths tillegg 29.08 (emne som søkbart stikkordfelt; lokasjon valgfri per sjekkliste;
faggruppe fjernes hvis funksjonsløs).
**Status:** forslag — venter Kenneth-vedtak på to spørsmål nederst. Ingen kode i denne runden.

> 🔴 **Dette notatet ERSTATTER anbefalingen i**
> `lokasjonsmodellen-designnotat-fabel-2026-08-29.md` **(§ Anbefaling + § Spørsmål).**
> Kenneth har svart på spørsmål 1 der ved å snu vedtaket: samme mal skal kunne gi både
> punkt-dokumenter og byggeplass-dokumenter — brukeren aktiverer lokasjon selv, ingen
> automatikk. Auto-åpne-ordren er ERSTATTET (cowork har merket den). Faktagrunnlaget og
> premiss-seksjonene i lokasjonsnotatet står.

## Anbefaling per felt (kort)

**Emne (`showSubject`) — kobles på som ekte funksjon.** Kenneths opprinnelige ønske, og det
billigste å innfri: datafeltet finnes (`Checklist.subject`, schema:1080), API-et tar imot ved
opprettelse (`sjekkliste.ts:266,527`), og opplistingen har allerede en sorterbar + filtrerbar
emne-kolonne på både sjekklister og oppgaver (`sjekklister/page.tsx:695-698`,
`oppgaver/page.tsx:761-764`). Det som mangler er skriveveien:
- Valgfritt stikkordfelt i opprett-modal + redigerbart på detaljsiden (til lukket status).
- Malens `subjects`-liste (forhåndsdefinerte emner, schema:952) blir forslag i et
  nedtrekk-med-fritekst — aldri obligatorisk (effektivitets-gaten).
- Fritekstsøket («Søk sjekklister…») inkluderer subject.
- `showSubject` av = feltet vises ikke for den maltypen.

**Lokasjon (`showLocation`) — kobles på, med revidert modell (Kenneths snuoperasjon):**
- Mal-flagget **tillater**, brukeren **aktiverer**: `showLocation` av = maltypen har aldri
  lokasjon, feltet rendres ikke. På = feltet finnes, men er passivt til brukeren selv legger
  til tegning/punkt.
- Dagens masete «Ikke satt — klikk for å velge» erstattes av en diskret
  «+ Legg til lokasjon»-affordance. Null er et gyldig, ferdig svar — ingen automatikk spør.
- Ingen auto-åpning av tegning. Arv fra kontrollpunkt (tegning, ikke pin — `b987d793`) står:
  arven forhåndsutfyller, brukeren kan fjerne eller endre.

**Bestiller-faggruppe (`showFaggruppe`) — fjernes fra FASTE FELT.** Kenneth: bør ikke leve
uten funksjon; dokumentflyten fungerer nå. Flagget er dødt (kun Zod-input + dupliser-kopiering,
coworks måling), og vedtaket i `domene-arbeidsflyt.md` sier faggruppe er avledet av flyt —
en synlighetsbryter ville motsagt modellen. Raden og kolonnen `show_faggruppe` fjernes.
**Følgesak (egen, ikke denne ordren):** FAGGRUPPE-nedtrekket på sjekklistens detaljside må
avklares mot flytmodellen, slik oppgaver alt er (`feat/oppgave-arver-flyt`).

**Prioritet (`showPriority`) — backlog.** Leses kun av mobil (`oppgave/[id].tsx:652`);
`packages/pdf/typer.ts:117` deklarerer uten å lese. Konsistens web/PDF føres som backlog-sak,
kobles ikke i denne runden. Raden i FASTE FELT beholdes (den virker på mobil) med korrigert
hjelpetekst.

**Tekstene i FASTE FELT rettes samtidig:** «Velges ved opprettelse» (faggruppe) er alt feil
for oppgaver; hver rad skal beskrive faktisk atferd per flate.

## Spørsmål til Kenneth (avgjør formen)

1. **Utskrift når lokasjon ikke er aktivert:** utelate lokasjonsseksjonen helt, eller skrive
   «Byggeplass: {navn}» fra dokumentets kontekst? Mitt forslag: utelate — rapporten som
   gjelder byggeplassen sier det via prosjekt/byggeplass-headeren den alt har.
2. **Emne-kolonnen i opplistingen:** skal den inn som synlig standardkolonne (slik skissen
   din antyder), eller fortsatt bare tilgjengelig via «Velg parameter»? Mitt forslag:
   standard på, siden feltet nå faktisk får innhold.

## Neste steg

Mockup (.dc.html) av malbygger-seksjonen + detaljsidens emne/lokasjon-felt FØR ordre
(rammeverket: mockup ved UX-usikkerhet), deretter én samlet ordre for Emne + Lokasjon +
faggruppe-fjerning. Funksjonsinventar-gate gjelder: ordren skal inventere dagens
`LokasjonVelger`-atferd (autovalg bygning/tegning, `standardTegning`-default, pin kun for
bilde-filer) linje for linje.

## Grunnlag (målt mot koden 2026-08-29)

Coworks målinger verifisert der jeg har målt selv:
- `showSubject`/`showFaggruppe`/`showLocation` døde utenfor malbygger + Zod + dupliser —
  bekreftet for web (`apps/web/src`, grep `subject`/`showLocation`/`harAktivLocation`) og
  mobile screens; API-lesing kun `mal.ts:328-329,483-484`.
- `LokasjonVelger` ubetinget på detaljsiden (`page.tsx:852`).
- Emne-lesesiden finnes allerede (kolonne + filter + sort i begge opplistinger) — dette var
  ikke med i coworks notat og REDUSERER kostnaden på emne-punktet vesentlig.
- Enkeltmålt (kun coworks måling): `showPriority`-lesingen i mobil, migreringsdato
  `20260326033000`, PDF-deklarasjonen.
