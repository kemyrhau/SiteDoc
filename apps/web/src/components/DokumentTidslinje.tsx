"use client";

import { StatusBadge, Card } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { ArrowRight, User, Users } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface Overfoering {
  id: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
  createdAt: string;
  sender?: { id: string; name: string | null } | null;
  recipientUser?: { id: string; name: string | null } | null;
  recipientGroup?: { id: string; name: string | null } | null;
}

interface DokumentTidslinjeProps {
  overforinger: Overfoering[];
  opprettetAv?: string | null;
  opprettetDato?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Hjelpere                                                           */
/* ------------------------------------------------------------------ */

function formaterDato(dato: string): string {
  return new Date(dato).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Komponent                                                          */
/* ------------------------------------------------------------------ */

export function DokumentTidslinje({ overforinger, opprettetAv, opprettetDato }: DokumentTidslinjeProps) {
  const { t } = useTranslation();

  if (overforinger.length === 0 && !opprettetAv) return null;

  return (
    <Card className="mt-6">
      <h4 className="mb-4 text-sm font-medium text-gray-500">{t("tidslinje.tittel")}</h4>
      <div className="relative">
        {/* Vertikal linje */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />

        <div className="flex flex-col gap-0">
          {/* Opprettet-hendelse */}
          {opprettetAv && opprettetDato && (
            <TidslinjeRad
              dato={opprettetDato}
              farge="bg-blue-500"
              ikon={<div className="h-2 w-2 rounded-full bg-white" />}
            >
              <span className="font-medium text-gray-700">{opprettetAv}</span>
              <span className="text-gray-500">{t("tidslinje.opprettet")}</span>
            </TidslinjeRad>
          )}

          {/* Overføringer */}
          {overforinger.map((ovf, i) => {
            const erSiste = i === overforinger.length - 1;
            const harMottaker = ovf.recipientUser || ovf.recipientGroup;
            // Videresending: status endres ikke, kommentar starter med "Videresendt"
            const erVideresending = ovf.fromStatus === ovf.toStatus && ovf.comment?.startsWith("Videresendt");
            // Fjern "Videresendt: " prefiks fra kommentar (vises allerede i badge)
            const visKommentar = erVideresending
              ? ovf.comment?.replace(/^Videresendt:\s*/, "").trim() || null
              : ovf.comment;

            return (
              <TidslinjeRad
                key={ovf.id}
                dato={ovf.createdAt}
                farge={erSiste ? "bg-sitedoc-primary" : "bg-gray-400"}
                ikon={<div className="h-2 w-2 rounded-full bg-white" />}
              >
                <div className="flex flex-col gap-1">
                  {/* Status-overgang eller videresending */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {erVideresending ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {t("statushandling.videresend")}
                      </span>
                    ) : (
                      <>
                        <StatusBadge status={ovf.fromStatus} />
                        <ArrowRight size={14} className="text-gray-400 shrink-0" />
                        <StatusBadge status={ovf.toStatus} />
                      </>
                    )}
                  </div>

                  {/* Avsender → Mottaker */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {ovf.sender?.name && (
                      <span className="flex items-center gap-1">
                        <User size={12} className="shrink-0" />
                        {ovf.sender.name}
                      </span>
                    )}
                    {harMottaker && (
                      <>
                        <ArrowRight size={10} className="text-gray-400 shrink-0" />
                        <span className="flex items-center gap-1">
                          {ovf.recipientGroup ? (
                            <Users size={12} className="shrink-0" />
                          ) : (
                            <User size={12} className="shrink-0" />
                          )}
                          {ovf.recipientUser?.name ?? ovf.recipientGroup?.name}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Kommentar */}
                  {visKommentar && (
                    <p className="text-xs text-gray-500 italic">&ldquo;{visKommentar}&rdquo;</p>
                  )}
                </div>
              </TidslinjeRad>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  TidslinjeRad                                                       */
/* ------------------------------------------------------------------ */

function TidslinjeRad({
  dato,
  farge,
  ikon,
  children,
}: {
  dato: string;
  farge: string;
  ikon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0 print-no-break">
      {/* Prikk */}
      <div className={`relative z-10 mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full ${farge}`}>
        {ikon}
      </div>

      {/* Innhold */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">{children}</div>
          <span className="shrink-0 text-xs text-gray-400">{formaterDato(dato)}</span>
        </div>
      </div>
    </div>
  );
}
