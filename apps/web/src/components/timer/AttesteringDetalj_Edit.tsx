"use client";

// T7-2b2 (2026-05-14): Edit-modus for sedel — firma-admin redigerer rader
// direkte uten å returnere til arbeider.
// Mounted fra AttesteringDetalj.tsx når redigerModus = true.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@sitedoc/ui";
import { Plus } from "lucide-react";
import { RedigerTimerRad } from "./RedigerTimerRad";
import { RedigerTilleggRad } from "./RedigerTilleggRad";
import { RedigerMaskinRad } from "./RedigerMaskinRad";
import { SplittRadModal } from "./SplittRadModal";
import type {
  RedigerTimerRadData,
  RedigerTilleggRadData,
  RedigerMaskinRadData,
  ProsjektValg,
} from "./rediger-types";

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

type TimerRad = {
  id: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  projectId: string;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  attestertStatus: string | null;
  // T7-2c3: parentRadId trengs for å skjule Splitt-knapp på split-resultatet selv
  parentRadId?: string | null;
};
type TilleggRad = {
  id: string;
  tilleggId: string;
  projectId: string;
  antall: unknown;
  kommentar: string | null;
  attestertStatus: string | null;
  parentRadId?: string | null;
};
type MaskinRad = {
  id: string;
  vehicleId: string;
  projectId: string;
  // T7-4d (2026-05-16): ECO på maskin-rad. Server returnerer feltet fra T7-4b.
  externalCostObjectId: string | null;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
  attestertStatus: string | null;
  parentRadId?: string | null;
};

// T7-2c3: hva som er aktiv splitt-handling (null = ingen modal åpen).
type SplittAktiv =
  | { radType: "timer"; original: TimerRad }
  | { radType: "tillegg"; original: TilleggRad }
  | { radType: "maskin"; original: MaskinRad }
  | null;

type Props = {
  sheetId: string;
  organizationId: string;
  timerRader: TimerRad[];
  tilleggRader: TilleggRad[];
  maskinRader: MaskinRad[];
  onAvbryt: () => void;
  onLagret: () => void;
};

function nyKey(): string {
  return `ny-${Math.random().toString(36).slice(2, 11)}`;
}

export function AttesteringDetaljEdit({
  sheetId,
  organizationId,
  timerRader,
  tilleggRader,
  maskinRader,
  onAvbryt,
  onLagret,
}: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: prosjekter } = trpc.prosjekt.hentAlle.useQuery(
    { organizationId },
    { enabled: !!organizationId },
  );

  // T.5: hent tidsrunding fra firma-setting for time-input runding.
  const { data: setting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId },
    { enabled: !!organizationId },
  );
  const tidsrundingMinutter = setting?.tidsrundingMinutter ?? null;

  const prosjektListe = (prosjekter ?? []) as Array<{
    id: string;
    name: string;
    projectNumber: string | null;
  }>;
  const prosjektValg: ProsjektValg[] = prosjektListe.map((p) => ({
    id: p.id,
    name: `${p.projectNumber ?? ""} ${p.name}`.trim(),
  }));

  const pendingTimer = timerRader.filter((r) => r.attestertStatus === "pending");
  const pendingTillegg = tilleggRader.filter((r) => r.attestertStatus === "pending");
  const pendingMaskin = maskinRader.filter((r) => r.attestertStatus === "pending");

  const initTimer: RedigerTimerRadData[] = pendingTimer.map((r) => ({
    key: r.id,
    originalId: r.id,
    projectId: r.projectId,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    externalCostObjectId: r.externalCostObjectId,
    byggeplassId: r.byggeplassId,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    timer: tilTall(r.timer),
  }));
  const initTillegg: RedigerTilleggRadData[] = pendingTillegg.map((r) => ({
    key: r.id,
    originalId: r.id,
    projectId: r.projectId,
    tilleggId: r.tilleggId,
    antall: tilTall(r.antall),
    kommentar: r.kommentar,
  }));
  const initMaskin: RedigerMaskinRadData[] = pendingMaskin.map((r) => ({
    key: r.id,
    originalId: r.id,
    projectId: r.projectId,
    externalCostObjectId: r.externalCostObjectId,
    vehicleId: r.vehicleId,
    byggeplassId: r.byggeplassId,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    timer: tilTall(r.timer),
    mengde: r.mengde === null || r.mengde === undefined ? null : tilTall(r.mengde),
    enhet: r.enhet,
  }));

  const [editTimer, setEditTimer] = useState<RedigerTimerRadData[]>(initTimer);
  const [editTillegg, setEditTillegg] = useState<RedigerTilleggRadData[]>(initTillegg);
  const [editMaskin, setEditMaskin] = useState<RedigerMaskinRadData[]>(initMaskin);
  const [feil, setFeil] = useState<string | null>(null);

  // T7-2c3: aktiv splitt-handling. null = ingen modal åpen.
  const [splittAktivFor, setSplittAktivFor] = useState<SplittAktiv>(null);

  // T7-2c3: når splitt har lagret, må edit-state synkroniseres med ferske
  // pending-rader fra server (cache er allerede invalidert av modalen).
  // Vi sammenligner sorterte ID-er; ved første render blir refs satt uten å
  // røre state. Etterfølgende prop-endringer (typisk fra splitt-resultat)
  // resetter state til nye init-verdier.
  const sistSettPendingIder = useRef<string>("");
  useEffect(() => {
    const ider = [
      ...pendingTimer.map((r) => `t:${r.id}`),
      ...pendingTillegg.map((r) => `a:${r.id}`),
      ...pendingMaskin.map((r) => `m:${r.id}`),
    ]
      .sort()
      .join(",");
    if (sistSettPendingIder.current === "") {
      sistSettPendingIder.current = ider;
      return;
    }
    if (ider !== sistSettPendingIder.current) {
      sistSettPendingIder.current = ider;
      setEditTimer(initTimer);
      setEditTillegg(initTillegg);
      setEditMaskin(initMaskin);
    }
    // initTimer/initTillegg/initMaskin er bevisst utelatt fra deps —
    // ID-strengen er en stabil proxy for hvilke pending-rader som finnes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTimer, pendingTillegg, pendingMaskin]);

  const lagre = trpc.timer.dagsseddel.redigerSedelRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: sheetId });
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      onLagret();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const førsteProsjektId =
    editTimer[0]?.projectId ??
    editTillegg[0]?.projectId ??
    editMaskin[0]?.projectId ??
    prosjektValg[0]?.id ??
    "";

  // T7-4d: leggTilTimer/Maskin tar (projectId, ecoId) for å pre-selektere
  // riktig prosjekt+ECO-bucket når bruker klikker "+Legg til" i en gruppe.
  // Fallback til førsteProsjektId hvis kalt uten parametre.
  function leggTilTimer(pid: string = førsteProsjektId, ecoId: string | null = null) {
    setEditTimer((rader) => [
      ...rader,
      {
        key: nyKey(),
        originalId: null,
        projectId: pid,
        lonnsartId: "",
        aktivitetId: "",
        externalCostObjectId: ecoId,
        byggeplassId: null,
        fraTid: null,
        tilTid: null,
        timer: 0,
      },
    ]);
  }
  function leggTilTillegg() {
    setEditTillegg((rader) => [
      ...rader,
      {
        key: nyKey(),
        originalId: null,
        projectId: førsteProsjektId,
        tilleggId: "",
        antall: 0,
        kommentar: null,
      },
    ]);
  }
  function leggTilMaskin(pid: string = førsteProsjektId, ecoId: string | null = null) {
    setEditMaskin((rader) => [
      ...rader,
      {
        key: nyKey(),
        originalId: null,
        projectId: pid,
        externalCostObjectId: ecoId,
        vehicleId: "",
        byggeplassId: null,
        fraTid: null,
        tilTid: null,
        timer: 0,
        mengde: null,
        enhet: null,
      },
    ]);
  }

  function oppdaterTimer(key: string, felt: Partial<RedigerTimerRadData>) {
    setEditTimer((rader) =>
      rader.map((r) => (r.key === key ? { ...r, ...felt } : r)),
    );
  }
  function oppdaterTillegg(key: string, felt: Partial<RedigerTilleggRadData>) {
    setEditTillegg((rader) =>
      rader.map((r) => (r.key === key ? { ...r, ...felt } : r)),
    );
  }
  function oppdaterMaskin(key: string, felt: Partial<RedigerMaskinRadData>) {
    setEditMaskin((rader) =>
      rader.map((r) => (r.key === key ? { ...r, ...felt } : r)),
    );
  }

  function slettTimer(key: string) {
    setEditTimer((rader) => rader.filter((r) => r.key !== key));
  }
  function slettTillegg(key: string) {
    setEditTillegg((rader) => rader.filter((r) => r.key !== key));
  }
  function slettMaskin(key: string) {
    setEditMaskin((rader) => rader.filter((r) => r.key !== key));
  }

  // T7-2c3: detekter om edit-state har ulagrede endringer (annet enn
  // initial-tilstanden bygget fra pending-rader). Brukes til å spørre
  // brukeren før modal åpnes — splitt nullstiller edit-state.
  const harUlagredeEndringer = useMemo(() => {
    if (editTimer.length !== initTimer.length) return true;
    if (editTillegg.length !== initTillegg.length) return true;
    if (editMaskin.length !== initMaskin.length) return true;
    return (
      JSON.stringify(editTimer) !== JSON.stringify(initTimer) ||
      JSON.stringify(editTillegg) !== JSON.stringify(initTillegg) ||
      JSON.stringify(editMaskin) !== JSON.stringify(initMaskin)
    );
  }, [editTimer, editTillegg, editMaskin, initTimer, initTillegg, initMaskin]);

  // T7-2c3: åpne splitt-modal etter ulagrede-endringer-sjekk.
  function aapneSplitt(aktiv: SplittAktiv) {
    if (!aktiv) return;
    if (harUlagredeEndringer && !window.confirm(t("timer.rediger.splittBekreft"))) {
      return;
    }
    setSplittAktivFor(aktiv);
  }

  function handleLagre() {
    setFeil(null);
    // Validering: ingen tomme dropdown-verdier på timer/tillegg/maskin
    for (const r of editTimer) {
      if (!r.projectId || !r.lonnsartId || !r.aktivitetId || r.timer <= 0) {
        setFeil(t("timer.rediger.feil.timerInkomplett"));
        return;
      }
    }
    for (const r of editTillegg) {
      if (!r.projectId || !r.tilleggId || r.antall <= 0) {
        setFeil(t("timer.rediger.feil.tilleggInkomplett"));
        return;
      }
    }
    for (const r of editMaskin) {
      if (!r.projectId || !r.vehicleId || r.timer <= 0) {
        setFeil(t("timer.rediger.feil.maskinInkomplett"));
        return;
      }
    }

    lagre.mutate({
      sheetId,
      nyeRader: {
        timer: editTimer.map((r) => ({
          originalId: r.originalId,
          projectId: r.projectId,
          lonnsartId: r.lonnsartId,
          aktivitetId: r.aktivitetId,
          externalCostObjectId: r.externalCostObjectId,
          byggeplassId: r.byggeplassId,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
        })),
        tillegg: editTillegg.map((r) => ({
          originalId: r.originalId,
          projectId: r.projectId,
          tilleggId: r.tilleggId,
          antall: r.antall,
          kommentar: r.kommentar,
        })),
        maskin: editMaskin.map((r) => ({
          originalId: r.originalId,
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId,
          vehicleId: r.vehicleId,
          byggeplassId: r.byggeplassId,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
          mengde: r.mengde,
          enhet: r.enhet,
        })),
      },
    });
  }

  // T7-4d: Bygg prosjekt+ECO-buckets. Timer + maskin grupperes per
  // (projectId, externalCostObjectId). Tillegg holdes per-prosjekt
  // (ingen ECO-felt på SheetTillegg).
  type EditBucket = {
    projectId: string;
    ecoId: string | null;
    timer: RedigerTimerRadData[];
    maskin: RedigerMaskinRadData[];
  };
  const bucketKey = (pid: string, eco: string | null) => `${pid}|${eco ?? ""}`;
  const bucketMap = new Map<string, EditBucket>();
  const prosjektEcoMap = new Map<string, string[]>();
  const prosjektRekkefolge: string[] = [];
  const tilleggPerProsjekt = new Map<string, RedigerTilleggRadData[]>();

  const noterProsjekt = (pid: string) => {
    if (!prosjektEcoMap.has(pid)) {
      prosjektEcoMap.set(pid, []);
      prosjektRekkefolge.push(pid);
    }
  };
  const noterBucket = (pid: string, eco: string | null) => {
    noterProsjekt(pid);
    const ekv = eco ?? "";
    const liste = prosjektEcoMap.get(pid)!;
    if (!liste.includes(ekv)) liste.push(ekv);
    const k = bucketKey(pid, eco);
    if (!bucketMap.has(k)) {
      bucketMap.set(k, { projectId: pid, ecoId: eco, timer: [], maskin: [] });
    }
  };

  for (const r of editTimer) {
    noterBucket(r.projectId, r.externalCostObjectId);
    bucketMap.get(bucketKey(r.projectId, r.externalCostObjectId))!.timer.push(r);
  }
  for (const r of editMaskin) {
    noterBucket(r.projectId, r.externalCostObjectId);
    bucketMap.get(bucketKey(r.projectId, r.externalCostObjectId))!.maskin.push(r);
  }
  for (const r of editTillegg) {
    noterProsjekt(r.projectId);
    const liste = tilleggPerProsjekt.get(r.projectId) ?? [];
    liste.push(r);
    tilleggPerProsjekt.set(r.projectId, liste);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>{t("timer.rediger.modus.tittel")}</strong>
        <p className="mt-1 text-xs">{t("timer.rediger.modus.beskrivelse")}</p>
      </div>

      {/* Original-rader komprimert (read-only) */}
      <OriginalKomprimering
        timer={pendingTimer}
        tillegg={pendingTillegg}
        maskin={pendingMaskin}
      />

      {/* T7-4d: per-prosjekt seksjoner med ECO-bukets + tillegg */}
      {prosjektRekkefolge.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {t("timer.rediger.ingenTimer")}
        </section>
      ) : (
        prosjektRekkefolge.map((pid) => {
          const ecoKeys = prosjektEcoMap.get(pid) ?? [""];
          const ecoListe = ecoKeys.length > 0 ? ecoKeys : [""];
          const prosjektNavn =
            prosjektValg.find((p) => p.id === pid)?.name ?? pid;
          return (
            <ProsjektSectionEdit
              key={pid}
              projectId={pid}
              prosjektNavn={prosjektNavn}
              ecoKeys={ecoListe}
              bucketMap={bucketMap}
              tillegg={tilleggPerProsjekt.get(pid) ?? []}
              prosjekter={prosjektValg}
              tidsrundingMinutter={tidsrundingMinutter}
              pendingTimer={pendingTimer}
              pendingTillegg={pendingTillegg}
              pendingMaskin={pendingMaskin}
              oppdaterTimer={oppdaterTimer}
              slettTimer={slettTimer}
              oppdaterTillegg={oppdaterTillegg}
              slettTillegg={slettTillegg}
              oppdaterMaskin={oppdaterMaskin}
              slettMaskin={slettMaskin}
              leggTilTimer={leggTilTimer}
              leggTilTillegg={leggTilTillegg}
              leggTilMaskin={leggTilMaskin}
              aapneSplitt={aapneSplitt}
            />
          );
        })
      )}

      {feil && <p className="text-sm text-red-600">{feil}</p>}

      <div className="flex justify-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <Button variant="secondary" onClick={onAvbryt} disabled={lagre.isPending}>
          {t("handling.avbryt")}
        </Button>
        <Button onClick={handleLagre} disabled={lagre.isPending}>
          {lagre.isPending
            ? t("handling.lagrer")
            : t("timer.rediger.lagre")}
        </Button>
      </div>

      {/* T7-2c3: splitt-modal — åpnes per rad via Splitt-knapp */}
      {splittAktivFor && (
        <SplittRadModal
          {...splittAktivFor}
          sheetId={sheetId}
          prosjekter={prosjektValg}
          tidsrundingMinutter={tidsrundingMinutter}
          onLukk={() => setSplittAktivFor(null)}
          onLagret={() => {
            // Modal har allerede invalidert hentForAttestering.
            // useEffect over plukker opp endrede pending-IDer og resetter
            // edit-state fra nye init-verdier.
            setSplittAktivFor(null);
          }}
        />
      )}
    </div>
  );
}

function OriginalKomprimering({
  timer,
  tillegg,
  maskin,
}: {
  timer: TimerRad[];
  tillegg: TilleggRad[];
  maskin: MaskinRad[];
}) {
  const { t } = useTranslation();
  if (timer.length + tillegg.length + maskin.length === 0) return null;

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm" open>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-600">
        {t("timer.rediger.original.tittel")} ({timer.length + tillegg.length + maskin.length}{" "}
        {t("timer.rediger.original.rader")})
      </summary>
      <div className="mt-2 space-y-1 text-xs text-gray-700">
        {timer.length > 0 && (
          <p>
            <strong>{t("timer.detalj.timerRader")}:</strong>{" "}
            {timer.map((r) => `${tilTall(r.timer).toFixed(2)}t`).join(" · ")}
          </p>
        )}
        {tillegg.length > 0 && (
          <p>
            <strong>{t("timer.detalj.tilleggRader")}:</strong> {tillegg.length}
          </p>
        )}
        {maskin.length > 0 && (
          <p>
            <strong>{t("timer.detalj.maskinRader")}:</strong>{" "}
            {maskin.map((r) => `${tilTall(r.timer).toFixed(2)}t`).join(" · ")}
          </p>
        )}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  T7-4d: ProsjektSectionEdit + EcoBucketEdit                          */
/*                                                                      */
/*  Speil av T7-4c-strukturen for edit-modus: per prosjekt → N ECO-     */
/*  buckets + per-prosjekt tillegg. Innen hver bucket: arbeidstimer +   */
/*  maskin indentert som underpost. "+Legg til timer/maskin"-knappene   */
/*  pre-selekterer (projectId, ECO) for ny rad.                         */
/* ------------------------------------------------------------------ */

type EditBucketRef = {
  projectId: string;
  ecoId: string | null;
  timer: RedigerTimerRadData[];
  maskin: RedigerMaskinRadData[];
};

type SplittAktivLokal =
  | { radType: "timer"; original: TimerRad }
  | { radType: "tillegg"; original: TilleggRad }
  | { radType: "maskin"; original: MaskinRad };

function ProsjektSectionEdit({
  projectId,
  prosjektNavn,
  ecoKeys,
  bucketMap,
  tillegg,
  prosjekter,
  tidsrundingMinutter,
  pendingTimer,
  pendingTillegg,
  pendingMaskin,
  oppdaterTimer,
  slettTimer,
  oppdaterTillegg,
  slettTillegg,
  oppdaterMaskin,
  slettMaskin,
  leggTilTimer,
  leggTilTillegg,
  leggTilMaskin,
  aapneSplitt,
}: {
  projectId: string;
  prosjektNavn: string;
  ecoKeys: string[];
  bucketMap: Map<string, EditBucketRef>;
  tillegg: RedigerTilleggRadData[];
  prosjekter: ProsjektValg[];
  tidsrundingMinutter: number | null;
  pendingTimer: TimerRad[];
  pendingTillegg: TilleggRad[];
  pendingMaskin: MaskinRad[];
  oppdaterTimer: (key: string, felt: Partial<RedigerTimerRadData>) => void;
  slettTimer: (key: string) => void;
  oppdaterTillegg: (key: string, felt: Partial<RedigerTilleggRadData>) => void;
  slettTillegg: (key: string) => void;
  oppdaterMaskin: (key: string, felt: Partial<RedigerMaskinRadData>) => void;
  slettMaskin: (key: string) => void;
  leggTilTimer: (pid: string, ecoId: string | null) => void;
  leggTilTillegg: () => void;
  leggTilMaskin: (pid: string, ecoId: string | null) => void;
  aapneSplitt: (aktiv: SplittAktivLokal) => void;
}) {
  const { t } = useTranslation();
  // Hent ECO-katalog én gang per prosjekt for navn på subheaders.
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId },
    { enabled: !!projectId },
  );
  const ecoNavnMap = new Map<string, { kortNavn: string; proAdmId: string }>(
    (ecoer ?? []).map((e) => [e.id, { kortNavn: e.kortNavn, proAdmId: e.proAdmId }]),
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        {prosjektNavn}
      </h3>
      <div className="space-y-3">
        {ecoKeys.map((ekv) => {
          const ecoId = ekv === "" ? null : ekv;
          const bucket = bucketMap.get(`${projectId}|${ekv}`) ?? {
            projectId,
            ecoId,
            timer: [],
            maskin: [],
          };
          return (
            <EcoBucketEdit
              key={ekv}
              projectId={projectId}
              ecoId={ecoId}
              ecoNavn={ecoId ? ecoNavnMap.get(ecoId) ?? null : null}
              timer={bucket.timer}
              maskin={bucket.maskin}
              prosjekter={prosjekter}
              tidsrundingMinutter={tidsrundingMinutter}
              pendingTimer={pendingTimer}
              pendingMaskin={pendingMaskin}
              oppdaterTimer={oppdaterTimer}
              slettTimer={slettTimer}
              oppdaterMaskin={oppdaterMaskin}
              slettMaskin={slettMaskin}
              leggTilTimer={leggTilTimer}
              leggTilMaskin={leggTilMaskin}
              aapneSplitt={aapneSplitt}
            />
          );
        })}
      </div>

      {/* Tillegg per-prosjekt (separat fra ECO-bukets) */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.detalj.tilleggRader")}
          </h4>
          <button
            type="button"
            onClick={leggTilTillegg}
            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" />
            {t("timer.rediger.leggTilTillegg")}
          </button>
        </div>
        <div className="space-y-2">
          {tillegg.length === 0 ? (
            <p className="text-xs italic text-gray-500">
              {t("timer.rediger.ingenTillegg")}
            </p>
          ) : (
            tillegg.map((rad) => {
              const original = rad.originalId
                ? pendingTillegg.find((r) => r.id === rad.originalId)
                : null;
              const kanSplittes =
                original && (original.parentRadId ?? null) === null;
              return (
                <RedigerTilleggRad
                  key={rad.key}
                  rad={rad}
                  prosjekter={prosjekter}
                  onChange={(felt) => oppdaterTillegg(rad.key, felt)}
                  onSlett={() => slettTillegg(rad.key)}
                  onSplitt={
                    kanSplittes && original
                      ? () => aapneSplitt({ radType: "tillegg", original })
                      : undefined
                  }
                />
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function EcoBucketEdit({
  projectId,
  ecoId,
  ecoNavn,
  timer,
  maskin,
  prosjekter,
  tidsrundingMinutter,
  pendingTimer,
  pendingMaskin,
  oppdaterTimer,
  slettTimer,
  oppdaterMaskin,
  slettMaskin,
  leggTilTimer,
  leggTilMaskin,
  aapneSplitt,
}: {
  projectId: string;
  ecoId: string | null;
  ecoNavn: { kortNavn: string; proAdmId: string } | null;
  timer: RedigerTimerRadData[];
  maskin: RedigerMaskinRadData[];
  prosjekter: ProsjektValg[];
  tidsrundingMinutter: number | null;
  pendingTimer: TimerRad[];
  pendingMaskin: MaskinRad[];
  oppdaterTimer: (key: string, felt: Partial<RedigerTimerRadData>) => void;
  slettTimer: (key: string) => void;
  oppdaterMaskin: (key: string, felt: Partial<RedigerMaskinRadData>) => void;
  slettMaskin: (key: string) => void;
  leggTilTimer: (pid: string, ecoId: string | null) => void;
  leggTilMaskin: (pid: string, ecoId: string | null) => void;
  aapneSplitt: (aktiv: SplittAktivLokal) => void;
}) {
  const { t } = useTranslation();
  const sumTimer = timer.reduce((acc, r) => acc + r.timer, 0);
  const sumMaskin = maskin.reduce((acc, r) => acc + r.timer, 0);
  const maskinOk = sumMaskin <= sumTimer + 0.001;

  return (
    <div
      className={`rounded border bg-gray-50 p-3 ${
        ecoId ? "border-indigo-200" : "border-gray-200"
      }`}
    >
      {/* ECO-subheader med indigo-badge — kun ekte ECO-er */}
      {ecoId && (
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <div className="text-xs font-semibold text-gray-800">
            {ecoNavn
              ? `${ecoNavn.proAdmId} · ${ecoNavn.kortNavn}`
              : t("timer.detalj.ukjentEco")}
          </div>
          <span
            className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
            title={t("timer.gruppe.tilByggherreHint")}
          >
            → {t("timer.gruppe.tilByggherre")}
          </span>
        </div>
      )}

      {/* Arbeidstimer (hovedpost) */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.gruppe.arbeidstimer")}{" "}
            <span className="font-mono font-normal text-gray-500">
              ({sumTimer.toFixed(2)} {t("timer.timerEnhet")})
            </span>
          </h5>
          <button
            type="button"
            onClick={() => leggTilTimer(projectId, ecoId)}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" />
            {t("timer.rediger.leggTilTimer")}
          </button>
        </div>
        {timer.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {t("timer.rediger.ingenTimer")}
          </p>
        ) : (
          <div className="space-y-2">
            {timer.map((rad) => {
              const original = rad.originalId
                ? pendingTimer.find((r) => r.id === rad.originalId)
                : null;
              const kanSplittes =
                original && (original.parentRadId ?? null) === null;
              return (
                <RedigerTimerRad
                  key={rad.key}
                  rad={rad}
                  prosjekter={prosjekter}
                  tidsrundingMinutter={tidsrundingMinutter}
                  onChange={(felt) => oppdaterTimer(rad.key, felt)}
                  onSlett={() => slettTimer(rad.key)}
                  onSplitt={
                    kanSplittes && original
                      ? () => aapneSplitt({ radType: "timer", original })
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Maskintimer som underpost (indentert) */}
      <div className="ml-3 border-l-2 border-gray-200 pl-3">
        <div className="mb-1 flex items-center justify-between">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t("timer.gruppe.maskintimer")}{" "}
            <span className="font-mono font-normal text-gray-500">
              ({sumMaskin.toFixed(2)} {t("timer.timerEnhet")})
            </span>
          </h5>
          <button
            type="button"
            onClick={() => leggTilMaskin(projectId, ecoId)}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" />
            {t("timer.rediger.leggTilMaskin")}
          </button>
        </div>
        {maskin.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {t("timer.rediger.ingenMaskin")}
          </p>
        ) : (
          <div className="space-y-2">
            {maskin.map((rad) => {
              const original = rad.originalId
                ? pendingMaskin.find((r) => r.id === rad.originalId)
                : null;
              const kanSplittes =
                original && (original.parentRadId ?? null) === null;
              return (
                <RedigerMaskinRad
                  key={rad.key}
                  rad={rad}
                  prosjekter={prosjekter}
                  tidsrundingMinutter={tidsrundingMinutter}
                  onChange={(felt) => oppdaterMaskin(rad.key, felt)}
                  onSlett={() => slettMaskin(rad.key)}
                  onSplitt={
                    kanSplittes && original
                      ? () => aapneSplitt({ radType: "maskin", original })
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Sum-indikator: grønn når maskin ≤ arbeid, rød ellers (speil av server-validering) */}
      {(sumTimer > 0 || sumMaskin > 0) && (
        <div
          className={`mt-3 rounded border px-3 py-1.5 text-xs font-medium ${
            maskinOk
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {t("timer.gruppe.maskinAvArbeid", {
            maskin: sumMaskin.toFixed(2),
            arbeid: sumTimer.toFixed(2),
          })}
        </div>
      )}
    </div>
  );
}
