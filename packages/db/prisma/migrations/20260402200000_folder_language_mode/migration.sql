-- Språkarv: legger til language_mode på mapper (inherit/custom)
ALTER TABLE "folders" ADD COLUMN "language_mode" TEXT NOT NULL DEFAULT 'inherit';
