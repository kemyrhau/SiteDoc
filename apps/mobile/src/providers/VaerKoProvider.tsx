import { useEffect, useRef, type ReactNode } from "react";
import { eq } from "drizzle-orm";
import { byggVaerSnapshot } from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { sjekklisteFeltdata, oppgaveFeltdata } from "../db/schema";
import { vanillaTrpc } from "../lib/trpc";
import { useNettverk } from "./NettverkProvider";

/**
 * Vær-kø (offline): når et befaringstidspunkt settes uten nett, markeres værfeltet
 * `status:"venter"` (useAutoVaer). Denne provideren henter det ventende været når
 * enheten kommer online — for det LAGREDE tidspunktet (archive-API dekker historiske
 * tidspunkt), ikke for tidspunktet nettet kom tilbake.
 *
 * «Køen» er ikke en egen tabell: værfeltets `verdi.status === "venter"` I feltdata ER
 * køen. Det gir gratis «maks én ventende per dokument og felt» (feltet har én status),
 * og sweepen leser GJELDENDE tidspunkt fra feltet ved kjøring — justeres tiden flere
 * ganger offline, er det fortsatt én markør med siste tidspunkt.
 *
 * Monterte dokumenter helbreder seg selv via React Query (refetchOnReconnect) — denne
 * sweepen er sikkerhetsnettet for dokumenter som IKKE er åpne når nettet kommer tilbake.
 */

interface VenterMarkor {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
  status?: "venter";
  venterTidspunkt?: string;
  lat?: number;
  lng?: number;
}

interface FeltVerdiLike {
  verdi?: unknown;
  kommentar?: string;
  vedlegg?: unknown[];
}

const SWEEP_INTERVALL_MS = 30_000;

/** Er feltverdien en ventende vær-markør (satt offline, ikke hentet ennå)? */
function erVenterMarkor(fv: FeltVerdiLike | undefined): fv is FeltVerdiLike & { verdi: VenterMarkor } {
  const v = fv?.verdi as VenterMarkor | undefined;
  return (
    !!v &&
    typeof v === "object" &&
    v.status === "venter" &&
    typeof v.venterTidspunkt === "string" &&
    typeof v.lat === "number" &&
    typeof v.lng === "number"
  );
}

export function VaerKoProvider({ children }: { children: ReactNode }) {
  const { erPaaNettet } = useNettverk();
  const prosessererRef = useRef(false);

  useEffect(() => {
    if (!erPaaNettet) return;

    let avbrutt = false;

    const prosesser = async () => {
      if (prosessererRef.current || avbrutt) return;
      prosessererRef.current = true;
      try {
        const db = hentDatabase();
        if (!db) return;

        // Les alle lokale feltdata-rader (begge dokumenttyper).
        const sjekkRader = db
          .select({ id: sjekklisteFeltdata.sjekklisteId, json: sjekklisteFeltdata.feltVerdier })
          .from(sjekklisteFeltdata)
          .all();
        const oppgRader = db
          .select({ id: oppgaveFeltdata.oppgaveId, json: oppgaveFeltdata.feltVerdier })
          .from(oppgaveFeltdata)
          .all();

        const jobber: Array<{ docType: "sjekkliste" | "oppgave"; docId: string }> = [
          ...sjekkRader.map((r) => ({ docType: "sjekkliste" as const, docId: r.id })),
          ...oppgRader.map((r) => ({ docType: "oppgave" as const, docId: r.id })),
        ];

        for (const jobb of jobber) {
          if (avbrutt) break;
          await prosesserDokument(jobb.docType, jobb.docId);
        }
      } catch (feil) {
        console.warn("[VaerKo] sweep feilet:", feil);
      } finally {
        prosessererRef.current = false;
      }
    };

    // Kjør ved reconnect + som sikkerhetsnett på intervall.
    void prosesser();
    const intervall = setInterval(() => void prosesser(), SWEEP_INTERVALL_MS);
    return () => {
      avbrutt = true;
      clearInterval(intervall);
    };
  }, [erPaaNettet]);

  return <>{children}</>;
}

/**
 * Løs alle ventende vær-markører i ett dokument: hent feltdata på nytt (gjeldende
 * tidspunkt), hent vær for hver markør, skriv snapshot tilbake til SQLite + server.
 * Én feil på ett felt/dokument velter aldri resten.
 */
async function prosesserDokument(
  docType: "sjekkliste" | "oppgave",
  docId: string,
): Promise<void> {
  try {
    const db = hentDatabase();
    if (!db) return;

    const tabell = docType === "sjekkliste" ? sjekklisteFeltdata : oppgaveFeltdata;
    const idKol = docType === "sjekkliste" ? sjekklisteFeltdata.sjekklisteId : oppgaveFeltdata.oppgaveId;

    const rad = db.select({ json: tabell.feltVerdier }).from(tabell).where(eq(idKol, docId)).get();
    if (!rad) return;

    let feltVerdier: Record<string, FeltVerdiLike>;
    try {
      feltVerdier = JSON.parse(rad.json) as Record<string, FeltVerdiLike>;
    } catch {
      return;
    }

    // Finn ventende vær-felt (gjeldende tilstand, ikke fanget ved kø-tidspunkt).
    const ventende = Object.entries(feltVerdier).filter(([, fv]) => erVenterMarkor(fv));
    if (ventende.length === 0) return;

    const endredeFelt: Record<string, FeltVerdiLike> = {};
    for (const [feltId, fv] of ventende) {
      const markor = fv.verdi as VenterMarkor;
      const tidspunkt = markor.venterTidspunkt!;
      const vaerdata = await vanillaTrpc.vaer.hentVaerdata
        .query({
          latitude: markor.lat!,
          longitude: markor.lng!,
          dato: tidspunkt.slice(0, 10),
        })
        .catch((feil: unknown) => {
          console.warn("[VaerKo] hentVaerdata feilet:", feil);
          return null; // la markøren stå → nytt forsøk neste sweep
        });
      if (!vaerdata) continue; // feil eller Open-Meteo svarte tomt → prøv igjen senere

      const snapshot = byggVaerSnapshot(vaerdata.hourly, tidspunkt);
      // Behold kommentar/vedlegg; erstatt kun verdien (markøren droppes med snapshotet).
      const oppdatert: FeltVerdiLike = { ...fv, verdi: snapshot };
      feltVerdier[feltId] = oppdatert;
      endredeFelt[feltId] = oppdatert;
    }

    if (Object.keys(endredeFelt).length === 0) return;

    // 1) Skriv lokalt (verdien er korrekt selv om server-sync feiler → normal sync tar den).
    db.update(tabell)
      .set({ feltVerdier: JSON.stringify(feltVerdier), erSynkronisert: false, sistEndretLokalt: Date.now() })
      .where(eq(idKol, docId))
      .run();

    // 2) Sync kun de endrede feltene til server (oppdaterData feltvis-merger på toppnivå).
    try {
      if (docType === "sjekkliste") {
        await vanillaTrpc.sjekkliste.oppdaterData.mutate({ id: docId, data: endredeFelt });
      } else {
        await vanillaTrpc.oppgave.oppdaterData.mutate({ id: docId, data: endredeFelt });
      }
      db.update(tabell)
        .set({ erSynkronisert: true, sistSynkronisert: Date.now() })
        .where(eq(idKol, docId))
        .run();
    } catch (feil) {
      console.warn("[VaerKo] server-sync feilet (verdi lagret lokalt):", feil);
    }
  } catch (feil) {
    console.warn("[VaerKo] prosesserDokument feilet:", feil);
  }
}
