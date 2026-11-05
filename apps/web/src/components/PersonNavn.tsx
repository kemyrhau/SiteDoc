"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import {
  PersonKort,
  type KontaktMedlem,
  type DbGruppe,
  type Dokumentflyt,
} from "@/app/dashbord/oppsett/brukere/_components/PersonKort";

/**
 * Personnavn som skiller to personer med samme navn (ordre 2026-11-05 (2)):
 * hover viser e-posten, klikk åpner PersonKort i prosjektkontekst.
 *
 * Medlemmet slås opp i `medlem.hentForProsjekt` (samme cache som sidene allerede
 * henter) på `projectMemberId`, ellers `userId`. Er personen ikke prosjektmedlem
 * (f.eks. firmaets HMS-ansvarlig), vises bare e-posten — det finnes ikke noe kort.
 * Kun for personer; grupper og faggrupper rendres som før.
 */
export function PersonNavn({
  prosjektId,
  navn,
  projectMemberId,
  userId,
  epost,
  wrapperClassName = "relative inline-flex min-w-0 flex-1",
}: {
  prosjektId: string;
  navn: string | null | undefined;
  projectMemberId?: string | null;
  userId?: string | null;
  /** Reserve-e-post når personen ikke er prosjektmedlem. */
  epost?: string | null;
  wrapperClassName?: string;
}) {
  const { t } = useTranslation();
  const [åpen, setÅpen] = useState(false);

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );
  // Kortets øvrige data hentes først når det åpnes (dokumentflyt-siden har dem i cache).
  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: åpen },
  );
  const { data: grupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: åpen },
  );
  const { data: flyter } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: åpen },
  );
  // Samme admin-gate som Kontakter-siden bruker for kortets handlinger.
  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: prosjektId },
    { enabled: åpen },
  );

  const kontakter = (medlemmer ?? []) as unknown as KontaktMedlem[];
  const medlem =
    kontakter.find((m) => (projectMemberId ? m.id === projectMemberId : !!userId && m.user?.id === userId)) ?? null;
  const visNavn = navn ?? medlem?.user?.name ?? epost ?? "—";
  const visEpost = medlem?.user?.email ?? epost ?? null;

  const tekst = medlem ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setÅpen(true);
      }}
      aria-label={t("personNavn.visPersonkort", { navn: visNavn })}
      className="min-w-0 truncate text-left hover:underline"
    >
      {visNavn}
    </button>
  ) : (
    <span className="min-w-0 truncate">{visNavn}</span>
  );

  return (
    <>
      {visEpost ? (
        <Tooltip tekst={visEpost} side="top" wrapperClassName={wrapperClassName}>
          {tekst}
        </Tooltip>
      ) : (
        <span className={wrapperClassName}>{tekst}</span>
      )}
      {åpen && medlem && (
        // Klikk i kortet skal ikke boble til raden/gruppa navnet står i.
        <div className="contents" onClick={(e) => e.stopPropagation()}>
          <PersonKort
            medlem={medlem}
            prosjektId={prosjektId}
            alleFaggrupper={(faggrupper ?? []) as Array<{ id: string; name: string; color: string | null }>}
            dbGrupper={(grupper ?? []) as unknown as DbGruppe[]}
            dokumentflyter={(flyter ?? []) as unknown as Dokumentflyt[]}
            erProsjektAdmin={minFlytInfo?.erAdmin ?? false}
            onClose={() => setÅpen(false)}
          />
        </div>
      )}
    </>
  );
}
