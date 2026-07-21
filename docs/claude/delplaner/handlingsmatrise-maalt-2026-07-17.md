---
name: handlingsmatrise-maalt-2026-07-17
status: 🟢 MÅLING — datert avledning, ikke sannhetskilde
sist_verifisert_mot_kode: 2026-07-17
kilder: statusHandlinger.ts (når + hvem + primær) · index.ts isValidStatusTransition (lovlig) · DokumentHandlingsmeny.tsx (klikk) · schema.prisma DocumentTransfer (spor)
---

# Handlingsmatrisen — målt 2026-07-17

> **Dette er en avledning, ikke en kilde.** Koden er fasit ([§11](../dokumentasjons-standard.md)). Matrisen finnes ikke som tabell noe sted — den er distribuert over tre filer, og *derfor* har ingen sett at fire handlinger mangler eier og at `erPrimaer` aldri leses. Dateres og re-måles, vedlikeholdes ikke.
>
> **Bakgrunn:** Kenneth ba om «en matrise for hva som skal skje når» etter å ha brukt fire klikk på å nå «Ugyldig statusovergang fra approved til cancelled». Svaret var at matrisen var bestemt for lengst — bare aldri lagt ved siden av seg selv.

## Kildene

| Kilde | Kolonne |
|---|---|
| `hentStatusHandlinger(status)` | **når** — hvilke handlinger finnes i hver status · **primær** (`erPrimaer`) |
| `ROLLE_HANDLINGER[rolle][status]` | **hvem** — `registrator` returnerer alltid alle |
| `isValidStatusTransition()` | **lovlig** — [dokumentflyt.md § 6](../dokumentflyt.md): «Server (tRPC) **og klient (knapp-visning)**» |
| `DocumentTransfer` (schema) | **spor** — hvem/hva/når/til hvem/rolle/kommentar |

## Matrisen

| Handling | Fra | `nyStatus` | Hvem | Lovlig? | Primær? | Klikk i dag |
|---|---|---|---|---|---|---|
| Send | `draft` | `sent` | bestiller | ✅ | ✅ | 2 |
| Slett | `draft` | **`deleted`** | bestiller | *ikke status* | ✗ | 3 |
| **Trekk tilbake** | `sent` | `cancelled` | bestiller | ✅ | **✅** | **3–4** ⚠️ |
| Besvar | `received` | `responded` | utforer | ✅ | ✅ | 2 |
| Videresend | `received` | **`forwarded`** | utforer | *ikke status* | ✗ | 3 |
| Avvis | `received` | `cancelled` | **ingen** ⚠️ | ✅ | ✗ | 3 |
| Besvar | `in_progress` | `responded` | utforer | ✅ | ✅ | 2 |
| Send tilbake | `in_progress` | `sent` | utforer | ✅ | ✗ | 3 |
| Videresend | `in_progress` | **`forwarded`** | utforer | *ikke status* | ✗ | 3 |
| Avvis | `in_progress` | `cancelled` | **ingen** ⚠️ | ✅ | ✗ | 3 |
| Godkjenn | `responded` | `approved` | godkjenner | ✅ | ✅ | 2 |
| Send tilbake utfører | `responded` | `rejected` | godkjenner | ✅ | ✗ | 3 |
| Videresend | `responded` | **`forwarded`** | godkjenner | *ikke status* | ✗ | 3 |
| Besvar | `rejected` | `responded` | utforer | **❌ ULOVLIG** | ✅ | 2 |
| Videresend | `rejected` | **`forwarded`** | utforer | *ikke status* | ✗ | 3 |
| Lukk | `rejected` | `closed` | **ingen** ⚠️ | ✅ | ✗ | 3 |
| Lukk | `approved` | `closed` | bestiller | ✅ | ✅ | 2 |
| Videresend | `approved` | **`forwarded`** | **ingen** ⚠️ | *ikke status* | ✗ | 3 |
| Gjenåpne | `cancelled` | `draft` | bestiller | ✅ | ✅ | 3–4 ⚠️ |
| Slett | `cancelled` | **`deleted`** | bestiller | *ikke status* | ✗ | 3 |

**Nevner: 20 handlinger** (`hentStatusHandlinger`, alle 8 statuser). Klikk målt på web (`DokumentHandlingsmeny.tsx`): 2 = knapp → Bekreft. 3 = nedtrekk → valg → Bekreft. 3–4 = ADMIN-seksjon i nedtrekk.

## Fem funn

**1. `forwarded` og `deleted` er ikke statuser.** Typen sier det: `nyStatus: DocumentStatus | "deleted" | "forwarded"`. **Videresending går aldri gjennom statusmaskinen** — den er re-ruting av *hvem som har ballen*. Derfor kan den tilbys fra fem statuser uten å bryte tabellen. **Webs frie hopp oppstår fordi menyen behandler alt som statusoverganger.**

**2. Fire handlinger har ingen eier** — kun `registrator` kan gjøre dem: Avvis fra `received`/`in_progress` · Lukk fra `rejected` · Videresend fra `approved`. Designet (admin-only) eller hull? **Umålt.** Merk: «Avvis» finnes i to betydninger — `→ cancelled` (drep dokumentet) og `responded → rejected` («send tilbake utfører»). To ting, samme ord.

**3. Kun ÉN ulovlig overgang: `rejected → responded`.** Kilden er ellers korrekt. Webs problem er ikke kilden — det er at menyen finner opp sine egne handlinger.

**4. `erPrimaer` settes på 8 handlinger og leses av 0.** Kilden vet hvilken handling som er *den viktigste* i hver status. `erPrimaer` i `apps/web`: 0 treff. I `apps/mobile`: 2 treff, begge i timer-modulen (`StartSluttDagKort.tsx`, `reisetidMatriseKatalog.ts`) — urelatert. **Tredje nøkkel som skrives og aldri leses**, etter `traffic_light.options` og `enhet`.

**Konsekvens:** kilden sier at «Trekk tilbake» fra `sent` er **primærhandlingen**. Web begraver den i nedtrekkets ADMIN-seksjon — og tilbyr den i tillegg fra `approved`, hvor den er ulovlig.

**5. Sporet er komplett uten kommentar.** `DocumentTransfer` skrives ved hver statusendring (4 steder i `sjekkliste.ts`) med `senderId` + `senderRolle` + `fromStatus` → `toStatus` + `createdAt` + mottaker + org-snapshot. **`comment` er `String?`** — valgfri i schema, valgfri i tRPC (`kommentar: z.string().optional()`).

**To-stegs-bekreftelsen fanger ingen informasjon.** `DokumentHandlingsmeny.tsx:416-424`: første klikk armerer, andre utløser — for **alle** handlinger, uten unntak.

## Hvor bekreftelse hører hjemme

**Bekreftelse er for irreversibilitet, ikke for logging.** Loggen skjer uansett. Statusmaskinen sier selv hvor det er farlig:

| Status | Veier videre | |
|---|---|---|
| `closed` | **ingen** | ❌ blindvei |
| `deleted` | *ikke en status* | ❌ sletting |
| `cancelled` | → `draft` | ✅ gjenåpnes |
| `sent` | → `cancelled` | ✅ trekkes tilbake |
| alle andre | flere | ✅ |

**2 av 20 handlinger er irreversible.** De 18 andre bekreftes uten at bekreftelsen beskytter noe.

## Modellen som følger (Kenneth-vedtatt 2026-07-17)

- **1 klikk** — primærhandlingen (`erPrimaer`). `DocumentTransfer` registrerer hvem/hva/når automatisk.
- **2 klikk** — `Lukk` og `Slett`. Blindveier; bekreftelsen er ekte.
- **Kommentar: alltid tilgjengelig, aldri påkrevd.** Ikke et modalt steg — et felt du *kan* fylle, slik `comment: String?` er designet.

**Ingenting går tapt.** Sporet er identisk. Det er bekreftelses-dialogen som forsvinner der den ikke beskytter noe.
