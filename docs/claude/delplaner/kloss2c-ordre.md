---
name: kloss2c-ordre
status: 🟢 AKTIV — byggeordre B Kloss 2c (matrisen til Admin-flaten + cellespec-kontrast). Design: rettighetsmatrise-config-design rev.6 § 1c + § 2. Kontrast-delen forutsetter Kenneth-godkjent cellespec-mockup
eier: cowork (ordre + gate) · kode-Opus «B Kloss 2c» (ledd 3)
sist_verifisert_mot_kode: 2026-07-24
---

# Ordre — B Kloss 2c: flytt matrisen til Admin-flaten + cellespec-kontrast

> **Cowork-ordre 2026-07-24.** Design: [rettighetsmatrise-config-design.md § 1c + § 2](rettighetsmatrise-config-design.md) (fabel rev.6). To uavhengige, små deltaer på Kloss 2-matrisen (`a3e2cc66`). **Uavhengig av Kloss 2b** — kan kjøre parallelt (egen branch, egne filer bortsett fra matrise-siden; koordiner hvis 2b også rører den, men 2b rører den ikke).

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus «B Kloss 2c», ledd 3. **Du koder — kun det.** Gater ikke, merger ikke, deployer ikke.

**Arbeidstre + branch:** `feat/flytmatrise-adminflate` fra `origin/develop`. Du pusher kun denne.

**To deler:** (A) flytt matrisen fra FIRMA-sidemenyen til Admin-flaten; (B) cellespec-kontrast. **Del B forutsetter at Kenneth har godkjent cellespec-mockupen** (`Flyt-rettigheter Cellespec.dc.html`) — bygg del A uansett; hvis mockup-godkjenning mangler ved oppstart, bygg del B mot verdiene under (de er fabels spec) og flagg for gaten.

## 1. Del A — flytt til Admin-flaten (§ 1c)

**Vedtak (Kenneth 2026-07-24):** config-rett = **kun sitedoc-admin, permanent** → matrisen hører til Admin-flaten (topbar «Admin»-shield), IKKE FIRMA-sidemenyen (den brøt K5: sidebar = arbeidsflater, konfig ikke der).

- **Fjern** flyt-rettigheter fra FIRMA-nav: `apps/web/src/components/layout/firma-nav.tsx` (`firmaNav.flytRettigheter`-raden) + `apps/web/src/app/dashbord/firma/layout.tsx` (nav-listen). Behold i18n-nøkkelen til gjenbruk.
- **Legg** siden på Admin-flaten (topbar Admin-shield-målet — mål selv hvor den ruter, f.eks. `dashbord/admin/*` eller superadmin-flaten). Flytt/re-eksporter `dashbord/firma/flyt-rettigheter/page.tsx` dit, eller behold ruten men flytt nav-oppføringen — velg det som gir minst brudd; matrise-logikken (`flytmatrise-def.ts` + tRPC `flytMatrise.*`) er uendret.
- **Firma-velger i Admin-konteksten:** siden lå i firma-kontekst og hentet `valgtFirma?.id` fra `useFirma()`. På Admin-flaten (cross-tenant) må den ha en **egen firma-dropdown** som velger hvilket firmas matrise som vises/redigeres (orgId inn til `flytMatrise.hentMatrise`). Gjenbruk eksisterende firma-liste-kilde (superadmin/admin har alt en firma-liste — mål og gjenbruk).
- Gate uendret: `kanRedigereFlytMatrise` = sitedoc_admin only (står fra Kloss 2).

## 2. Del B — cellespec-kontrast (§ 2, fabels spec)

Dagens celler har svak kontrast (lys grønn hake / grå strek på hvitt). Spec — **form skiller, ikke bare farge:**

| Tilstand | Utseende |
|---|---|
| **Standard på** | Fylt boks, hvit hake på **`#059669`** (mørkere enn dagens `#10b981` — kontrast-krav; behold `#10b981` som semantisk success ellers) |
| **Standard av** | **Tom ramme `#a8a49b`** (ikke en strek/dash) |
| **Overstyrt** | Fylt/tom som over + **amber prikk `#d97706`** øverst til høyre + tooltip (hvem/når + «Tilbakestill») |
| **Auto** | Grå fylt boks med «A», ikke klikkbar |
| **Låst** | Hengelås på **`#f1efe9`** |
| **Hover (redigerbar celle)** | Blå ramme |

- Behold de fem tilstandene fra Kloss 2 — dette er ren visuell oppgradering, ingen ny celle-tilstand eller ny logikk.
- Fargene bør inn som Tailwind-klasser/CSS-variabler der mønsteret tilsier det (ikke hardkodet hex spredt i JSX hvis paletten har alias).

## 3. Ufravikelig

- **Matrise-LOGIKKEN røres ikke** — `flytmatrise-def.ts`, `flytMatrise`-router, celle-tilstand-beregning er ferdig i Kloss 2. Dette er plassering + visuell kontrast.
- Ingen endring i `kanRedigereFlytMatrise` eller gating.
- i18n: ingen nye brukervendte strenger uten `t()` + begge språkfiler + `generate.ts`.
- Norsk bokmål, æ/ø/å.

## 4. DoD

`typecheck` + `next build` grønn · matrisen nås fra Admin-flaten med fungerende firma-velger · borte fra FIRMA-sidemenyen · fem celle-tilstander tydelig adskilt på form+farge (skjermbilde i PR) · lint rene rørte filer. **Ikke merge, ikke deploy** — push branch, cowork gater. Del B-gaten sjekker mot Kenneth-godkjent cellespec.
