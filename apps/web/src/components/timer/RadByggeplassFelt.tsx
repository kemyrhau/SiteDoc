"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import {
  byggeplassErEndret,
  byggeplasserForProsjekt,
  velgStandardByggeplass,
  type ByggeplassValg,
} from "@/lib/timerByggeplass";

/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 * Ny rad: forhåndsvalg (én kandidat → den, ellers toppbarens hvis den hører til
 * prosjektet) og nullstilling ved prosjektbytte. Redigering: radens verdi, ingen
 * auto — `endret` sier om feltet skal sendes, så mobilens byggeplass står urørt.
 */
export function useRadByggeplass(args: {
  byggeplasser: readonly ByggeplassValg[] | undefined;
  projectId: string;
  rad?: { byggeplassId: string | null };
}) {
  const { byggeplasser, projectId, rad } = args;
  const { aktivByggeplass } = useByggeplass();
  const toppbar = aktivByggeplass?.id ?? null;
  const erNy = !rad;
  const kandidater = useMemo(
    () => byggeplasserForProsjekt(byggeplasser, projectId),
    [byggeplasser, projectId],
  );
  const opprinnelig = rad?.byggeplassId ?? null;
  const [byggeplassId, setByggeplassId] = useState<string | null>(opprinnelig);
  useEffect(() => {
    if (!erNy) return;
    setByggeplassId((gjeldende) =>
      velgStandardByggeplass({ gjeldende, kandidater, toppbar }),
    );
  }, [erNy, kandidater, toppbar]);
  return {
    kandidater,
    byggeplassId,
    setByggeplassId,
    endret: byggeplassErEndret({ erNy, opprinnelig, byggeplassId }),
  };
}

/** Adaptivt felt: 0 kandidater = skjult, 1 valgt = tekst, ellers nedtrekk med tomt valg. */
export function RadByggeplassFelt({
  kandidater,
  verdi,
  onEndre,
}: {
  kandidater: readonly ByggeplassValg[];
  verdi: string | null;
  onEndre: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  if (kandidater.length === 0) return null;
  const eneste = kandidater.length === 1 ? kandidater[0]! : null;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {t("timer.felt.byggeplass")}
      </label>
      {eneste && verdi === eneste.id ? (
        <p className="text-sm text-gray-900">{eneste.name}</p>
      ) : (
        <select
          value={verdi ?? ""}
          onChange={(e) => onEndre(e.target.value || null)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t("timer.byggeplass.ingenValgt")}</option>
          {kandidater.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
