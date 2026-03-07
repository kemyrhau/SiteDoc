"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Building2, Shield, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";

const navigasjon = [
  {
    label: "Oversikt",
    href: "/dashbord/admin",
    ikon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Firmaer",
    href: "/dashbord/admin/firmaer",
    ikon: <Building2 className="h-4 w-4" />,
  },
  {
    label: "Prosjekter",
    href: "/dashbord/admin/prosjekter",
    ikon: <FolderKanban className="h-4 w-4" />,
  },
  {
    label: "Tillatelser",
    href: "/dashbord/admin/tillatelser",
    ikon: <Shield className="h-4 w-4" />,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: erAdmin, isLoading } = trpc.admin.erAdmin.useQuery();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!erAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">
          Du har ikke tilgang til SiteDoc-administrasjon.
        </p>
      </div>
    );
  }

  function erAktiv(href: string) {
    if (href === "/dashbord/admin") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Shield className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">SiteDoc Admin</h2>
              <p className="text-xs text-gray-500">Global administrasjon</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navigasjon.map((element) => (
            <Link
              key={element.href}
              href={element.href}
              className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                erAktiv(element.href)
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {element.ikon}
              {element.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
