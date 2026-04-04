"use client";

import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import {
  BookOpen,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Globe,
  FileText,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";

export default function DokumentleserSide() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const searchParams = useSearchParams();
  const prosjektId = params.prosjektId;
  const embed = searchParams.get("embed") === "true";

  const [valgtMappeId, setValgtMappeId] = useState<string | null>(null);
  const [valgtDokumentId, setValgtDokumentId] = useState<string | null>(null);
  const [språk, setSpråk] = useState(i18n.language || "nb");

  // Hent mapper
  const { data: mapper } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  // Hent dokumenter for valgt mappe
  const { data: dokumentData } = trpc.mappe.hentDokumenterMedSpraak.useQuery(
    { folderId: valgtMappeId! },
    { enabled: !!valgtMappeId },
  );

  // Hent blokker for valgt dokument
  const { data: blokkData, isLoading: lasterBlokker } =
    trpc.mappe.hentDokumentBlokker.useQuery(
      { documentId: valgtDokumentId!, language: språk },
      { enabled: !!valgtDokumentId },
    );

  // Bygg mappetreet
  const mappeTre = useMemo(() => {
    if (!mapper) return [];
    type MappeNode = {
      id: string;
      name: string;
      parentId: string | null;
      languages: string[];
      children: MappeNode[];
      harDokumenter: boolean;
    };
    const noder = mapper.map((m) => ({
      id: m.id,
      name: m.name,
      parentId: m.parentId,
      languages: ((m as unknown as { effektiveSpraak?: string[] }).effektiveSpraak ?? m.languages ?? ["nb"]) as string[],
      children: [] as MappeNode[],
      harDokumenter: (m._count?.ftdDocuments ?? 0) > 0,
    }));
    const map = new Map(noder.map((n) => [n.id, n]));
    const rot: MappeNode[] = [];
    for (const n of noder) {
      if (n.parentId && map.has(n.parentId)) {
        map.get(n.parentId)!.children.push(n);
      } else {
        rot.push(n);
      }
    }
    return rot;
  }, [mapper]);

  // Finn valgt dokument-info
  const valgtDokInfo = dokumentData?.dokumenter.find((d) => d.id === valgtDokumentId);
  const valgtSpråkInfo = STOETTEDE_SPRAAK.find((s) => s.kode === språk);

  if (embed && valgtDokumentId && blokkData) {
    // Embed-modus: kun reader-innhold (for mobil WebView)
    return (
      <div className="p-4">
        <SpråkVelgerBar
          tilgjengelige={blokkData.tilgjengeligeSprak}
          valgt={språk}
          onChange={setSpråk}
        />
        <BlokkVisning blokker={blokkData.blokker} highlight="" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toppseksjon */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <BookOpen className="h-5 w-5 text-sitedoc-primary" />
        <h1 className="text-lg font-semibold">{t("nav.mapper")}</h1>
        {valgtDokInfo && (
          <>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {valgtDokInfo.titler[språk] ?? valgtDokInfo.titler.nb ?? valgtDokInfo.filename}
            </span>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Venstre: mapper + dokumenter */}
        <div className="w-80 shrink-0 overflow-y-auto border-r bg-white">
          {/* Mappetre */}
          <div className="p-3">
            {mappeTre.map((mappe) => (
              <MappeRad
                key={mappe.id}
                mappe={mappe}
                valgtMappeId={valgtMappeId}
                onVelg={(id) => {
                  setValgtMappeId(id);
                  setValgtDokumentId(null);
                }}
                dybde={0}
              />
            ))}
          </div>

          {/* Dokumenter i valgt mappe */}
          {valgtMappeId && dokumentData && (
            <div className="border-t px-3 py-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                {dokumentData.dokumenter.length} {t("okonomi.dokumenter").toLowerCase()}
              </p>
              {dokumentData.dokumenter.map((dok) => {
                const tittel = dok.titler[språk] ?? dok.titler.nb ?? dok.filename.replace(/\.pdf$/i, "");
                const harSpråk = dok.tilgjengeligeSprak.length > 1;
                const erValgt = dok.id === valgtDokumentId;

                return (
                  <button
                    key={dok.id}
                    onClick={() => {
                      setValgtDokumentId(dok.id);
                      // Velg brukerens språk hvis tilgjengelig, ellers nb
                      if (dok.tilgjengeligeSprak.includes(i18n.language)) {
                        setSpråk(i18n.language);
                      } else {
                        setSpråk("nb");
                      }
                    }}
                    className={`mb-1 flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      erValgt
                        ? "bg-sitedoc-primary/10 text-sitedoc-primary"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{tittel}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        {harSpråk && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                            <Globe className="h-3 w-3" />
                            {dok.tilgjengeligeSprak.map((k) => {
                              const info = STOETTEDE_SPRAAK.find((s) => s.kode === k);
                              return info?.flagg ?? k;
                            }).join(" ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {dokumentData.dokumenter.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">{t("mapper.tom")}</p>
              )}
            </div>
          )}
        </div>

        {/* Høyre: Reader View */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {lasterBlokker ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : valgtDokumentId && blokkData && blokkData.blokker.length > 0 ? (
            <div className="mx-auto max-w-3xl px-6 py-6">
              {/* Språkvelger */}
              <SpråkVelgerBar
                tilgjengelige={blokkData.tilgjengeligeSprak}
                valgt={språk}
                onChange={setSpråk}
              />
              {/* Innhold */}
              <BlokkVisning blokker={blokkData.blokker} highlight="" />
            </div>
          ) : valgtDokumentId ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="text-sm">{t("tom.ingenData")}</p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
              <BookOpen className="h-12 w-12 text-gray-300" />
              <p className="text-sm">{t("mapper.velgMappe")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mappetrerad                                                        */
/* ------------------------------------------------------------------ */

function MappeRad({
  mappe,
  valgtMappeId,
  onVelg,
  dybde,
}: {
  mappe: {
    id: string;
    name: string;
    languages: string[];
    children: Array<{ id: string; name: string; languages: string[]; children: unknown[]; harDokumenter: boolean }>;
    harDokumenter: boolean;
  };
  valgtMappeId: string | null;
  onVelg: (id: string) => void;
  dybde: number;
}) {
  const [åpen, setÅpen] = useState(dybde < 1);
  const harBarn = mappe.children.length > 0;
  const erValgt = mappe.id === valgtMappeId;
  const harFlereSpråk = mappe.languages.length > 1;

  return (
    <div>
      <button
        onClick={() => {
          onVelg(mappe.id);
          if (harBarn) setÅpen(!åpen);
        }}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm transition-colors ${
          erValgt ? "bg-sitedoc-primary/10 font-medium text-sitedoc-primary" : "text-gray-700 hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${dybde * 16 + 8}px` }}
      >
        {harBarn ? (
          åpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        ) : (
          <span className="w-3.5" />
        )}
        <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="truncate">{mappe.name}</span>
        {harFlereSpråk && <Globe className="h-3 w-3 shrink-0 text-sitedoc-primary" />}
      </button>
      {åpen &&
        harBarn &&
        mappe.children.map((barn) => (
          <MappeRad
            key={barn.id}
            mappe={barn as typeof mappe}
            valgtMappeId={valgtMappeId}
            onVelg={onVelg}
            dybde={dybde + 1}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Språkvelger                                                        */
/* ------------------------------------------------------------------ */

function SpråkVelgerBar({
  tilgjengelige,
  valgt,
  onChange,
}: {
  tilgjengelige: string[];
  valgt: string;
  onChange: (kode: string) => void;
}) {
  if (tilgjengelige.length <= 1) return null;

  return (
    <div className="mb-6 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
      {tilgjengelige.map((kode) => {
        const info = STOETTEDE_SPRAAK.find((s) => s.kode === kode);
        return (
          <button
            key={kode}
            onClick={() => onChange(kode)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              kode === valgt
                ? "bg-sitedoc-primary text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{info?.flagg ?? "🌐"}</span>
            <span className="hidden sm:inline">{info?.navn ?? kode}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Blokkvisning (gjenbrukt fra reader view)                           */
/* ------------------------------------------------------------------ */

function BlokkVisning({
  blokker,
  highlight,
}: {
  blokker: Array<{
    id: string;
    blockType: string;
    content: string;
    headingLevel: number | null;
    imageUrl: string | null;
  }>;
  highlight: string;
}) {
  return (
    <>
      {blokker.map((blokk) => {
        const innhold = highlightTekst(blokk.content, highlight);

        switch (blokk.blockType) {
          case "heading": {
            const Tag = `h${Math.min(blokk.headingLevel ?? 2, 6)}` as keyof JSX.IntrinsicElements;
            const størrelse = {
              1: "text-2xl font-bold mt-10 mb-4",
              2: "text-xl font-bold mt-8 mb-3",
              3: "text-lg font-semibold mt-6 mb-2",
              4: "text-base font-semibold mt-5 mb-2",
              5: "text-sm font-semibold mt-4 mb-1",
              6: "text-sm font-medium mt-3 mb-1",
            }[blokk.headingLevel ?? 2] ?? "text-lg font-semibold mt-6 mb-2";

            return (
              <Tag
                key={blokk.id}
                className={`text-gray-900 ${størrelse}`}
                dangerouslySetInnerHTML={{ __html: innhold }}
              />
            );
          }
          case "text":
            return (
              <div
                key={blokk.id}
                className="mb-4 whitespace-pre-wrap text-base leading-7 text-gray-800"
                dangerouslySetInnerHTML={{ __html: innhold }}
              />
            );
          case "image":
            return blokk.imageUrl ? (
              <figure key={blokk.id} className="my-6">
                <img
                  src={`/api${blokk.imageUrl}`}
                  alt=""
                  className="mx-auto max-h-96 rounded-lg border border-gray-200 shadow-sm"
                  loading="lazy"
                />
              </figure>
            ) : null;
          case "caption":
            return (
              <figcaption
                key={blokk.id}
                className="mb-6 text-center text-sm italic text-gray-500"
                dangerouslySetInnerHTML={{ __html: innhold }}
              />
            );
          default:
            return (
              <p key={blokk.id} className="mb-4 text-gray-700">
                {blokk.content}
              </p>
            );
        }
      })}
    </>
  );
}

function highlightTekst(tekst: string, query: string): string {
  if (!query.trim()) return escapeHtml(tekst);
  const escaped = escapeHtml(tekst);
  const ord = query.split(/\s+/).filter((o) => o.length > 2);
  if (ord.length === 0) return escaped;
  const mønster = new RegExp(`(${ord.map(escapeRegex).join("|")})`, "gi");
  return escaped.replace(mønster, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
