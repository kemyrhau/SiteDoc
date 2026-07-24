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
  const { data: mineFlyter } = trpc.medlem.hentMineFlyter.useQuery(
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
  const mineFlytIder = new Set(mineFlyter ?? []);

  // Person-/gruppe-direkte medlem uten egen faggruppe: bruk eier-faggruppen
  // (Dokumentflyt.faggruppeId) til flyten brukeren er medlem av og som har valgt mal.
  const flytFallbackFaggruppe = valgtMal
    ? alleArbeidsforlop.find((af) => mineFlytIder.has(af.id) && af.maler.some((wt) => wt.template.id === valgtMal))?.faggruppeId ?? null
    : null;
  const effektivBestiller = valgtBestiller || flytFallbackFaggruppe || "";

  // Finn matchende dokumentflyt for utfører-utledning.
  // Merk: dokumentflytId-bindingen (linje under) holdes på valgtBestiller — flyten bindes
  // ellers ved send (N3-scope: ikke utvid create-tids binding til person-direkte).
  const matchendeArbeidsforlop = alleArbeidsforlop.find(
    (af) =>
      af.faggruppeId === valgtBestiller &&
      af.maler.some((wt) => wt.template.id === valgtMal),
  );
  const utledetUtforer = effektivBestiller;

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
      if (af.faggruppeId !== valgtBestiller && !mineFlytIder.has(af.id)) continue;
      for (const wt of af.maler) {
        if (wt.template.category === "oppgave") {
          synligeMalIder.add(wt.template.id);
        }
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
  }, [valgtBestiller, alleMaler, minTilgang, alleArbeidsforlop, mineFlyter]);

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

  // HMS-maler er egen topp-nivå-type (category="hms") og filtreres ut av
  // category==="oppgave"-listen over — de opprettes via «Meld HMS», ikke her.

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal || !effektivBestiller) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      bestillerFaggruppeId: effektivBestiller,
      utforerFaggruppeId: utledetUtforer,
      title: tittel,
      checklistId: sjekklisteId,
      checklistFieldId: sjekklisteFeltId,
      dokumentflytId: matchendeArbeidsforlop?.id,
    });
  }

  const bestillerAlternativer = (mineFaggrupper ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  return (
    <Modal open={open} onClose={onClose} title="Opprett oppgave fra felt">
      <form onSubmit={handleOpprett} className="flex flex-col gap-4">
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
          disabled={!valgtMal || !effektivBestiller}
          loading={opprettMutation.isPending}
        >
          Opprett oppgave
        </Button>
      </form>
    </Modal>
  );
}
