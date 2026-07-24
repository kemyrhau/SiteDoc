import { prisma } from "@sitedoc/db";
import { flytRettighetNoekkel, type RettighetsOverrides } from "@sitedoc/shared";

/**
 * Loader for flyt-rettighetsmatrisen (config-design rev.7 § 1, delta-modellen).
 *
 * Leser de GLOBALE FlytRettighetOverride-radene og bygger overrides-mappen som
 * `celleTillatt` (@sitedoc/shared) konsulterer: nøkkel `${rolle}:${fra}:${til}` → tillatt.
 * KUN avvik fra ROLLE_HANDLINGER_DEFAULTS lagres — tom tabell gir en tom map, som gir
 * bit-identisk atferd med default-laget (sikkerhetsrammen).
 *
 * Kloss 2d (Kenneth-vedtak 2026-07-24): matrisen er ÉN global sitedoc-konfig — ikke
 * lenger per-firma. `orgId`-parameteren droppet; alle rader er globale.
 */
export async function hentFlytRettighetOverrides(): Promise<RettighetsOverrides> {
  const rader = await prisma.flytRettighetOverride.findMany({
    select: { rolle: true, fraStatus: true, tilStatus: true, tillatt: true },
  });

  const overrides: RettighetsOverrides = {};
  for (const r of rader) {
    overrides[flytRettighetNoekkel(r.rolle, r.fraStatus, r.tilStatus)] = r.tillatt;
  }
  return overrides;
}
