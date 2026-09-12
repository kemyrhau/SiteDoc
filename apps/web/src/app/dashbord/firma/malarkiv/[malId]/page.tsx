"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { MalBygger } from "@/components/malbygger";

/**
 * Firmamal-innholdsredigering (Krav 2) — samme MalBygger som prosjekt- og sentralnivå,
 * kjørt i firma-modus (`nivaa="firma"`, objekt-CRUD mot `trpc.firmamal.*`). Metadata
 * (prefiks, standard-for-nye, HMS-synlighet) redigeres i modalen i listevisningen; her
 * redigeres feltene, hjelpetekstene, rekkefølgen og fasene fritt (ingen objektlås —
 * firmamalen bærer ingen dokumenter).
 */
export default function FirmamalInnholdSide() {
  const { t } = useTranslation();
  const params = useParams<{ malId: string }>();

  const { data: mal, isLoading } = trpc.firmamal.hent.useQuery({ id: params.malId });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!mal) {
    return (
      <p className="py-12 text-center text-gray-500">{t("firma.malarkiv.ikkeFunnet")}</p>
    );
  }

  return (
    <div>
      <Link
        href="/dashbord/firma/malarkiv"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("firma.malarkiv.tilbake")}
      </Link>
      <MalBygger
        nivaa="firma"
        mal={
          mal as unknown as {
            id: string;
            name: string;
            description: string | null;
            category?: string;
            subjects?: unknown;
            showSubject?: boolean;
            showLocation?: boolean;
            showPriority?: boolean;
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
