"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User, HardHat, Building2, ShieldCheck, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { ProsjektVelger } from "./ProsjektVelger";
import { ByggeplassVelger } from "./ByggeplassVelger";
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { SpraakVelger } from "./SpraakVelger";
import {
  LayoutDashboard,
  ClipboardCheck,
  ListTodo,
  FileText,
  Map,
  FolderOpen,
  Settings,
} from "lucide-react";

export function Toppbar() {
  const { data: session } = useSession();
  const [brukerMeny, setBrukerMeny] = useState(false);
  const [mobilMeny, setMobilMeny] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const aktivSeksjon = useAktivSeksjon();
  const { prosjektId } = useProsjekt();
  const { t } = useTranslation();

  // Sjekk om bruker har organisasjon (firmaadmin)
  const { data: organisasjon } = trpc.organisasjon.hentMin.useQuery(undefined, {
    enabled: !!session?.user,
  });

  // Sjekk om bruker er SiteDoc-admin
  const { data: erSiteDocAdmin } = trpc.admin.erAdmin.useQuery(undefined, {
    enabled: !!session?.user,
  });

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setBrukerMeny(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  return (
    <header className="relative flex h-12 items-center justify-between bg-sitedoc-primary px-4">
      {/* Venstre: Hamburger (mobil) + Logo + Prosjektvelger + Firma */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMobilMeny(!mobilMeny)}
          className="flex items-center justify-center text-white md:hidden"
        >
          {mobilMeny ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <div className="hidden w-[60px] items-center justify-center md:flex">
          <HardHat className="h-6 w-6 text-white" />
        </div>
        <Link href="/" className="text-sm font-bold tracking-wide text-white hover:text-blue-200 transition">
          SiteDoc
        </Link>
        <div className="mx-2 h-5 w-px bg-white/20" />
        <ProsjektVelger />
        {prosjektId && (
          <>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <ByggeplassVelger />
          </>
        )}
        {organisasjon && (
          <>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <Link
              href="/dashbord/firma"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">{organisasjon.name}</span>
            </Link>
          </>
        )}
        {erSiteDocAdmin && (
          <>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <Link
              href="/dashbord/admin"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-amber-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </>
        )}
      </div>

      {/* Høyre: Språk + Brukerinfo */}
      <div className="flex items-center gap-1">
        <SpraakVelger />
      <div ref={ref} className="relative">
        <button
          onClick={() => setBrukerMeny(!brukerMeny)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden max-w-[150px] truncate sm:inline">
            {session?.user?.name ?? session?.user?.email ?? t("toppbar.bruker")}
          </span>
        </button>

        {brukerMeny && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-sm font-medium text-gray-900">
                {session?.user?.name}
              </p>
              <p className="truncate text-xs text-gray-500">
                {session?.user?.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              {t("toppbar.loggUt")}
            </button>
          </div>
        )}
      </div>
      </div>
      {/* Mobil-navigasjonsmeny */}
      {mobilMeny && (
        <div className="absolute left-0 top-12 z-50 w-full border-b border-gray-200 bg-white shadow-lg md:hidden">
          <nav className="flex flex-col p-3 gap-1">
            {[
              { id: "dashbord", labelKey: "nav.dashbord", ikon: <LayoutDashboard className="h-5 w-5" /> },
              { id: "sjekklister", labelKey: "nav.sjekklister", ikon: <ClipboardCheck className="h-5 w-5" />, kreverProsjekt: true },
              { id: "oppgaver", labelKey: "nav.oppgaver", ikon: <ListTodo className="h-5 w-5" />, kreverProsjekt: true },
              { id: "maler", labelKey: "nav.maler", ikon: <FileText className="h-5 w-5" />, kreverProsjekt: true },
              { id: "tegninger", labelKey: "nav.tegninger", ikon: <Map className="h-5 w-5" />, kreverProsjekt: true },
              { id: "mapper", labelKey: "nav.mapper", ikon: <FolderOpen className="h-5 w-5" />, kreverProsjekt: true },
              { id: "oppsett", labelKey: "nav.innstillinger", ikon: <Settings className="h-5 w-5" /> },
            ].map((element) => {
              const deaktivert = element.kreverProsjekt && !prosjektId;
              const aktiv = aktivSeksjon === element.id;
              return (
                <button
                  key={element.id}
                  disabled={deaktivert}
                  onClick={() => {
                    if (element.id === "dashbord") {
                      router.push(prosjektId ? `/dashbord/${prosjektId}` : "/dashbord");
                    } else if (element.id === "oppsett") {
                      router.push("/dashbord/oppsett");
                    } else if (prosjektId) {
                      router.push(`/dashbord/${prosjektId}/${element.id}`);
                    }
                    setMobilMeny(false);
                  }}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    aktiv
                      ? "bg-sitedoc-primary/10 text-sitedoc-primary"
                      : deaktivert
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {element.ikon}
                  {t(element.labelKey)}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
