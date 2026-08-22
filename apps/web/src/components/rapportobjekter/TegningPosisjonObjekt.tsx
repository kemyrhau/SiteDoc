"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Target, MapPin } from "lucide-react";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import type { RapportObjektProps } from "./typer";
import type { TegningPosisjonVerdi } from "@sitedoc/shared";

export function TegningPosisjonObjekt({
  objekt,
  verdi,
  onEndreVerdi,
  leseModus,
  feltNokkel,
}: RapportObjektProps) {
  const posisjon = verdi as TegningPosisjonVerdi | null;
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const { startPosisjonsvelger, hentOgTømPosisjonsResultat } = useByggeplass();
  const harSjekketResultat = useRef(false);

  // Rad-unik nøkkel i repeater (${objekt.id}:${radIndeks}); top-nivå → objekt.id.
  // Uten dette deler alle repeater-rader samme nøkkel → rad 2 overskriver rad 1s
  // posisjonsresultat ved retur fra tegningssiden.
  const nokkel = feltNokkel ?? objekt.id;

  // Sjekk om det finnes et ventende posisjonsresultat fra tegningssiden
  useEffect(() => {
    if (harSjekketResultat.current) return;
    harSjekketResultat.current = true;

    const resultat = hentOgTømPosisjonsResultat(nokkel);
    if (resultat) {
      onEndreVerdi({
        drawingId: resultat.drawingId,
        positionX: resultat.positionX,
        positionY: resultat.positionY,
        drawingName: resultat.drawingName,
      } satisfies TegningPosisjonVerdi);
    }
  }, [nokkel, hentOgTømPosisjonsResultat, onEndreVerdi]);

  function handleVelgPosisjon() {
    startPosisjonsvelger(nokkel);
    // Bær velger-tilstanden i URL-en (funn 2026-08-22): tegningssiden re-hydrerer
    // fra `posisjonsvelger`-parameteren ved full last / remount, så et klikk setter
    // PUNKT (ikke «Opprett fra tegning»). En ren in-memory-overlevering var skjør.
    router.push(`/dashbord/${params.prosjektId}/tegninger?posisjonsvelger=${encodeURIComponent(nokkel)}`);
  }

  // Lesemodus: vis posisjon eller «Ingen posisjon valgt»
  if (leseModus) {
    if (!posisjon) {
      return <p className="text-sm italic text-gray-400">Ingen posisjon valgt</p>;
    }
    return (
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <MapPin className="h-4 w-4 text-red-500" />
        <span>{posisjon.drawingName}</span>
        <span className="text-xs text-gray-400">
          ({posisjon.positionX.toFixed(1)}%, {posisjon.positionY.toFixed(1)}%)
        </span>
      </div>
    );
  }

  // Redigeringsmodus: vis posisjon + knapp for å velge/endre
  return (
    <div className="flex items-center gap-3">
      {posisjon ? (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <MapPin className="h-4 w-4 text-red-500" />
            <span>{posisjon.drawingName}</span>
            <span className="text-xs text-gray-400">
              ({posisjon.positionX.toFixed(1)}%, {posisjon.positionY.toFixed(1)}%)
            </span>
          </div>
          <button
            type="button"
            onClick={handleVelgPosisjon}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Endre
          </button>
          <button
            type="button"
            onClick={() => onEndreVerdi(null)}
            className="rounded-md px-2 py-1 text-xs text-gray-400 hover:text-red-500"
          >
            Fjern
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleVelgPosisjon}
          className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
        >
          <Target className="h-4 w-4" />
          Velg posisjon i tegning
        </button>
      )}
    </div>
  );
}
