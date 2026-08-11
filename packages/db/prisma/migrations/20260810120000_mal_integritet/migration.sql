-- Mal-integritet (2026-08-10): slett-vern (FK onDelete) + unikhet (funksjonelle unik-indekser).
--
-- 🔴 MIGRERINGEN FEILER hvis dubletter finnes (unik-indeksene) — det er en FUNKSJON,
-- ikke en bug. Rydd `sitedoc`/`sitedoc_test` FØR kjøring. Skanne-SQL: `~/mal-dubletter-skann.sql`
-- på server-ny (samme normalisering: lower(btrim(...)), PSI ekskludert fra prefiks).
-- Skannet 2026-08-10: `sitedoc` (prod) HELT REN (ingen rydding nødvendig);
-- `sitedoc_test` har to funn (SJA/SJA(kopi)-prefiks + 5 testsøppel-PSI-navn) — ryddes av Kenneth før test-kjøring.

-- 1) SLETT-VERN: Task.template SET NULL -> RESTRICT (speiler Checklist.template).
--    Nekter sletting av en mal som har oppgaver, i stedet for å nullstille
--    tasks.template_id stille (Task har ingen projectId → foreldreløs oppgave).
--    App-guarden i mal.slettMal teller først og gir lesbar melding; dette er DB-backstop.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_template_id_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "report_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) UNIKHET per prosjekt — funksjonelle unik-indekser. Prisma modellerer ikke
--    funksjonelle/uttrykks-indekser (som U1-CHECK-en), så de er håndskrevet her.
--    Case- og whitespace-ufølsom via lower(btrim(...)); app-validering normaliserer likt.

--    Navn: unikt PÅ TVERS av kategorier ("oppgaver/sjekklister/hms" — Kenneths regel).
CREATE UNIQUE INDEX "report_templates_project_navn_unik"
  ON "report_templates" ("project_id", (lower(btrim("name"))));

--    Prefiks: partiell — kun der prefiks finnes, og IKKE for PSI.
--    🔴 PSI-EKSEMPT (innrømmelse, ikke velsignelse): PSI bruker `prefix`-feltet som
--    en fast TYPE-etikett («PSI»), ikke som dokumentnummer-prefiks — én PSI-mal per
--    byggeplass deler «PSI». Semantisk avvik fra alle andre kategorier (der prefiks
--    styrer dokumentnummer per prosjekt globalt). Uten eksemptet ville indeksen
--    feilet på ethvert prosjekt med to byggeplasser. NAVNGITT OPPFØLGER: skill PSIs
--    type-etikett fra nummer-prefiks (eget felt), så eksemptet kan fjernes.
CREATE UNIQUE INDEX "report_templates_project_prefiks_unik"
  ON "report_templates" ("project_id", (lower(btrim("prefix"))))
  WHERE "prefix" IS NOT NULL AND "category" <> 'psi';
