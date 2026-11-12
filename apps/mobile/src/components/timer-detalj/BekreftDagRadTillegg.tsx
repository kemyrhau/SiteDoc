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
import { hentLokaleVarelinjerForDag } from "../../services/vareforbrukSync";
import { EquipmentVelgerModal } from "./MaskinSeksjon";
import { KortVareforbrukModal } from "./KortVareforbrukModal";
import { TastaturScrollView } from "./TastaturScrollView";
import {
  tilleggSynlighet,
  maskinBruddForTillegg,
  nyTilleggMaskin,
  fortIDagLinjer,
  type BekreftDagTillegg,
  type TilleggMaskin,
  type VaktGrunnlag,
} from "../../utils/bekreftDagTillegg";
import { maskinerOverRad } from "../../services/kobledeMaskiner";

/**
 * Hva arbeideren kan føre: utstyrsbufferen (maskin) og prosjektene med
 * Varelager (varer). Leses én gang pr. skjerm, deles av alle radene.
 */
export function useTilleggKatalog(orgId: string): { harEquipment: boolean; varelagerProsjekter: string[] } {
  const [varelagerProsjekter, setVarelagerProsjekter] = useState<string[]>([]);
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
  return { harEquipment, varelagerProsjekter };
}

/**
 * L3-D maskin og varer i `/timer/bekreft-dag` (spec § 3.5, ORDRE 31) —
 * PRESISERING TILLEGG (Kenneth 2026-11-12): registreres på RADEN, som i
 * prosjektkortet. Én blokk under hver arbeidsrad, også når dagen har én rad.
 * Holdes i minnet til [Bekreft og lagre]; ingenting skrives herfra. Maskinens
 * timer er som standard radens; lavere tillatt, høyere stopper.
 */
export function BekreftDagRadTillegg({
  orgId,
  userId,
  projectId,
  prosjektNavn,
  dato,
  byggeplassId,
  radTimer,
  grunnlag,
  andreMaskiner,
  katalog,
  tillegg,
  onEndre,
}: {
  orgId: string;
  userId: string;
  projectId: string;
  prosjektNavn: string;
  dato: string;
  /** Radens effektive byggeplass — forhåndsvalg i vare-modalen. */
  byggeplassId: string | null;
  radTimer: number;
  /** Datoens sedel (sum-vakten). */
  grunnlag: VaktGrunnlag | null;
  /** Maskiner på datoens andre rader — teller med i sum-vakten. */
  andreMaskiner: TilleggMaskin[];
  katalog: { harEquipment: boolean; varelagerProsjekter: string[] };
  tillegg: BekreftDagTillegg;
  onEndre: (neste: BekreftDagTillegg) => void;
}) {
  const { t } = useTranslation();
  const [visMaskinVelger, setVisMaskinVelger] = useState(false);
  const [maskinId, setMaskinId] = useState<string | null>(null);
  const [visVare, setVisVare] = useState(false);

  // «Ført i dag» leses ved åpning (lokale linjer på eksisterende sedel).
  const lagredeIDag = useMemo(
    () => (visVare ? hentLokaleVarelinjerForDag(userId, projectId, dato) : []),
    [visVare, userId, projectId, dato],
  );

  const synlig = tilleggSynlighet({
    harEquipment: katalog.harEquipment,
    varelagerProsjektIder: katalog.varelagerProsjekter,
    projectId,
  });
  if (!synlig.seksjon) return null;

  return (
    <View className="gap-1.5">
      <TilleggLinjer tillegg={tillegg} onEndre={onEndre} />
      <View className="flex-row gap-2">
        {synlig.maskin ? (
          <Pressable
            onPress={() => setVisMaskinVelger(true)}
            className="min-h-[36px] flex-1 items-center justify-center rounded-md border border-gray-300 active:bg-gray-100"
          >
            <Text className="text-sm font-medium text-gray-800">{t("timer.bekreftDag.tillegg.maskin")}</Text>
          </Pressable>
        ) : null}
        {synlig.varer ? (
          <Pressable
            onPress={() => setVisVare(true)}
            className="min-h-[36px] flex-1 items-center justify-center rounded-md border border-gray-300 active:bg-gray-100"
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
        radTimer={radTimer}
        eksisterende={[...andreMaskiner, ...tillegg.maskiner]}
        projectId={projectId}
        onLukk={() => setMaskinId(null)}
        onLeggTil={(timer) => {
          if (!maskinId) return;
          onEndre({
            ...tillegg,
            maskiner: [
              ...tillegg.maskiner,
              nyTilleggMaskin({ lokalId: randomUUID(), projectId, vehicleId: maskinId, timer }),
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
        forblirApen
        fortIDag={fortIDagLinjer(lagredeIDag, tillegg.varer, projectId)}
      />
    </View>
  );
}

/** Radens maskin- og varelinjer med fjern-knapp. Brukes også for linjer uten rad. */
export function TilleggLinjer({
  tillegg,
  onEndre,
}: {
  tillegg: BekreftDagTillegg;
  onEndre: (neste: BekreftDagTillegg) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {tillegg.maskiner.map((m) => {
        const eq_ = finnEquipmentLokalt(m.vehicleId);
        const navn = eq_
          ? `${eq_.merke ?? ""} ${eq_.modell ?? ""}`.trim() || eq_.internNavn || m.vehicleId
          : m.vehicleId;
        return (
          <TilleggLinje
            key={m.lokalId}
            tekst={`${navn} · ${formaterTimer(m.timer)} t`}
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
    </>
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

function formaterTimer(timer: number): string {
  return timer.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

/** Maskintimer for valgt maskin (uten mengde/enhet — ORDRE 34). Standard =
 *  radens timer; lavere tillatt, høyere ikke (TILLEGG 2026-11-12). Samme vakt
 *  som Bekreft — [Legg til] stenges ved brudd. */
function MaskinTimerArk({
  vehicleId,
  grunnlag,
  radTimer,
  eksisterende,
  projectId,
  onLukk,
  onLeggTil,
}: {
  vehicleId: string | null;
  grunnlag: VaktGrunnlag | null;
  radTimer: number;
  /** Datoens øvrige maskiner (andre rader + denne). */
  eksisterende: TilleggMaskin[];
  projectId: string;
  onLukk: () => void;
  onLeggTil: (timer: number) => void;
}) {
  const { t } = useTranslation();
  const [tekst, setTekst] = useState("");
  useEffect(() => {
    if (!vehicleId) return;
    setTekst(formaterTimer(radTimer));
  }, [vehicleId, radTimer]);
  const timer = Number(tekst.replace(",", "."));
  const gyldig = Number.isFinite(timer) && timer > 0;
  const ny = nyTilleggMaskin({ lokalId: "ny", projectId, vehicleId: vehicleId ?? "", timer });
  const overRad = gyldig && maskinerOverRad(radTimer, [ny]).length > 0;
  const brudd =
    gyldig && (overRad || maskinBruddForTillegg(grunnlag, [...eksisterende, ny]).length > 0);

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
          {brudd ? (
            <Text className="text-xs text-red-700">
              {overRad
                ? t("timer.bekreftDag.tillegg.overRad", { timer: formaterTimer(radTimer) })
                : t("timer.maskin.overstigerArbeid")}
            </Text>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable onPress={onLukk} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
              <Text className="text-sm font-medium text-gray-800">{t("handling.avbryt")}</Text>
            </Pressable>
            <Pressable
              onPress={() => onLeggTil(timer)}
              disabled={!gyldig || brudd}
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
