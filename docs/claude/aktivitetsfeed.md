---
status: planlagt
sist_verifisert_mot_kode: 2026-05-01
sist_endret: 2026-05-01
gjelder_versjon: post-Timer + post-Maskin
avhenger_av:
  - fase-0-beslutninger.md (Activity-tabell fra § E.1)
  - timer.md (Fase 3 — venter)
  - maskin.md (Fase 1 — venter)
påvirkes_av_beslutninger:
  - A.3 (audit-mønster)
---

# Aktivitetsfeed (Dashboard)

**Status:** Planlagt fase. Ikke startet. Forutsetter at Timer-modul (Fase 3) og Maskin-modul (Fase 1) er ferdig først.

**Konsept:** Twitter/Facebook-lignende feed på dashboard som viser aktivitet i firmaet — sjekklister opprettet, oppgaver lukket, RUH/HMS registrert, etc.

## Tilgangsmodell

- `organizationId` styrer tilgang.
- **Intern ansatt** (samme org) → ser firmaets fulle feed.
- **Ekstern prosjektpartner** (annen org) → **TBD: egen designrunde påkrevd.** Kandidater (ikke valgt):
  - A: ser kun aktivitet i prosjekter de er ProjectMember på, filtrert per faggruppe-tilhørighet
  - B: ingen feed — eget partner-dashbord
  - C: cross-org push-modell — hovedentreprenør sender eksplisitt aktivitet til UE-firmaets feed

## Hendelsestyper (konfigurerbart per firma)

Initielt sett (kan utvides senere):
- Sjekkliste: opprettet / statusendring
- Oppgave: opprettet / lukket
- RUH/HMS: registrert

Konfigureres via ny kolonne `OrganizationSetting.feedHendelsetyper` (Json-array av enum-strings).

## Feed-element (UI)

```
[Avatar] Navn  •  Prosjektnavn  •  2t siden
Hendelsestekst (f.eks. «Lukket sjekkliste «Daglig sjekk maskin 308»»)
[Se →]   ← lenke til entiteten
```

## Datamodell — bruk eksisterende `Activity`-tabell

`Activity`-tabellen finnes allerede i prod (opprettet i Fase 0 § E.1, commit `13a746a7`). **Produsent-kode finnes** — 7 `activity.create()`-kall i `apps/api/src/routes/` (`timer/dagsseddel.ts`, `vareforbruk.ts`, `vareImport.ts`) skriver til tabellen (verifisert 2026-07-16 mot develop `d1c6b4c9`). ❌ Feed-KONSUMENTEN — dashboard-feed som leser `Activity` — er ikke bygget ennå; det er feed-UI-et denne planen dekker.

**Schema-felter** (allerede dekkende for feed-formålet):

| Felt | Bruk |
|---|---|
| `actorUserId` (nullable, ingen FK per A.3) | Hvem utførte handlingen |
| `actorNavnSnapshot` | Navn ved hendelses-tidspunkt (overlever User-sletting) |
| `organizationId` | Filter for feed-tilgang |
| `projectId` | Sekundært filter, vises i UI som «Prosjektnavn» |
| `targetType` | «sjekkliste» \| «oppgave» \| «ruh» \| etc. |
| `targetId` | UUID til entiteten |
| `action` | «opprettet» \| «status_endret» \| «lukket» \| etc. |
| `payload` (Json) | Hendelse-spesifikk data: gammel/ny status, tittel-snapshot, etc. |
| `createdAt` (Timestamptz) | Sortering |
| `retainedUntil`, `anonymizedAt` | GDPR-håndtering |

**Indekser klare for feed-queries:**
- `(organizationId, createdAt)` — primær feed-query
- `(projectId, createdAt)` — prosjekt-spesifikk feed (post-Fase 1)
- `(targetType, action, createdAt)` — filtrert visning

**Tilnærming valgt — ikke derivasjon:** Derivasjon fra `updatedAt` på Sjekkliste/Task/etc. ble vurdert og forkastet:
- Kan ikke skille hendelsestyper (opprettet vs statusendring)
- Kan ikke spore tilbakerullinger
- Treg i store firma siden alle entitet-tabeller må unioneres
- Ingen GDPR-mekanikk

## Hendelsesproduksjon (event-hooks)

Trengs ved alle relevante mutations:
- `apps/api/src/routes/sjekkliste.ts` — opprett, oppdater (status), slett
- `apps/api/src/routes/oppgave.ts` — opprett, oppdater (status), slett
- `apps/api/src/routes/[ruh].ts` — opprett (RUH-modul må kartlegges separat)

Abstraheres som hjelpefunksjon i `apps/api/src/utils/aktivitet.ts`:

```typescript
async function loggAktivitet(input: {
  ctx, targetType, targetId, action, payload?
}): Promise<void>
```

Henter `actorUserId`, `actorNavnSnapshot` (snapshot fra User), `organizationId`, `projectId`, `ipAddress`, `userAgent` fra ctx. Skriver til `Activity`. Ikke-blokkerende — feilet logging skal ikke feile mutation-en.

## Polling-strategi

**Polling via tRPC `refetchInterval`** — ikke SSE eller WebSocket.

Begrunnelse:
- Ingen WebSocket/SSE-infra finnes i kodebasen i dag → krever ny PM2-prosess + reverse-proxy-config + klient-kode
- Byggeplass-feed er **ikke real-time-kritisk** (ikke chat) — 30–60s polling-intervall er rikelig
- tRPC har innebygd støtte: `useQuery({ refetchInterval: 30_000 })`
- Lav DB-belastning med Activity-indeksen `(organizationId, createdAt)` + LIMIT 50

**Anbefalt polling-intervall:** 30 sekunder (kan gjøres konfigurerbart senere hvis behov).

**Fase 2 (senere):** vurder SSE hvis kunde-tilbakemelding krever mer real-time. SSE er lettere enn WebSocket og fungerer over standard HTTP.

## Konfigurasjon (OrganizationSetting-utvidelser)

Tre nye kolonner:

| Kolonne | Type | Default | Beskrivelse |
|---|---|---|---|
| `feedHendelsetyper` | Json (string-array) | `["sjekkliste_opprettet","sjekkliste_status","oppgave_opprettet","oppgave_lukket","ruh_opprettet"]` | Hvilke hendelsestyper vises i feed |
| `feedPeriodeDager` | Integer | `10` | Hvor langt tilbake feed viser. Pr 2026-05-01 Kenneth-presisering: konfigurerbart per firma |
| `activityRetentionAar` | Integer | `5` | GDPR-retensjon. Aktivitet blir anonymisert etter X år |

Eksponeres via eksisterende `organisasjon.hentSetting` + `organisasjon.oppdaterSetting` (utvides med nye felter).

**UI:** ny seksjon «Aktivitetsfeed-innstillinger» i `/dashbord/firma/innstillinger` med:
- Multi-select for hendelsestyper
- Number-input for periode-dager (1–90, default 10)
- Number-input for retensjon-år (1–10, default 5)

## GDPR / retensjon

Activity-tabellen har innebygd `retainedUntil` + `anonymizedAt`-felter (per A.3-spec).

**Cron-job** (ny PM2-prosess eller scheduled tRPC-rute) som kjører nattlig:

```sql
UPDATE activity_log
SET anonymized_at = now(),
    actor_user_id = NULL,
    actor_navn_snapshot = NULL
WHERE retained_until < now() AND anonymized_at IS NULL;
```

**Hard-slett etter X år ekstra** (10–15?) krever Kenneth-beslutning. Vanligvis ikke påkrevd hvis anonymisering er gjennomført.

`retainedUntil` settes ved skriving: `now() + (organizationSetting.activityRetentionAar * 1 år)`.

## Implementasjons-rekkefølge

1. **Spec-fil oppdateres** med ekstern partner-beslutning (egen designrunde) — denne fila
2. **`OrganizationSetting`-utvidelse** (3 nye kolonner) — egen migrasjon
3. **`loggAktivitet()`-hjelpefunksjon** i `apps/api/src/utils/aktivitet.ts`
4. **Event-hooks** i sjekkliste/oppgave/RUH-routes
5. **`feed.hentForFirma`-query** — pagineret, filterbar på hendelsestyper, periode-filter
6. **Dashbord-UI:** `<Aktivitetsfeed />`-komponent med polling
7. **GDPR-cron:** nattlig anonymisering via PM2
8. **Settings-UI:** «Aktivitetsfeed-innstillinger»-seksjon
9. **Fase 2 (senere designrunde):** ekstern partner-feed

## Avhengigheter

- **Timer-modul (Fase 3)** må være ferdig først — for å unngå konflikter med timer-relaterte hendelser
- **Maskin-modul (Fase 1)** må være ferdig først — for å inkludere maskin-aktivitet i feed
- **RUH/HMS-modul** må være kartlagt — eksisterende RUH-kode må verifiseres

## Åpne beslutninger

1. **Ekstern partner-feed-scope** — egen designrunde påkrevd
2. **Hard-slett-policy** etter anonymisering — krever Kenneth-beslutning
3. **`actorNavnSnapshot`-håndtering ved anonymisering** — slettes fullt eller beholdes for kontekst?
4. **Hendelsestype-utvidelser** — Maskin-bruk, Timer-registrering, Vareforbruk osv. — vurderes når aktuelle moduler er klare

## Kilde

Etablert 2026-05-01 etter Kenneth-spec. Kode-verifikasjon mot Activity-tabellen + dashbord-side bekreftet at infrastrukturen er klar (tabell finnes, indekser klare), men ingen produsent-kode er skrevet ennå.

Periode-instilling (`feedPeriodeDager`) tilføyd 2026-05-01 per Kenneth-presisering.
