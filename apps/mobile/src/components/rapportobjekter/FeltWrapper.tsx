import { View, Text } from "react-native";
import type { ReactNode } from "react";
import type { Vedlegg } from "../../hooks/useSjekklisteSkjema";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

interface FeltWrapperProps {
  objekt: {
    id: string;
    type: string;
    label: string;
    required: boolean;
    config: Record<string, unknown>;
  };
  kommentar: string;
  vedlegg: Vedlegg[];
  onEndreKommentar: (kommentar: string) => void;
  onLeggTilVedlegg: (vedlegg: Vedlegg) => void;
  onFjernVedlegg: (vedleggId: string) => void;
  leseModus?: boolean;
  sjekklisteId: string;
  erBetinget?: boolean;
  valideringsfeil?: string;
  children: ReactNode;
}

export function FeltWrapper({
  objekt,
  kommentar,
  vedlegg,
  onEndreKommentar,
  onLeggTilVedlegg,
  onFjernVedlegg,
  leseModus,
  sjekklisteId,
  erBetinget,
  valideringsfeil,
  children,
}: FeltWrapperProps) {
  return (
    <View
      className={`rounded-lg bg-white p-4 ${
        erBetinget ? "ml-4 border-l-2 border-l-blue-300" : ""
      }`}
    >
      {/* Label + påkrevd-badge */}
      <View className="mb-2 flex-row items-center gap-2">
        <Text className="text-sm font-medium text-gray-900">{objekt.label}</Text>
        {objekt.required && (
          <View className="rounded bg-red-50 px-1.5 py-0.5">
            <Text className="text-[10px] font-medium text-red-600">Påkrevd</Text>
          </View>
        )}
      </View>

      {/* Typespesifikk input */}
      {children}

      {/* Valideringsfeil */}
      {valideringsfeil && (
        <Text className="mt-1 text-xs text-red-500">{valideringsfeil}</Text>
      )}

      {/* Dokumentasjon (kommentar + vedlegg) */}
      <FeltDokumentasjon
        kommentar={kommentar}
        vedlegg={vedlegg}
        onEndreKommentar={onEndreKommentar}
        onLeggTilVedlegg={onLeggTilVedlegg}
        onFjernVedlegg={onFjernVedlegg}
        leseModus={leseModus}
        sjekklisteId={sjekklisteId}
      />
    </View>
  );
}
