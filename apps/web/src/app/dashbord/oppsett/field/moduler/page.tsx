"use client";

import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import { PROSJEKT_MODULER } from "@sitedoc/shared";
import {
  FileCheck,
  ShieldAlert,
  ClipboardList,
  Box,
  Plus,
  Check,
  Package,
  ToggleRight,
  BarChart3,
  FileSearch,
  Globe,
  Settings,
} from "lucide-react";
import { useState } from "react";

/* Ikon-mapping fra strengnavn til komponent */
const IKON_MAP: Record<string, React.ReactNode> = {
  FileCheck: <FileCheck className="h-6 w-6" />,
  ShieldAlert: <ShieldAlert className="h-6 w-6" />,
  ClipboardList: <ClipboardList className="h-6 w-6" />,
  Box: <Box className="h-6 w-6" />,
  BarChart3: <BarChart3 className="h-6 w-6" />,
  FileSearch: <FileSearch className="h-6 w-6" />,
  Globe: <Globe className="h-6 w-6" />,
};

const MOTOR_INFO: Record<string, { navn: string; beskrivelse: string; betalt: boolean }> = {
  "opus-mt": { navn: "OPUS-MT (gratis)", beskrivelse: "Selvhostet maskinoversettelse. God for enkle tekster.", betalt: false },
  "google": { navn: "Google Translate", beskrivelse: "Høy kvalitet med kontekstforståelse. Krever API-nøkkel.", betalt: true },
  "deepl": { navn: "DeepL", beskrivelse: "Beste kvalitet for europeiske språk. Krever API-nøkkel.", betalt: true },
};

export default function ModulerSide() {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();

  const KATEGORI_LABEL: Record<string, string> = {
    oppgave: t("moduler.oppgavemal"),
    sjekkliste: t("moduler.sjekklistemal"),
    funksjon: t("moduler.funksjon"),
  };

  const { data: aktiveModuler, isLoading } = trpc.modul.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const utils = trpc.useUtils();

  const aktiverMutation = trpc.modul.aktiver.useMutation({
    onSuccess: () => {
      utils.modul.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.mal.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const deaktiverMutation = trpc.modul.deaktiver.useMutation({
    onSuccess: () => {
      utils.modul.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Bygg map over aktive moduler
  const aktivMap = new Map(
    (aktiveModuler ?? []).map((m) => [m.moduleSlug, m]),
  );

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sitedoc-primary/10 p-2">
            <Package className="h-5 w-5 text-sitedoc-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t("oppsett.moduler")}</h2>
            <p className="text-sm text-gray-500">
              {t("moduler.beskrivelse")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROSJEKT_MODULER.map((modul) => {
          const dbModul = aktivMap.get(modul.slug);
          const erAktiv = dbModul?.active === true;
          const erPending =
            (aktiverMutation.isPending && aktiverMutation.variables?.moduleSlug === modul.slug) ||
            (deaktiverMutation.isPending && deaktiverMutation.variables?.moduleSlug === modul.slug);

          return (
            <div
              key={modul.slug}
              className={`relative flex flex-col rounded-xl border p-5 transition-all ${
                erAktiv
                  ? "border-green-200 bg-green-50/50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              {/* Status-badge */}
              {erAktiv && (
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <Check className="h-3 w-3" />
                  {t("moduler.aktiv")}
                </div>
              )}

              {/* Ikon og tittel */}
              <div className="mb-3 flex items-start gap-3">
                <div
                  className={`rounded-lg p-2.5 ${
                    erAktiv
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {IKON_MAP[modul.ikon] ?? <Package className="h-6 w-6" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{modul.navn}</h3>
                  <span className="text-xs text-gray-400">
                    {KATEGORI_LABEL[modul.kategori] ?? modul.kategori}
                    {modul.maler.length > 0 && (
                      <>{" · "}{modul.maler.length} {modul.maler.length === 1 ? t("moduler.mal") : t("moduler.mal")}</>
                    )}
                  </span>
                </div>
              </div>

              {/* Beskrivelse */}
              <p className="mb-4 flex-1 text-sm text-gray-600">
                {modul.beskrivelse}
              </p>

              {/* Mal-detaljer */}
              {modul.maler.length > 0 && (
              <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                {modul.maler.map((mal) => (
                  <div key={mal.prefix} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{mal.navn}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-600">
                        {mal.prefix}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {mal.objekter.length} {t("moduler.felter")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              )}

              {/* Emner (hvis tilgjengelig) */}
              {modul.maler.some((m) => m.emner && m.emner.length > 0) && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {modul.maler
                    .flatMap((m) => m.emner ?? [])
                    .map((emne) => (
                      <span
                        key={emne}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500"
                      >
                        {emne}
                      </span>
                    ))}
                </div>
              )}

              {/* Oversettelsesinnstillinger — inline i kortet */}
              {erAktiv && modul.slug === "oversettelse" && prosjektId && (
                <div className="mb-4">
                  <OversettelsesInnstillinger prosjektId={prosjektId} />
                </div>
              )}

              {/* Handling */}
              {erAktiv ? (
                <button
                  onClick={() => {
                    if (confirm(`Deaktiver modulen «${modul.navn}»? Eksisterende maler og data beholdes.`)) {
                      deaktiverMutation.mutate({
                        projectId: prosjektId!,
                        moduleSlug: modul.slug,
                      });
                    }
                  }}
                  disabled={erPending}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <ToggleRight className="h-4 w-4" />
                  {erPending ? "Deaktiverer..." : t("moduler.deaktiver")}
                </button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    aktiverMutation.mutate({
                      projectId: prosjektId!,
                      moduleSlug: modul.slug,
                    });
                  }}
                  disabled={erPending}
                  className="w-full"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {erPending ? "Aktiverer..." : "Legg til"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Oversettelsesinnstillinger                                         */
/* ------------------------------------------------------------------ */

function OversettelsesInnstillinger({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data } = trpc.modul.hentOversettelsesInnstillinger.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const [motor, setMotor] = useState<string>(data?.motor ?? "opus-mt");
  const [apiKey, setApiKey] = useState(data?.apiKey ?? "");
  const [lagret, setLagret] = useState(false);

  // Synk state når data lastes
  if (data && motor === "opus-mt" && data.motor !== "opus-mt" && !lagret) {
    setMotor(data.motor);
    setApiKey(data.apiKey ?? "");
  }

  const oppdaterMut = trpc.modul.oppdaterOversettelsesInnstillinger.useMutation({
    onSuccess: () => {
      utils.modul.hentOversettelsesInnstillinger.invalidate({ projectId: prosjektId });
      setLagret(true);
      setTimeout(() => setLagret(false), 2000);
    },
  });

  const valgtMotor = MOTOR_INFO[motor] ?? MOTOR_INFO["opus-mt"]!;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <label className="mb-2 block text-xs font-semibold text-gray-700">Oversettelsesmotor</label>
      <div className="flex flex-col gap-1.5">
        {Object.entries(MOTOR_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setMotor(key)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-all ${
              motor === key
                ? "border-sitedoc-primary bg-white shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <span className={motor === key ? "font-semibold text-sitedoc-primary" : "text-gray-700"}>{info.navn}</span>
            {info.betalt && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Betalt</span>
            )}
          </button>
        ))}
      </div>

      {valgtMotor.betalt && (
        <div className="mt-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API-nøkkel..."
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
          />
          <a
            href={motor === "google" ? "https://console.cloud.google.com/apis/credentials" : "https://www.deepl.com/your-account/keys"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[10px] text-sitedoc-secondary hover:underline"
          >
            {motor === "google" ? "Hent nøkkel fra Google Cloud Console →" : "Hent nøkkel fra DeepL →"}
          </a>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          disabled={oppdaterMut.isPending || (valgtMotor.betalt && !apiKey)}
          onClick={() => {
            oppdaterMut.mutate({
              projectId: prosjektId,
              motor: motor as "opus-mt" | "google" | "deepl",
              apiKey: valgtMotor.betalt ? apiKey : undefined,
            });
          }}
          className="rounded bg-sitedoc-primary px-3 py-1 text-xs font-medium text-white hover:bg-sitedoc-secondary disabled:opacity-50"
        >
          {oppdaterMut.isPending ? t("handling.lagrer") : t("handling.lagre")}
        </button>
        {lagret && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" /> Lagret
          </span>
        )}
      </div>
    </div>
  );
}
