"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@sitedoc/ui";
import { kortVareforbrukInput, vareTimerader } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { VareVelger, type VareValg } from "@/components/varelager/VareVelger";
import {
  RadByggeplassFelt,
  useRadByggeplass,
} from "@/components/timer/RadByggeplassFelt";
import type { ByggeplassValg } from "@/lib/timerByggeplass";
import { SokbarNedtrekk } from "@/components/timer/SokbarNedtrekk";

/** Det vinduet trenger fra en timerad for å tilby den som kobling. */
export type VareTimeradKandidat = {
  id: string;
  projectId: string;
  fraTid?: string | null;
  tilTid?: string | null;
  timer: unknown;
  erReise?: boolean | null;
  attestertStatus?: string | null;
  /** Runde 3: uten jobb følger varens underprosjekt den valgte timeraden. */
  externalCostObjectId?: string | null;
};

/**
 * Prosjektkort L3 (2026-11-06): «+ Vareforbruk» fra et åpent kort. Prosjektet
 * er låst til kortets (vises som tekst), dato er sedelens. Linjen kobles til
 * sedelen når kortet har en timerrad for prosjektet (`dagsseddelId`).
 *
 * w1 (plan web-timeføring § 6 (g)): varen kobles også til jobbens timerad
 * (`sheetTimerId`), slik mobilens prosjektkort gjør, så den står på timeradens linje
 * i attesteringen. Første arbeidsrad er forvalgt; velgeren vises bare når jobben har
 * flere. Serveren godtar bare en rad på samme sedel og prosjekt (`gyldigVareRad`).
 *
 * w3a: med `rad` retter vinduet mengden på en ført linje (`vareforbruk.oppdater`). Varen,
 * timeraden og byggeplassen står som de er — de følger jobben.
 *
 * w3a (S2 A): åpnet fra en jobb (`jobb`) vises verken prosjekt, timerad eller byggeplass.
 * Varen kobles til jobbens første arbeidsrad og sendes med jobbens sted og kort-id.
 */
export function KortVareforbrukModal({
  projectId,
  prosjektNavn,
  dato,
  dagsseddelId,
  timerRader,
  varer,
  byggeplasser,
  rad,
  jobb,
  onClose,
}: {
  projectId: string;
  prosjektNavn: string;
  dato: string;
  dagsseddelId: string | undefined;
  /** Sedelens timerader — jobbens arbeidsrader er det varen kan kobles til. */
  timerRader: readonly VareTimeradKandidat[];
  varer: VareValg[];
  byggeplasser: readonly ByggeplassValg[] | undefined;
  /** w3a: ført varelinje som rettes (blyanten i kortet). */
  rad?: { id: string; antall: number; vare: { id: string; navn: string; enhet: string } };
  /** w3a: jobben vinduet er åpnet fra — stedet og timeraden arves. */
  jobb?: {
    kortId: string;
    byggeplassId: string | null;
    ecoId: string | null;
    sheetTimerId: string | null;
  };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [vareId, setVareId] = useState(rad?.vare.id ?? "");
  const [antall, setAntall] = useState(rad ? String(rad.antall) : "");
  const [feil, setFeil] = useState<string | null>(null);
  const bp = useRadByggeplass({ byggeplasser, projectId });
  const valgtVare = rad?.vare ?? varer.find((v) => v.id === vareId);
  const arbeidsrader = useMemo(() => vareTimerader(timerRader, projectId), [timerRader, projectId]);
  const [sheetTimerId, setSheetTimerId] = useState<string>(
    () => (jobb ? jobb.sheetTimerId : arbeidsrader[0]?.id) ?? "",
  );

  const opprett = trpc.vareforbruk.opprett.useMutation({
    onSuccess: () => {
      void utils.vareforbruk.hentMineForDato.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(t(e.message, { defaultValue: e.message })),
  });

  const oppdater = trpc.vareforbruk.oppdater.useMutation({
    onSuccess: () => {
      void utils.vareforbruk.hentMineForDato.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(t(e.message, { defaultValue: e.message })),
  });
  const lagrer = opprett.isPending || oppdater.isPending;

  function lagre() {
    setFeil(null);
    const n = Number(antall);
    if (!vareId || !Number.isFinite(n) || n <= 0) return;
    if (rad) {
      oppdater.mutate({ id: rad.id, antall: n });
      return;
    }
    opprett.mutate({
      ...kortVareforbrukInput({
        kortProsjektId: projectId,
        dato,
        vareId,
        antall: n,
        byggeplassId: jobb ? jobb.byggeplassId : bp.byggeplassId,
        // Runde 3 (dagskortet, uten jobb): underprosjektet følger den valgte timeraden.
        externalCostObjectId: jobb
          ? jobb.ecoId
          : (arbeidsrader.find((r) => r.id === sheetTimerId)?.externalCostObjectId ?? null),
        dagsseddelId,
        sheetTimerId: sheetTimerId || null,
      }),
      // Runde 7: dagskortets vare (uten jobb) krever timerad — serveren avviser i stedet for stille null.
      ...(jobb ? { kortId: jobb.kortId } : { krevTimerad: true }),
    });
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t(rad ? "vareforbruk.modal.rediger" : "vareforbruk.modal.opprett")}
    >
      <div className="space-y-3">
        {!jobb && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.prosjekt")}
            </label>
            <p className="text-sm text-gray-900">{prosjektNavn}</p>
          </div>
        )}
        {!rad && !jobb && arbeidsrader.length > 1 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.timerad")}
            </label>
            <SokbarNedtrekk
              value={sheetTimerId}
              onChange={(e) => setSheetTimerId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {arbeidsrader.map((r) => (
                <option key={r.id} value={r.id}>
                  {t("timer.maskinTimerad.valg", {
                    fra: r.fraTid ?? "",
                    til: r.tilTid ?? "",
                    timer: Number(r.timer),
                  })}
                </option>
              ))}
            </SokbarNedtrekk>
          </div>
        )}
        {!rad && !jobb && (
          <RadByggeplassFelt
            kandidater={bp.kandidater}
            verdi={bp.byggeplassId}
            onEndre={bp.setByggeplassId}
          />
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("vareforbruk.felt.vare")}
          </label>
          {rad ? (
            <p className="text-sm text-gray-900">{rad.vare.navn}</p>
          ) : (
            <VareVelger varer={varer} value={vareId} onChange={setVareId} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("vareforbruk.felt.antall") + (valgtVare ? ` (${valgtVare.enhet})` : "")}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={antall}
            onChange={(e) => setAntall(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            {t("handling.avbryt")}
          </button>
          <button
            type="button"
            onClick={lagre}
            disabled={lagrer || !vareId || !antall}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {lagrer
              ? t("handling.lagrer")
              : rad
                ? t("handling.lagre")
                : t("timer.prosjektkort.vareLagre")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
