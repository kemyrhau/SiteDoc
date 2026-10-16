import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { lagLivstegn, utenAktivtKjørendeWhere } from "./reprosessering";
import { prosesserDokument } from "./ftd-prosessering";

/**
 * RETUR 2 2026-10-15 (Kontrollør) punkt 1, DB-nivå. Tre saker:
 *   (a) et dokument i en lang OCR med LIVSTEGN regnes aldri som strandet.
 *   (b) samtidig «Prosesser alle» mens det kjører → hopper over det, ingen
 *       duplikate chunks (vakt på reset + concurrency-vakt i prosesserDokument).
 *   (c) ekte crash (ingen livstegn på 15 min) → strandet og plukket opp.
 *       (c dekkes også av ftd-strandet.integration.test.ts; her bekreftes
 *        kontrasten: ferskt livstegn ekskluderes, gammelt inkluderes.)
 *
 * DB-integrasjonstest (ekte prisma). Importerer IKKE mappeRouter (unngår pdf.js-
 * forgiftning). `prosesserDokument` importeres, men testen kaller den kun på et
 * FERSKT `processing`-dokument, der concurrency-vakten returnerer FØR noe pdf.js
 * kjøres — så ingen forgiftning. Kjøres via `pnpm --filter @sitedoc/api test:integration`.
 */

const ids = { projectId: "" };
const dokIder: string[] = [];

async function lagDok(
  filename: string,
  state: string,
  alderMin: number,
  fileUrl: string | null = null,
): Promise<string> {
  const dok = await prisma.ftdDocument.create({
    data: { projectId: ids.projectId, filename, processingState: state, fileUrl },
  });
  dokIder.push(dok.id);
  // `updated_at` er @updatedAt (auto) — tving fortid via rå SQL for å simulere
  // at dokumentet ikke har hatt fremdrift på `alderMin` minutter.
  //
  // `updated_at` er `timestamp WITHOUT time zone`, og Prisma lagrer/leser den som
  // UTC. `now()` gir derimot sesjonens tidssone. Vi må derfor skrive UTC-veggklokka
  // (`now() AT TIME ZONE 'UTC'`), ellers blir verdien forskjøvet med sesjonens
  // tz-offset og testen feiler i alt annet enn en UTC-sesjon. `make_interval` tar
  // en `int` (bind-parameteret er bigint → eksplisitt `::int`).
  await prisma.$executeRaw`
    UPDATE ftd_documents
    SET updated_at = (now() AT TIME ZONE 'UTC') - make_interval(mins => ${alderMin}::int)
    WHERE id = ${dok.id}
  `;
  return dok.id;
}

async function erEkskludert(id: string): Promise<boolean> {
  const treff = await prisma.ftdDocument.findMany({
    where: utenAktivtKjørendeWhere({ projectId: ids.projectId }),
    select: { id: true },
  });
  return !treff.some((d) => d.id === id);
}

beforeAll(async () => {
  const p = await prisma.project.create({
    data: { projectNumber: `LIVSTEGN-${Date.now()}`, name: "Livstegn testprosjekt" },
  });
  ids.projectId = p.id;
});

afterAll(async () => {
  for (const id of dokIder) {
    await prisma.ftdDocumentChunk.deleteMany({ where: { documentId: id } }).catch(() => {});
    await prisma.ftdDocument.delete({ where: { id } }).catch(() => {});
  }
  if (ids.projectId) await prisma.project.delete({ where: { id: ids.projectId } }).catch(() => {});
});

describe("Livstegn (RETUR 2)", () => {
  it("(a) et strandet-utseende processing med livstegn blir FERSKT igjen og regnes ikke lenger som strandet", async () => {
    // Doket «ser» strandet ut (20 min uten fremdrift), men jobber fortsatt.
    const id = await lagDok(`lang-ocr-${Date.now()}.pdf`, "processing", 20);
    expect(await erEkskludert(id)).toBe(false); // uten livstegn: feilklassifisert som strandet (inkludert)

    // Livstegn fra den kjørende jobben.
    const livstegn = lagLivstegn(prisma, id);
    await livstegn();

    expect(await erEkskludert(id)).toBe(true); // nå ferskt → ekskludert fra reprosessering
  });

  it("(a) livstegn gjenoppliver ALDRI et completed dokument (gjerdet på processing)", async () => {
    const id = await lagDok(`ferdig-${Date.now()}.pdf`, "completed", 60);
    const før = await prisma.ftdDocument.findUniqueOrThrow({
      where: { id }, select: { updatedAt: true },
    });
    const livstegn = lagLivstegn(prisma, id);
    await livstegn();
    const etter = await prisma.ftdDocument.findUniqueOrThrow({
      where: { id }, select: { updatedAt: true },
    });
    expect(etter.updatedAt.getTime()).toBe(før.updatedAt.getTime()); // uendret — ingen UPDATE traff
  });

  it("(b) vaktet reset nullstiller strandet men IKKE et ferskt processing (forsvar i dybden)", async () => {
    const strandet = await lagDok(`crash-${Date.now()}.pdf`, "processing", 20); // crashet
    const fersk = await lagDok(`kjorer-${Date.now()}.pdf`, "processing", 0); // lever

    // Samme vakt som tvingReekstraksjonAv/reparerDokumentSett legger på reset-mutasjonen.
    const resatt = await prisma.ftdDocument.updateMany({
      where: utenAktivtKjørendeWhere({ id: { in: [strandet, fersk] } }),
      data: { processingState: "pending", processingError: null },
    });
    expect(resatt.count).toBe(1); // kun det strandede

    const etterStrandet = await prisma.ftdDocument.findUniqueOrThrow({
      where: { id: strandet }, select: { processingState: true },
    });
    const etterFersk = await prisma.ftdDocument.findUniqueOrThrow({
      where: { id: fersk }, select: { processingState: true },
    });
    expect(etterStrandet.processingState).toBe("pending"); // plukket opp
    expect(etterFersk.processingState).toBe("processing"); // urørt — lever ennå
  });

  it("(b) prosesserDokument på et ferskt processing-dokument hopper over (concurrency-vakt)", async () => {
    // Fersk `processing` = en jobb som kjører nå. En samtidig «Prosesser alle»-
    // trigger må IKKE starte et andre løp på samme dokument.
    const id = await lagDok(`kjorer2-${Date.now()}.pdf`, "processing", 0, null);

    // Concurrency-vakten (`processingState != "processing"`) skal returnere FØR noe
    // arbeid gjøres: ingen sletting av chunks, ingen filåpning. Hadde vakten sviktet,
    // ville kjøringen gått videre til `deleteMany`/filåpning og endt som `failed`
    // (dok mangler fileUrl). At status FORBLIR `processing` beviser at den hoppet av.
    await prosesserDokument(prisma, id);

    const dok = await prisma.ftdDocument.findUniqueOrThrow({
      where: { id }, select: { processingState: true },
    });
    expect(dok.processingState).toBe("processing"); // urørt — det opprinnelige løpet eier doket
  });
});
