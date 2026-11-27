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
async function skrivAtomisk(fil: string, innhold: unknown): Promise<void> {
  const tmp = `${fil}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(innhold, null, 2)}\n`, "utf8");
  await fs.rename(tmp, fil);
}

type RåSteg = Record<string, unknown>;
type RåRunde = Record<string, unknown> & { steg: RåSteg[] };

/**
 * Felles skrivevei for alle POST-varianter. Leser fila på nytt, validerer med schemaet,
 * lar `endre` patche RÅ JSON (ikke schema-resultatet: Zod stripper ukjente nøkler, og
 * alt agenten har skrevet utover schemaet skal bevares — VILKÅR 1), validerer igjen
 * og skriver atomisk.
 */
async function patchRå(endre: (rå: RåRunde, runde: Runde) => void): Promise<Runde> {
  const fil = await aktivFil();
  if (!fil) throw new TestpanelFeil("Ingen aktiv runde", 404);
  const rå = await lesJson(fil);
  if (rå === null) throw new TestpanelFeil("Runde-fila finnes ikke", 404);
  const runde = rundeSchema.safeParse(rå);
  if (!runde.success) {
    throw new TestpanelFeil(`${path.basename(fil)} er ugyldig: ${runde.error.issues[0]?.message}`, 500);
  }
  endre(rå as RåRunde, runde.data);
  const gyldig = rundeSchema.parse(rå);
  await skrivAtomisk(fil, rå);
  return gyldig;
}

/** Schemaet har bekreftet formen; `rå.steg` er samme liste i samme rekkefølge. */
function finnSteg(rå: RåRunde, runde: Runde, nr: number): { steg: Runde["steg"][number]; råSteg: RåSteg } {
  const i = runde.steg.findIndex((s) => s.nr === nr);
  if (i < 0) throw new TestpanelFeil(`Steg ${nr} finnes ikke`, 404);
  return { steg: runde.steg[i]!, råSteg: rå.steg[i]! };
}

/** Kenneths svar: endrer kun `kenneth` + `status` på steget. */
export function lagreSvar(svar: Svar, nå: Date = new Date()): Promise<Runde> {
  return patchRå((rå, runde) => {
    const { steg, råSteg } = finnSteg(rå, runde, svar.nr);
    if (steg.status !== "venter_kenneth") {
      throw new TestpanelFeil(`Steg ${svar.nr} venter ikke på deg (${steg.status})`, 409);
    }
    råSteg.kenneth = {
      vurdering: svar.vurdering,
      merknad: svar.merknad.trim(),
      forbedring: svar.forbedring.trim(),
      tid: nå.toISOString(),
    };
    råSteg.status = "ferdig";
  });
}

/** Pause/Fortsett: endrer kun `runde.pause`. Agenten venter mens den er sann. */
export function lagrePause(pause: boolean): Promise<Runde> {
  return patchRå((rå) => {
    rå.pause = pause;
  });
}

/** Forbedring underveis: legges til i `steg.forbedringer`; status endres ikke. Ferdig steg → 409. */
export function lagreForbedring(nr: number, tekst: string, nå: Date = new Date()): Promise<Runde> {
  return patchRå((rå, runde) => {
    const { steg, råSteg } = finnSteg(rå, runde, nr);
    if (steg.status === "ferdig") throw new TestpanelFeil(`Steg ${nr} er ferdig`, 409);
    const før = Array.isArray(råSteg.forbedringer) ? råSteg.forbedringer : [];
    råSteg.forbedringer = [...før, { tekst: tekst.trim(), tid: nå.toISOString() }];
  });
}
