# Mockup: «Hent fra arkiv» på mallisten (fabel, 2026-09-12)

Til cowork/redesign-Opus — presisering av tre-nivå-malverket (Kenneth 2026-09-12):

1. **Ingen ny malbygger på prosjektnivå** — den vi har i dag beholdes som den er.
2. **Ny inngang på dagens malliste** (Oppsett › Produksjon › Sjekklistemaler m.fl.):
   knappen «Hent fra arkiv» ved siden av «Legg til». Modal med faner Firmaarkiv /
   SiteDoc-arkiv. «Hent kopi» legger en kopi rett i prosjektets malliste (V5: kopi
   ved henting, aldri levende referanse).
3. **Rettighetsmatrisen vises ikke i UI** — den ER synlighetsfunksjonen mot arkivet:
   - SiteDoc-admin: redigerer begge arkiver
   - Firmaadmin: redigerer firmaarkiv, leser SiteDoc-arkiv (hent kopi)
   - Prosjektadmin: leser firmaarkiv (hent kopi), ser IKKE SiteDoc-arkiv
   Regel: lån kun fra nivået rett over — aldri to opp. Bygges det senere en
   rettighetsmatrise, er dette regelen som legges inn der.

Filer:
- mockup-hent-fra-arkiv-fabel-2026-09-12.dc.html — interaktiv mockup (rollebryter øverst)
- mockup-bilder/bilde-1..4 — nøkkeltilstander (prosjektadmin firmaarkiv / hentet kopi /
  låst SiteDoc-fane / firmaadmin i SiteDoc-arkivet)
