"use client";

// T7-2b1 (2026-05-14): Felleskomponent for attestering-detalj.
// Monteres fra to wrapper-sider:
//   - /dashbord/[prosjektId]/timer/attestering/[id] (prosjektleder-kontekst)
//   - /dashbord/firma/timer/attestering/[id]        (firma-admin-kontekst)
// Per-rad-attestering: hver rad har egen status, leder velger hvilke som
// attesteres/returneres via checkboxer.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { ArrowLeft, Pencil, RotateCcw, AlertTriangle } from "lucide-react";
import { avvikRetning, type ForsonRad } from "@sitedoc/shared";
import { StatusBadge } from "@/components/timer/StatusBadge";
import { ForslagValgSeksjon } from "@/components/timer/ForslagValgSeksjon";
import { AttesteringDetaljEdit } from "@/components/timer/AttesteringDetalj_Edit";
import { normtakBruddLinje } from "@/lib/normtakBrudd";
import {
  type MaskinRad,
  type TilleggRad,
  type TimerRad,
  radIKontekst,
} from "@/components/attestering/attestering-buckets";
import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import { useAttesteringModell } from "@/components/attestering/useAttesteringModell";
import type { AttSedel } from "@/components/attestering/attestering-tabell";

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function isoTidspunktTilHHMM(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type Props = {
  sheetId: string;
  // undefined = firma-kontekst (firma-admin attesterer alle rader leder har tilgang til)
  // gitt    = prosjekt-kontekst (kun rader for det prosjektet er aktivt valgbare)
  prosjektKontekst?: string;
  // Hvor «Tilbake» og redirect etter mutasjon peker
  tilbakeUrl: string;
};

export function AttesteringDetalj({
  sheetId,
  prosjektKontekst,
  tilbakeUrl,
}: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [returnerVises, setReturnerVises] = useState(false);
  const [gjenaapneVises, setGjenaapneVises] = useState(false);
  const [redigerModus, setRedigerModus] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [valgteTimer, setValgteTimer] = useState<Set<string>>(new Set());
  const [valgteTillegg, setValgteTillegg] = useState<Set<string>>(new Set());
  const [valgteMaskin, setValgteMaskin] = useState<Set<string>>(new Set());

  const { data: sheet, isLoading } =
    trpc.timer.dagsseddel.hentForAttestering.useQuery(
      { id: sheetId },
      { retry: false },
    );

  // Brukes til å vise diskret hint kun for firma-admins når flagget er av.
  const { data: kanFirmaAttestere } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: sheet?.organizationId ?? "" },
      { enabled: !!sheet?.organizationId },
    );

  // F4-2 (2026-07-11): leder angrer en fullført attestering. Setter sedelen
  // tilbake til "sent" (leder-køen) og alle rader til "pending".
  const gjenaapneAttestering =
    trpc.timer.dagsseddel.gjenaapneAttestering.useMutation({
      onSuccess: () => {
        void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: sheetId });
        void utils.timer.dagsseddel.hentTilAttestering.invalidate();
        void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
        setGjenaapneVises(false);
        router.push(tilbakeUrl);
      },
      onError: (e: { message: string }) => {
        setGjenaapneVises(false);
        setFeil(e.message);
      },
    });

  const timerRader = (sheet?.timer ?? []) as unknown as TimerRad[];
  const tilleggRader = (sheet?.tillegg ?? []) as unknown as TilleggRad[];
  const maskinRader = (sheet?.maskiner ?? []) as unknown as MaskinRad[];

  // Kort-id-spec § 11.4 (F1): serveren sier om fravær uten prosjekt kan attesteres her.
  const fravaerKanAttesteres = sheet?.fravaerKanAttesteres === true;
  const radTilgjengelig = (rad: { projectId: string | null; attestertStatus: string | null }) => {
    if (rad.attestertStatus !== "pending") return false;
    return radIKontekst(rad.projectId, prosjektKontekst, fravaerKanAttesteres);
  };

  // «Returner dagen» i tabellen: alle pending-rader lederen har tilgang til
  useEffect(() => {
    if (!sheet) return;
    setValgteTimer(new Set(timerRader.filter(radTilgjengelig).map((r) => r.id)));
    setValgteTillegg(new Set(tilleggRader.filter(radTilgjengelig).map((r) => r.id)));
    setValgteMaskin(new Set(maskinRader.filter(radTilgjengelig).map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className={`max-w-3xl p-6`}>
        <p className="text-sm text-red-600">{t("timer.detalj.ikkeFunnet")}</p>
        <Link
          href={tilbakeUrl}
          className="mt-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("timer.attestering.tilbake")}
        </Link>
      </div>
    );
  }

  // T7-4d: totaltimer er nå per-bucket — beregnes inne i EcoBucketAttest.
  const totaltAntallRader = timerRader.length + tilleggRader.length + maskinRader.length;
  const antallAttestert = [...timerRader, ...tilleggRader, ...maskinRader]
    .filter((r) => r.attestertStatus === "attestert").length;
  const antallReturnert = [...timerRader, ...tilleggRader, ...maskinRader]
    .filter((r) => r.attestertStatus === "returnert").length;
  const antallPending = totaltAntallRader - antallAttestert - antallReturnert;


  // V19-C (C-2): en uavklart overlapp blokkerer attestering — tabellen sperrer ✓ på
  // sedelens linjer (modellens `forslagSperre`); retur er utveien.
  const konfliktVentendeSiden =
    (sheet as { konfliktVentendeSiden?: string | Date | null }).konfliktVentendeSiden ??
    null;
  // B10 (F9 = A): bruddlinja fra hentForAttestering — null = intet brudd.
  const normtakLinje = normtakBruddLinje(t, sheet.fravaerNormtakBrudd, i18n.language);
  // Forslaget attestanten LESER (ikke velger). hentForAttestering er ett av KUN to
  // steder forslaget leses (M15) — aldri en lønnsleser.
  const forslagRader = (
    (sheet as { forslag?: unknown[] }).forslag ?? []
  ).map((r) => {
    const f = r as Record<string, unknown>;
    return {
      id: f.id as string,
      projectId: f.projectId as string,
      byggeplassId: (f.byggeplassId as string | null) ?? null,
      lonnsartId: f.lonnsartId as string,
      aktivitetId: f.aktivitetId as string,
      timer: Number(f.timer),
      fraTid: (f.fraTid as string | null) ?? null,
      tilTid: (f.tilTid as string | null) ?? null,
      beskrivelse: (f.beskrivelse as string | null) ?? null,
      externalCostObjectId: (f.externalCostObjectId as string | null) ?? null,
      vehicleId: (f.vehicleId as string | null) ?? null,
      // V19.9 (C'-2): grunn styrer attestantens lese-visning av slot-typene.
      grunn: (f.grunn as ForsonRad["grunn"]) ?? null,
    } satisfies ForsonRad;
  });
  const sedelForsonRader: ForsonRad[] = timerRader.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    byggeplassId: (r as { byggeplassId?: string | null }).byggeplassId ?? null,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    timer: Number(r.timer),
    fraTid: r.fraTid ?? null,
    tilTid: r.tilTid ?? null,
    beskrivelse: (r as { beskrivelse?: string | null }).beskrivelse ?? null,
    externalCostObjectId:
      (r as { externalCostObjectId?: string | null }).externalCostObjectId ?? null,
    vehicleId: (r as { vehicleId?: string | null }).vehicleId ?? null,
  }));

  // LAG 2 D1 (V1): reise er aldri arbeidstid. Splitt dagens timer i arbeid/reise
  // fra radenes `erReise` (nå i typen). «(inkl. reise)» erstattes av en ærlig
  // arbeid/reise-linje. Trigger-terskelen på arbeidstidVarselet er BEVISST uendret
  // (total tilstedeværelse = «lang dag»-signalet) — kun presentasjonen deles opp.
  const reisetimer = timerRader.reduce(
    (s, r) => s + (r.erReise === true ? Number(r.timer) : 0),
    0,
  );
  const arbeidstimer = timerRader.reduce(
    (s, r) => s + (r.erReise === true ? 0 : Number(r.timer)),
    0,
  );
  // normStatus-banner: "cachet"/"ukjent" varsles. null = gammel sedel (feltet fantes
  // ikke før lag 2) → intet banner (ingen falsk alarm på historiske sedler).
  const normStatus = sheet.normStatus;

  // w10a (A5, K11): full bredde — i `max-w-6xl` ble tabellens kolonner og tekst kuttet.
  return (
    <div className="p-6">
      <Link
        href={tilbakeUrl}
        className="mb-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("timer.attestering.tilbake")}
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {formatDato(sheet.dato)}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {sheet.prosjekt?.name ??
              (timerRader.length > 0 && timerRader.every((r) => r.projectId === null)
                ? t("timer.detalj.fravaerUtenProsjekt")
                : t("timer.detalj.ukjentProsjekt"))}
            {sheet.prosjekt?.internalProjectNumber
              ? ` (${sheet.prosjekt.internalProjectNumber})`
              : ""}
          </p>
          {sheet.ansatt && (
            <p className="mt-0.5 text-sm text-gray-600">
              {t("timer.attestering.kol.ansatt")}:{" "}
              <span className="font-medium text-gray-900">
                {sheet.ansatt.name ?? sheet.ansatt.email}
              </span>
              {sheet.ansatt.ansattnummer && (
                <span className="ml-1 text-xs text-gray-500">
                  #{sheet.ansatt.ansattnummer}
                </span>
              )}
            </p>
          )}
        </div>
        <StatusBadge status={sheet.status} />
      </div>

      {redigerModus ? (
        <AttesteringDetaljEdit
          sheetId={sheet.id}
          organizationId={sheet.organizationId}
          timerRader={timerRader}
          tilleggRader={tilleggRader}
          maskinRader={maskinRader}
          onAvbryt={() => setRedigerModus(false)}
          onLagret={() => setRedigerModus(false)}
        />
      ) : (
      <>
      {/* LAG 2 D1: norm-status fra sedelen (B6.3) — attestanten ser om overtiden
          ble fordelt mot en frisk norm. "cachet"/"ukjent" varsles; "server"/null
          (gammel sedel) gir intet banner. */}
      {(normStatus === "cachet" || normStatus === "ukjent") && (
        <div className="mb-4 flex">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            {normStatus === "cachet"
              ? t("timer.attestering.norm.cachet")
              : t("timer.attestering.norm.ukjent")}
          </span>
        </div>
      )}

      {/* LAG 2 D1 (V1): arbeid/reise-splitt — erstatter «(inkl. reise)». Vises kun
          når det faktisk finnes reisetimer på sedelen. */}
      {reisetimer > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          {t("timer.attestering.arbeidReiseSplit", {
            arbeid: arbeidstimer.toFixed(2),
            reise: reisetimer.toFixed(2),
          })}
        </div>
      )}

      {/* V19-C (C-2): mobilen overlappet PC-dagskortet → attestanten SER begge
          versjonene lesbart (ingen radio), og attester-knappen er blokkert til
          arbeideren har valgt. Utveien er retur. */}
      {forslagRader.length > 0 && (
        <ForslagValgSeksjon
          sedelRader={sedelForsonRader}
          forslag={forslagRader}
          modus="lesevisning"
          venterSiden={konfliktVentendeSiden}
        />
      )}

      {/* Slice 4b-2: kontroll-badges. (1) system-bestemt slutt-tid (ikke
          arbeider-bekreftet). (2) total tilstedeværelse (arbeid + reise) over
          firmaets terskel — «lang dag»-signal, derfor talt totalt. Begge er
          VARSEL, ikke blokkering. */}
      {(sheet.sluttTidKilde === "system" ||
        timerRader.reduce((s, r) => s + Number(r.timer), 0) >
          sheet.arbeidstidVarselTimer) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {sheet.sluttTidKilde === "system" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("timer.attestering.systemSluttBadge")}
            </span>
          )}
          {timerRader.reduce((s, r) => s + Number(r.timer), 0) >
            sheet.arbeidstidVarselTimer && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("timer.attestering.arbeidstidVarsel", {
                timer: timerRader
                  .reduce((s, r) => s + Number(r.timer), 0)
                  .toFixed(2),
                terskel: sheet.arbeidstidVarselTimer,
              })}
            </span>
          )}
        </div>
      )}
      {/* T.11: leder-synlighet — maskinarbeid uten gyldig maskinførerbevis.
          Informativt, ikke blokkerende. */}
      {maskinRader.length > 0 && sheet.manglerMaskinforerbevis && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("timer.maskinforerbevis.leder")}
          </span>
        </div>
      )}
      {/* Container-status-banner (T7-2b1): viser fremdrift på tvers av rader */}
      {totaltAntallRader > 0 && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            antallPending === 0
              ? "border-green-200 bg-green-50 text-green-900"
              : antallAttestert > 0 || antallReturnert > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          {antallPending === 0
            ? t("timer.attestering.container.alleBehandlet", {
                attestert: antallAttestert,
                returnert: antallReturnert,
              })
            : antallAttestert > 0 || antallReturnert > 0
              ? t("timer.attestering.container.delvis", {
                  attestert: antallAttestert,
                  returnert: antallReturnert,
                  total: totaltAntallRader,
                  pending: antallPending,
                })
              : t("timer.attestering.container.pending", {
                  total: totaltAntallRader,
                })}
        </div>
      )}

      {/* B10 (§ 11.10.4, F9 = A): fravær med tak over dagsnormen — der overtidsvarselet
          står. Attestering er sperret til bruddet er rettet; retur virker. */}
      {normtakLinje && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{normtakLinje}</p>
              <p className="mt-0.5 text-xs text-amber-800">{t("timer.normtak.attesterSperret")}</p>
            </div>
          </div>
        </div>
      )}

      {/* D2-attestantvarsel (ORDRE 2 STEG 3 ledd 2): banner når ukens beregnede
          overtid avviker fra det som er ført. Kun varsel — blokkerer ikke
          attestering. Tallene: uattestert = live, attestert = frosset snapshot. */}
      {(() => {
        const g = sheet.ukeOvertidsgrunnlag;
        if (!g) return null;
        const retning = avvikRetning(g);
        if (!retning) return null;
        return (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {retning === "over"
                    ? t("timer.attestering.varsel.over", {
                        timer: (g.beregnetOvertid - g.sumOvertid).toFixed(1),
                      })
                    : t("timer.attestering.varsel.under")}
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  {t("timer.attestering.varsel.tall", {
                    norm: g.norm.toFixed(1),
                    ord: g.sumOrdinaert.toFixed(1),
                    ot: g.sumOvertid.toFixed(1),
                  })}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Diskret hint til firma-admin når rediger-flagget er av */}
      {sheet.redigerTillatt === false && kanFirmaAttestere?.kanAttestere && (
        <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
          💡 {t("timer.attestering.redigerHint.tekst")}{" "}
          <Link
            href="/dashbord/firma/innstillinger#rediger-ved-attestering"
            className="font-medium underline hover:text-blue-900"
          >
            {t("timer.attestering.redigerHint.lenke")}
          </Link>
        </div>
      )}

      {/* Header-info read-only */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          {t("timer.detalj.detaljer")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Definisjon
            term={t("timer.felt.aktivitet")}
            verdi={sheet.aktivitet?.navn ?? "—"}
          />
          <Definisjon
            term={t("timer.felt.startTid")}
            verdi={isoTidspunktTilHHMM(sheet.startAt as string | null) || "—"}
          />
          <Definisjon
            term={t("timer.felt.sluttTid")}
            verdi={isoTidspunktTilHHMM(sheet.endAt as string | null) || "—"}
          />
          <Definisjon
            term={t("timer.felt.pauseMin")}
            verdi={`${sheet.pauseMin} min`}
          />
          {sheet.beskrivelse && (
            <Definisjon
              term={t("timer.felt.beskrivelse")}
              verdi={sheet.beskrivelse}
              spann={2}
            />
          )}
        </dl>
      </section>

      {/* R14 (d2b-2): radene tegnes med samme tabell som lista — én dag, låst til
          prosjektet i prosjektkontekst. ✓/retur/gjenåpne pr. linje og kort, retting i
          cella, ✂ og flytt underprosjekt (pennen) bor i tabellen. */}
      {totaltAntallRader + (sheet.utlegg?.length ?? 0) + (sheet.varer?.length ?? 0) === 0 ? (
        <section className="mb-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {t("timer.detalj.ingenTimer")}
        </section>
      ) : (
        <div className="mb-6">
          <DetaljTabell
            sedel={{
              ...(sheet as unknown as AttSedel),
              totaltimer: timerRader.reduce((s, r) => s + Number(r.timer), 0),
              // Ordre d2b-3 (c): firmaets effektive dagsnorm fra serveren (samme kilde som
              // listene); 0 = ukjent → ingen «av norm»-tekst.
              dagsnorm: sheet.dagsnorm > 0 ? sheet.dagsnorm : null,
            }}
            orgId={sheet.organizationId}
            readOnly={sheet.status !== "sent"}
            prosjektKontekst={prosjektKontekst}
            onReturnerDag={() => setReturnerVises(true)}
          />
        </div>
      )}

      {feil && <p className="mb-3 text-sm text-red-600">{feil}</p>}

      {sheet.status === "sent" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-5">
          {/* w7 (B15): egen sedel — tabellen har ingen knapper; si hvorfor i stedet for hintet. */}
          <p className="text-sm text-gray-600">{sheet.egneTimer ? t("timer.attestering.egneTimer.forklaring") : t("timer.attestering.detalj.tabellHint")}</p>
          {sheet.redigerTillatt && !sheet.egneTimer && (
            <Button variant="secondary" onClick={() => setRedigerModus(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              {t("timer.rediger.knapp")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <p>
            {t("timer.attestering.detalj.ikkeRedigerbar", {
              status: t(`timer.statusType.${sheet.status}`),
            })}
          </p>
          {/* F4-2: leder kan angre en fullført attestering (accepted → sent). */}
          {sheet.status === "accepted" && !sheet.egneTimer && (
            <Button
              variant="secondary"
              onClick={() => {
                setFeil(null);
                setGjenaapneVises(true);
              }}
              disabled={gjenaapneAttestering.isPending}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              {t("timer.attestering.gjenaapne.knapp")}
            </Button>
          )}
        </div>
      )}

      {gjenaapneVises && (
        <Modal
          open={true}
          onClose={() => setGjenaapneVises(false)}
          title={t("timer.attestering.gjenaapne.tittel")}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t("timer.attestering.gjenaapne.beskrivelse")}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setGjenaapneVises(false)}
                disabled={gjenaapneAttestering.isPending}
              >
                {t("handling.avbryt")}
              </Button>
              <Button
                type="button"
                onClick={() => gjenaapneAttestering.mutate({ sheetId })}
                disabled={gjenaapneAttestering.isPending}
              >
                {gjenaapneAttestering.isPending
                  ? t("handling.lagrer")
                  : t("timer.attestering.gjenaapne.bekreft")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {returnerVises && (
        <ReturnerDialog
          radIder={{
            timerIder: Array.from(valgteTimer),
            tilleggIder: Array.from(valgteTillegg),
            maskinIder: Array.from(valgteMaskin),
          }}
          onFerdig={() => router.push(tilbakeUrl)}
          onLukk={() => setReturnerVises(false)}
        />
      )}
      </>
      )}
    </div>
  );
}

function Definisjon({
  term,
  verdi,
  spann,
}: {
  term: string;
  verdi: React.ReactNode;
  spann?: number;
}) {
  return (
    <div className={spann === 2 ? "col-span-2" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {term}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">{verdi}</dd>
    </div>
  );
}

function ReturnerDialog({
  radIder,
  onFerdig,
  onLukk,
}: {
  radIder: { timerIder: string[]; tilleggIder: string[]; maskinIder: string[] };
  // T7-5b-2: parent leverer felles "ferdig"-håndtering (router.push i side-modus
  // eller modal-lukk i modal-modus). ReturnerDialog kjenner ikke disse selv.
  onFerdig: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [kommentar, setKommentar] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const returner = trpc.timer.dagsseddel.returnerRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      onLukk();
      onFerdig();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    if (!kommentar.trim()) {
      setFeil(t("timer.attestering.kommentarPaakrevd"));
      return;
    }
    returner.mutate({ radIder, kommentar: kommentar.trim() });
  }

  const antall =
    radIder.timerIder.length + radIder.tilleggIder.length + radIder.maskinIder.length;

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={t("timer.attestering.returnerTittel")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {t("timer.attestering.returnerBeskrivelse")}
        </p>
        <p className="text-sm font-medium text-gray-700">
          {t("timer.attestering.radValg.returnererAntall", { antall })}
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.attestering.kommentar")}
          </label>
          <textarea
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            rows={4}
            placeholder={t("timer.attestering.kommentarPlaceholder")}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            autoFocus
            required
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button
            type="submit"
            disabled={returner.isPending || !kommentar.trim()}
          >
            {returner.isPending
              ? t("handling.lagrer")
              : t("timer.attestering.returner")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


/** R14: dagens rader i samme tabell som lista (én sedel). */
function DetaljTabell({ sedel, orgId, readOnly, prosjektKontekst, onReturnerDag }: {
  sedel: AttSedel; orgId: string; readOnly: boolean; prosjektKontekst?: string; onReturnerDag: () => void;
}) {
  const sedler = useMemo(() => [sedel], [sedel]);
  const dager = useAttesteringModell(orgId, sedler, { medAvdeling: !prosjektKontekst });
  return (
    <AttesteringTabell
      dager={dager}
      orgId={orgId}
      readOnly={readOnly}
      verktoy={null}
      prosjektKontekst={prosjektKontekst}
      onReturnerDag={onReturnerDag}
    />
  );
}
