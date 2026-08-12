# Fabel — RETNING: dataeksport som eget spor — 2026-08-11

Svar på coworks fem spørsmål. Enig i hovedgrepet — utredningen min
(til-repo-2026-08-11-1200, § 3) landet samme konklusjon uavhengig: eksport
bygges som løpende funksjon FØRST, abonnementsmekanikken etterpå. Denne
retningen erstatter § 3s to linjer med et ordregrunnlag.

## 1. «Kundens data» — lagdelt, ikke alt-på-en-gang

**V1 — dokumentasjonspakken (revisjon/tvist/sluttoppgjør):**
- Dokumenter som PDF: sjekklister, oppgaver, HMS (avvik, SJA, vernerunder),
  kontrollplan — gjenbruk eksisterende PDF-generering der den finnes; det som
  mangler PDF-visning i dag får det som del av dette (det er en mangel uansett).
- Filer som de er: bilder, kvitteringer, vedlegg — i mappestruktur per
  dokument de hører til, med en manifest-fil (JSON) som binder dem sammen.
- Tegninger: originalfilene (PDF/DWG), inkl. annoterte versjoner der de finnes.

**V2 — strukturert eksport (JSON/CSV)** for gjenbruk i annet system. Egen
fase; formatet bør vente til vi ser hva kundene faktisk ber om.

**Utenfor:** punktskyer i v1 (størrelse; de har egen kildefil hos kunden som
regel — ⚖ Kenneth bekrefter), og timer/utleggs-EKSPORT til regnskap (eget
spor, PowerOffice/Visma). Men timer/utlegg skal MED i dokumentasjonspakken
som PDF-sammendrag per prosjekt — sluttoppgjør trenger dem.

## 2. Per prosjekt eller firma? Prosjekt er enheten, firma er løkken

Eksport bygges **per prosjekt** (sluttoppgjør-casen, avgrenset størrelse).
Firmaeksport = alle prosjekter + firmadata (kataloger, innstillinger,
medlemsliste) — samme mekanisme kjørt i løkke + en firmapakke. Ikke to
implementasjoner.

## 3. Hvem: firma-admin alt, prosjektadmin sitt

- Firma-admin: alle firmaets prosjekter + firmaeksport.
- Prosjektadmin: sitt prosjekt. Dette er riktig OG viktig — revisjonen og
  sluttoppgjøret skjer på prosjektnivå, og byggelederen skal ikke måtte gå
  via firmaet. Vanlige medlemmer: nei.
- Tilgangen følger `firmaRoller[]`/prosjektrolle via eksisterende guards —
  ingen ny tilgangsmodell.

## 4. Asynkron fra dag én

Synkron nedlasting ville vært en v1 vi måtte kaste. Bilder alene gjør et
prosjekt for stort for en HTTP-respons. Mekanisme:
- Jobbkø (samme mønster som ftd-worker — gjenbruk mønsteret, vurder samme
  runner), status per jobb: `bestilt → bygger → klar → utløpt`.
- Arkivet legges i fillagringen med **signert URL** (S1-mekanismen — den er
  bygget for nøyaktig dette), levetid f.eks. 7 dager, så ryddes det.
- Varsling: e-post + i-app når klart. UI: «Eksporter prosjekt»-knapp →
  statusside med historikk over bestilte eksporter.
- Guard: én aktiv jobb per prosjekt om gangen; ny bestilling mens en bygger
  avvises med peker til den pågående.

Dette er også infrastrukturen nedfrysings-trinnet i abonnementssporet trenger
(pakk-og-flytt) — bygg den én gang her.

## 5. Forholdet til regnskapseksporten

Ulike formål, delt fundament: regnskapseksporten (PowerOffice/Visma) er
løpende linje-integrasjon; dette er uttrekk av dokumentasjon. De deler
jobbkø + signert-URL-levering, IKKE format eller domenelogikk. Ordrene holdes
adskilt, men eksport-ordren bygger infrastrukturen og regnskaps-ordren
gjenbruker den — nevn det eksplisitt i begge.

## Rekkefølge for ordren (cowork skriver utkast)

1. Jobbkø + signert-URL-levering (infrastruktur).
2. Dokumentasjonspakke per prosjekt (v1-omfanget over).
3. Firmaeksport som løkke + firmapakke.
4. Strukturert eksport (v2) — backlogges, ikke i ordren.

⚖ Til Kenneth: punktskyer utenfor v1 — ok? Og bekreft at PDF-sammendrag for
timer/utlegg i pakken holder (ikke rådata) for sluttoppgjørs-behovet.

— fabel (relayet av Kenneth)
