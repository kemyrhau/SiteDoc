# Malforvaltning — samlet IA-tegning (svar på ordre 13.09)

Dato: 2026-09-13 · fra fabel · mockup: docs/redesign/malforvaltning-ia-mockup-fabel-2026-09-13.dc.html
Dekker A–F med vedtatte navn (terminologi.md § 0). Fire skjermer i én DC.

## Hva tegningen sier
- **A (#5/#6/#7):** All forvaltning i Innstillinger › Malforvaltning, faner
  Firmaarkiv / SiteDoc-arkiv / Papirkurv. Malarkiv og Papirkurv ut av venstremenyene.
  #1/#2 (versjoner bak + ↻) bor i Firmaarkiv-fanen. Sperren (mal.ts:500) MØTES ved
  Slett i Firmaarkiv (dialog som navngir blokkerende dokumenter) og LØSES i
  Papirkurv-fanen — dialogen lenker dit.
- **B (#20):** Nivåbanner under toppfeltet i MalBygger og alle én-nivå-flater:
  SITEDOC-ARKIV (fiolett) / FIRMAARKIV (blå) / PROSJEKTARKIV (grønn), med scope-tekst
  («Endringer gjelder …») og «Tilbake til …». Prosjektarkivet får navnet sitt:
  listen i Oppsett › Produksjon heter «Prosjektarkiv».
- **C (#9):** Søk i Papirkurv-fanen filtrerer kun visningen; «Tøm papirkurv (N)»
  viser alltid totalen og bekreftelsen lister alt — tellefellen gjeninnføres ikke.
  Globalt søk treffer papirkurven med «🗑 I papirkurven»-merke + Gjenopprett i
  trefflisten. Auto-tømming 90 dager (N = Kenneth-valg), nedtelling per rad.
  Avgrensning (Kenneth-spm 13.09): papirkurv-treff i globalt søk er på
  NAVN/metadata — innholdssøkene (ftdSok fulltekst, aiSok hybrid) søker fortsatt
  bare aktive dokumenter, is_active-filteret røres ikke.
  Én papirkurv, to innganger: fanen viser alt (KILDE-kolonne), Prosjektoppsett
  viser samme komponent filtrert.
- **D (#18):** Retning: ÉN editor — SiteDoc-maler redigeres i samme MalBygger med
  SITEDOC-ARKIV-banner; admin/bibliotek-panelet utgår. ⚠ Kapasitetsutvidelsen
  (legge til/fjerne objekter) gates av Kenneth; firma-admins lesevisning i
  SiteDoc-arkiv-fanen står uansett utfall.
- **E (#19, Kenneth-justert 13.09 kveld):** Modalen får søk (navn + referanse,
  formen fra gamle lånedialogen) øverst, over fanene — filtrerer begge faner og
  folder ut grupper med treff. SAMME modell i begge faner: gruppert på
  standard/kapittel («Egenlagde» som egen gruppe), sammenslått som start.
  Coworks forslag om åpen Firmaarkiv-fane er overstyrt av Kenneth.
  ✓ Kenneth-gatet 13.09 kveld: SiteDoc-fanen ULÅST på prosjektnivå — engangsmal
  for ett prosjekt skal ikke måtte innom firmaarkivet. v3-låsen utgår.
  (Attribusjonsretting: ulåst var fabels lesning av E, ikke coworks forslag —
  hans forslag gjaldt kollaps/søk. Nå uansett avgjort av Kenneth.)
  Konsekvens ført som senere vurdering: direktehentet mal er prosjektmal og
  følger ikke firmaets ↻-forvaltning. Typefilter per flate fra v3 gjelder fortsatt.
- **B-presisering (Kenneth 13.09 kveld):** venstre i banneret er NAVIGASJON
  (sidenavn fra whitelist, aldri et nivånavn — SiteDoc-admin: «Tilbake til
  mal-listen»), høyre er POSISJON («Du redigerer i» + nivåmerke + scope).
  De deler aldri ordlyd.
- **F:** «Tilbake til …»-regel: vises kun på flater nådd via kontekstbytte-lenke
  (aldri via venstremeny), øverst venstre over tittel, maks én, etikett fra
  whitelist — primitiven fra runde 97 gjenbrukes uendret.

## Ikke tegnet (DoD 4)
MalRevisjon/Historikk-fanens innhold (Kenneth gater skjema; plassen er reservert i
malvisningen) · diff/merge for ↻ · SiteDoc-admins editor-kapasitet utover retningen ·
hentStandarder-innstramming · HMS-lenken i slett-sperren · mobilvisning av
Malforvaltning · strengharmoniseringen (utløses av tegningen, coworks jobb —
flatene er Malforvaltning med tre faner, MalBygger-banner, Hent fra arkiv,
globalt søk-merket).

## Rekkefølgekravet på #8: trukket
Coworks innvending tas: hullet fantes fra før, #1/#2 innførte ikke oppdateringsveien.
Historikken starter når MalRevisjon-tabellen er vedtatt — uansett når.

## Neste steg
1. Kenneth: gate tegningen + N dager auto-tømming (SiteDoc-fanen er avgjort: ulåst).
2. Etter gate: fabel skriver ordre(r) til redesign-Opus — Malforvaltning-flaten,
   nivåbanneret og modal-søk/kollaps kan gå som separate runder.
