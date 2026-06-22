import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Trash2, Pencil, X, Check, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import { sheetMachineLocal, equipmentLocal, externalCostObjectLocal } from "../../db/schema";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import { hentEffektivArbeidstidLokal } from "../../services/kalenderKatalog";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import { ENHETER } from "../../lib/enheter";
import type { MaskinRad, Equipment } from "../../types/timer-detalj";
import { ProsjektVelgerModal, ProsjektFelt } from "./ProsjektVelger";
import { FraTilTidFelt, fraErForTil } from "./FraTilTidFelt";
import { UnderprosjektVelgerModal } from "./TimerSeksjon";
import { VelgerFelt } from "./VelgerFelt";

interface MaskinSeksjonProps {
  sheetId: string;
  rader: MaskinRad[];
  organizationId: string;
  projectId: string;
  /** T7-4e (2026-05-16): ECO-filter for å pre-selektere i Add-modal og holde
   *  nye rader i samme (projectId, ECO)-bucket som parent EcoBucket. null =
   *  hovedgruppe (ingen ECO). */
  defaultEcoId?: string | null;
  /** T7-4e: skjul intern header når MaskinSeksjon rendres inne i EcoBucket
   *  (ECO-subheaderen står for kontekst der). */
  visHeader?: boolean;
  /** ISO YYYY-MM-DD — dato på dagsseddelen. Brukes til kalender-utleting (T4-e). */
  dato: string;
  harEquipmentCache: boolean;
  /** T.11: false når innlogget bruker mangler gyldig maskinførerbevis i org.
   *  Styrer soft-varsel — påvirker ALDRI synlighet eller lagring. */
  harMaskinforerbevis: boolean;
  redigerbar: boolean;
  onEndret: () => void;
}

export function MaskinSeksjon({
  sheetId,
  rader,
  organizationId,
  projectId,
  defaultEcoId = null,
  visHeader = true,
  dato,
  harEquipmentCache,
  harMaskinforerbevis,
  redigerbar,
  onEndret,
}: MaskinSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);

  const leggTil = useCallback(
    (
      radProjectId: string,
      ecoId: string | null,
      vehicleId: string,
      timer: number,
      mengde: number | null,
      enhet: string | null,
      fraTid: string | null,
      tilTid: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.insert(sheetMachineLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: radProjectId,
          externalCostObjectId: ecoId,
          vehicleId,
          timer,
          mengde,
          enhet,
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
      ecoId: string | null,
      vehicleId: string,
      timer: number,
      mengde: number | null,
      enhet: string | null,
      fraTid: string | null,
      tilTid: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.update(sheetMachineLocal)
        .set({
          projectId: radProjectId,
          externalCostObjectId: ecoId,
          vehicleId,
          timer,
          mengde,
          enhet,
          fraTid,
          tilTid,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetMachineLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  const fjern = useCallback(
    (radId: string) => {
      const db = hentDatabase();
      if (!db) return;
      db.delete(sheetMachineLocal)
        .where(eq(sheetMachineLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  // Soft-skjul: maskin-seksjonen vises kun hvis Equipment-cache er populert
  // (Maskin-modul aktivert + firmaet har utstyr) eller hvis sedlen allerede
  // har maskin-rader (gamle rader bevares).
  if (!harEquipmentCache && rader.length === 0) return null;

  return (
    <View className={visHeader ? "mt-4" : ""}>
      {/* T.11: soft-varsel når arbeider mangler gyldig maskinførerbevis.
          Informativt («flagget for synlighet»), aldri blokkerende. */}
      {harEquipmentCache && !harMaskinforerbevis && (
        <View className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={14} color="#b45309" />
            <Text className="flex-1 text-xs text-amber-800">
              {t("timer.maskinforerbevis.arbeider")}
            </Text>
          </View>
        </View>
      )}
      {visHeader && (
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.kol.maskiner")}
          </Text>
          {redigerbar && harEquipmentCache && (
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
          <Text className="text-center text-sm text-gray-400">
            {t("timer.ingenMaskinRader")}
          </Text>
        </View>
      ) : (
        rader.map((rad) => (
          <MaskinRadVis
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

      {/* T7-4e: når header er skjult (rendret i EcoBucket), eksponer
          "+Legg til maskin"-knapp her så bruker fortsatt kan tilføye. */}
      {!visHeader && redigerbar && harEquipmentCache && (
        <Pressable
          onPress={() => {
            setRedigerRadId(null);
            setVisModal(true);
          }}
          className="mt-2 flex-row items-center justify-center gap-1 rounded border border-dashed border-gray-300 bg-white py-2 active:bg-gray-50"
        >
          <Plus size={12} color="#1e40af" />
          <Text className="text-xs font-medium text-sitedoc-primary">
            {t("timer.tilfoy.maskin")}
          </Text>
        </Pressable>
      )}

      {visModal && (
        <MaskinRadModal
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultEcoId={defaultEcoId}
          dato={dato}
          eksisterendeRader={rader}
          eksisterendeRad={
            redigerRadId
              ? rader.find((r) => r.id === redigerRadId) ?? null
              : null
          }
          onLagre={(
            radProjectId,
            ecoId,
            vehicleId,
            timer,
            mengde,
            enhet,
            fraTid,
            tilTid,
          ) => {
            if (redigerRadId) {
              oppdater(
                redigerRadId,
                radProjectId,
                ecoId,
                vehicleId,
                timer,
                mengde,
                enhet,
                fraTid,
                tilTid,
              );
            } else {
              leggTil(
                radProjectId,
                ecoId,
                vehicleId,
                timer,
                mengde,
                enhet,
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

function MaskinRadVis({
  rad,
  redigerbar,
  onRediger,
  onSlett,
}: {
  rad: MaskinRad;
  redigerbar: boolean;
  onRediger: () => void;
  onSlett: () => void;
}) {
  const equipment = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(equipmentLocal)
        .where(eq(equipmentLocal.id, rad.vehicleId))
        .all()[0] ?? null
    );
  }, [rad.vehicleId]);

  const navn = equipment
    ? `${equipment.merke ?? ""} ${equipment.modell ?? ""}`.trim() ||
      equipment.internNavn ||
      rad.vehicleId
    : rad.vehicleId;

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-base text-gray-900">{navn}</Text>
        <View className="flex-row flex-wrap gap-2">
          {equipment?.internNummer && (
            <Text className="text-xs text-gray-500">#{equipment.internNummer}</Text>
          )}
          {equipment?.registreringsnummer && (
            <Text className="text-xs text-gray-500">
              {equipment.registreringsnummer}
            </Text>
          )}
          {rad.mengde !== null && rad.mengde !== undefined && (
            <Text className="text-xs text-gray-500">
              {rad.mengde.toFixed(2)} {rad.enhet ?? ""}
            </Text>
          )}
          {rad.fraTid && rad.tilTid && (
            <Text className="text-xs text-gray-500">
              {rad.fraTid}–{rad.tilTid}
            </Text>
          )}
        </View>
      </View>
      <Text className="font-mono text-base text-gray-900">{rad.timer.toFixed(2)}</Text>
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

function MaskinRadModal({
  organizationId,
  defaultProjectId,
  defaultEcoId,
  dato,
  eksisterendeRader,
  eksisterendeRad,
  onLagre,
  onLukk,
}: {
  organizationId: string;
  defaultProjectId: string;
  defaultEcoId: string | null;
  dato: string;
  eksisterendeRader: MaskinRad[];
  eksisterendeRad: MaskinRad | null;
  onLagre: (
    projectId: string,
    ecoId: string | null,
    vehicleId: string,
    timer: number,
    mengde: number | null,
    enhet: string | null,
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

  // T4-e: defaults for fraTid/tilTid (samme mønster som TimerRadModal).
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

  const [valgtProjectId, setValgtProjectId] = useState<string>(
    eksisterendeRad?.projectId ?? defaultProjectId,
  );
  const [valgtVehicleId, setValgtVehicleId] = useState<string>(
    eksisterendeRad?.vehicleId ?? "",
  );
  const [timer, setTimer] = useState<string>(
    eksisterendeRad?.timer ? eksisterendeRad.timer.toFixed(2) : "",
  );
  const [mengde, setMengde] = useState<string>(
    eksisterendeRad?.mengde !== null && eksisterendeRad?.mengde !== undefined
      ? eksisterendeRad.mengde.toFixed(2)
      : "",
  );
  const [enhet, setEnhet] = useState<string>(eksisterendeRad?.enhet ?? "");
  const [fraTid, setFraTid] = useState<string | null>(defaultTider.fra);
  const [tilTid, setTilTid] = useState<string | null>(defaultTider.til);
  // T7-4e: ECO på maskin — pre-selekteres fra eksisterende rad eller defaultEcoId.
  const [valgtEcoId, setValgtEcoId] = useState<string | null>(
    eksisterendeRad?.externalCostObjectId ?? defaultEcoId,
  );
  const [feil, setFeil] = useState<string | null>(null);
  const [visProsjektVelger, setVisProsjektVelger] = useState(false);
  const [visEquipmentVelger, setVisEquipmentVelger] = useState(false);
  const [visEnhetVelger, setVisEnhetVelger] = useState(false);
  const [visEcoVelger, setVisEcoVelger] = useState(false);

  const valgtProsjekt = useMemo(() => {
    return valgtProjectId ? finnProsjektLokalt(valgtProjectId) : null;
  }, [valgtProjectId]);

  const valgtEquipment = useMemo(() => {
    if (!valgtVehicleId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(equipmentLocal)
        .where(eq(equipmentLocal.id, valgtVehicleId))
        .all()[0] ?? null
    );
  }, [valgtVehicleId]);

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
    if (!valgtVehicleId) {
      setFeil(t("timer.feil.utstyrPaakrevd"));
      return;
    }
    const tall = parseFloat(timer.replace(",", "."));
    if (isNaN(tall) || tall <= 0 || tall > 24) {
      setFeil(t("timer.feil.ugyldigTimer"));
      return;
    }
    let mengdeNum: number | null = null;
    if (mengde.trim()) {
      mengdeNum = parseFloat(mengde.replace(",", "."));
      if (isNaN(mengdeNum) || mengdeNum < 0) {
        setFeil(t("timer.feil.ugyldigMengde"));
        return;
      }
    }
    // T4-e: fraTid < tilTid hvis begge satt.
    if (!fraErForTil(fraTid, tilTid)) {
      setFeil(t("timer.feil.sluttForStart"));
      return;
    }
    onLagre(
      valgtProjectId,
      valgtEcoId,
      valgtVehicleId,
      tall,
      mengdeNum,
      enhet || null,
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
            {eksisterendeRad ? t("timer.rediger.maskin") : t("timer.tilfoy.maskin")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-4"
          keyboardShouldPersistTaps="handled"
        >
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
              {t("timer.felt.utstyr")} *
            </Text>
            <VelgerFelt
              verdi={
                valgtEquipment
                  ? `${valgtEquipment.merke ?? ""} ${valgtEquipment.modell ?? ""}`.trim() ||
                    valgtEquipment.internNavn ||
                    null
                  : null
              }
              placeholder={t("timer.velgUtstyr")}
              onPress={() => setVisEquipmentVelger(true)}
              underTekst={
                valgtEquipment?.internNummer
                  ? `#${valgtEquipment.internNummer}`
                  : null
              }
            />
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

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.mengde")}
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={mengde}
                onChangeText={setMengde}
                placeholder="0,00"
                keyboardType="decimal-pad"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
              />
              <VelgerFelt
                verdi={enhet || null}
                placeholder={t("timer.felt.enhet")}
                onPress={() => setVisEnhetVelger(true)}
              />
            </View>
          </View>

          {/* T4-e: Fra-/til-tid per maskin-rad. Forhåndsutfylling fra kalender.
              T.5: avrunding via firma-setting. */}
          <FraTilTidFelt
            fraTid={fraTid}
            tilTid={tilTid}
            tidsrundingMinutter={tidsrundingMinutter}
            onFraEndret={setFraTid}
            onTilEndret={setTilTid}
          />

          {/* T7-4e: ECO (underprosjekt) — speil av TimerRadModals ECO-velger.
              Maskin følger samme prosjekt+ECO-gruppe som arbeidstimer (T.7). */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.underprosjekt")}
            </Text>
            <VelgerFelt
              verdi={
                valgtEco ? `${valgtEco.proAdmId} — ${valgtEco.kortNavn}` : null
              }
              placeholder={t("timer.velgUnderprosjekt")}
              onPress={() => setVisEcoVelger(true)}
              onClear={() => setValgtEcoId(null)}
            />
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
        </KeyboardAvoidingView>

        {visEquipmentVelger && (
          <EquipmentVelgerModal
            organizationId={organizationId}
            valgtId={valgtVehicleId}
            onVelg={(id) => {
              setValgtVehicleId(id);
              setVisEquipmentVelger(false);
            }}
            onLukk={() => setVisEquipmentVelger(false)}
          />
        )}

        {visEnhetVelger && (
          <EnhetVelgerModal
            valgt={enhet}
            onVelg={(v) => {
              setEnhet(v);
              setVisEnhetVelger(false);
            }}
            onLukk={() => setVisEnhetVelger(false)}
          />
        )}

        {visProsjektVelger && (
          <ProsjektVelgerModal
            organizationId={organizationId}
            valgtId={valgtProjectId}
            onVelg={(id) => {
              setValgtProjectId(id);
              // Nullstill ECO ved prosjekt-bytte — ECO er prosjekt-spesifikk.
              setValgtEcoId(null);
              setVisProsjektVelger(false);
            }}
            onLukk={() => setVisProsjektVelger(false)}
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
      </SafeAreaView>
    </Modal>
  );
}

function EquipmentVelgerModal({
  organizationId,
  valgtId,
  onVelg,
  onLukk,
}: {
  organizationId: string;
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const equipment = useMemo<Equipment[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    // Vis alle ikke-utgåtte (per anbefaling) — feltarbeider kan registrere
    // bruk på paa_service-utstyr hvis sjekklisten ble brukt før det havnet
    // på service. Utgåtte (status="utgaatt") ekskluderes — gamle
    // sheet_machine-rader viser fortsatt navn via finnEquipmentLokalt.
    return db
      .select()
      .from(equipmentLocal)
      .where(eq(equipmentLocal.organizationId, organizationId))
      .all()
      .filter((e) => e.status !== "utgaatt");
  }, [organizationId]);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return equipment;
    const q = sok.toLowerCase();
    return equipment.filter(
      (e) =>
        (e.merke ?? "").toLowerCase().includes(q) ||
        (e.modell ?? "").toLowerCase().includes(q) ||
        (e.internNavn ?? "").toLowerCase().includes(q) ||
        (e.internNummer ?? "").toLowerCase().includes(q) ||
        (e.registreringsnummer ?? "").toLowerCase().includes(q),
    );
  }, [equipment, sok]);

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
            {t("timer.velgUtstyr")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {equipment.length > 7 && (
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
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const navn =
              `${item.merke ?? ""} ${item.modell ?? ""}`.trim() ||
              item.internNavn ||
              item.id;
            const meta = [
              item.internNavn && item.merke ? item.internNavn : null,
              item.internNummer ? `#${item.internNummer}` : null,
              item.registreringsnummer,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Pressable
                onPress={() => onVelg(item.id)}
                className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                  item.id === valgtId ? "bg-blue-50" : ""
                }`}
              >
                <View className="flex-1">
                  <Text className="text-base text-gray-900">{navn}</Text>
                  {meta && <Text className="text-xs text-gray-500">{meta}</Text>}
                </View>
                {item.id === valgtId && <Check size={18} color="#1e40af" />}
              </Pressable>
            );
          }}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenUtstyr")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

function EnhetVelgerModal({
  valgt,
  onVelg,
  onLukk,
}: {
  valgt: string;
  onVelg: (v: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
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
            {t("timer.felt.enhet")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        <Pressable
          onPress={() => onVelg("")}
          className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
            valgt === "" ? "bg-blue-50" : ""
          }`}
        >
          <Text className="flex-1 text-base text-gray-500">—</Text>
          {valgt === "" && <Check size={18} color="#1e40af" />}
        </Pressable>
        {ENHETER.map((e) => (
          <Pressable
            key={e}
            onPress={() => onVelg(e)}
            className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
              valgt === e ? "bg-blue-50" : ""
            }`}
          >
            <Text className="flex-1 text-base text-gray-900">{e}</Text>
            {valgt === e && <Check size={18} color="#1e40af" />}
          </Pressable>
        ))}
      </SafeAreaView>
    </Modal>
  );
}
