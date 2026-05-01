"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Spinner } from "@sitedoc/ui";

function nyUuid(): string {
  // Bruker crypto.randomUUID når tilgjengelig (alle moderne nettlesere)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Enkel fallback (skal aldri trigges i moderne miljø)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function iDag(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NyDagsseddelSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  // Stabil clientUuid per skjema-instans (idempotent ved retry)
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
      router.push(`/dashbord/${prosjektId}/timer/${sheet.id}`);
    },
    onError: (e) => setFeil(e.message),
  });

  // Default-aktivitet: «Anleggsarbeid» hvis seedet, ellers første aktive
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

    const datoIso = dato; // YYYY-MM-DD

    function tilstartAt(t: string): string | null {
      if (!t) return null;
      // Tolk klokkeslett HH:MM som lokal tid på valgt dato
      return new Date(`${dato}T${t}:00`).toISOString();
    }

    opprett.mutate({
      clientUuid,
      projectId: prosjektId,
      aktivitetId: valgtAktivitetId,
      dato: datoIso,
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
              onClick={() => router.push(`/dashbord/${prosjektId}/timer`)}
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
