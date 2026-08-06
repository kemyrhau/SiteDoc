"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { UserPlus, Plus, User } from "lucide-react";

export interface HmsKontakt {
  /** ProjectMember-id (kun for visning/nøkkel) */
  id: string;
  navn: string | null;
  epost: string;
  /** Er kontakten allerede medlem av HMS-gruppa (behandler)? */
  erMedlem: boolean;
}

/**
 * Delte handlinger for å bemanne HMS-behandler-leddet (HMS-gruppa):
 * «Meld meg inn» (innlogget bruker) + «Velg andre» (eksisterende prosjektkontakt).
 * Gjenbrukes av tilgangsmatrisen (§3), flyt-oppsettet (§2) og HmsTomBanner (§3).
 *
 * Server håndhever admin-nivå på begge mutasjonene (gruppe.meldMegInn / leggTilMedlem
 * → verifiserAdmin) — UI-gaten er kun kosmetisk. «Meld meg inn» knyttes til innlogget
 * bruker på serveren; ingen klient-identitet trengs her.
 */
export function HmsBehandlerHandlinger({
  prosjektId,
  hmsGruppeId,
  kontakter,
}: {
  prosjektId: string;
  hmsGruppeId: string;
  kontakter: HmsKontakt[];
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [visVelg, setVisVelg] = useState(false);

  const invalider = () => {
    utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
  };

  const meldMegInn = trpc.gruppe.meldMegInn.useMutation({ onSuccess: invalider });
  const leggTil = trpc.gruppe.leggTilMedlem.useMutation({
    onSuccess: () => {
      invalider();
      setVisVelg(false);
    },
  });

  const ledige = kontakter.filter((k) => !k.erMedlem);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => meldMegInn.mutate({ groupId: hmsGruppeId, projectId: prosjektId })}
        disabled={meldMegInn.isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
      >
        <UserPlus className="h-3.5 w-3.5" />
        {t("hms.behandler.meldMegInn")}
      </button>

      <div className="relative">
        <button
          onClick={() => setVisVelg((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("hms.behandler.velgAndre")}
        </button>
        {visVelg && (
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            {ledige.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-gray-400">{t("hms.behandler.ingenLedige")}</p>
            ) : (
              ledige.map((k) => {
                const deler = (k.navn ?? "").trim().split(" ");
                return (
                  <button
                    key={k.id}
                    onClick={() =>
                      leggTil.mutate({
                        groupId: hmsGruppeId,
                        projectId: prosjektId,
                        email: k.epost,
                        firstName: deler[0] || k.epost,
                        lastName: deler.slice(1).join(" ") || "-",
                      })
                    }
                    disabled={leggTil.isPending}
                    className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{k.navn ?? k.epost}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
