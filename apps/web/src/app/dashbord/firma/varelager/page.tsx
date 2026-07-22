"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { Plus, Pencil, Power, Trash2, Upload } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";

const ENHET_FORSLAG = ["m", "m2", "m3", "kg", "tonn", "stk", "sekk", "liter", "doegn", "timer"];

type Vare = {
  id: string;
  navn: string;
  varenummer: string | null;
  enhet: string;
  pris: unknown;
  internkostnad: unknown;
  kategoriId: string | null;
  aktiv: boolean;
  kategori: { id: string; navn: string; kontonummer: string | null } | null;
};

type VareKategori = {
  id: string;
  navn: string;
  kontonummer: string | null;
  aktiv: boolean;
};

type Fane = "varer" | "kategorier";

function formaterTall(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

export default function VarelagerSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const harVarelager = valgtFirma?.aktiveFirmamoduler.includes("varelager") ?? false;

  const [fane, setFane] = useState<Fane>("varer");

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!harVarelager) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-base font-semibold text-amber-900">
          {t("firma.varelager.modulIkkeAktivert.tittel")}
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {t("firma.varelager.modulIkkeAktivert.beskrivelse")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <SonetonetSidehode sone="firma">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">
          {t("firma.varelager.tittel")}
        </h1>
      </SonetonetSidehode>

      <div className="mb-4 border-b border-gray-200">
        <div className="flex gap-1">
          <FaneKnapp aktiv={fane === "varer"} onClick={() => setFane("varer")}>
            {t("firma.varelager.fane.varer")}
          </FaneKnapp>
          <FaneKnapp aktiv={fane === "kategorier"} onClick={() => setFane("kategorier")}>
            {t("firma.varelager.fane.kategorier")}
          </FaneKnapp>
        </div>
      </div>

      {fane === "varer" ? (
        <VarerFane orgId={orgId} />
      ) : (
        <KategorierFane orgId={orgId} />
      )}
    </div>
  );
}

function FaneKnapp({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        aktiv
          ? "border-sitedoc-primary text-sitedoc-primary"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================== Varer-fanen ============================== */

function VarerFane({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [sok, setSok] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState<string>("");
  const [inkluderInaktiv, setInkluderInaktiv] = useState(false);
  const [visOpprett, setVisOpprett] = useState(false);
  const [redigerVare, setRedigerVare] = useState<Vare | null>(null);
  const [deaktiverVare, setDeaktiverVare] = useState<Vare | null>(null);

  const { data: kategorier } = trpc.vareKategori.list.useQuery({
    organizationId: orgId,
    kunAktive: true,
  });

  const { data: varer, isLoading } = trpc.vare.list.useQuery({
    organizationId: orgId,
    kunAktive: !inkluderInaktiv,
    kategoriId: kategoriFilter || undefined,
    sok: sok || undefined,
  });

  const deaktiver = trpc.vare.deaktiver.useMutation({
    onSuccess: () => {
      void utils.vare.list.invalidate();
      setDeaktiverVare(null);
    },
    onError: (e: { message: string }) => alert(e.message),
  });

  const rader = (varer ?? []) as Vare[];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.varelager.filter.sok")}
            </label>
            <input
              type="text"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.varelager.kolonne.kategori")}
            </label>
            <select
              value={kategoriFilter}
              onChange={(e) => setKategoriFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t("firma.varelager.filter.alleKategorier")}</option>
              {(kategorier as VareKategori[] | undefined)?.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.navn}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-1 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={inkluderInaktiv}
              onChange={(e) => setInkluderInaktiv(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("firma.timer.visInaktive")}
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashbord/firma/varelager/import">
            <Button variant="secondary">
              <Upload className="mr-1.5 h-4 w-4" />
              {t("firma.varelager.knapp.importerSmartDok")}
            </Button>
          </Link>
          <Button onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("firma.varelager.knapp.leggTilVare")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : rader.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <h3 className="text-base font-medium text-gray-900">
            {t("firma.varelager.tom.tittel")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t("firma.varelager.tom.beskrivelse")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("firma.varelager.kolonne.navn")}</th>
                <th className="px-3 py-3">{t("firma.varelager.kolonne.varenummer")}</th>
                <th className="px-3 py-3">{t("firma.varelager.kolonne.kategori")}</th>
                <th className="px-3 py-3">{t("firma.varelager.kolonne.enhet")}</th>
                <th className="px-3 py-3 text-right">{t("firma.varelager.kolonne.pris")}</th>
                <th className="px-3 py-3 text-right">{t("firma.varelager.kolonne.internkostnad")}</th>
                <th className="px-3 py-3">{t("firma.varelager.kolonne.aktiv")}</th>
                <th className="px-3 py-3 text-right">{t("handling.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((rad) => (
                <tr
                  key={rad.id}
                  className={`border-b border-gray-100 last:border-b-0 ${rad.aktiv ? "" : "opacity-50"}`}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{rad.navn}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{rad.varenummer ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{rad.kategori?.navn ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{rad.enhet}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formaterTall(rad.pris)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formaterTall(rad.internkostnad)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rad.aktiv
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {rad.aktiv ? t("firma.varelager.aktiv") : t("firma.varelager.deaktivert")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setRedigerVare(rad)}
                      className="mr-1 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      title={t("handling.rediger")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {rad.aktiv && (
                      <button
                        onClick={() => setDeaktiverVare(rad)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                        title={t("firma.varelager.deaktivert")}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visOpprett && (
        <VareModal
          orgId={orgId}
          modus="opprett"
          kategorier={(kategorier ?? []) as VareKategori[]}
          onClose={() => setVisOpprett(false)}
        />
      )}
      {redigerVare && (
        <VareModal
          orgId={orgId}
          modus="rediger"
          vare={redigerVare}
          kategorier={(kategorier ?? []) as VareKategori[]}
          onClose={() => setRedigerVare(null)}
        />
      )}
      {deaktiverVare && (
        <Modal
          open={true}
          onClose={() => setDeaktiverVare(null)}
          title={deaktiverVare.navn}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("firma.varelager.deaktiver.bekreft")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeaktiverVare(null)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                {t("handling.avbryt")}
              </button>
              <button
                onClick={() =>
                  deaktiver.mutate({ id: deaktiverVare.id, organizationId: orgId })
                }
                disabled={deaktiver.isPending}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("handling.deaktiver")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function VareModal({
  orgId,
  modus,
  vare,
  kategorier,
  onClose,
}: {
  orgId: string;
  modus: "opprett" | "rediger";
  vare?: Vare;
  kategorier: VareKategori[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [navn, setNavn] = useState(vare?.navn ?? "");
  const [varenummer, setVarenummer] = useState(vare?.varenummer ?? "");
  const [enhet, setEnhet] = useState(vare?.enhet ?? "stk");
  const [pris, setPris] = useState<string>(
    vare?.pris !== null && vare?.pris !== undefined ? String(vare.pris) : "",
  );
  const [internkostnad, setInternkostnad] = useState<string>(
    vare?.internkostnad !== null && vare?.internkostnad !== undefined
      ? String(vare.internkostnad)
      : "",
  );
  const [kategoriId, setKategoriId] = useState<string>(vare?.kategoriId ?? "");
  const [feil, setFeil] = useState<string | null>(null);

  const opprett = trpc.vare.opprett.useMutation({
    onSuccess: () => {
      void utils.vare.list.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const oppdater = trpc.vare.oppdater.useMutation({
    onSuccess: () => {
      void utils.vare.list.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const isPending = opprett.isPending || oppdater.isPending;

  function lagre() {
    setFeil(null);
    const data = {
      navn: navn.trim(),
      varenummer: varenummer.trim() || null,
      enhet: enhet.trim(),
      pris: pris === "" ? null : Number(pris),
      internkostnad: internkostnad === "" ? null : Number(internkostnad),
      kategoriId: kategoriId || null,
    };
    if (modus === "opprett") {
      opprett.mutate({ organizationId: orgId, ...data });
    } else if (vare) {
      oppdater.mutate({ id: vare.id, organizationId: orgId, ...data });
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t(modus === "opprett" ? "firma.varelager.modal.opprett" : "firma.varelager.modal.rediger")}
    >
      <div className="space-y-3">
        <FeltBlokk label={t("firma.varelager.felt.navn")}>
          <input
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>
        <FeltBlokk label={t("firma.varelager.felt.varenummer")}>
          <input
            type="text"
            value={varenummer}
            onChange={(e) => setVarenummer(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>
        <FeltBlokk label={t("firma.varelager.felt.enhet")}>
          <input
            type="text"
            list="enhet-forslag"
            value={enhet}
            onChange={(e) => setEnhet(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <datalist id="enhet-forslag">
            {ENHET_FORSLAG.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <p className="mt-0.5 text-xs text-gray-500">
            {t("firma.varelager.felt.enhetForslag")}
          </p>
        </FeltBlokk>
        <FeltBlokk label={t("firma.varelager.felt.pris")}>
          <input
            type="number"
            step="0.01"
            value={pris}
            onChange={(e) => setPris(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>
        <FeltBlokk label={t("firma.varelager.felt.internkostnad")}>
          <input
            type="number"
            step="0.01"
            value={internkostnad}
            onChange={(e) => setInternkostnad(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>
        <FeltBlokk label={t("firma.varelager.felt.kategori")}>
          <select
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("firma.varelager.felt.kategoriIngen")}</option>
            {kategorier.map((k) => (
              <option key={k.id} value={k.id}>
                {k.navn}
              </option>
            ))}
          </select>
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
            disabled={isPending || !navn.trim() || !enhet.trim()}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {isPending ? t("handling.lagrer") : t("handling.lagre")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================ Kategorier-fanen ============================ */

function KategorierFane({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [visOpprett, setVisOpprett] = useState(false);
  const [redigerKat, setRedigerKat] = useState<VareKategori | null>(null);
  const [slettKat, setSlettKat] = useState<VareKategori | null>(null);

  const { data: kategorier, isLoading } = trpc.vareKategori.list.useQuery({
    organizationId: orgId,
  });

  const slett = trpc.vareKategori.slett.useMutation({
    onSuccess: () => {
      void utils.vareKategori.list.invalidate();
      setSlettKat(null);
    },
    onError: (e: { message: string }) => alert(e.message),
  });

  const rader = (kategorier ?? []) as VareKategori[];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setVisOpprett(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("firma.varelager.kategori.knapp.leggTil")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : rader.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">{t("firma.varelager.kategori.tom")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("firma.varelager.kategori.kolonne.navn")}</th>
                <th className="px-3 py-3">{t("firma.varelager.kategori.kolonne.kontonummer")}</th>
                <th className="px-3 py-3">{t("firma.varelager.kategori.kolonne.aktiv")}</th>
                <th className="px-3 py-3 text-right">{t("handling.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((rad) => (
                <tr
                  key={rad.id}
                  className={`border-b border-gray-100 last:border-b-0 ${rad.aktiv ? "" : "opacity-50"}`}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{rad.navn}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">
                    {rad.kontonummer ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rad.aktiv ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {rad.aktiv ? t("firma.varelager.aktiv") : t("firma.varelager.deaktivert")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setRedigerKat(rad)}
                      className="mr-1 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      title={t("handling.rediger")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSlettKat(rad)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                      title={t("handling.slett")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visOpprett && (
        <KategoriModal
          orgId={orgId}
          modus="opprett"
          onClose={() => setVisOpprett(false)}
        />
      )}
      {redigerKat && (
        <KategoriModal
          orgId={orgId}
          modus="rediger"
          kategori={redigerKat}
          onClose={() => setRedigerKat(null)}
        />
      )}
      {slettKat && (
        <Modal
          open={true}
          onClose={() => setSlettKat(null)}
          title={slettKat.navn}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("firma.varelager.kategori.slett.bekreft")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSlettKat(null)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                {t("handling.avbryt")}
              </button>
              <button
                onClick={() => slett.mutate({ id: slettKat.id, organizationId: orgId })}
                disabled={slett.isPending}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("handling.slett")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function KategoriModal({
  orgId,
  modus,
  kategori,
  onClose,
}: {
  orgId: string;
  modus: "opprett" | "rediger";
  kategori?: VareKategori;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [navn, setNavn] = useState(kategori?.navn ?? "");
  const [kontonummer, setKontonummer] = useState(kategori?.kontonummer ?? "");
  const [feil, setFeil] = useState<string | null>(null);

  const opprett = trpc.vareKategori.opprett.useMutation({
    onSuccess: () => {
      void utils.vareKategori.list.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const oppdater = trpc.vareKategori.oppdater.useMutation({
    onSuccess: () => {
      void utils.vareKategori.list.invalidate();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const isPending = opprett.isPending || oppdater.isPending;

  function lagre() {
    setFeil(null);
    const data = {
      navn: navn.trim(),
      kontonummer: kontonummer.trim() || null,
    };
    if (modus === "opprett") {
      opprett.mutate({ organizationId: orgId, ...data });
    } else if (kategori) {
      oppdater.mutate({ id: kategori.id, organizationId: orgId, ...data });
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t(modus === "opprett" ? "firma.varelager.kategori.modal.opprett" : "firma.varelager.kategori.modal.rediger")}
    >
      <div className="space-y-3">
        <FeltBlokk label={t("firma.varelager.kategori.felt.navn")}>
          <input
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </FeltBlokk>
        <FeltBlokk label={t("firma.varelager.kategori.felt.kontonummer")}>
          <input
            type="text"
            value={kontonummer}
            onChange={(e) => setKontonummer(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <p className="mt-0.5 text-xs text-gray-500">
            {t("firma.varelager.kategori.felt.kontonummerHjelp")}
          </p>
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
            disabled={isPending || !navn.trim()}
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
