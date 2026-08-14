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
  const personsIder = new Set(objects.filter((o) => o.type === "persons").map((o) => o.id));
  if (personsIder.size === 0) return data;

  // Et persons-felt-instans: nøkkelen er et persons-objekt-id OG verdien har en
  // verdi-array. Gjelder både top-level OG nestet i repeater-rader.
  const erPersons = (k: string, v: unknown): v is FeltVerdi =>
    personsIder.has(k) && !!v && typeof v === "object" && Array.isArray((v as FeltVerdi).verdi);

  // Samle UUID-er på tvers av ALLE persons-felt, uansett nesting-dybde. Uten
  // rekursjon lekker rå UUID-er fra persons-felt nestet i repeater-rader.
  const uuider = new Set<string>();
  const samle = (o: unknown): void => {
    if (Array.isArray(o)) {
      for (const x of o) samle(x);
    } else if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (erPersons(k, v)) {
          for (const x of v.verdi as unknown[])
            if (typeof x === "string" && UUID_RE.test(x)) uuider.add(x);
        } else samle(v);
      }
    }
  };
  samle(data);
  if (uuider.size === 0) return data;

  const brukere = await prisma.user.findMany({
    where: { id: { in: [...uuider] } },
    select: { id: true, name: true },
  });
  const navn = new Map(brukere.map((u) => [u.id, u.name ?? "Ukjent bruker"]));

  // Bytt UUID → navn på samme dybde. Dyp klone; muterer ikke input.
  const bytt = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(bytt);
    if (o && typeof o === "object") {
      const ut: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        if (erPersons(k, v)) {
          ut[k] = {
            ...v,
            verdi: (v.verdi as unknown[]).map((x) =>
              typeof x === "string" && UUID_RE.test(x) ? navn.get(x) ?? "Ukjent bruker" : x,
            ),
          };
        } else {
          ut[k] = bytt(v);
        }
      }
      return ut;
    }
    return o;
  };
  return bytt(data) as Record<string, FeltVerdi>;
}
