"use client";

import { useNavigasjon } from "@/kontekst/navigasjon-kontekst";
import { Button } from "@sitedoc/ui";
import { SONE_MARKOR } from "./sone-farger";

export function Verktoylinje() {
  const { verktoylinjeHandlinger } = useNavigasjon();

  if (verktoylinjeHandlinger.length === 0) {
    return null;
  }

  // K3-korreksjon: sider som legger tittel/handlinger i denne verktøylinja
  // (sjekklister, oppgaver, maler) mangler et tonet sidehode. De får
  // nivåsignalet via en 4px sonefarget venstremarkør her — INGEN gradient
  // (bar er på brand-hvit; gradient ville bryte grammatikken). Verktøylinja
  // bor kun i prosjekt-layouten → alltid prosjekt-sone. Farge fra delt kilde.
  return (
    <div
      data-toolbar
      className={`flex items-center gap-2 border-b border-b-gray-200 border-l-4 ${SONE_MARKOR.prosjekt} bg-white px-4 py-2`}
    >
      {verktoylinjeHandlinger.map((handling) => (
        <Button
          key={handling.id}
          variant={handling.variant === "primary" ? "primary" : "secondary"}
          size="sm"
          onClick={handling.onClick}
        >
          {handling.ikon ? (
            <span className="mr-1.5 inline-flex">{handling.ikon}</span>
          ) : null}
          {handling.label}
        </Button>
      ))}
    </div>
  );
}
