# Ordre: Sjekkliste-/oppgavegrense knyttes til prøvestatus (pilot-blokker) — fabel, 2026-07-26

> Til cowork via Kenneth. Bakgrunn: `sjekkliste.ts:333–346` og `oppgave.ts:460` har en ubetinget per-prosjekt-grense (count ≥ 10 → FORBIDDEN) for alle ikke-sitedoc_admin — feilmeldingen («Kontakt SiteDoc for å oppgradere») viser at den er MENT som gratis/prøve-gate, men den mangler plan-dimensjonen og treffer også betalende/ordinære prosjekter. **Pilot-blokker:** pilotkunden (50 ansatte) passerer 10 sjekklister første uka. Kenneth-vedtak 2026-07-26: grensen skal kun gjelde prøveprosjekter.

## Endring
1. **Guard-betingelsen utvides med prosjektstatus** i BEGGE guards (sjekkliste.opprett + oppgave.opprett — delt hjelpefunksjon, ikke duplisert logikk):
   - Prøveprosjekt → grense 10 (som i dag).
   - Ordinært prosjekt → ingen antallsgrense.
   - sitedoc_admin-unntaket består.
2. **Kriteriet for «prøve» måles først:** bruk aksen som alt finnes (`trialExpiresAt` i admin.ts:351-flyten). Cowork avgjør minst invasive uttrykk — f.eks. «trialExpiresAt satt og ikke utløpt = prøve» — og flagger hvis det trengs et eksplisitt felt i stedet (da er det et Kenneth-beslutningspunkt, ikke et valg Opus tar stille).
3. **Count-måling (gate for e2e-oppryddingen):** mål om `checklist.count`-guarden teller soft-slettede (F0 deletedAt). Hvis ja: (a) count skal ekskludere deletedAt ≠ null (rotårsaksfiks — slettede dokumenter skal ikke spise kvoten), og (b) e2e-suiten kan beholde soft-delete-opprydding.
4. **Feilmeldingen beholdes** for prøveprosjekter, men skal være i18n-nøkkel (alle 15 språk) hvis den ikke alt er det.

## Ikke i scope
Plan-/abonnementsmodell utover prøve/ordinær-skillet. Endring av trial-deaktiveringslogikken i admin.ts.

## Effekt for e2e
Agentprosjektet i `sitedoc_test` settes som ordinært → suiten treffer aldri grensen; grensen får i stedet sin EGEN røyktest: prøveprosjekt med 10 sjekklister → nr. 11 avvises med riktig melding (testkandidat #10).

## DoD
- Delt guard-hjelper med test: prøve under 10 → ok; prøve på 10 → FORBIDDEN; ordinær på 10+ → ok; sitedoc_admin → alltid ok; soft-slettede teller ikke.
- Typecheck + test grønt (api/shared). Vis diff, push egen gren, ikke merge, ikke rør STATUS/BACKLOG. Dok-sync: api.md:293-raden oppdateres til den betingede regelen i samme merge.

## Cowork-måling + interim-scope (2026-07-26) — STYRENDE for kode-Opus

Målt mot koden på develop. Dette snevrer ordren til et interim som låser opp piloten uten å foregripe produktmodellen (den er egen fabel-utredning, se § Ikke i scope).

**Kriteriet (punkt 2) — firma-tilknytning, ikke `trialExpiresAt`.** Den ekte prøve-aksen i koden er firma-tilknytning: `admin.ts` deaktiverer kun prosjekter med `projectOrganizations: { none: {} }` (standalone). Et prosjekt under en firma deaktiveres aldri → er per definisjon ordinært.
- **Ordinært = prosjektet har firma-tilknytning.** Speil admin.ts: standalone = `projectOrganizations: { none: {} }`. Kode-Opus verifiserer om `Project.primaryOrganizationId`-skalaren er ekvivalent og enklere enn relasjons-count-en, og velger det minst invasive. **Ingen nytt felt, ingen migrering.**
- sitedoc_admin-unntaket består (som i dag).

**Punkt 3 (soft-delete) — ALLEREDE LØST, ingen count-endring.** Begge guardene bruker alt `...IKKE_SLETTET` (`sjekkliste.ts:338`, `oppgave.ts:465`), og `IKKE_SLETTET = { deletedAt: null }` (`packages/shared/src/utils/softDelete.ts:8`, enhetstestet). Soft-slettede teller altså ikke mot kvoten allerede. Kode-Opus skal kun **verifisere** dette (ikke endre count), og e2e-suitens soft-delete-opprydding frigjør kvote som forventet.

**Konkret endring (krympet):**
1. Delt hjelper (f.eks. `apps/api/src/utils/prosjektGrense.ts`): `erStandaloneProsjekt(prisma, projectId): Promise<boolean>` — true når prosjektet mangler firma-tilknytning. Brukes i BEGGE guards, ingen duplisert logikk.
2. `sjekkliste.opprett` (linje 332–347) + `oppgave.opprett` (linje 460–473): behold `antall >= 10 → FORBIDDEN` KUN når `bruker.role !== "sitedoc_admin"` **OG** `erStandaloneProsjekt(...)`. Firma-tilknyttet → ingen grense.
3. Feilmeldingen til i18n-nøkkel (15 språk) hvis ikke alt.
4. Røyktest #10 (egen, ikke i e2e-suiten): standalone-prosjekt med 10 sjekklister → nr. 11 FORBIDDEN med riktig melding; firma-prosjekt med 10 → ok.

**e2e-effekt:** agentprosjektet (`AGENT-TEST-0001`) er firma-tilknyttet (seedet under «Testfirma AS (agent-test)») → ordinært → suiten treffer aldri grensen. **Ingen seed-endring nødvendig.**

**Doc/kode-drift funnet (noter, ikke fiks her):** CLAUDE.md sier «firma påkrevd ved prosjekt-opprettelse, uten `.optional()`», men `prosjekt.ts:104` HAR `.optional()` + orgløs-fallback (`:286`). Standalone kan fortsatt lages av orgløs bruker. Hører til fabel-utredningen (standalone-avvikling).
