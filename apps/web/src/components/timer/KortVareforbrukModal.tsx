"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@sitedoc/ui";
import { kortVareforbrukInput } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { VareVelger, type VareValg } from "@/components/varelager/VareVelger";
import {
  RadByggeplassFelt,
  useRadByggeplass,
} from "@/components/timer/RadByggeplassFelt";
import type { ByggeplassValg } from "@/lib/timerByggeplass";

/**
 * Prosjektkort L3 (2026-11-06): «+ Vareforbruk» fra et åpent kort. Prosjektet
 * er låst til kortets (vises som tekst), dato er sedelens. Linjen kobles til
 * sedelen når kortet har en timerrad for prosjektet (`dagsseddelId`).
 */
export function KortVareforbrukModal({
  projectId,
  prosjektNavn,
  dato,
  dagsseddelId,
  varer,
  byggeplasser,
  onClose,
}: {
  projectId: string;
  prosjektNavn: string;
  dato: string;
  dagsseddelId: string | undefined;
  varer: VareValg[];
  byggeplasser: readonly ByggeplassValg[] | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [vareId, setVareId] = useState("");
  const [antall, setAntall] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const bp = useRadByggeplass({ byggeplasser, projectId });
  const valgtVare = varer.find((v) => v.id === vareId);

  const opprett = trpc.vareforbruk.opprett.useMutation({
    onSuccess: () => {
      void utils.vareforbruk.hentMineForDato.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function lagre() {
    setFeil(null);
    const n = Number(antall);
    if (!vareId || !Number.isFinite(n) || n <= 0) return;
    opprett.mutate(
      kortVareforbrukInput({
        kortProsjektId: projectId,
        dato,
        vareId,
        antall: n,
        byggeplassId: bp.byggeplassId,
        dagsseddelId,
      }),
    );
  }

  return (
    <Modal open={true} onClose={onClose} title={t("vareforbruk.modal.opprett")}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.prosjekt")}
          </label>
          <p className="text-sm text-gray-900">{prosjektNavn}</p>
        </div>
        <RadByggeplassFelt
          kandidater={bp.kandidater}
          verdi={bp.byggeplassId}
          onEndre={bp.setByggeplassId}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("vareforbruk.felt.vare")}
          </label>
          <VareVelger varer={varer} value={vareId} onChange={setVareId} />
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
            disabled={opprett.isPending || !vareId || !antall}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {opprett.isPending ? t("handling.lagrer") : t("timer.prosjektkort.vareLagre")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
