import {
  InputAccessoryView,
  View,
  Text,
  Pressable,
  Keyboard,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";

/**
 * iOS-tastatur-«Ferdig» for numeriske felt (decimal-pad har ingen retur-tast
 * → kan ikke lukkes). Render én gang per modal og koble TextInput-ene til via
 * `inputAccessoryViewID={TASTATUR_FERDIG_ID}`. Android-keypad har egen dismiss
 * → komponenten rendrer ingenting der (og `inputAccessoryViewID` ignoreres).
 */
export const TASTATUR_FERDIG_ID = "tastatur-ferdig";

export function TastaturFerdig() {
  const { t } = useTranslation();
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={TASTATUR_FERDIG_ID}>
      <View className="flex-row justify-end border-t border-gray-200 bg-gray-100 px-3 py-2">
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
          <Text className="text-base font-semibold text-sitedoc-primary">
            {t("handling.ferdig")}
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
