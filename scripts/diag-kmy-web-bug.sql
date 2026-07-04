-- Diagnostikk: web-prosjektliste tom for KMY mens mobil viser 999.
-- Hypotese: to users-rader for samme Microsoft-konto → web og mobil
-- autentiserer som ulike users-rader. Eksponerer ingen secrets.
--
-- Tolkning:
--   USER    = alle bruker-rader på e-posten (se etter 2+ rader / ulik can_login)
--   ACCOUNT = hvilken user Microsoft-kontoen er koblet til (web bruker denne)
--   MEMBER  = hvilken user har ProjectMember 999 (mobil + leggTilMedlem)
--   ORGMEM  = OrganizationMember (styrer firma-velger #2)
--   SESSION = varighet ~24t → web-sesjon, ~30d (720t) → mobil-sesjon.
--             Ulik user_id på 24t- vs 30d-sesjon = rot-årsak bekreftet.

\set epost 'KennethMyrhaug@KennethMyrhaug.onmicrosoft.com'

SELECT 'USER' AS k, u.id, u.email AS c2, u.can_login::text AS c3,
       u.role || ' ' || to_char(u.created_at, 'MM-DD HH24:MI') AS c4
FROM users u
WHERE u.email ILIKE :'epost'

UNION ALL
SELECT 'ACCOUNT', a.user_id, a.provider, left(a.provider_account_id, 8) || '…', ''
FROM accounts a
WHERE a.user_id IN (SELECT id FROM users WHERE email ILIKE :'epost')

UNION ALL
SELECT 'MEMBER', pm.user_id, p.project_number, p.name, pm.role
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE pm.user_id IN (SELECT id FROM users WHERE email ILIKE :'epost')

UNION ALL
SELECT 'ORGMEM', om.user_id, o.name, array_to_string(om.firma_roller, ','), ''
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.user_id IN (SELECT id FROM users WHERE email ILIKE :'epost')

UNION ALL
SELECT 'SESSION', s.user_id,
       to_char(s.created_at, 'MM-DD HH24:MI'),
       to_char(s.expires, 'MM-DD'),
       (s.expires - s.created_at)::text
FROM sessions s
WHERE s.user_id IN (SELECT id FROM users WHERE email ILIKE :'epost')

ORDER BY 1, 2;
