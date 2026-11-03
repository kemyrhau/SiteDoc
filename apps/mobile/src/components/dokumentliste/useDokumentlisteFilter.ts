import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HarBallenBruker, Periode } from "@sitedoc/shared";
import { trpc } from "../../lib/trpc";
import { useNettverk } from "../../providers/NettverkProvider";
import { antallAktiveFilter, utenUbruktBallen, type Sortering } from "./dokumentlisteFilter";
import { byggAktiveChips, PERIODE_CHIP } from "./filterEtikett";

export const PERIODE_ALLE: Periode = { hurtigvalg: "alle", fra: null, til: null };

/**
 * Listetilstand for søk + filter + sortering + opprettet-periode i sjekkliste-,
 * oppgave- og innbokslista (filter-mobil 2026-11-03). Overlever navigasjon inn/ut
 * av et dokument (skjermen forblir montert); nullstilles ved prosjektbytte.
 * `ballenBrukerNett` er brukerens flyt-identitet når nettet er oppe; lista avgjør
 * selv om den kan brukes (`ballenBrukerForKilde` — krever serverrader) og sender
 * resultatet til `useAktiveFilter`. Offline / lokal kilde → bryteren skjules (D3).
 */
export function useDokumentlisteFilter(prosjektId: string | null | undefined) {
  const { erPaaNettet } = useNettverk();

  const [søkeAktiv, settSøkeAktiv] = useState(false);
  const [søketekst, settSøketekst] = useState("");
  const [filterVerdier, settFilterVerdier] = useState<Record<string, string>>({});
  const [sortering, settSortering] = useState<Sortering>("nyeste");
  const [periode, settPeriode] = useState<Periode>(PERIODE_ALLE);
  const [visSheet, settVisSheet] = useState(false);

  useEffect(() => {
    // Bytte av prosjekt nullstiller søk/filter/sortering (fabel-designlås pkt 6).
    settSøkeAktiv(false);
    settSøketekst("");
    settFilterVerdier({});
    settSortering("nyeste");
    settPeriode(PERIODE_ALLE);
  }, [prosjektId]);

  const flytInfoQuery = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId && erPaaNettet },
  );
  const flytInfo = flytInfoQuery.data as { userId: string; gruppeIder: string[] } | undefined;
  const ballenBrukerNett: HarBallenBruker | null = useMemo(
    () => (erPaaNettet && flytInfo ? { userId: flytInfo.userId, gruppeIder: flytInfo.gruppeIder } : null),
    [erPaaNettet, flytInfo],
  );

  const søkerNaa = søkeAktiv && søketekst.trim().length > 0;
  const søkeTokens = useMemo(
    () => (søkerNaa ? søketekst.trim().split(/\s+/).filter((tk) => tk.length >= 2) : []),
    [søkerNaa, søketekst],
  );

  const settFilter = useCallback((kolId: string, verdi: string) => {
    settFilterVerdier((forrige) => {
      const neste = { ...forrige };
      if (verdi) neste[kolId] = verdi;
      else delete neste[kolId];
      return neste;
    });
  }, []);

  const fjernChip = useCallback((kolId: string, value: string) => {
    if (kolId === PERIODE_CHIP) {
      settPeriode(PERIODE_ALLE);
      return;
    }
    settFilterVerdier((forrige) => {
      const gjenvaerende = (forrige[kolId] ?? "").split(",").filter((x) => x && x !== value);
      const neste = { ...forrige };
      if (gjenvaerende.length) neste[kolId] = gjenvaerende.join(",");
      else delete neste[kolId];
      return neste;
    });
  }, []);

  const nullstillFilter = useCallback(() => {
    settFilterVerdier({});
    settPeriode(PERIODE_ALLE);
  }, []);

  return {
    søkeAktiv,
    settSøkeAktiv,
    søketekst,
    settSøketekst,
    søkerNaa,
    søkeTokens,
    filterVerdier,
    sortering,
    settSortering,
    periode,
    settPeriode,
    visSheet,
    settVisSheet,
    ballenBrukerNett,
    settFilter,
    fjernChip,
    nullstillFilter,
  };
}

/**
 * Det som avhenger av om «ballen» kan brukes: effektive filter (ubrukbar ballen
 * fjernet), teller og fjernbare chips. Kalles etter at lista kjenner kilden.
 */
export function useAktiveFilter(
  filterVerdier: Record<string, string>,
  periode: Periode,
  bruker: HarBallenBruker | null,
) {
  const { t } = useTranslation();
  const effektiveFilter = useMemo(() => utenUbruktBallen(filterVerdier, bruker), [filterVerdier, bruker]);
  const antallFilter = antallAktiveFilter(effektiveFilter, periode);

  const aktiveChips = useMemo(
    () => byggAktiveChips(effektiveFilter, periode, t),
    [effektiveFilter, periode, t],
  );

  return { filterVerdier: effektiveFilter, antallFilter, aktiveChips };
}
