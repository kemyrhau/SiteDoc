---
name: k1k2-fiks-ordre
status: 🟢 KLAR FOR RELAY — fildisjunkt fra registrator-fiksen, kjører parallelt
eier: Kenneth (retning) · cowork (ordre + gate) · Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-21
---

# Ordre — K1 + K2: rydd nivåforvirringen i kontekstvelgeren

> Grunnlag + måling: [kontekstvelger-funn-2026-07-21.md](kontekstvelger-funn-2026-07-21.md). Begge er **pre-eksisterende bugs**, blame-verifisert av redesign-Opus. Begge har klar Kenneth-retning — dette er rene fikser, ikke design.

## 0. For deg som koder (les først)

**Hvem du er:** kontekst-Opus, **ledd 3**. Kenneth ga retningen, cowork gatet mot kode. **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Branch:** `fix/k1k2-kontekst` fra develop. Eget arbeidstre `SiteDoc-kontekst`.

**Fildisjunkt fra to andre aktive spor** — rør KUN `Toppbar.tsx` (K1) og `prosjekt-kontekst.tsx` (K2):
- **Registrator-fiksen** arbeider i `flytRolle.ts`/`statusHandlinger.ts`/`tilgangskontroll.ts`/`DokumentHandlingsmeny`. Ikke rør dem.
- **A-3b** eier `status-badge.tsx`/`perspektivEtikett.ts`. Ikke rør dem.
- **K3** (senere) eier `KontekstChip.tsx`. **Ikke rør den** — K1/K2 er kun toppbar + kontekst.

**Leveranse (én fase, to små fikser):** implementer K1 + K2 → `next build` grønn → push → vis diff. Stopp for gate.

## 1. K1 — byggeplass-velgeren lekker inn i firmakontekst

**Kode:** `apps/web/src/components/layout/Toppbar.tsx:132` (verifiser linjenr — kan ha flyttet). Betingelsen er i dag `{prosjektId && <ByggeplassVelger />}`. Den sjekker kun om et sticky prosjekt finnes — **ikke** om brukeren står i prosjektkontekst.

**Virkning:** på `/dashbord/firma/hms` vises en byggeplass-velger ved siden av firma-chippen. Byggeplass er et rent prosjekt-begrep og betyr ingenting i firmavisning.

**Fiks:** `{prosjektId && !erFirmaKontekst && <ByggeplassVelger … />}`. `erFirmaKontekst` finnes allerede i fila (`Toppbar.tsx:50`, `pathname.startsWith("/dashbord/firma")`).

**Verifiser:** i firmakontekst skal ingen byggeplass-velger vises; i prosjektkontekst uendret.

## 2. K2 — prosjektvalg fra popover navigerer ikke ut av firmasiden

**Kode:** `apps/web/src/kontekst/prosjekt-kontekst.tsx` — `velgProsjekt` (~linje 123, verifiser). Commit `17ba8bb05` («F4: behold nåværende rute») la inn en gren som beholder ruten ved prosjektbytte.

**Virkning:** velger du et prosjekt fra chippens popover mens du står på en firmaside, skjer **ingenting synlig** — du blir stående, men prosjektkonteksten er byttet i bakgrunnen. Lett å ende i feil prosjekt uten å vite det. **Paritetsbrudd:** gammel nav (`FirmaKontekstVelger.handleVelg`) navigerte alltid.

**✅ Kenneth-retning:** *«da må vi heller bytte til prosjektvisning».** Når `pathname.startsWith("/dashbord/firma")`, skal `velgProsjekt` **alltid** `router.push("/dashbord/{id}")` (speiler gammel nav). Øvrige globale ruter (`/dashbord/oppsett/*` osv.) beholder dagens «bli stående»-oppførsel uendret.

**Ufravikelig:** rør KUN firma-gренen. F4s eksisterende oppførsel på oppsett/andre globale ruter skal ikke endres — verifiser at et prosjektbytte fra `/dashbord/oppsett/*` fortsatt blir stående.

## 3. Krav

- **Premissene her er cowork-målte, ikke fasit — verifiser linjenumrene selv** (koden kan ha flyttet siden målingen).
- Ingen ny i18n-nøkkel forventet. Dukker det opp behov — **stopp og flagg** (A-3b eier generatoren).
- **DoD:** `next build` grønn → push → cowork-review → skjermbilde-verifisering på test (firmakontekst uten byggeplass-velger; prosjektbytte fra firma navigerer) → dok-sync.

## 4. Etter K1+K2

K3 (velger-trakten) bygges **etter** at K1+K2 er landet — K3 bygger på K2s navigasjonssemantikk. K3 er «trakt som forsøk, ikke låst fasit» ([k3-kontekstvelger-vedtak.md](k3-kontekstvelger-vedtak.md)). Ikke din sak nå.
