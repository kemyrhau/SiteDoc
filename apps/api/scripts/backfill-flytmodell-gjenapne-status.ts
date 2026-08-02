/**
 * Flytmodell pilot-fiks D + #11 — backfill av feil-skrevet gjenåpne-status-cache (2026-08-02).
 *
 * BAKGRUNN: før D-fiksen skrev gjenåpning (terminal→draft) `sendt=false` (flytFakta.ts:201, gammel)
 * → `avledStatus` ga status="draft"/«Utkast» for et dok som faktisk HAR forlatt ledд 1 (§ 2.3).
 * Kode-fiksen retter kun NYE gjenåpninger; eksisterende gjenåpnede dok beholder den ugyldige
 * cachen (f.eks. KB2-010 på test) til de re-avledes.
 *
 * ⚠️ AVVIK FRA ORDRE-FORMULERING (flagget til cowork): de berørte radene har `sendt=FALSE`
 * (ikke `sendt=true` som ordren antok) — det var nettopp `sendt=false` som ga draft. En ren
 * «re-avled status»-backfill ville derfor vært en no-op (sendt=false → draft uansett). Roten som
 * må rettes er FAKTAET `sendt`: et gjenåpnet dok skal ha `sendt=true`. Dette scriptet setter
 * `sendt=true` + re-avleder `status` via delt `avledStatus` for rader som var TERMINALE og er
 * gjenåpnet (har en transfer til en terminal-status, men ligger nå som draft, terminal=null).
 *
 * SCOPE (kun gjenåpne, IKKE trekk-tilbake): trekk-tilbake (received→draft) har INGEN terminal-
 * transfer i historikken → matches ikke → beholder `sendt=false`/«Utkast» (D-scoping, fabel-sak
 * for seg). Genuine utkast (aldri sendt, ingen terminal-transfer) røres heller ikke.
 *
 * IDEMPOTENT: etter fiks blir status ≠ 'draft' → radene matcher ikke ved ny kjøring. Skriver kun
 * rader der (sendt, status) faktisk avviker fra korrekt avledet verdi.
 *
 * Bruk (mot ønsket DB — verifiser DATABASE_URL FØRST; kjøres mot sitedoc_test av Kenneth post-deploy):
 *   pnpm --filter @sitedoc/api exec tsx scripts/backfill-flytmodell-gjenapne-status.ts
 */

import { prisma } from "@sitedoc/db";
import { avledStatus } from "@sitedoc/shared";

// Terminal-statuser en transfer kan ha ledet til (= dok var terminal → gjenåpnet).
const TERMINAL_STATUSER = ["approved", "dismissed", "closed", "cancelled", "rejected"];

interface Rad {
  id: string;
  status: string;
  aktivPosisjon: number | null;
  retning: string | null;
  terminal: string | null;
  sendt: boolean;
}

/** Riktig (sendt, status) for en gjenåpnet rad: sendt=true, status re-avledet med terminal=null. */
function korrekt(rad: Rad): { sendt: boolean; status: string } {
  const { status } = avledStatus({
    aktivPosisjon: rad.aktivPosisjon,
    retning: rad.retning,
    terminal: null, // gjenåpnet dok er ikke lenger terminal
    sendt: true,
  });
  return { sendt: true, status };
}

const select = {
  id: true,
  status: true,
  aktivPosisjon: true,
  retning: true,
  terminal: true,
  sendt: true,
} as const;

const whereGjenapnet = {
  status: "draft",
  terminal: null,
  transfers: { some: { toStatus: { in: TERMINAL_STATUSER } } },
} as const;

async function backfillChecklists(): Promise<{ oppdatert: number; uendret: number }> {
  const rader = await prisma.checklist.findMany({ where: whereGjenapnet, select });
  let oppdatert = 0;
  let uendret = 0;
  for (const c of rader) {
    const k = korrekt(c);
    if (c.sendt === k.sendt && c.status === k.status) {
      uendret++;
      continue;
    }
    await prisma.checklist.update({ where: { id: c.id }, data: { sendt: k.sendt, status: k.status } });
    console.log(`  Checklist ${c.id}: draft/sendt=${c.sendt} → ${k.status}/sendt=${k.sendt} (pos ${c.aktivPosisjon})`);
    oppdatert++;
  }
  return { oppdatert, uendret };
}

async function backfillTasks(): Promise<{ oppdatert: number; uendret: number }> {
  const rader = await prisma.task.findMany({ where: whereGjenapnet, select });
  let oppdatert = 0;
  let uendret = 0;
  for (const t of rader) {
    const k = korrekt(t);
    if (t.sendt === k.sendt && t.status === k.status) {
      uendret++;
      continue;
    }
    await prisma.task.update({ where: { id: t.id }, data: { sendt: k.sendt, status: k.status } });
    console.log(`  Task ${t.id}: draft/sendt=${t.sendt} → ${k.status}/sendt=${k.sendt} (pos ${t.aktivPosisjon})`);
    oppdatert++;
  }
  return { oppdatert, uendret };
}

async function main() {
  console.log("Flytmodell pilot-fiks D — backfill gjenåpne-status-cache (sendt=true + re-avled)\n");
  const cl = await backfillChecklists();
  console.log(`Sjekklister: ${cl.oppdatert} rettet, ${cl.uendret} allerede korrekte`);
  const tk = await backfillTasks();
  console.log(`Oppgaver:    ${tk.oppdatert} rettet, ${tk.uendret} allerede korrekte`);
  console.log("\nFerdig.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
