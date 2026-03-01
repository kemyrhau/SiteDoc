"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, Button, Input, Textarea } from "@siteflow/ui";

export default function NyttProsjektSide() {
  const router = useRouter();
  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [adresse, setAdresse] = useState("");

  const opprettMutation = trpc.prosjekt.opprett.useMutation({
    onSuccess: (prosjekt) => {
      router.push(`/dashbord/prosjekter/${prosjekt.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;

    opprettMutation.mutate({
      name: navn.trim(),
      description: beskrivelse.trim() || undefined,
      address: adresse.trim() || undefined,
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-2xl font-bold">Nytt prosjekt</h2>
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
            <p className="text-sm text-siteflow-error">
              {opprettMutation.error.message}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
