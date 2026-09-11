# ORDRE: KA7-revisjon — mal-Opus — fabel 2026-09-11 (v2)

**Metode:** følg `docs/claude/MAL-METODE.md` (MAL-METODE). Denne ordren er selvbærende — normfakta står her; mal-Opus trenger ikke (og har ikke) tilgang til normen.

**Til:** mal-Opus (Kenneth relayer). **Fil som endres:** `packages/db/prisma/seed-bibliotek.ts` (KA7-blokken). Ingen andre maler røres.

## Formål (styrer alle valg)
En KS-sjekkliste skal (1) være effektiv å fylle ut på mobil, (2) gi arbeideren teknisk informasjon om hvilke krav som gjelder, (3) etterlate dokumentasjon (bilder, tall, ja/nei) som viser hva som er levert og bekrefter at kravene er fulgt.

## Faktagrunnlag (fabel har lest normen, NS 3420-K:2024 s. 13–14)
- KA7 «Forberedende arbeider ved gjenbruk av materialer» er et postgrunnlagskapittel: poster KA7.2 Rengjøring, KA7.3 Sortering, KA7.81 begge (areal m²).
- Kravene (godkjenningskriterier, dokumentasjonskrav, utførelse, type materiale) defineres i PROSJEKTBESKRIVELSEN per post — KA7 har ingen egne b)/c)-krav.
- a1) Prisen inkluderer ikke gjenbruksmateriale. Gjenbruk av jord er KB2.3 (ikke KA7).

## Endringer

### 1. Navn og beskrivelse
- navn: `KA7 – Forberedende arbeider ved gjenbruk av materialer`
- beskrivelse: `Rengjøring og sortering av gjenbruksmaterialer (post KA7.2/KA7.3). Gjelder ikke gjenbruk av jord — se KB2.3.`

### 2. Feltliste (erstatter dagens 4 felter — rekkefølge som her)

**FØR:**
1. `Type materiale` — list_single: ["Belegningsstein/heller", "Naturstein", "Kantstein", "Murblokk", "Treverk", "Annet – angi i kommentar"]. Hjelpetekst: «Angi hvilket materiale som gjenbrukes. Mengde og bruksområde står i beskrivelsen (post KA7.2/KA7.3).»
2. `Materialstatus` — list_single (beholdes): ["Sortert og godkjent", "Delvis sortert", "Ikke sortert", "Uegnet"]. NY hjelpetekst: «Vurder tilstanden ved mottak/oppstart. Kravene til godkjenning står i prosjektbeskrivelsen. Ta bilde av materialene slik de står.»
3. `Dokumentasjon på opprinnelse` — traffic_light (beholdes). Hjelpetekst: «Hvor kommer materialene fra? Legg ved følgeseddel/foto hvis tilgjengelig.»
4. `Lagringsplass godkjent` — traffic_light (beholdes). Hjelpetekst: «Tørt, stabilt underlag uten fare for tilsøling eller skade frem til bruk.»

**UNDER:**
5. `Materialer rengjort` — traffic_light (beholdes). NY hjelpetekst: «Rengjort iht. utførelseskrav i beskrivelsen (post KA7.2). Ta bilde etter rengjøring.»
6. `Materialer sortert` — traffic_light (NY). Hjelpetekst: «Sortert etter type/kvalitet iht. beskrivelsen (post KA7.3). Uegnede materialer skilt ut. Ta bilde av sorterte fraksjoner.»

**ETTER:**
7. `Godkjenningskriterier i beskrivelsen oppfylt` — traffic_light (NY). Hjelpetekst: «Kontroller mot godkjenningskriteriene i prosjektbeskrivelsen for posten.»
8. `Dokumentasjonskrav levert` — traffic_light (NY). Hjelpetekst: «Bilder og øvrig dokumentasjon som beskrivelsen krever er lagt ved dette dokumentet.»

### 3. Fase-overskrifter
Genereres av eksisterende fase-mekanisme. Om overskriften «Kontroll FØR utførelse ved overlevering» kommer fra seed/rendering: rett til «Kontroll FØR utførelse». Er den håndredigert i en firmakopi, ikke rør — men meld fra hvor teksten kommer fra.

## Absorbering av MK C-konverteringslista (KA7-radene :166–:168)
Denne ordren ERSTATTER konverteringslistas tre KA7-rader — de strykes fra lista når malen er gatet, og skal ikke konverteres separat:
- :166 «Dokumentasjon på opprinnelse → list_single»: UTGÅR. Feltet forblir traffic_light (felt 3 over) — kommentar/vedlegg per felt dekker detaljene; enkeltvalg gir ingen bedre dokumentasjon her.
- :167 «Lagringsplass godkjent → behold»: dekket av felt 4.
- :168 «Materialer rengjort → behold»: dekket av felt 5.

## Rammer (MK-vedtak, arves)
- Bygges med eksisterende hjelpefunksjoner (`valg`/`trafikklys`/`felt`) — aldri hardkodet JSON.
- `verifisert: false` beholdes eksplisitt. Prod-gaten skal ikke røres.
- Ingen «(AI-utkast)» eller intern sjargong i kundetekst (navn, beskrivelse, hjelpetekster).
- Rotårsak fremfor plaster; ingen endringer utenfor KA7-blokken uten å melde tilbake først.

## Definition of Done
1. `seed-bibliotek.ts` endret; seed kjørt mot lokal DB uten feil (idempotent re-kjøring verifisert).
2. Skjermbilde fra MalBygger av revidert KA7 (alle 8 felter + faser synlige) levert som bevis.
3. Kort avviksmelding hvis noe i ordren ikke lot seg gjøre som spesifisert.

Gate: fabel kontrollerer bevis mot denne ordren før «klar for commit» meldes. Cowork eier merge-timing som vanlig.
