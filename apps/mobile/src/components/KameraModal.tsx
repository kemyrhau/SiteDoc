import { useRef, useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, Modal, Animated, InteractionManager, Image, ScrollView } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Accelerometer } from "expo-sensors";
import { X, Timer, Flashlight, FlashlightOff, Pencil } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { BildeAnnotering } from "./BildeAnnotering";

/** Et bilde tatt i denne kameraøkta — kobling til vedlegget + stien som vises/annoteres. */
interface OktBilde {
  vedleggId: string;
  /** Lokal sti som vises i miniatyren og åpnes i annoteringen (annotert versjon etter redigering). */
  uri: string;
  annotert: boolean;
}

interface KameraModalProps {
  synlig: boolean;
  /** Tar bildet, legger det til som vedlegg og returnerer koblingen (vedleggId + lokal sti),
   *  eller null hvis noe feilet. */
  onBilde: (uri: string) => Promise<{ vedleggId: string; uri: string } | null>;
  /** Annoterer et bilde tatt i økta — erstatter vedlegget ikke-destruktivt (samme vedleggId). */
  onAnnoterBilde: (vedleggId: string, annotertUri: string) => Promise<void>;
  onLukk: () => void;
}

const ZOOM_NIVÅER = [
  { label: "0.5x", verdi: 0 },
  { label: "1x", verdi: 0.05 },
  { label: "3x", verdi: 0.15 },
] as const;

const MAL_FORHOLD = 5 / 4; // bredde:høyde

type Orientering = "portrett" | "landskapVenstre" | "landskapHoyre";

/** Bestem enhetens fysiske orientering fra akselerometerdata */
function beregnOrientering(x: number, _y: number): Orientering {
  const terskel = 0.55;
  if (x > terskel) return "landskapVenstre";
  if (x < -terskel) return "landskapHoyre";
  return "portrett";
}

/** Rotasjonsgrad for UI-elementer basert på orientering */
function orienteringTilGrader(orientering: Orientering): number {
  switch (orientering) {
    case "landskapVenstre": return -90;
    case "landskapHoyre": return 90;
    default: return 0;
  }
}

export function KameraModal({ synlig, onBilde, onAnnoterBilde, onLukk }: KameraModalProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [tillatelse, spørOmTillatelse] = useCameraPermissions();
  const tarBilde = useRef(false);
  // Del 3: bildene tatt i denne økta (nyeste først) — miniatyrstripe + annoter-kobling.
  const [øktBilder, settØktBilder] = useState<OktBilde[]>([]);
  // Del 2: bildet som annoteres akkurat nå (åpner BildeAnnotering oppå kameraet), eller null.
  const [annoterMål, settAnnoterMål] = useState<OktBilde | null>(null);
  const [zoom, setZoom] = useState(0);
  const [kameraLayout, setKameraLayout] = useState({ bredde: 0, hoyde: 0 });
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [orientering, setOrientering] = useState<Orientering>("portrett");
  const rotasjon = useRef(new Animated.Value(0)).current;
  const [tidtakerAktiv, setTidtakerAktiv] = useState(false);
  const [lykt, setLykt] = useState(false);
  const [nedtelling, setNedtelling] = useState(0);
  const tidtakerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref for onBilde — stabiliserer taBildeNå slik at den ikke gjenskapes ved prop-endringer
  const onBildeRef = useRef(onBilde);
  onBildeRef.current = onBilde;

  // Lytt på akselerometer kun når kameraet er åpent
  useEffect(() => {
    if (!synlig) return;

    Accelerometer.setUpdateInterval(300);
    const abonnement = Accelerometer.addListener(({ x, y }) => {
      const ny = beregnOrientering(x, y);
      setOrientering((forrige) => {
        if (forrige === ny) return forrige;
        Animated.spring(rotasjon, {
          toValue: orienteringTilGrader(ny),
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }).start();
        return ny;
      });
    });

    return () => abonnement.remove();
  }, [synlig, rotasjon]);

  // Beregn rotasjonstransform for UI-elementer
  const uiRotasjon = {
    transform: [{ rotate: rotasjon.interpolate({
      inputRange: [-90, 0, 90],
      outputRange: ["-90deg", "0deg", "90deg"],
    }) }],
  };

  const taBildeNå = useCallback(async () => {
    if (tarBilde.current || !cameraRef.current) return;
    tarBilde.current = true;
    try {
      flashOpacity.setValue(1);
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();

      const foto = await cameraRef.current.takePictureAsync({
        quality: 1,
      });
      if (foto?.uri) {
        // Vent til interaksjoner er ferdige før bildebehandling
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        // Prosesser i bakgrunnen og legg bildet i miniatyrstripen når vedleggId er klart —
        // blokker IKKE neste bildetaking (rask serie bevares). Flash-animasjonen gir
        // umiddelbar feedback; stripen fylles straks etter.
        onBildeRef.current(foto.uri).then((res) => {
          if (res) {
            settØktBilder((prev) => [{ vedleggId: res.vedleggId, uri: res.uri, annotert: false }, ...prev]);
          }
        });
      }
    } catch (e) {
      console.error("taBildeNå feilet:", e);
    } finally {
      tarBilde.current = false;
    }
  }, [flashOpacity]);

  const håndterTaBilde = useCallback(() => {
    if (nedtelling > 0) return;
    if (!tidtakerAktiv) {
      taBildeNå();
      return;
    }
    setNedtelling(2);
    tidtakerRef.current = setInterval(() => {
      setNedtelling((n) => {
        if (n <= 1) {
          if (tidtakerRef.current) clearInterval(tidtakerRef.current);
          tidtakerRef.current = null;
          taBildeNå();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }, [tidtakerAktiv, nedtelling, taBildeNå]);

  // Rydd opp tidtaker ved lukking
  useEffect(() => {
    if (!synlig && tidtakerRef.current) {
      clearInterval(tidtakerRef.current);
      tidtakerRef.current = null;
      setNedtelling(0);
    }
  }, [synlig]);

  // Resett state når kameraet lukkes
  useEffect(() => {
    if (!synlig) {
      settØktBilder([]);
      settAnnoterMål(null);
      setZoom(0);
      setLykt(false);
      setNedtelling(0);
      setOrientering("portrett");
      rotasjon.setValue(0);
    }
  }, [synlig, rotasjon]);

  const håndterLukk = useCallback(() => {
    if (tidtakerRef.current) {
      clearInterval(tidtakerRef.current);
      tidtakerRef.current = null;
    }
    // Vent til Modal-animasjonen er ferdig før state-oppdateringer
    InteractionManager.runAfterInteractions(() => {
      onLukk();
    });
  }, [onLukk]);

  // Del 2: «Ferdig» i annoteringen → erstatt vedlegget ikke-destruktivt, oppdater miniatyren
  // til den annoterte versjonen og gå tilbake til kameraet.
  const håndterAnnoterFerdig = useCallback(
    async (annotertUri: string) => {
      const mål = annoterMål;
      settAnnoterMål(null);
      if (!mål) return;
      settØktBilder((prev) =>
        prev.map((b) =>
          b.vedleggId === mål.vedleggId ? { ...b, uri: annotertUri, annotert: true } : b,
        ),
      );
      try {
        await onAnnoterBilde(mål.vedleggId, annotertUri);
      } catch (e) {
        console.error("Annoter kamerabilde feilet:", e);
      }
    },
    [annoterMål, onAnnoterBilde],
  );

  // Beregn 5:4 crop-guide basert på kameravisningens faktiske layout
  const { bredde, hoyde } = kameraLayout;
  let overlayTopp = 0;
  let overlaySide = 0;
  if (bredde > 0 && hoyde > 0) {
    if (orientering === "portrett") {
      const cropHoyde = bredde / MAL_FORHOLD;
      overlayTopp = Math.max(0, (hoyde - cropHoyde) / 2);
    } else {
      const landskapForhold = 4 / 5;
      const cropHoyde = bredde / landskapForhold;
      if (cropHoyde <= hoyde) {
        overlayTopp = Math.max(0, (hoyde - cropHoyde) / 2);
      } else {
        const cropBredde = hoyde * landskapForhold;
        overlaySide = Math.max(0, (bredde - cropBredde) / 2);
      }
    }
  }

  // ALLTID render <Modal> med visible-prop — ALDRI conditional mount/unmount.
  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="fullScreen" onRequestClose={håndterLukk}>
      {synlig && !tillatelse?.granted ? (
        <View className="flex-1 items-center justify-center bg-black" style={{ paddingTop: insets.top }}>
          <Text className="mb-4 text-base text-white">Kameratilgang kreves</Text>
          <Pressable
            onPress={spørOmTillatelse}
            className="rounded-lg bg-blue-600 px-6 py-3"
          >
            <Text className="font-medium text-white">Gi tilgang</Text>
          </Pressable>
          <Pressable onPress={håndterLukk} className="mt-4 px-6 py-3">
            <Text className="text-gray-400">{t("handling.avbryt")}</Text>
          </Pressable>
        </View>
      ) : synlig ? (
      <View className="flex-1 bg-black">
        {/* Kamera-seksjon med overlays som søsken (CameraView støtter ikke barn) */}
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setKameraLayout((prev) =>
              prev.bredde === width && prev.hoyde === height
                ? prev
                : { bredde: width, hoyde: height },
            );
          }}
        >
          {/* CameraView uten barn */}
          <CameraView
            ref={cameraRef}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            facing="back"
            zoom={zoom}
            enableTorch={lykt}
          />

          {/* 5:4 crop-guide — mørke overlay (over kamera) */}
          {overlayTopp > 0 && (
            <>
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: overlayTopp, backgroundColor: "rgba(0,0,0,0.5)" }}
              />
              <View
                pointerEvents="none"
                style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: overlayTopp, backgroundColor: "rgba(0,0,0,0.5)" }}
              />
              <View pointerEvents="none" style={{ position: "absolute", top: overlayTopp, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.4)" }} />
              <View pointerEvents="none" style={{ position: "absolute", bottom: overlayTopp, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.4)" }} />
            </>
          )}
          {overlaySide > 0 && (
            <>
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: overlaySide, backgroundColor: "rgba(0,0,0,0.5)" }}
              />
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: overlaySide, backgroundColor: "rgba(0,0,0,0.5)" }}
              />
              <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: overlaySide, width: 1, backgroundColor: "rgba(255,255,255,0.4)" }} />
              <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, right: overlaySide, width: 1, backgroundColor: "rgba(255,255,255,0.4)" }} />
            </>
          )}

          {/* Flash-overlay */}
          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff", opacity: flashOpacity }}
          />

          {/* Lukk-knapp — roterer med enhetens orientering */}
          <Animated.View
            style={[
              { position: "absolute", left: 16, zIndex: 10, top: insets.top + 8 },
              uiRotasjon,
            ]}
          >
            <Pressable
              onPress={håndterLukk}
              hitSlop={16}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
            >
              <X size={22} color="#ffffff" />
            </Pressable>
          </Animated.View>

          {/* Lommelykt-knapp */}
          <Animated.View
            style={[
              { position: "absolute", left: 72, zIndex: 10, top: insets.top + 8 },
              uiRotasjon,
            ]}
          >
            <Pressable
              onPress={() => setLykt((l) => !l)}
              hitSlop={16}
              className={`h-10 w-10 items-center justify-center rounded-full ${lykt ? "bg-yellow-400" : "bg-black/50"}`}
            >
              {lykt
                ? <Flashlight size={20} color="#000000" />
                : <FlashlightOff size={20} color="#ffffff" />
              }
            </Pressable>
          </Animated.View>

          {/* Nedtelling — stor tekst midt på kameraet */}
          {nedtelling > 0 && (
            <View
              pointerEvents="none"
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 96, fontWeight: "bold", color: "#ffffff", textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}>
                {nedtelling}
              </Text>
            </View>
          )}

          {/* Del 3 (Kenneth 2026-10-22): miniatyrstripe erstatter bildetelleren «1» —
              bildene tatt i økta, NYESTE FØRST. Trykk åpner «Annoter bilde» for det bildet;
              annoterte bilder viser den annoterte versjonen + en liten rediger-markør. */}
        </View>

        {/* Zoomknapper + Utløserknapp */}
        <View
          className="items-center justify-center bg-black px-4"
          style={{ paddingBottom: insets.bottom + 4, paddingTop: 4 }}
        >
          {/* Miniatyrstripe — over zoomvelgeren (Del 2+3). Urotert: hvert bilde bærer sin
              egen orientering. */}
          {øktBilder.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3 max-h-16 w-full"
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4, alignItems: "center" }}
            >
              {øktBilder.map((b) => (
                <Pressable
                  key={b.vedleggId}
                  onPress={() => settAnnoterMål(b)}
                  className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/40"
                  hitSlop={4}
                >
                  <Image source={{ uri: b.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  {/* Rediger-markør: trykk åpner annotering (på nytt hvis alt annotert). */}
                  <View className={`absolute bottom-0 right-0 items-center justify-center rounded-tl-md p-0.5 ${b.annotert ? "bg-blue-600" : "bg-black/60"}`}>
                    <Pencil size={11} color="#ffffff" />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {/* Zoomknapper — roterer med enhetens orientering */}
          <Animated.View style={[{ marginBottom: 64, flexDirection: "row", alignItems: "center", gap: 8 }, uiRotasjon]}>
            {ZOOM_NIVÅER.map((nivå) => {
              const erAktiv = zoom === nivå.verdi;
              return (
                <Pressable
                  key={nivå.label}
                  onPress={() => setZoom(nivå.verdi)}
                  className={`items-center justify-center rounded-full px-3 py-1 ${
                    erAktiv ? "bg-white" : "bg-white/20"
                  }`}
                  style={{ minWidth: 44, height: 30 }}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      erAktiv ? "text-black" : "text-white"
                    }`}
                  >
                    {nivå.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>

          {/* Utløserknapp — lang-trykk aktiverer/deaktiverer 2s tidtaker */}
          <View style={{ alignItems: "center" }}>
            <Pressable
              onPress={håndterTaBilde}
              onLongPress={() => setTidtakerAktiv((t) => !t)}
              delayLongPress={600}
              className="h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white"
            >
              <View className={`h-[58px] w-[58px] rounded-full ${tidtakerAktiv ? "bg-yellow-400" : "bg-white"}`} />
            </Pressable>
            {tidtakerAktiv && (
              <Animated.View style={[{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 }, uiRotasjon]}>
                <Timer size={14} color="#facc15" />
                <Text style={{ color: "#facc15", fontSize: 12, fontWeight: "600" }}>2s</Text>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Del 2: annotering oppå kameraet — samme komponent som feltvedlegg-annoteringen
            (ingen kopi). «Ferdig» erstatter vedlegget og går tilbake til kameraet; «Avbryt»
            lukker uten endring. Kameraet forblir montert under, så man er straks tilbake. */}
        {annoterMål && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
            <BildeAnnotering
              bildeUri={annoterMål.uri}
              onFerdig={håndterAnnoterFerdig}
              onAvbryt={() => settAnnoterMål(null)}
            />
          </View>
        )}
      </View>
      ) : null}
    </Modal>
  );
}
