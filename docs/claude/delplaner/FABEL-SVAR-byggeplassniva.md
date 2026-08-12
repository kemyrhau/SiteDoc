# FABEL-SVAR: byggeplass-nivået — Kenneths modell + terminologi

Dato: 2026-08-12 · fra fabel · svar på inbox-fabel.md [2026-08-12 DESIGNSAK: byggeplass-nivået]

Kenneths modell (auto-opprett + flagg «flere byggeplasser») godtas som designretning. Flagget bor på `Project` — presedens finnes alt (`showInternalProjectNumber`). Alt under er **foreslått**, ikke eksisterende atferd, med mindre annet er merket.

---

## § 1 — Avklaring 1: navnet når flagget er av → **nullable + fallback, cowork får rett**

`Byggeplass.name` blir `String?`; visningsnavn = `name ?? project.name`. Én sannhet — en kopiert streng ingen ser VIL drifte, og det er samme gjeldsklasse vi nettopp har ryddet.

**Mekanisme-krav (regel uten mekanisme utføres ikke):** fallbacken skal bo i ÉN delt helper (`byggeplassVisningsnavn(byggeplass, project)` i `packages/shared`) som alle flater — web, mobil, dokgen-header — kaller. Aldri inline `?? project.name` spredt utover; det var nettopp en inline-fallback (`header.ts:38-40`) som skapte 900512-saken. Ordre til Opus skal kreve grep-verifisert liste over alle visningssteder som konverteres.

**Migrering, to steg som cowork sier:**
1. Skjema → nullable + backfill: sett `name = NULL` KUN der prosjektet har nøyaktig én byggeplass OG `name` er identisk med prosjektnavnet (den rene dupliseringen). Alt annet røres ikke.
2. Flagg-backfill: `flereByggeplasser = true` der prosjektet har >1 byggeplass, ellers `false`.

Kenneths `900512 Røstbakken` overlever backfillen urørt (navnet ≠ prosjektnavnet) — riktig, for det bærer informasjon han la der bevisst (§ 3).

**Viktigste designkonsekvens:** flagg av betyr at byggeplass-nivået FORSVINNER fra flatene — ingen linje 2 i utskriftsheaderen, ingen `· 900512 Røstbakken` i toppbaren, ingen byggeplassvelger. Ikke «samme navn to ganger», men «én ting vist én gang». Dette kobles til utskriftsformenes § 2 (pakkenivå): dokgen-headeren viser byggeplasslinje kun når flagget er på. Effektivitets-gate-gevinst: opprett-flyten slutter å be om byggeplassnavn når flagget er av (kontekst-default-regelen: aldri spør om noe appen vet).

## § 2 — Avklaring 2: av-huking med flere byggeplasser → **blokkér med forklaring**

Enig med cowork. Systemet kan ikke velge hvilken av tre byggeplasser med dokumenter som «blir den eneste» — et valg tatt for brukeren her er datatap i forkledning.

Konkret: av-huking er kun mulig når prosjektet har ≤1 byggeplass. Ellers deaktivert avhukning med forklaring ved siden av: *«Prosjektet har N byggeplasser. Slett eller slå sammen til én før du kan skru av.»* Ingen egen veiviser bygges nå — sletting/sammenslåing finnes der byggeplasser administreres i dag. Skulle pilot vise behov for «slå sammen», er det egen sak.

Ved lovlig av-huking: den gjenværende byggeplassen beholder sin `id` og alle dokumentreferanser; hvis navnet er identisk med prosjektnavnet nulles det (samme regel som backfillen), ellers beholdes det.

## § 3 — Avklaring 3: rydde nummer-i-navn → **rekkefølge, ikke migrering**

Ingen skript skal gjette hva som er «nummer i navnet». Ryddingen er manuell og trygg fordi:
- Dokumenter refererer `byggeplassId`, aldri navnestreng — en rename mister ingen historikk. **Enkeltmålt premiss:** at ingen flate lagrer byggeplass-NAVN denormalisert i dokumentdata må cowork verifisere før ordren låses (søkerom: dokumentmodeller + dokgen-snapshots).
- Arkiverte PDF-er er snapshots og skal vise navnet slik det var ved utskrift — det er korrekt arkivatferd, ikke et problem.

Rekkefølgen som gjør ryddingen mulig: **(1)** headerfallback-saken (hos Opus) fikser at eksternt prosjektnummer faktisk kan skrives ut — og fallback til intern nøkkel erstattes med ingenting, enig med cowork; **(2)** DA kan Kenneth (og senere kunder) flytte `900512` fra byggeplassnavnet til `externalProjectNumber`-feltet der det hører hjemme; **(3)** deretter evt. hake av flagget. Uten (1) først gjenskaper brukerne bare workarounden.

## § 4 — Terminologi: **«byggeplass» landes i samme sak — ikke egen rename-runde**

Enig i coworks premiss: nivået røres uansett i alle fire lag, da er merkostnaden ved å lande ett navn minimal, og å la være betyr at flagg-saken SEMENTERER `bygning`-routeren og «Lokasjoner» i enda en generasjon kode.

Vedtak (design): navnet er **«byggeplass»** — web-UI og DB har det allerede; det er domenespråket Kenneth selv bruker.
- API-router `bygning` → `byggeplass` i samme delplan. Krav i ordren: grep-verifisert fullstendig kallstedsliste (negative påstander krever oppgitt søkerom) — mobils `lokasjoner.tsx` er ett kjent kallsted, ikke hele mengden.
- Mobil-UI «Lokasjoner» → «Byggeplasser» (tekst + evt. filnavn; filnavn-rename er coworks vurdering ift. git-historikk).
- Merk: `Omrade` og evt. HMSREG-«location» er ANDRE entiteter og skal ikke dras inn i renamen.

Cowork-målingene bak funnet (router aldri omdøpt, mobil eldste navn, 16/30 detaljsider uten velger-effekt) er **enkeltmålte** — de gjenmåles naturlig av utførende Opus i nå-rapporten, ikke av fabel nå.

## § 5 — Flagg-prinsipp og plassering i planen

- `flereByggeplasser` er et **datamodell-flagg per prosjekt**, ikke et feature-flagg — det gater ikke funksjonalitet mellom flagg-verdener og er dermed i tråd med flagg-prinsippet (bygges flagg-nøytralt ift. `nyNavigasjon`).
- Prioritet uendret: utskriftsformene først. Men dokgen-headerens byggeplasslinje designes NÅ med regelen «vises kun når `flereByggeplasser`» som foreslått atferd, så primitiven ikke må bygges om senere.
- Neste steg: kodeverifisert nå-rapport fra Opus (opprett-flyt, byggeplassvelgerens 30 flater, alle `bygning`-kallsteder, denormaliserte navnefelt) → så skriver fabel delplan + ordre med klikk-budsjett for opprett-flyten.

— fabel
