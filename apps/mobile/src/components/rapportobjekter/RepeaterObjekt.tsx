import { useCallback, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { RapportObjektProps, RapportObjekt } from "./typer";
import type { FeltVerdi } from "../../hooks/useSjekklisteSkjema";
import { RapportObjektRenderer, DISPLAY_TYPER } from "./RapportObjektRenderer";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

type RadData = Record<string, FeltVerdi>;
type RepeaterVerdi = RadData[];

const TOM_FELTVERDI: FeltVerdi = { verdi: null, kommentar: "", vedlegg: [] };

export function RepeaterObjekt({
  objekt,
  verdi,
  onEndreVerdi,
  leseModus,
  barneObjekter,
  sjekklisteId,
  oppgaveIdForKo,
}: RapportObjektProps) {
  const { t } = useTranslation();
  const rader = Array.isArray(verdi) ? (verdi as RepeaterVerdi) : [];
  const barn = barneObjekter ?? [];

  // Ref for å unngå stale closure i asynkrone callbacks (kamera)
  const raderRef = useRef(rader);
  raderRef.current = rader;

  const leggTilRad = useCallback(() => {
    const nyRad: RadData = {};
    for (const b of barn) {
      nyRad[b.id] = { ...TOM_FELTVERDI };
    }
    onEndreVerdi([...raderRef.current, nyRad]);
  }, [barn, onEndreVerdi]);

  const fjernRad = useCallback(
    (indeks: number) => {
      onEndreVerdi(raderRef.current.filter((_, i) => i !== indeks));
    },
    [onEndreVerdi],
  );

  const oppdaterFeltVerdi = useCallback(
    (radIndeks: number, feltId: string, nyVerdi: unknown) => {
      const oppdatert = raderRef.current.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, [feltId]: { ...eksisterende, verdi: nyVerdi } };
      });
      onEndreVerdi(oppdatert);
    },
    [onEndreVerdi],
  );

  const oppdaterKommentar = useCallback(
    (radIndeks: number, feltId: string, kommentar: string) => {
      const oppdatert = raderRef.current.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, [feltId]: { ...eksisterende, kommentar } };
      });
      onEndreVerdi(oppdatert);
    },
    [onEndreVerdi],
  );

  const leggTilVedlegg = useCallback(
    (radIndeks: number, feltId: string, vedlegg: FeltVerdi["vedlegg"][number]) => {
      const oppdatert = raderRef.current.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return {
          ...rad,
          [feltId]: {
            ...eksisterende,
            vedlegg: [...(eksisterende.vedlegg ?? []), vedlegg],
          },
        };
      });
      onEndreVerdi(oppdatert);
    },
    [onEndreVerdi],
  );

  const fjernVedlegg = useCallback(
    (radIndeks: number, feltId: string, vedleggId: string) => {
      const oppdatert = raderRef.current.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return {
          ...rad,
          [feltId]: {
            ...eksisterende,
            vedlegg: (eksisterende.vedlegg ?? []).filter((v) => v.id !== vedleggId),
          },
        };
      });
      onEndreVerdi(oppdatert);
    },
    [onEndreVerdi],
  );

  if (barn.length === 0) {
    return (
      <View className="rounded-lg border border-dashed border-gray-300 px-4 py-6">
        <Text className="text-center text-sm text-gray-400">
          {t("felt.ingenFelter")}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-1.5">
      {rader.map((rad, radIndeks) => (
        <View
          key={radIndeks}
          className="rounded border border-gray-200 bg-gray-50 px-3 py-2"
        >
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold text-gray-400">
              {radIndeks + 1} {objekt.label}
            </Text>
            {!leseModus && (
              <Pressable onPress={() => fjernRad(radIndeks)} hitSlop={8}>
                <Trash2 size={12} color="#fca5a5" />
              </Pressable>
            )}
          </View>

          <View className="gap-1">
            {barn.map((barnObjekt) => {
              const feltVerdi = rad[barnObjekt.id] ?? TOM_FELTVERDI;
              const erDisplay = DISPLAY_TYPER.has(barnObjekt.type);

              if (erDisplay) {
                return (
                  <View key={barnObjekt.id}>
                    <RapportObjektRenderer
                      objekt={barnObjekt}
                      verdi={feltVerdi.verdi}
                      onEndreVerdi={(v) =>
                        oppdaterFeltVerdi(radIndeks, barnObjekt.id, v)
                      }
                      leseModus={leseModus}
                    />
                  </View>
                );
              }

              return (
                <View key={barnObjekt.id}>
                  <RapportObjektRenderer
                    objekt={barnObjekt}
                    verdi={feltVerdi.verdi}
                    onEndreVerdi={(v) =>
                      oppdaterFeltVerdi(radIndeks, barnObjekt.id, v)
                    }
                    leseModus={leseModus}
                  />
                  <FeltDokumentasjon
                    kommentar={feltVerdi.kommentar ?? ""}
                    vedlegg={feltVerdi.vedlegg ?? []}
                    onEndreKommentar={(k) =>
                      oppdaterKommentar(radIndeks, barnObjekt.id, k)
                    }
                    onLeggTilVedlegg={(v) =>
                      leggTilVedlegg(radIndeks, barnObjekt.id, v)
                    }
                    onFjernVedlegg={(vId) =>
                      fjernVedlegg(radIndeks, barnObjekt.id, vId)
                    }
                    leseModus={leseModus}
                    sjekklisteId={sjekklisteId}
                    oppgaveIdForKo={oppgaveIdForKo}
                    objektId={barnObjekt.id}
                    skjulKommentar={barnObjekt.type === "text_field"}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {!leseModus && (
        <Pressable
          onPress={leggTilRad}
          className="flex-row items-center justify-center gap-1.5 rounded border border-dashed border-gray-300 py-2"
        >
          <Plus size={14} color="#6b7280" />
          <Text className="text-xs text-gray-500">{t("felt.leggTilRad")}</Text>
        </Pressable>
      )}
    </View>
  );
}
