"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Spinner, Button, Input, Modal } from "@sitedoc/ui";
import { Building2, ArrowLeft, Plus, Pencil, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { FirmaStatusBadge } from "../delte-komponenter";
import type { FirmaStatus } from "@sitedoc/api/src/services/firmaOversikt";
import { ProsjekterFane } from "./ProsjekterFane";
import { BrukereFane } from "./BrukereFane";
import { ModulerFane } from "./ModulerFane";
import { FaktureringFane } from "./FaktureringFane";
import { InnstillingerFane } from "./InnstillingerFane";

type FaneKey = "prosjekter" | "brukere" | "moduler" | "fakturering" | "innstillinger";

type FirmaDetalj = {
  id: string;
  name: string;
  organizationNumber: string | null;
  invoiceAddress: string | null;
  invoiceEmail: string | null;
  ehfEnabled: boolean;
  erKunde: boolean;
  status: FirmaStatus;
  prosjektTellekort: { aktive: number; fullfortArkivert: number; deaktivert: number };
  brukere: Array<{
    id: string;
    ansattRolle: string;
    firmaRoller: string[];
    user: { id: string; name: string | null; email: string; role: string } | null;
  }>;
  moduler: Array<{ moduleSlug: string; status: string; aktivertVed: string | Date; deaktivertVed: string | Date | null }>;
  innstillinger: {
    timezone: string;
    dagsnorm: number;
    timerTilgangDefault: string;
    vareforbrukTilgangDefault: string;
    maskinbrukTilgangDefault: string;
  } | null;
};

export default function FirmaDetaljSide() {
  const { t } = useTranslation();
  const params = useParams();
  const organizationId = params.id as string;
  const utils = trpc.useUtils();

  const detaljQuery = trpc.admin.hentFirmaDetalj.useQuery({ organizationId });
  const firma = detaljQuery.data as FirmaDetalj | undefined;

  const [aktivFane, setAktivFane] = useState<FaneKey>("prosjekter");

  // Rediger firma
  const [visRediger, setVisRediger] = useState(false);
  const [redigertNavn, setRedigertNavn] = useState("");
  const [redigertOrgNr, setRedigertOrgNr] = useState("");

  // Opprett prosjekt (prefylt org)
  const [visOpprett, setVisOpprett] = useState(false);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyBeskrivelse, setNyBeskrivelse] = useState("");

  const oppdaterMutasjon = trpc.admin.oppdaterOrganisasjon.useMutation({
    onSuccess: () => {
      utils.admin.hentFirmaDetalj.invalidate({ organizationId });
      utils.admin.hentAlleOrganisasjoner.invalidate();
      setVisRediger(false);
    },
  });

  const opprettProsjektMutasjon = trpc.admin.opprettProsjekt.useMutation({
    onSuccess: () => {
      utils.admin.hentFirmaDetalj.invalidate({ organizationId });
      utils.admin.hentProsjekterForFirma.invalidate({ organizationId });
      setVisOpprett(false);
      setNyttNavn("");
      setNyBeskrivelse("");
    },
  });

  if (detaljQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!firma) {
    return (
      <div>
        <Link href="/dashbord/admin/firmaer" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          {t("admin.firmaDetalj.tilbake")}
        </Link>
        <p className="text-sm text-gray-500">{t("admin.firmaDetalj.ikkeFunnet")}</p>
      </div>
    );
  }

  const faner: { key: FaneKey; label: string }[] = [
    { key: "prosjekter", label: t("admin.firmaDetalj.fane.prosjekter") },
    { key: "brukere", label: t("admin.firmaDetalj.fane.brukere") },
    { key: "moduler", label: t("admin.firmaDetalj.fane.moduler") },
    { key: "fakturering", label: t("admin.firmaDetalj.fane.fakturering") },
    { key: "innstillinger", label: t("admin.firmaDetalj.fane.innstillinger") },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/dashbord/admin/firmaer" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          {t("admin.firmaDetalj.tilbake")}
        </Link>
        <HjelpKnapp>
          <HjelpFane tittel={t("hjelp.firmaDetalj.hvaTittel")}>
            <p className="text-sm text-gray-600">{t("hjelp.firmaDetalj.hva")}</p>
          </HjelpFane>
        </HjelpKnapp>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{firma.name}</h1>
              <FirmaStatusBadge status={firma.status} label={t(`admin.firmaer.status.${firma.status}`)} />
              {firma.ehfEnabled && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                  {t("admin.firmaer.ehf")}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              {firma.organizationNumber && <span>{t("admin.firmaer.orgNrPrefiks")}: {firma.organizationNumber}</span>}
              {firma.invoiceEmail && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {firma.invoiceEmail}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRedigertNavn(firma.name);
              setRedigertOrgNr(firma.organizationNumber ?? "");
              setVisRediger(true);
            }}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            {t("admin.firmaDetalj.redigerFirma")}
          </Button>
          <Button size="sm" onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("admin.firmaDetalj.opprettProsjekt")}
          </Button>
        </div>
      </div>

      {/* Faner */}
      <div className="mb-5 border-b border-gray-200">
        <nav className="-mb-px flex gap-5">
          {faner.map((f) => (
            <button
              key={f.key}
              onClick={() => setAktivFane(f.key)}
              className={`border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
                aktivFane === f.key
                  ? "border-amber-500 text-amber-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>
      </div>

      {aktivFane === "prosjekter" && (
        <ProsjekterFane organizationId={organizationId} tellekort={firma.prosjektTellekort} />
      )}
      {aktivFane === "brukere" && <BrukereFane brukere={firma.brukere} />}
      {aktivFane === "moduler" && <ModulerFane moduler={firma.moduler} />}
      {aktivFane === "fakturering" && (
        <FaktureringFane
          invoiceAddress={firma.invoiceAddress}
          invoiceEmail={firma.invoiceEmail}
          ehfEnabled={firma.ehfEnabled}
          moduler={firma.moduler}
        />
      )}
      {aktivFane === "innstillinger" && (
        <InnstillingerFane organizationId={organizationId} innstillinger={firma.innstillinger} />
      )}

      {/* Rediger firma-modal */}
      <Modal open={visRediger} onClose={() => setVisRediger(false)} title={t("admin.firmaDetalj.redigerFirma")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            oppdaterMutasjon.mutate({
              id: organizationId,
              name: redigertNavn,
              organizationNumber: redigertOrgNr || null,
            });
          }}
          className="space-y-4"
        >
          <Input label={t("admin.firmaer.firmanavn")} value={redigertNavn} onChange={(e) => setRedigertNavn(e.target.value)} required />
          <Input label={t("admin.firmaer.orgNrValgfritt")} value={redigertOrgNr} onChange={(e) => setRedigertOrgNr(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVisRediger(false)}>{t("handling.avbryt")}</Button>
            <Button type="submit" disabled={!redigertNavn || oppdaterMutasjon.isPending}>{t("handling.lagre")}</Button>
          </div>
        </form>
      </Modal>

      {/* Opprett prosjekt-modal (org prefylt) */}
      <Modal open={visOpprett} onClose={() => setVisOpprett(false)} title={t("admin.firmaDetalj.opprettProsjekt")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            opprettProsjektMutasjon.mutate({
              name: nyttNavn,
              description: nyBeskrivelse || undefined,
              organizationId,
            });
          }}
          className="space-y-4"
        >
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {t("admin.firmaDetalj.opprettProsjektFirma", { firma: firma.name })}
          </p>
          <Input label={t("admin.firmaDetalj.prosjektnavn")} value={nyttNavn} onChange={(e) => setNyttNavn(e.target.value)} required />
          <Input label={t("admin.firmaDetalj.beskrivelseValgfritt")} value={nyBeskrivelse} onChange={(e) => setNyBeskrivelse(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVisOpprett(false)}>{t("handling.avbryt")}</Button>
            <Button type="submit" disabled={!nyttNavn || opprettProsjektMutasjon.isPending}>{t("handling.opprett")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
