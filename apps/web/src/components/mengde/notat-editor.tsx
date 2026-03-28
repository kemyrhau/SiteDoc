"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

interface NotatEditorProps {
  specPostId: string | null;
  eksternNotat: string | null;
}

export function NotatEditor({ specPostId, eksternNotat }: NotatEditorProps) {
  const [tekst, setTekst] = useState(eksternNotat ?? "");
  const utils = trpc.useUtils();

  useEffect(() => {
    setTekst(eksternNotat ?? "");
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

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-500">
        Ekstern merknad
      </label>
      <textarea
        className="w-full rounded border border-gray-300 p-2 text-sm"
        rows={3}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder="Skriv merknad..."
      />
      <button
        className="rounded bg-sitedoc-primary px-3 py-1 text-xs text-white disabled:opacity-50"
        onClick={() => lagre({ specPostId, tekst })}
        disabled={isPending || tekst === (eksternNotat ?? "")}
      >
        {isPending ? "Lagrer..." : "Lagre"}
      </button>
    </div>
  );
}
