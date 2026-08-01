/**
 * Handlingslinje (M2) for mobilens detaljskjermer — P3-mønster (speiler web).
 *
 * Én primærhandling (kildens `erPrimaer`, ellers første lovlige) som full-bredde-knapp
 * med retningsnavn («Send til [neste ledd]» / «Besvar til [forrige ledd]»), + et
 * split-▾-segment som åpner ÉN sheet med ALLE øvrige lovlige handlinger fra
 * `hentRolleFiltrertHandlinger`:
 *   framover → Lagre og lukk → destruktive (Avvis, rød) → Videresend → Bytt flyt → Admin.
 *
 * «Lagre utfylling» er demotert: autolagring dekker persistering, så baren viser kun
 * «Lagret automatisk HH:MM ✓»-mikrotekst, og «Lagre og lukk» bor i split-sheeten.
 *
 * Påkrevd-validering (fabel 2026-07-30): framover-primær (Send/Besvar) deaktiveres med
 * caption «X påkrevde felt gjenstår» når felt mangler — KUN framover; «Lagre og lukk»
 * og autolagring validerer aldri. Feltmarkeringen (`valideringsfeil`) er veiviseren,
 * captionen er telleren.
 *
 * Ingen server-/statusmaskin-/ledd-logikk her. Delte kilder: `hentRolleFiltrertHandlinger`,
 * `statusKreverBegrunnelse`, `byggLedd`/`finnAktivtIndex`. Felles komponent for begge skjermer.
 */

import { useMemo, useState } from "react";
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
import { ChevronDown, Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  hentPosisjonFiltrertHandlinger,
  statusKreverBegrunnelse,
  type StatusHandling,
  type DokumentflytRolle,
  type AdminNiva,
} from "@sitedoc/shared";
import { byggLedd, finnAktivtIndex, type FlytMedlem } from "../utils/dokumentflyt-ledd";

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
  adminNiva?: AdminNiva;
  /** Steg 4b: posisjon-baserte retningsrettigheter (klient-handlingsfilter = server). */
  retningsrett?: { kanSende: boolean; kanBesvare: boolean; kanVideresende: boolean; kanTerminere: boolean };
  harBallen?: boolean;
  /** § 2.4: medlem av avsenderleddet (forrigeBallLedд) — for «Trekk tilbake» (received→draft). */
  erAvsender?: boolean;
  /** § 2.4: medlem av NOEN ledд i flyten — for «Gjenåpne» (terminal→draft). */
  erMedlemAvFlyt?: boolean;
  /** P2 (tom-besvarelse): «Besvar» deaktivert fordi besvarelsen er tom. Speiler serveren. */
  besvarDeaktivertGrunn?: string | null;
  /** Flytmedlemmer for retningsnavn (neste/forrige ledd) — samme kilde som flytlinjen. */
  medlemmer: FlytMedlem[];
  /** Aktivt ledd = dokumentets `aktivPosisjon` (server-fakta). */
  aktivPosisjon?: number | null;
  /** Antall gjenstående påkrevde felt. >0 → framover-primær deaktivert + caption. */
  paakrevdeFeltGjenstaar?: number;
  /** Er dokumentet redigerbart? Styrer «Lagre og lukk» + autolagret-mikrotekst. */
  erRedigerbar: boolean;
  /** «Lagret automatisk HH:MM ✓» — ferdig formatert av skjermen, eller null. */
  sisteLagretTekst?: string | null;
  /** Sekundær «Lagre og lukk» (validering + lukk). Bor i split-sheeten. */
  onLagreOgLukk?: () => void;
}

const ADMIN_STATUSER = new Set(["closed", "cancelled", "draft"]);
const DEFAULT_FARGE = "#9ca3af";

// Literal fargeklasser (NativeWind kompilerer kun klasse-literaler som finnes i kilden).
const PRIMÆR_FARGE: Record<string, string> = {
  "bg-blue-600": "bg-blue-600",
  "bg-purple-600": "bg-purple-600",
  "bg-green-600": "bg-green-600",
  "bg-amber-500": "bg-amber-500",
  "bg-gray-500": "bg-gray-500",
  "bg-red-600": "bg-red-600",
};

const erDestruktivNy = (ns: string) => ns === "deleted" || ns === "dismissed";

export function DokumentHandlingslinje({
  status,
  erLaster,
  onEndreStatus,
  onSlett,
  tilgjengeligeFlyter,
  minRolle,
  adminNiva,
  retningsrett,
  harBallen,
  erAvsender,
  erMedlemAvFlyt,
  besvarDeaktivertGrunn,
  medlemmer,
  aktivPosisjon,
  paakrevdeFeltGjenstaar,
  erRedigerbar,
  sisteLagretTekst,
  onLagreOgLukk,
}: Props) {
  const { t } = useTranslation();
  const [visSplit, setVisSplit] = useState(false);
  const [visBekreftelse, setVisBekreftelse] = useState<{
    nyStatus: string;
    label: string;
    mottaker?: Mottaker;
    bekreftelsesTekst: string;
  } | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [visFlytBytte, setVisFlytBytte] = useState(false);
  const [visFlytBytteBekreft, setVisFlytBytteBekreft] = useState<{
    flytId: string;
    flytNavn: string;
  } | null>(null);

  const ledd = useMemo(() => byggLedd(medlemmer), [medlemmer]);
  const aktivtIndex = useMemo(
    () => finnAktivtIndex(ledd, aktivPosisjon),
    [ledd, aktivPosisjon],
  );

  const erAdmin = adminNiva != null;

  // Steg 4b (retning B): posisjon-basert handlingsfilter — klienten viser det serveren autoriserer.
  const statusHandlinger = useMemo(
    () =>
      hentPosisjonFiltrertHandlinger(status, {
        retningsrett: retningsrett ?? { kanSende: false, kanBesvare: false, kanVideresende: false, kanTerminere: false },
        harBallen: harBallen ?? false,
        erAvsender: erAvsender ?? false,
        erMedlemAvFlyt: erMedlemAvFlyt ?? false,
        erAdmin,
      }),
    [status, retningsrett, harBallen, erAvsender, erMedlemAvFlyt, erAdmin],
  );

  // Primær: kildens `erPrimaer`, ellers første lovlige (P3). Steg 4c: Send fra SISTE ledд
  // (nesteLedд=null) er no-op → primær blir Godkjenn (fabel-design 2, «Godkjenn og fullfør»).
  const primærHandling = useMemo(() => {
    const p = statusHandlinger.find((h) => h.erPrimaer) ?? statusHandlinger[0] ?? null;
    if (p?.nyStatus === "sent" && aktivtIndex >= 0 && !ledd[aktivtIndex + 1]) {
      return statusHandlinger.find((h) => h.nyStatus === "approved") ?? p;
    }
    return p;
  }, [statusHandlinger, ledd, aktivtIndex]);

  // Kategoriser øvrige (ikke-primær) handlinger til split-sheetens seksjoner.
  const øvrige = statusHandlinger.filter((h) => h !== primærHandling);
  const framoverHandlinger = øvrige.filter(
    (h) => !ADMIN_STATUSER.has(h.nyStatus as string) && h.nyStatus !== "forwarded" && !erDestruktivNy(h.nyStatus as string),
  );
  const destruktivHandlinger = øvrige.filter((h) => erDestruktivNy(h.nyStatus as string));
  const videresendHandlinger = øvrige.filter((h) => h.nyStatus === "forwarded");
  const adminHandlinger = erAdmin
    ? øvrige.filter((h) => ADMIN_STATUSER.has(h.nyStatus as string) && h.nyStatus !== "forwarded")
    : [];

  const harFlytBytte =
    tilgjengeligeFlyter?.kanFlytte === true && (tilgjengeligeFlyter.andre.length ?? 0) > 0;
  const lagreOgLukkTilgjengelig = erRedigerbar && !!onLagreOgLukk;

  const harMeny =
    framoverHandlinger.length > 0 ||
    destruktivHandlinger.length > 0 ||
    videresendHandlinger.length > 0 ||
    adminHandlinger.length > 0 ||
    harFlytBytte ||
    lagreOgLukkTilgjengelig;

  // --- Lese-/tomvisning ---
  if (minRolle === null && medlemmer.length > 0) return null;
  if (!tilgjengeligeFlyter?.gjeldende && status !== "draft") return null;
  if (!primærHandling && !harMeny) return null;

  // --- Primær-navngiving med retning (fra byggLedd — ingen ny ledd-logikk) ---
  const sisteLedd = ledd.length > 1 && aktivtIndex === ledd.length - 1;
  const primærLabel = (h: StatusHandling): string => {
    if (h.nyStatus === "sent") {
      const neste = ledd[aktivtIndex + 1];
      // Steg 4c: «Send til N · X →» (måll-leddets nummer + hvem).
      return neste ? t("statushandling.sendTil", { mottaker: `${neste.posisjon} · ${neste.navn}` }) : t(h.tekstNoekkel);
    }
    if (h.nyStatus === "responded") {
      const forrige = ledd[aktivtIndex - 1]?.navn;
      return forrige ? t("statushandling.besvarTil", { mottaker: forrige }) : t(h.tekstNoekkel);
    }
    // Siste ledд-godkjenn (Send-substitutt ELLER godkjenner på siste ledд) → «Godkjenn og fullfør ✓».
    if (h.nyStatus === "approved" && sisteLedd) return t("flyt.godkjennOgFullfor");
    return t(h.tekstNoekkel);
  };

  // Bekreftelses-sheetens tekst speiler primærens retningsnavn (samme neste/forrige-
  // utledning som `primærLabel`). Fallback til bekreftSendBytte KUN når ett-stegs
  // (ingen neste/forrige ledd) eller andre handlinger enn Send/Besvar.
  const bekreftelsesTekstFor = (h: StatusHandling): string => {
    const label = t(h.tekstNoekkel);
    if (h.nyStatus === "sent") {
      const neste = ledd[aktivtIndex + 1]?.navn;
      return neste
        ? t("statushandling.bekreftSendTil", { mottaker: neste })
        : t("statushandling.bekreftSendBytte", { status: label });
    }
    if (h.nyStatus === "responded") {
      const forrige = ledd[aktivtIndex - 1]?.navn;
      return forrige
        ? t("statushandling.bekreftBesvarTil", { mottaker: forrige })
        : t("statushandling.bekreftSendBytte", { status: label });
    }
    return t("statushandling.bekreftSendBytte", { status: label });
  };

  // --- Primær deaktivering + caption ---
  const primærFramover =
    primærHandling?.nyStatus === "sent" || primærHandling?.nyStatus === "responded";
  const paakrevdBlokkert = !!primærFramover && (paakrevdeFeltGjenstaar ?? 0) > 0;
  const besvarBlokkert =
    primærHandling?.nyStatus === "responded" && !!besvarDeaktivertGrunn;
  const primærDeaktivert = erLaster || paakrevdBlokkert || besvarBlokkert;

  const caption: string | null = paakrevdBlokkert
    ? t("dokument.paakrevdeFeltGjenstaar", { count: paakrevdeFeltGjenstaar ?? 0 })
    : besvarBlokkert
      ? besvarDeaktivertGrunn ?? null
      : sisteLagretTekst ?? null;
  const captionErAdvarsel = paakrevdBlokkert || besvarBlokkert;

  // --- Handlinger ---
  function åpneBekreftelse(handling: StatusHandling, dokumentflytId?: string) {
    setVisSplit(false);
    const label = t(handling.tekstNoekkel);
    setVisBekreftelse({
      nyStatus: handling.nyStatus as string,
      label,
      mottaker: dokumentflytId ? { dokumentflytId } : undefined,
      bekreftelsesTekst: bekreftelsesTekstFor(handling),
    });
  }

  function velgHandling(handling: StatusHandling) {
    // «Slett» (deleted) er ikke en server-status — rutes til onSlett (skjermens bekreftelse).
    if (handling.nyStatus === "deleted") {
      setVisSplit(false);
      onSlett?.();
      return;
    }
    åpneBekreftelse(handling);
  }

  function klikkPrimær() {
    if (!primærHandling || primærDeaktivert) return;
    velgHandling(primærHandling);
  }

  function utforHandling() {
    if (!visBekreftelse) return;
    // Avvis (dismissed) krever ikke-tom begrunnelse (speiler server-Zod, delt kilde).
    if (statusKreverBegrunnelse(visBekreftelse.nyStatus) && !kommentar.trim()) return;
    onEndreStatus(visBekreftelse.nyStatus, kommentar.trim() || undefined, visBekreftelse.mottaker);
    setVisBekreftelse(null);
    setKommentar("");
  }

  function bekreftFlytBytte(flytId: string, flytNavn: string) {
    setVisFlytBytte(false);
    setVisFlytBytteBekreft({ flytId, flytNavn });
  }

  function utforFlytBytte() {
    if (!visFlytBytteBekreft) return;
    onEndreStatus("forwarded", kommentar.trim() || undefined, {
      dokumentflytId: visFlytBytteBekreft.flytId,
    });
    setVisFlytBytteBekreft(null);
    setKommentar("");
  }

  const primærFargeKlasse = primærHandling
    ? PRIMÆR_FARGE[primærHandling.farge] ?? "bg-blue-600"
    : "bg-blue-600";

  return (
    <>
      {/* Caption / autolagret-mikrotekst */}
      {caption && (
        <View className="mb-1.5 flex-row items-center justify-center gap-1">
          {!captionErAdvarsel && <Check size={12} color="#16a34a" />}
          <Text
            className={`text-xs ${captionErAdvarsel ? "text-amber-600" : "text-gray-400"}`}
          >
            {caption}
          </Text>
        </View>
      )}

      {/* Primærknapp + split-▾ */}
      <View className="flex-row items-stretch gap-px">
        {primærHandling ? (
          <>
            <Pressable
              onPress={klikkPrimær}
              disabled={primærDeaktivert}
              className={`flex-1 items-center justify-center py-3 ${primærFargeKlasse} ${primærDeaktivert ? "opacity-50" : ""} ${harMeny ? "rounded-l-lg" : "rounded-lg"}`}
            >
              <Text className="text-base font-semibold text-white">
                {erLaster ? t("statushandling.endrer") : primærLabel(primærHandling)}
              </Text>
            </Pressable>
            {harMeny && (
              <Pressable
                onPress={() => setVisSplit(true)}
                disabled={erLaster}
                accessibilityLabel={t("statushandling.flereHandlinger")}
                className={`items-center justify-center rounded-r-lg px-3 ${primærFargeKlasse} ${erLaster ? "opacity-50" : ""}`}
                style={{ borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.3)" }}
              >
                <ChevronDown size={18} color="#ffffff" />
              </Pressable>
            )}
          </>
        ) : (
          // Ingen primær (f.eks. redigerbar uten framover-handling): alt bak én knapp.
          harMeny && (
            <Pressable
              onPress={() => setVisSplit(true)}
              disabled={erLaster}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-gray-300 py-3"
            >
              <Text className="text-sm font-medium text-gray-700">
                {t("statushandling.flereHandlinger")}
              </Text>
              <ChevronDown size={16} color="#374151" />
            </Pressable>
          )
        )}
      </View>

      {/* Split-sheet: alle øvrige lovlige handlinger (fabel-rekkefølge) */}
      <Modal
        visible={visSplit}
        transparent
        animationType="slide"
        onRequestClose={() => setVisSplit(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setVisSplit(false)}>
          <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-3" onPress={() => {}}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-800">
                {t("statushandling.handlingerTittel")}
              </Text>
              <Pressable
                onPress={() => setVisSplit(false)}
                hitSlop={8}
                className="flex-row items-center gap-1"
              >
                <Text className="text-sm font-medium text-gray-500">{t("flytlinje.lukk")}</Text>
                <X size={18} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {/* Framover */}
              {framoverHandlinger.map((h) => (
                <MenyRad key={`fram-${h.nyStatus}`} label={t(h.tekstNoekkel)} onPress={() => velgHandling(h)} />
              ))}

              {/* Lagre og lukk */}
              {lagreOgLukkTilgjengelig && (
                <MenyRad
                  label={t("handling.lagreOgLukk")}
                  onPress={() => {
                    setVisSplit(false);
                    onLagreOgLukk?.();
                  }}
                />
              )}

              {/* Destruktive (Avvis / Slett — rød) */}
              {destruktivHandlinger.map((h) => (
                <MenyRad
                  key={`dest-${h.nyStatus}`}
                  label={t(h.tekstNoekkel)}
                  destruktiv
                  onPress={() => velgHandling(h)}
                />
              ))}

              {/* Videresend */}
              {videresendHandlinger.map((h) => (
                <MenyRad key={`vid-${h.nyStatus}`} label={t(h.tekstNoekkel)} onPress={() => velgHandling(h)} />
              ))}

              {/* Bytt flyt */}
              {harFlytBytte && (
                <MenyRad
                  label={t("dokumentflyt.byttFlyt")}
                  onPress={() => {
                    setVisSplit(false);
                    setVisFlytBytte(true);
                  }}
                />
              )}

              {/* Admin-handlinger */}
              {adminHandlinger.length > 0 && (
                <>
                  <Text className="mb-1 mt-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {t("dokumentflyt.adminHandlinger")}
                  </Text>
                  {adminHandlinger.map((h) => (
                    <MenyRad key={`adm-${h.nyStatus}`} label={t(h.tekstNoekkel)} onPress={() => velgHandling(h)} />
                  ))}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Flyt-bytte-velger */}
      <Modal
        visible={visFlytBytte}
        transparent
        animationType="fade"
        onRequestClose={() => setVisFlytBytte(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setVisFlytBytte(false)}>
          <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-4" onPress={() => {}}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-700">{t("dokumentflyt.velgFlyt")}</Text>
              <Pressable
                onPress={() => setVisFlytBytte(false)}
                hitSlop={8}
                className="flex-row items-center gap-1"
              >
                <Text className="text-sm font-medium text-gray-500">{t("flytlinje.lukk")}</Text>
                <X size={18} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
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
                  <Text className="flex-1 text-sm text-gray-800">{f.faggruppe?.name ?? f.name}</Text>
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
                gammel:
                  tilgjengeligeFlyter?.gjeldende?.faggruppe?.name ??
                  tilgjengeligeFlyter?.gjeldende?.name ??
                  "",
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
                onPress={() => {
                  setVisFlytBytteBekreft(null);
                  setKommentar("");
                }}
                className="items-center rounded-lg border border-gray-200 px-6 py-3"
              >
                <Text className="font-medium text-gray-600">{t("handling.avbryt")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Status-bekreftelse (kommentar-inngangen — ikke dobbel bekreftelse) */}
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
          {(() => {
            const paakrevd = visBekreftelse ? statusKreverBegrunnelse(visBekreftelse.nyStatus) : false;
            const manglerBegrunnelse = paakrevd && kommentar.trim().length === 0;
            return (
              <View className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
                <Text className="mb-3 text-sm font-semibold text-gray-700">
                  {paakrevd ? t("statushandling.begrunnelsePaakrevd") : visBekreftelse?.bekreftelsesTekst}
                </Text>
                <TextInput
                  value={kommentar}
                  onChangeText={setKommentar}
                  placeholder={
                    paakrevd
                      ? t("statushandling.begrunnelsePlaceholder")
                      : t("statushandling.valgfriKommentar")
                  }
                  placeholderTextColor="#9ca3af"
                  className="mb-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={utforHandling}
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={utforHandling}
                    disabled={erLaster || manglerBegrunnelse}
                    className={`flex-1 items-center rounded-lg py-3 ${erLaster || manglerBegrunnelse ? "bg-blue-400" : "bg-blue-600"}`}
                  >
                    <Text className="font-medium text-white">
                      {erLaster ? t("statushandling.endrer") : t("handling.bekreft")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setVisBekreftelse(null);
                      setKommentar("");
                    }}
                    className="items-center rounded-lg border border-gray-200 px-6 py-3"
                  >
                    <Text className="font-medium text-gray-600">{t("handling.avbryt")}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Meny-rad i split-sheeten                                           */
/* ------------------------------------------------------------------ */

function MenyRad({
  label,
  onPress,
  destruktiv,
}: {
  label: string;
  onPress: () => void;
  destruktiv?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="border-b border-gray-100 py-3">
      <Text className={`text-base ${destruktiv ? "text-red-600" : "text-gray-800"}`}>{label}</Text>
    </Pressable>
  );
}
