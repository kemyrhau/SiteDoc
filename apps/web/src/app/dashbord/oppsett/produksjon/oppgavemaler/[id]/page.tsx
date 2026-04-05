"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { MalBygger } from "@/components/malbygger";

export default function OppgavemalByggerSide() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const { data: mal, isLoading } = trpc.mal.hentMedId.useQuery({
    id: params.id,
  });

  if (isLoading) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashbord/oppsett/produksjon/oppgavemaler")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("malbygger.tilbakeTilOppgavemaler")}
        </button>
      </div>
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
