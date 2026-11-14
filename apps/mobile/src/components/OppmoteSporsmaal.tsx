import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { X, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ModalFlate } from "./ModalFlate";
import { trpc } from "../lib/trpc";
import { useAuth } from "../providers/AuthProvider";
import { useNettverk } from "../providers/NettverkProvider";
import { hentOppmotederLokalt } from "../services/oppmotestedKatalog";
import { skrivOppmotePerioderLokalt } from "../services/oppmotePeriodeKatalog";

/**
 * POST 2026-11-15 (12) D pkt. 3 — «Hvor møter du vanligvis?» ved første
 * timeregistrering. Vises KUN på nett og når serveren sier `trengerValg`
 * (≥ 2 aktive kontorer, ingen fast). Ett trykk = lagret (`settMittFaste`),
 * så fortsetter registreringen. Lukk = fortsett uten (resolveren gir
 * «ikke valgt», spørsmålet kommer igjen neste gang). Offline: aldri vist.
 */
export function useOppmoteSporsmaal(orgId: string) {
  const { bruker } = useAuth();
  const { erPaaNettet } = useNettverk();
  const utils = trpc.useUtils();
  const mine = trpc.oppmotePeriode.hentMine.useQuery(
    { organizationId: orgId },
    { enabled: erPaaNettet && !!orgId && !!bruker?.id, retry: false },
  );
  const settMittFaste = trpc.oppmotePeriode.settMittFaste.useMutation();

  const trengerValg = erPaaNettet && mine.data?.trengerValg === true;

  const velg = useCallback(
    async (oppmotestedId: string) => {
      try {
        await settMittFaste.mutateAsync({ organizationId: orgId, oppmotestedId });
      } catch (e) {
        // FORBIDDEN = satt fra før (annen enhet/admin) — hent fasit under uansett.
        console.warn("[OPPMOTE] settMittFaste feilet", e);
      }
      try {
        const fersk = await utils.client.oppmotePeriode.hentMine.query({ organizationId: orgId });
        if (bruker?.id) skrivOppmotePerioderLokalt(bruker.id, orgId, fersk.perioder);
        utils.oppmotePeriode.hentMine.setData({ organizationId: orgId }, fersk);
      } catch (e) {
        console.warn("[OPPMOTE] hentMine etter valg feilet", e);
      }
    },
    [orgId, bruker?.id, settMittFaste, utils],
  );

  return { trengerValg, velg };
}

export function OppmoteSporsmaalArk({
  orgId,
  onVelg,
  onLukk,
}: {
  orgId: string;
  onVelg: (oppmotestedId: string) => Promise<void>;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const steder = useMemo(() => hentOppmotederLokalt(orgId), [orgId]);
  const [lagrer, setLagrer] = useState<string | null>(null);

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet" onRequestClose={onLukk}>
      <ModalFlate kanter={["top"]} className="bg-white">
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">{t("timer.oppmote.sporsmaal")}</Text>
          <Pressable onPress={onLukk} hitSlop={12} accessibilityLabel={t("timer.besok.lukk")}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        <Text className="px-4 pt-3 text-sm text-gray-600">{t("timer.oppmote.forklaring")}</Text>
        <View className="gap-2 p-4">
          {steder.map((s) => (
            <Pressable
              key={s.id}
              disabled={lagrer != null}
              onPress={async () => {
                setLagrer(s.id);
                await onVelg(s.id);
                setLagrer(null);
              }}
              className="flex-row items-center gap-2 rounded-lg border border-gray-300 px-4 py-4 active:bg-gray-100"
            >
              <MapPin size={18} color="#1d4ed8" />
              <Text className="flex-1 text-base text-gray-900">{s.navn}</Text>
              {lagrer === s.id ? <ActivityIndicator size="small" /> : null}
            </Pressable>
          ))}
        </View>
      </ModalFlate>
    </Modal>
  );
}
