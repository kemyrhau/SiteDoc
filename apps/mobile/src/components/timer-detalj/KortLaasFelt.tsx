import { useMemo } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../db/database";
import { byggeplassLocal, externalCostObjectLocal } from "../../db/schema";
import { hentUnderprosjekterLokalt } from "../../services/timerKatalog";
import { VelgerFelt } from "./VelgerFelt";
import type { KortLaas } from "./prosjektkortKontekst";

/**
 * Tillegg/utlegg på prosjektkortet (spec tillegg-utlegg-prosjektkort § 5):
 * kortets byggeplass og underprosjekt vist grått og låst i rad-modalen, som i
 * timer-modalen. Retting går via «Endre kort». Rendres kun når `useKortLaas()`
 * gir et kort — dagskortet når aldri hit.
 * Underprosjekt vises når prosjektet har underprosjekter, eller kortet har ett.
 */
export function KortLaasFelt({ projectId, kortLaas }: { projectId: string; kortLaas: KortLaas }) {
  const { t } = useTranslation();
  const { byggeplassNavn, eco, harUnderprosjekter } = useMemo(() => {
    const db = hentDatabase();
    const bp =
      db && kortLaas.byggeplassId
        ? db.select().from(byggeplassLocal).where(eq(byggeplassLocal.id, kortLaas.byggeplassId)).all()[0] ?? null
        : null;
    const e =
      db && kortLaas.ecoId
        ? db.select().from(externalCostObjectLocal).where(eq(externalCostObjectLocal.id, kortLaas.ecoId)).all()[0] ?? null
        : null;
    return {
      byggeplassNavn: bp?.navn ?? null,
      eco: e,
      harUnderprosjekter: hentUnderprosjekterLokalt(projectId).length > 0,
    };
  }, [projectId, kortLaas.byggeplassId, kortLaas.ecoId]);

  return (
    <>
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">{t("timer.felt.byggeplass")}</Text>
        <VelgerFelt
          verdi={kortLaas.byggeplassId ? (byggeplassNavn ?? null) : t("timer.kortValg.utenByggeplass")}
          placeholder={t("timer.kortValg.utenByggeplass")}
          onPress={() => {}}
          laast
        />
      </View>
      {(harUnderprosjekter || !!kortLaas.ecoId) && (
        <View>
          <Text className="mb-1 text-sm font-medium text-gray-700">{t("timer.felt.underprosjekt")}</Text>
          <VelgerFelt
            verdi={eco ? `${eco.proAdmId} — ${eco.kortNavn}` : t("timer.kortValg.uten")}
            placeholder={t("timer.kortValg.uten")}
            onPress={() => {}}
            laast
          />
        </View>
      )}
    </>
  );
}
