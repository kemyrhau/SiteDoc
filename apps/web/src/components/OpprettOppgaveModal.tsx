"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Select, Button } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";

interface DokumentflytMal {
  template: { id: string; name: string; category: string };
}

interface DokumentflytRad {
  id: string;
  faggruppeId: string | null;
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

  const { data: mineFaggrupper } = trpc.medlem.hentMineFaggrupper.useQuery(
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

  // Auto-velg bestiller-faggruppe
  useEffect(() => {
    if (!open || valgtBestiller) return;
    if (mineFaggrupper && mineFaggrupper.length > 0) {
      const forste = mineFaggrupper[0];
      if (forste) setValgtOppretter(forste.id);
    }
  }, [mineFaggrupper, open, valgtBestiller]);

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
      af.faggruppeId === valgtBestiller &&
      af.maler.some((wt) => wt.template.id === valgtMal),
  );
  const utledetUtforer = valgtBestiller;

  // Filtrer maler (samme logikk som tegninger-siden)
  const filtrerMaler = useMemo(() => {
    if (!valgtBestiller && !alleMaler) return [];
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
      if (af.faggruppeId !== valgtBestiller) continue;
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

  // Sjekk om valgt mal er HMS
  const erHms = useMemo(() => {
    if (!valgtMal || !alleMaler) return false;
    const mal = (alleMaler as Array<{ id: string; domain: string | null }>).find((m) => m.id === valgtMal);
    return mal?.domain === "hms";
  }, [valgtMal, alleMaler]);

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal) return;
    if (!erHms && !valgtBestiller) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      ...(erHms
        ? {}
        : {
            bestillerFaggruppeId: valgtBestiller,
            utforerFaggruppeId: utledetUtforer,
          }),
      title: tittel,
      checklistId: sjekklisteId,
      checklistFieldId: sjekklisteFeltId,
      dokumentflytId: erHms ? undefined : matchendeArbeidsforlop?.id,
    });
  }

  const bestillerAlternativer = (mineFaggrupper ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  return (
    <Modal open={open} onClose={onClose} title="Opprett oppgave fra felt">
      <form onSubmit={handleOpprett} className="flex flex-col gap-4">
        {!erHms && (
          <Select
            label="Bestiller-faggruppe"
            value={valgtBestiller}
            onChange={(e) => {
              setValgtOppretter(e.target.value);
              setValgtMal("");
            }}
            options={bestillerAlternativer}
            placeholder="Velg faggruppe"
          />
        )}

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
          disabled={!valgtMal || (!erHms && !valgtBestiller)}
          loading={opprettMutation.isPending}
        >
          Opprett oppgave
        </Button>
      </form>
    </Modal>
  );
}
