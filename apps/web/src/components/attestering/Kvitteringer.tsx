"use client";

import { useTranslation } from "react-i18next";
import { Paperclip } from "lucide-react";
import { SignertBilde } from "@/components/SignertBilde";
import { SignertLenke } from "@/components/SignertLenke";
import type { AttVedlegg } from "./attestering-tabell";

/**
 * Kvitteringene på et utlegg (ordre d2b-3, d): attestanten åpner og kontrollerer dem før
 * ✓ — «ellers godkjenner vi noe vi ikke har lest». Samme visning som timer-detaljen
 * (`SignertLenke` + `SignertBilde`, signatur fra serveren, selvfornyende). Bilde vises som
 * miniatyr; annet (PDF) som binders. Begge åpner fila i ny fane.
 *
 * w10a (A8, B31 B): brukt på utleggslinja i tabellen og under «Utlegg» i kortet — egen fil, så
 * kortet ikke importerer tabellen (som importerer kortet).
 */
export function Kvitteringer({ vedlegg }: { vedlegg: readonly AttVedlegg[] }) {
  const { t } = useTranslation();
  if (vedlegg.length === 0) return null;
  return (
    <>
      {vedlegg.map((v) => (
        <SignertLenke
          key={v.id}
          url={v.fileUrl}
          nyFane
          title={t("timer.attestering.tabell.aapneKvittering", { fil: v.fileName })}
          className="inline-flex shrink-0 items-center rounded hover:opacity-80"
        >
          {v.mimeType.startsWith("image/") ? (
            <SignertBilde url={v.fileUrl} alt={t("timer.vedlegg.tittel")} className="h-6 w-6 rounded border border-gray-200 object-cover" />
          ) : (
            <Paperclip className="h-4 w-4 text-gray-600" />
          )}
        </SignertLenke>
      ))}
    </>
  );
}
