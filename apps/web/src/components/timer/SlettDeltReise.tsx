"use client";

import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button, Modal } from "@sitedoc/ui";
import { midnattPartnerDato } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

/* ============================================================================
 *  O19 (vedtak-timer-web.md § Reisevinduet pkt 23): en reise over midnatt er to rader — del 1
 *  (start–24:00) og del 2 (00:00–slutt) på hver sin sedel, paret med `reiseRegel.midnatt`.
 *
 *  - `midnattTekst`: merket bak klokka — «fortsetter 24.11» / «fortsatt fra 23.11».
 *  - `SlettDeltReise`: slett-bekreftelsen. «Slett begge» sletter begge delene i én transaksjon
 *    (`fjernDeltReise`); «Bare denne» sletter raden alene (`fjernTimerRad`). Er den andre delen
 *    sendt eller attestert, finnes bare «Bare denne».
 * ============================================================================ */

/** YYYY-MM-DD → dd.mm */
function kortDato(d: string): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
}

/** «fortsetter 24.11» (del 1) / «fortsatt fra 23.11» (del 2); null = ikke delt eller dato ukjent. */
export function midnattTekst(t: TFunction, sedelDato: string | null | undefined, reiseRegel: unknown): string | null {
  if (!sedelDato) return null;
  const p = midnattPartnerDato(sedelDato, reiseRegel);
  if (!p) return null;
  return t(p.del === 1 ? "timer.reise.fortsetter" : "timer.reise.fortsattFra", { dato: kortDato(p.dato) });
}

export function SlettDeltReise({ radId, onLukk }: { radId: string; onLukk: () => void }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: partner, isLoading } = trpc.timer.dagsseddel.finnReiseDel.useQuery({ radId });
  const ferdig = {
    onSuccess: () => {
      void utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => alert(e.message),
  };
  const begge = trpc.timer.dagsseddel.fjernDeltReise.useMutation(ferdig);
  const bareDenne = trpc.timer.dagsseddel.fjernTimerRad.useMutation(ferdig);
  const laast = !!partner && partner.status !== "draft" && partner.status !== "returned";
  const opptatt = begge.isPending || bareDenne.isPending;

  return (
    <Modal open={true} onClose={onLukk} title={t("timer.fjernTimerRad.tittel")}>
      <div className="space-y-4" data-testid="slett-delt-reise">
        <p className="text-sm text-gray-700">
          {isLoading
            ? "…"
            : !partner
              ? t("timer.reise.deltSlett.alene")
              : laast
                ? t("timer.reise.deltSlett.laast", { dato: kortDato(partner.dato) })
                : t("timer.reise.deltSlett.tekst", {
                    fra: partner.fraTid ?? "",
                    til: partner.tilTid ?? "",
                    dato: kortDato(partner.dato),
                  })}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button variant="secondary" disabled={isLoading || opptatt} onClick={() => bareDenne.mutate({ id: radId })}>
            {t("timer.reise.deltSlett.bareDenne")}
          </Button>
          {partner && !laast && (
            <Button variant="danger" loading={begge.isPending} disabled={opptatt} onClick={() => begge.mutate({ id: radId })}>
              {t("timer.reise.deltSlett.slettBegge")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
