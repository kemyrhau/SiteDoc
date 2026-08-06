"use client";

import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Users, User, AlertTriangle, ArrowRight, X } from "lucide-react";
import { HmsBehandlerHandlinger, type HmsKontakt } from "./HmsBehandlerHandlinger";
import { finnHmsGruppe, byggHmsKontakter, type HmsGruppe } from "./hms-utils";

/**
 * HMS-flyten i dokumentflyt-oppsettet (Ordre 2.1 §4 synlighet + §1 melder-regel + §2
 * behandler-kilde). HMS-flyten er auto-provisjonert med faggruppeId=null og ble derfor
 * usynlig i den faggruppe-grupperte lista. Vises her som en ordinær 2-ledds flyt:
 *
 *  - Melder (§1): «Følger kontaktlisten · N» — ren avlesning av det eksisterende
 *    null-medlem-leddet (alle prosjektkontakter, nye arver uten handling). Redigerbare
 *    unntak er gatet ut til egen skjema-ordre.
 *  - Behandler (§2): firmaets HMS-ansvarlige (fra firma, read-only) + prosjekt-tillegg
 *    (lagt til i prosjektet via HMS-gruppa). Kilden merkes tydelig. Tomt → 0-medlem-varsel.
 *
 * Selv-innkapslet (henter egne data) så touchen i dokumentflyt/page.tsx blir minimal.
 */
export function HmsFlytKort({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: grupper } = trpc.gruppe.hentForProsjekt.useQuery({ projectId: prosjektId });
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery({ projectId: prosjektId });
  const { data: firmaAnsvarlige } = trpc.gruppe.hentHmsAnsvarlige.useQuery({ projectId: prosjektId });

  const fjernMedlem = trpc.gruppe.fjernMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const hmsGruppe = finnHmsGruppe(grupper as unknown as HmsGruppe[] | undefined);
  if (!hmsGruppe) return null;

  const antallKontakter = medlemmer?.length ?? 0;
  const kontakter: HmsKontakt[] = byggHmsKontakter(
    (medlemmer as Array<{ id: string; user: { name: string | null; email: string } }> | undefined),
    hmsGruppe,
  );

  // Firma-kilde: userId-sett for å skille «fra firma» fra «lagt til i prosjektet»
  const firmaUserIder = new Set((firmaAnsvarlige ?? []).map((f) => f.userId));

  // Prosjekt-tillegg = HMS-gruppemedlemmer som ikke allerede er firma-HMS-ansvarlige
  // (unngår dobbel-listing når en firma-ansvarlig også har meldt seg inn i prosjektet).
  const prosjektTillegg = hmsGruppe.members
    .filter((m) => m.projectMember && !firmaUserIder.has(m.projectMember.user.id))
    .map((m) => ({
      gruppeMedlemId: m.id,
      navn: m.projectMember!.user.name,
    }));

  const behandlerTom = (firmaAnsvarlige?.length ?? 0) === 0 && prosjektTillegg.length === 0;

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t("hms.flytSeksjon")}
      </h3>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
      {/* Flyt-tittel */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-stretch overflow-hidden rounded border border-violet-200 text-xs">
          <span className="inline-flex items-center gap-0.5 bg-violet-600 px-2 py-0.5 font-bold text-white">
            {t("kontaktside.flytChip")}
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
          <span className="bg-violet-50 px-2 py-0.5 font-semibold text-gray-800">{t("hms.flytNavn")}</span>
        </span>
        <span className="text-xs text-gray-500">{t("hms.flyt.behandlesPerProsjekt")}</span>
      </div>

      {/* Ledd: Melder → Behandler */}
      <div className="flex items-stretch gap-2">
        {/* Melder (§1) */}
        <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t("hms.flyt.melder")}
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            {t("hms.flyt.folgerKontaktlisten", { antall: antallKontakter })}
          </span>
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">{t("hms.flyt.melderRegel")}</p>
        </div>

        <div className="flex items-center">
          <ArrowRight className="h-5 w-5 text-gray-300" />
        </div>

        {/* Behandler (§2) */}
        <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t("hms.flyt.behandler")}
            {behandlerTom && (
              <span className="inline-flex items-center gap-1 normal-case tracking-normal text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {t("hms.ingenBehandlere")}
              </span>
            )}
          </div>

          {/* Firma-kilde (read-only) */}
          {(firmaAnsvarlige ?? []).map((f) => (
            <div key={f.userId} className="mb-0.5 flex items-center gap-1.5 text-sm text-gray-700">
              <User className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="flex-1 truncate">{f.navn ?? f.epost}</span>
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                {t("hms.flyt.fraFirma")}
              </span>
            </div>
          ))}

          {/* Prosjekt-tillegg (kan fjernes) */}
          {prosjektTillegg.map((p) => (
            <div key={p.gruppeMedlemId} className="group/pt mb-0.5 flex items-center gap-1.5 text-sm text-gray-700">
              <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="flex-1 truncate">{p.navn ?? "—"}</span>
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                {t("hms.flyt.lagtTilIProsjektet")}
              </span>
              <button
                onClick={() => fjernMedlem.mutate({ id: p.gruppeMedlemId, projectId: prosjektId })}
                className="shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover/pt:opacity-100"
                title={t("handling.fjern")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <div className="mt-2">
            <HmsBehandlerHandlinger prosjektId={prosjektId} hmsGruppeId={hmsGruppe.id} kontakter={kontakter} />
          </div>
        </div>
      </div>

        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{t("hms.flyt.forklaring")}</p>
      </div>
    </div>
  );
}
