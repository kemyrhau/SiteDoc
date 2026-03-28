"use client";

import { useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Spinner, Table } from "@sitedoc/ui";
import { FolderOpen, FileText, Download, Lock, Upload, Loader2 } from "lucide-react";
import { beregnSynligeMapper } from "@sitedoc/shared/utils";
import type { MappeTilgangInput, BrukerTilgangInfo } from "@sitedoc/shared/utils";

export default function MapperSide() {
  const { prosjektId } = useProsjekt();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const valgtMappeId = searchParams.get("mappe");

  // Hent alle mapper for å finne valgt mappes navn + tilgangsdata
  const { data: mapper } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Hent dokumenter for valgt mappe
  const { data: dokumenter, isLoading: lasterDokumenter } =
    trpc.mappe.hentDokumenter.useQuery(
      { folderId: valgtMappeId! },
      { enabled: !!valgtMappeId },
    );

  // Hent brukerens medlemskap og grupper for tilgangskontroll
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: grupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  ) as { data: Array<{ id: string; members: Array<{ projectMember: { user: { id: string } } }> }> | undefined };

  const valgtMappe = mapper?.find((m) => m.id === valgtMappeId);

  // Sjekk om bruker kun har sti-tilgang (ikke innholdstilgang)
  const erKunSti = useMemo(() => {
    if (!valgtMappeId || !mapper || !session?.user || !medlemmer) return false;

    const brukerMedlem = medlemmer.find(
      (m) => m.user.email === session.user?.email,
    );

    if (!brukerMedlem) return false;
    if (brukerMedlem.role === "admin") return false;

    const entrepriseIder = brukerMedlem.enterprises.map(
      (me) => me.enterprise.id,
    );

    const gruppeIder = (grupper ?? [])
      .filter((g) =>
        g.members.some(
          (m) => m.projectMember.user.id === brukerMedlem.user.id,
        ),
      )
      .map((g) => g.id);

    const brukerInfo: BrukerTilgangInfo = {
      userId: brukerMedlem.user.id,
      erAdmin: false,
      entrepriseIder,
      gruppeIder,
    };

    const mapperInput: MappeTilgangInput[] = mapper.map((m) => ({
      id: m.id,
      parentId: m.parentId,
      accessMode: m.accessMode,
      accessEntries: m.accessEntries.map((e) => ({
        accessType: e.accessType,
        enterpriseId: e.enterprise?.id ?? null,
        groupId: e.group?.id ?? null,
        userId: e.user?.id ?? null,
      })),
    }));

    const resultat = beregnSynligeMapper(mapperInput, brukerInfo);
    return resultat.kunSti.has(valgtMappeId);
  }, [valgtMappeId, mapper, session, medlemmer, grupper]);

  const [lasterOpp, setLasterOpp] = useState(false);
  const filInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const lastOppMutation = trpc.mappe.lastOppDokument.useMutation({
    onSuccess: () => {
      utils.mappe.hentDokumenter.invalidate({ folderId: valgtMappeId! });
      setLasterOpp(false);
    },
    onError: () => setLasterOpp(false),
  });

  const handleFilValgt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fil = e.target.files?.[0];
    if (!fil || !valgtMappeId) return;
    setLasterOpp(true);

    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Opplasting feilet");
      const { fileUrl, fileType } = await res.json();

      lastOppMutation.mutate({
        folderId: valgtMappeId,
        name: fil.name,
        fileUrl,
        fileType: fileType ?? fil.type,
        fileSize: fil.size,
      });
    } catch {
      setLasterOpp(false);
    }

    // Reset input
    if (filInputRef.current) filInputRef.current.value = "";
  };

  // Ingen mappe valgt — vis velkomstmelding
  if (!valgtMappeId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-20">
        <FolderOpen className="mb-3 h-12 w-12 text-gray-300" />
        <h2 className="mb-1 text-lg font-semibold text-gray-700">Mapper</h2>
        <p className="text-sm text-gray-400">
          Velg en mappe i panelet til venstre for å se innholdet.
        </p>
      </div>
    );
  }

  // Kun sti-tilgang — vis begrenset melding
  if (erKunSti) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-20">
        <Lock className="mb-3 h-12 w-12 text-gray-300" />
        <h2 className="mb-1 text-lg font-semibold text-gray-700">
          {valgtMappe?.name ?? "Mappe"}
        </h2>
        <p className="text-sm text-gray-400">
          Du har ikke tilgang til innholdet i denne mappen.
        </p>
      </div>
    );
  }

  if (lasterDokumenter) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  type DokumentRad = {
    id: string;
    filename: string;
    fileUrl: string;
    filetype: string | null;
    fileSize: number | null;
    version: number;
    uploadedAt: string;
    processingState: string | null;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-bold text-gray-900">
            {valgtMappe?.name ?? "Mappe"}
          </h2>
        </div>
        <button
          onClick={() => filInputRef.current?.click()}
          disabled={lasterOpp}
          className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-3 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
        >
          {lasterOpp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Laster opp...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Last opp
            </>
          )}
        </button>
        <input
          ref={filInputRef}
          type="file"
          className="hidden"
          onChange={handleFilValgt}
        />
      </div>

      {!dokumenter?.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <FileText className="mx-auto mb-2 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            Denne mappen er tom.
          </p>
        </div>
      ) : (
        <Table<DokumentRad>
          kolonner={[
            {
              id: "name",
              header: "Navn",
              celle: (rad) => (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span className="font-medium text-gray-900">{rad.filename}</span>
                </div>
              ),
            },
            {
              id: "version",
              header: "Versjon",
              celle: (rad) => (
                <span className="text-sm text-gray-500">v{rad.version}</span>
              ),
              bredde: "80px",
            },
            {
              id: "uploadedAt",
              header: "Opprettet",
              celle: (rad) => (
                <span className="text-sm text-gray-500">
                  {new Date(rad.uploadedAt).toLocaleDateString("nb-NO")}
                </span>
              ),
              bredde: "120px",
            },
            {
              id: "download",
              header: "",
              celle: (rad) => (
                <a
                  href={rad.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Last ned"
                >
                  <Download className="h-4 w-4" />
                </a>
              ),
              bredde: "50px",
            },
          ]}
          data={(dokumenter ?? []) as DokumentRad[]}
          radNokkel={(rad) => rad.id}
        />
      )}
    </div>
  );
}
