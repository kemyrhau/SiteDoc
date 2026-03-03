import { useRef, useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, Modal, Animated } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Accelerometer } from "expo-sensors";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface KameraModalProps {
  synlig: boolean;
  onBilde: (uri: string) => void;
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
function beregnOrientering(x: number, y: number): Orientering {
  // x > terskel → telefonen er vippet til venstre (hjem-knapp til høyre)
  // x < -terskel → telefonen er vippet til høyre (hjem-knapp til venstre)
  // ellers → portrett
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

export function KameraModal({ synlig, onBilde, onLukk }: KameraModalProps) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [tillatelse, spørOmTillatelse] = useCameraPermissions();
  const tarBilde = useRef(false);
  const [antallTatt, settAntallTatt] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [kameraLayout, setKameraLayout] = useState({ bredde: 0, hoyde: 0 });
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [orientering, setOrientering] = useState<Orientering>("portrett");
  const rotasjon = useRef(new Animated.Value(0)).current;

  // Lytt på akselerometer kun når kameraet er åpent
  useEffect(() => {
    if (!synlig) return;

    Accelerometer.setUpdateInterval(300);
    const abonnement = Accelerometer.addListener(({ x, y }) => {
      const ny = beregnOrientering(x, y);
      setOrientering((forrige) => {
        if (forrige === ny) return forrige;
        // Animer rotasjon av UI-elementer
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

  const håndterTaBilde = useCallback(async () => {
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
        skipProcessing: true,
      });
      if (foto?.uri) {
        settAntallTatt((n) => n + 1);
        onBilde(foto.uri);
      }
    } finally {
      tarBilde.current = false;
    }
  }, [onBilde, flashOpacity]);

  const håndterLukk = useCallback(() => {
    settAntallTatt(0);
    setZoom(0);
    setOrientering("portrett");
    rotasjon.setValue(0);
    onLukk();
  }, [onLukk, rotasjon]);

  // Beregn 5:4 crop-guide basert på kameravisningens faktiske layout
  const { bredde, hoyde } = kameraLayout;
  let overlayTopp = 0;
  let overlaySide = 0;
  if (bredde > 0 && hoyde > 0) {
    if (orientering === "portrett") {
      // Portrett: bredde < høyde → crop topp/bunn
      const cropHoyde = bredde / MAL_FORHOLD;
      overlayTopp = Math.max(0, (hoyde - cropHoyde) / 2);
    } else {
      // Landskapsmodus (telefon på siden): bredde < høyde fysisk,
      // men bildet vil bli 5:4 landscape etter crop.
      // Vis 4:5-guide (invertert) i portrettvisningen som representerer
      // et landskapsbilde rotert 90 grader.
      const landskapForhold = 4 / 5; // invertert fordi skjermen er portrett
      const cropHoyde = bredde / landskapForhold;
      if (cropHoyde <= hoyde) {
        overlayTopp = Math.max(0, (hoyde - cropHoyde) / 2);
      } else {
        const cropBredde = hoyde * landskapForhold;
        overlaySide = Math.max(0, (bredde - cropBredde) / 2);
      }
    }
  }

  if (!synlig) return null;

  if (!tillatelse?.granted) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen">
        <View className="flex-1 items-center justify-center bg-black" style={{ paddingTop: insets.top }}>
          <Text className="mb-4 text-base text-white">Kameratilgang kreves</Text>
          <Pressable
            onPress={spørOmTillatelse}
            className="rounded-lg bg-blue-600 px-6 py-3"
          >
            <Text className="font-medium text-white">Gi tilgang</Text>
          </Pressable>
          <Pressable onPress={håndterLukk} className="mt-4 px-6 py-3">
            <Text className="text-gray-400">Avbryt</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          zoom={zoom}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setKameraLayout((prev) =>
              prev.bredde === width && prev.hoyde === height
                ? prev
                : { bredde: width, hoyde: height },
            );
          }}
        >
          {/* 5:4 crop-guide — mørke overlay */}
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
            style={{ ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff" }), opacity: flashOpacity }}
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

          {/* Bildeteller — roterer med enhetens orientering */}
          {antallTatt > 0 && (
            <Animated.View
              style={[
                { position: "absolute", right: 16, zIndex: 10, top: insets.top + 12 },
                uiRotasjon,
              ]}
            >
              <View className="rounded-full bg-blue-600 px-3 py-1.5">
                <Text className="text-sm font-semibold text-white">{antallTatt}</Text>
              </View>
            </Animated.View>
          )}
        </CameraView>

        {/* Zoomknapper + Utløserknapp */}
        <View
          className="items-center justify-center bg-black px-4"
          style={{ paddingBottom: insets.bottom + 4, paddingTop: 4 }}
        >
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

          {/* Utløserknapp */}
          <Pressable
            onPress={håndterTaBilde}
            className="h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white"
          >
            <View className="h-[58px] w-[58px] rounded-full bg-white" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
