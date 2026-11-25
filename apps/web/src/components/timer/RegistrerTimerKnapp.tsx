"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { lesTimerModus } from "@sitedoc/shared";
import {
  byggeplassForRegistrering,
  gyldigRegistrerDato,
  nyKortId,
  registrerLenke,
  standardAktivitetId,
  visDagDato,
} from "@/lib/registrerTimer";
import { lokalIsoDato, medRetur } from "@/lib/tilbake-adresse";

/**
 * w2 (B1): «+ Registrer timer» — ett trykk fra Timer-sidene til utfylt jobb.
 *
 * Prosjektkort-modus: `opprett` (finn-eller-lag) lager dagen stille med prosjektet og
 * byggeplassen fra toppen; ny dag får første jobb fra serveren. Finnes dagen, åpner dagssiden
 * timervinduet for neste jobb (nytt kort), eller tilbyr gjenåpning når dagen er sendt.
 *
 * REGISTRER-DATO (Kenneth 2026-11-25): hovedknappen fører på i dag (ett klikk). Pilen ved siden
 * av åpner «Velg dato» — samme flyt på en tidligere dag; dagens seddel røres ikke. Ingen dag
 * etter i dag.
 *
 * Dagskort-modus: uendret — «Ny dagsseddel» åpner skjemaet (B12 A, plan § 8.1 pkt 13).
 */
export function RegistrerTimerKnapp({
  organizationId,
  projectId,
  retur,
  dato,
}: {
  /** Firmaet timene føres på (innlogget firma). */
  organizationId: string | null;
  /** Prosjektet fra toppen (B2 trinn 3). Null = arbeideren velger på dagen. */
  projectId: string | null;
  /** w14 (TK4–TK5): adressen knappen står på. Skjemaet og dagen går tilbake dit. */
  retur?: string | null;
  /** REGISTRER-DATO: datoen «Velg dato» starter på (YYYY-MM-DD). Uten: i dag. «I dag» bruker den ikke. */
  dato?: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const orgId = organizationId ?? undefined;
  const [feil, setFeil] = useState<string | null>(null);
  const [velgerAapen, setVelgerAapen] = useState(false);
  const [valgtDato, setValgtDato] = useState<string>("");
  const velgerRef = useRef<HTMLDivElement>(null);

  // Velgeren lukkes ved klikk utenfor eller Escape.
  useEffect(() => {
    if (!velgerAapen) return;
    function utenfor(e: MouseEvent) {
      if (velgerRef.current && !velgerRef.current.contains(e.target as Node)) setVelgerAapen(false);
    }
    function tast(e: KeyboardEvent) {
      if (e.key === "Escape") setVelgerAapen(false);
    }
    document.addEventListener("mousedown", utenfor);
    document.addEventListener("keydown", tast);
    return () => {
      document.removeEventListener("mousedown", utenfor);
      document.removeEventListener("keydown", tast);
    };
  }, [velgerAapen]);

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
      <Link href={medRetur("/dashbord/timer/ny", retur)} className={aktivKlasse}>
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

  const iDag = lokalIsoDato(new Date());

  function aapneVelger() {
    setValgtDato(dato && gyldigRegistrerDato(dato, new Date()) ? dato : iDag);
    setVelgerAapen((a) => !a);
  }

  /** `iso` = dagen jobben føres på (YYYY-MM-DD). Finnes seddelen, åpnes den (`eksisterte`). */
  function registrer(iso: string) {
    if (!aktivitetId) return;
    setFeil(null);
    setVelgerAapen(false);
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
              retur,
            }),
          ),
      },
    );
  }

  const datoGyldig = gyldigRegistrerDato(valgtDato, new Date());

  return (
    <div ref={velgerRef} className="relative flex shrink-0 flex-col items-end gap-1">
      <div className="inline-flex">
        <button
          type="button"
          onClick={() => registrer(lokalIsoDato(new Date()))}
          disabled={!klar || opprett.isPending}
          title={t("timer.registrerDato.iDagHint")}
          className={`${aktivKlasse} rounded-r-none`}
        >
          <Plus className="h-4 w-4" />
          {t("timer.registrerTimer")}
        </button>
        <button
          type="button"
          onClick={aapneVelger}
          disabled={!klar || opprett.isPending}
          title={t("timer.registrerDato.velgDato")}
          aria-label={t("timer.registrerDato.velgDato")}
          aria-expanded={velgerAapen}
          className={`${aktivKlasse} rounded-l-none border-l border-white/30 px-2`}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {velgerAapen && (
        <div
          role="dialog"
          aria-label={t("timer.registrerDato.velgDato")}
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
        >
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="registrer-dato">
            {t("timer.felt.dato")}
          </label>
          <input
            id="registrer-dato"
            type="date"
            value={valgtDato}
            max={iDag}
            onChange={(e) => setValgtDato(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <p className="mt-2 text-xs text-gray-500">{t("timer.registrerDato.hint")}</p>
          <button
            type="button"
            onClick={() => registrer(valgtDato)}
            disabled={!datoGyldig || opprett.isPending}
            className={`${aktivKlasse} mt-3 w-full justify-center`}
          >
            {datoGyldig
              ? t("timer.registrerDato.registrer", { dato: visDagDato(valgtDato, false) })
              : t("timer.registrerTimer")}
          </button>
        </div>
      )}
      {feil && <p className="max-w-xs text-right text-xs text-red-600">{feil}</p>}
    </div>
  );
}
