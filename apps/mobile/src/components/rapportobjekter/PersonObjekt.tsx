import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { User, X, Check } from "lucide-react-native";
import { trpc } from "../../lib/trpc";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";
import type { RapportObjektProps } from "./typer";

interface Medlem {
  id: string;
  user: { id: string; name: string | null; email: string };
}

export function PersonObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const [visModal, settVisModal] = useState(false);
  const { valgtProsjektId } = useProsjekt();
  const valgtId = typeof verdi === "string" ? verdi : null;

  const medlemQuery = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && visModal },
  );

  const medlemmer = (medlemQuery.data ?? []) as Medlem[];
  const valgtMedlem = medlemmer.find((m) => m.user.id === valgtId);

  return (
    <View>
      <Pressable
        onPress={() => !leseModus && settVisModal(true)}
        className={`flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 ${
          leseModus ? "bg-gray-50" : ""
        }`}
      >
        <User size={18} color="#6b7280" />
        <Text className={`flex-1 text-sm ${valgtMedlem ? "text-gray-900" : "text-gray-400"}`}>
          {valgtMedlem ? (valgtMedlem.user.name ?? valgtMedlem.user.email) : "Velg person..."}
        </Text>
      </Pressable>

      <Modal visible={visModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
            <Text className="text-lg font-semibold">Velg person</Text>
            <Pressable onPress={() => settVisModal(false)} hitSlop={12}>
              <X size={24} color="#6b7280" />
            </Pressable>
          </View>
          <FlatList
            data={medlemmer}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const erValgt = item.user.id === valgtId;
              return (
                <Pressable
                  onPress={() => {
                    onEndreVerdi(erValgt ? null : item.user.id);
                    settVisModal(false);
                  }}
                  className="flex-row items-center border-b border-gray-100 px-4 py-3"
                >
                  <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <User size={16} color="#1e40af" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">
                      {item.user.name ?? "Ukjent"}
                    </Text>
                    <Text className="text-xs text-gray-500">{item.user.email}</Text>
                  </View>
                  {erValgt && <Check size={20} color="#1e40af" />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
