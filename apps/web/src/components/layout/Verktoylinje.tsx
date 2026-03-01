"use client";

import { useNavigasjon } from "@/kontekst/navigasjon-kontekst";
import { Button } from "@siteflow/ui";

export function Verktoylinje() {
  const { verktoylinjeHandlinger } = useNavigasjon();

  if (verktoylinjeHandlinger.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      {verktoylinjeHandlinger.map((handling) => (
        <Button
          key={handling.id}
          variant={handling.variant === "primary" ? "primary" : "secondary"}
          size="sm"
          onClick={handling.onClick}
        >
          {handling.ikon && (
            <span className="mr-1.5 inline-flex">{handling.ikon}</span>
          )}
          {handling.label}
        </Button>
      ))}
    </div>
  );
}
