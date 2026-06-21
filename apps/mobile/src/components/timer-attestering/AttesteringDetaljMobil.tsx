import { useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Check, RotateCcw, AlertCircle, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";
import { RadCheckbox } from "./RadCheckbox";
import { ReturnerModal } from "./ReturnerModal";
import { isoTidspunktTilHHMM, formatNorskDato } from "../../utils/dato";

type RadBase = {
  id: string;
  projectId: string;
  attestertStatus: string | null;
};

type TimerRad = RadBase & {
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  timer: number | string;
};

type TilleggRad = RadBase & {
  tilleggId: string;
  antall: number | string;
  kommentar: string | null;
};

type MaskinRad = RadBase & {
  vehicleId: string;
  timer: number | string;
  mengde: number | string | null;
  enhet: string | null;
};

function tilTall(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

/**
 * Mobil-versjon av webs AttesteringDetalj. Firma-kontekst (ingen
 * prosjektKontekst-prop) — leder/firma-admin attesterer alle pending-
 * rader på sedelen. Per-rad-checkboxer, container-banner, attester/
 * returner-mutations. Ingen edit-modus eller ECO-flytting (web-only).
 */
export function AttesteringDetaljMobil({
  sheetId,
  tilbakeRute,
}: {
  sheetId: string;
  tilbakeRute: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [returnerVises, setReturnerVises] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [valgteTimer, setValgteTimer] = useState<Set<string>>(new Set());
  const [valgteTillegg, setValgteTillegg] = useState<Set<string>>(new Set());
  const [valgteMaskin, setValgteMaskin] = useState<Set<string>>(new Set());

  const { data: sheet, isLoading } =
    trpc.timer.dagsseddel.hentForAttestering.useQuery(
      { id: sheetId },
      { retry: false },
    );

  const attesterRader = trpc.timer.dagsseddel.attesterRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: sheetId });
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      router.replace(tilbakeRute);
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const timerRader = (sheet?.timer ?? []) as unknown as TimerRad[];
  const tilleggRader = (sheet?.tillegg ?? []) as unknown as TilleggRad[];
  const maskinRader = (sheet?.maskiner ?? []) as unknown as MaskinRad[];

  // Pre-utvalg: alle pending-rader (firma-kontekst — ingen projectId-filter)
  useEffect(() => {
    if (!sheet) return;
    setValgteTimer(
      new Set(
        timerRader.filter((r) => r.attestertStatus === "pending").map((r) => r.id),
      ),
    );
    setValgteTillegg(
      new Set(
        tilleggRader.filter((r) => r.attestertStatus === "pending").map((r) => r.id),
      ),
    );
    setValgteMaskin(
      new Set(
        maskinRader.filter((r) => r.attestertStatus === "pending").map((r) => r.id),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id]);

  const counters = useMemo(() => {
    const alle = [...timerRader, ...tilleggRader, ...maskinRader];
    const total = alle.length;
    const attestert = alle.filter((r) => r.attestertStatus === "attestert").length;
    const returnert = alle.filter((r) => r.attestertStatus === "returnert").length;
    return { total, attestert, returnert, pending: total - attestert - returnert };
  }, [timerRader, tilleggRader, maskinRader]);

  const antallValgt = valgteTimer.size + valgteTillegg.size + valgteMaskin.size;
  const kanHandle = sheet?.status === "sent" && antallValgt > 0;
  const totaltimer = timerRader.reduce((acc, r) => acc + tilTall(r.timer), 0);

  function toggle(
    set: Set<string>,
    id: string,
    oppdater: (s: Set<string>) => void,
  ) {
    const ny = new Set(set);
    if (ny.has(id)) ny.delete(id);
    else ny.add(id);
    oppdater(ny);
  }

  function handleAttester() {
    setFeil(null);
    attesterRader.mutate({
      radIder: {
        timerIder: Array.from(valgteTimer),
        tilleggIder: Array.from(valgteTillegg),
        maskinIder: Array.from(valgteMaskin),
      },
    });
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (!sheet) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-sm text-red-600">
          {t("timer.detalj.ikkeFunnet")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerClassName="pb-32">
        {/* Header-info */}
        <View className="border-b border-gray-200 bg-white px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">
            {formatNorskDato(sheet.dato as unknown as string)}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-600">
            {sheet.prosjekt?.name ?? t("timer.detalj.ukjentProsjekt")}
            {sheet.prosjekt?.projectNumber
              ? ` (${sheet.prosjekt.projectNumber})`
              : ""}
          </Text>
          {sheet.ansatt && (
            <Text className="mt-0.5 text-sm text-gray-600">
              {t("timer.attestering.kol.ansatt")}:{" "}
              <Text className="font-medium text-gray-900">
                {sheet.ansatt.name ?? sheet.ansatt.email}
              </Text>
              {sheet.ansatt.ansattnummer ? (
                <Text className="text-xs text-gray-500">
                  {"  #"}
                  {sheet.ansatt.ansattnummer}
                </Text>
              ) : null}
            </Text>
          )}
        </View>

        {/* Container-status-banner */}
        {counters.total > 0 && (
          <View
            className={`mx-4 mt-4 rounded-lg border p-3 ${
              counters.pending === 0
                ? "border-green-200 bg-green-50"
                : counters.attestert > 0 || counters.returnert > 0
                  ? "border-amber-200 bg-amber-50"
                  : "border-gray-200 bg-gray-50"
            }`}
          >
            <Text
              className={`text-sm ${
                counters.pending === 0
                  ? "text-green-900"
                  : counters.attestert > 0 || counters.returnert > 0
                    ? "text-amber-900"
                    : "text-gray-700"
              }`}
            >
              {counters.pending === 0
                ? t("timer.attestering.container.alleBehandlet", {
                    attestert: counters.attestert,
                    returnert: counters.returnert,
                  })
                : counters.attestert > 0 || counters.returnert > 0
                  ? t("timer.attestering.container.delvis", {
                      attestert: counters.attestert,
                      returnert: counters.returnert,
                      pending: counters.pending,
                      total: counters.total,
                    })
                  : t("timer.attestering.container.pending", {
                      total: counters.total,
                    })}
            </Text>
          </View>
        )}

        {/* Sedel-detaljer read-only */}
        <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold text-gray-900">
            {t("timer.detalj.detaljer")}
          </Text>
          <View className="flex-row gap-3">
            <Felt
              label={t("timer.felt.startTid")}
              verdi={isoTidspunktTilHHMM(sheet.startAt as string | null) || "—"}
            />
            <Felt
              label={t("timer.felt.sluttTid")}
              verdi={isoTidspunktTilHHMM(sheet.endAt as string | null) || "—"}
            />
            <Felt label={t("timer.felt.pauseMin")} verdi={`${sheet.pauseMin} min`} />
          </View>
          {sheet.aktivitet && (
            <Text className="mt-3 text-xs text-gray-500">
              {t("timer.felt.aktivitet")}: {sheet.aktivitet.navn}
            </Text>
          )}
          {sheet.beskrivelse && (
            <Text className="mt-1 text-xs text-gray-500">
              {sheet.beskrivelse}
            </Text>
          )}
        </View>

        {/* Slice 4b-2: kontroll-badges — system-bestemt slutt-tid + arbeidstid
            over terskel (inkl. reise). Varsel, ikke blokkering. */}
        {sheet.sluttTidKilde === "system" && (
          <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <AlertTriangle size={14} color="#b45309" />
            <Text className="flex-1 text-xs text-amber-900">
              {t("timer.attestering.systemSluttBadge")}
            </Text>
          </View>
        )}
        {totaltimer > (sheet.arbeidstidVarselTimer ?? 13) && (
          <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
            <AlertTriangle size={14} color="#b91c1c" />
            <Text className="flex-1 text-xs text-red-900">
              {t("timer.attestering.arbeidstidVarsel", {
                timer: totaltimer.toFixed(2),
                terskel: sheet.arbeidstidVarselTimer ?? 13,
              })}
            </Text>
          </View>
        )}

        {/* Timer-rader */}
        <Seksjon
          tittel={t("timer.detalj.timerRader")}
          undertittel={`${totaltimer.toFixed(2)} ${t("timer.timerEnhet")}`}
          tom={timerRader.length === 0}
        >
          {timerRader.map((rad) => (
            <RadCheckbox
              key={rad.id}
              valgt={valgteTimer.has(rad.id)}
              tilgjengelig={rad.attestertStatus === "pending"}
              status={rad.attestertStatus}
              hovedtekst={`${tilTall(rad.timer).toFixed(2)} ${t("timer.timerEnhet")}`}
              undertekst={null}
              hoyreVerdi={undefined}
              onTrykk={() => toggle(valgteTimer, rad.id, setValgteTimer)}
            />
          ))}
        </Seksjon>

        {/* Tillegg-rader */}
        <Seksjon
          tittel={t("timer.detalj.tilleggRader")}
          tom={tilleggRader.length === 0}
        >
          {tilleggRader.map((rad) => (
            <RadCheckbox
              key={rad.id}
              valgt={valgteTillegg.has(rad.id)}
              tilgjengelig={rad.attestertStatus === "pending"}
              status={rad.attestertStatus}
              hovedtekst={`${tilTall(rad.antall).toFixed(2)}`}
              undertekst={rad.kommentar ?? null}
              hoyreVerdi={undefined}
              onTrykk={() => toggle(valgteTillegg, rad.id, setValgteTillegg)}
            />
          ))}
        </Seksjon>

        {/* Maskin-rader */}
        <Seksjon
          tittel={t("timer.detalj.maskinRader")}
          tom={maskinRader.length === 0}
        >
          {maskinRader.map((rad) => (
            <RadCheckbox
              key={rad.id}
              valgt={valgteMaskin.has(rad.id)}
              tilgjengelig={rad.attestertStatus === "pending"}
              status={rad.attestertStatus}
              hovedtekst={`${tilTall(rad.timer).toFixed(2)} ${t("timer.timerEnhet")}`}
              undertekst={
                rad.mengde !== null
                  ? `${tilTall(rad.mengde)} ${rad.enhet ?? ""}`
                  : null
              }
              hoyreVerdi={undefined}
              onTrykk={() => toggle(valgteMaskin, rad.id, setValgteMaskin)}
            />
          ))}
        </Seksjon>

        {feil && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={16} color="#b91c1c" />
              <Text className="flex-1 text-sm text-red-700">{feil}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bunn-action-bar */}
      <View className="border-t border-gray-200 bg-white p-4">
        <Text className="mb-2 text-center text-xs text-gray-500">
          {t("timer.attestering.radValg.antallValgt", { antall: antallValgt })}
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setReturnerVises(true)}
            disabled={!kanHandle}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-red-300 bg-white py-3 active:bg-red-50 disabled:opacity-40"
            style={!kanHandle ? { opacity: 0.4 } : undefined}
          >
            <RotateCcw size={16} color="#dc2626" />
            <Text className="text-base font-medium text-red-600">
              {t("timer.attestering.radValg.returnerValgte")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleAttester}
            disabled={!kanHandle || attesterRader.isPending}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-green-600 py-3 active:bg-green-700 disabled:opacity-40"
            style={
              !kanHandle || attesterRader.isPending ? { opacity: 0.4 } : undefined
            }
          >
            <Check size={16} color="#ffffff" />
            <Text className="text-base font-semibold text-white">
              {attesterRader.isPending
                ? t("handling.lagrer")
                : t("timer.attestering.radValg.attesterValgte")}
            </Text>
          </Pressable>
        </View>
      </View>

      {returnerVises && (
        <ReturnerModal
          radIder={{
            timerIder: Array.from(valgteTimer),
            tilleggIder: Array.from(valgteTillegg),
            maskinIder: Array.from(valgteMaskin),
          }}
          onLukket={() => {
            setReturnerVises(false);
            router.replace(tilbakeRute);
          }}
          onLukk={() => setReturnerVises(false)}
        />
      )}
    </View>
  );
}

function Felt({ label, verdi }: { label: string; verdi: string }) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="text-base text-gray-900">{verdi}</Text>
    </View>
  );
}

function Seksjon({
  tittel,
  undertittel,
  tom,
  children,
}: {
  tittel: string;
  undertittel?: string;
  tom: boolean;
  children: React.ReactNode;
}) {
  if (tom) return null;
  return (
    <View className="mt-4">
      <View className="border-b border-gray-200 bg-white px-4 py-2">
        <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {tittel}
          {undertittel && (
            <Text className="text-xs font-normal text-gray-500"> · {undertittel}</Text>
          )}
        </Text>
      </View>
      {children}
    </View>
  );
}
