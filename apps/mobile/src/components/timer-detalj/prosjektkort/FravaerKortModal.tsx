import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, TextInput } from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet, som SplittRadModal: arkets egen topp-inset.
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Minus, Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { and, eq } from "drizzle-orm";
import { hentDatabase } from "../../../db/database";
import { lonnsartLocal } from "../../../db/schema";
import { finnNormtakArtLokalt } from "../../../services/timerKatalog";
import { hentOrganizationSettingLokalt } from "../../../services/organizationSettingKatalog";
import { TastaturScrollView } from "../TastaturScrollView";
import { LonnsartVelgerModal } from "../TimerSeksjon";
import { VelgerFelt } from "../VelgerFelt";
import { KnappMedForklaring } from "../../KnappMedForklaring";
import type { NormtakDagRad } from "../../../utils/fravaerNormtakMobil";
import {
  artNedtonet,
  forhandsutfyllTimer,
  fravaerRest,
  fravaerSteg,
  linjeGrense,
  stegFravaerTimer,
  validerFravaerKort,
  visSomChips,
  type KortLinje,
} from "../../../utils/fravaerKort";
import { lagreFravaerKort } from "./fravaerKortLagring";

/**
 * ORDRE (33) c2 — fraværskortet (kort-id-spec § 11.5, skisse «Fraværskortet»).
 * Viser bare art, timer og beskrivelse (U5/F2): ingen prosjekt, byggeplass, underprosjekt,
 * aktivitet, maskin, varer, tillegg eller klokkeslett. Art som chips (≤ 6) eller søkeliste
 * (U2), timer forhåndsutfylt med resten av normen (U3), −/+ i firmaets tidsrunding og tak
 * for art med tak (B10, TF22), flere linjer (U7), én påkrevd beskrivelse (U11/F4).
 * Lagres samlet via `lagreFravaerKort` (offline, lokal SQLite).
 */

export interface FravaerKortRad {
  id: string;
  lonnsartId: string;
  timer: number;
  beskrivelse: string | null;
}

let nesteKey = 0;
const nyKey = () => `fk-${++nesteKey}`;

type Linje = KortLinje & { id: string | null; rort: boolean };

export function FravaerKortModal({
  userId,
  organizationId,
  dato,
  dagsnorm,
  dagRader,
  eksisterende,
  nyLinje = false,
  onLagret,
  onLukk,
}: {
  userId: string;
  organizationId: string;
  dato: string;
  /** Datoens eksakte norm (U12) — `null` = ukjent: tomt felt og intet tak. */
  dagsnorm: number | null;
  /** Dagens rader UTEN fraværskortets egne. */
  dagRader: readonly NormtakDagRad[];
  /** Fraværskortets lagrede rader (tom liste = nytt kort). */
  eksisterende: readonly FravaerKortRad[];
  /** Åpnet fra «+ Fravær» på en dag som alt har fraværskort: legg til en forhåndsutfylt linje (U7). */
  nyLinje?: boolean;
  onLagret: () => void;
  onLukk: () => void;
}) {
  const { t, i18n } = useTranslation();
  const fmt = (n: number) => n.toLocaleString(i18n.language, { maximumFractionDigits: 2 });

  const arter = useMemo(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(lonnsartLocal)
      .where(and(eq(lonnsartLocal.organizationId, organizationId), eq(lonnsartLocal.aktiv, true), eq(lonnsartLocal.type, "fravaer")))
      .all()
      .sort((a, b) => a.rekkefolge - b.rekkefolge);
  }, [organizationId]);
  const steg = useMemo(
    () => fravaerSteg(hentOrganizationSettingLokalt(organizationId)?.tidsrundingMinutter),
    [organizationId],
  );

  const [linjer, setLinjer] = useState<Linje[]>(() => {
    const lagrede: Linje[] = eksisterende.map((r) => ({
      key: nyKey(),
      id: r.id,
      lonnsartId: r.lonnsartId,
      timer: r.timer,
      rort: true,
    }));
    if (lagrede.length > 0 && !nyLinje) return lagrede;
    return [
      ...lagrede,
      {
        key: nyKey(),
        id: null,
        lonnsartId: null,
        timer: forhandsutfyllTimer(
          fravaerRest({ dagsnorm, dagRader, kortLinjer: lagrede, key: null, finnArt: finnNormtakArtLokalt }),
        ),
        rort: false,
      },
    ];
  });
  const [beskrivelse, setBeskrivelse] = useState(eksisterende.find((r) => r.beskrivelse)?.beskrivelse ?? "");
  const [fjernede, setFjernede] = useState<string[]>([]);
  const [velgerFor, setVelgerFor] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  // U12: kommer normen (online-henting) mens kortet er åpent, fylles bare urørte, tomme felt.
  const forrigeNorm = useRef(dagsnorm);
  useEffect(() => {
    if (forrigeNorm.current === dagsnorm) return;
    forrigeNorm.current = dagsnorm;
    setLinjer((ls) =>
      ls.map((l) =>
        !l.rort && l.timer == null
          ? { ...l, timer: forhandsutfyllTimer(fravaerRest({ dagsnorm, dagRader, kortLinjer: ls, key: l.key, finnArt: finnNormtakArtLokalt })) }
          : l,
      ),
    );
  }, [dagsnorm, dagRader]);

  const grense = (l: Linje, lonnsartId = l.lonnsartId) =>
    linjeGrense({ dagsnorm, dagRader, kortLinjer: linjer, key: l.key, lonnsartId, finnArt: finnNormtakArtLokalt });
  const restFor = (l: Linje) => fravaerRest({ dagsnorm, dagRader, kortLinjer: linjer, key: l.key, finnArt: finnNormtakArtLokalt });

  const oppdater = (key: string, felt: Partial<Linje>) =>
    setLinjer((ls) => ls.map((l) => (l.key === key ? { ...l, ...felt } : l)));

  const velgArt = (l: Linje, lonnsartId: string) => {
    // TF22: bytte til art med tak klemmer timene til resten.
    const g = grense(l, lonnsartId);
    oppdater(l.key, { lonnsartId, timer: l.timer == null ? l.timer : stegFravaerTimer(l.timer, 0, steg, g) });
  };

  const leggTilLinje = () =>
    setLinjer((ls) => [
      ...ls,
      {
        key: nyKey(),
        id: null,
        lonnsartId: null,
        timer: forhandsutfyllTimer(fravaerRest({ dagsnorm, dagRader, kortLinjer: ls, key: null, finnArt: finnNormtakArtLokalt })),
        rort: false,
      },
    ]);

  const fjernLinje = (l: Linje) => {
    if (l.id) setFjernede((f) => [...f, l.id!]);
    setLinjer((ls) => ls.filter((x) => x.key !== l.key));
  };

  const sperre = validerFravaerKort({ linjer, beskrivelse, finnArt: finnNormtakArtLokalt });

  const bekreft = () => {
    setFeil(null);
    const db = hentDatabase();
    if (!db || sperre) return;
    const r = lagreFravaerKort(db, {
      userId,
      organizationId,
      dato,
      linjer: linjer.map((l) => ({ id: l.id, lonnsartId: l.lonnsartId!, timer: l.timer! })),
      fjernede,
      beskrivelse,
    });
    if (r.ok) {
      onLagret();
      return;
    }
    setFeil(
      r.grunn === "manglerAktivitet"
        ? t("timer.ingenAktiviteter")
        : r.grunn === "dagLaast"
          ? t("timer.fravaerKort.dagLaast")
          : r.grunn === "sedelIAnnetFirma"
            ? t("timer.fravaerKort.annetFirma")
            : t(`timer.fravaerKort.sperret.${r.grunn}`),
    );
  };

  const brukChips = visSomChips(arter.length);
  const artNavn = (id: string | null) => arter.find((a) => a.id === id)?.navn ?? null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onLukk}>
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">{t("timer.fravaerKort.tittel")}</Text>
          <Pressable onPress={onLukk} hitSlop={12} accessibilityLabel={t("handling.lukk")}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        <TastaturScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
          {arter.length === 0 && <Text className="text-sm text-amber-800">{t("timer.fravaerKort.ingenArter")}</Text>}
          {linjer.map((l) => {
            const g = grense(l);
            const rest = restFor(l);
            return (
              <View key={l.key} className="gap-2 rounded-lg border border-gray-200 p-3">
                {brukChips ? (
                  <View className="flex-row flex-wrap gap-2">
                    {arter.map((a) => {
                      const valgt = a.id === l.lonnsartId;
                      const nedtonet = !valgt && artNedtonet(finnNormtakArtLokalt(a.id), rest);
                      return (
                        <Pressable
                          key={a.id}
                          disabled={nedtonet}
                          onPress={() => velgArt(l, a.id)}
                          className={`min-h-[44px] justify-center rounded-full border px-3 ${
                            valgt ? "border-blue-600 bg-blue-50" : nedtonet ? "border-gray-200 bg-gray-50" : "border-gray-300 bg-white"
                          }`}
                        >
                          <Text className={`text-sm ${valgt ? "text-blue-700" : nedtonet ? "text-gray-400" : "text-gray-800"}`}>
                            {a.navn}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <VelgerFelt
                    verdi={artNavn(l.lonnsartId)}
                    placeholder={t("timer.fravaerKort.velgArt")}
                    onPress={() => setVelgerFor(l.key)}
                  />
                )}
                <View className="flex-row items-center gap-3">
                  <Text className="flex-1 text-sm text-gray-700">{t("timer.kol.timer")}</Text>
                  <Pressable
                    onPress={() => oppdater(l.key, { timer: stegFravaerTimer(l.timer ?? 0, -1, steg, g), rort: true })}
                    className="h-11 w-11 items-center justify-center rounded-full border border-gray-300"
                    accessibilityLabel={t("timer.fravaerKort.mindre")}
                  >
                    <Minus size={18} color="#1f2937" />
                  </Pressable>
                  <Text className="min-w-[48px] text-center text-base font-semibold text-gray-900" style={{ fontVariant: ["tabular-nums"] }}>
                    {l.timer == null ? "–" : fmt(l.timer)}
                  </Text>
                  <Pressable
                    onPress={() => oppdater(l.key, { timer: stegFravaerTimer(l.timer ?? 0, 1, steg, g), rort: true })}
                    disabled={g != null && (l.timer ?? 0) >= g}
                    className="h-11 w-11 items-center justify-center rounded-full border border-gray-300"
                    accessibilityLabel={t("timer.fravaerKort.mer")}
                  >
                    <Plus size={18} color={g != null && (l.timer ?? 0) >= g ? "#9ca3af" : "#1f2937"} />
                  </Pressable>
                  {linjer.length > 1 && (
                    <Pressable onPress={() => fjernLinje(l)} hitSlop={8} accessibilityLabel={t("timer.fravaerKort.fjernLinje")}>
                      <Trash2 size={18} color="#6b7280" />
                    </Pressable>
                  )}
                </View>
                {g != null && (
                  <Text className="text-xs text-gray-500">
                    {g <= 0 ? t("timer.normtak.normFylt") : t("timer.normtak.hoystUtenFort", { timer: fmt(g) })}
                  </Text>
                )}
              </View>
            );
          })}
          <Pressable onPress={leggTilLinje} className="min-h-[44px] justify-center">
            <Text className="text-sm font-medium text-sitedoc-primary">{t("timer.fravaerKort.leggTilLinje")}</Text>
          </Pressable>
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">{t("timer.fravaerKort.beskrivelse")} *</Text>
            <TextInput
              value={beskrivelse}
              onChangeText={setBeskrivelse}
              placeholder={t("timer.fravaerKort.beskrivelsePlaceholder")}
              multiline
              className={`min-h-[44px] rounded-lg border px-3 py-3 text-base text-gray-900 ${
                beskrivelse.trim() ? "border-gray-300 bg-white" : "border-amber-300 bg-amber-50"
              }`}
            />
          </View>
          {feil && <Text className="text-sm text-red-600">{feil}</Text>}
          <KnappMedForklaring sperret={sperre != null} forklaring={sperre ? t(`timer.fravaerKort.sperret.${sperre}`) : ""}>
            <Pressable
              onPress={bekreft}
              disabled={sperre != null}
              className={`items-center rounded-lg px-6 py-4 ${sperre ? "bg-gray-300" : "bg-blue-600 active:bg-blue-700"}`}
            >
              <Text className="text-base font-semibold text-white">{t("timer.fravaerKort.bekreft")}</Text>
            </Pressable>
          </KnappMedForklaring>
        </TastaturScrollView>
        {velgerFor && (
          <LonnsartVelgerModal
            valgtId={linjer.find((l) => l.key === velgerFor)?.lonnsartId ?? ""}
            organizationId={organizationId}
            bareFravaer
            onVelg={(id) => {
              const l = linjer.find((x) => x.key === velgerFor);
              if (l) velgArt(l, id);
              setVelgerFor(null);
            }}
            onLukk={() => setVelgerFor(null)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
