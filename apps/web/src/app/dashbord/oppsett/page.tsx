"use client";

import { useSession } from "next-auth/react";
import { Card } from "@siteflow/ui";

export default function OppsettSide() {
  const { data: session } = useSession();

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-6">
      <h2 className="mb-6 text-xl font-bold">Innstillinger</h2>

      <div className="max-w-2xl">
        <Card className="mb-4">
          <h3 className="mb-3 text-sm font-medium text-gray-500">Brukerprofil</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Navn</span>
              <span className="font-medium">{session?.user?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">E-post</span>
              <span className="font-medium">{session?.user?.email ?? "—"}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-medium text-gray-500">Applikasjon</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Versjon</span>
              <span className="font-medium">0.1.0</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
