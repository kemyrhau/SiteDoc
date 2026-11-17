"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { lesTimerModus } from "@sitedoc/shared";
import {
  byggeplassForRegistrering,
  nyKortId,
  registrerLenke,
  standardAktivitetId,
} from "@/lib/registrerTimer";

/**
 * w2 (B1): «+ Registrer timer» — ett trykk fra Timer-sidene til utfylt jobb.
 *
 * Prosjektkort-modus: `opprett` (finn-eller-lag) lager dagen stille med prosjektet og
 * byggeplassen fra toppen; ny dag får første jobb fra serveren. Finnes dagen, åpner dagssiden
 * timervinduet for neste jobb (nytt kort), eller tilbyr gjenåpning når dagen er sendt.
 *
 * Dagskort-modus: uendret — «Ny dagsseddel» åpner skjemaet (B12 A, plan § 8.1 pkt 13).
 */
export function RegistrerTimerKnapp({
  organizationId,
  projectId,
}: {
  /** Firmaet timene føres på (innlogget firma). */
  organizationId: string | null;
  /** Prosjektet fra toppen (B2 trinn 3). Null = arbeideren velger på dagen. */
  projectId: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const orgId = organizationId ?? undefined;
  const [feil, setFeil] = useState<string | null>(null);

  const { data: ansattStatus } = trpc.timer.dagsseddel.kanFoereTimer.useQuery({
    organizationId: orgId,
  });
  const kanFoereTimer = ansattStatus?.kanFoere ?? true;
  const ansattFirmanavn = ansattStatus?.firmanavn ?? "";

  const { data: arbeidstid } = trpc.organisasjon.hentArbeidstidDefaults.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: !!organizationId },
  );
  const prosjektkortModus =
    lesTimerModus(arbeidstid?.timerRegistreringsmodus) === "prosjektkort";

  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery(
    { organizationId: orgId },
    { enabled: prosjektkortModus },
  );
  const { data: prosjekterRaw } = trpc.prosjekt.hentForTimer.useQuery(
    { organizationId: orgId },
    { enabled: prosjektkortModus },
  );
  const { data: byggeplasser } = trpc.bygning.hentForFirma.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: prosjektkortModus && !!organizationId },
  );
  const { aktivByggeplass } = useByggeplass();

  const opprett = trpc.timer.dagsseddel.opprett.useMutation({
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const deaktivertKlasse =
    "inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded bg-gray-200 px-3 py-2 text-sm font-medium text-gray-400";
  const aktivKlasse =
    "inline-flex shrink-0 items-center gap-1 rounded bg-sitedoc-primary px-3 py-2 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-60";

  // Kenneth-vedtak 2026-10-09 (2): deaktivert (synlig) hvis ikke ansatt i firmaet.
  if (!kanFoereTimer) {
    return (
      <span className={deaktivertKlasse} title={t("timer.ikkeAnsatt", { firma: ansattFirmanavn })}>
        <Plus className="h-4 w-4" />
        {prosjektkortModus ? t("timer.registrerTimer") : t("timer.nyDagsseddel")}
      </span>
    );
  }

  if (!prosjektkortModus) {
    return (
      <Link href="/dashbord/timer/ny" className={aktivKlasse}>
        <Plus className="h-4 w-4" />
        {t("timer.nyDagsseddel")}
      </Link>
    );
  }

  const prosjekter = (prosjekterRaw ?? []) as unknown as { id: string }[];
  const kjentProsjekt =
    projectId && prosjekter.some((p) => p.id === projectId) ? projectId : null;
  const aktivitetId = standardAktivitetId(aktiviteter);
  const klar = !!aktivitetId && !!prosjekterRaw;

  function registrer() {
    if (!aktivitetId) return;
    setFeil(null);
    const dato = new Date();
    const iso = `${dato.getFullYear()}-${String(dato.getMonth() + 1).padStart(2, "0")}-${String(dato.getDate()).padStart(2, "0")}`;
    opprett.mutate(
      {
        clientUuid: nyKortId(),
        aktivitetId,
        projectId: kjentProsjekt,
        byggeplassId: byggeplassForRegistrering({
          toppbarByggeplassId: aktivByggeplass?.id ?? null,
          projectId: kjentProsjekt,
          byggeplasser: byggeplasser as { id: string; projectId: string }[] | undefined,
        }),
        dato: iso,
        organizationId: orgId,
      },
      {
        // TS2589: eksplisitt param-type (opprett-outputen bærer Json-felt).
        onSuccess: (sheet: { id: string; eksisterte?: boolean }) =>
          router.push(
            registrerLenke({
              sheetId: sheet.id,
              projectId: kjentProsjekt,
              eksisterte: !!sheet.eksisterte,
            }),
          ),
      },
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={registrer}
        disabled={!klar || opprett.isPending}
        className={aktivKlasse}
      >
        <Plus className="h-4 w-4" />
        {t("timer.registrerTimer")}
      </button>
      {feil && <p className="max-w-xs text-right text-xs text-red-600">{feil}</p>}
    </div>
  );
}
