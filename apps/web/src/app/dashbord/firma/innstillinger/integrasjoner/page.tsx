"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, Button, Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";
import { Database, Save, Trash2, Check } from "lucide-react";

interface IntegrasjonsTile {
  type: "sentralregisteret";
  tittelKey: string;
  beskrivelseKey: string;
}

const TILES: IntegrasjonsTile[] = [
  {
    type: "sentralregisteret",
    tittelKey: "firma.integrasjoner.sentralregisteret.tittel",
    beskrivelseKey: "firma.integrasjoner.sentralregisteret.beskrivelse",
  },
];

export default function FirmaIntegrasjonerSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: integrasjoner, isLoading } = trpc.firmaIntegrasjon.list.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  if (!orgId) {
    return (
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        <p className="text-sm text-gray-500">
          {t("firma.integrasjoner.velgFirma")}
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {t("firma.integrasjoner.tittel")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("firma.integrasjoner.beskrivelse")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {TILES.map((tile) => {
            const eksisterende = integrasjoner?.find((i) => i.type === tile.type);
            return (
              <IntegrasjonsKort
                key={tile.type}
                organizationId={orgId}
                type={tile.type}
                tittel={t(tile.tittelKey)}
                beskrivelse={t(tile.beskrivelseKey)}
                harNoekkel={!!eksisterende?.harNøkkel}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

function IntegrasjonsKort({
  organizationId,
  type,
  tittel,
  beskrivelse,
  harNoekkel,
}: {
  organizationId: string;
  type: "sentralregisteret";
  tittel: string;
  beskrivelse: string;
  harNoekkel: boolean;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [apiKey, setApiKey] = useState("");
  const [redigerer, setRedigerer] = useState(false);

  const lagre = trpc.firmaIntegrasjon.lagre.useMutation({
    onSuccess: () => {
      utils.firmaIntegrasjon.list.invalidate({ organizationId });
      setApiKey("");
      setRedigerer(false);
    },
  });

  const slett = trpc.firmaIntegrasjon.slett.useMutation({
    onSuccess: () => {
      utils.firmaIntegrasjon.list.invalidate({ organizationId });
      setApiKey("");
      setRedigerer(false);
    },
  });

  function lagreNoekkel() {
    if (!apiKey) return;
    lagre.mutate({ organizationId, type, apiKey });
  }

  function fjernNoekkel() {
    if (!confirm(t("firma.integrasjoner.bekreftFjern"))) return;
    slett.mutate({ organizationId, type });
  }

  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
          <Database className="h-5 w-5 text-blue-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{tittel}</h3>
            {harNoekkel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                <Check className="h-3 w-3" />
                {t("firma.integrasjoner.koblet")}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {t("firma.integrasjoner.ikkeKoblet")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{beskrivelse}</p>
        </div>
      </div>

      {redigerer || !harNoekkel ? (
        <div className="space-y-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              harNoekkel
                ? t("firma.integrasjoner.placeholderEksisterende")
                : t("firma.integrasjoner.placeholderNy")
            }
            autoComplete="new-password"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={lagreNoekkel}
              disabled={!apiKey || lagre.isPending}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {t("handling.lagre")}
            </Button>
            {redigerer && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRedigerer(false);
                  setApiKey("");
                }}
              >
                {t("handling.avbryt")}
              </Button>
            )}
            {harNoekkel && (
              <Button
                size="sm"
                variant="ghost"
                onClick={fjernNoekkel}
                disabled={slett.isPending}
                className="ml-auto text-red-600 hover:bg-red-50"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t("handling.fjern")}
              </Button>
            )}
          </div>
          {lagre.error && (
            <p className="text-xs text-red-600">{lagre.error.message}</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setRedigerer(true)}>
            {t("firma.integrasjoner.endreNoekkel")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={fjernNoekkel}
            disabled={slett.isPending}
            className="ml-auto text-red-600 hover:bg-red-50"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t("handling.fjern")}
          </Button>
        </div>
      )}
    </Card>
  );
}
