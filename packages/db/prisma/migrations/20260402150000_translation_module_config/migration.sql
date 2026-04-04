-- Modulspesifikk konfigurasjon (f.eks. oversettelsesmotor, API-nøkler)
ALTER TABLE project_modules ADD COLUMN IF NOT EXISTS config jsonb;
