"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { Spinner, Button, Input, EmptyState } from "@sitedoc/ui";
import { Building2, Pencil } from "lucide-react";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";

export default function FirmaInnstillinger() {
  useToppbarFiltre({ byggeplass: false });
  const utils = trpc.useUtils();
  const { prosjektId } = useProsjekt();
  const { data: organisasjon, isLoading } = trpc.organisasjon.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const [redigerer, setRedigerer] = useState(false);
  const [navn, setNavn] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [fakturaAdresse, setFakturaAdresse] = useState("");
  const [fakturaEpost, setFakturaEpost] = useState("");

  const oppdaterMutasjon = trpc.organisasjon.oppdater.useMutation({
    onSuccess: () => {
      if (prosjektId) {
        utils.organisasjon.hentForProsjekt.invalidate({ projectId: prosjektId });
      }
      setRedigerer(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!organisasjon) {
    return (
      <EmptyState
        title="Ingen firma"
        description="Du er ikke tilknyttet noe firma."
      />
    );
  }

  function startRediger() {
    if (!organisasjon) return;
    setNavn(organisasjon.name);
    setOrgNr(organisasjon.organizationNumber ?? "");
    setFakturaAdresse(organisasjon.invoiceAddress ?? "");
    setFakturaEpost(organisasjon.invoiceEmail ?? "");
    setRedigerer(true);
  }

  function lagre() {
    if (!organisasjon) return;
    oppdaterMutasjon.mutate({
      organizationId: organisasjon.id,
      name: navn,
      organizationNumber: orgNr || null,
      invoiceAddress: fakturaAdresse || null,
      invoiceEmail: fakturaEpost || null,
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Eier-firma</h1>
        {!redigerer && (
          <Button variant="secondary" onClick={startRediger}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Rediger
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          {redigerer ? (
            <Input
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              required
              className="text-lg font-semibold"
            />
          ) : (
            <h2 className="text-lg font-semibold text-gray-900">{organisasjon.name}</h2>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            {redigerer ? (
              <Input
                label="Org.nr"
                value={orgNr}
                onChange={(e) => setOrgNr(e.target.value)}
                placeholder="123 456 789"
              />
            ) : (
              <>
                <p className="text-sm text-gray-500">Org.nr</p>
                <p className="font-medium text-gray-900">
                  {organisasjon.organizationNumber || "Ikke satt"}
                </p>
              </>
            )}
          </div>

          <div>
            {redigerer ? (
              <Input
                label="Faktura-e-post"
                type="email"
                value={fakturaEpost}
                onChange={(e) => setFakturaEpost(e.target.value)}
                placeholder="faktura@firma.no"
              />
            ) : (
              <>
                <p className="text-sm text-gray-500">Faktura-e-post</p>
                <p className="font-medium text-gray-900">
                  {organisasjon.invoiceEmail || "Ikke satt"}
                </p>
              </>
            )}
          </div>

          <div className="col-span-2">
            {redigerer ? (
              <Input
                label="Fakturaadresse"
                value={fakturaAdresse}
                onChange={(e) => setFakturaAdresse(e.target.value)}
                placeholder="Gateadresse, postnr og sted"
              />
            ) : (
              <>
                <p className="text-sm text-gray-500">Fakturaadresse</p>
                <p className="font-medium text-gray-900">
                  {organisasjon.invoiceAddress || "Ikke satt"}
                </p>
              </>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">EHF</p>
            <p className="font-medium text-gray-900">
              {organisasjon.ehfEnabled ? "Aktivert" : "Ikke aktivert"}
            </p>
          </div>
        </div>

        {redigerer && (
          <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button variant="secondary" onClick={() => setRedigerer(false)}>
              Avbryt
            </Button>
            <Button
              onClick={lagre}
              disabled={!navn || oppdaterMutasjon.isPending}
            >
              Lagre
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
