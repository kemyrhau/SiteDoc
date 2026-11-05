"use client";

import { trpc } from "@/lib/trpc";
import { UserMinus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

// Bekreftelse for deaktivering — en tilgangsendring som rammer en person, så egen
// modal (ikke confirm()). Mikrotekst-standard: sier hva som skjer (mister tilgang til
// firmaets prosjekter) OG hva som IKKE skjer (alt personen har ført/opprettet står
// urørt med ham som forfatter).
export function DeaktiverModal({
  bruker,
  organizationId,
  onLukk,
  onSuksess,
}: {
  bruker: { id: string; name: string | null };
  organizationId: string;
  onLukk: () => void;
  onSuksess: () => void;
}) {
  const { t } = useTranslation();
  const deaktiver = trpc.organisasjon.settAnsattStatus.useMutation({
    onSuccess: () => onSuksess(),
  });
  const navn = bruker.name ?? t("firma.ansatte.utenNavn");
  // L3: hva deaktiveringen avslutter — samme utvalg som settAnsattStatus bruker.
  const forhandsvis = trpc.organisasjon.forhandsvisDeaktivering.useQuery({
    userId: bruker.id,
    organizationId,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <UserMinus className="h-4 w-4 text-red-500" />
            {t("firma.ansatte.deaktiver.tittel", { navn })}
          </h2>
          <button
            onClick={onLukk}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t("handling.avbryt")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-700">
            {t("firma.ansatte.deaktiver.hva", { navn })}
          </p>
          <DeaktiverOppsummering
            navn={navn}
            data={forhandsvis.data}
            laster={forhandsvis.isLoading}
            feilet={forhandsvis.isError}
          />
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
            {t("firma.ansatte.deaktiver.ikke")}
          </p>
          {deaktiver.isError && (
            <p className="text-sm text-red-500">{deaktiver.error.message}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onLukk}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            <button
              type="button"
              onClick={() =>
                deaktiver.mutate({
                  userId: bruker.id,
                  organizationId,
                  aktiv: false,
                })
              }
              // Ordre (12) E: uten forhåndsvisning vet ikke admin hva som avsluttes —
              // Deaktiver sperres; feilmeldingen står og modalen kan lukkes.
              disabled={deaktiver.isPending || forhandsvis.isError}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deaktiver.isPending
                ? t("firma.ansatte.deaktiver.lagrer")
                : t("firma.ansatte.deaktiver.bekreft")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Forhandsvisning {
  prosjekter: Array<{ id: string; navn: string }>;
  antallFlytledd: number;
  antallTilInnsender: number;
  antallHmsSaker: number;
  alene: Array<{ prosjektNavn: string; flytNavn: string }>;
  hoppetOver: Array<{ id: string; navn: string; grunn: string }>;
}

// Oppsummering i DeaktiverModal (spec § 3.2): berørte prosjekter og flytledd, dokumenter som
// går til innsender (M3), ledd der personen står alene (ballen blir liggende på leddet), og
// prosjekter som beholdes fordi
// personen er ansatt i et annet firma (Kenneths vilkår).
export function DeaktiverOppsummering({
  navn,
  data,
  laster,
  feilet,
}: {
  navn: string;
  data: Forhandsvisning | undefined;
  laster: boolean;
  feilet: boolean;
}) {
  const { t } = useTranslation();
  // M2 (dom 32): en feilet forhåndsvisning sies tydelig; Avbryt/lukk står alltid.
  if (feilet) {
    return <p className="text-sm text-red-500">{t("firma.ansatte.deaktiver.feil")}</p>;
  }
  if (laster) {
    return <p className="text-sm text-gray-400">{t("firma.ansatte.deaktiver.laster")}</p>;
  }
  if (!data) return null;
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <p>
        {data.prosjekter.length === 0
          ? t("firma.ansatte.deaktiver.ingenProsjekter", { navn })
          : t("firma.ansatte.deaktiver.berorte", {
              navn,
              prosjekter: data.prosjekter.length,
              ledd: data.antallFlytledd,
            })}
      </p>
      {data.antallTilInnsender > 0 && (
        <p>{t("firma.ansatte.deaktiver.tilInnsender", { navn, antall: data.antallTilInnsender })}</p>
      )}
      {data.antallHmsSaker > 0 && (
        <p>{t("firma.ansatte.deaktiver.hmsSaker", { navn, antall: data.antallHmsSaker })}</p>
      )}
      {data.alene.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          <p>{t("firma.ansatte.deaktiver.aleneTittel", { navn })}</p>
          <ul className="mt-1 list-disc pl-5">
            {data.alene.map((l, i) => (
              <li key={i}>
                {l.prosjektNavn} · {l.flytNavn}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.hoppetOver.length > 0 && (
        <div>
          <p>{t("firma.ansatte.deaktiver.beholdesTittel", { navn })}</p>
          <ul className="mt-1 list-disc pl-5 text-gray-500">
            {data.hoppetOver.map((h) => (
              <li key={h.id}>
                {h.navn} — {t(`firma.ansatte.deaktiver.grunn.${h.grunn}`)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
