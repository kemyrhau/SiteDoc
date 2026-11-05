"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Users, User, AlertTriangle, ArrowRight, X } from "lucide-react";
import { HmsBehandlerHandlinger } from "./HmsBehandlerHandlinger";
import { finnHmsGruppe, type HmsGruppe } from "./hms-utils";
import { PersonNavn } from "@/components/PersonNavn";
import { FjernHmsAnsvarligModal } from "./FjernHmsAnsvarligModal";

/**
 * HMS-flyten i dokumentflyt-oppsettet (Ordre 2.1 §4 synlighet + §1 melder-regel + §2
 * behandler-kilde). HMS-flyten er auto-provisjonert med faggruppeId=null og ble derfor
 * usynlig i den faggruppe-grupperte lista. Vises her som en ordinær 2-ledds flyt:
 *
 *  - Melder (§1): «Følger kontaktlisten · N» — ren avlesning av det eksisterende
 *    null-medlem-leddet (alle prosjektkontakter, nye arver uten handling). Redigerbare
 *    unntak er gatet ut til egen skjema-ordre.
 *  - Behandler (§2): firmaets HMS-ansvarlige (fra firma) + prosjekt-tillegg (lagt til i
 *    prosjektet via HMS-gruppa). Kilden merkes tydelig. Tomt → 0-medlem-varsel.
 *    Ordre (9): firma-admin i firmaet som ga rollen kan fjerne den herfra (modal, gjelder
 *    hele firmaet); andre ser hvor rollen settes. Prosjekt-tillegg har alltid synlig X.
 *
 * Selv-innkapslet (henter egne data) så touchen i dokumentflyt/page.tsx blir minimal.
 */
export function HmsFlytKort({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: grupper } = trpc.gruppe.hentForProsjekt.useQuery({ projectId: prosjektId });
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery({ projectId: prosjektId });
  const { data: firmaAnsvarlige } = trpc.gruppe.hentHmsAnsvarlige.useQuery({ projectId: prosjektId });
  const [fjernFirma, setFjernFirma] = useState<
    { userId: string; navn: string; organizationId: string; organisasjonNavn: string } | null
  >(null);

  const fjernMedlem = trpc.gruppe.fjernMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const hmsGruppe = finnHmsGruppe(grupper as unknown as HmsGruppe[] | undefined);
  if (!hmsGruppe) return null;

  const antallKontakter = medlemmer?.length ?? 0;

  // Firma-kilde: userId-sett for å skille «fra firma» fra «lagt til i prosjektet»
  const firmaUserIder = new Set((firmaAnsvarlige ?? []).map((f) => f.userId));

  // Prosjekt-tillegg = HMS-gruppemedlemmer som ikke allerede er firma-HMS-ansvarlige
  // (unngår dobbel-listing når en firma-ansvarlig også har meldt seg inn i prosjektet).
  const prosjektTillegg = hmsGruppe.members
    .filter((m) => m.projectMember && !firmaUserIder.has(m.projectMember.user.id))
    .map((m) => ({
      gruppeMedlemId: m.id,
      projectMemberId: m.projectMember!.id,
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
          <div className="mb-0.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t("hms.flyt.behandler")}
            {behandlerTom && (
              <span className="inline-flex items-center gap-1 normal-case tracking-normal text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {t("hms.ingenBehandlere")}
              </span>
            )}
          </div>
          {/* Presiser at behandling skjer på DETTE prosjektet — «firmaets HMS-ansvarlige»
              skal ikke feillede mot firma-oversikten (org-gatet, egen flate). */}
          <p className="mb-1.5 text-[10.5px] leading-snug text-gray-500">{t("hms.flyt.behandlerPaProsjekt")}</p>

          {/* Firma-kilde: fjernes bare av firma-admin i firmaet som ga rollen */}
          {(firmaAnsvarlige ?? []).map((f) => (
            <div key={f.userId} className="mb-0.5 flex items-center gap-1.5 text-sm text-gray-700">
              <User className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <PersonNavn prosjektId={prosjektId} navn={f.navn} userId={f.userId} epost={f.epost} />
              <span
                className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
                title={f.kanFjerne ? undefined : t("hms.flyt.settesAvFirmaAdmin")}
              >
                {t("hms.flyt.fraFirma")}
              </span>
              {f.kanFjerne && (
                <button
                  onClick={() => setFjernFirma({ userId: f.userId, navn: f.navn ?? f.epost, organizationId: f.organizationId, organisasjonNavn: f.organisasjonNavn })}
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-600"
                  title={t("hms.flyt.fjernFraFirma", { firma: f.organisasjonNavn })}
                  aria-label={t("hms.flyt.fjernFraFirma", { firma: f.organisasjonNavn })}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Prosjekt-tillegg (kan fjernes) */}
          {prosjektTillegg.map((p) => (
            <div key={p.gruppeMedlemId} className="mb-0.5 flex items-center gap-1.5 text-sm text-gray-700">
              <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <PersonNavn prosjektId={prosjektId} navn={p.navn} projectMemberId={p.projectMemberId} />
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                {t("hms.flyt.lagtTilIProsjektet")}
              </span>
              <button
                onClick={() => fjernMedlem.mutate({ id: p.gruppeMedlemId, projectId: prosjektId })}
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-600"
                title={t("handling.fjern")}
                aria-label={t("handling.fjern")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <div className="mt-2">
            <HmsBehandlerHandlinger prosjektId={prosjektId} hmsGruppeId={hmsGruppe.id} />
          </div>
        </div>
      </div>

        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{t("hms.flyt.forklaring")}</p>
      </div>

      <FjernHmsAnsvarligModal
        ansvarlig={fjernFirma}
        onClose={() => setFjernFirma(null)}
        onFjernet={() => utils.gruppe.hentHmsAnsvarlige.invalidate({ projectId: prosjektId })}
      />
    </div>
  );
}
