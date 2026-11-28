"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { Button, Modal } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { TallFelt, TidFelter, type TallRetting, type TidRetting } from "./RegistreringPanel";
import { SokbarNedtrekk } from "@/components/timer/SokbarNedtrekk";

/**
 * w15g (plan § 4.15 del F, F63) — vinduet bak ✎ på en linje i attesteringskortet. Kortet er
 * informasjonsstatus (tekst); her rettes det som før sto åpent i kortet:
 *  - timelinje: fra, til og pause (timebasert lønnsart) eller timer, og lønnsart;
 *  - maskinlinje: timer, med «høyst X t» (w9 2c);
 *  - tilleggslinje: antall.
 * «Lagre» sender én `rettRadFelt` med feltene som er endret; «Avbryt» endrer ingenting. Avviser
 * serveren, står grunnen i vinduet og vinduet blir stående. Linja øverst sier hva arbeideren ser.
 */

export type LinjeRett =
  | {
      type: "timer";
      radId: string;
      tittel: string;
      lagret: { fraTid: string | null; tilTid: string | null; pauseMin: number; timer: number | null; lonnsartId: string };
      /** Timebasert lønnsart → fra–til; ellers tallfelt for timer (`erTimebasertLonnsart`). */
      timebasert: boolean;
      lonnsValg: readonly { id: string; navn: string }[];
    }
  | { type: "maskin"; radId: string; tittel: string; timer: number | null; hoyst: number | null }
  | { type: "tillegg"; radId: string; tittel: string; antall: number | null };

export type LinjeRettKall =
  | { type: "ingen" }
  | { type: "feil"; nokkel: string }
  | { type: "sperret" }
  | { type: "rett"; felter: Record<string, string | number | null> };

const UGYLDIG_TALL = "timer.korrigert.vindu.ugyldigTall";

/** Hva «Lagre» sender — rent, så testen kan måle det uten nettleser. */
export function linjeRettKall(linje: LinjeRett, tid: TidRetting, tall: TallRetting, lonnsartId: string): LinjeRettKall {
  const felter: Record<string, string | number | null> = {};
  if (linje.type === "timer") {
    if (linje.timebasert) {
      if (tid.type === "feil") return { type: "feil", nokkel: tid.nokkel };
      if (tid.type === "ok") Object.assign(felter, tid.felter);
    } else {
      if (tall.type === "feil") return { type: "feil", nokkel: UGYLDIG_TALL };
      if (tall.type === "ok") felter.timer = tall.verdi;
    }
    if (lonnsartId !== linje.lagret.lonnsartId) felter.lonnsartId = lonnsartId;
  } else {
    if (tall.type === "feil") return { type: "feil", nokkel: UGYLDIG_TALL };
    if (tall.type === "over") return { type: "sperret" };
    if (tall.type === "ok") felter[linje.type === "maskin" ? "timer" : "antall"] = tall.verdi;
  }
  return Object.keys(felter).length === 0 ? { type: "ingen" } : { type: "rett", felter };
}

export function LinjeRettVindu({ linje, arbeiderNavn, tidsrunding = null, onLagret, onAvbryt }: {
  linje: LinjeRett;
  arbeiderNavn: string | null;
  tidsrunding?: number | null;
  onLagret: () => void;
  onAvbryt: () => void;
}) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const rett = trpc.timer.dagsseddel.rettRadFelt.useMutation();
  const [tid, setTid] = useState<TidRetting>({ type: "uendret" });
  const [tall, setTall] = useState<TallRetting>({ type: "uendret" });
  const [lonnsartId, setLonnsartId] = useState(linje.type === "timer" ? linje.lagret.lonnsartId : "");
  const [feil, setFeil] = useState<string | null>(null);

  const kall = linjeRettKall(linje, tid, tall, lonnsartId);
  const attestant = session?.user?.name ?? null;

  function lagre() {
    setFeil(null);
    if (kall.type === "ingen") { onAvbryt(); return; }
    if (kall.type === "feil") { setFeil(t(kall.nokkel)); return; }
    if (kall.type === "sperret") return;
    rett.mutate({ radType: linje.type, radId: linje.radId, felter: kall.felter } as Parameters<typeof rett.mutate>[0], {
      onSuccess: (_d: unknown) => onLagret(),
      onError: (e: { message: string }) => setFeil(e.message),
    });
  }

  const inp = "w-full rounded border border-gray-300 px-3 py-2 text-sm";
  return (
    <Modal open onClose={onAvbryt} title={t(`timer.korrigert.vindu.${linje.type}`)} className="w-full max-w-lg">
      <div data-linje-rett-vindu={linje.type} className="flex flex-col gap-3 text-sm">
        <p className="font-medium text-gray-900">{linje.tittel}</p>
        {linje.type === "timer" && (
          <>
            {linje.timebasert ? (
              <TidFelter lagret={linje.lagret} tidsrunding={tidsrunding} onEndre={setTid} />
            ) : (
              <TallFelt etikett={t("timer.eksport.kolTimer")} verdi={linje.lagret.timer} onEndre={setTall} />
            )}
            <label className="block">
              <span className="mb-1 block font-medium text-gray-700">{t("timer.attestering.registrering.lonnsart")}</span>
              <SokbarNedtrekk aria-label={t("timer.attestering.registrering.lonnsart")} value={lonnsartId} onChange={(e) => setLonnsartId(e.target.value)} className={inp}>
                {linje.lonnsValg.map((x) => <option key={x.id} value={x.id}>{x.navn}</option>)}
              </SokbarNedtrekk>
            </label>
          </>
        )}
        {linje.type === "maskin" && (
          <TallFelt etikett={t("timer.eksport.kolMaskintimer")} verdi={linje.timer} enhet="t" hoyst={linje.hoyst} onEndre={setTall} />
        )}
        {linje.type === "tillegg" && (
          <TallFelt etikett={t("timer.eksport.kolAntall")} verdi={linje.antall} onEndre={setTall} />
        )}
        {arbeiderNavn && (
          <p data-korrigert-linje="" className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            {attestant
              ? t("timer.korrigert.vinduLinje", { arbeider: arbeiderNavn, attestant })
              : t("timer.korrigert.vinduLinjeUtenNavn", { arbeider: arbeiderNavn })}
          </p>
        )}
        {feil && <p role="alert" className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onAvbryt} disabled={rett.isPending}>{t("handling.avbryt")}</Button>
          <Button onClick={lagre} disabled={rett.isPending || kall.type === "sperret"}>{t("handling.lagre")}</Button>
        </div>
      </div>
    </Modal>
  );
}
