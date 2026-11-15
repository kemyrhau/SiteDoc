/**
 * POST (13) L2 TILLEGG: overføringsoppslag (første/siste dag i en periode) mot
 * lokal cache — delt av Bekreft dag (`dagsforslagInput`) og reise-kortet
 * (`useManuellReise`), så begge regner samme navn, kjøretid og byggeplass-ende.
 */
import type { OppmotePeriodeInput } from "@sitedoc/shared";
import {
  byggOverforingOppslag,
  type DagsforslagOverforingOppslag,
} from "../utils/dagsforslag";
import { hentByggeplasserForProsjektLokalt } from "./byggeplassKatalog";
import { hentOppmotederLokalt } from "./oppmotestedKatalog";
import { hentProsjekterLokalt } from "./prosjektKatalog";
import { hentKontorAvstandLokalt } from "./oppmotestedAvstandKatalog";
import { hentMatriseRadLokalt } from "./reisetidMatriseKatalog";

export function hentOverforingOppslagLokalt(a: {
  organizationId: string;
  datoer: string[];
  perioder: readonly OppmotePeriodeInput[];
  destinasjonByggeplassId: string | null;
  kontekstByggeplassId: string | null;
}): DagsforslagOverforingOppslag[] {
  const orgId = a.organizationId;
  return byggOverforingOppslag({
    datoer: a.datoer,
    perioder: a.perioder,
    destinasjonByggeplassId: a.destinasjonByggeplassId,
    kontekstByggeplassId: a.kontekstByggeplassId,
    byggeplasserForProsjekt: (projectId) =>
      hentByggeplasserForProsjektLokalt(projectId).map((b) => ({ id: b.id, navn: b.navn ?? null })),
    kontorNavn: (id) => hentOppmotederLokalt(orgId).find((o) => o.id === id)?.navn ?? "",
    prosjektNavn: (id) => hentProsjekterLokalt(orgId).find((pr) => pr.id === id)?.name ?? "",
    kontorAvstand: (x, y) => {
      const r = hentKontorAvstandLokalt(x, y);
      return r && r.kjoretidMin != null ? { kjoretidMin: r.kjoretidMin, avstandM: r.avstandM } : null;
    },
    matrise: (o, b) => {
      const r = hentMatriseRadLokalt(o, b);
      return r ? { kjoretidMin: r.kjoretidMin, avstandM: r.avstandM ?? null } : null;
    },
  });
}
