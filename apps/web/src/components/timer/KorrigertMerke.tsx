"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formaterNorsk } from "@/lib/timer-rapport-eksport";

/**
 * w15g (plan § 4.15 del F): merket «Korrigert av» hos arbeideren. Én komponent for timelinja,
 * reiselinja, maskinlinja og tilleggslinja på dagen, og merket på dagen i Mine timer.
 *
 * Kilden er `hentMedId.korrigeringer` (pr. radtype og rad-id) og `list[].korrigertAv`. Merket
 * vises bare der `KorrigeringKontekst` er gitt (prosjektkort-modus) — dagskortet er urørt.
 */

export type KorrigertFelt = {
  felt: string;
  foer: string | number | null;
  etter: string | number | null;
  foerTekst: string | null;
  etterTekst: string | null;
};
export type Korrigering = { avNavn: string | null; ved: Date | string; felter: KorrigertFelt[] };
export type KorrigeringerPrRad = Record<"timer" | "tillegg" | "maskin", Record<string, Korrigering>>;
export type DagKorrigertAv = { navn: string | null; flere: boolean };

type T = (k: string, o?: Record<string, unknown>) => string;

const KorrigeringKontekst = createContext<KorrigeringerPrRad | null>(null);

export function KorrigeringProvider({ korrigeringer, children }: { korrigeringer: KorrigeringerPrRad | null | undefined; children: ReactNode }) {
  return <KorrigeringKontekst.Provider value={korrigeringer ?? null}>{children}</KorrigeringKontekst.Provider>;
}

/** «21.11. kl. 14:32» — dato og klokkeslett (`timer.korrigert.tidspunkt`). */
export function korrigertTid(t: T, ved: Date | string): string {
  const d = new Date(ved);
  const to = (n: number) => String(n).padStart(2, "0");
  return t("timer.korrigert.tidspunkt", { dato: `${to(d.getDate())}.${to(d.getMonth() + 1)}.`, klokke: `${to(d.getHours())}:${to(d.getMinutes())}` });
}

/** Teksten i merket på linja: «Korrigert av Kari Leder 21.11. kl. 14:32»; uten navn «Korrigert ved attestering …». */
export function korrigertTekst(t: T, k: Pick<Korrigering, "avNavn" | "ved">): string {
  const tid = korrigertTid(t, k.ved);
  return k.avNavn ? t("timer.korrigert.avMedTid", { navn: k.avNavn, tid }) : t("timer.korrigert.vedAttesteringMedTid", { tid });
}

/** Teksten på dagen i Mine timer: «Korrigert av Kari Leder», «… m.fl.», eller «Korrigert ved attestering». */
export function korrigertDagTekst(t: T, k: DagKorrigertAv): string {
  if (!k.navn) return t("timer.korrigert.vedAttestering");
  return k.flere ? t("timer.korrigert.avFlere", { navn: k.navn }) : t("timer.korrigert.av", { navn: k.navn });
}

const FELT_NOKKEL: Record<string, string> = {
  fraTid: "timer.korrigert.felt.fraTid",
  tilTid: "timer.korrigert.felt.tilTid",
  pauseMin: "timer.korrigert.felt.pauseMin",
  timer: "timer.korrigert.felt.timer",
  lonnsartId: "timer.korrigert.felt.lonnsart",
  aktivitetId: "timer.korrigert.felt.aktivitet",
  projectId: "timer.korrigert.felt.prosjekt",
  byggeplassId: "timer.korrigert.felt.byggeplass",
  externalCostObjectId: "timer.korrigert.felt.underprosjekt",
  vehicleId: "timer.korrigert.felt.maskin",
  mengde: "timer.korrigert.felt.mengde",
  enhet: "timer.korrigert.felt.enhet",
  antall: "timer.korrigert.felt.antall",
};

/** Verdien slik arbeideren leser den: navn for id-felt, tall med komma, «—» for tomt. */
function visVerdi(t: T, f: KorrigertFelt, v: string | number | null, tekst: string | null): string {
  if (f.felt === "externalCostObjectId" && v === null) return t("timer.prosjektkort.utenUnderprosjekt");
  if (v === null) return "—";
  if (tekst) return tekst;
  if (typeof v === "number") return formaterNorsk(v);
  return v;
}

/** Ett felt før → etter: { etikett, foer, etter }. */
export function korrigertFeltDeler(t: T, f: KorrigertFelt): { etikett: string; foer: string; etter: string } {
  return {
    etikett: t(FELT_NOKKEL[f.felt] ?? f.felt),
    foer: visVerdi(t, f, f.foer, f.foerTekst),
    etter: visVerdi(t, f, f.etter, f.etterTekst),
  };
}

/** Merket med feltene under, for én rad. Ingen korrigering → ingenting. */
export function KorrigertMerkeVisning({ korrigering }: { korrigering: Korrigering | null | undefined }) {
  const { t } = useTranslation();
  if (!korrigering || korrigering.felter.length === 0) return null;
  return (
    <div data-korrigert-merke="" className="mt-1">
      <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
        {korrigertTekst(t, korrigering)}
      </span>
      <p data-korrigert-felter="" className="mt-0.5 border-l-2 border-amber-300 pl-2 text-xs text-gray-600">
        {korrigering.felter.map((f, i) => {
          const d = korrigertFeltDeler(t, f);
          return (
            <span key={f.felt}>
              {i > 0 && " · "}
              {d.etikett} <s className="text-gray-400">{d.foer}</s> → {d.etter}
            </span>
          );
        })}
      </p>
    </div>
  );
}

/** Merket for raden, lest fra `KorrigeringKontekst`. Uten kontekst (dagskortet) → ingenting. */
export function KorrigertMerke({ type, radId }: { type: "timer" | "tillegg" | "maskin"; radId: string }) {
  const korrigeringer = useContext(KorrigeringKontekst);
  return <KorrigertMerkeVisning korrigering={korrigeringer?.[type]?.[radId]} />;
}

/** Merket på dagen i Mine timer (ved statusen). */
export function KorrigertAvDag({ korrigertAv }: { korrigertAv: DagKorrigertAv | null | undefined }) {
  const { t } = useTranslation();
  if (!korrigertAv) return null;
  return (
    <span data-korrigert-dag="" className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
      {korrigertDagTekst(t, korrigertAv)}
    </span>
  );
}
