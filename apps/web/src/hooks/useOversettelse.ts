"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";

interface OversettRapportObjekt {
  id: string;
  label: string;
  config: Record<string, unknown>;
}

/**
 * Hook for on-demand oversettelse av firmainnhold i maler (Lag 2).
 * Viser 🌐-knapp når brukerens språk != prosjektets kildespråk.
 * Oversetter labels, hjelpetekst og valgalternativer.
 */
export function useOversettelse(
  prosjektId: string | undefined,
  prosjektKildesprak: string | undefined,
  objekter: OversettRapportObjekt[],
) {
  const { i18n } = useTranslation();
  const [oversettelser, setOversettelser] = useState<Record<string, string>>({});
  const [laster, setLaster] = useState(false);

  const brukerSpraak = i18n.language ?? "nb";
  const kildesprak = prosjektKildesprak ?? "nb";
  const visOversettKnapp = brukerSpraak !== kildesprak;

  const oversettMut = trpc.mal.oversettFelter.useMutation({
    onSuccess: (data: Record<string, string>) => {
      setOversettelser((prev) => ({ ...prev, ...data }));
      setLaster(false);
    },
    onError: () => setLaster(false),
  });

  // Samle alle unike tekster fra objektene som trenger oversettelse
  const alleTekster = useMemo(() => {
    const tekster = new Set<string>();
    for (const obj of objekter) {
      if (obj.label) tekster.add(obj.label);
      if (typeof obj.config.helpText === "string" && obj.config.helpText) {
        tekster.add(obj.config.helpText);
      }
      // Valgalternativer
      const options = obj.config.options;
      if (Array.isArray(options)) {
        for (const opt of options) {
          if (typeof opt === "string") tekster.add(opt);
          else if (opt && typeof opt === "object" && "label" in opt && typeof (opt as { label: string }).label === "string") {
            tekster.add((opt as { label: string }).label);
          }
        }
      }
    }
    return [...tekster];
  }, [objekter]);

  // Oversett alle felter for hele malen
  const oversettAlt = useCallback(() => {
    if (!prosjektId || !visOversettKnapp || alleTekster.length === 0) return;
    // Filtrer bort allerede oversatte
    const manglende = alleTekster.filter((t) => !oversettelser[t]);
    if (manglende.length === 0) return;

    setLaster(true);
    oversettMut.mutate({
      projectId: prosjektId,
      tekster: manglende.slice(0, 200), // API maks 200
      targetLang: brukerSpraak,
    });
  }, [prosjektId, visOversettKnapp, alleTekster, oversettelser, brukerSpraak, oversettMut]);

  // Oversett enkeltfelt (kalt fra 🌐-knappen)
  const oversettFelt = useCallback((objekt: OversettRapportObjekt) => {
    if (!prosjektId || !visOversettKnapp) return;
    const tekster: string[] = [];
    if (objekt.label && !oversettelser[objekt.label]) tekster.push(objekt.label);
    if (typeof objekt.config.helpText === "string" && objekt.config.helpText && !oversettelser[objekt.config.helpText]) {
      tekster.push(objekt.config.helpText);
    }
    const options = objekt.config.options;
    if (Array.isArray(options)) {
      for (const opt of options) {
        const label = typeof opt === "string" ? opt : (opt as { label?: string })?.label;
        if (label && !oversettelser[label]) tekster.push(label);
      }
    }
    if (tekster.length === 0) return; // Allerede oversatt
    setLaster(true);
    oversettMut.mutate({
      projectId: prosjektId,
      tekster,
      targetLang: brukerSpraak,
    });
  }, [prosjektId, visOversettKnapp, oversettelser, brukerSpraak, oversettMut]);

  return {
    oversettelser,
    laster,
    visOversettKnapp,
    oversettAlt,
    oversettFelt,
  };
}
