"use client";

import { useState } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import {
  Brain,
  Key,
  Sliders,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";

export default function AiSokSide() {
  const { prosjektId } = useProsjekt();

  const { data: innstillinger, isLoading: lasterInnstillinger } =
    trpc.aiSok.hentInnstillinger.useQuery(
      { projectId: prosjektId! },
      { enabled: !!prosjektId },
    );

  const { data: status, refetch: oppdaterStatus } =
    trpc.aiSok.embeddingStatus.useQuery(
      { projectId: prosjektId! },
      { enabled: !!prosjektId, refetchInterval: 5000 },
    );

  const utils = trpc.useUtils();

  // Lokale state for redigering
  const [embeddingProvider, setEmbeddingProvider] = useState("local");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("norbert2");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmProvider, setLlmProvider] = useState("claude");
  const [llmModel, setLlmModel] = useState("claude-sonnet-4-5");

  // Vekter
  const [recall, setRecall] = useState(0.5);
  const [precision, setPrecision] = useState(0.5);
  const [latency, setLatency] = useState(0.5);

  const [harEndringer, setHarEndringer] = useState(false);
  const [lagret, setLagret] = useState(false);

  const oppdaterMut = trpc.aiSok.oppdaterInnstillinger.useMutation({
    onSuccess: () => {
      utils.aiSok.hentInnstillinger.invalidate({ projectId: prosjektId! });
      setHarEndringer(false);
      setLagret(true);
      setTimeout(() => setLagret(false), 2000);
    },
  });

  const genererMut = trpc.aiSok.genererEmbeddings.useMutation({
    onSuccess: () => {
      oppdaterStatus();
    },
  });

  const stoppMut = trpc.aiSok.stoppEmbeddings.useMutation({
    onSuccess: () => {
      oppdaterStatus();
    },
  });

  function lagreInnstillinger() {
    if (!prosjektId) return;
    oppdaterMut.mutate({
      projectId: prosjektId,
      embeddingProvider,
      embeddingModel,
      ...(embeddingApiKey ? { embeddingApiKey } : {}),
      llmProvider,
      llmModel,
      ...(llmApiKey ? { llmApiKey } : {}),
      vekter: { recall, precision, latency },
    });
  }

  if (lasterInnstillinger) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const erLokal = embeddingProvider === "local";
  const harApiNøkkel = erLokal || innstillinger?.embeddingApiKey != null;
  const prosent =
    status && status.totalt > 0
      ? Math.round((status.ferdig / status.totalt) * 100)
      : 0;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sitedoc-primary/10 p-2">
            <Brain className="h-5 w-5 text-sitedoc-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI-søk</h2>
            <p className="text-sm text-gray-500">
              Konfigurer embedding-modell, LLM og søkeparametere
            </p>
          </div>
        </div>
      </div>

      {/* Embedding-status */}
      {status && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Info className="h-4 w-4 text-gray-400" />
            Embedding-status
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {status.totalt.toLocaleString("nb-NO")}
              </div>
              <div className="text-xs text-gray-500">Totalt chunks</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {status.ferdig.toLocaleString("nb-NO")}
              </div>
              <div className="text-xs text-gray-500">Ferdig</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {status.ventende.toLocaleString("nb-NO")}
              </div>
              <div className="text-xs text-gray-500">Ventende</div>
            </div>
          </div>

          {status.totalt > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span>{prosent}% ferdig</span>
                {status.prosesserer && (
                  <span className="flex items-center gap-1 text-sitedoc-primary">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Genererer...
                  </span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${prosent}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {status.prosesserer ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => stoppMut.mutate({ projectId: prosjektId! })}
                disabled={stoppMut.isPending}
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Stopp
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => genererMut.mutate({ projectId: prosjektId! })}
                disabled={genererMut.isPending || !harApiNøkkel}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {status.ventende > 0 ? "Generer embeddings" : "Re-generer alle"}
              </Button>
            )}
          </div>

          {!harApiNøkkel && (
            <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              Legg inn OpenAI API-nøkkel, eller bytt til NorBERT (lokal)
            </p>
          )}
        </div>
      )}

      {/* Embedding-innstillinger */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Key className="h-4 w-4 text-gray-400" />
          Embedding-modell
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Provider
            </label>
            <select
              value={embeddingProvider}
              onChange={(e) => {
                const v = e.target.value;
                setEmbeddingProvider(v);
                setEmbeddingModel(v === "local" ? "norbert2" : "text-embedding-3-small");
                setHarEndringer(true);
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="local">NorBERT (lokal, norsk, gratis)</option>
              <option value="openai">OpenAI (sky, flerspråklig)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Modell
            </label>
            {erLokal ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                ltgoslo/norbert2 — 768 dimensjoner, optimalisert for norsk
              </div>
            ) : (
              <select
                value={embeddingModel}
                onChange={(e) => {
                  setEmbeddingModel(e.target.value);
                  setHarEndringer(true);
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="text-embedding-3-small">
                  text-embedding-3-small (1536 dim)
                </option>
                <option value="text-embedding-3-large">
                  text-embedding-3-large (3072 dim)
                </option>
              </select>
            )}
          </div>

          {!erLokal && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                OpenAI API-nøkkel
              </label>
              <input
                type="password"
                value={embeddingApiKey}
                onChange={(e) => {
                  setEmbeddingApiKey(e.target.value);
                  setHarEndringer(true);
                }}
                placeholder={
                  innstillinger?.embeddingApiKey
                    ? `Lagret (${innstillinger.embeddingApiKey})`
                    : "sk-..."
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* LLM-innstillinger */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Brain className="h-4 w-4 text-gray-400" />
          LLM (RAG-svar)
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Provider
            </label>
            <select
              value={llmProvider}
              onChange={(e) => {
                setLlmProvider(e.target.value);
                setHarEndringer(true);
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="none">Ingen (kun søk)</option>
              <option value="claude">Anthropic Claude</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          {llmProvider !== "none" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Modell
                </label>
                <select
                  value={llmModel}
                  onChange={(e) => {
                    setLlmModel(e.target.value);
                    setHarEndringer(true);
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {llmProvider === "claude" ? (
                    <>
                      <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                      <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
                    </>
                  ) : (
                    <>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o mini</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  API-nøkkel
                </label>
                <input
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => {
                    setLlmApiKey(e.target.value);
                    setHarEndringer(true);
                  }}
                  placeholder={
                    innstillinger?.llmApiKey
                      ? `Lagret (${innstillinger.llmApiKey})`
                      : llmProvider === "claude"
                        ? "sk-ant-..."
                        : "sk-..."
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Søkevekter */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Sliders className="h-4 w-4 text-gray-400" />
          Søkeparametere
        </h3>

        <div className="space-y-4">
          <VektSlider
            label="Recall (semantisk likhet)"
            verdi={recall}
            onChange={(v) => {
              setRecall(v);
              setHarEndringer(true);
            }}
            beskrivelse="Høy = vektlegger betydning, lav = vektlegger eksakte ord"
          />
          <VektSlider
            label="Precision (eksakt matching)"
            verdi={precision}
            onChange={(v) => {
              setPrecision(v);
              setHarEndringer(true);
            }}
            beskrivelse="Høy = prioriterer nøyaktige treff, lav = bredere resultater"
          />
          <VektSlider
            label="Latency (dokumentstørrelse)"
            verdi={latency}
            onChange={(v) => {
              setLatency(v);
              setHarEndringer(true);
            }}
            beskrivelse="Høy = foretrekker kortere dokumenter, lav = ingen preferanse"
          />
        </div>
      </div>

      {/* Lagre-knapp */}
      <div className="flex items-center gap-3">
        <Button
          onClick={lagreInnstillinger}
          disabled={!harEndringer || oppdaterMut.isPending}
        >
          {oppdaterMut.isPending ? "Lagrer..." : "Lagre innstillinger"}
        </Button>
        {lagret && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Lagret
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Vekt-slider komponent ----

function VektSlider({
  label,
  verdi,
  onChange,
  beskrivelse,
}: {
  label: string;
  verdi: number;
  onChange: (v: number) => void;
  beskrivelse: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <span className="text-xs font-mono text-gray-400">
          {verdi.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={verdi}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sitedoc-primary"
      />
      <p className="text-[11px] text-gray-400">{beskrivelse}</p>
    </div>
  );
}
