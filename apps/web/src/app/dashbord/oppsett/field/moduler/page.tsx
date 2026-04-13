"use client";

import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import { PROSJEKT_MODULER } from "@sitedoc/shared";
import {
  FileCheck,
  ShieldAlert,
  ClipboardList,
  Plus,
  Check,
  Package,
  ToggleRight,
} from "lucide-react";

/* Ikon-mapping fra strengnavn til komponent */
const IKON_MAP: Record<string, React.ReactNode> = {
  FileCheck: <FileCheck className="h-6 w-6" />,
  ShieldAlert: <ShieldAlert className="h-6 w-6" />,
  ClipboardList: <ClipboardList className="h-6 w-6" />,
};

export default function ModulerSide() {
  const { prosjektId } = useProsjekt();

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
            <h2 className="text-lg font-semibold text-gray-900">Moduler</h2>
            <p className="text-sm text-gray-500">
              Aktiver forhåndsdefinerte maler og arbeidsflyter tilpasset ditt prosjekt
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
                  Aktiv
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
                    {modul.kategori === "oppgave" ? "Oppgavemal" : "Sjekklistemal"}
                    {" · "}
                    {modul.maler.length} {modul.maler.length === 1 ? "mal" : "maler"}
                  </span>
                </div>
              </div>

              {/* Beskrivelse */}
              <p className="mb-4 flex-1 text-sm text-gray-600">
                {modul.beskrivelse}
              </p>

              {/* Mal-detaljer */}
              <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                {modul.maler.map((mal) => (
                  <div key={mal.prefix} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{mal.navn}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-600">
                        {mal.prefix}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {mal.objekter.length} felter
                      </span>
                    </div>
                  </div>
                ))}
              </div>

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
                  {erPending ? "Deaktiverer..." : "Deaktiver"}
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
