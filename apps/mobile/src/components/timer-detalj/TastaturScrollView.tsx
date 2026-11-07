import { forwardRef, type ReactNode } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

/**
 * Rulleflate for raddialogene (pageSheet-modaler) som holder feltet med fokus
 * over tastaturet. På iOS justerer ScrollView selv innsetter etter tastaturets
 * faktiske overlapp og ruller fokusfeltet fram (også forbi «Ferdig»-linja).
 * Erstatter `KeyboardAvoidingView` med `keyboardVerticalOffset={0}`, som løftet
 * for lite fordi pageSheet-arket starter et stykke ned fra toppen (16b, 2026-11-06).
 * Android: propen ignoreres; vinduet krymper som før (adjustResize).
 *
 * ORDRE 37: ref videresendes (varesøket ruller med `scrollTo`). Uten ref = som før.
 */
export const TastaturScrollView = forwardRef<
  ScrollView,
  Omit<ScrollViewProps, "automaticallyAdjustKeyboardInsets" | "keyboardShouldPersistTaps"> & {
    children: ReactNode;
  }
>(function TastaturScrollView({ children, ...props }, ref) {
  return (
    <ScrollView {...props} ref={ref} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
});
