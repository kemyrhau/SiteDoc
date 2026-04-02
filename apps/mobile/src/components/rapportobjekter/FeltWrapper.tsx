import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useState, type ReactNode } from "react";
import { Plus, Info, Globe } from "lucide-react-native";
import type { Vedlegg } from "../../hooks/useSjekklisteSkjema";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

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
  children,
}: FeltWrapperProps) {
  const [visHjelpetekst, setVisHjelpetekst] = useState(false);
  const [visOversettelse, setVisOversettelse] = useState(false);
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
        <Text className="text-sm font-medium text-gray-900">{objekt.label}</Text>
        {objekt.required && (
          <View className="rounded bg-red-50 px-1.5 py-0.5">
            <Text className="text-[10px] font-medium text-red-600">Påkrevd</Text>
          </View>
        )}
        {typeof objekt.config.helpText === "string" && objekt.config.helpText && (
          <Pressable onPress={() => setVisHjelpetekst((v) => !v)}>
            <Info size={14} color="#60a5fa" />
          </Pressable>
        )}
        {visOversettKnapp && (
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
          <Text className="text-[10px] uppercase tracking-wider text-gray-400">Original ({originalData.spraak})</Text>
          <Text className="text-xs text-gray-500">{originalData.verdi}</Text>
        </View>
      )}

      {/* Valideringsfeil */}
      {valideringsfeil && (
        <Text className="mt-1 text-xs text-red-500">{valideringsfeil}</Text>
      )}

      {/* Dokumentasjon (kommentar + vedlegg) — skjul for dato/tid-felter */}
      {objekt.type !== "date_time" && (
        <FeltDokumentasjon
          kommentar={kommentar}
          vedlegg={vedlegg}
          onEndreKommentar={onEndreKommentar}
          onLeggTilVedlegg={onLeggTilVedlegg}
          onFjernVedlegg={onFjernVedlegg}
          onErstattVedlegg={onErstattVedlegg}
          onFlyttVedlegg={onFlyttVedlegg}
          leseModus={leseModus}
          sjekklisteId={sjekklisteId}
          oppgaveIdForKo={oppgaveIdForKo}
          objektId={objekt.id}
          skjulKommentar={objekt.type === "text_field"}
        />
      )}

      {/* Oppgave-badge og opprett-knapp (skjul for dato/tid og når vi er i en oppgave) */}
      {objekt.type === "date_time" ? null : !oppgaveIdForKo && oppgaveNummer && oppgaveId ? (
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
          <Text className="text-xs font-medium text-gray-600">Oppgave</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
