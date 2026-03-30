"use client";

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Link2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export interface NotatEditorRef {
  leggTilReferanse: (post: { postnr: string | null; beskrivelse: string | null }) => void;
  erIReferanseModus: boolean;
}

interface NotatEditorProps {
  specPostId: string | null;
  eksternNotat: string | null;
}

export const NotatEditor = forwardRef<NotatEditorRef, NotatEditorProps>(
  function NotatEditor({ specPostId, eksternNotat }, ref) {
    const [tekst, setTekst] = useState(eksternNotat ?? "");
    const [referanseModus, setReferanseModus] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const utils = trpc.useUtils();

    useEffect(() => {
      setTekst(eksternNotat ?? "");
      setReferanseModus(false);
    }, [eksternNotat, specPostId]);

    const leggTilReferanse = useCallback(
      (post: { postnr: string | null; beskrivelse: string | null }) => {
        const ref = `[${post.postnr}] ${(post.beskrivelse ?? "").slice(0, 80)}`;
        setTekst((prev) => (prev ? prev + "\n→ " + ref : "→ " + ref));
        textareaRef.current?.focus();
      },
      [],
    );

    useImperativeHandle(ref, () => ({
      leggTilReferanse,
      erIReferanseModus: referanseModus,
    }), [leggTilReferanse, referanseModus]);

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
          <button
            onClick={() => setReferanseModus(!referanseModus)}
            className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${
              referanseModus
                ? "border-sitedoc-primary bg-blue-50 text-sitedoc-primary"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Link2 className="h-3 w-3" />
            {referanseModus ? "Klikk på en post i tabellen" : "Referanse"}
          </button>
        </div>
      </div>
    );
  },
);
