"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Button, Input, Modal, SearchInput } from "@sitedoc/ui";
import { Building2, Plus, Pencil, Search } from "lucide-react";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { useTranslation } from "react-i18next";
import { ModulPiller, FirmaStatusBadge, formaterSistAktivitet } from "./delte-komponenter";
import type { FirmaStatus } from "@sitedoc/api/src/services/firmaOversikt";

// Smal lokal type bryter generic-kjeden — kun feltene lista bruker.
type FirmaRadData = {
  id: string;
  name: string;
  organizationNumber: string | null;
  ehfEnabled: boolean;
  status: FirmaStatus;
  aktiveFirmamoduler: string[];
  users: Array<{ id: string }>;
  prosjekterAktive: number;
  prosjekterTotalt: number;
  sistAktivitet: string | Date | null;
};

export default function AdminFirmaer() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const orgQuery = trpc.admin.hentAlleOrganisasjoner.useQuery();
  const organisasjoner = orgQuery.data as FirmaRadData[] | undefined;
  const isLoading = orgQuery.isLoading;

  const [sok, setSok] = useState("");

  // Opprett firma
  const [visOpprett, setVisOpprett] = useState(false);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyttOrgNr, setNyttOrgNr] = useState("");
  const [brregFeil, setBrregFeil] = useState<string | null>(null);
  const [opprettFeil, setOpprettFeil] = useState<string | null>(null);

  // Rediger firma
  const [redigerOrg, setRedigerOrg] = useState<{ id: string } | null>(null);
  const [redigertNavn, setRedigertNavn] = useState("");
  const [redigertOrgNr, setRedigertOrgNr] = useState("");

  const nyttOrgNrRenset = nyttOrgNr.replace(/\s/g, "");
  const nyttOrgNrErNiSiffer = /^\d{9}$/.test(nyttOrgNrRenset);
  const brregOppslag = trpc.organisasjon.hentFraBrreg.useQuery(
    { orgnr: nyttOrgNrRenset },
    { enabled: false, retry: false },
  );

  async function hentFraBrreg() {
    setBrregFeil(null);
    const resultat = await brregOppslag.refetch();
    if (resultat.error) {
      setBrregFeil(resultat.error.message);
      return;
    }
    if (resultat.data) setNyttNavn(resultat.data.navn);
  }

  const opprettMutasjon = trpc.admin.opprettOrganisasjon.useMutation({
    onSuccess: () => {
      utils.admin.hentAlleOrganisasjoner.invalidate();
      setVisOpprett(false);
      setNyttNavn("");
      setNyttOrgNr("");
      setOpprettFeil(null);
    },
    onError: (error) => setOpprettFeil(error.message),
  });

  const oppdaterOrgMutasjon = trpc.admin.oppdaterOrganisasjon.useMutation({
    onSuccess: () => {
      utils.admin.hentAlleOrganisasjoner.invalidate();
      setRedigerOrg(null);
    },
  });

  // Client-side søk holder < 100 firmaer (fabel-gatet §7.1). Server-side
  // vurderes hvis firmatallet vokser forbi det.
  const filtrerte = useMemo(() => {
    if (!organisasjoner) return [];
    const q = sok.trim().toLowerCase();
    if (!q) return organisasjoner;
    return organisasjoner.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.organizationNumber ?? "").toLowerCase().includes(q),
    );
  }, [organisasjoner, sok]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {t("admin.firmaer.tittel")}
          {organisasjoner && (
            <span className="ml-2 text-sm font-normal text-gray-400">({organisasjoner.length})</span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("admin.firmaer.opprettFirma")}
          </Button>
          <HjelpKnapp>
            <HjelpFane tittel={t("hjelp.firmaer.hvaTittel")}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">{t("hjelp.firmaer.hva")}</p>
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 px-4 py-3">
                    <h4 className="text-sm font-semibold text-gray-900">{t("hjelp.firmaer.prosjekterTittel")}</h4>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.firmaer.prosjekterBeskrivelse")}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 px-4 py-3">
                    <h4 className="text-sm font-semibold text-gray-900">{t("hjelp.firmaer.integrasjonerTittel")}</h4>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.firmaer.integrasjonerBeskrivelse")}</p>
                  </div>
                </div>
              </div>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </div>

      {!organisasjoner || organisasjoner.length === 0 ? (
        <EmptyState title={t("admin.firmaer.ingenTittel")} description={t("admin.firmaer.ingenBeskrivelse")} />
      ) : (
        <>
          <div className="mb-3 max-w-sm">
            <SearchInput verdi={sok} onChange={setSok} placeholder={t("admin.firmaer.sokPlaceholder")} />
          </div>

          {filtrerte.length === 0 ? (
            <EmptyState title={t("admin.firmaer.ingenTreffTittel")} description={t("admin.firmaer.ingenTreffBeskrivelse", { q: sok })} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tabell.firma")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">{t("tabell.status")}</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 w-20">{t("admin.firmaer.kolBrukere")}</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 w-28">{t("admin.firmaer.kolProsjekter")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">{t("admin.firmaer.kolModuler")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">{t("admin.firmaer.kolSistAktivitet")}</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrerte.map((org) => (
                    <tr
                      key={org.id}
                      className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      onClick={() => router.push(`/dashbord/admin/firmaer/${org.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
                            <Building2 className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{org.name}</span>
                              {org.ehfEnabled && (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                                  {t("admin.firmaer.ehf")}
                                </span>
                              )}
                            </div>
                            {org.organizationNumber && (
                              <div className="text-xs text-gray-400">{t("admin.firmaer.orgNrPrefiks")}: {org.organizationNumber}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <FirmaStatusBadge status={org.status} label={t(`admin.firmaer.status.${org.status}`)} />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{org.users.length}</td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        <span className="font-medium text-gray-900">{org.prosjekterAktive}</span>
                        <span className="text-gray-400"> / {org.prosjekterTotalt}</span>
                      </td>
                      <td className="px-4 py-3">
                        <ModulPiller aktiveFirmamoduler={org.aktiveFirmamoduler} storrelse="xs" />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formaterSistAktivitet(org.sistAktivitet, i18n.language, "—")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRedigerOrg({ id: org.id });
                            setRedigertNavn(org.name);
                            setRedigertOrgNr(org.organizationNumber ?? "");
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title={t("admin.firmaer.redigerFirma")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Opprett firma-modal */}
      <Modal open={visOpprett} onClose={() => setVisOpprett(false)} title={t("admin.firmaer.opprettFirma")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpprettFeil(null);
            opprettMutasjon.mutate({ name: nyttNavn, organizationNumber: nyttOrgNr || undefined });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("admin.firmaer.orgNrValgfritt")}</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={nyttOrgNr}
                onChange={(e) => {
                  setNyttOrgNr(e.target.value);
                  setBrregFeil(null);
                }}
                placeholder="123 456 789"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={hentFraBrreg}
                disabled={!nyttOrgNrErNiSiffer || brregOppslag.isFetching}
                title={!nyttOrgNrErNiSiffer ? t("brreg.hint") : undefined}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {brregOppslag.isFetching ? t("brreg.henter") : t("brreg.hent")}
              </button>
            </div>
            {brregFeil && <p className="mt-1 text-xs text-red-500">{brregFeil}</p>}
          </div>
          <Input label={t("admin.firmaer.firmanavn")} value={nyttNavn} onChange={(e) => setNyttNavn(e.target.value)} required />
          {opprettFeil && <p className="text-xs text-red-500">{opprettFeil}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVisOpprett(false)}>{t("handling.avbryt")}</Button>
            <Button type="submit" disabled={!nyttNavn || opprettMutasjon.isPending}>{t("handling.opprett")}</Button>
          </div>
        </form>
      </Modal>

      {/* Rediger firma-modal */}
      <Modal open={!!redigerOrg} onClose={() => setRedigerOrg(null)} title={t("admin.firmaer.redigerFirma")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!redigerOrg) return;
            oppdaterOrgMutasjon.mutate({
              id: redigerOrg.id,
              name: redigertNavn,
              organizationNumber: redigertOrgNr || null,
            });
          }}
          className="space-y-4"
        >
          <Input label={t("admin.firmaer.firmanavn")} value={redigertNavn} onChange={(e) => setRedigertNavn(e.target.value)} required />
          <Input label={t("admin.firmaer.orgNrValgfritt")} value={redigertOrgNr} onChange={(e) => setRedigertOrgNr(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRedigerOrg(null)}>{t("handling.avbryt")}</Button>
            <Button type="submit" disabled={!redigertNavn || oppdaterOrgMutasjon.isPending}>{t("handling.lagre")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
