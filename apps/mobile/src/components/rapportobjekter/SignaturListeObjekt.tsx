import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList, TextInput, ActivityIndicator } from "react-native";
import { PenLine, UserPlus, Lock, CheckCircle2, AlertTriangle, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { signaturTidspunktNaa, formaterSignaturTidspunkt } from "@sitedoc/shared";
import { trpc } from "../../lib/trpc";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";
import type { RapportObjektProps } from "./typer";

/** Veggklokke fra signertTidspunkt, fallback completedAt (UTC). */
function visTid(sig: { signertTidspunkt?: string | null; completedAt?: string | Date | null } | undefined): string {
  if (!sig) return "";
  const lokal = formaterSignaturTidspunkt(sig.signertTidspunkt ?? null);
  if (lokal) return lokal;
  return sig.completedAt ? new Date(sig.completedAt).toLocaleDateString("nb-NO") : "";
}

interface Medlem {
  id: string;
  user: { id: string; name: string | null; email: string };
}

/**
 * Signaturliste (SJA/HMS-runder) — mobil. Fabel-ordre 2026-09-06. Speiler web-
 * objektet: leder «X av Y signert», manko FØRST (amber) med «Signer» på egen rad
 * (gated), gjest signeres på ansvarliges enhet, låst runde vist. Data server-side
 * (trpc.signatur) — krever tilkobling (felt-signering skjer der og da).
 */
export function SignaturListeObjekt({ objekt, sjekklisteId, oppgaveIdForKo, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const ref = sjekklisteId ? { checklistId: sjekklisteId } : oppgaveIdForKo ? { taskId: oppgaveIdForKo } : null;

  const [visLeggTil, setVisLeggTil] = useState(false);
  const [gjestNavn, setGjestNavn] = useState("");
  const [gjestFirma, setGjestFirma] = useState("");

  const runderQuery = trpc.signatur.hentRunder.useQuery(ref ?? { checklistId: "" }, { enabled: !!ref });
  const medlemQuery = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && visLeggTil },
  );
  const medlemmer = (medlemQuery.data ?? []) as Medlem[];

  function invalider() {
    if (ref) {
      utils.signatur.hentRunder.invalidate(ref);
      utils.signatur.hentManko.invalidate(ref);
    }
  }

  const signerMut = trpc.signatur.signer.useMutation({ onSuccess: invalider });
  const startRundeMut = trpc.signatur.startRunde.useMutation({ onSuccess: invalider });
  const avsluttMut = trpc.signatur.avsluttRunde.useMutation({ onSuccess: invalider });
  const leggTilMut = trpc.signatur.deltakerLeggTil.useMutation({
    onSuccess: () => {
      invalider();
      setVisLeggTil(false);
      setGjestNavn("");
      setGjestFirma("");
    },
  });

  if (!ref) return null;
  if (runderQuery.isLoading || !runderQuery.data) {
    return (
      <View className="rounded-lg border border-gray-200 p-4">
        <ActivityIndicator />
      </View>
    );
  }

  const { status, runder, deltakere, kanRedigere, minDeltakerId, gjeldendeRundeLaast } = runderQuery.data;
  const gjeldende = runder.find((r) => r.erGjeldende) ?? null;
  const aktive = deltakere.filter((d) => d.aktiv);

  if (!gjeldende) {
    return (
      <View className="rounded-lg border border-gray-200 p-4">
        <View className="mb-2 flex-row items-center gap-2">
          <PenLine size={16} color="#111827" />
          <Text className="text-sm font-semibold text-gray-900">{objekt.label}</Text>
        </View>
        <Text className="text-sm text-gray-500">{t("signaturliste.ingenRunde", "Ingen signaturrunde startet")}</Text>
        {kanRedigere && !leseModus && (
          <Pressable
            onPress={() => startRundeMut.mutate(ref)}
            className="mt-3 self-start rounded-lg bg-blue-600 px-3 py-2"
          >
            <Text className="text-sm font-medium text-white">{t("signaturliste.startRunde", "Start signaturrunde")}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const signertIds = new Set(gjeldende.signaturer.map((s) => s.deltakerId));
  const sigFor = new Map(gjeldende.signaturer.map((s) => [s.deltakerId, s]));
  const manko = aktive.filter((d) => !signertIds.has(d.id));
  const signerte = aktive.filter((d) => signertIds.has(d.id));

  const komplett = status.status === "komplett";

  return (
    <View className="rounded-lg border border-gray-200 p-4">
      {/* Leder */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <PenLine size={16} color="#111827" />
          <Text className="text-sm font-semibold text-gray-900">{objekt.label}</Text>
          <Text className="text-xs text-gray-500">· {t("signaturliste.runde", "Runde {{nr}}", { nr: gjeldende.rundeNr })}</Text>
        </View>
        <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${komplett ? "bg-green-100" : "bg-amber-100"}`}>
          {komplett ? <CheckCircle2 size={14} color="#166534" /> : <AlertTriangle size={14} color="#92400e" />}
          <Text className={`text-xs font-semibold ${komplett ? "text-green-800" : "text-amber-800"}`}>
            {t("signaturliste.status", "{{signert}} av {{av}} signert", { signert: status.signert, av: status.av })}
          </Text>
        </View>
      </View>

      {/* Låst */}
      {gjeldendeRundeLaast && (
        <View className="mb-3 flex-row items-start gap-2 rounded-md bg-gray-100 p-3">
          <Lock size={16} color="#374151" />
          <Text className="flex-1 text-sm text-gray-700">
            {t("signaturliste.laast", "Låst — runde {{nr}} avsluttet {{dato}}. Endring krever ny runde", {
              nr: gjeldende.rundeNr,
              dato: gjeldende.avsluttetAt ? new Date(gjeldende.avsluttetAt).toLocaleDateString("nb-NO") : "",
            })}
          </Text>
        </View>
      )}

      {/* Manko FØRST — amber */}
      {manko.length > 0 && (
        <View className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <Text className="mb-2 text-xs font-semibold uppercase text-amber-800">
            {t("signaturliste.mangler", "Mangler")} ({manko.length})
          </Text>
          {manko.map((d) => {
            const egenRad = minDeltakerId === d.id;
            const kanSignere = !leseModus && !gjeldendeRundeLaast && (egenRad || (d.erGjest && kanRedigere));
            return (
              <View key={d.id} className="mb-2 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-sm text-gray-900">
                    {d.navn}
                    {d.firma ? <Text className="text-gray-500"> · {d.firma}</Text> : null}
                  </Text>
                  {d.erGjest && (
                    <Text className="text-xs text-gray-500">
                      {t("signaturliste.signerPaaAnsvarlig", "signer på ansvarliges enhet")}
                    </Text>
                  )}
                </View>
                {kanSignere && (
                  <Pressable
                    onPress={() => signerMut.mutate({ deltakerId: d.id, signertTidspunkt: signaturTidspunktNaa() })}
                    disabled={signerMut.isPending}
                    className="rounded-lg bg-blue-600 px-3 py-1.5"
                  >
                    <Text className="text-sm font-medium text-white">{t("signaturliste.signer", "Signer")}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Signerte */}
      {signerte.map((d) => {
        const sig = sigFor.get(d.id);
        return (
          <View key={d.id} className="mb-1.5 flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-2">
              <CheckCircle2 size={16} color="#16a34a" />
              <Text className="text-sm text-gray-900">
                {d.navn}
                {d.firma ? <Text className="text-gray-500"> · {d.firma}</Text> : null}
              </Text>
            </View>
            <Text className="text-xs text-gray-500">
              {visTid(sig)}
              {sig?.hmsKortNr ? ` · ${sig.hmsKortNr}` : ""}
            </Text>
          </View>
        );
      })}

      {/* Ansvarlig-handlinger */}
      {kanRedigere && !leseModus && (
        <View className="mt-3 flex-row flex-wrap gap-2 border-t border-gray-100 pt-3">
          {!gjeldendeRundeLaast && (
            <Pressable onPress={() => setVisLeggTil(true)} className="flex-row items-center gap-1 rounded-lg border border-gray-300 px-3 py-2">
              <UserPlus size={16} color="#374151" />
              <Text className="text-sm text-gray-700">{t("signaturliste.leggTilDeltaker", "Legg til deltaker")}</Text>
            </Pressable>
          )}
          {!gjeldendeRundeLaast ? (
            <Pressable
              onPress={() => avsluttMut.mutate({ rundeId: gjeldende.id })}
              disabled={avsluttMut.isPending}
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              <Text className="text-sm text-gray-700">{t("signaturliste.avsluttRunde", "Avslutt runde")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => startRundeMut.mutate(ref)}
              disabled={startRundeMut.isPending}
              className="rounded-lg bg-blue-600 px-3 py-2"
            >
              <Text className="text-sm font-medium text-white">{t("signaturliste.startNyRunde", "Start ny runde")}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Modal: legg til deltaker */}
      <Modal visible={visLeggTil} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisLeggTil(false)}>
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
            <Text className="text-lg font-semibold">{t("signaturliste.leggTilDeltaker", "Legg til deltaker")}</Text>
            <Pressable onPress={() => setVisLeggTil(false)} hitSlop={12}>
              <X size={24} color="#6b7280" />
            </Pressable>
          </View>

          <View className="border-b border-gray-100 p-4">
            <Text className="mb-2 text-sm font-medium text-gray-700">{t("signaturliste.gjest", "Gjest")}</Text>
            <TextInput
              placeholder={t("signaturliste.gjestNavn", "Navn")}
              value={gjestNavn}
              onChangeText={setGjestNavn}
              className="mb-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <TextInput
              placeholder={t("signaturliste.gjestFirma", "Firma")}
              value={gjestFirma}
              onChangeText={setGjestFirma}
              className="mb-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <Pressable
              disabled={!gjestNavn.trim() || leggTilMut.isPending}
              onPress={() => leggTilMut.mutate({ ...ref, guestName: gjestNavn.trim(), guestCompany: gjestFirma.trim() || undefined })}
              className={`self-start rounded-lg px-3 py-2 ${gjestNavn.trim() ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <Text className="text-sm font-medium text-white">{t("signaturliste.leggTilGjest", "Legg til gjest")}</Text>
            </Pressable>
          </View>

          <Text className="px-4 pt-3 text-sm font-medium text-gray-700">{t("signaturliste.prosjektmedlem", "Prosjektmedlem")}</Text>
          <FlatList
            data={medlemmer}
            keyExtractor={(m) => m.user.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => leggTilMut.mutate({ ...ref, userId: item.user.id })}
                className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3"
              >
                <Text className="text-sm text-gray-900">{item.user.name ?? item.user.email}</Text>
                <UserPlus size={18} color="#6b7280" />
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
