"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Spinner,
  EmptyState,
  Badge,
  Table,
  Button,
  Modal,
  Input,
} from "@sitedoc/ui";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";

type FaggruppeRad = {
  id: string;
  name: string;
  faggruppeNummer: string | null;
  organizationNumber: string | null;
  faggruppeKoblinger: Array<{ id: string }>;
  _count: { bestillerChecklists: number; bestillerTasks: number };
};

export default function FaggrupperSide() {
  useToppbarFiltre({ byggeplass: false });
  const params = useParams<{ prosjektId: string }>();
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [opprettAapen, setOpprettAapen] = useState(false);
  const [redigerFaggruppe, setRedigerFaggruppe] = useState<FaggruppeRad | null>(
    null,
  );
  const [slettFaggruppe, setSlettFaggruppe] = useState<FaggruppeRad | null>(
    null,
  );

  const { data: faggrupper, isLoading } =
    trpc.faggruppe.hentForProsjekt.useQuery({ projectId: params.prosjektId });

  function invaliderListe() {
    utils.faggruppe.hentForProsjekt.invalidate({ projectId: params.prosjektId });
    utils.prosjekt.hentMedId.invalidate({ id: params.prosjektId });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div />
        <Button onClick={() => setOpprettAapen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t("faggrupper.nyFaggruppe")}
        </Button>
      </div>

      {!faggrupper?.length ? (
        <EmptyState
          title={t("faggrupper.ingenFaggrupper")}
          description={t("faggrupper.ingenFaggrupperBeskrivelse")}
          action={
            <Button onClick={() => setOpprettAapen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("faggrupper.nyFaggruppe")}
            </Button>
          }
        />
      ) : (
        <Table<FaggruppeRad>
          kolonner={[
            {
              id: "name",
              header: t("faggrupper.firma"),
              celle: (rad) => (
                <div>
                  <span className="font-medium text-gray-900">{rad.name}</span>
                  {rad.organizationNumber && (
                    <p className="text-xs text-gray-400">
                      {t("faggrupper.organisasjonsnummer")}:{" "}
                      {rad.organizationNumber}
                    </p>
                  )}
                </div>
              ),
            },
            {
              id: "members",
              header: t("dashbord.medlemmer"),
              celle: (rad) => (
                <Badge variant="default">
                  {rad.faggruppeKoblinger.length}
                </Badge>
              ),
              bredde: "120px",
            },
            {
              id: "checklists",
              header: t("nav.sjekklister"),
              celle: (rad) => (
                <Badge variant="primary">
                  {rad._count.bestillerChecklists}
                </Badge>
              ),
              bredde: "120px",
            },
            {
              id: "tasks",
              header: t("nav.oppgaver"),
              celle: (rad) => (
                <Badge variant="warning">{rad._count.bestillerTasks}</Badge>
              ),
              bredde: "120px",
            },
            {
              id: "handlinger",
              header: "",
              celle: (rad) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setRedigerFaggruppe(rad)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    title={t("handling.rediger")}
                    aria-label={t("handling.rediger")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlettFaggruppe(rad)}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title={t("handling.slett")}
                    aria-label={t("handling.slett")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
              bredde: "100px",
            },
          ]}
          data={(faggrupper ?? []) as FaggruppeRad[]}
          radNokkel={(rad) => rad.id}
        />
      )}

      <OpprettFaggruppeModal
        aapen={opprettAapen}
        onClose={() => setOpprettAapen(false)}
        prosjektId={params.prosjektId}
        onLagret={invaliderListe}
      />

      <RedigerFaggruppeModal
        faggruppe={redigerFaggruppe}
        onClose={() => setRedigerFaggruppe(null)}
        onLagret={invaliderListe}
      />

      <SlettFaggruppeDialog
        faggruppe={slettFaggruppe}
        onClose={() => setSlettFaggruppe(null)}
        onSlettet={invaliderListe}
      />
    </div>
  );
}

function OpprettFaggruppeModal({
  aapen,
  onClose,
  prosjektId,
  onLagret,
}: {
  aapen: boolean;
  onClose: () => void;
  prosjektId: string;
  onLagret: () => void;
}) {
  const { t } = useTranslation();
  const [navn, setNavn] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const opprett = trpc.faggruppe.opprett.useMutation({
    onSuccess: () => {
      onLagret();
      setNavn("");
      setOrgNr("");
      setFeil(null);
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;
    setFeil(null);
    opprett.mutate({
      name: navn.trim(),
      projectId: prosjektId,
      organizationNumber: orgNr.trim() || undefined,
    });
  }

  function handleClose() {
    setNavn("");
    setOrgNr("");
    setFeil(null);
    onClose();
  }

  return (
    <Modal open={aapen} onClose={handleClose} title={t("faggrupper.nyFaggruppe")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t("faggrupper.firma")}
          placeholder="F.eks. Bygg AS"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
          autoFocus
        />
        <Input
          label={t("faggrupper.organisasjonsnummer")}
          placeholder="F.eks. 912345678"
          value={orgNr}
          onChange={(e) => setOrgNr(e.target.value)}
        />
        {feil && (
          <p className="text-sm text-red-600">{feil}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" loading={opprett.isPending}>
            {t("handling.opprett")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RedigerFaggruppeModal({
  faggruppe,
  onClose,
  onLagret,
}: {
  faggruppe: FaggruppeRad | null;
  onClose: () => void;
  onLagret: () => void;
}) {
  const { t } = useTranslation();
  const [navn, setNavn] = useState(faggruppe?.name ?? "");
  const [orgNr, setOrgNr] = useState(faggruppe?.organizationNumber ?? "");
  const [feil, setFeil] = useState<string | null>(null);

  // Reset state når faggruppe endrer seg (ny modal-instans åpnes)
  const aktivId = faggruppe?.id ?? null;
  const [forrigeId, setForrigeId] = useState<string | null>(null);
  if (aktivId !== forrigeId) {
    setForrigeId(aktivId);
    setNavn(faggruppe?.name ?? "");
    setOrgNr(faggruppe?.organizationNumber ?? "");
    setFeil(null);
  }

  const oppdater = trpc.faggruppe.oppdater.useMutation({
    onSuccess: () => {
      onLagret();
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!faggruppe || !navn.trim()) return;
    setFeil(null);
    oppdater.mutate({
      id: faggruppe.id,
      name: navn.trim(),
      organizationNumber: orgNr.trim() || undefined,
    });
  }

  return (
    <Modal
      open={!!faggruppe}
      onClose={onClose}
      title={t("faggrupper.redigerFaggruppe")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t("faggrupper.firma")}
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
          autoFocus
        />
        <Input
          label={t("faggrupper.organisasjonsnummer")}
          value={orgNr}
          onChange={(e) => setOrgNr(e.target.value)}
        />
        {feil && (
          <p className="text-sm text-red-600">{feil}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" loading={oppdater.isPending}>
            {t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SlettFaggruppeDialog({
  faggruppe,
  onClose,
  onSlettet,
}: {
  faggruppe: FaggruppeRad | null;
  onClose: () => void;
  onSlettet: () => void;
}) {
  const { t } = useTranslation();
  const [feil, setFeil] = useState<string | null>(null);

  const slett = trpc.faggruppe.slett.useMutation({
    onSuccess: () => {
      onSlettet();
      setFeil(null);
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleClose() {
    setFeil(null);
    onClose();
  }

  return (
    <Modal
      open={!!faggruppe}
      onClose={handleClose}
      title={t("faggrupper.slettFaggruppe")}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">
          {t("faggrupper.bekreftSlett", { navn: faggruppe?.name ?? "" })}
        </p>
        {feil && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{feil}</p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t("handling.avbryt")}
          </Button>
          <Button
            variant="danger"
            loading={slett.isPending}
            onClick={() => faggruppe && slett.mutate({ id: faggruppe.id })}
          >
            {t("handling.slett")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
