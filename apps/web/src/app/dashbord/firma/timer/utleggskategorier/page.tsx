"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import { AlertTriangle, Plus, Trash2, Info } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { DeaktiverKnapp } from "@/components/deaktiver/DeaktiverKnapp";
import { VisInaktiveToggle } from "@/components/deaktiver/VisInaktiveToggle";
import { InaktivBadge } from "@/components/deaktiver/InaktivBadge";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";

/**
 * U5 (2026-08-11) — firma-admin utleggs-ordning-flate.
 *  - Firma-default ordning per kategori (settOrdning).
 *  - Prosjekt-overstyring per kategori (settOverstyring/fjernOverstyring).
 *  - Navnekollisjon-varsel mot lønnstillegg-katalogen.
 *  - Immutabilitets-mikrotekst: ordning-endring rører aldri allerede førte rader.
 * Ordning-utledningen (overstyring ?? firma-default) eies av serveren (delt utledOrdning).
 */

// Modelljustering (2026-08-11): valgbare ordninger = {utlegg, lonnstillegg}.
// `fakturert` er tatt ut (gjeninnføres som `fakturavarsel` når varselet er bygget);
// `sats` omdøpt til `lonnstillegg` (homonym-fiks).
const ORDNINGER = ["utlegg", "lonnstillegg"] as const;

type Kategori = {
  id: string;
  navn: string;
  aktiv: boolean;
  firmaDefault: string;
  ordning: string;
  satsbasert: boolean;
  muligSkattepliktig: boolean;
  kilde: string;
};
type Overstyring = {
  id: string;
  prosjektId: string;
  prosjektNavn: string | null;
  prosjektNummer: string | null;
  expenseCategoryId: string;
  ordning: string;
};
type Prosjekt = { id: string; name: string; projectNumber?: string };

export default function UtleggskategorierSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const [aapenOverstyringFor, setAapenOverstyringFor] = useState<string | null>(null);
  const [nyOverstyringProsjekt, setNyOverstyringProsjekt] = useState("");
  const [nyOverstyringOrdning, setNyOverstyringOrdning] = useState<string>("utlegg");
  const [visInaktive, setVisInaktive] = useState(false);

  const { data: kategorier, isLoading } = trpc.timer.expenseCategory.list.useQuery(
    { organizationId: orgId!, inkluderInaktiv: true },
    { enabled: !!orgId },
  );
  const { data: tillegg } = trpc.timer.tillegg.list.useQuery(
    { organizationId: orgId!, inkluderInaktiv: true },
    { enabled: !!orgId },
  );
  const { data: overstyringer } = trpc.timer.expenseCategory.listOverstyringer.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const { data: prosjekterRaw } = trpc.organisasjon.hentProsjekter.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const prosjekter = (prosjekterRaw ?? []) as unknown as Prosjekt[];

  const invalider = () => {
    utils.timer.expenseCategory.list.invalidate();
    utils.timer.expenseCategory.listOverstyringer.invalidate();
  };
  const settOrdning = trpc.timer.expenseCategory.settOrdning.useMutation({
    onSuccess: invalider,
    onError: (e: { message: string }) => alert(e.message),
  });
  const settOverstyring = trpc.timer.expenseCategory.settOverstyring.useMutation({
    onSuccess: () => {
      invalider();
      setAapenOverstyringFor(null);
      setNyOverstyringProsjekt("");
    },
    onError: (e: { message: string }) => alert(e.message),
  });
  const fjernOverstyring = trpc.timer.expenseCategory.fjernOverstyring.useMutation({
    onSuccess: invalider,
    onError: (e: { message: string }) => alert(e.message),
  });
  const deaktiver = trpc.timer.expenseCategory.deaktiver.useMutation({
    onSuccess: invalider,
    onError: (e: { message: string }) => alert(e.message),
  });
  const aktiver = trpc.timer.expenseCategory.aktiver.useMutation({
    onSuccess: invalider,
    onError: (e: { message: string }) => alert(e.message),
  });
  const settMarkeringer = trpc.timer.expenseCategory.settMarkeringer.useMutation({
    onSuccess: invalider,
    onError: (e: { message: string }) => alert(e.message),
  });

  // Navnekollisjon mot lønnstillegg-katalogen (normalisert).
  const kollisjonKategoriIder = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    const tilleggNavn = new Set((tillegg ?? []).map((x) => norm(x.navn)));
    return new Set(
      ((kategorier ?? []) as Kategori[])
        .filter((k) => tilleggNavn.has(norm(k.navn)))
        .map((k) => k.id),
    );
  }, [kategorier, tillegg]);

  const overstyringerPerKategori = useMemo(() => {
    const m = new Map<string, Overstyring[]>();
    for (const o of (overstyringer ?? []) as Overstyring[]) {
      const liste = m.get(o.expenseCategoryId) ?? [];
      liste.push(o);
      m.set(o.expenseCategoryId, liste);
    }
    return m;
  }, [overstyringer]);

  const ordningLabel = (o: string) => t(`timer.utleggReg.ordning.${o}`);

  if (!orgId) {
    return <p className="p-6 text-sm text-gray-500">{t("firma.velgFirma")}</p>;
  }
  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }

  const alleKat = (kategorier ?? []) as Kategori[];
  const inaktivAntall = alleKat.filter((k) => !k.aktiv).length;
  const kat = visInaktive ? alleKat : alleKat.filter((k) => k.aktiv);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t("firma.timer.utleggskategorier.tittel")}
        </h1>
        <HjelpKnapp>
          <HjelpFane tittel={t("deaktiver.hjelp.tittel")}>
            <p>{t("deaktiver.hjelp.tekst")}</p>
          </HjelpFane>
        </HjelpKnapp>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {t("firma.timer.utleggskategorier.beskrivelse")}
      </p>

      {/* Immutabilitets-mikrotekst (penge-tekst, alltid synlig) */}
      <div className="mt-4 flex gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{t("firma.timer.utleggskategorier.immutabel")}</span>
      </div>

      {/* Navnekollisjon-banner */}
      {kollisjonKategoriIder.size > 0 && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{t("firma.timer.utleggskategorier.kollisjonBanner")}</span>
        </div>
      )}

      <div className="mt-5">
        <VisInaktiveToggle antall={inaktivAntall} checked={visInaktive} onChange={setVisInaktive} />
      </div>

      {kat.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          {t("firma.timer.utleggskategorier.ingenKategorier")}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {kat.map((k) => {
            const kollisjon = kollisjonKategoriIder.has(k.id);
            const katOverstyringer = overstyringerPerKategori.get(k.id) ?? [];
            const aapen = aapenOverstyringFor === k.id;
            // Prosjekter uten overstyring ennå (velgbare i add-form).
            const brukteProsjektIder = new Set(katOverstyringer.map((o) => o.prosjektId));
            const ledigeProsjekter = prosjekter.filter((p) => !brukteProsjektIder.has(p.id));
            return (
              <li key={k.id} className={`p-4 ${k.aktiv ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-medium ${k.aktiv ? "text-gray-900" : "text-gray-400"}`}>
                        {k.navn}
                      </span>
                      {!k.aktiv && <InaktivBadge />}
                      {kollisjon && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {t("firma.timer.utleggskategorier.kollisjonMerke")}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {t("firma.timer.utleggskategorier.firmaDefault")}
                    </span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <select
                      value={k.firmaDefault}
                      onChange={(e) =>
                        settOrdning.mutate({ organizationId: orgId, id: k.id, ordning: e.target.value as (typeof ORDNINGER)[number] })
                      }
                      disabled={settOrdning.isPending}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {ORDNINGER.map((o) => (
                        <option key={o} value={o}>
                          {ordningLabel(o)}
                        </option>
                      ))}
                    </select>
                    <DeaktiverKnapp
                      aktiv={k.aktiv}
                      pending={deaktiver.isPending || aktiver.isPending}
                      onClick={() =>
                        k.aktiv
                          ? deaktiver.mutate({ organizationId: orgId, id: k.id })
                          : aktiver.mutate({ organizationId: orgId, id: k.id })
                      }
                    />
                  </div>
                </div>

                {k.firmaDefault === "lonnstillegg" && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    {t("firma.timer.utleggskategorier.satsNote")}
                  </p>
                )}

                {/* Markeringer (metadata — endrer ikke bærer/ordning/eksport).
                    Kun relevante for utlegg-ordningen (refusjonssporet). */}
                {k.firmaDefault === "utlegg" && (
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 text-[12px] text-gray-600">
                      <input
                        type="checkbox"
                        checked={k.satsbasert}
                        disabled={settMarkeringer.isPending}
                        onChange={(e) =>
                          settMarkeringer.mutate({
                            organizationId: orgId,
                            id: k.id,
                            satsbasert: e.target.checked,
                          })
                        }
                      />
                      {t("firma.timer.utleggskategorier.satsbasert")}
                    </label>
                    <label className="flex items-center gap-1.5 text-[12px] text-gray-600">
                      <input
                        type="checkbox"
                        checked={k.muligSkattepliktig}
                        disabled={settMarkeringer.isPending}
                        onChange={(e) =>
                          settMarkeringer.mutate({
                            organizationId: orgId,
                            id: k.id,
                            muligSkattepliktig: e.target.checked,
                          })
                        }
                      />
                      {t("firma.timer.utleggskategorier.muligSkattepliktig")}
                    </label>
                  </div>
                )}

                {/* Prosjekt-overstyringer */}
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {t("firma.timer.utleggskategorier.overstyringer")}
                  </div>
                  {katOverstyringer.length > 0 && (
                    <ul className="mb-2 space-y-1">
                      {katOverstyringer.map((o) => (
                        <li key={o.id} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700">
                            {o.prosjektNavn ?? o.prosjektId}
                            {o.prosjektNummer ? ` (${o.prosjektNummer})` : ""}
                          </span>
                          {/* Inline-endring via upsert (settOverstyring) — ÉN operasjon,
                              ingen mellomtilstand der prosjektet faller til firma-default
                              og et utlegg kan bli stemplet feil (ordningVedFoering immutabel). */}
                          <select
                            value={o.ordning}
                            onChange={(e) =>
                              settOverstyring.mutate({
                                organizationId: orgId,
                                prosjektId: o.prosjektId,
                                expenseCategoryId: k.id,
                                ordning: e.target.value as (typeof ORDNINGER)[number],
                              })
                            }
                            disabled={settOverstyring.isPending}
                            className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px]"
                          >
                            {ORDNINGER.map((oo) => (
                              <option key={oo} value={oo}>
                                {ordningLabel(oo)}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              fjernOverstyring.mutate({
                                organizationId: orgId,
                                prosjektId: o.prosjektId,
                                expenseCategoryId: k.id,
                              })
                            }
                            disabled={fjernOverstyring.isPending}
                            className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title={t("handling.fjern")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {aapen ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={nyOverstyringProsjekt}
                        onChange={(e) => setNyOverstyringProsjekt(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">{t("firma.timer.utleggskategorier.velgProsjekt")}</option>
                        {ledigeProsjekter.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={nyOverstyringOrdning}
                        onChange={(e) => setNyOverstyringOrdning(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {ORDNINGER.map((o) => (
                          <option key={o} value={o}>
                            {ordningLabel(o)}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          nyOverstyringProsjekt &&
                          settOverstyring.mutate({
                            organizationId: orgId,
                            prosjektId: nyOverstyringProsjekt,
                            expenseCategoryId: k.id,
                            ordning: nyOverstyringOrdning as (typeof ORDNINGER)[number],
                          })
                        }
                        disabled={!nyOverstyringProsjekt || settOverstyring.isPending}
                      >
                        {t("handling.lagre")}
                      </Button>
                      <button
                        onClick={() => setAapenOverstyringFor(null)}
                        className="text-sm text-gray-500 hover:underline"
                      >
                        {t("handling.avbryt")}
                      </button>
                    </div>
                  ) : (
                    ledigeProsjekter.length > 0 && (
                      <button
                        onClick={() => {
                          setAapenOverstyringFor(k.id);
                          setNyOverstyringProsjekt("");
                          setNyOverstyringOrdning(k.firmaDefault);
                        }}
                        className="inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("firma.timer.utleggskategorier.leggTilOverstyring")}
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
