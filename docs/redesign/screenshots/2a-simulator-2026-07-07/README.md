# 2a mobil-tabs — simulator-verifiseringsbevis (2026-07-07)

iOS-simulator (iPhone 16 Plus, iOS 18.4), test-API via localhost-tunnel,
innlogget som `kemyrhau@gmail.com` (sitedoc_admin m/data), prosjekt
**Markussen Boligfelt B12**. Sammenlignes mot `../04-design.png` (2a-designet).
Oppsett: se [`docs/claude/simulator-runbook.md`](../../../claude/simulator-runbook.md).

| Fil | Viser | Verifisert |
|---|---|---|
| `01-mer-flagg-av.png` | Mer, flagg AV — tab-rad Hjem·Byggeplasser·Mapper·Mer (dagens fire), «Ny navigasjon»-toggle synlig (sitedoc_admin), Kontakter skjult | ✓ |
| `02-mer-flagg-pa.png` | Mer, flagg PÅ — tab-rad Hjem·Tegninger·Dokumenter·Timer·Mer, Kontakter-rad + toggle PÅ | ✓ |
| `03-tegninger-2d.png` | Tegninger 2D — segmentert [2D\|3D\|2D+3D], byggeplass-grupper, filtype-flis + «PNG · Rev. A» (degradert: uten ★/punkt-antall/thumbnail) | ✓ |
| `04-tegninger-3d-nav.png` | 3D-segment → push til `/3d-visning` (Ingen IFC-modeller — B12 har ingen IFC) | ✓ |
| `05-dokumenter-toppnivaa.png` | Dokumenter — mappe m/ «egne språk: EN LT» | ✓ |
| `06-dokumenter-mappe-avvik.png` | Dokumenter i mappe — brødsmulesti + oversettelsesstatus + språkavvik-rad «Bekreft Lietuvių + oversett»/«Behold» | ✓ |
| `07-timer-liste.png` | Timer-tab — dagsseddel-lista (ekstrahert `DagsseddelListe`, uten tilbake-pil) | ✓ |
| `08-timer-stack-push.png` | Timer — tapp rad → push inn i uendret `app/timer/[id]`-stack | ✓ |
| `09-kontakter.png` | Kontakter (fra Mer, K6) — read-only, gruppert per faggruppe, mailto:-chip | ✓ |
| `10-arbeider-mer-ingen-toggle.png` | Mer som `test-arbeider` — INGEN toggle/BETA-seksjon (admin-gating), Kontakter synlig | ✓ |

**Ikke fanget (ikke kodefeil):** IFC-kort (B12 mangler IFC), amber «Oversetter …»-state (seed-jobb ferdigprosessert).
