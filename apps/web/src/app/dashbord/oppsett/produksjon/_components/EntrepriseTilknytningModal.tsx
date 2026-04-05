"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { ChevronDown, ChevronRight, Workflow as WorkflowIcon } from "lucide-react";
import { hentFarge } from "./entreprise-farger";

interface EntrepriseTilknytningModalProps {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  kategori: "oppgave" | "sjekkliste";
  valgteWorkflowIds: Set<string>;
  onBekreft: (ids: Set<string>) => void;
}

export function EntrepriseTilknytningModal({
  open,
  onClose,
  prosjektId,
  kategori,
  valgteWorkflowIds,
  onBekreft,
}: EntrepriseTilknytningModalProps) {
  const [lokaleValg, setLokaleValg] = useState<Set<string>>(new Set());

  // Synkroniser fra props ved åpning
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setLokaleValg(new Set(valgteWorkflowIds));
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  const { data: entrepriser, isLoading: lasterEntrepriser } =
    trpc.entreprise.hentForProsjekt.useQuery(
      { projectId: prosjektId },
      { enabled: !!prosjektId && open },
    );

  const { data: alleArbeidsforlop, isLoading: lasterAf } =
    trpc.dokumentflyt.hentForProsjekt.useQuery(
      { projectId: prosjektId },
      { enabled: !!prosjektId && open },
    );

  const laster = lasterEntrepriser || lasterAf;

  // Bygg map: entrepriseId -> dokumentflyter[]
  const arbeidsforlopMap = new Map<
    string,
    Array<{
      id: string;
      name: string;
    }>
  >();
  if (alleArbeidsforlop) {
    for (const af of alleArbeidsforlop) {
      if (!af.enterpriseId) continue;
      const liste = arbeidsforlopMap.get(af.enterpriseId) ?? [];
      liste.push(af);
      arbeidsforlopMap.set(af.enterpriseId, liste);
    }
  }

  function toggleArbeidsforlop(id: string) {
    setLokaleValg((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) {
        neste.delete(id);
      } else {
        neste.add(id);
      }
      return neste;
    });
  }

  const tittel =
    kategori === "sjekkliste"
      ? "Sjekkliste for entreprisetilknytning"
      : "Oppgave for entreprisetilknytning";

  return (
    <Modal open={open} onClose={onClose} title={tittel} className="z-[60]">
      {laster ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : !entrepriser || entrepriser.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          Ingen entrepriser i prosjektet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="mb-2 text-sm text-gray-500">
            Velg hvilke arbeidsforløp denne malen skal tilknyttes.
          </p>

          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {entrepriser.map((ent, idx) => {
              const afs = arbeidsforlopMap.get(ent.id) ?? [];
              return (
                <EntrepriseGruppe
                  key={ent.id}
                  navn={ent.name}
                  fargeIndeks={idx}
                  arbeidsforloper={afs}
                  lokaleValg={lokaleValg}
                  onToggle={toggleArbeidsforlop}
                />
              );
            })}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button onClick={() => onBekreft(lokaleValg)}>OK</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EntrepriseGruppe({
  navn,
  fargeIndeks,
  arbeidsforloper,
  lokaleValg,
  onToggle,
}: {
  navn: string;
  fargeIndeks: number;
  arbeidsforloper: Array<{
    id: string;
    name: string;
  }>;
  lokaleValg: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(true);
  const farge = hentFarge(fargeIndeks);

  if (arbeidsforloper.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Entreprise-header */}
      <button
        onClick={() => setEkspandert(!ekspandert)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left ${farge.bg}`}
      >
        {ekspandert ? (
          <ChevronDown className={`h-4 w-4 ${farge.tekst}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${farge.tekst}`} />
        )}
        <span className={`text-sm font-semibold ${farge.tekst}`}>{navn}</span>
      </button>

      {/* Dokumentflyt-liste */}
      {ekspandert && (
        <div className="bg-white py-1">
          {arbeidsforloper.map((af) => (
            <label
              key={af.id}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                checked={lokaleValg.has(af.id)}
                onChange={() => onToggle(af.id)}
              />
              <WorkflowIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="text-sm text-gray-700">{af.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
