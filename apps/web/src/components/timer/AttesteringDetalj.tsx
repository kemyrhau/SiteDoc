"use client";

// T7-2b1 (2026-05-14): Felleskomponent for attestering-detalj.
// Monteres fra to wrapper-sider:
//   - /dashbord/[prosjektId]/timer/attestering/[id] (prosjektleder-kontekst)
//   - /dashbord/firma/timer/attestering/[id]        (firma-admin-kontekst)
// Per-rad-attestering: hver rad har egen status, leder velger hvilke som
// attesteres/returneres via checkboxer.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { ArrowLeft, Check, Pencil, RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/timer/StatusBadge";
import { AttesteringDetaljEdit } from "@/components/timer/AttesteringDetalj_Edit";
import {
  ProsjektSectionAttest,
  type EcoBucketAttestProps,
  type MaskinRad,
  type RadProsjekt,
  type TilleggRad,
  type TimerRad,
} from "@/components/attestering/attestering-buckets";

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
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [returnerVises, setReturnerVises] = useState(false);
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

  const attesterRader = trpc.timer.dagsseddel.attesterRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: sheetId });
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      router.push(tilbakeUrl);
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const timerRader = (sheet?.timer ?? []) as unknown as TimerRad[];
  const tilleggRader = (sheet?.tillegg ?? []) as unknown as TilleggRad[];
  const maskinRader = (sheet?.maskiner ?? []) as unknown as MaskinRad[];

  const radTilgjengelig = (rad: { projectId: string; attestertStatus: string | null }) => {
    if (rad.attestertStatus !== "pending") return false;
    if (prosjektKontekst && rad.projectId !== prosjektKontekst) return false;
    return true;
  };

  // Pre-utvalg: alle pending-rader leder har tilgang til
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
      <div className={`mx-auto max-w-3xl p-6`}>
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

  const antallValgt = valgteTimer.size + valgteTillegg.size + valgteMaskin.size;
  const kanHandle = sheet.status === "sent" && antallValgt > 0;

  function toggle(set: Set<string>, id: string, oppdater: (s: Set<string>) => void) {
    const ny = new Set(set);
    if (ny.has(id)) ny.delete(id);
    else ny.add(id);
    oppdater(ny);
  }

  function handleAttester() {
    setFeil(null);
    attesterRader.mutate({
      radIder: {
        timerIder: Array.from(valgteTimer),
        tilleggIder: Array.from(valgteTillegg),
        maskinIder: Array.from(valgteMaskin),
      },
    });
  }

  return (
    <div className={`mx-auto max-w-3xl p-6`}>
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
            {sheet.prosjekt?.name ?? t("timer.detalj.ukjentProsjekt")}
            {sheet.prosjekt?.projectNumber
              ? ` (${sheet.prosjekt.projectNumber})`
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

      {/* T7-4d: per prosjekt+ECO-gruppering (samme mønster som T7-4c). Tillegg
          holdes per-prosjekt (ingen ECO-felt på SheetTillegg). */}
      {(() => {
        const bucketKey = (pid: string, eco: string | null) =>
          `${pid}|${eco ?? ""}`;
        const bucketMap = new Map<string, EcoBucketAttestProps>();
        const prosjektEcoMap = new Map<string, string[]>();
        const prosjektRekkefolge: string[] = [];
        const tilleggPerProsjekt = new Map<string, TilleggRad[]>();
        const prosjektNavnMap = new Map<string, RadProsjekt | null>();

        const noterProsjekt = (
          pid: string,
          navn: RadProsjekt | null | undefined,
        ) => {
          if (!prosjektEcoMap.has(pid)) {
            prosjektEcoMap.set(pid, []);
            prosjektRekkefolge.push(pid);
          }
          if (!prosjektNavnMap.has(pid) && navn) {
            prosjektNavnMap.set(pid, navn);
          }
        };
        const noterBucket = (
          pid: string,
          eco: string | null,
          navn: RadProsjekt | null | undefined,
        ) => {
          noterProsjekt(pid, navn);
          const ekv = eco ?? "";
          const liste = prosjektEcoMap.get(pid)!;
          if (!liste.includes(ekv)) liste.push(ekv);
          const k = bucketKey(pid, eco);
          if (!bucketMap.has(k)) {
            bucketMap.set(k, { projectId: pid, ecoId: eco, timer: [], maskin: [] });
          }
        };

        for (const r of timerRader) {
          noterBucket(r.projectId, r.externalCostObjectId, r.project);
          bucketMap.get(bucketKey(r.projectId, r.externalCostObjectId))!.timer.push(r);
        }
        for (const r of maskinRader) {
          noterBucket(r.projectId, r.externalCostObjectId, r.project);
          bucketMap.get(bucketKey(r.projectId, r.externalCostObjectId))!.maskin.push(r);
        }
        for (const r of tilleggRader) {
          noterProsjekt(r.projectId, r.project);
          const liste = tilleggPerProsjekt.get(r.projectId) ?? [];
          liste.push(r);
          tilleggPerProsjekt.set(r.projectId, liste);
        }

        if (prosjektRekkefolge.length === 0) {
          return (
            <section className="mb-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              {t("timer.detalj.ingenTimer")}
            </section>
          );
        }

        return prosjektRekkefolge.map((pid) => (
          <ProsjektSectionAttest
            key={pid}
            projectId={pid}
            prosjektNavn={prosjektNavnMap.get(pid) ?? null}
            ecoKeys={prosjektEcoMap.get(pid) ?? [""]}
            bucketMap={bucketMap}
            tillegg={tilleggPerProsjekt.get(pid) ?? []}
            prosjektKontekst={prosjektKontekst}
            valgteTimer={valgteTimer}
            valgteMaskin={valgteMaskin}
            valgteTillegg={valgteTillegg}
            onToggleTimer={(id) => toggle(valgteTimer, id, setValgteTimer)}
            onToggleMaskin={(id) => toggle(valgteMaskin, id, setValgteMaskin)}
            onToggleTillegg={(id) => toggle(valgteTillegg, id, setValgteTillegg)}
            kanFlytte={sheet.status === "sent"}
          />
        ));
      })()}

      {feil && <p className="mb-3 text-sm text-red-600">{feil}</p>}

      {sheet.status === "sent" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">
            {t("timer.attestering.radValg.antallValgt", { antall: antallValgt })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {sheet.redigerTillatt && (
              <Button
                variant="secondary"
                onClick={() => setRedigerModus(true)}
                disabled={attesterRader.isPending}
              >
                <Pencil className="mr-1 h-4 w-4" />
                {t("timer.rediger.knapp")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setReturnerVises(true)}
              disabled={!kanHandle || attesterRader.isPending}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              {t("timer.attestering.radValg.returnerValgte")}
            </Button>
            <Button onClick={handleAttester} disabled={!kanHandle || attesterRader.isPending}>
              <Check className="mr-1 h-4 w-4" />
              {attesterRader.isPending
                ? t("handling.lagrer")
                : t("timer.attestering.radValg.attesterValgte")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {t("timer.attestering.detalj.ikkeRedigerbar", {
            status: t(`timer.statusType.${sheet.status}`),
          })}
        </div>
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

