import { eq, and } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { dagsseddelLocal } from "../db/schema";
import { hentDatabase } from "../db/database";
import { hentEffektivArbeidstidLokal } from "./kalenderKatalog";

/**
 * UF-0 (2026-06-22) — delt find-or-create for dagsseddel.
 *
 * Begge inngangspunkter til ny dagsseddel ruter gjennom denne:
 *   - `ny.tsx` (manuell «+ Ny»)
 *   - `opprettDagsseddelForSegment` (auto-draft via «Start/Slutt dag»)
 *
 * Innkapsler:
 *   (a) **idempotens** per `(userId, dato)` — finnes dagen alt, returner den
 *       (server håndhever `@@unique([userId, dato])`; blind insert ga
 *       duplikat-kollisjon → sync-stuck → tom attestering).
 *   (b) **org-backfill** — setter `organizationId = orgId`, ikke `""`.
 *   (c) **arbeidstid-prefill** — fyller start/slutt/pause fra firmaets
 *       standardarbeidstid NÅR de ikke er gitt (manuell inngang). Auto-draft
 *       sender segmentets egne tider og hopper over prefill.
 *
 * Setter ALDRI timer-/maskin-rader — det eier kalleren. Rører ALDRI en
 * eksisterende sedel (idempotent), så midnatt-splitt beholder eksisterende
 * dager urørt.
 */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export interface FinnEllerOpprettArgs {
  userId: string;
  orgId: string;
  /** Lokal kalenderdag, ISO YYYY-MM-DD. */
  dato: string;
  prosjektId: string;
  aktivitetId: string;
  /** Sedel-nivå GPS-byggeplass (L1). Settes kun ved auto-utkast («Slutt dag»);
   *  manuell oppretting sender null. Skrives kun på NY sedel — eksisterende
   *  (idempotens-treff/UF-1-append) røres aldri. */
  byggeplassId?: string | null;
  /** Sedel-nivå-felt ved NY-oppretting. Utelatt → arbeidstid-prefill (manuell). */
  startAt?: string | null;
  endAt?: string | null;
  pauseMin?: number;
  beskrivelse?: string | null;
  autoGenerert?: boolean;
  deltVedMidnatt?: boolean;
  sluttTidKilde?: "bruker" | "midnatt" | "system";
}

export interface FinnEllerOpprettResultat {
  id: string;
  /** true = dagen fantes allerede (idempotens-treff), ingen ny rad opprettet. */
  eksisterte: boolean;
  status: string;
  organizationId: string;
}

export function finnEllerOpprettDagsseddel(
  db: LokalDb,
  args: FinnEllerOpprettArgs,
): FinnEllerOpprettResultat {
  // (a) Idempotens — finnes sedel for (userId, dato)? Behold den urørt.
  const eksisterende = db
    .select({
      id: dagsseddelLocal.id,
      status: dagsseddelLocal.status,
      organizationId: dagsseddelLocal.organizationId,
    })
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, args.userId),
        eq(dagsseddelLocal.dato, args.dato),
      ),
    )
    .all()[0];
  if (eksisterende) {
    return {
      id: eksisterende.id,
      eksisterte: true,
      status: eksisterende.status,
      organizationId: eksisterende.organizationId,
    };
  }

  // (c) Arbeidstid-prefill kun for felt som ikke er gitt (manuell inngang).
  let startAt = args.startAt;
  let endAt = args.endAt;
  let pauseMin = args.pauseMin;
  if (startAt === undefined || endAt === undefined || pauseMin === undefined) {
    const effektiv = hentEffektivArbeidstidLokal(
      args.orgId,
      new Date(`${args.dato}T00:00:00`),
    );
    if (startAt === undefined) startAt = hhmmTilIso(args.dato, effektiv.startTid);
    if (endAt === undefined) endAt = hhmmTilIso(args.dato, effektiv.sluttTid);
    if (pauseMin === undefined) pauseMin = effektiv.pauseMin;
  }

  const id = randomUUID();
  const naa = Date.now();
  db.insert(dagsseddelLocal)
    .values({
      id,
      userId: args.userId,
      organizationId: args.orgId, // (b) org-backfill — ikke ""
      projectId: args.prosjektId,
      aktivitetId: args.aktivitetId,
      avdelingId: null,
      byggeplassId: args.byggeplassId ?? null,
      dato: args.dato,
      startAt: startAt ?? null,
      endAt: endAt ?? null,
      pauseMin: pauseMin ?? 0,
      status: "draft",
      autoGenerert: args.autoGenerert ?? null,
      deltVedMidnatt: args.deltVedMidnatt ?? null,
      sluttTidKilde: args.sluttTidKilde ?? "bruker",
      beskrivelse: args.beskrivelse ?? null,
      lederKommentar: null,
      attestertVed: null,
      syncStatus: "pending",
      feilmelding: null,
      sistEndretLokalt: naa,
      sistSynkronisert: null,
    })
    .run();

  return { id, eksisterte: false, status: "draft", organizationId: args.orgId };
}

/** HH:MM (firmaets standardarbeidstid) + ISO-dato → ISO-timestamp. */
function hhmmTilIso(isoDato: string, hhmm: string | null): string | null {
  if (!hhmm) return null;
  const [t, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (isNaN(t) || isNaN(m)) return null;
  const d = new Date(`${isoDato}T00:00:00`);
  d.setHours(t, m, 0, 0);
  return d.toISOString();
}
