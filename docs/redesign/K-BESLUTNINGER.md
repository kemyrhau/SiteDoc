# K-beslutninger for paritetssjekklisten (Kenneth via fabel, 2026-07-05)

Svar på K1–K11 fra `docs/claude/redesign-paritetssjekkliste.md`.

**Status:** K1, K2, K4, K5, K6, K10 = vedtatt, inn i redesignet. K3, K7, K8, K11 = utsatt, ikke låst. K9 = avventer rapport.

- **K1 Maskin**: Vises under FIRMA-sonen i ny nav. URL `/dashbord/maskin` beholdes inntil videre — nav-plassering og URL-flytt er separate saker. Ev. URL-flytt senere med redirect.
- **K2 Mine timer**: Flyttes til brukermeny (avatar) + søketreff «Min side › Timer». Fjernes fra firma-sidebar. På mobil dekkes det av Timer-tab.
- **K3 HMS hybrid (modul-flag vs domain)**: UTSATT — utenfor redesign-scope. Redesignet viser HMS der modulen er på; datamodellen røres ikke.
- **K4 3D**: Konsolideres på **nav-nivå**: én inngang «Tegninger» med 2D/3D/2D+3D-toggle (jf. 2a-designet); `modeller`/`punktskyer` blir underinnganger. Kodekonsolidering er egen, senere sak.
- **K5 Sjekkliste-/oppgavemaler**: Hub-kort «Maler» under PROSJEKT-innstillinger (jf. 1a). Ikke toppnivå i sidebar — sidebar er for arbeidsflater, ikke konfig.
- **K6 Kontakter/Dokumentflyt**: **SPLITT, ikke bare rename** (renamen er alt gjort i kode — `/oppsett/produksjon/kontakter` er redirect). Siden rommer to konsepter: (1) personkatalog med tlf/e-post — bekreftet av Kenneth som tiltenkt kontaktoversikt per prosjekt, (2) flyt-konfig. Løsning: «Dokumentflyt» forblir prosjekt-innstilling (hub-kort); NY lesevisning **«Kontakter»** (faggrupper + folk m/ tlf/e-post, klikk-for-å-ringe på mobil) i PROSJEKT-sonen i sidebar, i søket og i mobilens Mer-tab. Egen paritetsrad. Samme datagrunnlag som dokumentflyt-siden — kun ny visning.
- **K7 OrganizationModule-overgang**: UTSATT. Redesignet leser dagens `har*Modul`-flagg via ett felles gating-abstraksjonslag, slik at overgangen senere blir én endring.
- **K8 Onboarding/pedagogisk lag**: UTSATT — men noter i onboarding-veilederen at 1a-huben er naturlig hjem for «Kom i gang»-innhold.
- **K9 Duplikat prosjekt-rutetre** (`/dashbord/prosjekter/[id]/*` vs `/dashbord/[prosjektId]/*`): IKKE avgjort. Første leveranse: rapporter hva som faktisk lenkes fra UI i dag. Arbeidshypotese: `/dashbord/[prosjektId]/*` er kanonisk, det andre får redirects — men Kenneth avgjør etter rapporten.
- **K10 Ansatte vs Brukere**: UI-term = **«Ansatte»** (følger koden, `firma/ansatte`); hub-kort heter «Ansatte og roller». Vaktpost: siden er både kontoadmin (rolle, invitasjon) og ansattdata (ansattnummer), og kommende HR-Import kan gi ansatte uten brukerkonto — **ikke hardkod «ansatt = bruker»** i navigasjon eller komponentnavn.
- **K11 Admin-redesign (abonnement/drill-down)**: UT AV SCOPE. Lag 6 (kun sitedoc_admin) tas som egen fase etter at kunderettet nav er landet.

Se også README § Avklarte K-beslutninger (K6/K10 i detalj). Designfilen er oppdatert med «Kontakter» i sidebar-PROSJEKT-sonen (1b) og hub-kortet «Ansatte og roller» (1a).
