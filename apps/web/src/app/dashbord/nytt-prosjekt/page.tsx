"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, Button, Input, Textarea } from "@sitedoc/ui";
import { Building2 } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";

export default function NyttProsjektSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const { valgtFirma, erSitedocAdmin } = useFirma();
  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [adresse, setAdresse] = useState("");

  const opprettMutation = trpc.prosjekt.opprett.useMutation({
    onSuccess: (prosjekt) => {
      router.push(`/dashbord/${prosjekt.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;

    opprettMutation.mutate({
      name: navn.trim(),
      description: beskrivelse.trim() || undefined,
      address: adresse.trim() || undefined,
      organizationId: valgtFirma?.id,
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-2xl font-bold">Nytt prosjekt</h2>

      {erSitedocAdmin && valgtFirma && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div className="text-blue-900">
            {t("nyttProsjekt.opprettesFor", { firma: valgtFirma.name })}
          </div>
        </div>
      )}
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Prosjektnavn"
            placeholder="F.eks. Bjørvika Kontorbygg"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            required
          />
          <Textarea
            label="Beskrivelse"
            placeholder="Beskriv prosjektet..."
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
          />
          <Input
            label="Adresse"
            placeholder="F.eks. Dronning Eufemias gate 30, 0191 Oslo"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={opprettMutation.isPending}>
              Opprett prosjekt
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Avbryt
            </Button>
          </div>
          {opprettMutation.error && (
            <p className="text-sm text-sitedoc-error">
              {opprettMutation.error.message}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
