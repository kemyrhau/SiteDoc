---
name: p1-nivasignal-ordre
status: 🟢 KLAR FOR RELAY — ledd 1 (nå-rapport) kan starte NÅ, parallelt med A-3b. Ledd 2 venter generatoren
eier: fabel (ordre + designgate) · cowork (sekvensering + merge) · redesign-Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-21
---

# P1-ordre — Nivåsignal firma/prosjekt (fabel → redesign-Opus, via Kenneth)

Vedtak: [p1-nivasignal-vedtak.md](p1-nivasignal-vedtak.md). Mockup (fasit for utseende/interaksjon): `P1 Nivåsignal Beslutningskart.dc.html` § 2a — **ligger utenfor repoet, relayes av Kenneth**. Scope NÅ: **HMS-paret** (pilot for mønsteret). Gjennomgående plan for øvrige par = egen sak etterpå.

## 0. For deg som koder (les først)

**Hvem du er:** redesign-Opus, **ledd 3**. Kenneth vedtok, fabel designet, cowork sekvenserte. **Du måler først, koder etterpå** — du gater ikke, merger ikke, deployer ikke.

**Leveranse i to ledd — STOPP mellom:**
1. **Ledd 1 — nå-rapport (§ 1).** Ingen kode. Fem spørsmål, kodeverifiserte svar. **Stopp og lever til fabel-gate.**
2. **Ledd 2 — koding (§ 2).** Først etter at fabel har gatet rapporten.

**Ditt neste svar:** nå-rapporten. Ikke kode, ikke forslag til implementasjon.

> ⚠️ **Ledd 1 må være i18n-fritt.** Cowork-sekvenseringen (§ 4) hviler på at ledd 1 ikke rører `generate.ts`. Oppdager du at rapporten krever i18n-endring: **stopp og flagg** — da justeres rekkefølgen, den omgås ikke.

## 1. Ledd 1 — kodeverifisert nå-rapport (FØR koding; fabel gater rapporten)

1. **Topplinje-komponenten:** er den ÉN delt kilde for firma- og prosjektflater? Fil/komponentnavn + alle bruksflater. **Oppgi kandidatmengden** — hvilket søkerom du dekket.
2. **HMS-parets ruter/komponenter:** hva deles, hva er duplisert i dag?
3. **Prosjektkontekst ved firma→prosjekt-bytte:** finnes «sist besøkte prosjekt» i koden i dag? **Negative svar krever søkerom** — «finnes ikke» uten oppgitt kandidatmengde er ikke et svar.
4. **Firmainnstillinger:** hvor legges en ny valgfri innstilling (suffiks-flagget)? Bruk **eksisterende** innstillingsstruktur, ikke ny.
5. **Flater uten motpart:** hvilke firma-/prosjekt-flater mangler par? (Chip vises da UTEN bytte, kun signal — bekreft at det ikke er teknisk hindring.)

## 1b. Ledd 1 — LEVERT og fabel-gatet 2026-07-21

**Funnet som endret scope:** forvekslingen finnes **kun bak `nyNavigasjon`**. `KontekstChip` rendres uten kontekst-gren (`Toppbar.tsx:127`), mens gammel nav bruker `FirmaKontekstVelger` (`Toppbar.tsx:158`) og **har ikke problemet**. Målt av redesign-Opus, verifisert uavhengig av cowork. Kenneths prod-skjermbilde bekrefter det dobbelt: sidemenyen viste «FIRMA» i amber, som også bor bak flagget.

**Øvrige svar:** Toppbar er én delt kilde (montert én gang, `dashbord/layout.tsx:37`) · HMS-parets presentasjonslag er allerede delt, kun side-skallet er duplisert · «sist besøkte prosjekt» finnes som sticky-verdi (`prosjekt-kontekst.tsx:14`, localStorage `sitedoc-valgt-prosjekt`) · ingen teknisk hindring for chip uten motpart.

**Ledd 1 var i18n-fritt** — generatoren ble ikke rørt, sekvenseringen holdt.

## 2. Ledd 2 — koding (fabel-gatet scope 2026-07-21)

**A. `KontekstChip.tsx` KUN.** Fabel-beslutning 2026-07-21: **gammel-nav-stien røres ikke.** `FirmaKontekstVelger` har ikke problemet og er på vei ut — å røre den er plaster på frisk hud. Firmakontekst viser kun firmanavn; prosjektkontekst kun prosjekt + bygning.

**B. Chip.** FIRMA (amber `#fef3e2` / `#92400e` / kant `#f5c97b`) · PROSJEKT (blå `#e8effc` / `#1e40af` / kant `#a9c4f5`). Klikkbar ⇄ → navigerer til motpart-flaten (**vanlig navigasjon, ingen ny mekanisme**; sidebaren uendret — K5). Firma→prosjekt: sist besøkte prosjekt, eller det mønsteret rapporten viser er etablert. Uten motpart: chip uten klikk.

**C. Tonet sidehode.** Svak sonetone (gradient mot hvit à la mockup) + 4px sonefarget h1-markør. **Tonen skal ikke konkurrere med status-farger i tabellen.**

**D. Suffiks «— hele firmaet» — ✅ UTE AV P1-SCOPE (Kenneth-vedtak 2026-07-21: alternativ b).** Innstillingen hører hjemme på `OrganizationSetting` (`schema.prisma:224`, som allerede bærer tre boolean-toggles i samme form) — altså en **Prisma-migrering**, som per CLAUDE.md krever Kenneths eksplisitte godkjenning.

**Vedtatt:** skilles ut som egen sak. **P1 leverer A–C uten suffiks** — rene visningsendringer som kan leveres og verifiseres uten DDL-risiko. Egen sak opprettes når P1 er levert; da med egen migrerings-gate. **Ikke bygg § 2D i denne runden.**

**E. Flagg-spørsmålet er løst av seg selv.** Siden rotårsaken bor i `KontekstChip` — som allerede lever bak `nyNavigasjon` — havner fiksen naturlig bak flagget. Ingen egen flagg-vurdering nødvendig.

## 3. Krav (kvalitet > tempo)

- Rotårsak, delte kilder, **ingen duplisert topplinje-logikk**.
- **Premissene i denne ordren er fabel-målte, IKKE fasit — du måler selv.** Enkeltmålt premiss som må etterprøves: *«topplinja er identisk på begge flater»* (fabels lesning av prod-skjermbilder, ikke kode-måling).
- **DoD:** build grønn → skjermbilder begge nivåer + bytte begge veier → fabel-designgate → dok-sync → cowork-merge.
- Statuskilde: `verifisering/p1-nivasignal-verifiseringslogg.md` (opprettes ved ledd 2).

## 3b. Gjenstående fra ledd 2 (må ikke tapes)

- **`kontekstChip.byttTil`-nøkkel når generatoren frigis — a11y, ikke kosmetikk.** ⇄-knappens aria-label er i dag kun mål-nivåets navn («Prosjekt»/«Firma») fordi i18n-sperren (§ 4) sto; det sier ikke at det er en byttehandling → meningsløst for skjermleser. Legg inn dedikert nøkkel («Bytt til prosjektvisning» / «Bytt til firmavisning») så snart A-3b frigir `generate.ts`.
- **⇄-plassering PROVISORISK til mockup § 2a er relayet** — markert i `KontekstChip.tsx`; justeres til fasit + skjermbilder da.

## 4. Sekvensering (cowork-avgjort 2026-07-21)

**Bindingen er `generate.ts`, ikke sidene.** A-3b Fase B eier i18n-generatoren (Del 2 legger nøkler) og `packages/ui/src/status-badge.tsx`. Per [parallell-arbeid-lock.md](../parallell-arbeid-lock.md) regel 9 + kollisjonssjekk pkt 1 kan ingen annen økt kjøre generatoren samtidig — det gir konflikt i 15 språkfiler, ikke i de to som faktisk ble redigert.

| Rekkefølge | Hva | Begrunnelse |
|---|---|---|
| **Nå** | A-3b Fase B | Eier `generate.ts` + `status-badge.tsx` |
| **Nå (parallelt, trygt)** | **P1 ledd 1 — nå-rapporten** | Ren måling. Null kode, null i18n. Kolliderer ikke |
| **Etter A-3b** | P2 inndata-validering | Rører handlingsmeny/status-mutasjoner — overlapper A-3b Del 2s flater |
| **Etter A-3b** | P1 ledd 2 — koding | Trenger generatoren fri |

**Poenget:** P1 ledd 1 er ikke blokkert av noe. Rapporten er tilbake og fabel-gatet før A-3b er ferdig, så ledd 2 står klar i det generatoren frigis. Ingen ventetid går tapt.

**Korreksjon til fabels købilde:** sak 2 er merget og deployet prod 2026-07-20/21. Gjenstående kø var A-3b alene.
