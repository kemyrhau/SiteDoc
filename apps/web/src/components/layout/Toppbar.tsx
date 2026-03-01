"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User, HardHat } from "lucide-react";
import { ProsjektVelger } from "./ProsjektVelger";
import { useState, useRef, useEffect } from "react";

export function Toppbar() {
  const { data: session } = useSession();
  const [brukerMeny, setBrukerMeny] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <header className="flex h-12 items-center justify-between bg-siteflow-primary px-4">
      {/* Venstre: Logo + Prosjektvelger */}
      <div className="flex items-center gap-4">
        <div className="flex w-[60px] items-center justify-center">
          <HardHat className="h-6 w-6 text-white" />
        </div>
        <span className="text-sm font-bold tracking-wide text-white">
          SiteFlow
        </span>
        <div className="mx-2 h-5 w-px bg-white/20" />
        <ProsjektVelger />
      </div>

      {/* Høyre: Brukerinfo */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setBrukerMeny(!brukerMeny)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden max-w-[150px] truncate sm:inline">
            {session?.user?.name ?? session?.user?.email ?? "Bruker"}
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
              Logg ut
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
