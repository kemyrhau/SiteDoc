import { and, eq, inArray } from "drizzle-orm";
import { hentDatabase } from "../../../db/database";
import { sheetTimerLocal } from "../../../db/schema";
import { finnNormtakArtLokalt } from "../../../services/timerKatalog";
import {
  erDagLaast,
  finnDagForDato,
  fravaerAktivitetId,
  lagreNyTimerRad,
  type LagreNyRadResultat,
} from "../../../services/nyTimerRad";
import { finnSedelIAnnetFirma } from "../../../services/dagsseddelOpprett";
import { validerFravaerKort, type FravaerKortFeil } from "../../../utils/fravaerKort";
import { fjernTimerRad, oppdaterTimerRad } from "./radLagring";

/**
 * ORDRE (33) c2 — lagring av fraværskortet (kort-id-spec § 11.5 U3–U11, K8).
 * Ett fraværskort pr. dag: linjene er dagens rader med `uten_prosjekt`. Lagres samlet:
 * nye linjer settes inn (sedelen finnes-eller-opprettes, uten prosjekt på en ny dag),
 * lagrede linjer oppdateres, fjernede slettes med tombstone, og den ene beskrivelsen
 * skrives på alle kortets rader (U11). Fraværsrader bærer aldri prosjekt, byggeplass,
 * underprosjekt, maskin eller klokkeslett (K8, F3). Aktivitet: U6 (`fravaerAktivitetId`).
 * Valideres FØR noe skrives (TF3, F4).
 */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export interface FravaerKortLinjeLagring {
  /** `null` = ny linje. */
  id: string | null;
  lonnsartId: string;
  timer: number;
}

export type FravaerKortResultat =
  | LagreNyRadResultat
  | { ok: false; grunn: FravaerKortFeil | "manglerAktivitet"; sheetId: null };

export function lagreFravaerKort(
  db: LokalDb,
  args: {
    userId: string;
    organizationId: string;
    dato: string;
    linjer: readonly FravaerKortLinjeLagring[];
    /** Lagrede linjer brukeren har tatt bort i kortet. */
    fjernede: readonly string[];
    beskrivelse: string;
  },
): FravaerKortResultat {
  const feil = validerFravaerKort({ linjer: args.linjer, beskrivelse: args.beskrivelse, finnArt: finnNormtakArtLokalt });
  if (feil) return { ok: false, grunn: feil, sheetId: null };
  const beskrivelse = args.beskrivelse.trim();

  const dag = finnDagForDato(db, args.userId, args.dato);
  if (dag && erDagLaast(dag)) return { ok: false, grunn: "dagLaast", sheetId: dag.id };
  if (finnSedelIAnnetFirma(db, { userId: args.userId, orgId: args.organizationId, datoer: [args.dato] })) {
    return { ok: false, grunn: "sedelIAnnetFirma", sheetId: null };
  }
  const nye = args.linjer.filter((l) => l.id == null);
  const aktivitetId = nye.length > 0 ? fravaerAktivitetId(db, args.organizationId) : null;
  if (nye.length > 0 && !aktivitetId) return { ok: false, grunn: "manglerAktivitet", sheetId: null };

  let sheetId = dag?.id ?? null;
  let eksisterte = dag != null;
  for (const l of nye) {
    const r = lagreNyTimerRad(db, {
      userId: args.userId,
      organizationId: args.organizationId,
      dato: args.dato,
      rad: {
        projectId: null,
        byggeplassId: null,
        lonnsartId: l.lonnsartId,
        aktivitetId: aktivitetId!,
        timer: l.timer,
        externalCostObjectId: null,
        fraTid: null,
        tilTid: null,
        beskrivelse,
        pauseMin: 0,
        maskiner: [],
      },
    });
    if (!r.ok) return r;
    if (sheetId == null) eksisterte = r.eksisterte;
    sheetId = r.sheetId;
  }
  if (sheetId == null) return { ok: false, grunn: "ingenLinjer", sheetId: null };
  const k = { sheetId, organizationId: args.organizationId };

  for (const id of args.fjernede) fjernTimerRad(db, k, id);

  const lagrede = args.linjer.filter((l): l is FravaerKortLinjeLagring & { id: string } => l.id != null);
  const gamle = lagrede.length
    ? db
        .select({ id: sheetTimerLocal.id, aktivitetId: sheetTimerLocal.aktivitetId })
        .from(sheetTimerLocal)
        .where(and(eq(sheetTimerLocal.dagsseddelId, sheetId), inArray(sheetTimerLocal.id, lagrede.map((l) => l.id))))
        .all()
    : [];
  for (const l of lagrede) {
    const gammel = gamle.find((g) => g.id === l.id);
    if (!gammel) continue;
    oppdaterTimerRad(db, k, l.id, {
      projectId: null,
      byggeplassId: null,
      lonnsartId: l.lonnsartId,
      aktivitetId: gammel.aktivitetId,
      timer: l.timer,
      externalCostObjectId: null,
      fraTid: null,
      tilTid: null,
      beskrivelse,
      pauseMin: 0,
    });
  }
  return { ok: true, sheetId, eksisterte };
}
