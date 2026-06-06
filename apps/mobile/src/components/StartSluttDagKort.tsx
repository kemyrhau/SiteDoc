import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Play, Square, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import * as Location from "expo-location";
import { eq, and, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import {
  arbeidsdagLocal,
  dagsseddelLocal,
  sheetTimerLocal,
  aktivitetLocal,
  lonnsartLocal,
} from "../db/schema";
import { useAuth } from "../providers/AuthProvider";
import { useFirma } from "../kontekst/FirmaKontekst";
import { useTimerSync } from "../providers/TimerSyncProvider";
import { haversineKm } from "../utils/geo";
import { hentProsjekterLokalt } from "../services/prosjektKatalog";
import { hentEffektivArbeidstidLokal } from "../services/kalenderKatalog";
import { hentStandardLonnsartLokalt } from "../services/timerKatalog";

type AktivDag = {
  id: string;
  startAt: string;
  startLat: number | null;
  startLng: number | null;
};

function formatIsoDato(d: Date): string {
  const aar = d.getFullYear();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${aar}-${maaned}-${dag}`;
}

function tilHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function fangGps(): Promise<{ lat: number | null; lng: number | null }> {
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

export function StartSluttDagKort() {
  const { t } = useTranslation();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtFirmaId } = useFirma();
  const { triggerSync, oppdaterTellere } = useTimerSync();

  const [aktivDag, setAktivDag] = useState<AktivDag | null>(null);
  const [naa, setNaa] = useState<number>(Date.now());
  const [behandler, setBehandler] = useState(false);

  // Les pågående arbeidsdag ved montering.
  const lesAktivDag = useCallback(() => {
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
        }
      : null;
  }, [bruker?.id]);

  useEffect(() => {
    setAktivDag(lesAktivDag());
  }, [lesAktivDag]);

  // Tikk forløpt-tid hvert minutt mens dagen pågår.
  useEffect(() => {
    if (!aktivDag) return;
    setNaa(Date.now());
    const id = setInterval(() => setNaa(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [aktivDag]);

  const startDag = useCallback(async () => {
    if (!bruker?.id || behandler) return;
    setBehandler(true);
    try {
      const { lat, lng } = await fangGps();
      const db = hentDatabase();
      if (!db) return;
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
          sistEndretLokalt: Date.now(),
        })
        .run();
      setAktivDag({ id, startAt: naaIso, startLat: lat, startLng: lng });
    } finally {
      setBehandler(false);
    }
  }, [bruker?.id, behandler]);

  const utforSluttDag = useCallback(async () => {
    if (!aktivDag || !bruker?.id || behandler) return;
    setBehandler(true);
    try {
      const { lat, lng } = await fangGps();
      const db = hentDatabase();
      if (!db) return;
      const sluttIso = new Date().toISOString();
      const dagsseddelId = genererForslag(
        bruker.id,
        valgtFirmaId ?? "",
        aktivDag,
        sluttIso,
        lat,
        lng,
      );
      db.update(arbeidsdagLocal)
        .set({
          endAt: sluttIso,
          endLat: lat,
          endLng: lng,
          status: "avsluttet",
          generertDagsseddelId: dagsseddelId,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(arbeidsdagLocal.id, aktivDag.id))
        .run();
      setAktivDag(null);
      oppdaterTellere();
      void triggerSync();
      if (dagsseddelId) {
        router.push(`/timer/${dagsseddelId}`);
      } else {
        // Kunne ikke utlede prosjekt/aktivitet offline → manuell opprettelse.
        router.push("/timer/ny");
      }
    } finally {
      setBehandler(false);
    }
  }, [aktivDag, bruker?.id, valgtFirmaId, behandler, router, oppdaterTellere, triggerSync]);

  // Bekreft før avslutning — «Slutt dag» er irreversibel og genererer et
  // dagsseddel-forslag umiddelbart. Vis forløpt tid så brukeren ser hva som
  // registreres før de bekrefter.
  const bekreftSlutt = useCallback(() => {
    if (!aktivDag || behandler) return;
    const diffMin = Math.max(0, Math.floor((Date.now() - new Date(aktivDag.startAt).getTime()) / 60_000));
    const forlopt = `${String(Math.floor(diffMin / 60)).padStart(2, "0")}t ${String(diffMin % 60).padStart(2, "0")}m`;
    Alert.alert(
      t("timer.startDag.bekreftTittel"),
      t("timer.startDag.bekreftMelding", { start: tilHHMM(aktivDag.startAt), forlopt }),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        { text: t("timer.startDag.bekreftAvslutt"), style: "destructive", onPress: () => { void utforSluttDag(); } },
      ],
    );
  }, [aktivDag, behandler, t, utforSluttDag]);

  if (!bruker?.id) return null;

  // Inaktiv — «Start dag»
  if (!aktivDag) {
    return (
      <Pressable
        onPress={startDag}
        disabled={behandler}
        className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-4 active:bg-blue-700 disabled:opacity-50"
      >
        {behandler ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Play size={18} color="#ffffff" fill="#ffffff" />
        )}
        <Text className="text-base font-semibold text-white">
          {t("timer.startDag.start")}
        </Text>
      </Pressable>
    );
  }

  // Aktiv — «Pågår siden 07:02 · 03t 14m» + «Slutt dag»
  const startMs = new Date(aktivDag.startAt).getTime();
  const diffMin = Math.max(0, Math.floor((naa - startMs) / 60_000));
  const forlopt = `${String(Math.floor(diffMin / 60)).padStart(2, "0")}t ${String(diffMin % 60).padStart(2, "0")}m`;

  return (
    <View className="mx-4 mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
      <View className="flex-row items-center gap-2">
        <Clock size={16} color="#10b981" />
        <Text className="flex-1 text-sm font-medium text-green-800">
          {t("timer.startDag.status", {
            start: tilHHMM(aktivDag.startAt),
            forlopt,
          })}
        </Text>
      </View>
      <Pressable
        onPress={bekreftSlutt}
        disabled={behandler}
        className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-red-600 py-3 active:bg-red-700 disabled:opacity-50"
      >
        {behandler ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Square size={16} color="#ffffff" fill="#ffffff" />
        )}
        <Text className="text-base font-semibold text-white">
          {t("timer.startDag.slutt")}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Generer et dagsseddel-forslag fra en avsluttet arbeidsdag-økt.
 * Returnerer dagsseddel-id, eller null hvis prosjekt/aktivitet ikke kan
 * utledes offline (kaller da manuell opprettelse).
 *
 * Prosjekt: nærmeste fra Haversine (start-GPS, ellers slutt-GPS). Arbeidstid:
 * (slutt − start) − firma-pauseMin. Auto-fordeling: Timelønn (firma-default,
 * Variant B `erStandardvalg`) opp til dagsnorm + «Overtid 50%» (navne-match,
 * midlertidig MVP-identifikasjon) for overskytende.
 */
function genererForslag(
  userId: string,
  orgId: string,
  dag: AktivDag,
  sluttIso: string,
  endLat: number | null,
  endLng: number | null,
): string | null {
  const db = hentDatabase();
  if (!db) return null;

  // 1. Prosjekt via Haversine.
  const prosjekter = hentProsjekterLokalt(orgId);
  if (prosjekter.length === 0) return null;
  const lat = dag.startLat ?? endLat;
  const lng = dag.startLng ?? endLng;
  let valgtProsjekt = prosjekter[0];
  if (lat != null && lng != null) {
    const medKoord = prosjekter.filter((p) => p.lat != null && p.lng != null);
    let besteAvstand = Infinity;
    for (const p of medKoord) {
      const km = haversineKm(lat, lng, p.lat as number, p.lng as number);
      if (km < besteAvstand) {
        besteAvstand = km;
        valgtProsjekt = p;
      }
    }
  }

  // 2. Aktivitet — default «Anleggsarbeid» eller første.
  const aktiviteter = db
    .select()
    .from(aktivitetLocal)
    .where(eq(aktivitetLocal.aktiv, true))
    .all();
  if (aktiviteter.length === 0) return null;
  const aktivitet =
    aktiviteter.find((a) => a.navn === "Anleggsarbeid") ?? aktiviteter[0];

  // 3. Arbeidstid = brutto − firma-pause.
  const dato = formatIsoDato(new Date(dag.startAt));
  const effektiv = hentEffektivArbeidstidLokal(
    orgId,
    new Date(`${dato}T00:00:00`),
  );
  const bruttoTimer =
    (new Date(sluttIso).getTime() - new Date(dag.startAt).getTime()) / 3_600_000;
  const arbeidstimer =
    Math.round(Math.max(0, bruttoTimer - effektiv.pauseMin / 60) * 100) / 100;

  // 4. Dagsseddel (draft).
  const sheetId = randomUUID();
  db.insert(dagsseddelLocal)
    .values({
      id: sheetId,
      userId,
      organizationId: "",
      projectId: valgtProsjekt.id,
      aktivitetId: aktivitet.id,
      avdelingId: null,
      byggeplassId: null,
      dato,
      startAt: dag.startAt,
      endAt: sluttIso,
      pauseMin: effektiv.pauseMin,
      status: "draft",
      beskrivelse: null,
      lederKommentar: null,
      attestertVed: null,
      syncStatus: "pending",
      feilmelding: null,
      sistEndretLokalt: Date.now(),
      sistSynkronisert: null,
    })
    .run();

  // 5. Auto-fordeling normaltid/overtid.
  if (arbeidstimer > 0) {
    const dagsnorm = effektiv.dagsnorm > 0 ? effektiv.dagsnorm : arbeidstimer;
    const timelonnTimer = Math.min(arbeidstimer, dagsnorm);
    const overtidTimer = Math.round((arbeidstimer - timelonnTimer) * 100) / 100;

    const standard = hentStandardLonnsartLokalt(orgId);
    if (standard && timelonnTimer > 0) {
      db.insert(sheetTimerLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: valgtProsjekt.id,
          lonnsartId: standard.id,
          aktivitetId: aktivitet.id,
          externalCostObjectId: null,
          timer: timelonnTimer,
          fraTid: null,
          tilTid: null,
          sistEndretLokalt: Date.now(),
        })
        .run();
    }

    if (overtidTimer > 0) {
      // MVP: navne-match «Overtid 50%». Erstattes av Lonnsart.overtidsnivaa.
      const overtid = db
        .select()
        .from(lonnsartLocal)
        .where(
          and(
            eq(lonnsartLocal.organizationId, orgId),
            eq(lonnsartLocal.aktiv, true),
          ),
        )
        .all()
        .find((l) => /overtid/i.test(l.navn) && /50/.test(l.navn));
      if (overtid) {
        db.insert(sheetTimerLocal)
          .values({
            id: randomUUID(),
            dagsseddelId: sheetId,
            projectId: valgtProsjekt.id,
            lonnsartId: overtid.id,
            aktivitetId: aktivitet.id,
            externalCostObjectId: null,
            timer: overtidTimer,
            fraTid: null,
            tilTid: null,
            sistEndretLokalt: Date.now(),
          })
          .run();
      }
    }
  }

  return sheetId;
}
