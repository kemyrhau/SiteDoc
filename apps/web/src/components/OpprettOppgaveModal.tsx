"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Select, Button } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";

interface DokumentflytMal {
  template: { id: string; name: string; category: string };
}

interface DokumentflytRad {
  id: string;
  enterpriseId: string | null;
  maler: DokumentflytMal[];
}

interface OpprettOppgaveModalProps {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  sjekklisteId: string;
  sjekklisteFeltId: string;
  sjekklisteNummer?: string | null;
  feltLabel?: string;
}

export function OpprettOppgaveModal({
  open,
  onClose,
  prosjektId,
  sjekklisteId,
  sjekklisteFeltId,
  sjekklisteNummer,
  feltLabel,
}: OpprettOppgaveModalProps) {
  const utils = trpc.useUtils();

  const [valgtMal, setValgtMal] = useState("");
  const [valgtBestiller, setValgtOppretter] = useState("");

  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const { data: arbeidsforlop } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const { data: alleMaler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const { data: minTilgang } = trpc.gruppe.hentMinTilgang.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );

  // Auto-velg bestiller-entreprise
  useEffect(() => {
    if (!open || valgtBestiller) return;
    if (mineEntrepriser && mineEntrepriser.length > 0) {
      const forste = mineEntrepriser[0];
      if (forste) setValgtOppretter(forste.id);
    }
  }, [mineEntrepriser, open, valgtBestiller]);

  // Reset state ved lukking
  useEffect(() => {
    if (!open) {
      setValgtMal("");
      setValgtOppretter("");
    }
  }, [open]);

  const alleArbeidsforlop = (arbeidsforlop ?? []) as unknown as DokumentflytRad[];

  // Finn matchende dokumentflyt for utfører-utledning
  const matchendeArbeidsforlop = alleArbeidsforlop.find(
    (af) =>
      af.enterpriseId === valgtBestiller &&
      af.maler.some((wt) => wt.template.id === valgtMal),
  );
  const utledetUtforer = valgtBestiller;

  // Filtrer maler (samme logikk som tegninger-siden)
  const filtrerMaler = useMemo(() => {
    if (!valgtBestiller) return [];
    const alleMalerTypet = (alleMaler ?? []) as Array<{
      id: string;
      name: string;
      category: string;
      domain: string | null;
    }>;
    const kategoriMaler = alleMalerTypet.filter((m) => m.category === "oppgave");

    if (minTilgang?.erAdmin || minTilgang?.tillatelser.includes("manage_field")) {
      return kategoriMaler.map((m) => ({ id: m.id, name: m.name }));
    }

    const synligeMalIder = new Set<string>();

    for (const af of alleArbeidsforlop) {
      if (af.enterpriseId !== valgtBestiller) continue;
      for (const wt of af.maler) {
        if (wt.template.category === "oppgave") {
          synligeMalIder.add(wt.template.id);
        }
      }
    }

    for (const mal of kategoriMaler) {
      if (mal.domain === "hms") {
        synligeMalIder.add(mal.id);
      }
    }

    if (minTilgang?.domener) {
      for (const mal of kategoriMaler) {
        if (mal.domain && minTilgang.domener.includes(mal.domain)) {
          synligeMalIder.add(mal.id);
        }
      }
    }

    return kategoriMaler
      .filter((m) => synligeMalIder.has(m.id))
      .map((m) => ({ id: m.id, name: m.name }));
  }, [valgtBestiller, alleMaler, minTilgang, alleArbeidsforlop]);

  // Auto-tittel
  const tittel = useMemo(() => {
    const deler: string[] = [];
    if (sjekklisteNummer) deler.push(sjekklisteNummer);
    if (feltLabel) deler.push(feltLabel);
    return deler.length > 0 ? `Oppgave fra ${deler.join(": ")}` : "Ny oppgave";
  }, [sjekklisteNummer, feltLabel]);

  const opprettMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: () => {
      utils.oppgave.hentForSjekkliste.invalidate({ checklistId: sjekklisteId });
      onClose();
    },
  });

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal || !valgtBestiller) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      bestillerEnterpriseId: valgtBestiller,
      utforerEnterpriseId: utledetUtforer,
      title: tittel,
      checklistId: sjekklisteId,
      checklistFieldId: sjekklisteFeltId,
      dokumentflytId: matchendeArbeidsforlop?.id,
    });
  }

  const bestillerAlternativer = (mineEntrepriser ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  return (
    <Modal open={open} onClose={onClose} title="Opprett oppgave fra felt">
      <form onSubmit={handleOpprett} className="flex flex-col gap-4">
        <Select
          label="Bestiller-entreprise"
          value={valgtBestiller}
          onChange={(e) => {
            setValgtOppretter(e.target.value);
            setValgtMal("");
          }}
          options={bestillerAlternativer}
          placeholder="Velg entreprise"
        />

        <Select
          label="Oppgavemal"
          value={valgtMal}
          onChange={(e) => setValgtMal(e.target.value)}
          options={filtrerMaler.map((m) => ({ value: m.id, label: m.name }))}
          placeholder="Velg mal"
        />

        <p className="text-sm text-gray-500">
          Tittel: {tittel}
        </p>

        <Button
          type="submit"
          disabled={!valgtMal || !valgtBestiller}
          loading={opprettMutation.isPending}
        >
          Opprett oppgave
        </Button>
      </form>
    </Modal>
  );
}
