import { prisma } from "@sitedoc/db";
import { flytRettighetNoekkel, type RettighetsOverrides } from "@sitedoc/shared";

/**
 * Loader for flyt-rettighetsmatrisen (config-design § 1, delta-modellen).
 *
 * Leser firmaets FlytRettighetOverride-rader og bygger overrides-mappen som
 * `celleTillatt` (@sitedoc/shared) konsulterer: nøkkel `${rolle}:${fra}:${til}` → tillatt.
 * KUN avvik fra ROLLE_HANDLINGER_DEFAULTS lagres — tom tabell (eller `orgId = null`)
 * gir en tom map, som gir bit-identisk atferd med default-laget (sikkerhetsrammen).
 *
 * Kloss 1: substratet er på plass og kalles; skriving av rader skjer i Kloss 2.
 */
export async function hentFlytRettighetOverrides(
  orgId: string | null | undefined,
): Promise<RettighetsOverrides> {
  if (!orgId) return {};

  const rader = await prisma.flytRettighetOverride.findMany({
    where: { orgId },
    select: { rolle: true, fraStatus: true, tilStatus: true, tillatt: true },
  });

  const overrides: RettighetsOverrides = {};
  for (const r of rader) {
    overrides[flytRettighetNoekkel(r.rolle, r.fraStatus, r.tilStatus)] = r.tillatt;
  }
  return overrides;
}
