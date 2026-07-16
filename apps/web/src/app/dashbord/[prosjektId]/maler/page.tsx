"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Input, Textarea, Modal, Spinner, EmptyState, Badge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { Plus, Settings2 } from "lucide-react";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { useTranslation } from "react-i18next";

export default function MalerSide() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");

  const { data: tillatelser, isLoading: lasterTillatelser } =
    trpc.gruppe.hentMineTillatelser.useQuery({ projectId: params.prosjektId });

  const harTilgang = tillatelser?.includes("manage_field");

  const { data: maler, isLoading } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: harTilgang },
  );

  const opprettMutation = trpc.mal.opprett.useMutation({
    onSuccess: () => {
      utils.mal.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      setNavn("");
      setBeskrivelse("");
    },
  });

  useVerktoylinje([
    {
      id: "ny-mal",
      label: t("maler.nyMal"),
      ikon: <Plus className="h-4 w-4" />,
      onClick: () => setVisModal(true),
      variant: "primary",
    },
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;
    opprettMutation.mutate({
      projectId: params.prosjektId,
      name: navn.trim(),
      description: beskrivelse.trim() || undefined,
    });
  }

  if (lasterTillatelser || isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!harTilgang) {
    return (
      <EmptyState
        title={t("maler.ingenTilgang")}
        description={t("maler.ingenTilgangBeskrivelse")}
      />
    );
  }

  type MalRad = {
    id: string;
    name: string;
    description: string | null;
    _count: { objects: number; checklists: number };
  };

  return (
    <div className="space-y-4">
      {/* Klargjør flate-rollen: prosjektets arbeidsflate + lenke til full malbygger */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
        <p className="text-sm text-gray-600">{t("maler.arbeidsflateIntro")}</p>
        <button
          type="button"
          onClick={() => router.push("/dashbord/oppsett/produksjon/sjekklistemaler")}
          className="inline-flex items-center gap-1 text-xs text-sitedoc-primary hover:underline"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {t("maler.administrerIMalbygger")}
        </button>
      </div>

      {!maler?.length ? (
        <EmptyState
          title={t("maler.ingenMaler")}
          description={t("maler.ingenMalerBeskrivelse")}
          action={<Button onClick={() => setVisModal(true)}>{t("maler.opprettMal")}</Button>}
        />
      ) : (
        <Table<MalRad>
          kolonner={[
            {
              id: "name",
              header: t("tabell.navn"),
              celle: (rad) => (
                <span className="font-medium text-gray-900">{rad.name}</span>
              ),
            },
            {
              id: "description",
              header: t("tabell.beskrivelse"),
              celle: (rad) => (
                <span className="text-gray-600 line-clamp-1">
                  {rad.description ?? "—"}
                </span>
              ),
            },
            {
              id: "objects",
              header: t("maler.objekter"),
              celle: (rad) => (
                <Badge variant="default">{rad._count.objects}</Badge>
              ),
              bredde: "100px",
            },
            {
              id: "checklists",
              header: t("maler.sjekklister"),
              celle: (rad) => (
                <Badge variant="primary">{rad._count.checklists}</Badge>
              ),
              bredde: "100px",
            },
          ]}
          data={(maler ?? []) as MalRad[]}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) =>
            router.push(`/dashbord/${params.prosjektId}/maler/${rad.id}`)
          }
        />
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title={t("maler.nyRapportmal")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t("maler.malnavn")}
            placeholder={t("maler.malnavnPlaceholder")}
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            required
          />
          <Textarea
            label={t("tabell.beskrivelse")}
            placeholder={t("maler.beskrivelsePlaceholder")}
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={opprettMutation.isPending}>
              {t("handling.opprett")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setVisModal(false)}>
              {t("handling.avbryt")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
