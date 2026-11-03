import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PERIODE_NOEKKEL, type HarBallenBruker, type Periode } from "@sitedoc/shared";
import { trpc } from "../../lib/trpc";
import { useNettverk } from "../../providers/NettverkProvider";
import { antallAktiveFilter, FILTER_KOLONNER, type Sortering } from "./dokumentlisteFilter";
import { filterEtikett } from "./FilterOgSorteringSheet";

export const PERIODE_ALLE: Periode = { hurtigvalg: "alle", fra: null, til: null };

/** Pseudo-kolonne for opprettet-perioden i chip-raden (ikke et likhetsfilter). */
const PERIODE_CHIP = "__periode__";

/**
 * Listetilstand for søk + filter + sortering + opprettet-periode i sjekkliste- og
 * oppgavelista (filter-mobil 2026-11-03). Overlever navigasjon inn/ut av et
 * dokument (skjermen forblir montert); nullstilles ved prosjektbytte.
 * «Ballen hos meg» trenger brukerens grupper fra serveren → `ballenBruker` er
 * null offline, og arket skjuler bryteren (D3).
 */
export function useDokumentlisteFilter(prosjektId: string | null | undefined) {
  const { t } = useTranslation();
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
  const ballenBruker: HarBallenBruker | null = useMemo(
    () => (erPaaNettet && flytInfo ? { userId: flytInfo.userId, gruppeIder: flytInfo.gruppeIder } : null),
    [erPaaNettet, flytInfo],
  );

  // Offline ignoreres «ballen» i filtreringen; fjern den så telleren ikke lyver.
  const effektiveFilter = useMemo(() => {
    if (ballenBruker || !filterVerdier.ballen) return filterVerdier;
    const { ballen: _ballen, ...rest } = filterVerdier;
    return rest;
  }, [filterVerdier, ballenBruker]);

  const søkerNaa = søkeAktiv && søketekst.trim().length > 0;
  const søkeTokens = useMemo(
    () => (søkerNaa ? søketekst.trim().split(/\s+/).filter((tk) => tk.length >= 2) : []),
    [søkerNaa, søketekst],
  );

  const antallFilter = antallAktiveFilter(effektiveFilter, periode);

  // Fjernbare filter-chips over lista (fabel-designlås pkt 6).
  const aktiveChips = useMemo(() => {
    const chips: { kolId: string; value: string; label: string }[] = [];
    for (const kolId of FILTER_KOLONNER) {
      const v = effektiveFilter[kolId];
      if (!v) continue;
      for (const del of v.split(",").filter(Boolean)) {
        chips.push({ kolId, value: del, label: filterEtikett(kolId, del, t) });
      }
    }
    if (periode.hurtigvalg !== "alle") {
      chips.push({
        kolId: PERIODE_CHIP,
        value: periode.hurtigvalg,
        label: `${t("tabell.opprettet")}: ${t(PERIODE_NOEKKEL[periode.hurtigvalg])}`,
      });
    }
    return chips;
  }, [effektiveFilter, periode, t]);

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
    filterVerdier: effektiveFilter,
    sortering,
    settSortering,
    periode,
    settPeriode,
    visSheet,
    settVisSheet,
    ballenBruker,
    antallFilter,
    aktiveChips,
    settFilter,
    fjernChip,
    nullstillFilter,
  };
}
