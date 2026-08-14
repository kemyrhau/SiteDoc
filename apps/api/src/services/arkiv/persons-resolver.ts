/**
 * Arkivmal — persons-resolver (Stage 4, api-sammenstilling).
 *
 * `persons`-felt lagrer bruker-UUID-er. `felt.ts` joiner dem rått (`:101`) →
 * rå databasenøkler lekker i et byggherre-dokument (målt i Kenneths prod-rapport:
 * «74730685-…» under Deltakere). felt.ts er FROSSET (mobil-sti) → vi løser det
 * i api-sammenstillingen: bytt UUID-ene mot navn i `data` FØR rendering, så det
 * rene laget (byggInnhold) aldri ser en UUID.
 *
 * Uoppløste UUID-er (slettet bruker) → «Ukjent bruker», ALDRI den rå nøkkelen.
 */

import type { PrismaClient } from "@sitedoc/db";
import type { RapportObjekt, FeltVerdi } from "@sitedoc/pdf";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolverPersonnavn(
  prisma: PrismaClient,
  data: Record<string, FeltVerdi>,
  objects: RapportObjekt[],
): Promise<Record<string, FeltVerdi>> {
  const personsIder = objects.filter((o) => o.type === "persons").map((o) => o.id);
  if (personsIder.length === 0) return data;

  // Samle UUID-er på tvers av alle persons-felt.
  const uuider = new Set<string>();
  for (const id of personsIder) {
    const v = data[id]?.verdi;
    if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && UUID_RE.test(x)) uuider.add(x);
  }
  if (uuider.size === 0) return data;

  const brukere = await prisma.user.findMany({
    where: { id: { in: [...uuider] } },
    select: { id: true, name: true },
  });
  const navn = new Map(brukere.map((u) => [u.id, u.name ?? "Ukjent bruker"]));

  const ut: Record<string, FeltVerdi> = { ...data };
  for (const id of personsIder) {
    const felt = data[id];
    if (!felt || !Array.isArray(felt.verdi)) continue;
    ut[id] = {
      ...felt,
      verdi: (felt.verdi as string[]).map((x) =>
        typeof x === "string" && UUID_RE.test(x) ? navn.get(x) ?? "Ukjent bruker" : x,
      ),
    };
  }
  return ut;
}
