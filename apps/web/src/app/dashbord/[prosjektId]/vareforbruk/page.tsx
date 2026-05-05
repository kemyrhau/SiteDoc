"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { Plus, Pencil, Trash2 } from "lucide-react";

type VareforbrukRad = {
  id: string;
  dato: string | Date;
  vareId: string;
  antall: unknown;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  kommentar: string | null;
  registrertAvUserId: string;
  attestertSnapshot: unknown;
  erLast: boolean;
  vare: {
    id: string;
    navn: string;
    varenummer: string | null;
    enhet: string;
    kategoriId: string | null;
  };
  registrertAv: { id: string; name: string | null; email: string } | null;
};

type VareKatalog = {
  id: string;
  navn: string;
  varenummer: string | null;
  enhet: string;
  aktiv: boolean;
};

type Byggeplass = {
  id: string;
  name?: string;
  navn?: string;
};

type Eco = {
  id: string;
  navn: string;
  status: string;
};

function formaterDato(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dato = typeof d === "string" ? new Date(d) : d;
  return dato.toISOString().slice(0, 10);
}

function defaultPeriode(): { fra: string; til: string } {
  const naa = new Date();
  const fra = new Date(naa);
  fra.setDate(naa.getDate() - 30);
  return {
    fra: fra.toISOString().slice(0, 10),
    til: naa.toISOString().slice(0, 10),
  };
}

export default function VareforbrukSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const projectId = params?.prosjektId ?? "";

  const periodeDefault = useMemo(defaultPeriode, []);
  const [fra, setFra] = useState(periodeDefault.fra);
  const [til, setTil] = useState(periodeDefault.til);
  const [byggeplassFilter, setByggeplassFilter] = useState<string>("");

  const [visOpprett, setVisOpprett] = useState(false);
  const [redigerRad, setRedigerRad] = useState<VareforbrukRad | null>(null);
  const [slettRad, setSlettRad] = useState<VareforbrukRad | null>(null);

  const utils = trpc.useUtils();

  const { data: rader, isLoading, error } = trpc.vareforbruk.list.useQuery(
    {
      projectId,
      fra,
      til,
      byggeplassId: byggeplassFilter ? byggeplassFilter : undefined,
    },
    { enabled: !!projectId },
  );

  const { data: byggeplasser } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  const slett = trpc.vareforbruk.slett.useMutation({
    onSuccess: () => {
      void utils.vareforbruk.list.invalidate();
      setSlettRad(null);
    },
    onError: (e: { message: string }) => alert(e.message),
  });

  // Hvis trpc-error skyldes manglende modul, vis melding
  const modulIkkeAktivert = error?.data?.code === "PRECONDITION_FAILED";

  if (!projectId) {
    return null;
  }

  if (modulIkkeAktivert) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">
            {t("vareforbruk.modulIkkeAktivert.tittel")}
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            {t("vareforbruk.modulIkkeAktivert.beskrivelse")}
          </p>
        </div>
      </div>
    );
  }

  const liste = (rader ?? []) as VareforbrukRad[];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("vareforbruk.tittel")}
        </h1>
        <Button onClick={() => setVisOpprett(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("vareforbruk.knapp.registrer")}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3">
        <div>
          <label className="mb-1 block text-xs text-gray-600">
            {t("vareforbruk.filter.fra")}
          </label>
          <input
            type="date"
            value={fra}
            onChange={(e) => setFra(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">
            {t("vareforbruk.filter.til")}
          </label>
          <input
            type="date"
            value={til}
            onChange={(e) => setTil(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">
            {t("vareforbruk.filter.byggeplass")}
          </label>
          <select
            value={byggeplassFilter}
            onChange={(e) => setByggeplassFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("vareforbruk.filter.byggeplassAlle")}</option>
            {(byggeplasser as Byggeplass[] | undefined)?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.navn ?? b.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : liste.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <h3 className="text-base font-medium text-gray-900">
            {t("vareforbruk.tom.tittel")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t("vareforbruk.tom.beskrivelse")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("vareforbruk.kolonne.dato")}</th>
                <th className="px-3 py-3">{t("vareforbruk.kolonne.vare")}</th>
                <th className="px-3 py-3 text-right">{t("vareforbruk.kolonne.antall")}</th>
                <th className="px-3 py-3">{t("vareforbruk.kolonne.enhet")}</th>
                <th className="px-3 py-3">{t("vareforbruk.kolonne.byggeplass")}</th>
                <th className="px-3 py-3">{t("vareforbruk.kolonne.registrertAv")}</th>
                <th className="px-3 py-3">{t("vareforbruk.kolonne.kommentar")}</th>
                <th className="px-3 py-3 text-right">{t("handling.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((rad) => {
                const byggeplassNavn = (byggeplasser as Byggeplass[] | undefined)?.find(
                  (b) => b.id === rad.byggeplassId,
                );
                return (
                  <tr key={rad.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-2 text-gray-700">{formaterDato(rad.dato)}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {rad.vare.navn}
                      {rad.erLast && (
                        <span className="ml-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {t("vareforbruk.lastBadge")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {String(rad.antall)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{rad.vare.enhet}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {byggeplassNavn?.name ?? byggeplassNavn?.navn ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {rad.registrertAv?.name ?? rad.registrertAv?.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {rad.kommentar ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!rad.erLast && (
                        <>
                          <button
                            onClick={() => setRedigerRad(rad)}
                            className="mr-1 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title={t("handling.rediger")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSlettRad(rad)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                            title={t("handling.slett")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {visOpprett && (
        <ForbrukModal
          projectId={projectId}
          modus="opprett"
          byggeplasser={(byggeplasser ?? []) as Byggeplass[]}
          onClose={() => setVisOpprett(false)}
        />
      )}
      {redigerRad && (
        <ForbrukModal
          projectId={projectId}
          modus="rediger"
          rad={redigerRad}
          byggeplasser={(byggeplasser ?? []) as Byggeplass[]}
          onClose={() => setRedigerRad(null)}
        />
      )}
      {slettRad && (
        <Modal
          open={true}
          onClose={() => setSlettRad(null)}
          title={slettRad.vare.navn}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">{t("vareforbruk.slett.bekreft")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSlettRad(null)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                {t("handling.avbryt")}
              </button>
              <button
                onClick={() => slett.mutate({ id: slettRad.id })}
                disabled={slett.isPending}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("handling.slett")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================ Opprett/Rediger-modal ============================ */

function ForbrukModal({
  projectId,
  modus,
  rad,
  byggeplasser,
  onClose,
}: {
  projectId: string;
  modus: "opprett" | "rediger";
  rad?: VareforbrukRad;
  byggeplasser: Byggeplass[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [dato, setDato] = useState(
    rad ? formaterDato(rad.dato) : new Date().toISOString().slice(0, 10),
  );
  const [vareId, setVareId] = useState(rad?.vareId ?? "");
  const [antall, setAntall] = useState<string>(rad ? String(rad.antall) : "");
  const [byggeplassId, setByggeplassId] = useState<string>(rad?.byggeplassId ?? "");
  const [externalCostObjectId, setExternalCostObjectId] = useState<string>(
    rad?.externalCostObjectId ?? "",
  );
  const [kommentar, setKommentar] = useState<string>(rad?.kommentar ?? "");
  const [feil, setFeil] = useState<string | null>(null);

  // Hent eier-firma fra prosjekt for vare-katalog
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: projectId },
    { enabled: !!projectId },
  );
  const orgId = (prosjekt as { primaryOrganizationId?: string } | undefined)?.primaryOrganizationId;

  const { data: varekatalog } = trpc.vare.list.useQuery(
    { organizationId: orgId!, kunAktive: true },
    { enabled: !!orgId },
  );

  const { data: ecoListe } = trpc.eksternKostObjekt.list.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  const opprett = trpc.vareforbruk.opprett.useMutation({
    onSuccess: () => {
      void utils.vareforbruk.list.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const oppdater = trpc.vareforbruk.oppdater.useMutation({
    onSuccess: () => {
      void utils.vareforbruk.list.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const isPending = opprett.isPending || oppdater.isPending;
  const valgtVare = (varekatalog as VareKatalog[] | undefined)?.find((v) => v.id === vareId);

  function lagre() {
    setFeil(null);
    if (modus === "opprett") {
      if (!vareId) {
        setFeil(t("vareforbruk.felt.varePlaceholder"));
        return;
      }
      opprett.mutate({
        projectId,
        dato,
        vareId,
        antall: Number(antall),
        byggeplassId: byggeplassId || null,
        externalCostObjectId: externalCostObjectId || null,
        kommentar: kommentar.trim() || null,
      });
    } else if (rad) {
      oppdater.mutate({
        id: rad.id,
        dato,
        antall: Number(antall),
        byggeplassId: byggeplassId || null,
        externalCostObjectId: externalCostObjectId || null,
        kommentar: kommentar.trim() || null,
      });
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t(modus === "opprett" ? "vareforbruk.modal.opprett" : "vareforbruk.modal.rediger")}
    >
      <div className="space-y-3">
        <FeltBlokk label={t("vareforbruk.felt.dato")}>
          <input
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>
        <FeltBlokk label={t("vareforbruk.felt.vare")}>
          <select
            value={vareId}
            onChange={(e) => setVareId(e.target.value)}
            disabled={modus === "rediger"}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
          >
            <option value="">{t("vareforbruk.felt.varePlaceholder")}</option>
            {(varekatalog as VareKatalog[] | undefined)?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.navn}
                {v.varenummer ? ` (${v.varenummer})` : ""} — {v.enhet}
              </option>
            ))}
          </select>
        </FeltBlokk>
        <FeltBlokk label={t("vareforbruk.felt.antall") + (valgtVare ? ` (${valgtVare.enhet})` : "")}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={antall}
            onChange={(e) => setAntall(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>
        <FeltBlokk label={t("vareforbruk.felt.byggeplass")}>
          <select
            value={byggeplassId}
            onChange={(e) => setByggeplassId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("vareforbruk.felt.byggeplassIngen")}</option>
            {byggeplasser.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.navn ?? b.id}
              </option>
            ))}
          </select>
        </FeltBlokk>
        <FeltBlokk label={t("vareforbruk.felt.eco")}>
          <select
            value={externalCostObjectId}
            onChange={(e) => setExternalCostObjectId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("vareforbruk.felt.ecoIngen")}</option>
            {(ecoListe as Eco[] | undefined)
              ?.filter((e) => e.status === "aktiv")
              .map((eco) => (
                <option key={eco.id} value={eco.id}>
                  {eco.navn}
                </option>
              ))}
          </select>
        </FeltBlokk>
        <FeltBlokk label={t("vareforbruk.felt.kommentar")}>
          <textarea
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>

        {feil && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {feil}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            {t("handling.avbryt")}
          </button>
          <button
            onClick={lagre}
            disabled={isPending || !antall || (modus === "opprett" && !vareId)}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {isPending ? t("handling.lagrer") : t("handling.lagre")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FeltBlokk({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
