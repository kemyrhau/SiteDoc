"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Select, Button } from "@siteflow/ui";
import { trpc } from "@/lib/trpc";

interface ArbeidsflopMal {
  template: { id: string; name: string; category: string };
}

interface ArbeidsflopRad {
  id: string;
  enterpriseId: string;
  responderEnterprise: { id: string; name: string } | null;
  templates: ArbeidsflopMal[];
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
  const [valgtOppretter, setValgtOppretter] = useState("");

  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const { data: arbeidsforlop } = trpc.arbeidsforlop.hentForProsjekt.useQuery(
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

  // Auto-velg oppretter-entreprise
  useEffect(() => {
    if (!open || valgtOppretter) return;
    if (mineEntrepriser && mineEntrepriser.length > 0) {
      const forste = mineEntrepriser[0];
      if (forste) setValgtOppretter(forste.id);
    }
  }, [mineEntrepriser, open, valgtOppretter]);

  // Reset state ved lukking
  useEffect(() => {
    if (!open) {
      setValgtMal("");
      setValgtOppretter("");
    }
  }, [open]);

  const alleArbeidsforlop = (arbeidsforlop ?? []) as unknown as ArbeidsflopRad[];

  // Finn matchende arbeidsforløp for svarer-utledning
  const matchendeArbeidsforlop = alleArbeidsforlop.find(
    (af) =>
      af.enterpriseId === valgtOppretter &&
      af.templates.some((wt) => wt.template.id === valgtMal),
  );
  const utledetSvarer = matchendeArbeidsforlop?.responderEnterprise?.id ?? valgtOppretter;

  // Filtrer maler (samme logikk som tegninger-siden)
  const filtrerMaler = useMemo(() => {
    if (!valgtOppretter) return [];
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
      if (af.enterpriseId !== valgtOppretter) continue;
      for (const wt of af.templates) {
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
  }, [valgtOppretter, alleMaler, minTilgang, alleArbeidsforlop]);

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
    if (!valgtMal || !valgtOppretter) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      creatorEnterpriseId: valgtOppretter,
      responderEnterpriseId: utledetSvarer,
      title: tittel,
      checklistId: sjekklisteId,
      checklistFieldId: sjekklisteFeltId,
      workflowId: matchendeArbeidsforlop?.id,
    });
  }

  const oppretterAlternativer = (mineEntrepriser ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  return (
    <Modal open={open} onClose={onClose} title="Opprett oppgave fra felt">
      <form onSubmit={handleOpprett} className="flex flex-col gap-4">
        <Select
          label="Oppretter-entreprise"
          value={valgtOppretter}
          onChange={(e) => {
            setValgtOppretter(e.target.value);
            setValgtMal("");
          }}
          options={oppretterAlternativer}
          placeholder="Velg entreprise"
        />

        <Select
          label="Oppgavemal"
          value={valgtMal}
          onChange={(e) => setValgtMal(e.target.value)}
          options={filtrerMaler.map((m) => ({ value: m.id, label: m.name }))}
          placeholder="Velg mal"
        />

        {valgtMal && matchendeArbeidsforlop?.responderEnterprise && (
          <p className="text-sm text-gray-500">
            Svarer: {matchendeArbeidsforlop.responderEnterprise.name}
          </p>
        )}

        <p className="text-sm text-gray-500">
          Tittel: {tittel}
        </p>

        <Button
          type="submit"
          disabled={!valgtMal || !valgtOppretter}
          loading={opprettMutation.isPending}
        >
          Opprett oppgave
        </Button>
      </form>
    </Modal>
  );
}
