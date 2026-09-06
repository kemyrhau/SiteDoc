# FL — designnotat: prosjekt-livssyklus — fabel 2026-09-06

Svar på coworks FL-bestilling + måling `relay/fabel-firmanivaaet-mangler-styring.md`
(funn 1). Kenneth-vedtak lagt til grunn: avslutning er FRYSING, ikke sletting
(domene-arbeidsflyt.md). Mockup: `mockups/Prosjektlivssyklus Mockup.dc.html`.

## Designlås

1. **Tilstandsmodell — fire verdier, låst som enum (fri String utgår):**
   - `active` **Aktivt** — alt som i dag.
   - `completed` **Avsluttet** — FROSSET: lesing og PDF-eksport alltid tilgjengelig;
     all skriving sperret (nye dokumenter, redigering, utfylling, timer, medlemmer).
     Synlig i lister.
   - `archived` **Arkivert** — frosset + skjult fra velgere og standardlister, bak
     «vis arkiverte»-filter. Aldri slettet.
   - `deactivated` **Deaktivert** — leverandør-sperre, KUN sitedoc-admin. Bevisst ikke
     kundekontroll (svar på coworks spørsmål): den er vårt virkemiddel, ikke firmaets
     livssyklus. Kunden ser den som sperret prosjekt med kontakt-oss-tekst.
2. **Frosset betyr skriving sperret — håndhevet av ÉN delt server-guard** i skriveveiene
   (samme mønster som påkrevd-vakten), ikke per-rute-sjekker og ikke bare UI. Guarden er
   det som gjør nb.json:2218 («arkivert og skrivebeskyttet») sann. UI speiler: deaktiverte
   skriveknapper + tilstandsbanner med Gjenåpne.
3. **Hvem: firma-admin** eier Aktivt ↔ Avsluttet ↔ Arkivert (terminologi § 0: firmaet eier
   prosjektene). Gjenåpning er symmetrisk, samme rolle. **Ingen bekreftelsesmodal** —
   frysing er reversibel og trygg (effektivitets-gaten pkt 3: dobbel sikring oppå
   sikkerhetsnett er forbudt). Menyraden viser i stedet spor: «Avsluttet 28.08 av X».
4. **Hvor: BEGGE, én delt mutasjon.** Firmalisten (/dashbord/firma/prosjekter) får
   ⋮-radmeny med tilstandshandlingene — eneste flate som ser alle prosjekter; prosjekt-
   oppsettet beholder status-seksjonen med SAMME tre valg og samme norske tekster.
   Flervalg i lista utsettes (pilot har få prosjekter) — noteres som senere sak.
5. **Status vises alltid på norsk via t()** — dagens rå «archived»/«completed» i
   firmalisten (page.tsx:149) rettes i samme ordre.
6. **Frosset-atferd i randsonene:** papirkurv-gjenoppretting inn i frosset prosjekt
   sperres (gjenåpne først); pågående signaturrunder kan LESES men ikke signeres —
   avslutning med åpen manko krever ingen bekreftelse, men banneret i prosjektet viser
   mankoen (manko utelates aldri). Flagg-nøytralt hele veien.

## Klikk-budsjett

Avslutte fem ferdige prosjekter: i dag umulig for kunden (må be sitedoc-admin / 4+ steg
per prosjekt innenfra for de tre synlige verdiene); etter: 2 interaksjoner per prosjekt
fra firmalisten (⋮ → Avslutt). Gjenåpne: 1 fra banneret inne i prosjektet.

## Grense mot funn 2 (onboarding)

FL er kun livssyklus. Funn 2 (kom-i-gang uten nav-hjem, portefølje-onboarding) hører til
ON/REG fase 3 — mitt kall der er minimum-først: gi kom-i-gang et nav-hjem nå (én lenke),
portefølje-status designes i REG fase 3. Egen sak, ikke i FL-ordren.

## Cowork verifiserer (enkeltmålt)

- At én delt guard kan dekke alle skriveveier (finnes et felles mutasjonslag i apps/api,
  eller må guarden inn i tRPC-middleware?). Guard-plasseringen er coworks kall — designet
  låser bare at sperren er server-side og delt.
- Om andre flater leser `erDeaktivert`-mønsteret og må lære de nye tilstandene.

## Neste

Kenneths blikk på mockupen → cowork kost-sjekk → kodeordre (guard + enum + firmaliste-meny
+ banner + i18n). Designgate: atferdstest — Kenneth avslutter et prosjekt fra firmalisten
og forsøker å fylle ut en sjekkliste i det.

## TIL MASTERPLAN (tillegg — cowork fletter)

- FL-raden: «Design levert 06.09 (`fl-prosjektlivssyklus-fabel-2026-09-06.md` + mockup):
  4 tilstander som enum, frysing via én delt server-guard, firma-admin eier livssyklusen,
  handling i firmaliste + prosjektoppsett, deactivated forblir leverandør-sperre.
  Venter Kenneth-blikk → cowork kost-sjekk → ordre.»

— fabel
