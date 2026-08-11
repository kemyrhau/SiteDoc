/**
 * Steg 1 — backfill av OrganizationSeedPolicy (modul-onboarding, 2026-08-11).
 *
 * Skriver prod-sannheten inn i policy-modellen FØR seed-guardene gjøres
 * «finnes rader»-baserte (steg 2). Rekkefølgen er ufravikelig: uten
 * policy-radene ville en «finnes rader»-guard «fikset» kunder som bevisst har
 * egen katalog og gjeninnført driften vi bygger for å fjerne.
 *
 * To kategorier egen_katalog-rader:
 *   1) EKSPLISITT kjent: A.Markussen + lonnsart (de har importerte lønnsarter,
 *      seedNivaa=2/null, 0 med nivaa=1). Beslutningen registreres selv om de HAR
 *      rader — så den er permanent (overlever en evt. tømming) og gir korrekt
 *      onboarding-status (komplett_egen_katalog, ikke standard).
 *   2) 0-KATALOG: firmamodul aktiv + 0 katalograder for en datatype
 *      (aktiverTomKatalog-firma eller ikke-onboardet). «finnes rader»-guarden
 *      ville seedet grunnpakke inn i disse; egen_katalog beskytter dem.
 *      Kan ikke skille «bevisst tom» fra «aldri onboardet» i data → begge
 *      beskyttes (cowork-gate 2026-08-11). Nye firma seedes riktig av den nye
 *      dispatchen (steg 3).
 *
 * Datatyper: lonnsart, aktivitet, tillegg (db-timer). utleggskategori er
 * UTELATT — den er utlegg-området (rører ikke) og har allerede robust
 * «finnes rader»-guard (ingen risiko). varekategori (varelager) har ingen seed
 * ennå (håndteres når hooken bygges i steg 4).
 *
 * Bruk (DRY-RUN som standard — skriver ingenting, printer planlagt liste):
 *   pnpm --filter @sitedoc/api exec tsx scripts/backfill-seed-policy.ts
 * Kjør backfillen (etter at listen er godkjent):
 *   pnpm --filter @sitedoc/api exec tsx scripts/backfill-seed-policy.ts --apply
 *
 * Idempotent: hopper over (org, datatype) som allerede har en policy-rad.
 */

import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";

const APPLY = process.argv.includes("--apply");
const KENNETH_EPOST =
  process.argv.find((a) => a.startsWith("--kenneth-epost="))?.split("=")[1] ??
  "kemyrhau@gmail.com";

const A_MARKUSSEN_ORG_ID = "4488fe17-7490-409f-9c1c-2827f257c54d";
const A_MARKUSSEN_LONNSART_BEGRUNNELSE =
  "Kenneth 2026-08-11: «Det var alltid meningen at vi importerer til " +
  "A.Markussen de lønnsartene de bruker, og ikke lønnsarter utledet fra " +
  "diverse lover.»";

// Datatyper som gjøres «finnes rader»-guardet i steg 2 → må beskyttes her.
const TIMER_DATATYPER = ["lonnsart", "aktivitet", "tillegg"] as const;

type Planlagt = {
  organizationId: string;
  organizationNavn: string;
  datatype: string;
  begrunnelse: string;
  kategori: "eksplisitt" | "0-katalog";
  // Gjeldende antall katalograder NÅ — så Kenneth kan vurdere lista: en eksplisitt
  // rad kan ha mange rader (A.Markussen: importert katalog), en 0-katalog-rad har 0
  // (og «0 + aldri onboardet» er den Kenneth må kjenne igjen på navnet og evt. onboarde).
  gjeldendeAntall: number;
};

function tellDatatype(orgId: string, datatype: string): Promise<number> {
  switch (datatype) {
    case "lonnsart":
      return prismaTimer.lonnsart.count({ where: { organizationId: orgId } });
    case "aktivitet":
      return prismaTimer.aktivitet.count({ where: { organizationId: orgId } });
    case "tillegg":
      return prismaTimer.tillegg.count({ where: { organizationId: orgId } });
    default:
      return Promise.resolve(-1);
  }
}

async function main() {
  // settAv = Kenneth (sitedoc_admin). Resolv via e-post, fallback rolle.
  const kenneth =
    (await prisma.user.findUnique({ where: { email: KENNETH_EPOST }, select: { id: true, name: true } })) ??
    (await prisma.user.findFirst({ where: { role: "sitedoc_admin" }, select: { id: true, name: true } }));
  if (!kenneth) {
    console.warn("[BACKFILL] Fant ingen sitedoc_admin/Kenneth-bruker — settAvUserId blir null.");
  } else {
    console.log(`[BACKFILL] settAv = ${kenneth.name ?? kenneth.id} (${kenneth.id})`);
  }
  const settAvUserId = kenneth?.id ?? null;

  const eksisterende = await prisma.organizationSeedPolicy.findMany({
    select: { organizationId: true, datatype: true },
  });
  const harPolicy = new Set(eksisterende.map((p) => `${p.organizationId}|${p.datatype}`));

  const planlagt: Planlagt[] = [];

  // Kategori 1 — eksplisitt: A.Markussen + lonnsart.
  const am = await prisma.organization.findUnique({
    where: { id: A_MARKUSSEN_ORG_ID },
    select: { id: true, name: true },
  });
  if (!am) {
    console.warn(`[BACKFILL] A.Markussen (${A_MARKUSSEN_ORG_ID}) finnes ikke i denne databasen — hopper over eksplisitt rad (forventet lokalt/test).`);
  } else if (!harPolicy.has(`${am.id}|lonnsart`)) {
    planlagt.push({
      organizationId: am.id,
      organizationNavn: am.name,
      datatype: "lonnsart",
      begrunnelse: A_MARKUSSEN_LONNSART_BEGRUNNELSE,
      kategori: "eksplisitt",
      gjeldendeAntall: await tellDatatype(am.id, "lonnsart"),
    });
  }

  // Kategori 2 — 0-katalog: firmamodul timer aktiv + 0 rader for en datatype.
  const timerAktive = await prisma.organizationModule.findMany({
    where: { moduleSlug: "timer", status: "aktiv" },
    select: { organizationId: true, organization: { select: { name: true } } },
  });
  for (const m of timerAktive) {
    for (const datatype of TIMER_DATATYPER) {
      if (harPolicy.has(`${m.organizationId}|${datatype}`)) continue;
      // A.Markussen-lonnsart dekkes eksplisitt over; ikke dupliser.
      if (m.organizationId === A_MARKUSSEN_ORG_ID && datatype === "lonnsart") continue;
      const antall = await tellDatatype(m.organizationId, datatype);
      if (antall === 0) {
        planlagt.push({
          organizationId: m.organizationId,
          organizationNavn: m.organization.name,
          datatype,
          begrunnelse:
            "Backfill 2026-08-11: firmamodul timer aktiv + 0 " +
            datatype +
            "-rader (bevisst tom / ikke-onboardet). Beskyttet mot auto-seed før guard-endring (steg 2).",
          kategori: "0-katalog",
          gjeldendeAntall: antall,
        });
      }
    }
  }

  // Rapport
  console.log(`\n=== BACKFILL-PLAN (${APPLY ? "APPLY" : "DRY-RUN"}) — ${planlagt.length} policy-rad(er) ===`);
  if (planlagt.length === 0) {
    console.log("Ingen nye policy-rader å skrive (alt finnes fra før eller ingen kandidater).");
  }
  for (const p of planlagt) {
    console.log(
      `  [${p.kategori}] ${p.organizationNavn} (${p.organizationId}) · ${p.datatype} → egen_katalog · gjeldende rader: ${p.gjeldendeAntall}`,
    );
    console.log(`      begrunnelse: ${p.begrunnelse}`);
  }

  if (!APPLY) {
    console.log("\nDRY-RUN — ingenting skrevet. Kjør med --apply etter godkjenning av lista.");
    return;
  }

  let skrevet = 0;
  for (const p of planlagt) {
    await prisma.organizationSeedPolicy.create({
      data: {
        organizationId: p.organizationId,
        datatype: p.datatype,
        policy: "egen_katalog",
        begrunnelse: p.begrunnelse,
        settAvUserId,
      },
    });
    skrevet++;
  }
  console.log(`\n[BACKFILL] Skrev ${skrevet} policy-rad(er).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
