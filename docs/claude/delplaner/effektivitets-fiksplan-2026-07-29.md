# Fiks-plan — effektivitets-audit (fabel-prioritering, 2026-07-29)

> Fabel-gate på `verifisering/effektivitets-audit-2026-07.md` (audit/effektivitets `be3fc62c`): **GODKJENT** — solid måling, rotårsaker med fil:linje, riktig skille småsak/strukturell. Denne planen er svaret på § Gate: prioritert rekkefølge til Kenneth/cowork. Ordrer skrives per blokk under.

## Prioritet 1 — BUGFIKS (før alt annet)
**§8A «Send» fra `received` er no-op + logg-forurensning** (server auto-konverterer sent→received, nullstiller recipient; hvert klikk = 2 logg-rader). Statusmaskin-avklaring (fabel-vedtak her): **«Send» skal IKKE tilbys fra `received`** — den har ingen semantikk der; framover er Besvar/Godkjenn, bakover Avvis/Send tilbake. Fiks i delt kilde (`hentStatusHandlinger`), ikke UI-skjuling. Latent felle §8-Q3(a) (first-match ved delt part) fikses i samme runde. Liten, ordre-klar fra rapporten.

## Prioritet 2 — småsaker, ordre-klare (én samle-ordre, wiring av eksisterende kilder)
1. V2 byggeplass/tegning inn i de 4 opprett-mutasjonene (+ rydd daud binding).
2. V1c lønnsart-prefill web (firma-default i stedet for tom).
3. V5a fjern suksess-Alert etter sjekkliste-lagring (LagreIndikator dekker).
4. Galleri-kobling i FeltDokumentasjon mobil (`velgBilde` finnes).
5. **V3 web auto-hopp malvelger ved 1 mal** — flyttes HIT fra strukturell: mobil-mønsteret (`MalVelger.tsx:47-58`) speiles; ruting «rett inn i utfylling» følger dagens detaljside-rute (ett-klikk-målbildets fulle rute kommer i P4). NB: V3 er også innfrielse av del6b-lovnaden — merk i verifiseringsloggen.

## Prioritet 3 — handlingslinje-redesign (§8B, fabel-design → ordre)
Generaliser split-mønsteret: primær + split-▾ med øvrige lovlige handlinger (betingelse «primær + ≥1 øvrig», ikke bare draft-send); sekundær-bøtta inn under split; Videresend beholder person-velger; + kommentar vurderes inn i ▾. Verste fall 6 → 2-3 elementer. Jeg leverer skisse før ordren (liten mockup, gjenbruker §8B-matrisa som testfasit).

## Prioritet 4 — ett-klikk opprett (strukturell, fabel-skisse foreligger)
Målbildet + fallback-stige + overstyring (inkl. mal-velger gruppert per dokumentflyt ved flere registrator-flyter — Kenneth 2026-07-29) står i audit-ordren; mockup `Ett-klikk Opprett Malbilde.dc.html` (1a/1b). Rekkefølge innen P4: (a) mobil iOS-modal-blokkeringen (§6.9) løses først — teknisk forutsetning; (b) web prosjekt-autofyll sist-brukte (§6.8); (c) timer todelt inngang → ett-trykk (§6.6) — størst gevinst (7→1-2), egen ordre.

## Prioritet 5 — øvrige
Web bilde-komprimering (V4; arkitekturvalg klient-canvas vs sharp — cowork velger), mobil statusbekreftelse-modal hoppes over når begrunnelse ikke kreves (V5b — kan evt. slås inn i P3-ordren), PSI/QR→prosjekt (ny inngang, backlog; «tilstedeværelse ≠ arbeidstid» ufravikelig).

## Ruting
P1 + P2 er ordre-klare nå — cowork kan rute til fiks-Opus direkte fra rapporten + denne planen. P3-skisse er neste fabel-leveranse. P4-ordrer skrives etter P3 (handlingslinja rører samme flater).
