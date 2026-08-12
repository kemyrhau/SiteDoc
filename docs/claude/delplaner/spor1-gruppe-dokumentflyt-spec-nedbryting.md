# Spor 1 — spec-nær nedbryting: Gruppe/dokumentflyt-oppsett

> Fra fabel, 2026-08-05. Erstatter §2–§4 + §3c i retningsskissen
> (`brukeroppsett-dokumentflyt-redesign-retning.md`) med Kenneths vedtak innarbeidet
> (inbox 2026-08-04 «SPOR 1 konsolidert»). Spor 2 (HMS), 3 (økonomi), 4 (kryss-firma) urørt.
> Kode-verifisert: koblings-server-kapabiliteten FINNES (`gruppe.ts:447–463` skriver
> `groupFaggruppe` via deleteMany+createMany; `tilgangskontroll.ts:623/1024` leser den).
> Spor 1 forutsetter samme-firma — ikke design kryss-firma inn (blokkert, `tilgangskontroll.ts:1353`).

## Vedtak lagt til grunn (låst)

- «Dokumentflyt» beholdes på alle nivåer. Access-gruppe → **«Tilgangsgruppe»** i UI (data uendret).
- Brukere → **«Kontakter»**: én kontaktliste som viser tilhørighet (flyt/faggruppe/prosjekt/firma).
- Auto-hopp bort OVERALT (også sjekkliste): 0 maler → deaktivert forklaring; ≥1 → velger m/ forvalgt rad. Funn C-fasit pkt 3 snus.
- Kobling Tilgangsgruppe↔Faggruppe redigerbar fra BEGGE sider; kontakter opprettes fra begge steder.

## Ordre 1.1 — Terminologi-pass (tekst/i18n, ingen logikk)

- **«Gruppe» → «Tilgangsgruppe»** i all UI-tekst der ProjectGroup menes: Brukere-siden (overskrifter,
  filter «Gruppe», kort, modaler), pickere i dokumentflyt-roller, feilmeldinger (inkl. HMS-feilmeldingen
  «Opprett en gruppe med HMS-domene…» → «…tilgangsgruppe…»). Kun i18n-nøkler/visningstekst — ingen
  identifier-/tabellendringer.
- **Nav-punkt «Brukere» → «Kontakter»** — samstemmer med sidens eksisterende interne vokabular
  (`kontakter`/`KontaktMedlem`, overskrift «Kontakter»). Rute-URL kan beholdes (`/oppsett/brukere`)
  for å unngå lenkebrudd; kun visningsnavn endres i dette passet.
- **Tekstfiks:** flytnavnet «Endringmelding» → «Endringsmelding» (Kenneths sidenotat). Dette er
  DATA (flytnavn), ikke i18n — rettes som navneendring i prosjektet det gjelder, eller seed om det
  er seed-data. Opus verifiserer hvor navnet bor før fiks.
- **Forklaringsboks «Hvordan henger dette sammen?»** (én komponent, brukt på Kontakter-siden og
  Dokumentflyt-oppsett): kjedediagram Tilgangsgruppe → (domener) → Faggruppe → rolle i Dokumentflyt.
  Collapsed by default; samme hjelp-mønster som eksisterende `hjelp.*`-blokk på brukere-siden.
- Fasit: (1) ordet «Gruppe» alene forekommer ikke lenger i UI der ProjectGroup menes; (2) nav viser
  «Kontakter»; (3) HMS-feilmeldingen nevner «tilgangsgruppe»; (4) «Endringsmelding» stavet riktig.

## Ordre 1.2 — Kontaktliste med tilhørighet

- Kontakter-sidens tabell utvides til å vise **hele tilhørighetskjeden per kontakt**:
  Tilgangsgruppe(r) · Faggruppe(r) (finnes i dag som `faggruppeKoblinger`, read-only) ·
  dokumentflyt(er) faggruppene deltar i (avledes: faggruppe → `dokumentflyt_medlemmer`) · firma.
  Prosjekt er gitt av konteksten (siden er per prosjekt).
- Visning: kompakt i raden (chips/`· `-separert som dagens `faggruppeNavn`-mønster, brukere-siden
  linje ~1031), full kjede i eksisterende utvid/detalj-visning. Ingen ny side.
- Flyt-kolonnen er AVLEDET og read-only — medlemskap redigeres der det bor (dokumentflyt-siden).
- **Opprett kontakt fra begge steder:** dagens opprett-inngang på Kontakter-siden består; dokumentflyt-
  sidens rolle-picker får «+ Ny kontakt»-inngang som åpner SAMME opprett-modal (gjenbruk, ikke kopi)
  med faggruppe-konteksten forhåndsvalgt.
- Fasit: (1) kontakt med gruppe+faggruppe viser hele kjeden i raden; (2) kontakt uten koblinger viser
  «—» uten feil; (3) «+ Ny kontakt» fra dokumentflyt-siden lander kontakten med riktig faggruppe;
  (4) flyt-kolonnen endres når faggruppen får/mister flytmedlemskap.

## Ordre 1.3 — Kobling Tilgangsgruppe↔Faggruppe, begge innganger

- **Inngang A (Kontakter-siden):** tilgangsgruppe-kortet får felt «Tilknyttede faggrupper»
  (multi-velg av prosjektets faggrupper). Wirer EKSISTERENDE skrivevei (`gruppe.ts:447–463`,
  faggruppeIder-listen i gruppe-oppdateringen) — ingen ny server-logikk.
- **Inngang B (Dokumentflyt-oppsett-siden):** faggruppe-raden får «Tilknyttede tilgangsgrupper»
  (chips + rediger). Samme relasjon fra motsatt side; trenger en tynn mutasjon
  (`faggruppe.settTilgangsgrupper` e.l.) som skriver samme `groupFaggruppe`-rader — gjenbruk
  delete/create-mønsteret, IKKE dupliser logikken: felles helper i server-laget.
- Konsistens: begge innganger invaliderer begge queries (gruppe- og faggruppe-hent) så flatene
  aldri viser ulik kobling.
- Advarsel ved frakobling som gjør en flyt-rolle tom (gruppen var eneste kilde til medlemmer):
  bekreft-dialog, ikke blokkering.
- Fasit: (1) koble fra A → synlig på B uten reload av motsatt side (invalidering); (2) koble fra
  B → synlig på A; (3) frakobling som tømmer rolle gir advarsel; (4) `tilgangskontroll.ts`-stiene
  (623/1024) fungerer uendret — ingen endring i tilgangsberegning.

## Ordre 1.4 — Åpne-regel: auto-hopp bort overalt

- Velger-regelen (Funn C §0) endres for BEGGE flater + mobil: 0 opprettbare maler → deaktivert
  knapp m/ forklaring; **≥1 → velgeren vises alltid**, markør på sist-brukt (finnes ingen → første/eneste
  rad). Enter oppretter — hurtig-stien er like rask som auto-hopp.
- Funn C-regresjonsfasit pkt 3 SNUS: «nøyaktig 1 opprettbar mal → velger vises m/ malen forvalgt;
  Enter oppretter». Øvrig fasit (Funn C + v2) uendret.
- HMS-velger-integrasjonen (spor 2, Funn E) bygger på denne regelen men er IKKE del av ordren.
- Fasit: (1) 1 mal → velger m/ forvalgt rad, Enter oppretter; (2) gjelder sjekkliste OG oppgave
  OG mobil; (3) 0 maler-oppførsel uendret; (4) ingen sist-brukt-nøkkel skrives før opprettelse (som før).

## Ordre 1.5 — Gruppe-forhåndsvisning ved dokumentflyt-opprett

- Opprett-inline-inputen på dokumentflyt-siden (kun navnefelt i dag, `opprettMutation`
  name+faggruppeId) utvides med en passiv forhåndsvisningslinje: «Medlemmer via {faggruppe}:
  {tilgangsgrupper/antall}» basert på faggruppens koblinger (fra 1.3).
- Ingen kobling finnes → hint «Ingen tilgangsgrupper tilknyttet {faggruppe}» med lenke til
  inngang B (1.3). Ikke obligatorisk steg — opprett uten kobling er fortsatt lovlig.
- Fasit: (1) faggruppe m/ koblet gruppe viser gruppen(e) før opprett; (2) uten kobling vises hint
  m/ fungerende lenke; (3) opprett-mutasjonen selv er uendret.

## Rekkefølge + avhengigheter

1.1 (terminologi) → uavhengig, først. 1.2 og 1.4 → uavhengige av hverandre, kan gå parallelt.
1.3 → etter 1.1 (bruker nye begreper). 1.5 → etter 1.3 (leser koblingen).
Fundament-ordren (domene-wire §4) ligger UTENFOR spor 1 og kan gå når som helst — men
HMS-feilmelding-teksten i 1.1 og domene-chips på gruppe-kortet bør lande i samme visuelle pass
om de treffes samtidig.

## Utenfor scope (eksplisitt)

Kryss-firma (spor 4) · HMS-velger/filter/navigasjon (spor 2) · endringsmeldinger (spor 3) ·
rute-URL-endring for /oppsett/brukere · endringer i tilgangsberegningen.
