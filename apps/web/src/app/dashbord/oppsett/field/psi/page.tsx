"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Spinner, Card } from "@sitedoc/ui";
import { ShieldCheck, QrCode, RefreshCw, FileText } from "lucide-react";

export default function PsiOppsettSide() {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const { data: psi, isLoading } = trpc.psi.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const opprettMut = trpc.psi.opprett.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const byttMalMut = trpc.psi.byttMal.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const bumpMut = trpc.psi.bumpVersjon.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const [valgtMal, setValgtMal] = useState("");
  const [visQR, setVisQR] = useState(false);

  // Filtrer maler — vis alle for PSI (admin velger selv)
  const tilgjengeligeMaler = (maler ?? []) as Array<{ id: string; name: string; prefix: string | null; category: string }>;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const qrUrl = psi
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/psi/${prosjektId}`
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-sitedoc-primary" />
        <h1 className="text-xl font-bold text-gray-900">PSI — Sikkerhetsinstruks</h1>
      </div>

      {!psi ? (
        /* Ingen PSI opprettet ennå */
        <Card className="p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">Opprett PSI for prosjektet</h2>
          <p className="mb-4 text-sm text-gray-500">
            Velg en mal som inneholder sikkerhetsinstruksen. Malen kan bygges i malbyggeren med tekst, bilder, video, quiz og signatur.
          </p>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Velg mal</label>
            <select
              value={valgtMal}
              onChange={(e) => setValgtMal(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Velg mal —</option>
              {tilgjengeligeMaler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.prefix ? `${m.prefix} — ` : ""}{m.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => {
              if (!valgtMal || !prosjektId) return;
              opprettMut.mutate({ projectId: prosjektId, templateId: valgtMal });
            }}
            disabled={!valgtMal || opprettMut.isPending}
          >
            {opprettMut.isPending ? "Oppretter..." : "Opprett PSI"}
          </Button>
        </Card>
      ) : (
        /* PSI finnes — vis status og handlinger */
        <>
          <Card className="mb-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {(psi as unknown as { template: { name: string } }).template.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Versjon {psi.version} — opprettet {new Date(psi.createdAt).toLocaleDateString("nb-NO")}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Aktiv
              </span>
            </div>
          </Card>

          {/* Handlinger */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Ny versjon */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <RefreshCw className="h-5 w-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Ny versjon</h3>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Bump versjon for å kreve at alle arbeidere signerer på nytt.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!prosjektId) return;
                  if (confirm("Alle eksisterende signaturer vil bli markert som utdatert. Fortsett?")) {
                    bumpMut.mutate({ projectId: prosjektId });
                  }
                }}
                disabled={bumpMut.isPending}
              >
                Bump til v{psi.version + 1}
              </Button>
            </Card>

            {/* QR-kode */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <QrCode className="h-5 w-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">QR-kode for gjester</h3>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Arbeidere uten konto skanner QR-koden ved porten for å gjennomføre PSI.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setVisQR(!visQR)}>
                {visQR ? "Skjul QR" : "Vis QR-lenke"}
              </Button>
              {visQR && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="break-all text-xs font-mono text-gray-600">{qrUrl}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(qrUrl)}
                    className="mt-2 text-xs text-sitedoc-primary hover:underline"
                  >
                    Kopier lenke
                  </button>
                </div>
              )}
            </Card>

            {/* Bytt mal */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="h-5 w-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Bytt mal</h3>
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value || !prosjektId) return;
                  if (confirm("Bytting av mal bumper versjon og krever ny signering. Fortsett?")) {
                    byttMalMut.mutate({ projectId: prosjektId, templateId: e.target.value });
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="">— Velg ny mal —</option>
                {tilgjengeligeMaler.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.prefix ? `${m.prefix} — ` : ""}{m.name}
                  </option>
                ))}
              </select>
            </Card>
          </div>

          {/* Dashboard-lenke */}
          <div className="mt-6">
            <a
              href={`/dashbord/${prosjektId}/psi`}
              className="text-sm text-sitedoc-primary hover:underline"
            >
              → Åpne PSI-dashboard (signaturoversikt)
            </a>
          </div>
        </>
      )}
    </div>
  );
}
