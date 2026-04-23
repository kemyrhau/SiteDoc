import { View, Text, TouchableOpacity, Modal, FlatList, Pressable } from "react-native";
import { useState } from "react";
import { trpc } from "../../providers/trpc-provider";
import type { RapportObjektProps } from "./typer";

export function SoneEgenskapObjekt({ verdi, onEndreVerdi, leseModus, prosjektId }: RapportObjektProps) {
  const valgtId = typeof verdi === "string" ? verdi : "";
  const [visModal, setVisModal] = useState(false);

  const { data: omrader } = trpc.omrade.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const valgt = omrader?.find((o) => o.id === valgtId);

  return (
    <View>
      <TouchableOpacity
        onPress={() => !leseModus && setVisModal(true)}
        disabled={leseModus}
        className={`rounded-lg border border-gray-300 px-3 py-2.5 ${
          leseModus ? "bg-gray-50" : "bg-white"
        }`}
      >
        <Text className={`text-sm ${valgt ? "text-gray-900" : "text-gray-400"}`}>
          {valgt ? `${valgt.byggeplass.name} — ${valgt.navn}` : "Velg område..."}
        </Text>
      </TouchableOpacity>

      <Modal visible={visModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white pt-4">
          <View className="flex-row items-center justify-between px-4 pb-3 border-b border-gray-200">
            <Text className="text-lg font-semibold">Velg område</Text>
            <Pressable onPress={() => setVisModal(false)}>
              <Text className="text-blue-600 text-base">Lukk</Text>
            </Pressable>
          </View>
          <FlatList
            data={omrader ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onEndreVerdi(item.id); setVisModal(false); }}
                className={`px-4 py-3 border-b border-gray-100 ${item.id === valgtId ? "bg-blue-50" : ""}`}
              >
                <Text className="text-sm font-medium text-gray-900">{item.navn}</Text>
                <Text className="text-xs text-gray-500">{item.byggeplass.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text className="px-4 py-8 text-center text-gray-400">Ingen områder opprettet</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}
