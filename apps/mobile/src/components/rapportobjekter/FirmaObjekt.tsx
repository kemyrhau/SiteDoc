import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { Building2, X, Check } from "lucide-react-native";
import { trpc } from "../../lib/trpc";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";
import type { RapportObjektProps } from "./typer";

interface Entreprise {
  id: string;
  name: string;
}

export function FirmaObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const [visModal, settVisModal] = useState(false);
  const { valgtProsjektId } = useProsjekt();
  const valgtId = typeof verdi === "string" ? verdi : null;

  const entrepriseQuery = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && visModal },
  );

  const entrepriser = (entrepriseQuery.data ?? []) as Entreprise[];
  const valgtEntreprise = entrepriser.find((e) => e.id === valgtId);

  return (
    <View>
      <Pressable
        onPress={() => !leseModus && settVisModal(true)}
        className={`flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 ${
          leseModus ? "bg-gray-50" : ""
        }`}
      >
        <Building2 size={18} color="#6b7280" />
        <Text className={`flex-1 text-sm ${valgtEntreprise ? "text-gray-900" : "text-gray-400"}`}>
          {valgtEntreprise ? valgtEntreprise.name : "Velg firma..."}
        </Text>
      </Pressable>

      <Modal visible={visModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
            <Text className="text-lg font-semibold">Velg firma</Text>
            <Pressable onPress={() => settVisModal(false)} hitSlop={12}>
              <X size={24} color="#6b7280" />
            </Pressable>
          </View>
          <FlatList
            data={entrepriser}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const erValgt = item.id === valgtId;
              return (
                <Pressable
                  onPress={() => {
                    onEndreVerdi(erValgt ? null : item.id);
                    settVisModal(false);
                  }}
                  className="flex-row items-center border-b border-gray-100 px-4 py-3"
                >
                  <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                    <Building2 size={16} color="#7c3aed" />
                  </View>
                  <Text className="flex-1 text-sm font-medium text-gray-900">{item.name}</Text>
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
