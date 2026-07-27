"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal } from "@sitedoc/ui";
import { Plug, Plus, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const INTEGRASJON_TYPER = ["proadm", "hr", "gps", "smartdoc", "reginn"] as const;
type IntegrasjonsType = (typeof INTEGRASJON_TYPER)[number];

const TYPE_LABEL: Record<IntegrasjonsType, string> = {
  proadm: "Proadm",
  hr: "HR-system",
  gps: "GPS",
  smartdoc: "SmartDoc",
  reginn: "Reginn MREG",
};

type IntegrasjonData = {
  id: string;
  type: string;
  url: string | null;
  harNøkkel: boolean;
  aktiv: boolean;
  createdAt: string | Date;
  config: unknown;
};

type Innstillinger = {
  timezone: string;
  dagsnorm: number;
  timerTilgangDefault: string;
  vareforbrukTilgangDefault: string;
  maskinbrukTilgangDefault: string;
} | null;

type ModalState = {
  integrasjonId?: string;
  type: IntegrasjonsType;
  url: string;
  apiKey: string;
  aktiv: boolean;
  harEksisterendeNøkkel: boolean;
} | null;

export function InnstillingerFane({
  organizationId,
  innstillinger,
}: {
  organizationId: string;
  innstillinger: Innstillinger;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const intQuery = trpc.admin.hentIntegrasjonerForOrg.useQuery({ organizationId });
  const integrasjoner = intQuery.data as IntegrasjonData[] | undefined;
  const brukteTyper = new Set(integrasjoner?.map((i) => i.type) ?? []);
  const ledigeTyper = INTEGRASJON_TYPER.filter((tp) => !brukteTyper.has(tp));

  const [modal, setModal] = useState<ModalState>(null);

  const invalidate = () => utils.admin.hentIntegrasjonerForOrg.invalidate({ organizationId });

  const opprett = trpc.admin.opprettIntegrasjon.useMutation({
    onSuccess: (_data: unknown) => {
      invalidate();
      setModal(null);
    },
  });
  const oppdater = trpc.admin.oppdaterIntegrasjon.useMutation({
    onSuccess: (_data: unknown) => {
      invalidate();
      setModal(null);
    },
  });
  const slett = trpc.admin.slettIntegrasjon.useMutation({ onSuccess: () => invalidate() });

  return (
    <div className="space-y-6">
      {/* Firmainnstillinger (read-only visning av eksisterende OrganizationSetting) */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t("admin.firmaDetalj.innstillinger.tittel")}</h3>
        {innstillinger ? (
          <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
            <Rad label={t("admin.firmaDetalj.innstillinger.tidssone")} verdi={innstillinger.timezone} />
            <Rad label={t("admin.firmaDetalj.innstillinger.dagsnorm")} verdi={`${innstillinger.dagsnorm}`} />
            <Rad label={t("admin.firmaDetalj.innstillinger.timerTilgang")} verdi={innstillinger.timerTilgangDefault} />
            <Rad label={t("admin.firmaDetalj.innstillinger.vareforbrukTilgang")} verdi={innstillinger.vareforbrukTilgangDefault} />
            <Rad label={t("admin.firmaDetalj.innstillinger.maskinbrukTilgang")} verdi={innstillinger.maskinbrukTilgangDefault} />
          </dl>
        ) : (
          <p className="text-sm text-gray-400">{t("admin.firmaDetalj.innstillinger.ingen")}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">{t("admin.firmaDetalj.innstillinger.redigerHint")}</p>
      </section>

      {/* Integrasjoner (CRUD) */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Plug className="h-3.5 w-3.5" />
          {t("admin.firmaDetalj.integrasjoner.tittel")}
        </h3>
        <div className="space-y-1.5">
          {(integrasjoner ?? []).map((int) => (
            <div key={int.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-2.5 text-xs">
              <div className="flex flex-1 items-center gap-2">
                <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-700">{int.type}</span>
                {int.url && <span className="truncate text-gray-500">{int.url}</span>}
                <span className={`flex items-center gap-1 ${int.aktiv ? "text-green-600" : "text-gray-400"}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${int.aktiv ? "bg-green-500" : "bg-gray-300"}`} />
                  {int.aktiv ? t("status.aktiv") : t("status.inaktiv")}
                </span>
                <span className="text-gray-400">{int.harNøkkel ? t("admin.firmaDetalj.integrasjoner.nokkel") : t("admin.firmaDetalj.integrasjoner.ingenNokkel")}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setModal({
                      integrasjonId: int.id,
                      type: int.type as IntegrasjonsType,
                      url: int.url ?? "",
                      apiKey: "",
                      aktiv: int.aktiv,
                      harEksisterendeNøkkel: int.harNøkkel,
                    })
                  }
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  title={t("handling.rediger")}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => slett.mutate({ id: int.id })}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  title={t("handling.slett")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {ledigeTyper.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ledigeTyper.map((tp) => (
                <button
                  key={tp}
                  onClick={() => setModal({ type: tp, url: "", apiKey: "", aktiv: true, harEksisterendeNøkkel: false })}
                  className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-500 hover:border-gray-400 hover:text-gray-700"
                >
                  <Plus className="h-3 w-3" />
                  {TYPE_LABEL[tp]}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Integrasjon-modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.integrasjonId ? t("admin.firmaDetalj.integrasjoner.rediger") : t("admin.firmaDetalj.integrasjoner.ny")}>
        {modal && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (modal.integrasjonId) {
                const apiKey = modal.apiKey.length > 0 ? modal.apiKey : undefined;
                oppdater.mutate({ id: modal.integrasjonId, url: modal.url || null, apiKey, aktiv: modal.aktiv });
              } else {
                opprett.mutate({
                  organizationId,
                  type: modal.type,
                  url: modal.url || undefined,
                  apiKey: modal.apiKey || undefined,
                  aktiv: modal.aktiv,
                });
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("tabell.type")}</label>
              {modal.integrasjonId ? (
                <p className="rounded bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">{TYPE_LABEL[modal.type]}</p>
              ) : (
                <select
                  value={modal.type}
                  onChange={(e) => setModal({ ...modal, type: e.target.value as IntegrasjonsType })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {INTEGRASJON_TYPER.map((tp) => (
                    <option key={tp} value={tp}>
                      {TYPE_LABEL[tp]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Input label="URL" value={modal.url} onChange={(e) => setModal({ ...modal, url: e.target.value })} placeholder="https://..." />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("admin.firmaDetalj.integrasjoner.apiNokkel")}</label>
              <input
                type="password"
                value={modal.apiKey}
                onChange={(e) => setModal({ ...modal, apiKey: e.target.value })}
                placeholder={modal.harEksisterendeNøkkel ? t("admin.firmaDetalj.integrasjoner.nokkelBeholdHint") : t("admin.firmaDetalj.integrasjoner.ingenNokkelRegistrert")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
              {modal.harEksisterendeNøkkel && <p className="mt-1 text-[11px] text-gray-400">{t("admin.firmaDetalj.integrasjoner.nokkelErstattHint")}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={modal.aktiv}
                onChange={(e) => setModal({ ...modal, aktiv: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {t("status.aktiv")}
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setModal(null)}>
                {t("handling.avbryt")}
              </Button>
              <Button type="submit" disabled={opprett.isPending || oppdater.isPending}>
                {modal.integrasjonId ? t("handling.lagre") : t("handling.opprett")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Rad({ label, verdi }: { label: string; verdi: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{verdi}</dd>
    </div>
  );
}
