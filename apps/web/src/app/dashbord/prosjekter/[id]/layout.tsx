"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Spinner, StatusBadge } from "@sitedoc/ui";

const faner = [
  { href: "", label: "Oversikt" },
  { href: "/faggrupper", label: "Faggrupper" },
  { href: "/maler", label: "Maler" },
  { href: "/sjekklister", label: "Sjekklister" },
  { href: "/oppgaver", label: "Oppgaver" },
] as const;

export default function ProsjektLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: prosjekt, isLoading } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.id },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!prosjekt) {
    return <p className="py-12 text-center text-gray-500">Prosjektet ble ikke funnet.</p>;
  }

  const basePath = `/dashbord/prosjekter/${params.id}`;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{prosjekt.name}</h2>
          <StatusBadge status={prosjekt.status} />
        </div>
        <p className="text-sm text-gray-500">{prosjekt.projectNumber}</p>
        {prosjekt.address && (
          <p className="text-sm text-gray-400">{prosjekt.address}</p>
        )}
      </div>

      <nav className="mb-6 flex gap-1 border-b border-gray-200">
        {faner.map((fane) => {
          const fullPath = basePath + fane.href;
          const erAktiv =
            fane.href === ""
              ? pathname === basePath
              : pathname.startsWith(fullPath);

          return (
            <Link
              key={fane.href}
              href={fullPath}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                erAktiv
                  ? "border-sitedoc-primary text-sitedoc-primary"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {fane.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
