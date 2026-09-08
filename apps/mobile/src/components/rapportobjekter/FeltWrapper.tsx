import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useState, type ReactNode } from "react";
import { Plus, Info, Globe } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { oversettStandardtekst, type ReportObjectType } from "@sitedoc/shared";
import type { Vedlegg, Tilfoyelse } from "../../hooks/useSjekklisteSkjema";
import { FeltDokumentasjon } from "./FeltDokumentasjon";
import { tilbehorVisning } from "./RapportObjektRenderer";

/** Felttyper som ikke skal ha vedlegg/kommentar eller oppgave-badge */
const SKJUL_VEDLEGG_TYPER = new Set(["date", "date_time", "weather"]);

function formaterTilfoyelseTid(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tilfoyelseVerdiTekst(verdi: unknown): string {
  if (verdi == null) return "";
  if (typeof verdi === "string" || typeof verdi === "number" || typeof verdi === "boolean") return String(verdi);
  if (Array.isArray(verdi)) return verdi.map((v) => tilfoyelseVerdiTekst(v)).filter(Boolean).join(", ");
  return JSON.stringify(verdi);
}

interface FeltWrapperProps {
  objekt: {
    id: string;
    type: string;
    label: string;
    required: boolean;
    config: Record<string, unknown>;
  };
  kommentar: string;
  vedlegg: Vedlegg[];
  onEndreKommentar: (kommentar: string) => void;
  onLeggTilVedlegg: (vedlegg: Vedlegg) => void;
  onFjernVedlegg: (vedleggId: string) => void;
  onErstattVedlegg?: (vedleggId: string, nyUrl: string, nyttFilnavn: string) => void;
  onFlyttVedlegg?: (vedleggId: string, retning: "opp" | "ned") => void;
  leseModus?: boolean;
  sjekklisteId?: string;
  oppgaveIdForKo?: string;
  /** @deprecated Bruk nestingNivå istedenfor */
  erBetinget?: boolean;
  nestingNivå?: number;
  valideringsfeil?: string;
  oppgaveNummer?: string;
  oppgaveId?: string;
  onOpprettOppgave?: () => void;
  onNavigerTilOppgave?: (id: string) => void;
  /** Oversettelser for firmainnhold (on-demand, Lag 2) */
  oversettelser?: Record<string, string>;
  oversettelseLaster?: boolean;
  onOversett?: () => void;
  visOversettKnapp?: boolean;
  /** Original fritekst-data (Lag 3: arbeiderens originaltekst) */
  originalData?: { spraak: string; verdi?: string; kommentar?: string };
  /** Tapende verdier notert ved kollisjon (feltvis merge-deteksjon) — vises feltnært. */
  tilfoyelser?: Tilfoyelse[];
  children: ReactNode;
}

export function FeltWrapper({
  objekt,
  kommentar,
  vedlegg,
  onEndreKommentar,
  onLeggTilVedlegg,
  onFjernVedlegg,
  onErstattVedlegg,
  onFlyttVedlegg,
  leseModus,
  sjekklisteId,
  oppgaveIdForKo,
  erBetinget,
  nestingNivå = 0,
  valideringsfeil,
  oppgaveNummer,
  oppgaveId,
  onOpprettOppgave,
  onNavigerTilOppgave,
  oversettelser,
  oversettelseLaster,
  onOversett,
  visOversettKnapp,
  originalData,
  tilfoyelser,
  children,
}: FeltWrapperProps) {
  const { t } = useTranslation();
  const [visHjelpetekst, setVisHjelpetekst] = useState(false);
  const [visOversettelse, setVisOversettelse] = useState(false);
  // Seedet standard type-default-label → oversett via i18n (skjul Globe — ikke firmainnhold).
  const standardLabel = oversettStandardtekst(objekt.label, t, objekt.type as ReportObjectType);
  const oversattLabel = oversettelser?.[objekt.label];
  const oversattHjelpetekst = typeof objekt.config.helpText === "string" ? oversettelser?.[objekt.config.helpText] : undefined;

  // Bakoverkompatibilitet: erBetinget → nestingNivå=1
  const effektivNivå = nestingNivå > 0 ? nestingNivå : (erBetinget ? 1 : 0);

  // Gradert innrykk: ml-4 per nivå, maks ml-12
  const marginKlasse = effektivNivå > 0
    ? effektivNivå === 1 ? "ml-4" : effektivNivå === 2 ? "ml-8" : "ml-12"
    : "";
  const rammeKlasse = "";

  return (
    <View
      className={`rounded-lg bg-white p-4 ${marginKlasse} ${rammeKlasse}`}
    >
      {/* Label + påkrevd-badge + hjelpetekst + oversettelse */}
      <View className="mb-2 flex-row items-center gap-2">
        <Text className="text-sm font-medium text-gray-900">{standardLabel ?? objekt.label}</Text>
        {objekt.required && (
          <View className="rounded bg-red-50 px-1.5 py-0.5">
            <Text className="text-[10px] font-medium text-red-600">{t("felt.paakrevd")}</Text>
          </View>
        )}
        {typeof objekt.config.helpText === "string" && objekt.config.helpText && (
          <Pressable onPress={() => setVisHjelpetekst((v) => !v)}>
            <Info size={14} color="#60a5fa" />
          </Pressable>
        )}
        {visOversettKnapp && !standardLabel && (
          <Pressable
            onPress={() => {
              if (!oversattLabel && onOversett) onOversett();
              setVisOversettelse((v) => !v);
            }}
          >
            {oversettelseLaster ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Globe size={14} color={visOversettelse && oversattLabel ? "#1e40af" : "#93c5fd"} />
            )}
          </Pressable>
        )}
      </View>
      {visOversettelse && oversattLabel && (
        <Text className="mb-1 text-xs italic text-blue-600">{oversattLabel}</Text>
      )}
      {visHjelpetekst && typeof objekt.config.helpText === "string" && (
        <View className="mb-2">
          <Text className="text-xs text-gray-500">{objekt.config.helpText}</Text>
          {visOversettelse && oversattHjelpetekst && (
            <Text className="mt-0.5 text-xs italic text-blue-500">{oversattHjelpetekst}</Text>
          )}
        </View>
      )}

      {/* Typespesifikk input */}
      {children}

      {/* Original fritekst (Lag 3: arbeiderens tekst på originalspråk) */}
      {originalData?.verdi && (
        <View className="mt-1 rounded bg-gray-50 px-2 py-1.5">
          <Text className="text-[10px] uppercase tracking-wider text-gray-400">{t("felt.original", { spraak: originalData.spraak })}</Text>
          <Text className="text-xs text-gray-500">{originalData.verdi}</Text>
        </View>
      )}

      {/* Tapende verdier ved kollisjon (feltvis merge-deteksjon). Feltnært og synlig —
          den som skal rette etterpå ser hva som ble notert, av hvem, når. Ingenting slettes. */}
      {tilfoyelser && tilfoyelser.length > 0 && (
        <View className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            {t("kollisjon.notat.tittel")}
          </Text>
          <View className="mt-1 gap-1.5">
            {tilfoyelser.map((til, i) => (
              <View key={`${til.tidspunkt}-${i}`} className="border-l-2 border-amber-300 pl-2">
                <Text className="text-sm text-gray-800">{tilfoyelseVerdiTekst(til.verdi)}</Text>
                <Text className="text-[11px] text-amber-700">
                  {til.brukerNavn}
                  {til.tidspunkt ? ` · ${formaterTilfoyelseTid(til.tidspunkt)}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Valideringsfeil */}
      {valideringsfeil && (
        <Text className="mt-1 text-xs text-red-500">{valideringsfeil}</Text>
      )}

      {/* Dokumentasjon (kommentar + vedlegg) — funn 6: fjernet for date/date_time/weather/
          drawing_position/location; repeater vises read-only kun når det finnes data. */}
      {(() => {
        const harData = !!kommentar?.trim() || (vedlegg?.length ?? 0) > 0;
        const tv = tilbehorVisning(objekt.type, !!leseModus, harData);
        return tv.vis ? (
          <FeltDokumentasjon
            kommentar={kommentar}
            vedlegg={vedlegg}
            onEndreKommentar={onEndreKommentar}
            onLeggTilVedlegg={onLeggTilVedlegg}
            onFjernVedlegg={onFjernVedlegg}
            onErstattVedlegg={onErstattVedlegg}
            onFlyttVedlegg={onFlyttVedlegg}
            leseModus={tv.leseModus}
            sjekklisteId={sjekklisteId}
            oppgaveIdForKo={oppgaveIdForKo}
            objektId={objekt.id}
            skjulKommentar={objekt.type === "text_field"}
          />
        ) : null;
      })()}

      {/* Oppgave-badge og opprett-knapp (skjul for dato/vær og når vi er i en oppgave) */}
      {SKJUL_VEDLEGG_TYPER.has(objekt.type) ? null : !oppgaveIdForKo && oppgaveNummer && oppgaveId ? (
        <Pressable
          onPress={() => onNavigerTilOppgave?.(oppgaveId)}
          className="mt-2 self-start rounded-full bg-blue-100 px-3 py-1"
        >
          <Text className="text-xs font-medium text-blue-700">{oppgaveNummer}</Text>
        </Pressable>
      ) : !leseModus && onOpprettOppgave && !oppgaveNummer ? (
        <Pressable
          onPress={onOpprettOppgave}
          className="mt-2 flex-row items-center gap-1 self-start rounded-full bg-gray-100 px-2.5 py-1"
        >
          <Plus size={12} color="#6b7280" />
          <Text className="text-xs font-medium text-gray-600">{t("felt.oppgave")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
