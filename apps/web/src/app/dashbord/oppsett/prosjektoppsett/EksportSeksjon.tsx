"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { useFirma } from "@/kontekst/firma-kontekst";
import {
  Archive,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

const AKTIVE_STATUSER = ["bestilt", "bygger"];

interface EksportJobbRad {
  id: string;
  status: string;
  feilmelding: string | null;
  antallTotalt: number | null;
  antallFerdig: number | null;
  resultatStorrelse: number | null;
  utloperVed: string | Date | null;
  createdAt: string | Date;
  fullfortVed: string | Date | null;
}

function formaterStorrelse(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formaterDatoTid(d: string | Date): string {
  return new Date(d).toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Eksport-/arkiv-seksjon i prosjektoppsettet (dataeksport-UI, 2026-09-06).
 * Backend finnes og kjører (eksport.ts + worker); dette er inngangsdøren.
 * Bor sammen med (kommende) «Avslutt prosjekt» — et avsluttet prosjekt er
 * utilgjengelig, så kunden må kunne hente arkivet FØR avslutning.
 */
export function EksportSeksjon({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { kanAdministrereFirma } = useFirma();

  const jobberQuery = trpc.eksport.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId && kanAdministrereFirma },
  );
  const jobber = (jobberQuery.data ?? []) as EksportJobbRad[];
  const aktivJobb = jobber.find((j) => AKTIVE_STATUSER.includes(j.status)) ?? null;

  // En kjørende jobb tar minutter — poll så tilstanden oppdateres uten reload.
  // Egen effekt-fri form: refetchInterval leses på hver render, og `aktivJobb`
  // recomputes når data endres → intervallet stopper av seg selv når jobben er klar.
  trpc.eksport.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    {
      enabled: !!prosjektId && kanAdministrereFirma && !!aktivJobb,
      refetchInterval: aktivJobb ? 3000 : false,
    },
  );

  const bestill = trpc.eksport.bestill.useMutation({
    onSuccess: () => utils.eksport.hentForProsjekt.invalidate({ projectId: prosjektId }),
  });

  const nedlasting = trpc.eksport.hentNedlastingsUrl.useMutation({
    onSuccess: ({ url }) => {
      // Signert `/uploads/...`-sti serveres via /api (samme som bilder). Ny URL
      // hentes ved hvert klikk, så en lekket lenke er kortlevd.
      window.location.href = `/api${url}`;
    },
  });

  // Firma-admin-only (Kenneth-vedtak 2026-09-06): arkivet er firmadata. Skjul hele
  // seksjonen for den serveren uansett avviser (verifiserKanEksportere) — en
  // FORBIDDEN-toast på et arkiv er en dårlig førsteopplevelse. Server er fasit;
  // dette speiler bare regelen (`kanAdministrereFirma` = sitedoc_admin ∨ firma_admin).
  if (!kanAdministrereFirma) return null;

  function statusLinje(j: EksportJobbRad): React.ReactNode {
    switch (j.status) {
      case "bestilt":
        return (
          <span className="flex items-center gap-1.5 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            {t("prosjektoppsett.eksport.bestilt")}
          </span>
        );
      case "bygger":
        return (
          <span className="flex items-center gap-1.5 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin text-sitedoc-primary" />
            {j.antallTotalt != null
              ? t("prosjektoppsett.eksport.byggerProgresjon", {
                  ferdig: j.antallFerdig ?? 0,
                  totalt: j.antallTotalt,
                })
              : t("prosjektoppsett.eksport.bygger")}
          </span>
        );
      case "klar":
        return (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-700">
            <span className="flex items-center gap-1.5 font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {t("prosjektoppsett.eksport.klar")}
            </span>
            {formaterStorrelse(j.resultatStorrelse) && (
              <span className="text-xs text-gray-500">
                {formaterStorrelse(j.resultatStorrelse)}
              </span>
            )}
            {j.utloperVed && (
              <span className="text-xs text-amber-600">
                {t("prosjektoppsett.eksport.utloper", { dato: formaterDatoTid(j.utloperVed) })}
              </span>
            )}
          </span>
        );
      case "feilet":
        return (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {t("prosjektoppsett.eksport.feilet")}
            {j.feilmelding ? `: ${j.feilmelding}` : ""}
          </span>
        );
      case "utløpt":
        return (
          <span className="flex items-center gap-1.5 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            {t("prosjektoppsett.eksport.utlopt")}
          </span>
        );
      default:
        return <span className="text-sm text-gray-500">{j.status}</span>;
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Archive className="h-4 w-4 text-gray-400" />
          {t("prosjektoppsett.eksport.tittel")}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {t("prosjektoppsett.eksport.beskrivelse")}
        </p>
      </div>
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => bestill.mutate({ projectId: prosjektId })}
            loading={bestill.isPending}
            disabled={!!aktivJobb || bestill.isPending}
          >
            <Archive className="mr-1.5 h-4 w-4" />
            {t("prosjektoppsett.eksport.lagArkiv")}
          </Button>
          {aktivJobb && statusLinje(aktivJobb)}
        </div>
        {bestill.error && (
          <p className="mt-2 text-xs text-red-600">{bestill.error.message}</p>
        )}

        {/* Tidligere arkiver — kvitteringen på at eksporten ble laget. */}
        {jobber.length > 0 && (
          <ul className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
            {jobber.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="text-xs text-gray-400">{formaterDatoTid(j.createdAt)}</span>
                <span className="flex-1">{statusLinje(j)}</span>
                {j.status === "klar" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => nedlasting.mutate({ jobbId: j.id })}
                    loading={nedlasting.isPending && nedlasting.variables?.jobbId === j.id}
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    {t("prosjektoppsett.eksport.lastNed")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
