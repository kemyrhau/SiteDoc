---
name: kloss2-ordre
status: ✅ LEVERT + MERGET develop (`a3e2cc66`, PR #3, 2026-07-23). Cowork-gate bestått (8 punkter, tilgangskontroll verifisert). Ordren beholdt som referanse for Fase A-målingen + non-regresjons-beviset
eier: cowork (ordre + gate) · kode-Opus «B Kloss 2» (ledd 3)
sist_verifisert_mot_kode: 2026-07-23
---

# Ordre — B Kloss 2: adminNiva + admin-nivå-kolonner + matrise-UI (alt-i-ett)

> **Cowork-ordre 2026-07-23.** Design: [rettighetsmatrise-config-design.md § 1b + § 2](rettighetsmatrise-config-design.md) (fabel, cowork-gatet). Kloss 1 (config-plumbing) landet develop `33c32f1f` — dette bygger oppå. Kenneth valgte **alt-i-ett** og er borte en periode; du bygger hele Kloss 2 på branch, cowork gater ved retur. **Ingenting merges/deployes uten cowork-gate.**

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus «B Kloss 2», ledd 3 (koding). Design er fabel-planlagt + cowork-gatet. **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Arbeidstre:** `~/Documents/Programmering/SiteDoc-registrator` (fri etter Kloss 1). **Branch:** `feat/flytmatrise-adminniva` fra `origin/develop` (`33c32f1f`). Du pusher kun denne.

**Ingen mid-veis-stopp for gate** (Kenneth er borte og kan ikke relaye). Bygg hele oppgaven, dokumentér Fase A-målingen i PR-teksten, push. Cowork gater alt ved retur.

## 1. Kritisk kontekst — admin-bypass divergerer TRE veier i dag (cowork-målt 2026-07-23)

Dette er hele grunnen til at Kloss 2 finnes. Dagens `erAdmin`-bypass beregnes ULIKT på tre håndhevingspunkter:

| Nivå | Server (`verifiserFlytRolle`, tilgangskontroll.ts) — **håndhever** | Web (`hentMinFlytInfo` → DokumentHandlingsmeny) — **meny** | Mobil (DokumentHandlingsmeny) — **meny** |
|---|---|---|---|
| **sitedoc_admin** | ✅ bypass (`bruker.role === "sitedoc_admin"` → return) | ✅ `erAdmin:true` | ⚠️ avhenger av `erFirmaAdmin`-prop-kilde (mål) |
| **firma-admin** (`firmaRoller∋"firma_admin"`) | ❌ **INGEN bypass** — ingen firmaRoller-sjekk i verifiserFlytRolle | ✅ `erAdmin:true` (gruppe.ts:62-63) | ✅ `erAdmin = erFirmaAdmin === true` |
| **prosjektadmin** (`ProjectMember.role="admin"`) | ✅ bypass (`medlem.role === "admin"` → `erAdmin=true`) | ✅ `erAdmin:true` | ❌ **INGEN bypass** (mobil sjekker kun firma-admin) |

**To reelle divergenser i dag (present-day, ikke innført av oss):**
1. **Firma-admin:** web/mobil-menyen VISER admin-handlinger, men serveren AVVISER dem (meny tilbyr, server nekter). Klient/server-sprik.
2. **Prosjektadmin på mobil:** serveren GIR full tilgang, men mobil-menyen SKJULER admin-handlingene (under-servert i UI).

**adminNiva forener disse.** Se § 3 for målmodellen. Målings-detaljer forankret i: `gruppe.ts:33/62-63/71`, `tilgangskontroll.ts` verifiserFlytRolle (`erAdmin = medlem.role === "admin"`, ingen firma-sjekk), `apps/web/.../DokumentHandlingsmeny.tsx:224`, `apps/mobile/.../DokumentHandlingsmeny.tsx:105,109`.

## 2. Fase A — bekreft nåtilstanden (mål selv, dokumentér i PR, IKKE stopp)

Før du rører atferden: reproduser tabellen i § 1 mot koden i din branch og skriv den inn i PR-teksten (og et kort avsnitt i `dokumentflyt.md`). Mål spesielt:
- **Mobil `erFirmaAdmin`-propens kilde:** hvilken skjerm/komponent gir den, og får sitedoc_admin/prosjektadmin satt den? (Cowork fant ingen caller i `apps/mobile/src` — finn den, ellers er mobil-menyen alltid ikke-admin.)
- **Server:** bekreft at `verifiserFlytRolle` ikke har noen firmaRoller-sjekk (firma-admin får ikke bypass server-side i dag).

Dette er grunnlaget cowork gater atferdsendringen mot. Ikke gjett — mål.

## 3. Målmodell — adminNiva (Kenneth-vedtak 2026-07-23: kun sitedoc + prosjektadmin)

> **🔑 Kenneth-vedtak 2026-07-23:** «løsningen er kun sitedocadmin, vi legger til prosjektadmin istedenfor med default innstillinger.» → **Ingen firma-admin-utvidelse.** Hard bypass = kun sitedoc_admin (kode). Prosjektadmin = egen konfigurerbar matrise-kolonne med default-innstillinger (bevarer dagens fulle tilgang). **Firma-admin er IKKE et flyt-admin-nivå** — faller til sin vanlige flyt-rolle. Dette fjerner samtidig det «fantom»-admin-menyvalget web/mobil viser firma-admin i dag men serveren avviser (§ 1 divergens 1) — vi kontraherer menyen til å matche serveren (minste privilegium), ikke utvider serveren.

`adminNiva: "sitedoc" | "prosjekt" | null` innføres **KUN i flyt-rettighets-funksjonene** (§ 1b-scopet — `erAdmin` = 272 forekomster i 61 filer, global swap er UT). `erAdmin: boolean` består overalt ellers.

**Effektiv rett ved TOM override (defaults) — ikke-regresjons-fasiten:**

| adminNiva | Kilde | Default flyt-rett (tom override) | Mot server i dag | Merk |
|---|---|---|---|---|
| **sitedoc** | `User.role="sitedoc_admin"` | Full bypass — **kode, ikke en kolonne** (return all/true) | Uendret | Vises som fotnote i UI, ikke redigerbar kolonne |
| **prosjekt** | `ProjectMember.role="admin"` | **Full innenfor statusmaskinen** (`isValidStatusTransition` per celle) | Uendret (bevarer dagens bypass) | Egen redigerbar kolonne — «default innstillinger» = full, konfigurerbar nedover |
| **null** | vanlig flyt-rolle (inkl. **firma-admin**) | Kloss 1-defaults (`ROLLE_HANDLINGER_DEFAULTS`) | Uendret server-side | Firma-admin får INGEN flyt-admin-rett (som server i dag) |

**«Default innstillinger» for prosjektadmin = full innenfor statusmaskinen.** Serveren gir prosjektadmin FULL bypass i dag → default må bevare det (ellers regresjon). Overgangsmatrisen: «admin arver alt uten eksplisitte celler» = **tom prosjektadmin-kolonne arver full innenfor statusmaskinen**, konfigurerbart NEDOVER (aldri oppover — Kloss 1-invarianten består). **Avviker fra designets «tom default = nektet»** (ville regressert); isValid-arv er ikke-regresserende. Flagget for fabel-etterlesning ved gaten.

**Firma-admin (adminNiva=null):** behandles som vanlig flyt-deltaker. Konsekvens: web (`hentMinFlytInfo:62-63`) + mobil slutter å sette `erAdmin:true` for firma-admin i flyt-menyen. **Ikke et kapabilitetstap** — server avviste dem uansett; vi fjerner et villedende menyvalg. **Synlig endring — føres i pilot-endringsloggen + flagges i gaten.**

**Runtime (utvid `celleTillatt` i statusHandlinger.ts):**
```
sitedoc  → return true (all)                    // kode-bypass, uendret semantikk
prosjekt:
    key = `prosjektadmin:${fra}:${til}`
    if key in overrides: return overrides[key] && isValidStatusTransition(fra,til)
    else:                return isValidStatusTransition(fra,til)   // tom = arv full innenfor statusmaskin
null (vanlig rolle, inkl. firma-admin) → Kloss 1-stien (uendret)
```
`erAdmin: boolean`-parameteren på `hentRolleFiltrertHandlinger`/`erTillattForRolle` erstattes av `adminNiva`-param (eller suppleres — velg minst risiko; behold bit-identisk oppførsel for `null`). **Statusmaskin-snittet (Kloss 1-invarianten) består for override-stien.**

## 4. Byggeoppgaver

**A. adminNiva i flyt-laget + tre håndhevingspunkter:**
- Utvid `celleTillatt` + `hentRolleFiltrertHandlinger` + `erTillattForRolle` (statusHandlinger.ts) med `adminNiva` per § 3. Behold `null`-stien bit-identisk (Kloss 1-testene skal fortsatt være grønne).
- **Server** (`verifiserFlytRolle`, tilgangskontroll.ts): beregn `adminNiva` (sitedoc fra `user.role="sitedoc_admin"`, prosjekt fra `medlem.role="admin"`; **ingen firma-sjekk** — firma-admin er ikke et flyt-admin-nivå) og mat den inn i stedet for `erAdmin`. Server-atferd for sitedoc/prosjekt er uendret ved tom override.
- **Web** (`hentMinFlytInfo`, gruppe.ts): returnér `adminNiva`. **Fjern `erAdmin:true`-grenen for firma_admin (linje 62-63)** — firma-admin får vanlig flyt-rolle i menyen (retter fantom-divergensen). DokumentHandlingsmeny konsumerer `adminNiva`.
- **Mobil** (DokumentHandlingsmeny + prop-kilden fra Fase A): plumb `adminNiva` (sitedoc + prosjekt) i stedet for `erFirmaAdmin`-bypasset. Firma-admin-bypasset fjernes; prosjektadmin får menyparitet med server. **Mobil re-verifiseres i gaten (A3b-regelen — shared-endring).**

**B. rolle-felt + defaults:**
- `FlytRettighetOverride`/`FlytRettighetLogg`.`rolle` tar nå også `"prosjektadmin"` (String i DB, ingen schema-migrering nødvendig — feltet er allerede String). Type-union i shared oppdateres. **Ingen `"firmaadmin"`-verdi** (droppet per Kenneth-vedtak).
- Ingen nye rader i DEFAULTS-mapen for prosjektadmin (bruker isValid-arv, § 3). Dokumentér valget i kode-kommentar.

**C. Matrise-UI (fasit § 5a + celle-tilstander § 2):**
- Matrise rolle × status. Kolonner: vanlige roller + **PROSJ.ADMIN** (redigerbar). **Ingen FIRMA-ADMIN-kolonne.** **SITEDOC-ADMIN vises IKKE som kolonne** — fotnote/header-merke (kode-bypass, ikke config).
- Rad **«(nytt)·Opprett»** (sentinel `fraStatus="nytt"`, `tilStatus="opprett"`).
- Celle-tilstander: (1) Standard på (hake) · (2) Standard av (tom) · (3) Overstyrt (prikk-markør + tooltip hvem/når + «tilbakestill») · (4) Auto (grå «A», ikke klikkbar — `sent→received`, `received→in_progress`) · (5) Låst (lov-celler: P2-kommentarkrav, invarianten).
- **`kanRedigereFlytMatrise(user, org)` = KUN `sitedoc_admin` i fase 1** (Kenneth-vedtak). company_admin/prosjektadmin: nei. FIRMA-ADMIN-kolonnen finnes og redigeres av sitedoc_admin.
- Lagring per celle-klikk med umiddelbar server-validering (statusmaskin-snittet), ikke skjema-batch.
- i18n `t()` + `generate.ts` for alle nye strenger.

**D. Endringslogg + les/rediger-fane:**
- `FlytRettighetLogg`-skriving ved hver celle-endring (append: celle · fra→til · hvem · når · kilde="admin-ui").
- Endringslogg-fane: flat liste fra `FlytRettighetLogg`.
- Les/rediger-fane: VISER `task_edit`/`checklist_edit` + `DokumentflytMedlem.kanRedigere` (flytRolle.ts) — ren visning, ingen ny modell.
- HMS-synlighet: IKKE her (eget UI, vedtak 6).

## 5. Invarianter (ufravikelig — gaten måler disse)

1. **Ingen server-rett UTVIDES** — ingen ny bypass gis til noen. Firma-admin får fortsatt ingen flyt-admin-rett server-side (uendret). sitedoc + prosjektadmin uendret full ved tom override; vanlige roller bit-identisk (Kloss 1-testene grønne).
2. **Firma-admins fantom-menyvalg fjernes** (web+mobil slutter å vise admin-handlinger firma-admin ikke kan bruke) — flagget + ført i pilot-endringsloggen. Ikke et kapabilitetstap (server avviste dem uansett).
3. **Mobil prosjektadmin får menyparitet med server** (ny synlighet — server ga full, meny skjulte) — flagget + verifisert i gaten.
4. **Override kan aldri skape overgang statusmaskinen ikke har** (Kloss 1-invarianten) — også for prosjektadmin-nivået.
5. **`adminNiva` lekker ikke ut av flyt-laget** — `erAdmin: boolean` uendret i de øvrige 271 forekomstene.

## 6. DoD

`pnpm test` (shared) grønn — Kloss 1-tester uendret + nye adminNiva-tester (per nivå × celle: sitedoc=full, prosjekt=full-innenfor-statusmaskin ved tom override + konfigurerbar nedover, null/firma-admin=Kloss 1-sti + snitt-invarianten) · `prisma generate` ren (rolle-union er type-only) · `typecheck` + `next build` grønn · lint på nye/rørte filer rene. **Bevis i PR:** (a) Fase A-tabellen målt, (b) nåtilstand→måltilstand-diff per nivå per plattform (server/web/mobil) som viser ingen server-rett utvidet + fantom-menyvalget fjernet, (c) skjermbilde/markup av matrise-UI med celle-tilstandene. **Ikke merge. Ikke deploy.** Push branch, cowork gater ved Kenneths retur.

## 7. Ufravikelig

- **Statusmaskinen (`validTransitions`) røres IKKE** — matrisen leser den, endrer den ikke.
- **Lagret dokumenttilstand endres ALDRI** — dette er rettighets-/visningslag.
- **Tilgangskontroll er server-sannhet** — menyen (web/mobil) er UI; `verifiserFlytRolle` er backstop. Begge må forenes, men serveren er fasit.
- **Firma-grense:** firma-admin-oppslag ALLTID via `OrganizationMember.firmaRoller` på prosjektets `primaryOrganizationId` — aldri cross-org.
- Norsk bokmål, æ/ø/å. i18n i både `nb.json` + `en.json` + `generate.ts`.
