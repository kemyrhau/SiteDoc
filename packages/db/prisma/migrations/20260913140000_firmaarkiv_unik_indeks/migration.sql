-- Funn #10, «Malforvaltning — 17 målte funn 2026-09-13»: unik indeks mot dobbelt-lån
-- av samme bibliotekmal til samme firma. Vakten (firmamal.ts findFirst + CONFLICT) er
-- pen feilmelding; DENNE indeksen er garantien mot samtidige lån (sjekk-og-skriv-race).
--
-- KREVER at eksisterende duplikater er ryddet FØR migreringen kjøres. CREATE UNIQUE INDEX
-- FEILER HØYT («could not create unique index ... is duplicated») hvis duplikater finnes —
-- det er tilsiktet (krav 2). Migreringen rører INGEN rader: ingen DELETE, ingen ON CONFLICT.
--
-- laantFraBibliotekMalId er NULLABLE. Postgres NULLS DISTINCT (default) → flere egne
-- (ikke-lånte) firmamaler med NULL er fortsatt lov. Kun lån med samme bibliotekMalId blokkeres.

-- CreateIndex
CREATE UNIQUE INDEX "organization_templates_organization_id_laant_fra_bibliotek__key" ON "organization_templates"("organization_id", "laant_fra_bibliotek_mal_id");
