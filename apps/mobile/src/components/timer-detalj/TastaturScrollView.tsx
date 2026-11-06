import type { ReactNode } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

/**
 * Rulleflate for raddialogene (pageSheet-modaler) som holder feltet med fokus
 * over tastaturet. På iOS justerer ScrollView selv innsetter etter tastaturets
 * faktiske overlapp og ruller fokusfeltet fram (også forbi «Ferdig»-linja).
 * Erstatter `KeyboardAvoidingView` med `keyboardVerticalOffset={0}`, som løftet
 * for lite fordi pageSheet-arket starter et stykke ned fra toppen (16b, 2026-11-06).
 * Android: propen ignoreres; vinduet krymper som før (adjustResize).
 */
export function TastaturScrollView({
  children,
  ...props
}: Omit<ScrollViewProps, "automaticallyAdjustKeyboardInsets" | "keyboardShouldPersistTaps"> & {
  children: ReactNode;
}) {
  return (
    <ScrollView {...props} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}
