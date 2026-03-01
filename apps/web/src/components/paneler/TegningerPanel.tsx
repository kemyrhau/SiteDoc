"use client";

import { SearchInput } from "@siteflow/ui";
import { useState } from "react";
import { FolderClosed, Map } from "lucide-react";

export function TegningerPanel() {
  const [sok, setSok] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        verdi={sok}
        onChange={setSok}
        placeholder="Søk tegninger..."
      />
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Map className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-400">
          Tegninger kommer snart
        </p>
        <p className="text-xs text-gray-300">
          Last opp prosjekttegninger (PDF/DWG)
        </p>
      </div>
    </div>
  );
}
