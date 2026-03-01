"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@siteflow/ui";
import { MalBygger } from "./_components/MalBygger";

export default function MalDetaljerSide() {
  const params = useParams<{ id: string; malId: string }>();

  const { data: mal, isLoading } = trpc.mal.hentMedId.useQuery({
    id: params.malId,
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
          }>;
        }
      }
    />
  );
}
