---
name: opprydding-arbeidstraer-2026-07-17
status: ✅ UTFØRT 2026-07-17 — historikk
eier: fabel (plan) · Kenneth (vedtak K-a/K-b + kjøring) · cowork (verifisering)
sist_verifisert_mot_kode: 2026-07-17
---

# Oppryddingsplan — SiteDoc-arbeidstrær (rev. 2)

> **✅ UTFØRT 2026-07-17.** Sluttilstand: fire trær. Ført som historikk fordi lærdommen nederst ikke finnes noe annet sted. Gjeldende tre-roller: [parallell-arbeid-lock.md](../parallell-arbeid-lock.md) (styrende). Fase 4 + inventar-steget: [SAMARBEIDSREGLER.md](../SAMARBEIDSREGLER.md).
>
> **Rev. 2 etter cowork-verifisering: rev. 1 var feil-rettet** — den foreslo å slette trær med dokumentert, levende formål.

## Fasit fra styringsdokumentet

| Tre | Dokumentert rolle | Utfall |
|---|---|---|
| `SiteDoc` | redesign-treet — **rolle utdatert** (redesign fullmerget 2026-07-09; sto detached 39 bak develop) | ✅ **Omdefinert** (K-a): dev-tre på `develop`, docs-commits, deploy-kilde |
| `SiteDoc-develop` | develop; feature/docs — «aldri merge-kilde» | ✅ Består (økt-tre, detached) |
| `SiteDoc-merge` | «Merger utføres KUN her» — sikkerhetsnettet mot at merge-push drar u-gatede commits ut (lærdom e, 2026-07-07) | ✅ **Består — ble ikke slettet** |
| `SiteDoc-deploy` | `main`; prod-deploy (rsync-kilde) | ✅ Består |
| `sitedoc-server` | ny-server-arbeid — **rolle død** (0 commits utenfor develop siden 10. juni; cutover ferdig) | ✅ Fjernet, rad ut av styringsdokumentet |
| `SiteDoc-del6` · `-fratil` · `-oppfolgere` | **står ikke i fila** — rot fra døde økter | ✅ Fjernet (alle tomme) |

## Kenneth-vedtak

- **K-a ✅** — `SiteDoc` omdefinert til dev-tre på `develop`. Skrevet inn i `parallell-arbeid-lock.md`, ikke bare gjort.
- **K-b ✅** — sluttilstand **4 trær**. De to «ekstra» er infrastruktur, ikke rot: merge-gaten og prod-rsyncen har dokumenterte roller.

## Det kjøringen avdekket underveis

- **`index.lock`, 0 byte, 13 timer gammel** blokkerte `checkout develop`. Regel 6 i styringsdokumentet hadde prosedyren: diagnostisér (prosess · alder · størrelse) før fjerning.
- **14 untrackede skjermbilder** blokkerte `checkout` — verifisert byte-identiske med develop (`git hash-object` mot `rev-parse origin/develop:<fil>`), altså etterlatenskaper fra et tre som sto 39 commits bak. Slettet; git hentet dem tilbake som sporede.
- **`kode-doc-avvik.md` (18 KB) reddet** — lå untracked i `sitedoc-server` i fem uker. Funnet **kun** fordi `git worktree remove` nektet på et dirty tre. Ført som [🟡 HISTORISK](../kode-doc-avvik-sitedoc-server-2026-06-10.md) + [BACKLOG-post](../BACKLOG.md).
- **Nav-frysen løftet** — sonen var brutt 9 ganger siden 2026-07-09 uten kollisjon, fordi økta den beskyttet mot ikke redigerer kode lenger.

## Fabel-lærdom — «finnes det et styrende dokument for dette?»

> Rev. 1 foreslo å slette merge-treet — sikkerhetsnettet et styrende dokument beskriver som ufravikelig. **Årsak: jeg planla mot mappelisten (magefølelse) uten å spørre om det fantes et styringsdokument for trærne.** Regelen finnes allerede — «sjekk om noe alt dekker det» — og gjelder også planer, ikke bare kode. **Statuskilde-spørsmålet «finnes det et styrende dokument for dette?» skal stilles FØR enhver struktur-plan.**

**Cowork har samme lærdom, dyrere:** `CLAUDE.md` sier at kontroll-laget skal lese `parallell-arbeid-lock.md` **først**. Den lå ulest i to døgn mens innholdet ble rekonstruert med grep — tre-rollene, merge-treets eksistensberettigelse, og `index.lock`-prosedyren sto alle ferdig skrevet, med datoer og lærdommer.

**Vi la til fire nye regler ved siden av regler som allerede fantes og ikke ble lest.** Det var aldri papiret som sviktet.
