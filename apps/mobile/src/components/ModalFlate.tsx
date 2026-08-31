import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Kant = "top" | "bottom";

/**
 * Rot-flate for modal-innhold. Padder fra useSafeAreaInsets(), IKKE fra <SafeAreaView>.
 *
 * Bakgrunn (målt 2026-08-31, iPhone 16 Plus / iOS 18.4): inne i en RN <Modal> gir
 * useSafeAreaInsets() riktige tall (top=59 / bottom=34), men <SafeAreaView> anvender
 * 0 padding. Resultatet er kontroller under Dynamic Island som ikke kan trykkes — det
 * låste brukere inne i bygg 46 (tegningsposisjon) og bygg 47 (tekstfelt).
 *
 * Bruk ALLTID denne i modaler. <SafeAreaView> er lint-forbudt i apps/mobile.
 *
 * `kanter` styrer hvilke insets som padder. Default begge. En modal med egen bunnlinje
 * (tab-bar, handlingslinje som selv padder) skal be om kun ["top"] — ellers dobbel luft.
 */
export function ModalFlate({
  children,
  kanter = ["top", "bottom"],
  className,
}: {
  children: ReactNode;
  kanter?: readonly Kant[];
  className?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={className}
      style={{
        flex: 1,
        paddingTop: kanter.includes("top") ? insets.top : 0,
        paddingBottom: kanter.includes("bottom") ? insets.bottom : 0,
      }}
    >
      {children}
    </View>
  );
}
