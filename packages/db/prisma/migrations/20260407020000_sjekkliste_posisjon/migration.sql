-- Posisjon (pin) på tegning for sjekklister
ALTER TABLE checklists ADD COLUMN position_x DOUBLE PRECISION;
ALTER TABLE checklists ADD COLUMN position_y DOUBLE PRECISION;
