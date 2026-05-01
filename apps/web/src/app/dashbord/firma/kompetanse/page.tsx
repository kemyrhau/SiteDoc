"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner, Textarea } from "@sitedoc/ui";
import {
  KOMPETANSE_KATEGORIER,
  type KompetanseKategori,
  kompetanseStatus,
  type KompetanseStatus,
} from "@sitedoc/shared";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

type KompetansetypeRad = {
  id: string;
  navn: string;
  kategori: string;
  aktiv: boolean;
  defaultUtloperAarEtterUtstedt: number | null;
  beskrivelse: string | null;
  kobletTilEquipmentModell: string | null;
  _count: { ansattKompetanser: number };
};

type Fane = "matrise" | "typer";

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function KompetanseSide() {
  const { t } = useTranslation();
  const [aktivFane, setAktivFane] = useState<Fane>("matrise");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t("firma.kompetanse.tittel")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t("firma.kompetanse.beskrivelse")}
        </p>
      </div>

      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setAktivFane("matrise")}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              aktivFane === "matrise"
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {t("firma.kompetanse.fane.matrise")}
          </button>
          <button
            onClick={() => setAktivFane("typer")}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              aktivFane === "typer"
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {t("firma.kompetanse.fane.typer")}
          </button>
        </nav>
      </div>

      {aktivFane === "matrise" ? <MatriseFane /> : <KompetansetyperFane />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Matrise-fane (read-only, viser fargemarkering)                      */
/* ------------------------------------------------------------------ */

function MatriseFane() {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.kompetanse.hentMatrise.useQuery();
  const [filterKategori, setFilterKategori] = useState<string>("");
  const [filterAvdeling, setFilterAvdeling] = useState<string>("");
  const [sokAnsatt, setSokAnsatt] = useState<string>("");

  const koblingMap = useMemo(() => {
    type Kobling = NonNullable<typeof data>["koblinger"][number];
    const m = new Map<string, Kobling>();
    if (data) {
      for (const k of data.koblinger) {
        m.set(`${k.userId}|${k.kompetansetypeId}`, k);
      }
    }
    return m;
  }, [data]);

  const avdelinger = useMemo(() => {
    if (!data) return [];
    const sett = new Map<string, string>();
    for (const b of data.brukere) {
      if (b.avdeling) sett.set(b.avdeling.id, b.avdeling.navn);
    }
    return Array.from(sett.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtrerteBrukere = useMemo(() => {
    if (!data) return [];
    return data.brukere.filter((b) => {
      if (filterAvdeling && b.avdelingId !== filterAvdeling) return false;
      if (
        sokAnsatt &&
        !(b.name ?? "").toLowerCase().includes(sokAnsatt.toLowerCase()) &&
        !(b.email ?? "").toLowerCase().includes(sokAnsatt.toLowerCase())
      )
        return false;
      return true;
    });
  }, [data, filterAvdeling, sokAnsatt]);

  const filtrerteTyper = useMemo(() => {
    if (!data) return [];
    return data.kompetansetyper.filter((k) =>
      filterKategori ? k.kategori === filterKategori : true,
    );
  }, [data, filterKategori]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!data || data.brukere.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-500">{t("firma.kompetanse.matrise.ingenAnsatte")}</p>
      </div>
    );
  }

  if (data.kompetansetyper.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-500">{t("firma.kompetanse.matrise.ingenTyper")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter-rad */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <Input
          type="text"
          value={sokAnsatt}
          onChange={(e) => setSokAnsatt(e.target.value)}
          placeholder={t("firma.kompetanse.matrise.sokAnsatt")}
          className="w-64"
        />
        <select
          value={filterKategori}
          onChange={(e) => setFilterKategori(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
        >
          <option value="">{t("firma.kompetanse.matrise.alleKategorier")}</option>
          {KOMPETANSE_KATEGORIER.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {avdelinger.length > 0 && (
          <select
            value={filterAvdeling}
            onChange={(e) => setFilterAvdeling(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
          >
            <option value="">{t("firma.kompetanse.matrise.alleAvdelinger")}</option>
            {avdelinger.map(([id, navn]) => (
              <option key={id} value={id}>
                {navn}
              </option>
            ))}
          </select>
        )}
        <ForklaringLegend />
      </div>

      {/* Matrise-tabell */}
      <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="text-xs">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t("firma.kompetanse.matrise.ansatt")}
              </th>
              {filtrerteTyper.map((k) => (
                <th
                  key={k.id}
                  className="border-l border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700"
                  style={{ minWidth: 100 }}
                  title={k.kategori}
                >
                  <div className="max-w-[140px] truncate">{k.navn}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrerteBrukere.map((bruker) => (
              <tr key={bruker.id} className="border-t border-gray-100">
                <td className="sticky left-0 bg-white px-3 py-2 text-sm">
                  <div className="font-medium text-gray-900">
                    {bruker.name ?? bruker.email}
                  </div>
                  {bruker.avdeling && (
                    <div className="text-xs text-gray-500">
                      {bruker.avdeling.navn}
                    </div>
                  )}
                </td>
                {filtrerteTyper.map((k) => {
                  const kobling = koblingMap.get(`${bruker.id}|${k.id}`);
                  return (
                    <MatriseCelle
                      key={k.id}
                      kobling={kobling}
                      typeNavn={k.navn}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatriseCelle({
  kobling,
  typeNavn,
}: {
  kobling:
    | {
        utstedtDato: Date | string | null;
        utloper: Date | string | null;
        sertifikatNr: string | null;
        utstederOrgan: string | null;
      }
    | undefined;
  typeNavn: string;
}) {
  const { t } = useTranslation();

  if (!kobling) {
    return <td className="border-l border-gray-100 bg-gray-50/50" />;
  }

  const status = kompetanseStatus(kobling.utloper);
  const farger: Record<KompetanseStatus, string> = {
    gyldig: "bg-green-100 hover:bg-green-200 text-green-900",
    varsel: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900",
    utlopt: "bg-red-100 hover:bg-red-200 text-red-900",
  };

  const utloperTekst = kobling.utloper
    ? formaterDato(kobling.utloper)
    : t("firma.kompetanse.ingenUtlop");

  const tooltip = [
    typeNavn,
    kobling.utstedtDato
      ? `${t("firma.kompetanse.utstedt")}: ${formaterDato(kobling.utstedtDato)}`
      : null,
    `${t("firma.kompetanse.utloper")}: ${utloperTekst}`,
    kobling.sertifikatNr ? `${t("firma.kompetanse.sertifikatNr")}: ${kobling.sertifikatNr}` : null,
    kobling.utstederOrgan ? `${t("firma.kompetanse.utstederOrgan")}: ${kobling.utstederOrgan}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <td
      className={`border-l border-gray-100 px-2 py-2 text-center transition-colors ${farger[status]}`}
      title={tooltip}
    >
      <div className="flex items-center justify-center gap-1">
        {status === "varsel" && <AlertTriangle className="h-3.5 w-3.5" />}
        <span className="text-xs">{utloperTekst}</span>
      </div>
    </td>
  );
}

function ForklaringLegend() {
  const { t } = useTranslation();
  return (
    <div className="ml-auto flex items-center gap-3 text-xs text-gray-600">
      <LegendItem farge="bg-green-100" tekst={t("firma.kompetanse.legend.gyldig")} />
      <LegendItem farge="bg-yellow-100" tekst={t("firma.kompetanse.legend.varsel")} />
      <LegendItem farge="bg-red-100" tekst={t("firma.kompetanse.legend.utlopt")} />
    </div>
  );
}

function LegendItem({ farge, tekst }: { farge: string; tekst: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-3 w-3 rounded ${farge}`} />
      <span>{tekst}</span>
    </div>
  );
}

function formaterDato(d: Date | string): string {
  const dato = d instanceof Date ? d : new Date(d);
  return dato.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Kompetansetyper-fane (CRUD)                                         */
/* ------------------------------------------------------------------ */

function KompetansetyperFane() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [visOpprett, setVisOpprett] = useState(false);
  const [redigerId, setRedigerId] = useState<string | null>(null);
  const [slettId, setSlettId] = useState<string | null>(null);

  const { data: typer, isLoading } = trpc.kompetansetype.hentAlle.useQuery();

  const oppdaterMutation = trpc.kompetansetype.oppdater.useMutation({
    onSuccess: () => {
      utils.kompetansetype.hentAlle.invalidate();
    },
    onError: (error) => {
      alert(error.message);
    },
  });

  function handleToggleAktiv(rad: KompetansetypeRad) {
    oppdaterMutation.mutate({ id: rad.id, aktiv: !rad.aktiv });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setVisOpprett(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("firma.kompetanse.typer.leggTil")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !typer || typer.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">{t("firma.kompetanse.typer.ingen")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">{t("firma.kompetanse.typer.navn")}</th>
                <th className="px-4 py-3">{t("firma.kompetanse.typer.kategori")}</th>
                <th className="px-4 py-3">{t("firma.kompetanse.typer.defaultUtlop")}</th>
                <th className="px-4 py-3">{t("firma.kompetanse.typer.antallAnsatte")}</th>
                <th className="px-4 py-3">{t("firma.kompetanse.typer.aktiv")}</th>
                <th className="px-4 py-3 text-right">{t("firma.kompetanse.typer.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {typer.map((rad) => (
                <tr key={rad.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{rad.navn}</td>
                  <td className="px-4 py-3 text-gray-600">{rad.kategori}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {rad.defaultUtloperAarEtterUtstedt !== null
                      ? t("firma.kompetanse.typer.aarEtterUtstedt", {
                          aar: rad.defaultUtloperAarEtterUtstedt,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{rad._count.ansattKompetanser}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAktiv(rad)}
                      disabled={oppdaterMutation.isPending}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        rad.aktiv
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {rad.aktiv ? t("firma.kompetanse.typer.statusAktiv") : t("firma.kompetanse.typer.statusInaktiv")}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setRedigerId(rad.id)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title={t("handling.rediger")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSlettId(rad.id)}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        title={t("handling.slett")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visOpprett && <OpprettTypeDialog onLukk={() => setVisOpprett(false)} />}
      {redigerId && typer && (
        <RedigerTypeDialog
          type={typer.find((t) => t.id === redigerId)!}
          onLukk={() => setRedigerId(null)}
        />
      )}
      {slettId && typer && (
        <SlettTypeDialog
          type={typer.find((t) => t.id === slettId)!}
          onLukk={() => setSlettId(null)}
        />
      )}
    </div>
  );
}

function OpprettTypeDialog({ onLukk }: { onLukk: () => void }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [navn, setNavn] = useState("");
  const [kategori, setKategori] = useState<KompetanseKategori>("EGENDEFINERT");
  const [defaultUtlop, setDefaultUtlop] = useState<string>("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const mutation = trpc.kompetansetype.opprett.useMutation({
    onSuccess: () => {
      utils.kompetansetype.hentAlle.invalidate();
      onLukk();
    },
    onError: (error) => {
      setFeil(error.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    const aar = defaultUtlop.trim() ? parseInt(defaultUtlop, 10) : null;
    mutation.mutate({
      navn,
      kategori,
      defaultUtloperAarEtterUtstedt: aar,
      beskrivelse: beskrivelse.trim() || null,
    });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("firma.kompetanse.typer.leggTil")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.navn")}
          </label>
          <Input
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder={t("firma.kompetanse.typer.navnPlaceholder")}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.kategori")}
          </label>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value as KompetanseKategori)}
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
          >
            {KOMPETANSE_KATEGORIER.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.defaultUtlop")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input
            type="number"
            min="0"
            max="99"
            value={defaultUtlop}
            onChange={(e) => setDefaultUtlop(e.target.value)}
            placeholder={t("firma.kompetanse.typer.defaultUtlopPlaceholder")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.beskrivelse")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            rows={2}
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={mutation.isPending || !navn.trim()}>
            {mutation.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RedigerTypeDialog({
  type,
  onLukk,
}: {
  type: KompetansetypeRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [navn, setNavn] = useState(type.navn);
  const [kategori, setKategori] = useState<KompetanseKategori>(
    type.kategori as KompetanseKategori,
  );
  const [defaultUtlop, setDefaultUtlop] = useState<string>(
    type.defaultUtloperAarEtterUtstedt !== null
      ? String(type.defaultUtloperAarEtterUtstedt)
      : "",
  );
  const [beskrivelse, setBeskrivelse] = useState(type.beskrivelse ?? "");
  const [feil, setFeil] = useState<string | null>(null);

  const mutation = trpc.kompetansetype.oppdater.useMutation({
    onSuccess: () => {
      utils.kompetansetype.hentAlle.invalidate();
      onLukk();
    },
    onError: (error) => {
      setFeil(error.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    const aar = defaultUtlop.trim() ? parseInt(defaultUtlop, 10) : null;
    mutation.mutate({
      id: type.id,
      navn,
      kategori,
      defaultUtloperAarEtterUtstedt: aar,
      beskrivelse: beskrivelse.trim() || null,
    });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("firma.kompetanse.typer.rediger")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.navn")}
          </label>
          <Input
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.kategori")}
          </label>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value as KompetanseKategori)}
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
          >
            {KOMPETANSE_KATEGORIER.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.defaultUtlop")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input
            type="number"
            min="0"
            max="99"
            value={defaultUtlop}
            onChange={(e) => setDefaultUtlop(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kompetanse.typer.beskrivelse")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            rows={2}
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={mutation.isPending || !navn.trim()}>
            {mutation.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SlettTypeDialog({
  type,
  onLukk,
}: {
  type: KompetansetypeRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [feil, setFeil] = useState<string | null>(null);

  const mutation = trpc.kompetansetype.slett.useMutation({
    onSuccess: () => {
      utils.kompetansetype.hentAlle.invalidate();
      onLukk();
    },
    onError: (error) => {
      setFeil(error.message);
    },
  });

  function handleSlett() {
    setFeil(null);
    mutation.mutate({ id: type.id });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("firma.kompetanse.typer.slettTittel")}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          {t("firma.kompetanse.typer.slettBekreft", { navn: type.navn })}
        </p>
        {type._count.ansattKompetanser > 0 && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            {t("firma.kompetanse.typer.slettBlokkertVarsel", {
              antall: type._count.ansattKompetanser,
            })}
          </div>
        )}
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={mutation.isPending}
            onClick={handleSlett}
          >
            {mutation.isPending ? t("handling.lagrer") : t("handling.slett")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
