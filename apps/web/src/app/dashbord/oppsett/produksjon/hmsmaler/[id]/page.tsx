"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { MalBygger } from "@/components/malbygger";
import { Nivaabanner } from "@/components/nivaa/Nivaabanner";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";

export default function HmsmalByggerSide() {
  useToppbarFiltre({ byggeplass: false });
  const params = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: mal, isLoading } = trpc.mal.hentMedId.useQuery({
    id: params.id,
  });

  // Kun prosjektadmin/firma-admin kan redigere maler (Kenneths regel). Speiler
  // serverens verifiserAdmin-gate via mal.kanRedigere — stopper direkte-URL, ikke
  // bare menylenken. projectId hentes fra malen (hentMedId er åpen for medlemmer).
  const { data: kanRedigere, isLoading: lasterTilgang } =
    trpc.mal.kanRedigere.useQuery(
      { projectId: mal?.projectId ?? "" },
      { enabled: !!mal?.projectId },
    );

  if (isLoading || (!!mal && lasterTilgang)) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!mal) {
    return (
      <p className="py-12 text-center text-gray-500">
        Malen ble ikke funnet.
      </p>
    );
  }

  if (!kanRedigere) {
    return (
      <EmptyState
        title={t("maler.ingenTilgang")}
        description={t("maler.ingenRedigeringstilgangBeskrivelse")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Nivaabanner
        nivaa="prosjekt"
        tilbake={{
          href: "/dashbord/oppsett/produksjon/hmsmaler",
          labelKey: "malbygger.tilbakeTilHmsmaler",
        }}
      />
      <MalBygger
        mal={
          mal as {
            id: string;
            name: string;
            description: string | null;
            objects: Array<{
              id: string;
              type: string;
              label: string;
              required: boolean;
              sortOrder: number;
              config: unknown;
              parentId: string | null;
            }>;
          }
        }
      />
    </div>
  );
}
