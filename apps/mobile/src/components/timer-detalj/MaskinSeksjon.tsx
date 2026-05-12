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
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import { sheetMachineLocal, equipmentLocal } from "../../db/schema";
import { ENHETER } from "../../lib/enheter";
import type { MaskinRad, Equipment } from "../../types/timer-detalj";

interface MaskinSeksjonProps {
  sheetId: string;
  rader: MaskinRad[];
  organizationId: string;
  harEquipmentCache: boolean;
  redigerbar: boolean;
  onEndret: () => void;
}

export function MaskinSeksjon({
  sheetId,
  rader,
  organizationId,
  harEquipmentCache,
  redigerbar,
  onEndret,
}: MaskinSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);

  const leggTil = useCallback(
    (
      vehicleId: string,
      timer: number,
      mengde: number | null,
      enhet: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.insert(sheetMachineLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          vehicleId,
          timer,
          mengde,
          enhet,
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
      vehicleId: string,
      timer: number,
      mengde: number | null,
      enhet: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.update(sheetMachineLocal)
        .set({
          vehicleId,
          timer,
          mengde,
          enhet,
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
    <View className="mt-4">
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

      {visModal && (
        <MaskinRadModal
          organizationId={organizationId}
          eksisterendeRad={
            redigerRadId
              ? rader.find((r) => r.id === redigerRadId) ?? null
              : null
          }
          onLagre={(vehicleId, timer, mengde, enhet) => {
            if (redigerRadId) {
              oppdater(redigerRadId, vehicleId, timer, mengde, enhet);
            } else {
              leggTil(vehicleId, timer, mengde, enhet);
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
  eksisterendeRad,
  onLagre,
  onLukk,
}: {
  organizationId: string;
  eksisterendeRad: MaskinRad | null;
  onLagre: (
    vehicleId: string,
    timer: number,
    mengde: number | null,
    enhet: string | null,
  ) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
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
  const [feil, setFeil] = useState<string | null>(null);
  const [visEquipmentVelger, setVisEquipmentVelger] = useState(false);
  const [visEnhetVelger, setVisEnhetVelger] = useState(false);

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

  function lagre() {
    setFeil(null);
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
    onLagre(valgtVehicleId, tall, mengdeNum, enhet || null);
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

        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.utstyr")} *
            </Text>
            <Pressable
              onPress={() => setVisEquipmentVelger(true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-3"
            >
              <Text
                className={`text-base ${valgtEquipment ? "text-gray-900" : "text-gray-400"}`}
              >
                {valgtEquipment
                  ? `${valgtEquipment.merke ?? ""} ${valgtEquipment.modell ?? ""}`.trim() ||
                    valgtEquipment.internNavn ||
                    t("timer.velgUtstyr")
                  : t("timer.velgUtstyr")}
              </Text>
              {valgtEquipment?.internNummer && (
                <Text className="mt-0.5 text-xs text-gray-500">
                  #{valgtEquipment.internNummer}
                </Text>
              )}
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
              <Pressable
                onPress={() => setVisEnhetVelger(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-3"
              >
                <Text className={`text-base ${enhet ? "text-gray-900" : "text-gray-400"}`}>
                  {enhet || t("timer.felt.enhet")}
                </Text>
              </Pressable>
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
