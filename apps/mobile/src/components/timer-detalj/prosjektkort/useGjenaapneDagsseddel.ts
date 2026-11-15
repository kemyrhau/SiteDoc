/**
 * ORDRE 2026-11-15 (23): én gjenåpne-vei for prosjektkort-modus.
 *
 * Brukes av samlesiden (via `useProsjektkortSedel`) og kortskjermen
 * (`timer/[id]/kort/[projectId]`), så brukeren får samme bekreftelse,
 * samme kall og samme feilmeldinger uansett hvor dagen åpnes fra.
 * Dagskortet (`timer/[id].tsx`) har sin egen kopi og bruker ikke denne.
 */
import { useCallback } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../../db/database";
import { dagsseddelLocal } from "../../../db/schema";
import { useTimerSync } from "../../../providers/TimerSyncProvider";
import { trpc } from "../../../lib/trpc";
import { gjenaapneFeilmelding } from "./gjenaapne";

interface Valg {
  /** Etter vellykket gjenåpning (lokal kopi er satt til draft). */
  onGjenaapnet: () => void;
  /** `null` når et nytt forsøk starter; ellers teksten som skal vises. */
  onFeil: (melding: string | null) => void;
}

export function useGjenaapneDagsseddel(sheetId: string, { onGjenaapnet, onFeil }: Valg) {
  const { t } = useTranslation();
  const { oppdaterTellere } = useTimerSync();
  const mutation = trpc.timer.dagsseddel.gjenaapneDagsseddel.useMutation();

  const utfor = useCallback(() => {
    onFeil(null);
    mutation.mutate(
      { id: sheetId },
      {
        onSuccess: () => {
          const db = hentDatabase();
          if (db) {
            db.update(dagsseddelLocal)
              .set({ status: "draft", syncStatus: "synced", sistEndretLokalt: Date.now() })
              .where(eq(dagsseddelLocal.id, sheetId))
              .run();
          }
          oppdaterTellere();
          onGjenaapnet();
        },
        onError: (e: unknown) => onFeil(gjenaapneFeilmelding(e, t)),
      },
    );
  }, [mutation, sheetId, oppdaterTellere, onGjenaapnet, onFeil, t]);

  // Gjenåpne en sendt sedel (online-only), med bekreftelse først.
  const gjenaapne = useCallback(() => {
    Alert.alert(t("timer.gjenaapne.bekreftTittel"), t("timer.gjenaapne.bekreftTekst"), [
      { text: t("handling.avbryt"), style: "cancel" },
      { text: t("timer.gjenaapne.bekreftKnapp"), onPress: utfor },
    ]);
  }, [t, utfor]);

  return { gjenaapne, pending: mutation.isPending };
}
