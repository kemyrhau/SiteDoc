"use client";

// T7-5d (2026-05-17): Rad-nivå redigerings-modal — erstatter
// RedigerSeddelModal som monterte hele AttesteringDetalj fullside i modal.
//
// Arkitektur: modal viser KUN én prosjekt+ECO-bucket (sammenheng-gruppen
// for en timer-rad). Hele-sedel-redigering går til detaljsiden via lenke.
// I tråd med vedtatt sammenheng-prinsipp (fase-0 § T7-5).
//
// Lagring: bruker eksisterende `redigerSedelRader`-mutation (per-sedel).
// Modal henter alle pending-rader på sedelen og sender hele payloaden —
// uendrede bucker går gjennom uendret, kun den valgte bucken har edits.

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import { overstigerMaskinTak } from "@sitedoc/shared";
import { MaskinVelger } from "@/components/timer/MaskinVelger";

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

// Pause-modell (2026-05-17): hjelpere for overlap-deteksjon og minutt-aritmetikk.
function hhmmTilMinutter(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function pauseMinutter(
  pauseFra: string | null,
  pauseTil: string | null,
): number {
  if (!pauseFra || !pauseTil) return 0;
  return Math.max(0, hhmmTilMinutter(pauseTil) - hhmmTilMinutter(pauseFra));
}
function radOverlapperPause(
  fraTid: string | null,
  tilTid: string | null,
  pauseFra: string | null,
  pauseTil: string | null,
): boolean {
  if (!fraTid || !tilTid || !pauseFra || !pauseTil) return false;
  return tilTid > pauseFra && fraTid < pauseTil;
}
function beregnTimerMedPause(
  fraTid: string | null,
  tilTid: string | null,
  pauseFra: string | null,
  pauseTil: string | null,
): number | null {
  if (!fraTid || !tilTid) return null;
  const rattid = (hhmmTilMinutter(tilTid) - hhmmTilMinutter(fraTid)) / 60;
  if (rattid <= 0) return null;
  const fradrag = radOverlapperPause(fraTid, tilTid, pauseFra, pauseTil)
    ? pauseMinutter(pauseFra, pauseTil) / 60
    : 0;
  return Math.max(0, rattid - fradrag);
}

type Props = {
  sheetId: string;
  projectId: string;
  ecoId: string | null;
  onLukk: () => void;
};

type EditTimer = {
  key: string;
  originalId: string;
  lonnsartId: string;
  aktivitetId: string;
  fraTid: string | null;
  tilTid: string | null;
  timer: number;
};

type EditMaskin = {
  key: string;
  originalId: string;
  vehicleId: string;
  fraTid: string | null;
  tilTid: string | null;
  timer: number;
  mengde: number | null;
  enhet: string | null;
};

export function RedigerRadModal({ sheetId, projectId, ecoId, onLukk }: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: sheet, isLoading } =
    trpc.timer.dagsseddel.hentForAttestering.useQuery(
      { id: sheetId },
      { retry: false },
    );

  // Dropdowns + tidsrunding fra firma-setting.
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery();
  const equipment = equipmentRaw as unknown as
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
        internNummer: string | null;
        kategori: string | null;
      }>
    | undefined;
  const { data: ecoListe } = trpc.eksternKostObjekt.list.useQuery(
    { projectId },
    { enabled: !!projectId },
  );
  const { data: setting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: sheet?.organizationId ?? "" },
    { enabled: !!sheet?.organizationId },
  );
  const tidsrundingMinutter = setting?.tidsrundingMinutter ?? null;
  const timeStep = Math.min((tidsrundingMinutter ?? 15) * 60, 1800);
  // 2026-05-28: firma-default for pause-start (togglePause-fallback).
  const standardPauseFra = setting?.standardPauseFra ?? null;
  const standardPauseMin = setting?.standardPauseMin ?? 30;

  // Plukk pending-rader for denne bucken (projectId + ecoId).
  // Alle andre pending-rader sendes uendret i lagre-payloaden.
  const bucketPredikat = (r: { projectId: string; externalCostObjectId: string | null }) =>
    r.projectId === projectId && r.externalCostObjectId === ecoId;

  const pendingTimer = useMemo(
    () =>
      ((sheet?.timer ?? []) as Array<{
        id: string;
        projectId: string;
        externalCostObjectId: string | null;
        attestertStatus: string | null;
        lonnsartId: string;
        aktivitetId: string;
        fraTid: string | null;
        tilTid: string | null;
        timer: unknown;
      }>).filter((r) => r.attestertStatus === "pending"),
    [sheet?.timer],
  );
  const pendingMaskin = useMemo(
    () =>
      ((sheet?.maskiner ?? []) as Array<{
        id: string;
        projectId: string;
        externalCostObjectId: string | null;
        attestertStatus: string | null;
        vehicleId: string;
        fraTid: string | null;
        tilTid: string | null;
        timer: unknown;
        mengde: unknown;
        enhet: string | null;
      }>).filter((r) => r.attestertStatus === "pending"),
    [sheet?.maskiner],
  );
  const pendingTillegg = useMemo(
    () =>
      ((sheet?.tillegg ?? []) as Array<{
        id: string;
        projectId: string;
        attestertStatus: string | null;
        tilleggId: string;
        antall: unknown;
        kommentar: string | null;
      }>).filter((r) => r.attestertStatus === "pending"),
    [sheet?.tillegg],
  );

  // Initial edit-state — kun radene i den valgte bucken.
  const initTimer: EditTimer[] = useMemo(
    () =>
      pendingTimer.filter(bucketPredikat).map((r) => ({
        key: r.id,
        originalId: r.id,
        lonnsartId: r.lonnsartId,
        aktivitetId: r.aktivitetId,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        timer: tilTall(r.timer),
      })),
    // bucketPredikat avhenger av projectId/ecoId-props
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingTimer, projectId, ecoId],
  );
  const initMaskin: EditMaskin[] = useMemo(
    () =>
      pendingMaskin.filter(bucketPredikat).map((r) => ({
        key: r.id,
        originalId: r.id,
        vehicleId: r.vehicleId,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        timer: tilTall(r.timer),
        mengde:
          r.mengde === null || r.mengde === undefined ? null : tilTall(r.mengde),
        enhet: r.enhet,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingMaskin, projectId, ecoId],
  );

  const [editTimer, setEditTimer] = useState<EditTimer[]>(initTimer);
  const [editMaskin, setEditMaskin] = useState<EditMaskin[]>(initMaskin);
  // Pause-modell: sheet-level pauseFra/pauseTil. Initialiseres fra sheet
  // ved første load. Endring herfra reflekteres på alle overlappende rader.
  const [editPauseFra, setEditPauseFra] = useState<string | null>(
    sheet?.pauseFra ?? null,
  );
  const [editPauseTil, setEditPauseTil] = useState<string | null>(
    sheet?.pauseTil ?? null,
  );
  const [feil, setFeil] = useState<string | null>(null);

  // T7-5h: rader hvor lagret timer-verdi avviker fra (rattid − pauseMin/60)
  // antas å være manuelt justert (skjult lunsj-fradrag, halvtid o.l.).
  // Auto-recompute ved pause-toggle eller fra/til-endring hopper over disse
  // for å unngå at justeringen overskrives stille. ↻-knappen i raden lar
  // bruker eksplisitt oppgradere til default-beregningen.
  const [manueltJustert, setManueltJustert] = useState<Set<string>>(new Set());

  // Synkroniser ved første data-load. Senere endringer holdes lokalt.
  const [initialisert, setInitialisert] = useState(false);
  useEffect(() => {
    if (!initialisert && sheet) {
      const initialPauseFra = sheet.pauseFra ?? null;
      const initialPauseTil = sheet.pauseTil ?? null;
      // T7-5h: init-deteksjon av manuelt justerte rader.
      const justerte = new Set<string>();
      for (const r of initTimer) {
        const forventet = beregnTimerMedPause(
          r.fraTid,
          r.tilTid,
          initialPauseFra,
          initialPauseTil,
        );
        if (forventet !== null && Math.abs(r.timer - forventet) > 0.01) {
          justerte.add(r.key);
        }
      }
      setManueltJustert(justerte);
      setEditTimer(initTimer);
      setEditMaskin(initMaskin);
      setEditPauseFra(initialPauseFra);
      setEditPauseTil(initialPauseTil);
      setInitialisert(true);
    }
  }, [sheet, initialisert, initTimer, initMaskin]);

  const harEndringer = useMemo(() => {
    if (!initialisert) return false;
    const pauseEndret =
      editPauseFra !== (sheet?.pauseFra ?? null) ||
      editPauseTil !== (sheet?.pauseTil ?? null);
    return (
      pauseEndret ||
      JSON.stringify(editTimer) !== JSON.stringify(initTimer) ||
      JSON.stringify(editMaskin) !== JSON.stringify(initMaskin)
    );
  }, [
    editTimer,
    editMaskin,
    editPauseFra,
    editPauseTil,
    initTimer,
    initMaskin,
    initialisert,
    sheet?.pauseFra,
    sheet?.pauseTil,
  ]);

  // Pause-endring: oppdater state + recompute timer for alle overlappende rader.
  // T7-5h: rader merket som manuelt justert beholdes som de er.
  function settPause(fra: string | null, til: string | null) {
    setEditPauseFra(fra);
    setEditPauseTil(til);
    setEditTimer((rader) =>
      rader.map((r) => {
        if (manueltJustert.has(r.key)) return r;
        const nyTimer = beregnTimerMedPause(r.fraTid, r.tilTid, fra, til);
        return nyTimer !== null ? { ...r, timer: nyTimer } : r;
      }),
    );
  }

  const lagre = trpc.timer.dagsseddel.redigerSedelRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: sheetId });
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleLagre() {
    setFeil(null);
    // Valider edit-rader i denne bucken
    for (const r of editTimer) {
      if (!r.lonnsartId || !r.aktivitetId || r.timer <= 0) {
        setFeil(t("timer.rediger.feil.timerInkomplett"));
        return;
      }
    }
    for (const r of editMaskin) {
      if (!r.vehicleId || r.timer <= 0) {
        setFeil(t("timer.rediger.feil.maskinInkomplett"));
        return;
      }
    }

    // Bygg full payload: andre bukers pending-rader uendret + edit-rader for vår bucket.
    // Tillegg er per-prosjekt (ingen ECO) — alltid uendret her.
    const andreTimer = pendingTimer.filter((r) => !bucketPredikat(r));
    const andreMaskin = pendingMaskin.filter((r) => !bucketPredikat(r));

    lagre.mutate({
      sheetId,
      pauseFra: editPauseFra,
      pauseTil: editPauseTil,
      nyeRader: {
        timer: [
          ...andreTimer.map((r) => ({
            originalId: r.id,
            projectId: r.projectId,
            lonnsartId: r.lonnsartId,
            aktivitetId: r.aktivitetId,
            externalCostObjectId: r.externalCostObjectId,
            byggeplassId: null,
            fraTid: r.fraTid,
            tilTid: r.tilTid,
            timer: tilTall(r.timer),
          })),
          ...editTimer.map((r) => ({
            originalId: r.originalId,
            projectId,
            lonnsartId: r.lonnsartId,
            aktivitetId: r.aktivitetId,
            externalCostObjectId: ecoId,
            byggeplassId: null,
            fraTid: r.fraTid,
            tilTid: r.tilTid,
            timer: r.timer,
          })),
        ],
        tillegg: pendingTillegg.map((r) => ({
          originalId: r.id,
          projectId: r.projectId,
          tilleggId: r.tilleggId,
          antall: tilTall(r.antall),
          kommentar: r.kommentar,
        })),
        maskin: [
          ...andreMaskin.map((r) => ({
            originalId: r.id,
            projectId: r.projectId,
            externalCostObjectId: r.externalCostObjectId,
            vehicleId: r.vehicleId,
            byggeplassId: null,
            fraTid: r.fraTid,
            tilTid: r.tilTid,
            timer: tilTall(r.timer),
            mengde:
              r.mengde === null || r.mengde === undefined
                ? null
                : tilTall(r.mengde),
            enhet: r.enhet,
          })),
          ...editMaskin.map((r) => ({
            originalId: r.originalId,
            projectId,
            externalCostObjectId: ecoId,
            vehicleId: r.vehicleId,
            byggeplassId: null,
            fraTid: r.fraTid,
            tilTid: r.tilTid,
            timer: r.timer,
            mengde: r.mengde,
            enhet: r.enhet,
          })),
        ],
      },
    });
  }

  // Navn-oppslag for header.
  const ecoNavn = useMemo(() => {
    if (!ecoId) return null;
    const eco = ecoListe?.find((e) => e.id === ecoId);
    return eco ? `${eco.proAdmId} · ${eco.kortNavn}` : null;
  }, [ecoListe, ecoId]);
  const prosjektNavn = sheet?.prosjekt?.name ?? "—";

  return (
    <Modal
      open
      onClose={onLukk}
      title={t("timer.rediger.radModal.tittel")}
      className="max-h-[90vh] max-w-4xl overflow-hidden"
      lukkVedBackdropKlikk
    >
      <div className="-m-2 max-h-[calc(90vh-7rem)] overflow-y-auto">
        {isLoading || !sheet ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Sticky bucket-header med Lagre */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
              <div className="min-w-0 text-sm">
                <span className="font-semibold text-gray-900">
                  {prosjektNavn}
                </span>
                {ecoNavn && (
                  <span className="ml-2 text-gray-500">· {ecoNavn}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onLukk}
                  disabled={lagre.isPending}
                >
                  {t("handling.avbryt")}
                </Button>
                {/* T7-5f: grønn farge når harEndringer for å signalere at
                    klikk vil lagre. Samme mønster som AttesteringDetalj_Edit. */}
                <Button
                  size="sm"
                  onClick={handleLagre}
                  disabled={lagre.isPending || !harEndringer}
                  className={
                    harEndringer
                      ? "!bg-green-600 hover:!bg-green-700 focus:!ring-green-500"
                      : ""
                  }
                >
                  {lagre.isPending
                    ? t("handling.lagrer")
                    : t("timer.rediger.lagre")}
                </Button>
              </div>
            </div>

            <div className="space-y-5 px-4 py-4">
              {/* Arbeidstimer */}
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  {t("timer.gruppe.arbeidstimer")}
                </h4>
                {editTimer.length === 0 ? (
                  <p className="text-xs italic text-gray-500">
                    {t("timer.rediger.ingenTimer")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {editTimer.map((rad) => (
                      <KompaktTimerRad
                        key={rad.key}
                        rad={rad}
                        lonnsarter={lonnsarter}
                        aktiviteter={aktiviteter}
                        timeStep={timeStep}
                        tidsrundingMinutter={tidsrundingMinutter}
                        pauseFra={editPauseFra}
                        pauseTil={editPauseTil}
                        standardPauseFra={standardPauseFra}
                        standardPauseMin={standardPauseMin}
                        onPauseChange={settPause}
                        erManueltJustert={manueltJustert.has(rad.key)}
                        onChange={(felt) => {
                          setEditTimer((rader) =>
                            rader.map((r) => {
                              if (r.key !== rad.key) return r;
                              const nyRad = { ...r, ...felt };
                              // T7-5h: hopp over auto-recompute hvis raden er manuelt justert.
                              if (
                                (felt.fraTid !== undefined ||
                                  felt.tilTid !== undefined) &&
                                !manueltJustert.has(r.key)
                              ) {
                                const nyTimer = beregnTimerMedPause(
                                  nyRad.fraTid,
                                  nyRad.tilTid,
                                  editPauseFra,
                                  editPauseTil,
                                );
                                if (nyTimer !== null) nyRad.timer = nyTimer;
                              }
                              return nyRad;
                            }),
                          );
                          // T7-5h: direkte redigering av timer-feltet markerer raden som manuelt justert.
                          if (felt.timer !== undefined) {
                            setManueltJustert((prev) => {
                              const ny = new Set(prev);
                              ny.add(rad.key);
                              return ny;
                            });
                          }
                        }}
                        onRecompute={() => {
                          const nyTimer = beregnTimerMedPause(
                            rad.fraTid,
                            rad.tilTid,
                            editPauseFra,
                            editPauseTil,
                          );
                          if (nyTimer === null) return;
                          setEditTimer((rader) =>
                            rader.map((r) =>
                              r.key === rad.key ? { ...r, timer: nyTimer } : r,
                            ),
                          );
                          setManueltJustert((prev) => {
                            const ny = new Set(prev);
                            ny.delete(rad.key);
                            return ny;
                          });
                        }}
                        onSlett={() => {
                          setEditTimer((rader) =>
                            rader.filter((r) => r.key !== rad.key),
                          );
                          setManueltJustert((prev) => {
                            const ny = new Set(prev);
                            ny.delete(rad.key);
                            return ny;
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Maskintimer */}
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {t("timer.gruppe.maskintimer")}
                </h4>
                {editMaskin.length === 0 ? (
                  <p className="text-xs italic text-gray-500">
                    {t("timer.rediger.ingenMaskin")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {(() => {
                      const sumArbeid = editTimer.reduce(
                        (a, r) => a + r.timer,
                        0,
                      );
                      const pauseMin = pauseMinutter(editPauseFra, editPauseTil);
                      return editMaskin.map((rad) => (
                        <KompaktMaskinRad
                          key={rad.key}
                          rad={rad}
                          equipment={equipment}
                          timeStep={timeStep}
                          tidsrundingMinutter={tidsrundingMinutter}
                          // Delt regel (@sitedoc/shared) — per-rad-advarsel, samme
                          // epsilon + pause-modell som server. Ikke-blokkerende her.
                          overstigerArbeid={overstigerMaskinTak(
                            rad.timer,
                            sumArbeid,
                            pauseMin,
                          )}
                          pauseMin={pauseMin}
                          onChange={(felt) =>
                            setEditMaskin((rader) =>
                              rader.map((r) =>
                                r.key === rad.key ? { ...r, ...felt } : r,
                              ),
                            )
                          }
                          onSlett={() =>
                            setEditMaskin((rader) =>
                              rader.filter((r) => r.key !== rad.key),
                            )
                          }
                        />
                      ));
                    })()}
                  </div>
                )}
              </section>

              {feil && <p className="text-sm text-red-600">{feil}</p>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  KompaktTimerRad — én linje                                          */
/* ------------------------------------------------------------------ */

function KompaktTimerRad({
  rad,
  lonnsarter,
  aktiviteter,
  timeStep,
  tidsrundingMinutter,
  pauseFra,
  pauseTil,
  standardPauseFra,
  standardPauseMin,
  onPauseChange,
  erManueltJustert,
  onChange,
  onRecompute,
  onSlett,
}: {
  rad: EditTimer;
  lonnsarter: Array<{ id: string; navn: string }> | undefined;
  aktiviteter: Array<{ id: string; navn: string }> | undefined;
  timeStep: number;
  tidsrundingMinutter: number | null;
  pauseFra: string | null;
  pauseTil: string | null;
  standardPauseFra: string | null;
  standardPauseMin: number;
  onPauseChange: (fra: string | null, til: string | null) => void;
  erManueltJustert: boolean;
  onChange: (felt: Partial<EditTimer>) => void;
  onRecompute: () => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  const [timerStr, setTimerStr] = useState(String(rad.timer));
  useEffect(() => {
    setTimerStr(String(rad.timer));
  }, [rad.timer]);

  const harPause = radOverlapperPause(rad.fraTid, rad.tilTid, pauseFra, pauseTil);

  // T7-5h: når raden er manuelt justert, sammenlign default-beregningen mot
  // lagret verdi. Vis ↻-knapp kun hvis verdiene avviker — ellers er
  // recompute en no-op for brukeren.
  const forventetTimer = erManueltJustert
    ? beregnTimerMedPause(rad.fraTid, rad.tilTid, pauseFra, pauseTil)
    : null;
  const visRecompute =
    erManueltJustert &&
    forventetTimer !== null &&
    Math.abs(forventetTimer - rad.timer) > 0.01;

  // Toggle:
  //   - har pause: klikk fjerner den
  //   - ingen pause + firma-default satt + default ligger innenfor rad-intervallet:
  //       bruk firma-default (standardPauseFra + standardPauseMin)
  //   - ellers: midtpunkt-fallback (default 30 min sentrert i rad-vinduet)
  function togglePause() {
    if (harPause) {
      onPauseChange(null, null);
      return;
    }
    if (!rad.fraTid || !rad.tilTid) return;

    const fraMin = hhmmTilMinutter(rad.fraTid);
    const tilMin = hhmmTilMinutter(rad.tilTid);
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

    // Forsøk firma-default først
    if (standardPauseFra) {
      const defaultFraMin = hhmmTilMinutter(standardPauseFra);
      const defaultTilMin = defaultFraMin + standardPauseMin;
      if (defaultFraMin >= fraMin && defaultTilMin <= tilMin) {
        onPauseChange(standardPauseFra, fmt(defaultTilMin));
        return;
      }
    }

    // Fallback: midtpunkt med 30 min vindu
    const midt = Math.floor((fraMin + tilMin) / 2);
    onPauseChange(fmt(midt - 15), fmt(midt + 15));
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[80px_80px_1fr_1fr_80px_auto_auto] items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs">
        <input
          type="time"
          value={rad.fraTid ?? ""}
          step={timeStep}
          onChange={(e) => onChange({ fraTid: e.target.value || null })}
          onBlur={(e) => {
            if (tidsrundingMinutter && e.target.value) {
              const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
              if (rundet !== e.target.value) onChange({ fraTid: rundet });
            }
          }}
          className="rounded border border-gray-300 px-1.5 py-1"
          placeholder="HH:MM"
        />
        <input
          type="time"
          value={rad.tilTid ?? ""}
          step={timeStep}
          onChange={(e) => onChange({ tilTid: e.target.value || null })}
          onBlur={(e) => {
            if (tidsrundingMinutter && e.target.value) {
              const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
              if (rundet !== e.target.value) onChange({ tilTid: rundet });
            }
          }}
          className="rounded border border-gray-300 px-1.5 py-1"
          placeholder="HH:MM"
        />
        <select
          value={rad.lonnsartId}
          onChange={(e) => onChange({ lonnsartId: e.target.value })}
          className="rounded border border-gray-300 px-1.5 py-1"
        >
          <option value="">{t("timer.rediger.lonnsartPlaceholder")}</option>
          {lonnsarter?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.navn}
            </option>
          ))}
        </select>
        <select
          value={rad.aktivitetId}
          onChange={(e) => onChange({ aktivitetId: e.target.value })}
          className="rounded border border-gray-300 px-1.5 py-1"
        >
          <option value="">{t("timer.rediger.aktivitetPlaceholder")}</option>
          {aktiviteter?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.navn}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.25"
          min="0"
          value={timerStr}
          onChange={(e) => setTimerStr(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(timerStr);
            if (!isNaN(parsed) && parsed >= 0) {
              if (parsed !== rad.timer) onChange({ timer: parsed });
            } else {
              setTimerStr(String(rad.timer));
            }
          }}
          className="rounded border border-gray-300 px-1.5 py-1 text-right font-mono"
        />
        {/* Pause-toggle: synlig kun når rad har fra/til (ellers ingen mening) */}
        <label
          className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[11px] ${
            harPause
              ? "bg-blue-50 text-blue-700"
              : "text-gray-500 hover:bg-gray-100"
          } ${!rad.fraTid || !rad.tilTid ? "pointer-events-none opacity-40" : ""}`}
          title={t("timer.rediger.pause.toggleHint")}
        >
          <input
            type="checkbox"
            checked={harPause}
            onChange={togglePause}
            className="h-3 w-3"
            disabled={!rad.fraTid || !rad.tilTid}
          />
          {t("timer.rediger.pause.label")}
        </label>
        <button
          type="button"
          onClick={onSlett}
          className="rounded p-1 text-red-600 hover:bg-red-50"
          title={t("timer.rediger.slettRad")}
          aria-label={t("timer.rediger.slettRad")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Mini-pause-inputs vises kun når pause er aktiv for denne raden */}
      {harPause && pauseFra && pauseTil && (
        <div className="ml-4 flex items-center gap-2 text-[11px] text-gray-600">
          <span>{t("timer.rediger.pause.intervall")}</span>
          <input
            type="time"
            value={pauseFra}
            step={timeStep}
            onChange={(e) => onPauseChange(e.target.value || null, pauseTil)}
            onBlur={(e) => {
              if (tidsrundingMinutter && e.target.value) {
                const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
                if (rundet !== e.target.value) onPauseChange(rundet, pauseTil);
              }
            }}
            className="w-[80px] rounded border border-gray-300 px-1.5 py-0.5"
          />
          <span>–</span>
          <input
            type="time"
            value={pauseTil}
            step={timeStep}
            onChange={(e) => onPauseChange(pauseFra, e.target.value || null)}
            onBlur={(e) => {
              if (tidsrundingMinutter && e.target.value) {
                const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
                if (rundet !== e.target.value) onPauseChange(pauseFra, rundet);
              }
            }}
            className="w-[80px] rounded border border-gray-300 px-1.5 py-0.5"
          />
          <span className="font-mono text-gray-500">
            ({pauseMinutter(pauseFra, pauseTil)} min)
          </span>
        </div>
      )}
      {/* T7-5h: manuell justering oppdaget — tilby ikke-destruktiv recompute. */}
      {visRecompute && forventetTimer !== null && (
        <div className="ml-4 flex items-center gap-2 text-[11px] text-amber-700">
          <span>{t("timer.rediger.manuellJustering")}</span>
          <button
            type="button"
            onClick={onRecompute}
            className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 hover:bg-amber-100"
            title={t("timer.rediger.brukDefaultHint", {
              timer: forventetTimer.toFixed(2),
            })}
          >
            ↻ {t("timer.rediger.brukDefault", { timer: forventetTimer.toFixed(2) })}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KompaktMaskinRad — én linje                                         */
/* ------------------------------------------------------------------ */

function KompaktMaskinRad({
  rad,
  equipment,
  timeStep,
  tidsrundingMinutter,
  overstigerArbeid,
  pauseMin,
  onChange,
  onSlett,
}: {
  rad: EditMaskin;
  equipment:
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
        internNummer: string | null;
        kategori: string | null;
      }>
    | undefined;
  timeStep: number;
  tidsrundingMinutter: number | null;
  overstigerArbeid: boolean;
  pauseMin: number;
  onChange: (felt: Partial<EditMaskin>) => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  const [timerStr, setTimerStr] = useState(String(rad.timer));
  useEffect(() => {
    setTimerStr(String(rad.timer));
  }, [rad.timer]);

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[80px_80px_1fr_80px_auto] items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs">
        <input
          type="time"
          value={rad.fraTid ?? ""}
          step={timeStep}
          onChange={(e) => onChange({ fraTid: e.target.value || null })}
          onBlur={(e) => {
            if (tidsrundingMinutter && e.target.value) {
              const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
              if (rundet !== e.target.value) onChange({ fraTid: rundet });
            }
          }}
          className="rounded border border-gray-300 px-1.5 py-1"
          placeholder="HH:MM"
        />
        <input
          type="time"
          value={rad.tilTid ?? ""}
          step={timeStep}
          onChange={(e) => onChange({ tilTid: e.target.value || null })}
          onBlur={(e) => {
            if (tidsrundingMinutter && e.target.value) {
              const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
              if (rundet !== e.target.value) onChange({ tilTid: rundet });
            }
          }}
          className="rounded border border-gray-300 px-1.5 py-1"
          placeholder="HH:MM"
        />
        <MaskinVelger
          utstyr={equipment ?? []}
          valgtId={rad.vehicleId}
          onVelg={(id) => onChange({ vehicleId: id })}
        />
        <input
          type="number"
          step="0.25"
          min="0"
          value={timerStr}
          onChange={(e) => setTimerStr(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(timerStr);
            if (!isNaN(parsed) && parsed >= 0) {
              if (parsed !== rad.timer) onChange({ timer: parsed });
            } else {
              setTimerStr(String(rad.timer));
            }
          }}
          className="rounded border border-gray-300 px-1.5 py-1 text-right font-mono"
        />
        <button
          type="button"
          onClick={onSlett}
          className="rounded p-1 text-red-600 hover:bg-red-50"
          title={t("timer.rediger.slettRad")}
          aria-label={t("timer.rediger.slettRad")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Info-rad: maskin > arbeid antyder mannsbetjent maskin + pause-fradrag.
          Ingen automatisk korreksjon (krever kreverForer-flagg, egen PR). */}
      {overstigerArbeid && (
        <div className="ml-2 text-[11px] text-amber-700">
          {pauseMin > 0
            ? t("timer.rediger.maskinOverstigerMedPause", { pauseMin })
            : t("timer.rediger.maskinOverstiger")}
        </div>
      )}
    </div>
  );
}
