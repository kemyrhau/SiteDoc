"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, Button, StatusBadge, Spinner, EmptyState } from "@sitedoc/ui";

export default function ProsjekterSide() {
  const { data: prosjekter, isLoading } = trpc.prosjekt.hentAlle.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Prosjekter</h2>
        <Link href="/dashbord/nytt-prosjekt">
          <Button>Nytt prosjekt</Button>
        </Link>
      </div>

      {!prosjekter?.length ? (
        <EmptyState
          title="Ingen prosjekter ennå"
          description="Opprett ditt første byggeprosjekt for å komme i gang."
          action={
            <Link href="/dashbord/nytt-prosjekt">
              <Button>Opprett prosjekt</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prosjekter.map((prosjekt) => (
            <Link key={prosjekt.id} href={`/dashbord/prosjekter/${prosjekt.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{prosjekt.name}</h3>
                    <p className="text-xs text-gray-500">{prosjekt.projectNumber}</p>
                  </div>
                  <StatusBadge status={prosjekt.status} />
                </div>
                {prosjekt.description && (
                  <p className="mb-3 text-sm text-gray-600 line-clamp-2">
                    {prosjekt.description}
                  </p>
                )}
                {prosjekt.address && (
                  <p className="text-xs text-gray-400">{prosjekt.address}</p>
                )}
                <div className="mt-3 flex gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <span>{prosjekt.faggrupper.length} faggrupper</span>
                  <span>{prosjekt._count.members} medlemmer</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
