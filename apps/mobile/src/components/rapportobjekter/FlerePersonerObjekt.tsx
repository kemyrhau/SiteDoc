import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { Users, X, Check } from "lucide-react-native";
import { trpc } from "../../lib/trpc";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";
import type { RapportObjektProps } from "./typer";

interface Medlem {
  id: string;
  user: { id: string; name: string | null; email: string };
}

export function FlerePersonerObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const [visModal, settVisModal] = useState(false);
  const { valgtProsjektId } = useProsjekt();
  const valgteIder = Array.isArray(verdi) ? (verdi as string[]) : [];

  const medlemQuery = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && visModal },
  );

  const medlemmer = (medlemQuery.data ?? []) as Medlem[];

  const håndterToggle = (brukerId: string) => {
    if (valgteIder.includes(brukerId)) {
      onEndreVerdi(valgteIder.filter((id) => id !== brukerId));
    } else {
      onEndreVerdi([...valgteIder, brukerId]);
    }
  };

  return (
    <View>
      <Pressable
        onPress={() => !leseModus && settVisModal(true)}
        className={`flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 ${
          leseModus ? "bg-gray-50" : ""
        }`}
      >
        <Users size={18} color="#6b7280" />
        <Text className={`flex-1 text-sm ${valgteIder.length > 0 ? "text-gray-900" : "text-gray-400"}`}>
          {valgteIder.length > 0 ? `${valgteIder.length} valgt` : "Velg personer..."}
        </Text>
      </Pressable>

      <Modal visible={visModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
            <Text className="text-lg font-semibold">Velg personer</Text>
            <Pressable onPress={() => settVisModal(false)} hitSlop={12}>
              <X size={24} color="#6b7280" />
            </Pressable>
          </View>
          <FlatList
            data={medlemmer}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const erValgt = valgteIder.includes(item.user.id);
              return (
                <Pressable
                  onPress={() => håndterToggle(item.user.id)}
                  className="flex-row items-center border-b border-gray-100 px-4 py-3"
                >
                  <View
                    className={`mr-3 h-5 w-5 items-center justify-center rounded border-2 ${
                      erValgt ? "border-blue-600 bg-blue-600" : "border-gray-400"
                    }`}
                  >
                    {erValgt && <Check size={14} color="#ffffff" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">
                      {item.user.name ?? "Ukjent"}
                    </Text>
                    <Text className="text-xs text-gray-500">{item.user.email}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
          <View className="border-t border-gray-200 p-4">
            <Pressable
              onPress={() => settVisModal(false)}
              className="items-center rounded-lg bg-blue-600 py-3"
            >
              <Text className="font-medium text-white">Ferdig ({valgteIder.length} valgt)</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
