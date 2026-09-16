"use client";

import Link from "next/link";
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
  RefreshCw,
} from "lucide-react";
import { Nivaabanner } from "@/components/nivaa/Nivaabanner";
import { felttypeNokler } from "@/components/malbygger/PalettElement";
import {
  byggSitedocGrupper,
  byggUnderkapittelBlokker,
} from "@/components/bibliotek/arkiv-fane-filter";

/**
 * Firmaarkiv-fanen i Malforvaltning (ordre PR 2 Del A). Flyttet fra den revne ruta
 * `/dashbord/firma/malarkiv`. Kenneth-vedtak 15.09: L9-adskillingen tapes ikke — den
 * flyttes fra faner til KOLONNE + FILTER. Derfor ÉN liste (ikke tre faner) med en
 * filtrerbar MALTYPE-kolonne. Innhold redigeres i firma-modus via nabo-ruta `./[malId]`.
 *
 * Gatingen ligger i flaten over (`gateMalforvaltningFaner`): fanen vises kun for
 * `kanAdministrereFirma`. `organizationId` kommer inn som prop fra siden (valgt firma).
 */

type Maltype = "sjekkliste" | "oppgave" | "hms";
const MALTYPER: Maltype[] = ["sjekkliste", "oppgave", "hms"];

/** Avled maltype fra kategori/domene (samme akse som `faneWhere` server-side, L9). */
function malType(m: { category: string; domain: string }): Maltype {
  if (m.domain === "hms") return "hms";
  return m.category === "oppgave" ? "oppgave" : "sjekkliste";
}

export function FirmaarkivFane({ organizationId }: { organizationId: string }) {
  const { t, i18n } = useTranslation();

  const [typeFilter, setTypeFilter] = useState<Maltype | "alle">("alle");
  const [sok, setSok] = useState("");
  const [visOpprett, setVisOpprett] = useState(false);
  const [visLaan, setVisLaan] = useState(false);
  const [redigerId, setRedigerId] = useState<string | null>(null);
  const [slettMal, setSlettMal] = useState<{ id: string; navn: string; brukt: number } | null>(
    null,
  );
  const [oppdaterArkivMal, setOppdaterArkivMal] = useState<{ id: string; navn: string } | null>(
    null,
  );

  const utils = trpc.useUtils();
  // Én liste: hent ALLE firmamaler (ingen fane-parameter), filtrer maltype i klienten.
  const { data: maler, isLoading } = trpc.firmamal.list.useQuery({ organizationId });

  const oppdaterMutation = trpc.firmamal.oppdater.useMutation({
    onSuccess: () => utils.firmamal.list.invalidate(),
  });
  const slettMutation = trpc.firmamal.slett.useMutation({
    onSuccess: () => {
      utils.firmamal.list.invalidate();
      setSlettMal(null);
    },
  });
  const oppdaterFraArkivMutation = trpc.firmamal.oppdaterFraSentralarkiv.useMutation({
    onSuccess: () => {
      utils.firmamal.list.invalidate();
      setOppdaterArkivMal(null);
    },
  });

  // Hvilke sentralmaler firmaet ALT har lånt (Krav 2). Gjenbruker tabellens data —
  // ingen ny query. Server-vakten (CONFLICT) er den fulle gaten på tvers.
  const alleredeLaantIder = useMemo(
    () =>
      new Set(
        (maler ?? []).map((m) => m.laantFraBibliotekMalId).filter((x): x is string => !!x),
      ),
    [maler],
  );

  const sokNorm = sok.trim().toLowerCase();
  const synlige = useMemo(
    () =>
      (maler ?? []).filter((m) => {
        if (typeFilter !== "alle" && malType(m) !== typeFilter) return false;
        if (sokNorm && !m.name.toLowerCase().includes(sokNorm)) return false;
        return true;
      }),
    [maler, typeFilter, sokNorm],
  );

  function formatDato(iso: string | Date) {
    return new Date(iso).toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <Nivaabanner nivaa="firma" kontekst="liste" />

      {/* Verktøylinje: søk + maltype-filter + opprett/lån */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder={t("malforvaltning.firmaarkiv.sokPlassholder")}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as Maltype | "alle")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label={t("malforvaltning.firmaarkiv.kolonne.maltype")}
        >
          <option value="alle">{t("malforvaltning.firmaarkiv.alleTyper")}</option>
          {MALTYPER.map((mt) => (
            <option key={mt} value={mt}>
              {t(`malforvaltning.firmaarkiv.maltype.${mt}`)}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => setVisLaan(true)}>
          <Library className="mr-1.5 h-4 w-4" />
          {t("firma.malarkiv.laanFraSentralarkiv")}
        </Button>
        <Button onClick={() => setVisOpprett(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("firma.malarkiv.nyFirmamal")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : synlige.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">
              {sokNorm || typeFilter !== "alle"
                ? t("malforvaltning.firmaarkiv.ingenTreff")
                : t("malforvaltning.firmaarkiv.ingen")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">{t("firma.malarkiv.kolonne.navn")}</th>
                  <th className="px-4 py-3">{t("malforvaltning.firmaarkiv.kolonne.maltype")}</th>
                  <th className="px-4 py-3">{t("malforvaltning.firmaarkiv.kolonne.opphav")}</th>
                  <th className="px-4 py-3">{t("firma.malarkiv.kolonne.standard")}</th>
                  <th className="px-4 py-3">{t("malforvaltning.firmaarkiv.kolonne.sistEndret")}</th>
                  <th className="px-4 py-3 text-right">
                    {t("firma.malarkiv.kolonne.handlinger")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {synlige.map((mal) => (
                  <tr key={mal.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashbord/firma/innstillinger/malforvaltning/${mal.id}`}
                        className="font-medium text-gray-900 hover:text-sitedoc-primary hover:underline"
                        title={t("firma.malarkiv.redigerInnhold")}
                      >
                        {mal.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t(`malforvaltning.firmaarkiv.maltype.${malType(mal)}`)}
                    </td>
                    <td className="px-4 py-3">
                      {mal.laantFraBibliotekMalId ? (
                        <Badge variant="default">{t("firma.malarkiv.badge.laant")}</Badge>
                      ) : (
                        <span className="text-gray-500">
                          {t("malforvaltning.firmaarkiv.opphav.egen")}
                        </span>
                      )}
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
                    <td className="px-4 py-3 text-gray-500">{formatDato(mal.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {mal.laantFraBibliotekMalId && (
                          <button
                            onClick={() => setOppdaterArkivMal({ id: mal.id, navn: mal.name })}
                            className="rounded p-1.5 text-gray-500 hover:bg-sitedoc-primary/10 hover:text-sitedoc-primary"
                            title={t("firma.malarkiv.oppdaterFraArkiv")}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setRedigerId(mal.id)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          title={t("handling.rediger")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setSlettMal({
                              id: mal.id,
                              navn: mal.name,
                              brukt: mal._count.copiedTo,
                            })
                          }
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
        <p className="mt-3 text-xs text-gray-400">{t("firma.malarkiv.redigerInnholdHint")}</p>
      </div>

      {visOpprett && (
        <OpprettFirmamalDialog
          organizationId={organizationId}
          forvalgtType={typeFilter === "alle" ? "sjekkliste" : typeFilter}
          onLukk={() => setVisOpprett(false)}
        />
      )}
      {redigerId && maler && (
        <RedigerFirmamalDialog
          mal={maler.find((m) => m.id === redigerId)!}
          onLukk={() => setRedigerId(null)}
        />
      )}
      {visLaan && (
        <LaanFraSentralarkivDialog
          organizationId={organizationId}
          alleredeLaantIder={alleredeLaantIder}
          onLukk={() => setVisLaan(false)}
        />
      )}
      {oppdaterArkivMal && (
        <Modal
          open
          onClose={() => setOppdaterArkivMal(null)}
          title={t("firma.malarkiv.oppdaterFraArkivTittel")}
        >
          <p className="text-sm text-gray-600">
            {t("firma.malarkiv.oppdaterFraArkivBekreft", { navn: oppdaterArkivMal.navn })}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {t("firma.malarkiv.oppdaterFraArkivKonsekvens")}
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOppdaterArkivMal(null)}>
              {t("handling.avbryt")}
            </Button>
            <Button
              disabled={oppdaterFraArkivMutation.isPending}
              onClick={() => oppdaterFraArkivMutation.mutate({ id: oppdaterArkivMal.id })}
            >
              {oppdaterFraArkivMutation.isPending
                ? t("firma.malarkiv.oppdaterer")
                : t("firma.malarkiv.oppdaterFraArkivKnapp")}
            </Button>
          </div>
        </Modal>
      )}
      {slettMal && (
        <Modal open onClose={() => setSlettMal(null)} title={t("firma.malarkiv.slettTittel")}>
          <p className="text-sm text-gray-600">
            {t("firma.malarkiv.slettBekreft", { navn: slettMal.navn })}
          </p>
          {/* Permanent i dag — ingen papirkurv for firmamaler (TILLEGG 1 § 2). Klartekst. */}
          <p className="mt-2 text-sm font-medium text-red-700">
            {t("malforvaltning.firmaarkiv.slettPermanent")}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {slettMal.brukt > 0
              ? t("malforvaltning.firmaarkiv.slettBrukt", { antall: slettMal.brukt })
              : t("firma.malarkiv.slettKonsekvens")}
          </p>
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
/*  OpprettFirmamalDialog — tom firmamal med maltype-valg (ingen fane)    */
/* ------------------------------------------------------------------ */

function OpprettFirmamalDialog({
  organizationId,
  forvalgtType,
  onLukk,
}: {
  organizationId: string;
  forvalgtType: Maltype;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [navn, setNavn] = useState("");
  const [prefix, setPrefix] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [maltype, setMaltype] = useState<Maltype>(forvalgtType);
  const [subdomain, setSubdomain] = useState<"avvik" | "sja" | "ruh">("avvik");
  const [hmsSynlighet, setHmsSynlighet] = useState<"privat" | "apen">("apen");
  const [feil, setFeil] = useState<string | null>(null);

  // Maltype presetter kategori/domene. HMS gir domain=hms + subdomain-valg.
  const erHms = maltype === "hms";
  const category = maltype === "oppgave" ? "oppgave" : "sjekkliste";
  const domain = erHms ? "hms" : "bygg";

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
            {t("malforvaltning.firmaarkiv.kolonne.maltype")}
          </label>
          <select
            value={maltype}
            onChange={(e) => setMaltype(e.target.value as Maltype)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {MALTYPER.map((mt) => (
              <option key={mt} value={mt}>
                {t(`malforvaltning.firmaarkiv.maltype.${mt}`)}
              </option>
            ))}
          </select>
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
/*  RedigerFirmamalDialog — metadata (innhold = firma-modus, egen rute)   */
/* ------------------------------------------------------------------ */

type FirmamalRad = {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  standardForNyeProsjekter: boolean;
};

function RedigerFirmamalDialog({ mal, onLukk }: { mal: FirmamalRad; onLukk: () => void }) {
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
/*  dialogen.                                                             */
/* ------------------------------------------------------------------ */

const KOLLAPS_TERSKEL = 20; // >20 maler totalt → start kollapset (L2)

function LaanFraSentralarkivDialog({
  organizationId,
  alleredeLaantIder,
  onLukk,
}: {
  organizationId: string;
  alleredeLaantIder: Set<string>;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: standarder, isLoading } = trpc.bibliotek.hentStandarder.useQuery();
  const [laantId, setLaantId] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [sok, setSok] = useState("");
  // Standarder (Kenneths «kapittel») brukeren har utbrettet. null = ennå ikke initialisert.
  const [utbrettede, setUtbrettede] = useState<Set<string> | null>(null);
  // Underkapittel-overskrifter (>= terskel) starter ÅPNE (vedtak a) — settet holder de lukkede.
  const [lukkedeUnder, setLukkedeUnder] = useState<Set<string>>(new Set());

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

  // Standard-nivå (Kenneths «kapittel»): default utbrettet med mindre >20 maler totalt.
  if (standarder && utbrettede === null) {
    const start = new Set<string>();
    if (!startKollapset) for (const s of standarder) start.add(s.kode);
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

  function toggleStandard(key: string) {
    setUtbrettede((prev) => {
      const neste = new Set(prev ?? []);
      if (neste.has(key)) neste.delete(key);
      else neste.add(key);
      return neste;
    });
  }

  function toggleUnder(key: string) {
    setLukkedeUnder((prev) => {
      const neste = new Set(prev);
      if (neste.has(key)) neste.delete(key);
      else neste.add(key);
      return neste;
    });
  }

  function laan(bibliotekMalId: string) {
    setLaantId(bibliotekMalId);
    setFeil(null);
    laanMutation.mutate({ organizationId, bibliotekMalId });
  }

  // Sortert/annotert per standard (samme primitiv som «Hent fra arkiv»), så søk-filtrert.
  const synligeGrupper = byggSitedocGrupper(standarder ?? [], undefined)
    .map((g) => ({ ...g, maler: harSok ? g.maler.filter(malMatcher) : g.maler }))
    .filter((g) => g.maler.length > 0);

  return (
    <Modal open onClose={onLukk} title={t("firma.malarkiv.laanTittel")} className="max-w-2xl">
      <p className="mb-3 text-sm text-gray-600">{t("firma.malarkiv.laanBeskrivelse")}</p>

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
      ) : synligeGrupper.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {harSok ? t("firma.malarkiv.laanIngenTreff") : t("firma.malarkiv.laanTomt")}
        </p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {synligeGrupper.map((g) => {
            const apenStandard = harSok || (utbrettede?.has(g.key) ?? false);
            const malRad = (bm: {
              id: string;
              navn: string;
              referanse: string;
              verifisert: boolean;
            }) => (
              <MalRad
                key={bm.id}
                bm={bm}
                alleredeLaant={alleredeLaantIder.has(bm.id)}
                laaner={laanMutation.isPending && laantId === bm.id}
                onLaan={() => laan(bm.id)}
              />
            );
            return (
              <div key={g.key} className="rounded border border-gray-100">
                {/* Kollaps på standard (Kenneths «kapittel») — eneste faste overskrift */}
                <button
                  type="button"
                  onClick={() => !harSok && toggleStandard(g.key)}
                  disabled={harSok}
                  className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  {apenStandard ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{g.tittel}</span>
                  <span className="shrink-0 font-normal text-gray-400">· {g.maler.length}</span>
                </button>
                {apenStandard && (
                  <div className="space-y-1 px-2 pb-2">
                    {byggUnderkapittelBlokker(g.maler, g.key).map((blokk) => {
                      // Løse maler (underkapittel < terskel) — ingen overskrift.
                      if (blokk.type === "lose") {
                        return (
                          <ul key={`lose-${blokk.maler[0]?.id}`} className="space-y-1">
                            {blokk.maler.map(malRad)}
                          </ul>
                        );
                      }
                      // >= terskel → kollapsbar underkapittel-overskrift, default åpen.
                      const apenUnder = harSok || !lukkedeUnder.has(blokk.key);
                      return (
                        <div key={blokk.key} className="rounded border border-gray-100">
                          <button
                            type="button"
                            onClick={() => !harSok && toggleUnder(blokk.key)}
                            disabled={harSok}
                            className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
                          >
                            {apenUnder ? (
                              <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {blokk.kode} — {blokk.navn}
                            </span>
                            <span className="shrink-0 text-gray-400">· {blokk.maler.length}</span>
                          </button>
                          {apenUnder && (
                            <ul className="space-y-1 px-2 pb-2">{blokk.maler.map(malRad)}</ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
  alleredeLaant,
  laaner,
  onLaan,
}: {
  bm: { id: string; navn: string; referanse: string; verifisert: boolean };
  alleredeLaant: boolean;
  laaner: boolean;
  onLaan: () => void;
}) {
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);
  const { data: innhold, isLoading } = trpc.bibliotek.hentMalInnhold.useQuery(
    { bibliotekMalId: bm.id },
    { enabled: apen },
  );

  const laanKnapp = alleredeLaant ? (
    <span
      className="inline-flex shrink-0 items-center rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500"
      title={t("firma.malarkiv.alleredeLaantHjelp")}
    >
      {t("firma.malarkiv.alleredeLaant")}
    </span>
  ) : (
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
