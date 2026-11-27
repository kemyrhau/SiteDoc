import { promises as fs } from "node:fs";
import path from "node:path";
import { aktivSchema, rundeSchema, type Runde, type Svar } from "./schema";

/** Server-side lagring for testpanelet. Importeres kun fra app/api/testpanel/route.ts. */

export class TestpanelFeil extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function mappe(): string {
  const dir = process.env.SITEDOC_TESTPANEL_DIR;
  if (!dir) throw new TestpanelFeil("SITEDOC_TESTPANEL_DIR mangler", 500);
  return path.resolve(dir);
}

async function lesJson(fil: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(fil, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new TestpanelFeil(`Kan ikke lese ${path.basename(fil)}: ${String(e)}`, 500);
  }
}

/** Stien til aktiv runde-fil, eller null når ingen runde er aktiv. Avviser stier utenfor mappa. */
export async function aktivFil(): Promise<string | null> {
  const dir = mappe();
  const aktiv = await lesJson(path.join(dir, "aktiv.json"));
  if (aktiv === null) return null;
  const tolket = aktivSchema.safeParse(aktiv);
  if (!tolket.success) throw new TestpanelFeil("aktiv.json er ugyldig", 500);
  const fil = path.resolve(dir, tolket.data.fil);
  if (path.dirname(fil) !== dir) throw new TestpanelFeil("aktiv.json peker ut av mappa", 500);
  return fil;
}

export async function lesRunde(fil: string): Promise<Runde | null> {
  const data = await lesJson(fil);
  if (data === null) return null;
  const tolket = rundeSchema.safeParse(data);
  if (!tolket.success) {
    throw new TestpanelFeil(`${path.basename(fil)} er ugyldig: ${tolket.error.issues[0]?.message}`, 500);
  }
  return tolket.data;
}

/** Atomisk skriving: tmp + rename, så agent og panel aldri leser en halvskrevet fil. */
async function skrivAtomisk(fil: string, runde: Runde): Promise<void> {
  const tmp = `${fil}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(runde, null, 2)}\n`, "utf8");
  await fs.rename(tmp, fil);
}

/** Leser fila på nytt, endrer kun `kenneth` + `status` for steget, skriver atomisk. */
export async function lagreSvar(svar: Svar, nå: Date = new Date()): Promise<Runde> {
  const fil = await aktivFil();
  if (!fil) throw new TestpanelFeil("Ingen aktiv runde", 404);
  const runde = await lesRunde(fil);
  if (!runde) throw new TestpanelFeil("Runde-fila finnes ikke", 404);
  const steg = runde.steg.find((s) => s.nr === svar.nr);
  if (!steg) throw new TestpanelFeil(`Steg ${svar.nr} finnes ikke`, 404);
  if (steg.status !== "venter_kenneth") {
    throw new TestpanelFeil(`Steg ${svar.nr} venter ikke på deg (${steg.status})`, 409);
  }
  steg.kenneth = {
    vurdering: svar.vurdering,
    merknad: svar.merknad.trim(),
    forbedring: svar.forbedring.trim(),
    tid: nå.toISOString(),
  };
  steg.status = "ferdig";
  const gyldig = rundeSchema.parse(runde);
  await skrivAtomisk(fil, gyldig);
  return gyldig;
}
