/**
 * Posisjon-basert handlingsmeny for mobilens detaljsider.
 * Bruker ActionSheetIOS (iOS) og Alert (Android).
 */

import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActionSheetIOS,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { DokumentflytRolle } from "@sitedoc/shared";
import type { FlytMedlem } from "./FlytIndikator";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface EntrepriseData {
  id: string;
  name: string;
  color: string | null;
}

interface DokumentflytData {
  id: string;
  name: string;
  enterpriseId: string | null;
  maler: Array<{ template: { id: string } }>;
  medlemmer: Array<{
    rolle: string;
    erHovedansvarlig: boolean;
    enterpriseId?: string | null;
    projectMemberId?: string | null;
    groupId?: string | null;
    hovedansvarligPerson?: { user: { id: string; name: string | null } } | null;
    projectMember?: { user: { id: string; name: string | null } } | null;
    group?: { id: string; name: string } | null;
  }>;
}

interface VideresendValg {
  key: string;
  entrepriseNavn: string;
  dokumentflytId: string;
  visningsnavn: string;
  mottaker?: { userId?: string; groupId?: string };
}

interface Mottaker {
  userId?: string;
  groupId?: string;
  dokumentflytId?: string;
}

interface Props {
  status: string;
  erLaster: boolean;
  onEndreStatus: (nyStatus: string, kommentar?: string, mottaker?: Mottaker) => void;
  onSlett?: () => void;
  alleEntrepriser?: EntrepriseData[];
  dokumentflyter?: DokumentflytData[];
  templateId?: string | null;
  standardEntrepriseId?: string;
  minRolle?: DokumentflytRolle | null;
  flytMedlemmer?: FlytMedlem[];
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  bestillerUserId?: string;
}

/* ------------------------------------------------------------------ */
/*  Flytposisjon-hjelpere                                              */
/* ------------------------------------------------------------------ */

interface Ledd {
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  entrepriseIder: Set<string>;
}

function byggLedd(medlemmer: FlytMedlem[]): Ledd[] {
  const stegMap = new Map<number, FlytMedlem[]>();
  for (const m of medlemmer) {
    const liste = stegMap.get(m.steg) ?? [];
    liste.push(m);
    stegMap.set(m.steg, liste);
  }
  return [...stegMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([_steg, medl]) => ({
      gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
      brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
      entrepriseIder: new Set(medl.filter((m) => m.enterprise).map((m) => m.enterprise!.id)),
    }));
}

function finnAktivtIndex(ledd: Ledd[], status: string, recipientUserId?: string | null, recipientGroupId?: string | null, bestillerUserId?: string): number {
  if (status === "draft" || status === "cancelled") {
    if (bestillerUserId) {
      const idx = ledd.findIndex((l) => l.brukerIder.has(bestillerUserId));
      if (idx !== -1) return idx;
    }
    return 0;
  }
  if (status === "closed" || status === "approved") return -1;
  if (recipientGroupId) {
    const idx = ledd.findIndex((l) => l.gruppeIder.has(recipientGroupId));
    if (idx !== -1) return idx;
  }
  if (recipientUserId) {
    const idx = ledd.findIndex((l) => l.brukerIder.has(recipientUserId));
    if (idx !== -1) return idx;
  }
  return ledd.length > 1 ? ledd.length - 1 : -1;
}

/* ------------------------------------------------------------------ */
/*  Videresend-valg (forenklet byggVideresendValg)                     */
/* ------------------------------------------------------------------ */

function byggValg(
  alleEntrepriser: EntrepriseData[],
  dokumentflyter: DokumentflytData[],
  templateId: string | null | undefined,
): VideresendValg[] {
  const valg: VideresendValg[] = [];
  for (const ent of alleEntrepriser) {
    const flyter = dokumentflyter.filter((df) => {
      if (df.enterpriseId !== ent.id) return false;
      if (!templateId) return true;
      return df.maler.some((m) => m.template.id === templateId);
    });
    for (const df of flyter) {
      const mottaker = finnMottaker(df);
      valg.push({
        key: flyter.length > 1 ? `${ent.id}__${df.id}` : ent.id,
        entrepriseNavn: ent.name,
        dokumentflytId: df.id,
        visningsnavn: flyter.length > 1 ? `${ent.name} (${df.name})` : ent.name,
        mottaker,
      });
    }
  }
  return valg;
}

function finnMottaker(df: DokumentflytData): { userId?: string; groupId?: string } | undefined {
  for (const rolle of ["utforer", "bestiller", "godkjenner"]) {
    const medl = df.medlemmer.filter((m) => m.rolle === rolle);
    if (medl.length === 0) continue;
    const ha = medl.find((m) => m.erHovedansvarlig) ?? medl[0];
    if (ha?.group) return { groupId: ha.group.id };
    if (ha?.hovedansvarligPerson?.user) return { userId: ha.hovedansvarligPerson.user.id };
    if (ha?.projectMember?.user) return { userId: ha.projectMember.user.id };
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Hovedkomponent                                                      */
/* ------------------------------------------------------------------ */

export function DokumentHandlingsmeny({
  status,
  erLaster,
  onEndreStatus,
  onSlett,
  alleEntrepriser,
  dokumentflyter,
  templateId,
  standardEntrepriseId,
  minRolle,
  flytMedlemmer,
  recipientUserId,
  recipientGroupId,
  bestillerUserId,
}: Props) {
  const { t } = useTranslation();
  const [visKommentar, setVisKommentar] = useState<{ nyStatus: string; mottaker?: Mottaker; label: string } | null>(null);
  const [kommentar, setKommentar] = useState("");

  const videresendValg = useMemo(
    () => byggValg(alleEntrepriser ?? [], dokumentflyter ?? [], templateId),
    [alleEntrepriser, dokumentflyter, templateId],
  );

  const ledd = useMemo(() => byggLedd(flytMedlemmer ?? []), [flytMedlemmer]);
  const aktivtIndex = useMemo(
    () => finnAktivtIndex(ledd, status, recipientUserId, recipientGroupId, bestillerUserId),
    [ledd, status, recipientUserId, recipientGroupId, bestillerUserId],
  );
  const erAdmin = minRolle === "registrator";
  const erSisteBoks = ledd.length > 0 && aktivtIndex === ledd.length - 1;
  const erFørsteBoks = aktivtIndex === 0;

  /* ---- Bygg ActionSheet-valg ---- */

  interface ArkElement { label: string; nyStatus: string; mottaker?: Mottaker; erDestruktiv?: boolean }

  const byggArkValg = useCallback((): ArkElement[] => {
    const el: ArkElement[] = [];

    if (status === "draft") {
      for (const v of videresendValg) {
        el.push({ label: v.visningsnavn, nyStatus: "sent", mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined });
      }
      if (el.length === 0) el.push({ label: t("handling.send"), nyStatus: "sent" });
      return el;
    }

    if (["received", "in_progress", "rejected"].includes(status)) {
      if (erSisteBoks) {
        el.push({ label: t("statushandling.svarAvsender"), nyStatus: "responded" });
      } else {
        const primær = standardEntrepriseId ? videresendValg.find((v) => v.entrepriseNavn && v.key.startsWith(standardEntrepriseId)) : undefined;
        if (primær) {
          el.push({ label: primær.visningsnavn, nyStatus: "responded", mottaker: primær.mottaker ? { ...primær.mottaker, dokumentflytId: primær.dokumentflytId } : undefined });
        }
        // Send tilbake — fra boks 2 og oppover
        if (!erFørsteBoks) {
          el.push({ label: t("statushandling.sendTilbake"), nyStatus: "sent" });
        }
        // Andre entrepriser
        const andre = videresendValg.filter((v) => !primær || v.key !== primær.key);
        for (const v of andre) {
          el.push({ label: v.visningsnavn, nyStatus: "forwarded", mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined });
        }
      }
    }

    if (status === "responded") {
      el.push({ label: t("statushandling.svarAvsender"), nyStatus: "rejected" });
      for (const v of videresendValg) {
        el.push({ label: v.visningsnavn, nyStatus: "forwarded", mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined });
      }
    }

    if (status === "approved" || status === "closed") {
      for (const v of videresendValg) {
        el.push({ label: v.visningsnavn, nyStatus: "forwarded", mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined });
      }
    }

    // Admin-seksjon: registrator/admin ELLER siste boks (godkjenner)
    if ((erAdmin || erSisteBoks) && !["draft", "cancelled"].includes(status)) {
      const adminEl: ArkElement[] = [];
      if (!["approved"].includes(status)) adminEl.push({ label: `⚙ ${t("handling.godkjenn")}`, nyStatus: "approved" });
      if (!["closed"].includes(status)) adminEl.push({ label: `⚙ ${t("handling.lukk")}`, nyStatus: "closed" });
      if (!["cancelled"].includes(status)) adminEl.push({ label: `⚙ ${t("statushandling.trekkTilbake")}`, nyStatus: "cancelled", erDestruktiv: true });
      if (!["draft"].includes(status)) adminEl.push({ label: `⚙ ${t("statushandling.gjenapne")}`, nyStatus: "draft" });
      if (adminEl.length > 0) el.push(...adminEl);
    }

    return el;
  }, [status, erSisteBoks, erFørsteBoks, erAdmin, videresendValg, standardEntrepriseId, t]);

  const arkValg = useMemo(byggArkValg, [byggArkValg]);

  /* ---- Vis ActionSheet / Alert ---- */

  const visSendValg = useCallback(() => {
    if (arkValg.length === 0) return;

    // Kun én mottaker og ikke admin → send direkte med kommentar
    if (arkValg.length === 1 && !erAdmin) {
      const valg = arkValg[0]!;
      setVisKommentar({ nyStatus: valg.nyStatus, mottaker: valg.mottaker, label: valg.label });
      return;
    }

    const labels = [...arkValg.map((v) => v.label), t("handling.avbryt")];

    if (Platform.OS === "ios") {
      const destruktive = arkValg.findIndex((v) => v.erDestruktiv);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: labels,
          cancelButtonIndex: labels.length - 1,
          destructiveButtonIndex: destruktive !== -1 ? destruktive : undefined,
        },
        (index) => {
          if (index === labels.length - 1) return; // Avbryt
          const valg = arkValg[index];
          if (valg) {
            setVisKommentar({ nyStatus: valg.nyStatus, mottaker: valg.mottaker, label: valg.label });
          }
        },
      );
    } else {
      // Android: Alert med knapper (maks 3 synlige, resten i liste-stil)
      Alert.alert(
        t("handling.send"),
        undefined,
        [
          ...arkValg.map((v) => ({
            text: v.label,
            style: (v.erDestruktiv ? "destructive" : "default") as "destructive" | "default",
            onPress: () => setVisKommentar({ nyStatus: v.nyStatus, mottaker: v.mottaker, label: v.label }),
          })),
          { text: t("handling.avbryt"), style: "cancel" as const },
        ],
      );
    }
  }, [arkValg, erAdmin, t]);

  const bekreftHandling = useCallback(() => {
    if (!visKommentar) return;
    onEndreStatus(visKommentar.nyStatus, kommentar.trim() || undefined, visKommentar.mottaker);
    setVisKommentar(null);
    setKommentar("");
  }, [visKommentar, kommentar, onEndreStatus]);

  /* ---- Render ---- */

  // Lesevisning
  if (minRolle === null && (flytMedlemmer?.length ?? 0) > 0) {
    return null;
  }

  // Terminal uten handlinger
  if (["closed"].includes(status) && arkValg.length === 0 && !erAdmin) {
    return null;
  }

  return (
    <>
      <View className="flex-row gap-2">
        {/* Kladd: Send + Slett */}
        {status === "draft" && (
          <>
            <Pressable
              onPress={visSendValg}
              disabled={erLaster}
              className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg py-3 ${erLaster ? "bg-blue-400" : "bg-blue-600"}`}
            >
              <Text className="font-medium text-white">{t("handling.send")}</Text>
              {arkValg.length > 1 && <ChevronDown size={14} color="#ffffff" />}
            </Pressable>
            {onSlett && (
              <Pressable
                onPress={onSlett}
                disabled={erLaster}
                className="items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-3"
              >
                <Text className="font-medium text-red-600">{t("handling.slett")}</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Sendt: Trekk tilbake */}
        {status === "sent" && (
          <Pressable
            onPress={() => setVisKommentar({ nyStatus: "cancelled", mottaker: undefined, label: t("statushandling.trekkTilbake") })}
            disabled={erLaster}
            className="flex-1 items-center rounded-lg border border-red-200 bg-red-50 py-3"
          >
            <Text className="font-medium text-red-600">{erLaster ? t("statushandling.endrer") : t("statushandling.trekkTilbake")}</Text>
          </Pressable>
        )}

        {/* Avbrutt: Gjenåpne + Slett */}
        {status === "cancelled" && (
          <>
            <Pressable
              onPress={() => setVisKommentar({ nyStatus: "draft", mottaker: undefined, label: t("statushandling.gjenapne") })}
              disabled={erLaster}
              className={`flex-1 items-center rounded-lg py-3 ${erLaster ? "bg-blue-400" : "bg-blue-600"}`}
            >
              <Text className="font-medium text-white">{t("statushandling.gjenapne")}</Text>
            </Pressable>
            {onSlett && (
              <Pressable
                onPress={onSlett}
                disabled={erLaster}
                className="items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-3"
              >
                <Text className="font-medium text-red-600">{t("handling.slett")}</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Responded (godkjenner / siste boks): Godkjenn + Avvis + Send */}
        {status === "responded" && (
          <>
            <Pressable
              onPress={() => setVisKommentar({ nyStatus: "approved", mottaker: undefined, label: t("handling.godkjenn") })}
              disabled={erLaster}
              className={`flex-1 items-center rounded-lg py-3 ${erLaster ? "bg-green-400" : "bg-green-600"}`}
            >
              <Text className="font-medium text-white">{t("handling.godkjenn")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setVisKommentar({ nyStatus: "rejected", mottaker: undefined, label: t("handling.avvis") })}
              disabled={erLaster}
              className="items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-3"
            >
              <Text className="font-medium text-red-600">{t("handling.avvis")}</Text>
            </Pressable>
            {arkValg.length > 0 && (
              <Pressable
                onPress={visSendValg}
                disabled={erLaster}
                className="flex-row items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <Text className="font-medium text-gray-700">{t("handling.send")}</Text>
                <ChevronDown size={12} color="#374151" />
              </Pressable>
            )}
          </>
        )}

        {/* Received / In_progress / Rejected: Send */}
        {["received", "in_progress", "rejected"].includes(status) && (
          <Pressable
            onPress={visSendValg}
            disabled={erLaster}
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg py-3 ${erLaster ? "bg-blue-400" : "bg-blue-600"}`}
          >
            <Text className="font-medium text-white">{erLaster ? t("statushandling.endrer") : t("handling.send")}</Text>
            {arkValg.length > 1 && <ChevronDown size={14} color="#ffffff" />}
          </Pressable>
        )}

        {/* Approved / Closed: Lukk + Videresend */}
        {["approved", "closed"].includes(status) && (
          <>
            {status === "approved" && (
              <Pressable
                onPress={() => setVisKommentar({ nyStatus: "closed", mottaker: undefined, label: t("handling.lukk") })}
                disabled={erLaster}
                className={`flex-1 items-center rounded-lg py-3 ${erLaster ? "bg-gray-400" : "bg-gray-600"}`}
              >
                <Text className="font-medium text-white">{t("handling.lukk")}</Text>
              </Pressable>
            )}
            {arkValg.length > 0 && (
              <Pressable
                onPress={visSendValg}
                disabled={erLaster}
                className="flex-row items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <Text className="font-medium text-gray-700">{t("statushandling.videresend")}</Text>
                <ChevronDown size={12} color="#374151" />
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Kommentar-modal */}
      <Modal visible={!!visKommentar} transparent animationType="fade" onRequestClose={() => setVisKommentar(null)}>
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable className="flex-1" onPress={() => setVisKommentar(null)} />
          <View className="rounded-t-2xl bg-white px-4 pb-8 pt-4 shadow-lg">
            <Text className="mb-3 text-sm font-semibold text-gray-700">
              {t("statushandling.bekreftHandling", { handling: visKommentar?.label ?? "" })}
            </Text>
            <TextInput
              value={kommentar}
              onChangeText={setKommentar}
              placeholder={t("statushandling.valgfriKommentar")}
              placeholderTextColor="#9ca3af"
              className="mb-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={bekreftHandling}
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={bekreftHandling}
                disabled={erLaster}
                className={`flex-1 items-center rounded-lg py-3 ${erLaster ? "bg-blue-400" : "bg-blue-600"}`}
              >
                <Text className="font-medium text-white">
                  {erLaster ? t("statushandling.endrer") : t("handling.bekreft")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setVisKommentar(null); setKommentar(""); }}
                className="items-center rounded-lg border border-gray-200 px-6 py-3"
              >
                <Text className="font-medium text-gray-600">{t("handling.avbryt")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
