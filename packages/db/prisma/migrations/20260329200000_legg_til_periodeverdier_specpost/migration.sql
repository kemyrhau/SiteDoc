-- Legg til periodeverdier på spec-poster (for A-nota/T-nota)
ALTER TABLE "ftd_spec_posts" ADD COLUMN IF NOT EXISTS "mengde_denne" DECIMAL(18,2);
ALTER TABLE "ftd_spec_posts" ADD COLUMN IF NOT EXISTS "mengde_total" DECIMAL(18,2);
ALTER TABLE "ftd_spec_posts" ADD COLUMN IF NOT EXISTS "verdi_denne" DECIMAL(18,2);
ALTER TABLE "ftd_spec_posts" ADD COLUMN IF NOT EXISTS "verdi_total" DECIMAL(18,2);
ALTER TABLE "ftd_spec_posts" ADD COLUMN IF NOT EXISTS "prosent_ferdig" DECIMAL(18,2);
