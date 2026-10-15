import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { utenAktivtKjørendeWhere } from "./reprosessering";

/**
 * RETUR 2026-10-15 (Kontrollør) punkt 1, DB-nivå: et dokument som henger i
 * `processing` etter prosess-crash (gammel `updated_at`) skal PLUKKES OPP av
 * reprosesseringen (`tvingReekstraksjonAv`/`reparerDokumentSett` bruker
 * `utenAktivtKjørendeWhere`), mens et dokument som FAKTISK kjører nå (ferskt
 * `processing`) skal hoppes over.
 *
 * DB-integrasjonstest (ekte prisma). Importerer IKKE mappeRouter (unngår
 * pdf.js-forgiftning) og bruker ikke embedding — kun where-filteret mot DB.
 * Ekskludert fra `pnpm test`, kjøres via `pnpm --filter @sitedoc/api test:integration`.
 */

const ids = { projectId: "" };
const dokIder: string[] = [];

async function lagDok(filename: string, state: string, alderMin: number): Promise<string> {
  const dok = await prisma.ftdDocument.create({
    data: { projectId: ids.projectId, filename, processingState: state },
  });
  dokIder.push(dok.id);
  // `updated_at` er @updatedAt (auto) — tving en fortid via rå SQL for å simulere
  // at dokumentet ikke har hatt fremdrift på `alderMin` minutter.
  //
  // `updated_at` er `timestamp WITHOUT time zone`, lagret/lest som UTC av Prisma.
  // `now()` gir sesjonens tz, så vi skriver UTC-veggklokka (`now() AT TIME ZONE
  // 'UTC'`) — ellers forskyves verdien med tz-offset og testen feiler utenfor en
  // UTC-sesjon (målt i +02 lokalt 2026-10-16).
  await prisma.$executeRaw`
    UPDATE ftd_documents
    SET updated_at = (now() AT TIME ZONE 'UTC') - make_interval(mins => ${alderMin}::int)
    WHERE id = ${dok.id}
  `;
  return dok.id;
}

beforeAll(async () => {
  const p = await prisma.project.create({
    data: { projectNumber: `STRANDET-${Date.now()}`, name: "Strandet testprosjekt" },
  });
  ids.projectId = p.id;
});

afterAll(async () => {
  for (const id of dokIder) await prisma.ftdDocument.delete({ where: { id } }).catch(() => {});
  if (ids.projectId) await prisma.project.delete({ where: { id: ids.projectId } }).catch(() => {});
});

describe("Strandet processing plukkes opp av reprosessering", () => {
  it("gammelt processing inkluderes, ferskt processing ekskluderes, completed inkluderes, unsupported ekskluderes", async () => {
    const strandetId = await lagDok(`strandet-${Date.now()}.pdf`, "processing", 20); // crashet
    const ferskId = await lagDok(`fersk-${Date.now()}.pdf`, "processing", 0); // kjører nå
    const completedId = await lagDok(`completed-${Date.now()}.pdf`, "completed", 60);
    const unsupportedId = await lagDok(`doc-${Date.now()}.doc`, "unsupported", 60);

    const treff = await prisma.ftdDocument.findMany({
      where: utenAktivtKjørendeWhere({ projectId: ids.projectId }),
      select: { id: true },
    });
    const sett = new Set(treff.map((d) => d.id));

    expect(sett.has(strandetId)).toBe(true); // crashet → plukkes opp
    expect(sett.has(ferskId)).toBe(false); // kjører nå → hoppes over
    expect(sett.has(completedId)).toBe(true); // ferdig → kan tvinges på nytt
    expect(sett.has(unsupportedId)).toBe(false); // ikke-støttet → hoppes over
  });
});
