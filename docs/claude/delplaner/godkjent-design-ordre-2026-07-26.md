---
name: godkjent-design-ordre
status: 🟢 BYGGEORDRE for kode-Opus — Godkjent = stoppsted (fjern Lukk, legg til direkte Gjenåpne). Ren kode. 2026-07-26
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (F0–F6 inne)
opphav: H6 Kenneth-vedtak 2026-07-26 — «Godkjent sjekkliste/oppgave skal aldri lukkes; et åpent KS-avvik kan lukkes».
---

# Byggeordre — Godkjent = stoppsted

Byggebransje-domene: en **Godkjent** sjekkliste/oppgave er et stoppsted som ligger godkjent til prosjektet er ferdig — den skal **aldri lukkes** (å lukke den blander suksess-terminalen med avbrutte/lukkede). Veien tilbake er **Gjenåpne**. Send/Videresend beholdes (sende-kapasitet er ok på en låst tilstand).

## Ufravikelig
- **INGEN migrering** — ren kode. **Ikke gjør § 0-refaktoren.** Ikke rør STATUS-AKTUELT/BACKLOG. Ikke merge — push feature-branch.
- **Fjern KUN `approved→closed`.** `in_progress→closed` (Under arbeid → Lukk) skal **stå** — det er der et åpent dokument/KS-avvik kan lukkes. HMS-avvik (`domain="hms"`) lukkes via HMS-flyten og berøres ikke.
- Norsk bokmål, `t()`-i18n, ingen `any`.
- **Koherens (STYRENDE):** de endrede Godkjent-cellene skal ha matrise-rad ↔ hover ↔ VALID_TRANSITIONS-overgang som beskriver samme ting.

## Scope
1. **VALID_TRANSITIONS** (`packages/shared/src/utils/index.ts`): `approved`: fjern `"closed"`, legg til `"draft"` (Gjenåpne). Resultat: `approved: ["sent", "draft"]` (+ `forwarded` pseudo via videresend). **Ikke rør `in_progress: [..., "closed"]`.**
2. **statusHandlinger.ts:** fjern Lukk-handlingen fra `approved`-blokken; legg til Gjenåpne (`statushandling.gjenapne`, `nyStatus: "draft"`) i `approved`-blokken. `in_progress`-blokkens Lukk står. Oppdater rolle-settene: `approved→draft` (Gjenåpne) = **registrator + prosjektadmin** (samme regel som øvrig gjenåpne, § 4). Fjern `approved→closed` fra alle rolle-sett.
3. **Matrise** (`flytmatrise-def.ts`): fjern `approved → closed` (Lukk)-raden; legg til `approved → draft` (Gjenåpne, Reg + P-adm). `in_progress → closed` (Lukk)-raden står. Behold `approved → sent` (Send) + `approved → forwarded` (Videresend).
4. **Perspektiv-etikett:** `approved` = «Godkjent» står uendret (fortsatt en hvile-/suksess-terminal, nå uten Lukk-utgang men med Gjenåpne).
5. **Mikrotekst:** gjenbruk `flythjelp.handling.gjenapne` for approved→draft (samme som øvrig gjenåpne). Ingen ny nøkkel.

## DoD
- [ ] `approved→closed` fjernet (VALID_TRANSITIONS + statusHandlinger + matrise + rolle-sett); `approved→draft` (Gjenåpne, Reg+P-adm) lagt til. `in_progress→closed` UROERT. Koherens-trippel bekreftet.
- [ ] Godkjent viser Gjenåpne + Send + Videresend, IKKE Lukk. Under arbeid viser fortsatt Lukk.
- [ ] `pnpm --filter @sitedoc/shared` typecheck+test + web/api typecheck grønt.
- [ ] Vis diff. Push `feat/godkjent-stoppsted`. Ikke merge. Ikke rør STATUS/BACKLOG.
