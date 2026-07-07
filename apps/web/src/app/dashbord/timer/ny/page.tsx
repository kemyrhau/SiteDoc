"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
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
 * «Ny dagsseddel» (web) — T.1 (2026-07-05): dato-only opprettelse.
 * Sedelen eies av arbeider/firma og har ingen prosjekttilhørighet på sedel-nivå.
 * Prosjekt (og byggeplass) legges per rad på detalj-siden — der flyten allerede
 * er T.1-korrekt. Web-opprett trenger derfor kun dato + default-aktivitet.
 */
export default function NyDagsseddelSide() {
  const { t } = useTranslation();
  const router = useRouter();

  const [clientUuid] = useState(() => nyUuid());

  const [dato, setDato] = useState(iDag());
  const [aktivitetId, setAktivitetId] = useState<string>("");
  const [pauseMin, setPauseMin] = useState(0);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const { data: aktiviteter, isLoading: aktiviteterLaster } =
    trpc.timer.aktivitet.list.useQuery();

  const opprett = trpc.timer.dagsseddel.opprett.useMutation({
    onSuccess: (sheet) => {
      router.push(`/dashbord/timer/${sheet.id}`);
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
    <div className="mx-auto max-w-2xl p-6">
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
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.sluttTid")}
              </label>
              <Input
                type="time"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
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
                onChange={(e) => setPauseMin(parseInt(e.target.value || "0"))}
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
            <Button type="submit" disabled={opprett.isPending}>
              {opprett.isPending ? t("handling.lagrer") : t("timer.opprett")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
