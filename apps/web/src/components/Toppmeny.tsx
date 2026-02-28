"use client";

import { useSession, signOut } from "next-auth/react";

export function Toppmeny() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-siteflow-primary">SiteFlow</h1>
          <nav className="flex gap-4">
            <a href="/dashbord" className="text-sm text-gray-600 hover:text-gray-900">
              Dashbord
            </a>
            <a href="/dashbord/prosjekter" className="text-sm text-gray-600 hover:text-gray-900">
              Prosjekter
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {session?.user && (
            <>
              <span className="text-sm text-gray-600">
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Logg ut
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
