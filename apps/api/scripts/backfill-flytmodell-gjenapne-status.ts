/**
 * Flytmodell backfill — feil-skrevet «forlatt ledд 1»-status-cache (pilot-fiks D + Runde-2 R1).
 *
 * BAKGRUNN: et dok som HAR forlatt ledд 1 skal ha `sendt=true` (§ 2.3) → «Hos N», aldri «Utkast».
 * To draft-overganger brøt dette før fiksene:
 *   1. GJENÅPNE (terminal→draft): skrev `sendt=false` → «Utkast» (pilot-fiks D, f.eks. KB2-010).
 *   2. TREKK-TILBAKE (received→draft): skrev `sendt=false` + `retning="tilbake"` → «Utkast»
 *      (Runde-2 R1 reverserer D-scopingen; nå skal trekk-tilbake òg gi `sendt=true` + `retning="frem"`
 *      → «Hos N», f.eks. KB2-017).
 * Kode-fiksen retter kun NYE overganger; eksisterende feilskrevne dok re-avledes her.
 *
 * ROTEN er FAKTAENE `sendt` (+ `retning` for trekk-tilbake): en ren «re-avled status» ville vært
 * no-op (sendt=false → draft uansett). Scriptet setter `sendt=true` + `retning="frem"` + re-avleder
 * `status` via delt `avledStatus` (terminal=null) → «Hos N» (received).
 *
 * SCOPE — tre grupper, alle «forlatt ledд 1»:
 *   (a) gjenåpne  : status=draft, terminal=null, HAR terminal-transfer i historikken.
 *   (b) trekk-tilbake: status=draft, terminal=null, HAR received→draft-transfer (ingen terminal).
 *   (c) legacy in_progress: status=in_progress (Q1-kollaps — skal være received/«Hos N»).
 * Genuine utkast (aldri sendt: status=draft, ingen slik transfer) røres ALDRI.
 *
 * IDEMPOTENT: etter fiks matcher radene ikke lenger (status≠draft/≠in_progress). Skriver kun rader
 * der (sendt, retning, status) faktisk avviker fra korrekt avledet verdi.
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

/**
 * Riktig (sendt, retning, status) for et «forlatt ledд 1»-dok: sendt=true, retning=frem (R1 —
 * bakover-ness er historisk faktum i transferloggen, ikke en cache-distinksjon), status re-avledet
 * med terminal=null → «Hos N» (received).
 */
function korrekt(rad: Rad): { sendt: boolean; retning: string; status: string } {
  const { status } = avledStatus({
    aktivPosisjon: rad.aktivPosisjon,
    retning: "frem",
    terminal: null, // ikke lenger terminal
    sendt: true,
  });
  return { sendt: true, retning: "frem", status };
}

const select = {
  id: true,
  status: true,
  aktivPosisjon: true,
  retning: true,
  terminal: true,
  sendt: true,
} as const;

// (a) gjenåpne + (b) trekk-tilbake: draft-status, forlatt ledд 1 (terminal-transfer ELLER
// received→draft-transfer). (c) legacy in_progress fanges av egen where under.
const whereGjenapnet = {
  status: "draft",
  terminal: null,
  OR: [
    { transfers: { some: { toStatus: { in: TERMINAL_STATUSER } } } }, // (a) gjenåpne
    { transfers: { some: { fromStatus: "received", toStatus: "draft" } } }, // (b) trekk-tilbake
  ],
} as const;

// (c) legacy in_progress → received (Q1-kollaps, Runde-2). in_progress skrives aldri lenger.
const whereInProgress = { status: "in_progress" } as const;

// Alle tre gruppene = «forlatt ledд 1», feilskrevet cache.
const whereForlattLedd1 = { OR: [whereGjenapnet, whereInProgress] } as const;

async function backfillChecklists(): Promise<{ oppdatert: number; uendret: number }> {
  const rader = await prisma.checklist.findMany({ where: whereForlattLedd1, select });
  let oppdatert = 0;
  let uendret = 0;
  for (const c of rader) {
    const k = korrekt(c);
    if (c.sendt === k.sendt && c.status === k.status && c.retning === k.retning) {
      uendret++;
      continue;
    }
    await prisma.checklist.update({ where: { id: c.id }, data: { sendt: k.sendt, retning: k.retning, status: k.status } });
    console.log(`  Checklist ${c.id}: ${c.status}/sendt=${c.sendt}/retning=${c.retning} → ${k.status}/sendt=${k.sendt}/retning=${k.retning} (pos ${c.aktivPosisjon})`);
    oppdatert++;
  }
  return { oppdatert, uendret };
}

async function backfillTasks(): Promise<{ oppdatert: number; uendret: number }> {
  const rader = await prisma.task.findMany({ where: whereForlattLedd1, select });
  let oppdatert = 0;
  let uendret = 0;
  for (const t of rader) {
    const k = korrekt(t);
    if (t.sendt === k.sendt && t.status === k.status && t.retning === k.retning) {
      uendret++;
      continue;
    }
    await prisma.task.update({ where: { id: t.id }, data: { sendt: k.sendt, retning: k.retning, status: k.status } });
    console.log(`  Task ${t.id}: ${t.status}/sendt=${t.sendt}/retning=${t.retning} → ${k.status}/sendt=${k.sendt}/retning=${k.retning} (pos ${t.aktivPosisjon})`);
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
