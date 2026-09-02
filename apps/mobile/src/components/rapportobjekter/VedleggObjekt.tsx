import { View, Text } from "react-native";
import { Paperclip } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { RapportObjektProps } from "./typer";

// VedleggObjekt er en ren vedleggs-type — den trenger ingen typespesifikk input.
// All vedleggshåndtering skjer via FeltDokumentasjon som vises automatisk.
export function VedleggObjekt({ leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 py-1">
      <Paperclip size={16} color="#6b7280" />
      <Text className="text-sm text-gray-500">
        {leseModus ? t("felt.vedleggVisesNedenfor") : t("felt.brukKnapperVedlegg")}
      </Text>
    </View>
  );
}
