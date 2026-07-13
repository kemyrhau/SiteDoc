import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import * as Location from "expo-location";
import { eq, and, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { arbeidsdagLocal } from "../db/schema";
import { useAuth } from "../providers/AuthProvider";
import { useFirma } from "../kontekst/FirmaKontekst";
import { haversineKm } from "../utils/geo";
import { hentOppmotederLokalt } from "../services/oppmotestedKatalog";
import { identifiserByggeplass } from "../services/byggeplassKatalog";

/**
 * Delt arbeidsdag-tilstand for BÅDE «Start dag»-kortet (StartSluttDagKort, på
 * timer-flaten) og hjem-chippen (HjemTimerChip). GPS-fangst + arbeidsdagLocal-
 * insert/les bor her ÉN gang slik at «Start dag/Start GPS» og «Pågår»-tilstanden
 * er konsistente mellom kortet og chippen. Kortet beholder sin egen «Slutt dag»/
 * genererForslag/glemt-dag-logikk; kun start + aktivDag-lesingen deles.
 *
 * Merk: hver konsument får sin egen hook-instans (egen React-state). Konsistens
 * på tvers av chip (hjem) og kort (timer) sikres via DB + `useFocusEffect`-re-les,
 * ikke via delt state.
 */

export type AktivDag = {
  id: string;
  startAt: string;
  startLat: number | null;
  startLng: number | null;
  oppmotestedId: string | null;
  oppmotestedNavn: string | null;
  byggeplassId: string | null;
  byggeplassNavn: string | null;
};

export function formatIsoDato(d: Date): string {
  const aar = d.getFullYear();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${aar}-${maaned}-${dag}`;
}

export function tilHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function fangGps(): Promise<{
  lat: number | null;
  lng: number | null;
}> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { lat: null, lng: null };
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { lat: null, lng: null };
  }
}

/**
 * Fase 1: identifiser hvilket oppmøtested arbeider startet på via GPS.
 * Nærmeste oppmøtested innenfor sin geofence-radius. Returnerer null hvis
 * ingen treff (da brukes prosjekt-deteksjon / manuell flyt som før).
 * KUN dokumentasjon + forslag — aldri lønnsgrunnlag.
 */
function identifiserOppmotested(
  lat: number | null,
  lng: number | null,
  orgId: string,
): { id: string; navn: string } | null {
  if (lat == null || lng == null || !orgId) return null;
  let beste: { id: string; navn: string } | null = null;
  let besteM = Infinity;
  for (const s of hentOppmotederLokalt(orgId)) {
    const meter = haversineKm(lat, lng, s.lat, s.lng) * 1000;
    if (meter <= s.radiusM && meter < besteM) {
      besteM = meter;
      beste = { id: s.id, navn: s.navn };
    }
  }
  return beste;
}

export function useArbeidsdag() {
  const { bruker } = useAuth();
  const { valgtFirmaId } = useFirma();

  const [aktivDag, setAktivDag] = useState<AktivDag | null>(null);
  const [behandler, setBehandler] = useState(false);

  // Les pågående arbeidsdag (status="paagaar") for innlogget bruker.
  const lesAktivDag = useCallback((): AktivDag | null => {
    if (!bruker?.id) return null;
    const db = hentDatabase();
    if (!db) return null;
    const rad = db
      .select()
      .from(arbeidsdagLocal)
      .where(
        and(
          eq(arbeidsdagLocal.userId, bruker.id),
          eq(arbeidsdagLocal.status, "paagaar"),
        ),
      )
      .orderBy(desc(arbeidsdagLocal.startAt))
      .all()[0];
    return rad
      ? {
          id: rad.id,
          startAt: rad.startAt,
          startLat: rad.startLat,
          startLng: rad.startLng,
          oppmotestedId: rad.oppmotestedId ?? null,
          oppmotestedNavn: rad.oppmotestedNavn ?? null,
          byggeplassId: rad.byggeplassId ?? null,
          byggeplassNavn: rad.byggeplassNavn ?? null,
        }
      : null;
  }, [bruker?.id]);

  const refresh = useCallback(() => {
    setAktivDag(lesAktivDag());
  }, [lesAktivDag]);

  // Re-les ved fokus: chip (hjem) + kort (timer) speiler DB når skjermen vises,
  // så en GPS-økt startet fra ett sted reflekteres begge steder.
  useFocusEffect(refresh);

  const startDag = useCallback(async () => {
    if (!bruker?.id || behandler) return;
    setBehandler(true);
    try {
      const { lat, lng } = await fangGps();
      const db = hentDatabase();
      if (!db) return;
      // GPS-identifiser oppmøtested + byggeplass (dokumentasjon + forslag, aldri
      // lønn/reise/prosjektvalg). L1: byggeplass speiler oppmøtested-mønsteret.
      const oppm = identifiserOppmotested(lat, lng, valgtFirmaId ?? "");
      const bygg = identifiserByggeplass(lat, lng, valgtFirmaId ?? "");
      const naaIso = new Date().toISOString();
      const id = randomUUID();
      db.insert(arbeidsdagLocal)
        .values({
          id,
          userId: bruker.id,
          dato: formatIsoDato(new Date()),
          startAt: naaIso,
          startLat: lat,
          startLng: lng,
          endAt: null,
          endLat: null,
          endLng: null,
          status: "paagaar",
          generertDagsseddelId: null,
          oppmotestedId: oppm?.id ?? null,
          oppmotestedNavn: oppm?.navn ?? null,
          byggeplassId: bygg?.id ?? null,
          byggeplassNavn: bygg?.navn ?? null,
          sistEndretLokalt: Date.now(),
        })
        .run();
      setAktivDag({
        id,
        startAt: naaIso,
        startLat: lat,
        startLng: lng,
        oppmotestedId: oppm?.id ?? null,
        oppmotestedNavn: oppm?.navn ?? null,
        byggeplassId: bygg?.id ?? null,
        byggeplassNavn: bygg?.navn ?? null,
      });
    } finally {
      setBehandler(false);
    }
  }, [bruker?.id, behandler, valgtFirmaId]);

  return { aktivDag, startDag, behandler, setBehandler, refresh };
}
