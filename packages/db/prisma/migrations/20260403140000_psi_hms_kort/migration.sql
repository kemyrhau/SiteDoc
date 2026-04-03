-- AlterTable: Legg til guestMessage på psi
ALTER TABLE "psi" ADD COLUMN "guest_message" TEXT;

-- AlterTable: Legg til HMS-kort felter på psi_signaturer
ALTER TABLE "psi_signaturer" ADD COLUMN "hms_kort_nr" TEXT;
ALTER TABLE "psi_signaturer" ADD COLUMN "har_ikke_hms_kort" BOOLEAN NOT NULL DEFAULT false;
