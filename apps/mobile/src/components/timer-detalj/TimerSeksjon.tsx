import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import {
  sheetTimerLocal,
  lonnsartLocal,
  aktivitetLocal,
  externalCostObjectLocal,
} from "../../db/schema";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import { hentEffektivArbeidstidLokal } from "../../services/kalenderKatalog";
import { hentStandardLonnsartLokalt } from "../../services/timerKatalog";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import type {
  TimerRad,
  Lonnsart,
  Aktivitet,
  Underprosjekt,
} from "../../types/timer-detalj";
import { ProsjektVelgerModal, ProsjektFelt } from "./ProsjektVelger";
import { FraTilTidFelt, fraErForTil } from "./FraTilTidFelt";

interface TimerSeksjonProps {
  sheetId: string;
  organizationId: string;
  rader: TimerRad[];
  projectId: string;
  /** T7-4e (2026-05-16): ECO-filter for å pre-selektere i Add-modal og holde
   *  nye rader i samme (projectId, ECO)-bucket som parent EcoBucket. null =
   *  hovedgruppe (ingen ECO). */
  defaultEcoId?: string | null;
  /** T7-4e: skjul intern header når TimerSeksjon rendres inne i EcoBucket
   *  (ECO-subheaderen står for kontekst der). Knapp for "+Legg til timer"
   *  flyttes da til en sekundær placering. */
  visHeader?: boolean;
  /** ISO YYYY-MM-DD — dato på dagsseddelen. Brukes til kalender-utleting (T4-e). */
  dato: string;
  defaultAktivitetId: string | null;
  redigerbar: boolean;
  onEndret: () => void;
}

export function TimerSeksjon({
  sheetId,
  organizationId,
  rader,
  projectId,
  defaultEcoId = null,
  visHeader = true,
  dato,
  defaultAktivitetId,
  redigerbar,
  onEndret,
}: TimerSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);

  const totaltimer = useMemo(
    () => rader.reduce((acc, r) => acc + r.timer, 0),
    [rader],
  );

  const leggTil = useCallback(
    (
      radProjectId: string,
      lonnsartId: string,
      aktivitetId: string,
      timer: number,
      externalCostObjectId: string | null,
      fraTid: string | null,
      tilTid: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.insert(sheetTimerLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: radProjectId,
          lonnsartId,
          aktivitetId,
          externalCostObjectId,
          timer,
          fraTid,
          tilTid,
          sistEndretLokalt: Date.now(),
        })
        .run();
      onEndret();
    },
    [sheetId, onEndret],
  );

  const oppdater = useCallback(
    (
      radId: string,
      radProjectId: string,
      lonnsartId: string,
      aktivitetId: string,
      timer: number,
      externalCostObjectId: string | null,
      fraTid: string | null,
      tilTid: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.update(sheetTimerLocal)
        .set({
          projectId: radProjectId,
          lonnsartId,
          aktivitetId,
          timer,
          externalCostObjectId,
          fraTid,
          tilTid,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetTimerLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  const fjern = useCallback(
    (radId: string) => {
      const db = hentDatabase();
      if (!db) return;
      db.delete(sheetTimerLocal).where(eq(sheetTimerLocal.id, radId)).run();
      onEndret();
    },
    [onEndret],
  );

  return (
    <View className={visHeader ? "mt-4" : ""}>
      {visHeader && (
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.kol.timer")} · {totaltimer.toFixed(2)} {t("timer.tEnhet")}
          </Text>
          {redigerbar && (
            <Pressable
              onPress={() => {
                setRedigerRadId(null);
                setVisModal(true);
              }}
              hitSlop={8}
              className="rounded-full bg-blue-600 p-1.5"
            >
              <Plus size={14} color="#ffffff" />
            </Pressable>
          )}
        </View>
      )}
      {rader.length === 0 ? (
        <View className="bg-white px-4 py-6">
          {redigerbar ? (
            <Pressable
              onPress={() => {
                setRedigerRadId(null);
                setVisModal(true);
              }}
              className="flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 active:bg-blue-700"
            >
              <Plus size={16} color="#ffffff" />
              <Text className="text-base font-semibold text-white">
                {t("timer.tilfoy.timer")}
              </Text>
            </Pressable>
          ) : (
            <Text className="text-center text-sm text-gray-400">
              {t("timer.ingenTimerRader")}
            </Text>
          )}
        </View>
      ) : (
        rader.map((rad) => (
          <TimerRadVis
            key={rad.id}
            rad={rad}
            redigerbar={redigerbar}
            onRediger={() => {
              setRedigerRadId(rad.id);
              setVisModal(true);
            }}
            onSlett={() => fjern(rad.id)}
          />
        ))
      )}

      {/* T7-4e: "+Legg til timer" når header er skjult (rendret i EcoBucket).
          Vises kun når det allerede finnes rader — tom-tilstand har sin egen
          full-bredde knapp over, så vi unngår to «legg til»-knapper samtidig. */}
      {!visHeader && redigerbar && rader.length > 0 && (
        <Pressable
          onPress={() => {
            setRedigerRadId(null);
            setVisModal(true);
          }}
          className="mt-2 flex-row items-center justify-center gap-1 rounded border border-dashed border-gray-300 bg-white py-2 active:bg-gray-50"
        >
          <Plus size={12} color="#1e40af" />
          <Text className="text-xs font-medium text-sitedoc-primary">
            {t("timer.tilfoy.timer")}
          </Text>
        </Pressable>
      )}

      {visModal && (
        <TimerRadModal
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultEcoId={defaultEcoId}
          dato={dato}
          eksisterendeRader={rader}
          defaultAktivitetId={defaultAktivitetId}
          eksisterendeRad={
            redigerRadId
              ? rader.find((r) => r.id === redigerRadId) ?? null
              : null
          }
          onLagre={(
            radProjectId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
          ) => {
            if (redigerRadId) {
              oppdater(
                redigerRadId,
                radProjectId,
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
              );
            } else {
              leggTil(
                radProjectId,
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
              );
            }
            setVisModal(false);
            setRedigerRadId(null);
          }}
          onLukk={() => {
            setVisModal(false);
            setRedigerRadId(null);
          }}
        />
      )}
    </View>
  );
}

function TimerRadVis({
  rad,
  redigerbar,
  onRediger,
  onSlett,
}: {
  rad: TimerRad;
  redigerbar: boolean;
  onRediger: () => void;
  onSlett: () => void;
}) {
  const lonnsart = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    const treff = db
      .select()
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.id, rad.lonnsartId))
      .all()[0];
    return treff ?? null;
  }, [rad.lonnsartId]);

  const aktivitet = useMemo(() => {
    if (!rad.aktivitetId) return null;
    const db = hentDatabase();
    if (!db) return null;
    const treff = db
      .select()
      .from(aktivitetLocal)
      .where(eq(aktivitetLocal.id, rad.aktivitetId))
      .all()[0];
    return treff ?? null;
  }, [rad.aktivitetId]);

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-base text-gray-900">
          {lonnsart?.navn ?? rad.lonnsartId}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {aktivitet && (
            <Text className="text-xs text-gray-500">{aktivitet.navn}</Text>
          )}
          {lonnsart?.kode && (
            <Text className="text-xs text-gray-500">{lonnsart.kode}</Text>
          )}
          {rad.fraTid && rad.tilTid && (
            <Text className="text-xs text-gray-500">
              {rad.fraTid}–{rad.tilTid}
            </Text>
          )}
          {rad.externalCostObjectId && (
            <UnderprosjektEtikett ecoId={rad.externalCostObjectId} />
          )}
        </View>
      </View>
      <Text className="font-mono text-base text-gray-900">
        {rad.timer.toFixed(2)}
      </Text>
      {redigerbar && (
        <View className="flex-row gap-1">
          <Pressable
            onPress={onRediger}
            hitSlop={8}
            className="rounded p-1.5 active:bg-gray-100"
          >
            <Pencil size={16} color="#6b7280" />
          </Pressable>
          <Pressable
            onPress={onSlett}
            hitSlop={8}
            className="rounded p-1.5 active:bg-red-50"
          >
            <Trash2 size={16} color="#dc2626" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function UnderprosjektEtikett({ ecoId }: { ecoId: string }) {
  const eco = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, ecoId))
        .all()[0] ?? null
    );
  }, [ecoId]);
  if (!eco) return null;
  return (
    <Text className="text-xs font-medium text-blue-700">
      {eco.proAdmId} {eco.kortNavn}
    </Text>
  );
}

function TimerRadModal({
  organizationId,
  defaultProjectId,
  defaultEcoId,
  dato,
  eksisterendeRader,
  defaultAktivitetId,
  eksisterendeRad,
  onLagre,
  onLukk,
}: {
  organizationId: string;
  defaultProjectId: string;
  defaultEcoId: string | null;
  dato: string;
  eksisterendeRader: TimerRad[];
  defaultAktivitetId: string | null;
  eksisterendeRad: TimerRad | null;
  onLagre: (
    projectId: string,
    lonnsartId: string,
    aktivitetId: string,
    timer: number,
    externalCostObjectId: string | null,
    fraTid: string | null,
    tilTid: string | null,
  ) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  // T.5: Hent firma-tidsrunding fra lokal cache. null = ingen runding.
  const tidsrundingMinutter = useMemo(
    () => hentOrganizationSettingLokalt(organizationId)?.tidsrundingMinutter ?? null,
    [organizationId],
  );

  // T4-e: Beregn defaults for fraTid/tilTid ved opprettelse av ny rad.
  //   - Ny rad uten eksisterende rader: fraTid = effektiv.startTid, tilTid = effektiv.sluttTid
  //   - Ny rad med eksisterende rader: fraTid = siste rads tilTid (hvis satt), ellers effektiv.startTid; tilTid = effektiv.sluttTid
  //   - Rediger eksisterende rad: bruk radens egne verdier
  const defaultTider = useMemo(() => {
    if (eksisterendeRad) {
      return {
        fra: eksisterendeRad.fraTid ?? null,
        til: eksisterendeRad.tilTid ?? null,
      };
    }
    const effektiv = hentEffektivArbeidstidLokal(organizationId, new Date(`${dato}T00:00:00`));
    const forrigeMedTil = [...eksisterendeRader].reverse().find((r) => !!r.tilTid);
    return {
      fra: forrigeMedTil?.tilTid ?? effektiv.startTid,
      til: effektiv.sluttTid,
    };
  }, [eksisterendeRad, eksisterendeRader, organizationId, dato]);

  // Forhåndsvelg lønnsart + aktivitet på ny rad. Prioritetskjede:
  //   - Rediger eksisterende rad: bruk radens egne verdier
  //   - Ny rad med eksisterende rader: forrige rads lønnsart/aktivitet (Variant A)
  //   - Ny rad på tom sedel: firma-default lønnsart (Variant B, erStandardvalg)
  //     → tom hvis ingen er markert. Aktivitet faller til sedelens default.
  const defaultValg = useMemo(() => {
    if (eksisterendeRad) {
      return {
        lonnsartId: eksisterendeRad.lonnsartId,
        aktivitetId: eksisterendeRad.aktivitetId,
      };
    }
    const sisteRad =
      eksisterendeRader.length > 0
        ? eksisterendeRader[eksisterendeRader.length - 1]
        : null;
    const firmaDefaultLonnsartId =
      hentStandardLonnsartLokalt(organizationId)?.id ?? "";
    return {
      lonnsartId: sisteRad?.lonnsartId ?? firmaDefaultLonnsartId,
      aktivitetId: sisteRad?.aktivitetId ?? defaultAktivitetId ?? "",
    };
  }, [eksisterendeRad, eksisterendeRader, defaultAktivitetId, organizationId]);

  const [valgtProjectId, setValgtProjectId] = useState<string>(
    eksisterendeRad?.projectId ?? defaultProjectId,
  );
  const [valgtLonnsartId, setValgtLonnsartId] = useState<string>(
    defaultValg.lonnsartId,
  );
  const [valgtAktivitetId, setValgtAktivitetId] = useState<string>(
    defaultValg.aktivitetId,
  );
  const [timer, setTimer] = useState<string>(
    eksisterendeRad?.timer ? eksisterendeRad.timer.toFixed(2) : "",
  );
  // T7-4e: defaultEcoId pre-selekteres når bruker klikker "+Legg til timer"
  // i en spesifikk ECO-bucket. Ved redigering brukes radens egen ECO.
  const [valgtEcoId, setValgtEcoId] = useState<string | null>(
    eksisterendeRad?.externalCostObjectId ?? defaultEcoId,
  );
  const [fraTid, setFraTid] = useState<string | null>(defaultTider.fra);
  const [tilTid, setTilTid] = useState<string | null>(defaultTider.til);
  const [feil, setFeil] = useState<string | null>(null);
  const [visProsjektVelger, setVisProsjektVelger] = useState(false);
  const [visLonnsartVelger, setVisLonnsartVelger] = useState(false);
  const [visAktivitetVelger, setVisAktivitetVelger] = useState(false);
  const [visEcoVelger, setVisEcoVelger] = useState(false);

  const valgtProsjekt = useMemo(() => {
    return valgtProjectId ? finnProsjektLokalt(valgtProjectId) : null;
  }, [valgtProjectId]);

  const valgtLonnsart = useMemo(() => {
    if (!valgtLonnsartId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(lonnsartLocal)
        .where(eq(lonnsartLocal.id, valgtLonnsartId))
        .all()[0] ?? null
    );
  }, [valgtLonnsartId]);

  const valgtAktivitet = useMemo(() => {
    if (!valgtAktivitetId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(aktivitetLocal)
        .where(eq(aktivitetLocal.id, valgtAktivitetId))
        .all()[0] ?? null
    );
  }, [valgtAktivitetId]);

  const valgtEco = useMemo(() => {
    if (!valgtEcoId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, valgtEcoId))
        .all()[0] ?? null
    );
  }, [valgtEcoId]);

  function lagre() {
    setFeil(null);
    if (!valgtProjectId) {
      setFeil(t("timer.feil.prosjektPaakrevd"));
      return;
    }
    if (!valgtLonnsartId) {
      setFeil(t("timer.feil.lonnsartPaakrevd"));
      return;
    }
    if (!valgtAktivitetId) {
      setFeil(t("timer.feil.aktivitetPaakrevd"));
      return;
    }
    const tall = parseFloat(timer.replace(",", "."));
    if (isNaN(tall) || tall <= 0 || tall > 24) {
      setFeil(t("timer.feil.ugyldigTimer"));
      return;
    }
    // T4-e: fraTid < tilTid hvis begge er satt. Null tolereres.
    if (!fraErForTil(fraTid, tilTid)) {
      setFeil(t("timer.feil.sluttForStart"));
      return;
    }
    onLagre(
      valgtProjectId,
      valgtLonnsartId,
      valgtAktivitetId,
      tall,
      valgtEcoId,
      fraTid,
      tilTid,
    );
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {eksisterendeRad ? t("timer.rediger.timer") : t("timer.tilfoy.timer")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.prosjekt")} *
            </Text>
            <ProsjektFelt
              prosjektNavn={valgtProsjekt?.name ?? null}
              prosjektNummer={valgtProsjekt?.projectNumber ?? null}
              onTrykk={() => setVisProsjektVelger(true)}
            />
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.lonnsart")} *
            </Text>
            <Pressable
              onPress={() => setVisLonnsartVelger(true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-3"
            >
              <Text
                className={`text-base ${valgtLonnsart ? "text-gray-900" : "text-gray-400"}`}
              >
                {valgtLonnsart?.navn ?? t("timer.velgLonnsart")}
              </Text>
            </Pressable>
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.aktivitet")} *
            </Text>
            <Pressable
              onPress={() => setVisAktivitetVelger(true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-3"
            >
              <Text
                className={`text-base ${valgtAktivitet ? "text-gray-900" : "text-gray-400"}`}
              >
                {valgtAktivitet?.navn ?? t("timer.velgAktivitet")}
              </Text>
            </Pressable>
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.antallTimer")} *
            </Text>
            <TextInput
              value={timer}
              onChangeText={setTimer}
              placeholder="0,00"
              keyboardType="decimal-pad"
              className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
            />
          </View>

          {/* T4-e: Fra-/til-tid per rad. Forhåndsutfylling fra kalender +
              forrige rads tilTid. T.5: avrunding via firma-setting. */}
          <FraTilTidFelt
            fraTid={fraTid}
            tilTid={tilTid}
            tidsrundingMinutter={tidsrundingMinutter}
            onFraEndret={setFraTid}
            onTilEndret={setTilTid}
          />

          {/* Underprosjekt (valgfritt) — Tilleggsarbeid, Endring m.fl. */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.underprosjekt")}
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setVisEcoVelger(true)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3"
              >
                <Text
                  className={`text-base ${valgtEco ? "text-gray-900" : "text-gray-400"}`}
                >
                  {valgtEco
                    ? `${valgtEco.proAdmId} — ${valgtEco.kortNavn}`
                    : t("timer.velgUnderprosjekt")}
                </Text>
              </Pressable>
              {valgtEcoId && (
                <Pressable
                  onPress={() => setValgtEcoId(null)}
                  hitSlop={8}
                  className="rounded p-2 active:bg-gray-100"
                >
                  <X size={18} color="#6b7280" />
                </Pressable>
              )}
            </View>
          </View>

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <Pressable
            onPress={lagre}
            className="mt-4 items-center rounded-lg bg-blue-600 px-6 py-4 active:bg-blue-700"
          >
            <Text className="text-base font-semibold text-white">
              {t("handling.lagre")}
            </Text>
          </Pressable>
        </ScrollView>

        {visLonnsartVelger && (
          <LonnsartVelgerModal
            valgtId={valgtLonnsartId}
            onVelg={(id) => {
              setValgtLonnsartId(id);
              setVisLonnsartVelger(false);
            }}
            onLukk={() => setVisLonnsartVelger(false)}
          />
        )}

        {visAktivitetVelger && (
          <AktivitetVelgerModal
            valgtId={valgtAktivitetId}
            onVelg={(id) => {
              setValgtAktivitetId(id);
              setVisAktivitetVelger(false);
            }}
            onLukk={() => setVisAktivitetVelger(false)}
          />
        )}

        {visEcoVelger && (
          <UnderprosjektVelgerModal
            projectId={valgtProjectId}
            valgtId={valgtEcoId}
            onVelg={(id) => {
              setValgtEcoId(id);
              setVisEcoVelger(false);
            }}
            onLukk={() => setVisEcoVelger(false)}
          />
        )}

        {visProsjektVelger && (
          <ProsjektVelgerModal
            organizationId={organizationId}
            valgtId={valgtProjectId}
            onVelg={(id) => {
              setValgtProjectId(id);
              // Nullstill ECO ved prosjekt-bytte — ECO er prosjekt-spesifikk
              setValgtEcoId(null);
              setVisProsjektVelger(false);
            }}
            onLukk={() => setVisProsjektVelger(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function LonnsartVelgerModal({
  valgtId,
  onVelg,
  onLukk,
}: {
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const lonnsarter = useMemo<Lonnsart[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.aktiv, true))
      .all();
  }, []);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return lonnsarter;
    const q = sok.toLowerCase();
    return lonnsarter.filter(
      (l) =>
        l.navn.toLowerCase().includes(q) ||
        (l.kode ?? "").toLowerCase().includes(q),
    );
  }, [lonnsarter, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgLonnsart")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {lonnsarter.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.navn}</Text>
                <Text className="text-xs text-gray-500">
                  {[item.kode, item.type].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenLonnsarter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

function AktivitetVelgerModal({
  valgtId,
  onVelg,
  onLukk,
}: {
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const aktiviteter = useMemo<Aktivitet[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(aktivitetLocal)
      .where(eq(aktivitetLocal.aktiv, true))
      .all();
  }, []);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return aktiviteter;
    const q = sok.toLowerCase();
    return aktiviteter.filter(
      (a) =>
        a.navn.toLowerCase().includes(q) ||
        (a.kode ?? "").toLowerCase().includes(q),
    );
  }, [aktiviteter, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgAktivitet")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {aktiviteter.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.navn}</Text>
                {item.kode && (
                  <Text className="text-xs text-gray-500">{item.kode}</Text>
                )}
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenAktiviteter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

// T7-4e (2026-05-16): eksportert for gjenbruk i MaskinSeksjon (ECO-velger
// for maskin-rader, samme mønster som timer-rader).
export function UnderprosjektVelgerModal({
  projectId,
  valgtId,
  onVelg,
  onLukk,
}: {
  projectId: string;
  valgtId: string | null;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const ecoer = useMemo<Underprosjekt[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(externalCostObjectLocal)
      .where(
        and(
          eq(externalCostObjectLocal.projectId, projectId),
          eq(externalCostObjectLocal.status, "aktiv"),
          eq(externalCostObjectLocal.timerregistreringApen, true),
        ),
      )
      .all();
  }, [projectId]);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return ecoer;
    const q = sok.toLowerCase();
    return ecoer.filter(
      (e) =>
        e.proAdmId.toLowerCase().includes(q) ||
        e.kortNavn.toLowerCase().includes(q),
    );
  }, [ecoer, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgUnderprosjekt")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {ecoer.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base font-medium text-gray-900">
                  {item.proAdmId}
                </Text>
                <Text className="text-sm text-gray-600">{item.kortNavn}</Text>
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenUnderprosjekter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
