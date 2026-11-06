import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, TextInput } from "react-native";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../db/database";
import { equipmentLocal } from "../../db/schema";
import { finnEquipmentLokalt } from "../../services/maskinKatalog";
import { hentVarelagerProsjekterLokalt } from "../../services/vareKatalog";
import { ENHETER } from "../../lib/enheter";
import { EquipmentVelgerModal } from "./MaskinSeksjon";
import { KortVareforbrukModal } from "./KortVareforbrukModal";
import { TastaturScrollView } from "./TastaturScrollView";
import {
  tilleggSynlighet,
  maskinBruddForTillegg,
  type BekreftDagTillegg,
  type VaktGrunnlag,
} from "../../utils/bekreftDagTillegg";

/**
 * L3-D «Maskin og varer» i `/timer/bekreft-dag` (spec § 3.5, ORDRE 31).
 * Holdes i minnet til [Bekreft og lagre]; ingenting skrives herfra. Seksjonen
 * skjules helt når verken utstyr eller Varelager finnes (vedtak D).
 */
export function BekreftDagTilleggSeksjon({
  orgId,
  userId,
  projectId,
  prosjektNavn,
  dato,
  byggeplassId,
  grunnlag,
  tillegg,
  onEndre,
}: {
  orgId: string;
  userId: string;
  projectId: string;
  prosjektNavn: string;
  dato: string;
  /** Entydig byggeplass for dagen — forhåndsvalg i vare-modalen. */
  byggeplassId: string | null;
  grunnlag: VaktGrunnlag | null;
  tillegg: BekreftDagTillegg;
  onEndre: (neste: BekreftDagTillegg) => void;
}) {
  const { t } = useTranslation();
  const [varelagerProsjekter, setVarelagerProsjekter] = useState<string[]>([]);
  const [visMaskinVelger, setVisMaskinVelger] = useState(false);
  const [maskinId, setMaskinId] = useState<string | null>(null);
  const [visVare, setVisVare] = useState(false);

  useEffect(() => {
    let aktiv = true;
    void hentVarelagerProsjekterLokalt(orgId).then((ider) => {
      if (aktiv) setVarelagerProsjekter(ider);
    });
    return () => {
      aktiv = false;
    };
  }, [orgId]);

  const harEquipment = useMemo(() => {
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

  const synlig = tilleggSynlighet({ harEquipment, varelagerProsjektIder: varelagerProsjekter, projectId });
  if (!synlig.seksjon) return null;

  return (
    <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <Text className="text-sm font-semibold text-gray-900">{t("timer.bekreftDag.tillegg.tittel")}</Text>

      {tillegg.maskiner.map((m) => {
        const eq_ = finnEquipmentLokalt(m.vehicleId);
        const navn = eq_
          ? `${eq_.merke ?? ""} ${eq_.modell ?? ""}`.trim() || eq_.internNavn || m.vehicleId
          : m.vehicleId;
        return (
          <TilleggLinje
            key={m.lokalId}
            tekst={`${navn} · ${m.timer.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} t`}
            merke={eq_?.kategori === "smautstyr" ? t("timer.bekreftDag.tillegg.redskap") : null}
            onFjern={() =>
              onEndre({ ...tillegg, maskiner: tillegg.maskiner.filter((x) => x.lokalId !== m.lokalId) })
            }
          />
        );
      })}
      {tillegg.varer.map((v) => (
        <TilleggLinje
          key={v.lokalId}
          tekst={`${v.vareNavn} · ${v.antall.toLocaleString("nb-NO", { maximumFractionDigits: 3 })} ${v.enhet}`}
          merke={null}
          onFjern={() => onEndre({ ...tillegg, varer: tillegg.varer.filter((x) => x.lokalId !== v.lokalId) })}
        />
      ))}

      <View className="flex-row gap-2">
        {synlig.maskin ? (
          <Pressable
            onPress={() => setVisMaskinVelger(true)}
            className="flex-1 items-center rounded-md border border-gray-300 py-2 active:bg-gray-100"
          >
            <Text className="text-sm font-medium text-gray-800">{t("timer.bekreftDag.tillegg.maskin")}</Text>
          </Pressable>
        ) : null}
        {synlig.varer ? (
          <Pressable
            onPress={() => setVisVare(true)}
            className="flex-1 items-center rounded-md border border-gray-300 py-2 active:bg-gray-100"
          >
            <Text className="text-sm font-medium text-gray-800">{t("timer.bekreftDag.tillegg.varer")}</Text>
          </Pressable>
        ) : null}
      </View>

      {visMaskinVelger && (
        <EquipmentVelgerModal
          organizationId={orgId}
          valgtId=""
          brukt={tillegg.maskiner.map((m) => m.vehicleId)}
          onVelg={(id) => {
            setVisMaskinVelger(false);
            setMaskinId(id);
          }}
          onLukk={() => setVisMaskinVelger(false)}
        />
      )}

      <MaskinTimerArk
        vehicleId={maskinId}
        grunnlag={grunnlag}
        eksisterende={tillegg}
        projectId={projectId}
        onLukk={() => setMaskinId(null)}
        onLeggTil={(timer, mengde, enhet) => {
          if (!maskinId) return;
          onEndre({
            ...tillegg,
            maskiner: [
              ...tillegg.maskiner,
              { lokalId: randomUUID(), projectId, vehicleId: maskinId, timer, mengde, enhet },
            ],
          });
          setMaskinId(null);
        }}
      />

      <KortVareforbrukModal
        synlig={visVare}
        userId={userId}
        organizationId={orgId}
        sheetId={null}
        projectId={projectId}
        prosjektNavn={prosjektNavn}
        dato={dato}
        sedelByggeplassId={byggeplassId}
        onAvbryt={() => setVisVare(false)}
        onLagret={() => setVisVare(false)}
        onVelgLinje={(valg) =>
          onEndre({ ...tillegg, varer: [...tillegg.varer, { lokalId: randomUUID(), projectId, ...valg }] })
        }
      />
    </View>
  );
}

function TilleggLinje({ tekst, merke, onFjern }: { tekst: string; merke: string | null; onFjern: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5">
      {merke ? (
        <Text className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
          {merke}
        </Text>
      ) : null}
      <Text className="flex-1 text-sm text-gray-900">{tekst}</Text>
      <Pressable onPress={onFjern} hitSlop={10} accessibilityLabel={t("handling.fjern")}>
        <X size={16} color="#6b7280" />
      </Pressable>
    </View>
  );
}

/** Maskintimer for valgt maskin. Samme vakt som Bekreft — [Legg til] stenges ved brudd. */
function MaskinTimerArk({
  vehicleId,
  grunnlag,
  eksisterende,
  projectId,
  onLukk,
  onLeggTil,
}: {
  vehicleId: string | null;
  grunnlag: VaktGrunnlag | null;
  eksisterende: BekreftDagTillegg;
  projectId: string;
  onLukk: () => void;
  onLeggTil: (timer: number, mengde: number | null, enhet: string | null) => void;
}) {
  const { t } = useTranslation();
  const [tekst, setTekst] = useState("");
  const [mengdeTekst, setMengdeTekst] = useState("");
  const [enhet, setEnhet] = useState<string | null>(null);
  useEffect(() => {
    if (!vehicleId) return;
    setTekst("");
    setMengdeTekst("");
    setEnhet(null);
  }, [vehicleId]);
  // Mengde er valgfri (som `MaskinSeksjon`); tomt felt = null.
  const mengde = mengdeTekst.trim() ? Number(mengdeTekst.replace(",", ".")) : null;
  const mengdeGyldig = mengde === null || (Number.isFinite(mengde) && mengde >= 0);
  const timer = Number(tekst.replace(",", "."));
  const gyldig = Number.isFinite(timer) && timer > 0;
  const brudd =
    gyldig &&
    maskinBruddForTillegg(grunnlag, [
      ...eksisterende.maskiner,
      { lokalId: "ny", projectId, vehicleId: vehicleId ?? "", timer, mengde: null, enhet: null },
    ]).length > 0;

  return (
    <Modal visible={vehicleId != null} transparent animationType="fade" onRequestClose={onLukk}>
      <TastaturScrollView
        className="flex-1 bg-black/40"
        contentContainerClassName="flex-grow items-center justify-center px-6 py-10"
      >
        <View className="w-full max-w-md gap-3 rounded-2xl bg-white p-5">
          <Text className="text-base font-semibold text-gray-900">{t("timer.bekreftDag.tillegg.timer")}</Text>
          <TextInput
            value={tekst}
            placeholder="0,00"
            onChangeText={setTekst}
            keyboardType="decimal-pad"
            autoFocus
            className={`rounded-lg border px-3 py-2 text-base ${brudd ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          <Text className="text-sm font-medium text-gray-700">{t("timer.felt.mengde")}</Text>
          <TextInput
            value={mengdeTekst}
            onChangeText={setMengdeTekst}
            placeholder="0,00"
            keyboardType="decimal-pad"
            className="rounded-lg border border-gray-300 px-3 py-2 text-base"
          />
          <View className="flex-row flex-wrap gap-1.5">
            {ENHETER.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEnhet(enhet === e ? null : e)}
                className={`rounded-full border px-3 py-1 ${enhet === e ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
              >
                <Text className={`text-xs ${enhet === e ? "text-blue-700" : "text-gray-700"}`}>{e}</Text>
              </Pressable>
            ))}
          </View>
          {brudd ? <Text className="text-xs text-red-700">{t("timer.maskin.overstigerArbeid")}</Text> : null}
          <View className="flex-row gap-2">
            <Pressable onPress={onLukk} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
              <Text className="text-sm font-medium text-gray-800">{t("handling.avbryt")}</Text>
            </Pressable>
            <Pressable
              onPress={() => onLeggTil(timer, mengde, mengde === null ? null : enhet)}
              disabled={!gyldig || brudd || !mengdeGyldig}
              className="flex-1 items-center rounded-lg bg-blue-600 py-2.5 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-white">{t("handling.leggTil")}</Text>
            </Pressable>
          </View>
        </View>
      </TastaturScrollView>
    </Modal>
  );
}
