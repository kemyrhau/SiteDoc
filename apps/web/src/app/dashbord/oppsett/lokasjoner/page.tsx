"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, Map } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LokasjonKategori {
  tittel: string;
  beskrivelse: string;
  ikon: React.ReactNode;
  href: string;
  aktiv: boolean;
  ekstraInfo?: string;
}

export default function LokasjonerSide() {
  const params = useParams<{ prosjektId: string }>();

  const { data: bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: params.prosjektId! },
    { enabled: !!params.prosjektId },
  );

  const kategorier: LokasjonKategori[] = [
    {
      tittel: "Bygninger",
      beskrivelse: "Administrer bygninger og tilknytt tegninger",
      ikon: <Building2 className="h-12 w-12 text-gray-400" />,
      href: "/dashbord/oppsett/lokasjoner/bygninger",
      aktiv: true,
      ekstraInfo: bygninger
        ? `${bygninger.length} bygning${bygninger.length !== 1 ? "er" : ""}`
        : undefined,
    },
    {
      tittel: "Kart",
      beskrivelse: "Prosjektposisjon og kartvisning",
      ikon: <Map className="h-12 w-12 text-gray-300" />,
      href: "#",
      aktiv: false,
      ekstraInfo: "Kommer snart",
    },
  ];

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Lokasjoner</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kategorier.map((kategori) => (
          <div
            key={kategori.tittel}
            className={`rounded-lg border border-gray-200 bg-white ${
              !kategori.aktiv ? "opacity-50" : ""
            }`}
          >
            {/* Header */}
            <div className="border-b border-gray-200 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">
                {kategori.tittel}
              </h3>
            </div>

            {/* Innhold */}
            <div className="flex gap-5 px-5 py-4">
              <div className="flex-shrink-0 pt-1">{kategori.ikon}</div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-600">{kategori.beskrivelse}</p>
                {kategori.aktiv ? (
                  <Link
                    href={kategori.href}
                    className="text-sm font-medium text-siteflow-primary hover:underline"
                  >
                    Åpne {kategori.tittel.toLowerCase()}
                  </Link>
                ) : (
                  <span className="text-sm text-gray-400">
                    {kategori.ekstraInfo}
                  </span>
                )}
              </div>
            </div>

            {/* Footer */}
            {kategori.ekstraInfo && kategori.aktiv && (
              <div className="border-t border-gray-100 px-5 py-2">
                <span className="text-xs text-gray-400">
                  {kategori.ekstraInfo}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
