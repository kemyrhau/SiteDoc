"use client";

import { useState, useEffect, useRef } from "react";
import { Link2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface NotatEditorProps {
  specPostId: string | null;
  eksternNotat: string | null;
  poster?: Array<{ id: string; postnr: string | null; beskrivelse: string | null }>;
}

export function NotatEditor({ specPostId, eksternNotat, poster }: NotatEditorProps) {
  const [tekst, setTekst] = useState(eksternNotat ?? "");
  const [visReferanse, setVisReferanse] = useState(false);
  const [refSøk, setRefSøk] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    setTekst(eksternNotat ?? "");
    setVisReferanse(false);
  }, [eksternNotat, specPostId]);

  const { mutate: lagre, isPending } = trpc.mengde.lagreNotat.useMutation({
    onSuccess: () => {
      utils.mengde.hentSpecPoster.invalidate();
    },
  });

  if (!specPostId) {
    return (
      <div className="text-sm text-gray-400">
        Velg en post for å legge til merknad.
      </div>
    );
  }

  const filtrertePoster = poster && refSøk.length >= 1
    ? poster
        .filter((p) => {
          const søk = refSøk.toLowerCase();
          return (
            p.id !== specPostId &&
            (p.postnr?.toLowerCase().includes(søk) ||
              p.beskrivelse?.toLowerCase().includes(søk))
          );
        })
        .slice(0, 8)
    : [];

  function leggTilReferanse(post: { postnr: string | null; beskrivelse: string | null }) {
    const ref = `[${post.postnr}] ${(post.beskrivelse ?? "").slice(0, 80)}`;
    const ny = tekst ? tekst + "\n→ " + ref : "→ " + ref;
    setTekst(ny);
    setVisReferanse(false);
    setRefSøk("");
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-500">
        Ekstern merknad
      </label>
      <textarea
        ref={textareaRef}
        className="w-full rounded border border-gray-300 p-2 text-sm"
        rows={3}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder="Skriv merknad..."
      />
      <div className="flex items-center gap-2">
        <button
          className="rounded bg-sitedoc-primary px-3 py-1 text-xs text-white disabled:opacity-50"
          onClick={() => lagre({ specPostId, tekst })}
          disabled={isPending || tekst === (eksternNotat ?? "")}
        >
          {isPending ? "Lagrer..." : "Lagre"}
        </button>
        {poster && poster.length > 0 && (
          <button
            onClick={() => { setVisReferanse(!visReferanse); setRefSøk(""); }}
            className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            <Link2 className="h-3 w-3" />
            Referanse
          </button>
        )}
      </div>
      {visReferanse && (
        <div className="rounded border bg-white p-2 shadow-sm">
          <input
            type="text"
            className="w-full rounded border px-2 py-1 text-xs"
            placeholder="Søk postnr eller beskrivelse..."
            value={refSøk}
            onChange={(e) => setRefSøk(e.target.value)}
            autoFocus
          />
          {filtrertePoster.length > 0 && (
            <ul className="mt-1 max-h-40 overflow-auto">
              {filtrertePoster.map((p) => (
                <li key={p.id}>
                  <button
                    className="flex w-full gap-2 rounded px-2 py-1 text-left text-xs hover:bg-gray-100"
                    onClick={() => leggTilReferanse(p)}
                  >
                    <span className="shrink-0 font-mono font-medium text-gray-700">{p.postnr}</span>
                    <span className="truncate text-gray-500">{(p.beskrivelse ?? "").slice(0, 60)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {refSøk.length >= 1 && filtrertePoster.length === 0 && (
            <div className="mt-1 px-2 py-1 text-xs text-gray-400">Ingen treff</div>
          )}
        </div>
      )}
    </div>
  );
}
