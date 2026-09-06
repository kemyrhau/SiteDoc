"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner, Badge } from "@sitedoc/ui";
import {
  Plus,
  Pencil,
  Trash2,
  Library,
  Star,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { felttypeNokler } from "@/components/malbygger/PalettElement";

// L9 tre-liste-prinsippet: sjekkliste / oppgave / HMS blandes aldri i én liste.
type Fane = "sjekkliste" | "oppgave" | "hms";
const FANER: Fane[] = ["sjekkliste", "oppgave", "hms"];

export default function MalarkivSide() {
  const { t } = useTranslation();
  const { valgtFirma, kanAdministrereFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const [fane, setFane] = useState<Fane>("sjekkliste");
  const [visOpprett, setVisOpprett] = useState(false);
  const [visLaan, setVisLaan] = useState(false);
  const [redigerId, setRedigerId] = useState<string | null>(null);
  const [slettMal, setSlettMal] = useState<{ id: string; navn: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: maler, isLoading } = trpc.firmamal.list.useQuery(
    { organizationId: orgId!, fane },
    { enabled: !!orgId },
  );

  const oppdaterMutation = trpc.firmamal.oppdater.useMutation({
    onSuccess: () => utils.firmamal.list.invalidate(),
  });
  const slettMutation = trpc.firmamal.slett.useMutation({
    onSuccess: () => {
      utils.firmamal.list.invalidate();
      setSlettMal(null);
    },
  });

  if (!kanAdministrereFirma) {
    return (
      <div className="max-w-5xl">
        <p className="text-sm text-gray-500">{t("firma.malarkiv.kunFirmaAdmin")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <SonetonetSidehode sone="firma" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t("firma.malarkiv.tittel")}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {t("firma.malarkiv.beskrivelse")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setVisLaan(true)}>
              <Library className="mr-1.5 h-4 w-4" />
              {t("firma.malarkiv.laanFraSentralarkiv")}
            </Button>
            <Button onClick={() => setVisOpprett(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("firma.malarkiv.nyFirmamal")}
            </Button>
          </div>
        </div>
      </SonetonetSidehode>

      {/* Faner (L9) */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {FANER.map((f) => (
          <button
            key={f}
            onClick={() => setFane(f)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              fane === f
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`firma.malarkiv.fane.${f}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !maler || maler.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">{t("firma.malarkiv.ingen")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">{t("firma.malarkiv.kolonne.navn")}</th>
                <th className="px-4 py-3">{t("firma.malarkiv.kolonne.prefiks")}</th>
                <th className="px-4 py-3">{t("firma.malarkiv.kolonne.versjon")}</th>
                <th className="px-4 py-3">{t("firma.malarkiv.kolonne.punkter")}</th>
                <th className="px-4 py-3">{t("firma.malarkiv.kolonne.bruk")}</th>
                <th className="px-4 py-3">{t("firma.malarkiv.kolonne.standard")}</th>
                <th className="px-4 py-3 text-right">{t("firma.malarkiv.kolonne.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {maler.map((mal) => (
                <tr key={mal.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{mal.name}</span>
                    {mal.laantFraBibliotekMalId && (
                      <Badge variant="default" className="ml-2">
                        {t("firma.malarkiv.badge.laant")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{mal.prefix ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">v{mal.version}</td>
                  <td className="px-4 py-3 text-gray-600">{mal._count.objects}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {mal._count.copiedTo > 0
                      ? t("firma.malarkiv.brukTeller", { antall: mal._count.copiedTo })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        oppdaterMutation.mutate({
                          id: mal.id,
                          standardForNyeProsjekter: !mal.standardForNyeProsjekter,
                        })
                      }
                      disabled={oppdaterMutation.isPending}
                      title={t("firma.malarkiv.standardHjelp")}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        mal.standardForNyeProsjekter
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Star
                        className="h-3 w-3"
                        fill={mal.standardForNyeProsjekter ? "currentColor" : "none"}
                      />
                      {mal.standardForNyeProsjekter
                        ? t("firma.malarkiv.standardPa")
                        : t("firma.malarkiv.standardAv")}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setRedigerId(mal.id)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title={t("handling.rediger")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSlettMal({ id: mal.id, navn: mal.name })}
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

      {/* Innhold redigeres i firma-modus (egen runde) — metadata her nå. */}
      <p className="mt-3 text-xs text-gray-400">{t("firma.malarkiv.redigerInnholdHint")}</p>

      {visOpprett && orgId && (
        <OpprettFirmamalDialog
          organizationId={orgId}
          fane={fane}
          onLukk={() => setVisOpprett(false)}
        />
      )}
      {redigerId && maler && (
        <RedigerFirmamalDialog
          mal={maler.find((m) => m.id === redigerId)!}
          onLukk={() => setRedigerId(null)}
        />
      )}
      {visLaan && orgId && (
        <LaanFraSentralarkivDialog
          organizationId={orgId}
          onLukk={() => setVisLaan(false)}
        />
      )}
      {slettMal && (
        <Modal open onClose={() => setSlettMal(null)} title={t("firma.malarkiv.slettTittel")}>
          <p className="text-sm text-gray-600">
            {t("firma.malarkiv.slettBekreft", { navn: slettMal.navn })}
          </p>
          <p className="mt-2 text-xs text-gray-500">{t("firma.malarkiv.slettKonsekvens")}</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSlettMal(null)}>
              {t("handling.avbryt")}
            </Button>
            <Button
              variant="danger"
              disabled={slettMutation.isPending}
              onClick={() => slettMutation.mutate({ id: slettMal.id })}
            >
              {slettMutation.isPending ? t("handling.sletter") : t("handling.slett")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OpprettFirmamalDialog — tom firmamal (innhold via firma-modus/promotering) */
/* ------------------------------------------------------------------ */

function OpprettFirmamalDialog({
  organizationId,
  fane,
  onLukk,
}: {
  organizationId: string;
  fane: Fane;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [navn, setNavn] = useState("");
  const [prefix, setPrefix] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  // Fane presetter kategori/domene. HMS-fanen gir domain=hms + subdomain-valg.
  const erHms = fane === "hms";
  const category = fane === "oppgave" ? "oppgave" : "sjekkliste";
  const domain = erHms ? "hms" : "bygg";
  const [subdomain, setSubdomain] = useState<"avvik" | "sja" | "ruh">("avvik");
  const [hmsSynlighet, setHmsSynlighet] = useState<"privat" | "apen">("apen");

  const opprettMutation = trpc.firmamal.opprett.useMutation({
    onSuccess: () => {
      utils.firmamal.list.invalidate();
      onLukk();
    },
    onError: (e) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    opprettMutation.mutate({
      organizationId,
      name: navn,
      category,
      domain,
      prefix: prefix.trim() || undefined,
      description: beskrivelse.trim() || undefined,
      ...(erHms ? { subdomain, hmsSynlighet } : {}),
    });
  }

  return (
    <Modal open onClose={onLukk} title={t("firma.malarkiv.nyFirmamal")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.malarkiv.felt.navn")}
          </label>
          <Input value={navn} onChange={(e) => setNavn(e.target.value)} autoFocus required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.malarkiv.felt.prefiks")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        {erHms && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("firma.malarkiv.felt.subdomain")}
              </label>
              <select
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value as "avvik" | "sja" | "ruh")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="avvik">{t("firma.malarkiv.subdomain.avvik")}</option>
                <option value="sja">{t("firma.malarkiv.subdomain.sja")}</option>
                <option value="ruh">{t("firma.malarkiv.subdomain.ruh")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("firma.malarkiv.felt.synlighet")}
              </label>
              <select
                value={hmsSynlighet}
                onChange={(e) => setHmsSynlighet(e.target.value as "privat" | "apen")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="apen">{t("firma.malarkiv.synlighet.apen")}</option>
                <option value="privat">{t("firma.malarkiv.synlighet.privat")}</option>
              </select>
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.malarkiv.felt.beskrivelse")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input value={beskrivelse} onChange={(e) => setBeskrivelse(e.target.value)} />
        </div>
        <p className="text-xs text-gray-500">{t("firma.malarkiv.tomMalHint")}</p>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={opprettMutation.isPending || !navn.trim()}>
            {opprettMutation.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  RedigerFirmamalDialog — metadata (innhold = firma-modus, egen runde)  */
/* ------------------------------------------------------------------ */

type FirmamalRad = {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  standardForNyeProsjekter: boolean;
};

function RedigerFirmamalDialog({
  mal,
  onLukk,
}: {
  mal: FirmamalRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [navn, setNavn] = useState(mal.name);
  const [prefix, setPrefix] = useState(mal.prefix ?? "");
  const [beskrivelse, setBeskrivelse] = useState(mal.description ?? "");
  const [standard, setStandard] = useState(mal.standardForNyeProsjekter);
  const [feil, setFeil] = useState<string | null>(null);

  const oppdaterMutation = trpc.firmamal.oppdater.useMutation({
    onSuccess: () => {
      utils.firmamal.list.invalidate();
      onLukk();
    },
    onError: (e) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    oppdaterMutation.mutate({
      id: mal.id,
      name: navn,
      prefix: prefix.trim() || null,
      description: beskrivelse.trim() || null,
      standardForNyeProsjekter: standard,
    });
  }

  return (
    <Modal open onClose={onLukk} title={t("firma.malarkiv.redigerTittel")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.malarkiv.felt.navn")}
          </label>
          <Input value={navn} onChange={(e) => setNavn(e.target.value)} autoFocus required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.malarkiv.felt.prefiks")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.malarkiv.felt.beskrivelse")}{" "}
            <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input value={beskrivelse} onChange={(e) => setBeskrivelse(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={standard}
            onChange={(e) => setStandard(e.target.checked)}
            className="h-4 w-4"
          />
          {t("firma.malarkiv.standardForNye")}
        </label>
        <p className="text-xs text-gray-400">{t("firma.malarkiv.redigerInnholdHint")}</p>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={oppdaterMutation.isPending || !navn.trim()}>
            {oppdaterMutation.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  LaanFraSentralarkivDialog — BibliotekMal → firmaarkiv                 */
/*                                                                        */
/*  «Velger ved skala»-mønsteret (L4): kollapsbare kapitler (L2), søk     */
/*  over navn+kode (L3) og inspiser-før-lån (L1) — alt uten å forlate     */
/*  dialogen. Ingen delt komponent bygges nå (fabel-vedtak 05.09); BL-    */
/*  designsaken gjenbruker spesifikasjonen, ikke koden.                   */
/* ------------------------------------------------------------------ */

const KOLLAPS_TERSKEL = 20; // >20 maler totalt → start kollapset (L2)

function LaanFraSentralarkivDialog({
  organizationId,
  onLukk,
}: {
  organizationId: string;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: standarder, isLoading } = trpc.bibliotek.hentStandarder.useQuery();
  const [laantId, setLaantId] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [sok, setSok] = useState("");
  // Kapitler brukeren har utbrettet. Kun økt-tilstand (L2) — ikke localStorage/DB.
  // null = ennå ikke initialisert fra data.
  const [utbrettede, setUtbrettede] = useState<Set<string> | null>(null);

  const laanMutation = trpc.firmamal.laanFraSentralarkiv.useMutation({
    onSuccess: () => utils.firmamal.list.invalidate(),
    onError: (e) => setFeil(e.message),
    onSettled: () => setLaantId(null),
  });

  const totaltAntall = useMemo(
    () =>
      (standarder ?? []).reduce(
        (sum, s) => sum + s.kapitler.reduce((k, kap) => k + kap.maler.length, 0),
        0,
      ),
    [standarder],
  );
  const startKollapset = totaltAntall > KOLLAPS_TERSKEL;

  // Init én gang når data er lastet: alle utbrettet hvis under terskel, ellers
  // alle kollapset. Deretter styrer brukeren selv (økt-tilstand).
  if (standarder && utbrettede === null) {
    const start = new Set<string>();
    if (!startKollapset) {
      for (const s of standarder) for (const kap of s.kapitler) start.add(kap.id);
    }
    setUtbrettede(start);
  }

  const sokNormalisert = sok.trim().toLowerCase();
  const harSok = sokNormalisert.length > 0;

  function malMatcher(bm: { navn: string; referanse: string }) {
    return (
      bm.navn.toLowerCase().includes(sokNormalisert) ||
      bm.referanse.toLowerCase().includes(sokNormalisert)
    );
  }

  function toggleKapittel(id: string) {
    setUtbrettede((prev) => {
      const neste = new Set(prev ?? []);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  function laan(bibliotekMalId: string) {
    setLaantId(bibliotekMalId);
    setFeil(null);
    laanMutation.mutate({ organizationId, bibliotekMalId });
  }

  // Filtrer per søk: behold kun matchende maler, og skjul kapitler uten treff.
  const synligeStandarder = (standarder ?? [])
    .map((standard) => ({
      ...standard,
      kapitler: standard.kapitler
        .map((kap) => ({
          ...kap,
          synligeMaler: harSok ? kap.maler.filter(malMatcher) : kap.maler,
        }))
        .filter((kap) => !harSok || kap.synligeMaler.length > 0),
    }))
    .filter((s) => s.kapitler.length > 0);

  return (
    <Modal open onClose={onLukk} title={t("firma.malarkiv.laanTittel")} className="max-w-2xl">
      <p className="mb-3 text-sm text-gray-600">{t("firma.malarkiv.laanBeskrivelse")}</p>

      {/* Søk (L3) */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          placeholder={t("firma.malarkiv.laanSokPlassholder")}
          className="pl-9"
        />
      </div>

      {feil && <p className="mb-3 text-sm text-red-600">{feil}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : synligeStandarder.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {harSok ? t("firma.malarkiv.laanIngenTreff") : t("firma.malarkiv.laanTomt")}
        </p>
      ) : (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {synligeStandarder.map((standard) => (
            <div key={standard.id}>
              <h3 className="mb-1 text-sm font-semibold text-gray-800">
                {standard.kode} — {standard.navn}
              </h3>
              <div className="space-y-1">
                {standard.kapitler.map((kap) => {
                  // Søk auto-utbretter treff (L3); ellers økt-tilstanden (L2).
                  const apen = harSok || (utbrettede?.has(kap.id) ?? false);
                  return (
                    <div key={kap.id} className="rounded border border-gray-100">
                      <button
                        type="button"
                        onClick={() => !harSok && toggleKapittel(kap.id)}
                        disabled={harSok}
                        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        {apen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        )}
                        <span>
                          {kap.kode} {kap.navn}
                        </span>
                        <span className="text-gray-400">· {kap.synligeMaler.length}</span>
                      </button>
                      {apen && (
                        <ul className="space-y-1 px-2 pb-2">
                          {kap.synligeMaler.map((bm) => (
                            <MalRad
                              key={bm.id}
                              bm={bm}
                              laaner={laanMutation.isPending && laantId === bm.id}
                              onLaan={() => laan(bm.id)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onLukk}>
          {t("handling.lukk")}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  MalRad — én sentralmal i lån-dialogen, med inspiser-før-lån (L1)      */
/* ------------------------------------------------------------------ */

function MalRad({
  bm,
  laaner,
  onLaan,
}: {
  bm: { id: string; navn: string; referanse: string; verifisert: boolean };
  laaner: boolean;
  onLaan: () => void;
}) {
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);
  // Lazy: feltinnhold hentes først når forhåndsvisningen åpnes — aldri eager
  // for alle maler (skala-regelen, AM4b gate-funn).
  const { data: innhold, isLoading } = trpc.bibliotek.hentMalInnhold.useQuery(
    { bibliotekMalId: bm.id },
    { enabled: apen },
  );

  const laanKnapp = (
    <Button variant="secondary" onClick={onLaan} disabled={laaner}>
      {laaner ? t("firma.malarkiv.laaner") : t("firma.malarkiv.laanKnapp")}
    </Button>
  );

  return (
    <li className="rounded border border-gray-100">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setApen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={apen}
          title={apen ? t("firma.malarkiv.inspiserSkjul") : t("firma.malarkiv.inspiserVis")}
        >
          {apen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          )}
          <span className="truncate text-sm text-gray-700">
            {bm.navn} <span className="text-gray-400">{bm.referanse}</span>
          </span>
        </button>
        {!bm.verifisert && (
          <span
            className="inline-flex shrink-0 items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
            title={t("bibliotek.utkastForklaring")}
          >
            {t("bibliotek.utkastBadge")}
          </span>
        )}
        {laanKnapp}
      </div>
      {apen && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
          {isLoading ? (
            <div className="flex justify-center py-2">
              <Spinner />
            </div>
          ) : !innhold || innhold.felter.length === 0 ? (
            <p className="text-xs text-gray-500">{t("firma.malarkiv.inspiserTomt")}</p>
          ) : (
            <FeltForhandsvisning felter={innhold.felter} />
          )}
          <div className="mt-2 flex justify-end">{laanKnapp}</div>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  FeltForhandsvisning — read-only feltliste, i rekkefølge, per fase     */
/* ------------------------------------------------------------------ */

function FeltForhandsvisning({
  felter,
}: {
  felter: { label: string; type: string; fase: string | null }[];
}) {
  const { t } = useTranslation();
  const faseEtikett: Record<string, string> = {
    FØR: t("firma.malarkiv.fase.for"),
    UNDER: t("firma.malarkiv.fase.under"),
    ETTER: t("firma.malarkiv.fase.etter"),
  };

  // Grupper som lån-mutasjonen bygger malen: faser i første-forekomst-rekkefølge,
  // felt uten fase til slutt. Forhåndsvisningen speiler dermed resultatet av lån.
  const faser = [...new Set(felter.map((f) => f.fase).filter(Boolean))] as string[];
  const grupper: { fase: string | null; felter: typeof felter }[] = faser.map((fase) => ({
    fase,
    felter: felter.filter((f) => f.fase === fase),
  }));
  const utenFase = felter.filter((f) => !f.fase);
  if (utenFase.length > 0) grupper.push({ fase: null, felter: utenFase });

  return (
    <div className="space-y-2">
      {grupper.map((g, i) => (
        <div key={i}>
          {g.fase && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {faseEtikett[g.fase] ?? g.fase}
            </p>
          )}
          <ol className="space-y-0.5">
            {g.felter.map((f, j) => {
              const typeNokkel = felttypeNokler[f.type];
              return (
                <li key={j} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-gray-700">{f.label}</span>
                  <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {typeNokkel ? t(typeNokkel) : f.type}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
