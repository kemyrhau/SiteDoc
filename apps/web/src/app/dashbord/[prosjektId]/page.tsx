"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { MoreVertical, Settings, Printer, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, Spinner, StatusBadge } from "@siteflow/ui";
import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { DashbordPanel } from "@/components/paneler/DashbordPanel";

export default function ProsjektOversikt() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: prosjekt, isLoading } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
  );

  const [merMenyAapen, setMerMenyAapen] = useState(false);
  const merRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (merRef.current && !merRef.current.contains(e.target as Node)) {
        setMerMenyAapen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  if (isLoading || !prosjekt) {
    return (
      <>
        <SekundaertPanel tittel="Prosjekter">
          <DashbordPanel />
        </SekundaertPanel>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  const brukerMedlem = prosjekt.members.find(
    (m) => m.user.email === session?.user?.email,
  );
  const erAdmin = brukerMedlem?.role === "admin";

  const basePath = `/dashbord/${params.prosjektId}`;

  const kort = [
    {
      label: "Entrepriser",
      verdi: prosjekt.enterprises.length,
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
    <>
      <SekundaertPanel tittel="Prosjekter">
        <DashbordPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-xl font-bold">{prosjekt.name}</h2>
          <StatusBadge status={prosjekt.status} />
          <div className="ml-auto" ref={merRef}>
            <div className="relative">
              <button
                onClick={() => setMerMenyAapen(!merMenyAapen)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                title="Mer"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {merMenyAapen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                  <button
                    onClick={() => {
                      setMerMenyAapen(false);
                      router.push("/dashbord/oppsett");
                    }}
                    disabled={!erAdmin}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Settings className="h-4 w-4" />
                    Prosjektinnstillinger
                  </button>
                  <button
                    onClick={() => {
                      setMerMenyAapen(false);
                      window.print();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Printer className="h-4 w-4" />
                    Skriv ut
                  </button>
                  <button
                    onClick={() => {
                      setMerMenyAapen(false);
                      // TODO: Implementer eksport
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    Eksporter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mb-1 text-sm text-gray-500">{prosjekt.projectNumber}</p>
        {prosjekt.address && (
          <p className="mb-6 text-sm text-gray-400">{prosjekt.address}</p>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {kort.map((k) => (
            <Link key={k.label} href={k.href}>
              <Card className="text-center transition-shadow hover:shadow-md">
                <p className="text-3xl font-bold text-siteflow-primary">{k.verdi}</p>
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
                    <p className="text-xs text-gray-400">{m.enterprises?.map((me: { enterprise: { name: string } }) => me.enterprise.name).join(", ")}</p>
                  </div>
                  <span className="text-xs text-gray-500">{m.role}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
