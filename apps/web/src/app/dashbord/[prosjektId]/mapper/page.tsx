"use client";

import { useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Spinner, Table } from "@sitedoc/ui";
import {
  FolderOpen,
  FileText,
  Download,
  Lock,
  Upload,
  Loader2,
  Trash2,
  Circle,
  AlertCircle,
  BookOpen,
  Globe,
  Loader2 as Spinner2,
} from "lucide-react";
import Link from "next/link";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import { beregnSynligeMapper } from "@sitedoc/shared/utils";
import type { MappeTilgangInput, BrukerTilgangInfo } from "@sitedoc/shared/utils";
import { useTranslation } from "react-i18next";

export default function MapperSide() {
  const { t } = useTranslation();
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
  const { data: dokumentData, isLoading: lasterDokumenter } =
    trpc.mappe.hentDokumenter.useQuery(
      { folderId: valgtMappeId! },
      { enabled: !!valgtMappeId },
    );
  const dokumenter = Array.isArray(dokumentData) ? dokumentData : dokumentData?.dokumenter;
  const mappeSprak = Array.isArray(dokumentData) ? ["nb"] : (dokumentData?.mappeSprak ?? ["nb"]);
  const prosjektKildesprak = Array.isArray(dokumentData) ? "nb" : ((dokumentData as unknown as { prosjektKildesprak?: string })?.prosjektKildesprak ?? "nb");
  const harOversettelse = mappeSprak.length > 1;

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
  const [opplastingStatus, setOpplastingStatus] = useState<{ filnavn: string; nr: number; totalt: number; prosent: number } | null>(null);
  const filInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const lastOppMutation = trpc.mappe.lastOppDokument.useMutation({
    onSuccess: () => {
      utils.mappe.hentDokumenter.invalidate({ folderId: valgtMappeId! });
      utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setLasterOpp(false);
    },
    onError: () => setLasterOpp(false),
  });

  const slettDokMutation = trpc.mappe.slettDokument.useMutation({
    onSuccess: () => {
      utils.mappe.hentDokumenter.invalidate({ folderId: valgtMappeId! });
      utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const bekreftSpraakMut = trpc.mappe.bekreftDokumentSpraak.useMutation({
    onSuccess: () => {
      utils.mappe.hentDokumenter.invalidate({ folderId: valgtMappeId! });
    },
  });

  const handleFilValgt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filer = e.target.files;
    if (!filer || filer.length === 0 || !valgtMappeId) return;
    const filListe = Array.from(filer);
    setLasterOpp(true);

    for (let i = 0; i < filListe.length; i++) {
      const fil = filListe[i]!;
      setOpplastingStatus({ filnavn: fil.name, nr: i + 1, totalt: filListe.length, prosent: 0 });

      try {
        // Last opp med XMLHttpRequest for fremdrift
        const fileUrl = await new Promise<{ fileUrl: string; fileType: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              setOpplastingStatus((s) => s ? { ...s, prosent: Math.round((ev.loaded / ev.total) * 100) } : s);
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(`Upload feilet: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Nettverksfeil"));
          xhr.open("POST", "/api/upload");
          const formData = new FormData();
          formData.append("file", fil);
          xhr.send(formData);
        });

        await lastOppMutation.mutateAsync({
          folderId: valgtMappeId,
          name: fil.name,
          fileUrl: fileUrl.fileUrl,
          fileType: fileUrl.fileType ?? fil.type,
          fileSize: fil.size,
        });
      } catch {
        // Fortsett med neste fil
      }
    }

    setLasterOpp(false);
    setOpplastingStatus(null);
    utils.mappe.hentDokumenter.invalidate({ folderId: valgtMappeId! });
    if (filInputRef.current) filInputRef.current.value = "";
  };

  /** Åpne fil — dobbelt-klikk */
  function åpneFil(rad: DokumentRad) {
    if (!rad.fileUrl) return;
    const url = rad.fileUrl.startsWith("/api") ? rad.fileUrl : `/api${rad.fileUrl}`;
    window.open(url, "_blank");
  }

  // Ingen mappe valgt — vis velkomstmelding
  if (!valgtMappeId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-20">
        <FolderOpen className="mb-3 h-12 w-12 text-gray-300" />
        <h2 className="mb-1 text-lg font-semibold text-gray-700">{t("mapper.tittel")}</h2>
        <p className="text-sm text-gray-400">
          {t("mapper.velgMappe")}
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
          {t("mapper.ingenTilgang")}
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
    processingError: string | null;
    sourceLanguage: string;
    detectedLanguage: string | null;
    languageConfirmed: boolean;
    chunksTotalt: number;
    chunksEmbedded: number;
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
          {lasterOpp && opplastingStatus ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {opplastingStatus.nr}/{opplastingStatus.totalt} — {opplastingStatus.prosent}%
            </>
          ) : lasterOpp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("handling.lasterOpp")}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {t("handling.lastOpp")}
            </>
          )}
        </button>
        <input
          ref={filInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilValgt}
        />
      </div>

      {opplastingStatus && (
        <div className="mb-2 rounded border bg-gray-50 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
            <span className="truncate max-w-[300px]">{opplastingStatus.filnavn}</span>
            <span>{opplastingStatus.nr} av {opplastingStatus.totalt}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-sitedoc-primary transition-all duration-300"
              style={{ width: `${opplastingStatus.prosent}%` }}
            />
          </div>
        </div>
      )}

      {!dokumenter?.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <FileText className="mx-auto mb-2 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            {t("mapper.tom")}
          </p>
        </div>
      ) : (
        <Table<DokumentRad>
          kolonner={[
            {
              id: "status",
              header: "",
              celle: (rad) => <EmbeddingIndikator rad={rad} />,
              bredde: "36px",
            },
            {
              id: "name",
              header: t("tabell.navn"),
              celle: (rad) => {
                const harAvvik = rad.detectedLanguage && rad.detectedLanguage !== prosjektKildesprak && !rad.languageConfirmed;
                const detInfo = harAvvik ? STOETTEDE_SPRAAK.find((s) => s.kode === rad.detectedLanguage) : null;
                const prosjektInfo = STOETTEDE_SPRAAK.find((s) => s.kode === prosjektKildesprak);
                return (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-900">{rad.filename}</span>
                    </div>
                    {harAvvik && (
                      <div className="flex flex-wrap items-center gap-1.5 ml-6">
                        <AlertCircle className="h-3 w-3 flex-shrink-0 text-amber-500" />
                        <span className="text-[11px] text-amber-700">
                          {t("dokumentleser.detektertSom")} {detInfo?.flagg} {detInfo?.navn}, {t("dokumentleser.forventet")} {prosjektInfo?.flagg} {prosjektInfo?.navn}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); bekreftSpraakMut.mutate({ documentId: rad.id, bekreftSpraak: rad.detectedLanguage! }); }}
                          disabled={bekreftSpraakMut.isPending}
                          className="rounded bg-sitedoc-primary px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-sitedoc-secondary"
                        >
                          {t("dokumentleser.bekreftOgOversett", { spraak: detInfo?.navn })}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); bekreftSpraakMut.mutate({ documentId: rad.id, bekreftSpraak: rad.detectedLanguage!, skipOversettelse: true }); }}
                          disabled={bekreftSpraakMut.isPending}
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-200"
                        >
                          {t("dokumentleser.bekreftUtenOversettelse")}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); bekreftSpraakMut.mutate({ documentId: rad.id, bekreftSpraak: prosjektKildesprak }); }}
                          disabled={bekreftSpraakMut.isPending}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
                        >
                          {t("dokumentleser.brukForventet", { spraak: prosjektInfo?.navn })}
                        </button>
                      </div>
                    )}
                  </div>
                );
              },
            },
            {
              id: "version",
              header: t("tabell.versjon"),
              celle: (rad) => (
                <span className="text-sm text-gray-500">v{rad.version}</span>
              ),
              bredde: "80px",
            },
            {
              id: "uploadedAt",
              header: t("tabell.opprettet"),
              celle: (rad) => (
                <span className="text-sm text-gray-500">
                  {new Date(rad.uploadedAt).toLocaleDateString("nb-NO")}
                </span>
              ),
              bredde: "120px",
            },
            {
              id: "actions",
              header: "",
              celle: (rad) => (
                <div className="flex items-center gap-1">
                  <Link
                    href={`/dashbord/${prosjektId}/dokumenter/${rad.id}/les`}
                    className="group/les relative rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-sitedoc-primary"
                    title={t("handling.vis")}
                  >
                    <BookOpen className="h-4 w-4" />
                    {(rad as unknown as { oversettelse?: { tilgjengelig: string[]; pågår: boolean } }).oversettelse?.pågår ? (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-spin rounded-full border border-sitedoc-primary border-t-transparent" />
                    ) : (rad as unknown as { oversettelse?: { tilgjengelig: string[]; pågår: boolean } }).oversettelse?.tilgjengelig && (rad as unknown as { oversettelse?: { tilgjengelig: string[]; pågår: boolean } }).oversettelse!.tilgjengelig.length > 1 ? (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sitedoc-success" />
                    ) : null}
                  </Link>
                  <a
                    href={rad.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title={t("handling.lastNed")}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => {
                      if (confirm(`Slett «${rad.filename}»?`)) {
                        slettDokMutation.mutate({ documentId: rad.id });
                      }
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title={t("handling.slett")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
              bredde: "110px",
            },
          ]}
          data={(dokumenter ?? []) as DokumentRad[]}
          radNokkel={(rad) => rad.id}
          onRadDobbeltklikk={(rad) => åpneFil(rad)}
        />
      )}
    </div>
  );
}

/** Embedding-statusindikator per dokument */
function EmbeddingIndikator({ rad }: { rad: { processingState: string | null; processingError: string | null; chunksTotalt: number; chunksEmbedded: number } }) {
  const { t } = useTranslation();
  // Feil
  if (rad.processingError) {
    return (
      <span title={`Feil: ${rad.processingError}`}>
        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      </span>
    );
  }

  // Prosesserer
  if (rad.processingState === "pending" || rad.processingState === "processing") {
    return (
      <span title={t("handling.prosesserer")}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
      </span>
    );
  }

  // Ingen chunks (ukjent filtype eller tom fil)
  if (rad.chunksTotalt === 0) {
    return (
      <span title={t("mapper.ingenSokbartInnhold")}>
        <Circle className="h-3 w-3 text-gray-300" />
      </span>
    );
  }

  // Alle embedded
  if (rad.chunksEmbedded >= rad.chunksTotalt) {
    return (
      <span title={`${t("mapper.aiSokKlar")} (${rad.chunksEmbedded} chunks)`}>
        <Circle className="h-3 w-3 fill-green-500 text-green-500" />
      </span>
    );
  }

  // Delvis embedded
  if (rad.chunksEmbedded > 0) {
    return (
      <span title={`Embedding: ${rad.chunksEmbedded}/${rad.chunksTotalt} chunks`}>
        <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />
      </span>
    );
  }

  // Chunks finnes men ingen embedded
  return (
    <span title={`${t("mapper.venterPaaEmbedding")} (${rad.chunksTotalt} chunks)`}>
      <Circle className="h-3 w-3 fill-gray-400 text-gray-400" />
    </span>
  );
}
