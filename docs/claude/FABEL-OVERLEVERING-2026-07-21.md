# Fabel-overlevering — status per 2026-07-21

> Skrevet ved øktskifte. Ny fabel-økt: les CLAUDE.md, FABEL-RAMMEVERK.md, REDESIGN-MASTERPLAN.md + denne. Detaljert beslutningshistorikk: `delplaner/N3-oppfolging-design-grunnlag.md` (fabel-prosjektet). Repo-kilder: `docs/claude/delplaner/` på develop (alle ordrer/tabeller ligger i git — les der, ikke be Kenneth lime).

## Lukket og verifisert
- **N3 del 1+2** — lukket, develop-verifisert. Ikke prod-deployet (Kenneth-beslutning gjenstår).
- **Sak 1 paritet (G1-mutere)** — vedtatt (a), merget fd573b61. tillatFlytMedlemskap-parameter fjernet, gren ubetinget (fabel-gate). (b) ført som egen sak sak1b-mutasjoner-rollestyring.md.
- **A-3a Del E** — lukket. Registrator er superbruker per design (ikke inkonsistens).
- **Spor 1 CI** — bygget (Actions: lint+typecheck+tester); trigger-fiks for push-konvensjon lukket.
- **Spor 2** — ren funksjon avgjorDokumentTilgang ekstrakert, matrise-test skrevet FØR refaktor (a5f0a730 → bbcd6c9c), fabel bekreftet aksept av to utfalls-nøytrale ekstra reads (én sannhetskilde > duplisert logikk). Cowork godkjent for merge — bekreft med cowork at merge faktisk skjedde.
- **A-3b Fase A** — designgodkjent og formelt lukket: «Lest» ute (rutet til lesekvittering.md — krever Kenneth-vedtak, personvernside), rejected-etiketter perspektiv-avhengige m/ fargegrammatikk (warning hos ballen-holder, primary hos venter; § 2b kun baseline danger→primary), approved=success, received/avsender=«Til behandling», HMS rejected-retur JA i Fase B-scope som visningslags-utledning m/ stopp-regel. Siste retting: tabellen sier «Utkast» (ikke «Kladd») — kode uendret.

## Kø (vedtatt rekkefølge)
1. **Sak 2 opprett→usynlig** — rotårsak bekreftet (flytId kjent ved opprett men kastes; bindes ved send). Fabel-innstilling vedtatt: fiksvei (a) bestiller-gren i liste-filteret. Starter etter spor 2-merge; samme fil.
2. **A-3b Fase B** — ublokkert; cowork sekvenserer mot sak 2 (begge rører delte flater).
3. **Sak 3 HMS-synlighet** — Kenneth-vedtak trengs; fabel-innstilling (b) «aktivt ledd ser». Ufravikelig: F1-A-betingelsen !== "apen" → === "privat" i SAMME commit som null = normal flyt. D4/F1-A live-test (seedet privat HMS-dok) i testplanen.
4. **Sak 1b** (rollestyring av mutasjonslaget) — arkitektursak, ikke hastesak.
5. **B-2-ordren** venter fortsatt (toleranse, repeater-familie, trafikklys-gray, substrat-løft).
6. **TegningsCapture** — nedprioritert: latent, to-linjers fiks når mobil-økt likevel er inne.
7. **Lesekvittering** — Kenneth-vedtak: ønskes den i det hele tatt? (pilot-personvern).
8. **Prod-deploy N3+sak1** — Kenneth beslutter, cowork koreograferer.

## Etablerte prinsipper (gjenbruk)
- Seks-leddssløyfen; cowork gater ledd 2; fabel hevder aldri git-/test-tilstand.
- Automatiser matriser (tilgang, overganger) som tabelldrevne enhetstester; browser-test flater/UX.
- Test-før-refaktor på sikkerhetskritisk kode; cowork verifiserer ytterkantene (strukturell ekvivalens + fakta-bygging) når matrisen tar midten.
- UI viser aldri handling serveren avviser — delt kilde, aldri per-flate if-er.
- Den som oppretter ser alltid sitt eget dokument (invariant).
- Ingen nye funksjoner smuglet inn som «visning» (jf. «Lest»).
- Fantom-funn strøket 2026-07-20 (ikke plukk opp): «treg periode-refresh», «klient/server-divergens».
