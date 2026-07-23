"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";
import { Button, Input, Spinner } from "@sitedoc/ui";
import { ArrowLeft } from "lucide-react";

function nyUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function iDag(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * «Ny dagsseddel» (web) — T.1 (2026-07-05): sedelen er dato-only på server
 * (DailySheet har ingen projectId; prosjekt persisteres per rad på
 * SheetTimer.projectId). D7 (web-paritet 2026-07-08): match mobil — krev
 * Prosjekt ved opprettelse. Prosjektet lagres IKKE på sedelen (ingen migrering);
 * det bæres videre til detalj-siden via `?nyttProsjekt=` som forhåndsåpner
 * prosjektgruppa og blir default for nye rader (UI/session-konsept, akkurat som
 * mobils lokale, usynkede daily_sheets.projectId).
 */
export default function NyDagsseddelSide() {
  const { t } = useTranslation();
  const router = useRouter();

  const [clientUuid] = useState(() => nyUuid());

  const [dato, setDato] = useState(iDag());
  const [projectId, setProjectId] = useState<string>("");
  const [aktivitetId, setAktivitetId] = useState<string>("");
  const [pauseMin, setPauseMin] = useState(0);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  // Prefyll Fra/Til/pause fra firmaets KALENDER-EFFEKTIVE arbeidstid (paritet
  // med mobil, som speiler samme kilde via hentEffektivArbeidstidLokal —
  // respekterer sommertid/halvdag). `manueltEndret` sikrer at bruker-redigering
  // ikke overskrives; ellers re-prefylles ved dato-endring (sommertid-grense).
  const [manueltEndret, setManueltEndret] = useState(false);

  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id ?? null;

  const { data: aktiviteter, isLoading: aktiviteterLaster } =
    trpc.timer.aktivitet.list.useQuery();

  // D7: prosjektliste for arbeider (inkluderer interne prosjekter). Cast for å
  // unngå TS2589 (dyp Project-type) — samme mønster som detalj-siden.
  const { data: prosjekterRaw } = trpc.prosjekt.hentForTimer.useQuery();
  const prosjekter = (prosjekterRaw ?? []) as unknown as Array<{
    id: string;
    name: string;
    projectNumber: string;
  }>;

  // Kalender-effektiv arbeidstid for valgt dato. Re-fetcher når `dato` endres.
  const { data: effektiv } = trpc.organisasjon.hentEffektivArbeidstid.useQuery(
    { organizationId: orgId ?? "", dato },
    { enabled: !!orgId },
  );

  useEffect(() => {
    if (manueltEndret) return;
    if (effektiv) {
      setStartAt(effektiv.startTid);
      setEndAt(effektiv.sluttTid);
      setPauseMin(effektiv.pauseMin);
    } else if (!orgId) {
      // Ingen firma-kontekst → fall tilbake til default-vindu.
      setStartAt("07:00");
      setEndAt("15:00");
      setPauseMin(30);
    }
  }, [effektiv, orgId, manueltEndret]);

  const opprett = trpc.timer.dagsseddel.opprett.useMutation({
    onSuccess: (sheet) => {
      // D7: bær prosjektvalget til detalj-siden (forhåndsåpner gruppa + default
      // for rader). D1: hvis sedelen fantes fra før (eksisterte), signaliser det
      // så detalj-siden viser «dagen fantes alt»-notis (mobil-atferd) i stedet
      // for en feilmelding.
      const params = new URLSearchParams({ nyttProsjekt: projectId });
      if (sheet.eksisterte) params.set("aapnetEksisterende", "1");
      router.push(`/dashbord/timer/${sheet.id}?${params.toString()}`);
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const defaultAktivitetId = useMemo(() => {
    if (!aktiviteter || aktiviteter.length === 0) return "";
    const anleggsarbeid = aktiviteter.find(
      (a) => a.navn === "Anleggsarbeid" && a.aktiv,
    );
    if (anleggsarbeid) return anleggsarbeid.id;
    const forsteAktiv = aktiviteter.find((a) => a.aktiv);
    if (forsteAktiv) return forsteAktiv.id;
    const forsteHvilkenSomHelst = aktiviteter[0];
    return forsteHvilkenSomHelst ? forsteHvilkenSomHelst.id : "";
  }, [aktiviteter]);

  const valgtAktivitetId = aktivitetId || defaultAktivitetId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);

    if (!projectId) {
      setFeil(t("timer.feil.ingenProsjekt"));
      return;
    }

    if (!valgtAktivitetId) {
      setFeil(t("timer.feil.ingenAktivitet"));
      return;
    }

    function tilstartAt(verdi: string): string | null {
      if (!verdi) return null;
      return new Date(`${dato}T${verdi}:00`).toISOString();
    }

    opprett.mutate({
      clientUuid,
      aktivitetId: valgtAktivitetId,
      dato,
      startAt: tilstartAt(startAt),
      endAt: tilstartAt(endAt),
      pauseMin,
      beskrivelse: beskrivelse.trim() || null,
    });
  }

  if (aktiviteterLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-6">
      <Link
        href="/dashbord/timer/mine"
        className="mb-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("timer.tilbake")}
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        {t("timer.nyDagsseddel")}
      </h1>
      <p className="mb-6 text-sm text-gray-600">{t("timer.nyBeskrivelse")}</p>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.dato")}
          </label>
          <Input
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.prosjekt")}
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">{t("timer.velgProsjekt")}</option>
            {prosjekter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectNumber} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.aktivitet")}
          </label>
          <select
            value={valgtAktivitetId}
            onChange={(e) => setAktivitetId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">{t("timer.velgAktivitet")}</option>
            {aktiviteter?.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.aktiv}>
                {a.navn}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("timer.arbeidstidIDag")}
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            {t("timer.arbeidstidIDagBeskrivelse")}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.startTid")}
              </label>
              <Input
                type="time"
                value={startAt}
                onChange={(e) => {
                  setStartAt(e.target.value);
                  setManueltEndret(true);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.sluttTid")}
              </label>
              <Input
                type="time"
                value={endAt}
                onChange={(e) => {
                  setEndAt(e.target.value);
                  setManueltEndret(true);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.pauseMin")}
              </label>
              <Input
                type="number"
                min={0}
                value={pauseMin}
                onChange={(e) => {
                  setPauseMin(parseInt(e.target.value || "0"));
                  setManueltEndret(true);
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.beskrivelse")}
            <span className="ml-1 text-xs text-gray-400">
              ({t("label.valgfritt")})
            </span>
          </label>
          <textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}

        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">{t("timer.nyHjelpetekst")}</p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/dashbord/timer/mine")}
            >
              {t("handling.avbryt")}
            </Button>
            <Button type="submit" disabled={opprett.isPending || !projectId}>
              {opprett.isPending ? t("handling.lagrer") : t("timer.opprett")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
