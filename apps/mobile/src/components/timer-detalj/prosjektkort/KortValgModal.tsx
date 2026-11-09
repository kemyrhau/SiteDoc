import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { hentByggeplasserForProsjektLokalt } from "../../../services/byggeplassKatalog";
import { hentUnderprosjekterLokalt } from "../../../services/timerKatalog";
import {
  effektivByggeplass,
  kortNokkel,
  type KortValg,
  type SedelKortKontekst,
} from "../../../lib/prosjektkortMobil";
import { ProsjektVelgerModal } from "../ProsjektVelger";

/**
 * ORDRE 36b (plan § 2 og § 5b): valg av kort = (prosjekt, byggeplass,
 * underprosjekt). To varianter:
 *  - `ny`: prosjektet er valgt («+ Nytt kort»). Byggeplass-rad åpner kortet;
 *    underprosjekt-chips øverst («Uten» forhåndsvalgt). Med én (eller ingen)
 *    byggeplass: chips + «Åpne».
 *  - `flytt`: «Flytt raden». Prosjekt kan byttes, byggeplass og underprosjekt
 *    som chips; «Flytt» er avslått til valget skiller seg fra radens kort.
 *
 * Byggeplass i `KortValg` er den EFFEKTIVE. «Uten byggeplass» tilbys alltid
 * (RETUR 36c-2 P1 a2): når dagens byggeplass hører til samme prosjekt løftes
 * arven ut ved lagring (`loftByggeplassArv`), så raden blir ekte «uten».
 */
export type KortValgModus =
  | { type: "ny"; projectId: string; forslagByggeplassId: string | null }
  | { type: "flytt"; fra: KortValg };

export function kanVelgeUtenByggeplass(_projectId: string, _sedel: SedelKortKontekst): boolean {
  return true;
}

/** K3 for «+ Nytt kort»: 0–1 byggeplass og ingen underprosjekt → kortet åpnes direkte. */
export function kortValgTrengs(projectId: string): boolean {
  return (
    hentByggeplasserForProsjektLokalt(projectId).length > 1 ||
    hentUnderprosjekterLokalt(projectId).length > 0
  );
}

export function KortValgModal({
  organizationId,
  modus,
  sedel,
  prosjektNavn,
  feil = null,
  onVelg,
  onLukk,
}: {
  organizationId: string;
  modus: KortValgModus;
  sedel: SedelKortKontekst;
  prosjektNavn: (projectId: string) => string;
  /** Kallerens avslag (f.eks. maskinkapasitet ved flytt) — vises over knappen. */
  feil?: string | null;
  onVelg: (kort: KortValg) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const start: KortValg =
    modus.type === "flytt"
      ? modus.fra
      : {
          projectId: modus.projectId,
          byggeplassId: modus.forslagByggeplassId ?? effektivByggeplass(modus.projectId, null, sedel),
          ecoId: null,
        };
  const [valg, setValg] = useState<KortValg>(start);
  const [visProsjektVelger, setVisProsjektVelger] = useState(false);

  const byggeplasser = useMemo(
    () =>
      hentByggeplasserForProsjektLokalt(valg.projectId)
        .map((b) => ({ id: b.id, navn: b.navn ?? String(b.number ?? b.id) }))
        .sort((a, b) => a.navn.localeCompare(b.navn, "nb", { numeric: true })),
    [valg.projectId],
  );
  const underprosjekter = useMemo(
    () =>
      hentUnderprosjekterLokalt(valg.projectId)
        .map((e) => ({ id: e.id, navn: `${e.proAdmId} — ${e.kortNavn}` }))
        .sort((a, b) => a.navn.localeCompare(b.navn, "nb", { numeric: true })),
    [valg.projectId],
  );
  const utenTillatt = kanVelgeUtenByggeplass(valg.projectId, sedel);
  const byggeplassRader: { id: string | null; navn: string }[] = [
    ...byggeplasser,
    ...(utenTillatt ? [{ id: null, navn: t("timer.kortValg.utenByggeplass") }] : []),
  ];

  const ecoChips = underprosjekter.length > 0 && (
    <View className="mb-3">
      <Text className="mb-1 text-sm text-gray-500">{t("timer.felt.underprosjekt")}</Text>
      <View className="flex-row flex-wrap gap-2">
        {[{ id: null as string | null, navn: t("timer.kortValg.uten") }, ...underprosjekter].map((e) => (
          <Chip
            key={e.id ?? "ingen"}
            valgt={valg.ecoId === e.id}
            tekst={e.navn}
            onPress={() => setValg((v) => ({ ...v, ecoId: e.id }))}
          />
        ))}
      </View>
    </View>
  );

  const flytt = modus.type === "flytt";
  // `ny` med flere byggeplasser: raden åpner kortet. Ellers chips + knapp.
  const byggeplassSomRader = !flytt && byggeplassRader.length > 1;
  const kanBekrefte = flytt ? kortNokkel(valg) !== kortNokkel(modus.fra) : true;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLukk}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onLukk}>
        <Pressable className="max-h-[80%] rounded-t-2xl bg-white px-4 pb-8 pt-4" onPress={() => {}}>
          <Text className="mb-3 text-base font-semibold text-gray-900">
            {flytt ? t("timer.kortValg.flyttTittel") : prosjektNavn(valg.projectId)}
          </Text>
          <ScrollView>
            {flytt && (
              <Pressable
                onPress={() => setVisProsjektVelger(true)}
                className="mb-3 min-h-[44px] justify-center rounded-lg border border-gray-200 px-3 active:bg-gray-50"
              >
                <Text className="text-base text-gray-900">{prosjektNavn(valg.projectId)}</Text>
              </Pressable>
            )}
            {ecoChips}
            {byggeplassSomRader
              ? byggeplassRader.map((b) => (
                  <Pressable
                    key={b.id ?? "ingen"}
                    onPress={() => onVelg({ ...valg, byggeplassId: b.id })}
                    className={`min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50 ${
                      valg.byggeplassId === b.id ? "bg-gray-50" : ""
                    }`}
                  >
                    <Text className="text-base text-gray-900">{b.navn}</Text>
                  </Pressable>
                ))
              : byggeplassRader.length > 1 && (
                  <View className="mb-3">
                    <Text className="mb-1 text-sm text-gray-500">{t("timer.byggeplass.velg")}</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {byggeplassRader.map((b) => (
                        <Chip
                          key={b.id ?? "ingen"}
                          valgt={valg.byggeplassId === b.id}
                          tekst={b.navn}
                          onPress={() => setValg((v) => ({ ...v, byggeplassId: b.id }))}
                        />
                      ))}
                    </View>
                  </View>
                )}
          </ScrollView>
          {feil && <Text className="mt-3 text-sm text-amber-700">{feil}</Text>}
          {!byggeplassSomRader && (
            <Pressable
              disabled={!kanBekrefte}
              accessibilityState={{ disabled: !kanBekrefte }}
              onPress={() => onVelg(valg)}
              className={`mt-3 min-h-[44px] items-center justify-center rounded-lg ${
                kanBekrefte ? "bg-gray-900 active:bg-gray-700" : "bg-gray-300"
              }`}
            >
              <Text className="text-base font-semibold text-white">
                {flytt ? t("handling.flytt") : t("timer.aapne")}
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>

      {visProsjektVelger && (
        <ProsjektVelgerModal
          organizationId={organizationId}
          valgtId={valg.projectId}
          onVelg={(projectId) => {
            setVisProsjektVelger(false);
            if (projectId === valg.projectId) return;
            // Byggeplass og underprosjekt hører til prosjektet — start på nytt.
            setValg({ projectId, byggeplassId: effektivByggeplass(projectId, null, sedel), ecoId: null });
          }}
          onLukk={() => setVisProsjektVelger(false)}
        />
      )}
    </Modal>
  );
}

function Chip({ valgt, tekst, onPress }: { valgt: boolean; tekst: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: valgt }}
      className={`min-h-[36px] justify-center rounded-full border px-3 ${
        valgt ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-white active:bg-gray-50"
      }`}
    >
      <Text className={`text-sm ${valgt ? "text-white" : "text-gray-700"}`}>{tekst}</Text>
    </Pressable>
  );
}
