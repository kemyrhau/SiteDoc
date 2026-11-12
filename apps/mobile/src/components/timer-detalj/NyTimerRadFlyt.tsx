import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../db/database";
import { dagsseddelLocal, equipmentLocal, sheetTimerLocal } from "../../db/schema";
import { useAuth } from "../../providers/AuthProvider";
import { useTimerSync } from "../../providers/TimerSyncProvider";
import { useFirma } from "../../kontekst/FirmaKontekst";
import { sjekkAnsattForNyRegistrering } from "../../utils/ansattSjekk";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";
import { useByggeplass } from "../../kontekst/ByggeplassKontekst";
import { useGeoProsjektForslag } from "../../hooks/useGeoProsjektForslag";
import { hentByggeplasserForFirmaLokalt } from "../../services/byggeplassKatalog";
import { hentProsjekterLokalt } from "../../services/prosjektKatalog";
import { lesTimerModusLokalt } from "../../services/organizationSettingKatalog";
import {
  byggeplassForNyRad,
  erDagLaast,
  finnDagForDato,
  lagreNyTimerRad,
  sistBrukteRadvalg,
  startvalgForNyRad,
} from "../../services/nyTimerRad";
import type { TimerRad } from "../../types/timer-detalj";
import { ProsjektVelgerModal } from "./ProsjektVelger";
import { TimerRadModal } from "./TimerSeksjon";

function iDag(): string {
  const d = new Date();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${maaned}-${dag}`;
}

/**
 * «+» rett til timer-raden (ORDRE 17, 2026-11-06). Erstatter `app/timer/ny.tsx`.
 *
 * Ikke ansatt → melding, ingenting åpnes. Ellers rett til timer-raden med
 * innlogget prosjekt + byggeplass forhåndsvalgt (ORDRE 29); uten innlogget
 * prosjekt i firmaet: prosjektliste (GPS-treff forhåndsvalgt, hoppes over ved
 * ett prosjekt) → timer-raden i opprettelses-modus. Sedelen finnes-eller-opprettes først ved Lagre; Avbryt skriver
 * ingenting. Etter lagring: sedelen (dagskort) eller kortet (prosjektkort).
 */
export function NyTimerRadFlyt({ onLukk }: { onLukk: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtFirmaId, valgtFirma, erAnsattIValgtFirma } = useFirma();
  const { triggerSync, oppdaterTellere } = useTimerSync();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();

  const orgId = valgtFirmaId ?? null;
  const prosjekter = useMemo(() => (orgId ? hentProsjekterLokalt(orgId) : []), [orgId]);
  const [steg, setSteg] = useState<"sjekker" | "liste" | "rad">("sjekker");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [byggeplassId, setByggeplassId] = useState<string | null>(null);
  const [dato, setDato] = useState(iDag);
  const gpsForslag = useGeoProsjektForslag(orgId, steg === "liste");

  // ORDRE 29: kildene for forhåndsvalgt prosjekt + byggeplass (innlogget → GPS).
  const stedKilder = useMemo(
    () => ({
      innlogget: valgtProsjektId
        ? { projectId: valgtProsjektId, byggeplassId: valgtBygningId }
        : null,
      gps: gpsForslag,
      byggeplasser: orgId ? hentByggeplasserForFirmaLokalt(orgId) : [],
    }),
    [valgtProsjektId, valgtBygningId, gpsForslag, orgId],
  );

  // Ikke ansatt i valgt firma → serveren ville nektet sedelen; si fra før lista.
  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const ansatt = await sjekkAnsattForNyRegistrering({
        erAnsattIValgtFirma,
        orgId,
        firmaNavn: valgtFirma?.name ?? "",
        t,
      });
      if (avbrutt) return;
      if (!ansatt) {
        onLukk();
        return;
      }
      const start = startvalgForNyRad(
        prosjekter.map((p) => p.id),
        stedKilder,
      );
      if (start) {
        setProjectId(start.projectId);
        setByggeplassId(start.byggeplassId);
        setSteg("rad");
      } else {
        setSteg("liste");
      }
    })();
    return () => {
      avbrutt = true;
    };
    // Kjøres én gang ved åpning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dagens sedel (om den finnes) for valgt dato: sendt-sjekk + overlapp/prefill.
  const dag = useMemo(() => {
    const db = hentDatabase();
    if (!db || !bruker?.id) return null;
    const fra = finnDagForDato(db, bruker.id, dato);
    if (!fra) return null;
    const sedel = db.select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, fra.id)).get();
    const rader: TimerRad[] = db
      .select()
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, fra.id))
      .all();
    return {
      id: fra.id,
      laast: erDagLaast(fra),
      pauseMin: sedel?.pauseMin ?? 0,
      byggeplassId: sedel?.byggeplassId ?? null,
      rader,
    };
  }, [bruker?.id, dato]);

  const harEquipmentCache = useMemo(() => {
    const db = hentDatabase();
    if (!db || !orgId) return false;
    return (
      db
        .select({ id: equipmentLocal.id })
        .from(equipmentLocal)
        .where(eq(equipmentLocal.organizationId, orgId))
        .all().length > 0
    );
  }, [orgId]);

  const radvalgFor = useCallback(
    (pid: string) => {
      const db = hentDatabase();
      if (!db || !bruker?.id || !orgId) return { lonnsartId: null, aktivitetId: null };
      return sistBrukteRadvalg(db, bruker.id, pid, orgId);
    },
    [bruker?.id, orgId],
  );

  const aapneSedel = useCallback(
    (sheetId: string, pid: string | null, eksisterte: boolean) => {
      onLukk();
      router.push(`/timer/${sheetId}${eksisterte ? "?aapnetEksisterende=1" : ""}`);
      // Prosjektkort (Q6): kortskjermen, med samlesiden under i stacken.
      if (pid && orgId && lesTimerModusLokalt(orgId) === "prosjektkort") {
        router.push(`/timer/${sheetId}/kort/${pid}`);
      }
    },
    [onLukk, router, orgId],
  );

  if (!orgId || !bruker?.id || steg === "sjekker") return null;

  if (steg === "liste") {
    return (
      <ProsjektVelgerModal
        organizationId={orgId}
        valgtId={gpsForslag?.projectId ?? null}
        forslagId={gpsForslag?.projectId ?? null}
        onVelg={(id) => {
          setProjectId(id);
          setByggeplassId(byggeplassForNyRad(id, stedKilder));
          setSteg("rad");
        }}
        onLukk={onLukk}
      />
    );
  }

  if (!projectId) return null;

  return (
    <TimerRadModal
      sheetId={dag?.id ?? ""}
      organizationId={orgId}
      defaultProjectId={projectId}
      defaultByggeplassId={byggeplassId}
      defaultEcoId={null}
      dato={dato}
      sheetPauseMin={dag?.pauseMin ?? 0}
      harEquipmentCache={harEquipmentCache}
      eksisterendeRader={dag?.rader ?? []}
      alleTimerRader={dag?.rader ?? []}
      defaultAktivitetId={null}
      eksisterendeRad={null}
      tvungetValg={null}
      sedelByggeplassId={dag?.byggeplassId ?? null}
      opprettelse={{
        onDatoEndret: setDato,
        laastDagId: dag?.laast ? dag.id : null,
        onAapneDagen: (id) => aapneSedel(id, null, false),
        radvalgFor,
      }}
      onLagre={(
        radProjectId,
        byggeplassId,
        lonnsartId,
        aktivitetId,
        timer,
        externalCostObjectId,
        fraTid,
        tilTid,
        beskrivelse,
        pauseMin,
        maskin,
      ) => {
        const db = hentDatabase();
        if (!db) return;
        const res = lagreNyTimerRad(db, {
          userId: bruker.id,
          organizationId: orgId,
          dato,
          rad: {
            projectId: radProjectId,
            byggeplassId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            pauseMin,
            maskiner: maskin.linjer,
          },
        });
        if (!res.ok) {
          // Dagen ble sendt mens dialogen sto åpen — vis sedelen i stedet.
          aapneSedel(res.sheetId, null, false);
          return;
        }
        oppdaterTellere();
        triggerSync();
        aapneSedel(res.sheetId, radProjectId, res.eksisterte);
      }}
      onLukk={onLukk}
    />
  );
}
