-- Snapshot-felt for tidslinje-kontekst
ALTER TABLE document_transfers ADD COLUMN sender_enterprise_name TEXT;
ALTER TABLE document_transfers ADD COLUMN recipient_enterprise_name TEXT;
ALTER TABLE document_transfers ADD COLUMN dokumentflyt_name TEXT;
ALTER TABLE document_transfers ADD COLUMN sender_rolle TEXT;
