"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, Spinner } from "@sitedoc/ui";

export default function ProsjektOversikt() {
  const params = useParams<{ id: string }>();
  const { data: prosjekt, isLoading } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.id },
  );

  if (isLoading || !prosjekt) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const basePath = `/dashbord/prosjekter/${params.id}`;

  const kort = [
    {
      label: "Entrepriser",
      verdi: prosjekt.dokumentflytParts.length,
      href: `${basePath}/entrepriser`,
    },
    {
      label: "Maler",
      verdi: prosjekt.templates.length,
      href: `${basePath}/maler`,
    },
    {
      label: "Medlemmer",
      verdi: prosjekt.members.length,
      href: basePath,
    },
  ];

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {kort.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="text-center transition-shadow hover:shadow-md">
              <p className="text-3xl font-bold text-sitedoc-primary">{k.verdi}</p>
              <p className="text-sm text-gray-500">{k.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {prosjekt.description && (
        <Card className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-500">Beskrivelse</h3>
          <p className="text-sm text-gray-700">{prosjekt.description}</p>
        </Card>
      )}

      {prosjekt.members.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-medium text-gray-500">Medlemmer</h3>
          <div className="divide-y divide-gray-100">
            {prosjekt.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="text-xs text-gray-400">{m.dokumentflytKoblinger?.map((me: { dokumentflytPart: { name: string } }) => me.dokumentflytPart.name).join(", ")}</p>
                </div>
                <span className="text-xs text-gray-500">{m.role}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
