"use client";

// LAG 2 D1 (timer-GPS) — reise-sporet på attestant-raden. ÉN kilde delt av
// SeddelKort (listekort) og TimerRaderLeder (detalj), så de to flatene ikke
// viser reise ulikt. Rendrer kun for `erReise === true`.
//
// 🔴 Ærlighet (ordre D1 + stille-tomhet): en gammel backfill-rad uten etappe
// (reiseKilde=null, ingen km/min) viser «reise (kilde ukjent)» — ALDRI tomme
// «— km · — min» som ser ut som tall. reiseAvvik === true gir varsel; `null`
// (ikke kontrollerbar) viser ingenting og skal ikke se ut som «ok».

import { useTranslation } from "react-i18next";
import { Car, AlertTriangle } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { trpc } from "@/lib/trpc";
import type { TimerRad } from "./attestering-buckets";
import { reiseMerkeNokkel } from "./reise-merke";

export function ReiseRadMerke({ rad }: { rad: TimerRad }) {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const erReise = rad.erReise === true;
  // Hooks før early-return (rules-of-hooks). Deler cache på tvers av rader.
  const { data: steder } = trpc.oppmotested.hentForFirma.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && erReise },
  );
  const { data: plasser } = trpc.bygning.hentForFirma.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && erReise },
  );
  if (!erReise) return null;

  const retning = rad.reiseRetning ?? null;
  const kontor = rad.reiseOppmotestedId
    ? (steder?.find((s) => s.id === rad.reiseOppmotestedId)?.navn ?? null)
    : null;
  const bygg = rad.byggeplassId
    ? (plasser?.find((p) => p.id === rad.byggeplassId)?.name ?? null)
    : null;
  const fra = retning === "ut" ? kontor : retning === "retur" ? bygg : null;
  const til = retning === "ut" ? bygg : retning === "retur" ? kontor : null;

  const harDetaljer =
    rad.reiseKilde != null || rad.reiseAvstandM != null || rad.reiseKjoretidMin != null;

  // RETUR 1 avvik 1: manuell → «Reise (manuell)», retningsløs → nøytral «Reise»,
  // aldri «Reise ut» uten faktisk retning.
  const merke = t(reiseMerkeNokkel(rad));

  const tidMerke =
    rad.tidKilde === "utledet"
      ? t("timer.attestering.reise.tidUtledet")
      : rad.tidKilde === "manuell"
        ? t("timer.attestering.reise.tidManuell")
        : rad.tidKilde === "stempel"
          ? t("timer.attestering.reise.tidStempel")
          : null;

  // Rute-linjen settes sammen av KUN de bitene som finnes — ingen «— km».
  const ruteDeler: string[] = [];
  if (fra && til) ruteDeler.push(`${fra} → ${til}`);
  else if (fra) ruteDeler.push(fra);
  else if (til) ruteDeler.push(til);
  if (rad.reiseAvstandM != null) {
    ruteDeler.push(t("timer.attestering.reise.avstand", { km: String(rad.reiseAvstandM / 1000) }));
  }
  if (rad.reiseKjoretidMin != null) {
    ruteDeler.push(t("timer.attestering.reise.kjoretid", { min: String(rad.reiseKjoretidMin) }));
  }
  if (rad.reiseKilde) ruteDeler.push(t(`timer.reise.kilde.${rad.reiseKilde}`));

  return (
    <div className="mt-1 space-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
          <Car className="h-3 w-3" />
          {merke}
        </span>
        <span className="text-xs text-gray-600">
          {harDetaljer ? ruteDeler.join(" · ") : t("timer.attestering.reise.kildeUkjent")}
        </span>
        {tidMerke && <span className="text-[11px] italic text-gray-400">{tidMerke}</span>}
      </div>
      {rad.reiseAvvik === true && (
        <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          {t("timer.attestering.reise.avvikVarsel")}
        </span>
      )}
    </div>
  );
}
