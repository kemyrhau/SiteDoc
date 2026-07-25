/**
 * Boks-basert handlingsmeny for mobilens detaljsider.
 * Erstatter forrige ActionSheet-baserte versjon.
 *
 * UX-spec: BACKLOG.md § Dokumentflyt send-modal redesign (punkt 1-10).
 *
 * - Flyt-bokser alltid synlig i bunn, fargefylte (Faggruppe.color), uten tekst
 * - Trykk på boks → popup med tilgjengelige statuser + medlemsliste (stjerne på hovedansvarlig)
 * - Status-trykk → bekreftelses-modal med valgfritt kommentarfelt
 * - Flyt-bytte = egen nedtrekksmeny (kun for cross-flyt-medlemmer)
 * - ⋯-meny for admin-handlinger (Lukk, Gjenåpne, Trekk tilbake)
 * - Custom RN Modal — ingen ActionSheetIOS, ingen Alert
 */

import { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Star, MoreHorizontal, ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { hentRolleFiltrertHandlinger, type StatusHandling, type DokumentflytRolle, type AdminNiva } from "@sitedoc/shared";
import { byggLedd, type FlytMedlem, type Ledd } from "../utils/dokumentflyt-ledd";

interface TilgjengeligeFlyter {
  gjeldende: {
    id: string;
    name: string;
    faggruppe: { id: string; name: string; color: string | null } | null;
    medlemmer: FlytMedlem[];
    brukersBoks: { steg: number; rolle: string; kilde: string } | null;
  } | null;
  andre: Array<{
    id: string;
    name: string;
    faggruppe: { id: string; name: string; color: string | null } | null;
    brukersBoks: { steg: number; rolle: string };
    medlemKilde: string;
  }>;
  kanFlytte: boolean;
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
  tilgjengeligeFlyter: TilgjengeligeFlyter | null;
  minRolle: DokumentflytRolle | null;
  /**
   * Admin-nivå i flyt-laget (Kloss 2): "sitedoc"/"prosjekt"/null. Fra hentMinFlytInfo.adminNiva.
   * Erstatter det gamle `erFirmaAdmin`-flagget — firma-admin (null) mister fantom-admin-menyen
   * serveren uansett avviste; prosjektadmin (server ga full) beholder paritet.
   */
  adminNiva?: AdminNiva;
}

const BOKS_WIDTH = 36;
const BOKS_HEIGHT = 28;
const DEFAULT_FARGE = "#9ca3af"; // gray-400 hvis Faggruppe.color mangler

export function DokumentHandlingsmeny({
  status,
  erLaster,
  onEndreStatus,
  onSlett,
  tilgjengeligeFlyter,
  minRolle,
  adminNiva,
}: Props) {
  const { t } = useTranslation();
  const [valgtBoksIdx, setValgtBoksIdx] = useState<number | null>(null);
  const [visBekreftelse, setVisBekreftelse] = useState<{
    nyStatus: string;
    label: string;
    mottaker?: Mottaker;
    bekreftelsesTekst: string;
  } | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [visAdminMeny, setVisAdminMeny] = useState(false);
  const [visFlytBytte, setVisFlytBytte] = useState(false);
  const [visFlytBytteBekreft, setVisFlytBytteBekreft] = useState<{
    flytId: string;
    flytNavn: string;
  } | null>(null);

  const ledd = useMemo(
    () => byggLedd(tilgjengeligeFlyter?.gjeldende?.medlemmer ?? []),
    [tilgjengeligeFlyter],
  );
  const brukersStegIdx = useMemo(() => {
    const steg = tilgjengeligeFlyter?.gjeldende?.brukersBoks?.steg;
    if (steg === undefined) return -1;
    return ledd.findIndex((l) => l.steg === steg);
  }, [ledd, tilgjengeligeFlyter]);

  // ⋯-admin-menyens synlighet: kun sitedoc/prosjekt-admin (adminNiva != null). Firma-admin
  // (null) mister fantom-menyen (Kloss 2); vanlige roller uendret.
  const erAdmin = adminNiva != null;

  // Tilgjengelige statushandlinger for brukerens rolle + nåværende status
  const statusHandlinger = useMemo(
    () => hentRolleFiltrertHandlinger(status, minRolle, adminNiva ?? null),
    [status, minRolle, adminNiva],
  );

  // Filtrer statushandlinger til de som er meningsfulle for "tap på boks":
  // ekskluder admin-handlinger (Lukk, Gjenåpne, Trekk tilbake) som tilhører ⋯-meny.
  const ADMIN_STATUSER = new Set(["closed", "cancelled", "draft"]);
  const boksStatusHandlinger = useMemo(
    () => statusHandlinger.filter((h) => !ADMIN_STATUSER.has(h.nyStatus as string)),
    [statusHandlinger],
  );

  const adminHandlinger = useMemo(
    () => statusHandlinger.filter((h) => ADMIN_STATUSER.has(h.nyStatus as string)),
    [statusHandlinger],
  );

  // Lesevisning — bruker uten rolle og flyt finnes
  if (minRolle === null && (tilgjengeligeFlyter?.gjeldende?.medlemmer.length ?? 0) > 0) {
    return null;
  }

  const valgtLedd = valgtBoksIdx !== null ? ledd[valgtBoksIdx] : null;

  function bekreftStatus(handling: StatusHandling, dokumentflytId?: string) {
    const label = t(handling.tekstNoekkel);
    const tekst = t("statushandling.bekreftSendBytte", { status: label });
    setVisBekreftelse({
      nyStatus: handling.nyStatus as string,
      label,
      mottaker: dokumentflytId ? { dokumentflytId } : undefined,
      bekreftelsesTekst: tekst,
    });
    setValgtBoksIdx(null);
    setVisAdminMeny(false);
  }

  function bekreftFlytBytte(flytId: string, flytNavn: string) {
    setVisFlytBytteBekreft({ flytId, flytNavn });
    setVisFlytBytte(false);
  }

  function utforHandling() {
    if (!visBekreftelse) return;
    onEndreStatus(visBekreftelse.nyStatus, kommentar.trim() || undefined, visBekreftelse.mottaker);
    setVisBekreftelse(null);
    setKommentar("");
  }

  function utforFlytBytte() {
    if (!visFlytBytteBekreft) return;
    onEndreStatus("forwarded", kommentar.trim() || undefined, {
      dokumentflytId: visFlytBytteBekreft.flytId,
    });
    setVisFlytBytteBekreft(null);
    setKommentar("");
  }

  // Vis ingen UI når flyt ikke eksisterer (eks. lese-bare dokumenter)
  if (!tilgjengeligeFlyter?.gjeldende && status !== "draft") {
    return null;
  }

  const harFlytBytte =
    tilgjengeligeFlyter?.kanFlytte === true && (tilgjengeligeFlyter.andre.length ?? 0) > 0;

  // Splitt bokser i to rader hvis ≥5
  const visRader: Array<Ledd[]> = ledd.length <= 4 ? [ledd] : delIToRader(ledd);

  return (
    <>
      <View className="flex-row items-center gap-2">
        {/* Boks-rad — alltid synlig */}
        <View className="flex-1">
          {visRader.map((rad, radIdx) => (
            <View key={radIdx} className="flex-row items-center gap-1 mb-1">
              {rad.map((l) => {
                const globalIdx = ledd.indexOf(l);
                const erBrukers = globalIdx === brukersStegIdx;
                const farge = l.farge ?? DEFAULT_FARGE;
                return (
                  <View key={globalIdx} className="flex-row items-center">
                    <Pressable
                      onPress={() => setValgtBoksIdx(globalIdx)}
                      disabled={erLaster}
                      style={{
                        width: BOKS_WIDTH,
                        height: BOKS_HEIGHT,
                        backgroundColor: farge,
                        borderRadius: 4,
                        borderWidth: erBrukers ? 3 : 0,
                        borderColor: "#1e40af",
                      }}
                    />
                    {globalIdx < ledd.length - 1 &&
                      !(radIdx < visRader.length - 1 && l === rad[rad.length - 1]) && (
                        <Text className="text-xs text-gray-400 mx-0.5">→</Text>
                      )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Flyt-bytte-knapp — kun for cross-flyt-medlemmer */}
        {harFlytBytte && (
          <Pressable
            onPress={() => setVisFlytBytte(true)}
            disabled={erLaster}
            className="flex-row items-center gap-1 rounded-lg border border-gray-200 px-2 py-2"
          >
            <Text className="text-xs text-gray-700">{t("dokumentflyt.byttFlyt")}</Text>
            <ChevronDown size={12} color="#374151" />
          </Pressable>
        )}

        {/* Admin-⋯-meny — kun for registrator/firma-admin */}
        {erAdmin && adminHandlinger.length > 0 && (
          <Pressable
            onPress={() => setVisAdminMeny(true)}
            disabled={erLaster}
            className="items-center justify-center rounded-lg border border-gray-200 px-2 py-2"
          >
            <MoreHorizontal size={16} color="#374151" />
          </Pressable>
        )}

        {/* Slett-knapp i draft/cancelled */}
        {onSlett && ["draft", "cancelled"].includes(status) && (
          <Pressable
            onPress={onSlett}
            disabled={erLaster}
            className="items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2"
          >
            <Text className="text-xs font-medium text-red-600">{t("handling.slett")}</Text>
          </Pressable>
        )}
      </View>

      {/* Boks-popup: medlemmer + tilgjengelige statuser */}
      <Modal
        visible={valgtLedd !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setValgtBoksIdx(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setValgtBoksIdx(null)}
        >
          <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
            {valgtLedd && (
              <>
                <View
                  className="mb-3 self-start rounded px-2 py-0.5"
                  style={{ backgroundColor: valgtLedd.farge ?? DEFAULT_FARGE }}
                >
                  <Text className="text-xs font-semibold text-white">{valgtLedd.navn}</Text>
                </View>

                {/* Medlemmer */}
                <ScrollView className="mb-3 max-h-40">
                  {valgtLedd.medlemmer.map((m) => {
                    const navn =
                      m.projectMember?.user.name ??
                      m.group?.name ??
                      m.faggruppe?.name ??
                      "?";
                    return (
                      <View
                        key={m.id ?? `${m.rolle}-${m.steg}-${navn}`}
                        className="flex-row items-center gap-2 py-1"
                      >
                        {m.erHovedansvarlig && (
                          <Star size={12} color="#f59e0b" fill="#f59e0b" />
                        )}
                        <Text className="text-sm text-gray-800">{navn}</Text>
                        <Text className="text-xs text-gray-400">({t(`dokumentflyt.${m.rolle}`)})</Text>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Tilgjengelige statushandlinger */}
                <View className="gap-2">
                  {boksStatusHandlinger.length === 0 ? (
                    <Text className="text-sm italic text-gray-500">
                      {t("dokumentflyt.ingenHandlinger")}
                    </Text>
                  ) : (
                    boksStatusHandlinger.map((h) => (
                      <Pressable
                        key={h.nyStatus}
                        onPress={() => bekreftStatus(h)}
                        disabled={erLaster}
                        className={`items-center rounded-lg py-3 ${h.farge}`}
                      >
                        <Text className="font-medium text-white">{t(h.tekstNoekkel)}</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Flyt-bytte-dropdown */}
      <Modal
        visible={visFlytBytte}
        transparent
        animationType="fade"
        onRequestClose={() => setVisFlytBytte(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setVisFlytBytte(false)}
        >
          <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
            <Text className="mb-3 text-sm font-semibold text-gray-700">
              {t("dokumentflyt.velgFlyt")}
            </Text>
            <ScrollView className="max-h-80">
              {(tilgjengeligeFlyter?.andre ?? []).map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => bekreftFlytBytte(f.id, f.faggruppe?.name ?? f.name)}
                  className="flex-row items-center gap-2 border-b border-gray-100 py-3"
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      backgroundColor: f.faggruppe?.color ?? DEFAULT_FARGE,
                      borderRadius: 3,
                    }}
                  />
                  <Text className="flex-1 text-sm text-gray-800">
                    {f.faggruppe?.name ?? f.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Flyt-bytte-bekreftelse */}
      <Modal
        visible={visFlytBytteBekreft !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVisFlytBytteBekreft(null)}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable className="flex-1" onPress={() => setVisFlytBytteBekreft(null)} />
          <View className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
            <Text className="mb-2 text-sm font-semibold text-gray-700">
              {t("dokumentflyt.bekreftFlytBytte", {
                gammel: tilgjengeligeFlyter?.gjeldende?.faggruppe?.name ?? tilgjengeligeFlyter?.gjeldende?.name ?? "",
                ny: visFlytBytteBekreft?.flytNavn ?? "",
              })}
            </Text>
            <Text className="mb-3 text-xs text-gray-500">
              {t("dokumentflyt.bekreftFlytBytteHjelp")}
            </Text>
            <TextInput
              value={kommentar}
              onChangeText={setKommentar}
              placeholder={t("statushandling.valgfriKommentar")}
              placeholderTextColor="#9ca3af"
              className="mb-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800"
              autoFocus
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={utforFlytBytte}
                disabled={erLaster}
                className={`flex-1 items-center rounded-lg py-3 ${erLaster ? "bg-blue-400" : "bg-blue-600"}`}
              >
                <Text className="font-medium text-white">
                  {erLaster ? t("statushandling.endrer") : t("handling.bekreft")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setVisFlytBytteBekreft(null); setKommentar(""); }}
                className="items-center rounded-lg border border-gray-200 px-6 py-3"
              >
                <Text className="font-medium text-gray-600">{t("handling.avbryt")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin-meny */}
      <Modal
        visible={visAdminMeny}
        transparent
        animationType="fade"
        onRequestClose={() => setVisAdminMeny(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setVisAdminMeny(false)}
        >
          <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
            <Text className="mb-3 text-sm font-semibold text-gray-700">
              {t("dokumentflyt.adminHandlinger")}
            </Text>
            {adminHandlinger.map((h) => (
              <Pressable
                key={h.nyStatus}
                onPress={() => bekreftStatus(h)}
                disabled={erLaster}
                className="border-b border-gray-100 py-3"
              >
                <Text className="text-base text-gray-800">{t(h.tekstNoekkel)}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Status-bekreftelses-modal */}
      <Modal
        visible={visBekreftelse !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVisBekreftelse(null)}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable className="flex-1" onPress={() => setVisBekreftelse(null)} />
          <View className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
            <Text className="mb-3 text-sm font-semibold text-gray-700">
              {visBekreftelse?.bekreftelsesTekst}
            </Text>
            <TextInput
              value={kommentar}
              onChangeText={setKommentar}
              placeholder={t("statushandling.valgfriKommentar")}
              placeholderTextColor="#9ca3af"
              className="mb-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={utforHandling}
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={utforHandling}
                disabled={erLaster}
                className={`flex-1 items-center rounded-lg py-3 ${erLaster ? "bg-blue-400" : "bg-blue-600"}`}
              >
                <Text className="font-medium text-white">
                  {erLaster ? t("statushandling.endrer") : t("handling.bekreft")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setVisBekreftelse(null); setKommentar(""); }}
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

function delIToRader(ledd: Ledd[]): Array<Ledd[]> {
  const midt = Math.ceil(ledd.length / 2);
  return [ledd.slice(0, midt), ledd.slice(midt)];
}
