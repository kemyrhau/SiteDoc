"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SokbarNedtrekk } from "@/components/timer/SokbarNedtrekk";

/** Feltene velgeren trenger fra en timerad (sedelens `timer`-rader). */
export type TimeradValgRad = {
  id: string;
  projectId: string;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  attestertStatus: string | null;
  erReise?: boolean;
  /** Retur 1 runde 6: tillegg og utlegg arver timeradens underprosjekt. */
  externalCostObjectId?: string | null;
};

const tilTall = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/**
 * Runde 6 (Kenneth 2026-11-27: «Varer, utlegg, tillegg … disse må knyttes til menneskets timer ·
 * reisetid og knyttes til prosjekt»; bare dagskort). Timeradene et tillegg eller utlegg kan stå
 * på: prosjektets arbeid og reise, ikke erstattet. Forvalgt når prosjektet har én; ved redigering
 * radens egen. `timerader` utelatt (prosjektkort-modus, eller åpnet fra en jobb) = ingen velger,
 * og payloaden er som før.
 *
 * Retur 1 runde 6 (Kenneth: «Ja, arv timeraden»): underprosjektet utledes av serveren fra valgt
 * timerad (`ecoId` viser det). Redigering av en lagret rad uten kobling i et prosjekt uten
 * timerad: ingen velger, Lagre tillates (aldri sperre) — `redigerer` = vinduet har en lagret rad.
 */
export function useTimeradValg(
  timerader: readonly TimeradValgRad[] | undefined,
  projectId: string,
  lagret: string | null | undefined,
  redigerer = false,
) {
  const rader = useMemo(
    () =>
      (timerader ?? [])
        .filter((r) => r.projectId === projectId && r.attestertStatus !== "erstattet")
        .sort((a, b) => (a.fraTid ?? "").localeCompare(b.fraTid ?? "")),
    [timerader, projectId],
  );
  const [id, setId] = useState<string>(() => {
    if (lagret && rader.some((r) => r.id === lagret)) return lagret;
    return rader.length === 1 ? rader[0]!.id : "";
  });
  const aktiv = timerader !== undefined && !(redigerer && !lagret && rader.length === 0);
  const valgt = rader.find((r) => r.id === id);
  return {
    aktiv,
    rader,
    id,
    setId,
    /** Klar til lagring: velgeren er av, eller en rad er valgt. */
    klar: !aktiv || !!id,
    payload: aktiv ? { sheetTimerId: id } : {},
    /** Valgt timerads underprosjekt (null = uten); `undefined` = ingen rad valgt. */
    ecoId: valgt ? (valgt.externalCostObjectId ?? null) : undefined,
  };
}

export function TimeradVelger({ valg }: { valg: ReturnType<typeof useTimeradValg> }) {
  const { t } = useTranslation();
  if (!valg.aktiv) return null;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {t("timer.felt.timerad")}
      </label>
      <SokbarNedtrekk
        value={valg.id}
        onChange={(e) => valg.setId(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        data-testid="timerad-velger"
        required
      >
        <option value="">{t("timer.maskinTimerad.placeholder")}</option>
        {valg.rader.map((r) => {
          const v = { fra: r.fraTid ?? "", til: r.tilTid ?? "", timer: tilTall(r.timer) };
          return (
            <option key={r.id} value={r.id}>
              {r.erReise ? t("timer.timeradValg.reise", v) : t("timer.maskinTimerad.valg", v)}
            </option>
          );
        })}
      </SokbarNedtrekk>
    </div>
  );
}
