"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner } from "@sitedoc/ui";
import { Pencil, RotateCcw } from "lucide-react";
import { formaterKjoretid } from "@sitedoc/shared";
import { kontorAvstandStartverdier, tolkKontorAvstand } from "@/lib/kontorAvstandSkjema";

/* ============================================================================
 *  POST 2026-11-14 (10) B: fanen «Avstander» under Firma → Oppmøtesteder.
 *
 *  Én rad pr. byggeplass × aktivt oppmøtested. «Måles i» (firmainnstillinger)
 *  avgjør hovedverdien: km → avstand redigerbar, kjøretid grå; minutter →
 *  kjøretid redigerbar, avstand grå. En manuell verdi lagres med
 *  kilde="manuell" og overskrives aldri av beregningen (server-vakt).
 * ============================================================================ */

type Enhet = "minutter" | "km";

interface Celle {
  kjoretidMin: number;
  avstandM: number | null;
  kilde: string;
}

interface Rad {
  key: string;
  byggeplassId: string;
  byggeplassNavn: string;
  nummer: number | null;
  harPunkt: boolean;
  prosjektNavn: string;
  prosjektNummer: string;
  oppmotestedId: string;
  oppmotestedNavn: string;
  celle: Celle | null;
}

/** Hva en rettet verdi gjelder: kontor → byggeplass, eller kontor ↔ kontor (L2). */
type Maal =
  | { type: "byggeplass"; oppmotestedId: string; byggeplassId: string }
  | { type: "kontor"; oppmotestedIdA: string; oppmotestedIdB: string };

interface Redigering {
  undertittel: string;
  celle: Celle | null;
  maal: Maal;
}

function erManuell(kilde: string) {
  return kilde.startsWith("manuell");
}

function formaterKm(m: number) {
  return (m / 1000).toLocaleString("nb-NO", { maximumFractionDigits: 1 });
}

export function AvstanderFane({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.oppmotested.hentAvstander.useQuery({
    organizationId: orgId,
  });
  const [rediger, setRediger] = useState<Redigering | null>(null);

  const invalider = () => {
    void utils.oppmotested.hentAvstander.invalidate({ organizationId: orgId });
    void utils.oppmotested.hentKontorAvstanderForFirma.invalidate({ organizationId: orgId });
    void utils.oppmotested.hentMatriseForFirma.invalidate({ organizationId: orgId });
  };
  const beregn = trpc.oppmotested.beregnMatrise.useMutation({
    onSuccess: invalider,
    onError: (e) => alert(e.message),
  });
  const tilbakestill = trpc.oppmotested.tilbakestillAvstand.useMutation({
    onSuccess: invalider,
    onError: (e) => alert(e.message),
  });

  const rader = useMemo<Rad[]>(() => {
    if (!data) return [];
    const celler = new Map(
      data.rader.map((r) => [`${r.oppmotestedId}|${r.byggeplassId}`, r]),
    );
    const ut: Rad[] = [];
    for (const b of data.byggeplasser) {
      for (const o of data.oppmotesteder) {
        const c = celler.get(`${o.id}|${b.id}`) ?? null;
        // Byggeplass uten punkt vises kun for sine manuelle par.
        if (!b.harPunkt && !(c && erManuell(c.kilde))) continue;
        ut.push({
          key: `${o.id}|${b.id}`,
          byggeplassId: b.id,
          byggeplassNavn: b.navn,
          nummer: b.nummer,
          harPunkt: b.harPunkt,
          prosjektNavn: b.prosjekt.name,
          prosjektNummer: b.prosjekt.projectNumber,
          oppmotestedId: o.id,
          oppmotestedNavn: o.navn,
          celle: c,
        });
      }
    }
    return ut;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const enhet: Enhet = data.enhet;

  const redigerModal = rediger && (
    <RedigerAvstandModal
      orgId={orgId}
      enhet={enhet}
      redigering={rediger}
      onLukk={() => setRediger(null)}
      onLagret={() => {
        invalider();
        setRediger(null);
      }}
    />
  );
  // L2 beslutning 4: kontor ↔ kontor (OSRM, manuell overstyring) — vises når
  // firmaet har minst to oppmøtesteder; brukes til overføring mellom kontorer.
  const kontorDel =
    data.oppmotesteder.length >= 2 ? (
      <KontorAvstander
        orgId={orgId}
        enhet={enhet}
        oppmotesteder={data.oppmotesteder}
        onRediger={setRediger}
        onInvalider={invalider}
      />
    ) : null;

  if (data.oppmotesteder.length === 0 || rader.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          {data.oppmotesteder.length === 0
            ? t("firma.avstander.ingenOppmotesteder")
            : t("firma.avstander.ingenByggeplasser")}
        </div>
        {kontorDel}
        {redigerModal}
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <p className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">
        {enhet === "km" ? t("firma.avstander.malesIKm") : t("firma.avstander.malesIMin")}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
            <th className="px-3 py-3">{t("firma.avstander.felt.byggeplass")}</th>
            <th className="px-3 py-3">{t("firma.avstander.felt.prosjekt")}</th>
            <th className="px-3 py-3">{t("firma.avstander.felt.oppmotested")}</th>
            {enhet === "km" ? (
              <>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.avstand")}</th>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.kjoretidKolonne")}</th>
              </>
            ) : (
              <>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.kjoretidKolonne")}</th>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.avstand")}</th>
              </>
            )}
            <th className="px-3 py-3">{t("firma.avstander.felt.kilde")}</th>
            <th className="px-3 py-3 text-right">{t("handling.handlinger")}</th>
          </tr>
        </thead>
        <tbody>
          {rader.map((r) => {
            const c = r.celle;
            const uoppnaaelig = !!c && !erManuell(c.kilde) && c.kjoretidMin < 0;
            const km = c && c.avstandM != null && c.avstandM >= 0 ? formaterKm(c.avstandM) : null;
            // Ordre (11) B: «1 t 35 min» over én time, «45 min» under (delt formaterer).
            const min = c && c.kjoretidMin >= 0 ? formaterKjoretid(t, c.kjoretidMin) : null;
            const hoved = enhet === "km" ? km : min;
            const sekundaer = enhet === "km" ? min : km;
            return (
              <tr key={r.key} className="border-b border-gray-100 last:border-b-0">
                <td className="px-3 py-2.5 font-medium text-gray-900">
                  {r.nummer != null ? `${r.nummer}. ` : ""}
                  {r.byggeplassNavn}
                </td>
                <td className="px-3 py-2.5 text-gray-600">
                  {r.prosjektNummer} {r.prosjektNavn}
                </td>
                <td className="px-3 py-2.5 text-gray-600">{r.oppmotestedNavn}</td>
                {!c ? (
                  <td colSpan={2} className="px-3 py-2.5 text-right text-gray-400">
                    {t("firma.avstander.ikkeBeregnet")}
                  </td>
                ) : uoppnaaelig ? (
                  <td colSpan={2} className="px-3 py-2.5 text-right text-gray-500">
                    {t("firma.avstander.ingenRute")}
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums text-gray-900">
                      {hoved ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums text-gray-400">
                      {sekundaer ?? "—"}
                    </td>
                  </>
                )}
                <td className="px-3 py-2.5 text-gray-600">
                  {!c ? null : !erManuell(c.kilde) ? (
                    t("firma.avstander.kilde.beregnet")
                  ) : c.kilde === "manuell" && r.harPunkt ? (
                    t("firma.avstander.kilde.manuell")
                  ) : (
                    <span className="text-amber-700">
                      {r.harPunkt
                        ? t("firma.avstander.kilde.manuellEndret")
                        : t("firma.avstander.kilde.manuellUtenPunkt")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {!c && r.harPunkt && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          beregn.mutate({ organizationId: orgId, byggeplassId: r.byggeplassId })
                        }
                        disabled={beregn.isPending}
                      >
                        {t("firma.avstander.beregn")}
                      </Button>
                    )}
                    <button
                      onClick={() =>
                        setRediger({
                          undertittel: `${r.byggeplassNavn} · ${r.oppmotestedNavn}`,
                          celle: r.celle,
                          maal: {
                            type: "byggeplass",
                            oppmotestedId: r.oppmotestedId,
                            byggeplassId: r.byggeplassId,
                          },
                        })
                      }
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title={t("handling.rediger")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {c && erManuell(c.kilde) && (
                      <button
                        onClick={() =>
                          tilbakestill.mutate({
                            organizationId: orgId,
                            oppmotestedId: r.oppmotestedId,
                            byggeplassId: r.byggeplassId,
                          })
                        }
                        disabled={tilbakestill.isPending}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title={t("firma.avstander.tilbakestill")}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {kontorDel}
    {redigerModal}
    </div>
  );
}

/**
 * L2 (POST 2026-11-15 (13), beslutning 4): kjøretid/avstand mellom firmaets
 * oppmøtesteder. Ett par pr. rad (fra < til, samme normalisering som serveren).
 * Brukes når en arbeider overføres mellom kontorer (første/siste dag i perioden).
 */
function KontorAvstander({
  orgId,
  enhet,
  oppmotesteder,
  onRediger,
  onInvalider,
}: {
  orgId: string;
  enhet: Enhet;
  oppmotesteder: Array<{ id: string; navn: string }>;
  onRediger: (r: Redigering) => void;
  onInvalider: () => void;
}) {
  const { t } = useTranslation();
  const { data } = trpc.oppmotested.hentKontorAvstanderForFirma.useQuery({
    organizationId: orgId,
  });
  const beregn = trpc.oppmotested.beregnMatrise.useMutation({
    onSuccess: onInvalider,
    onError: (e) => alert(e.message),
  });
  const tilbakestill = trpc.oppmotested.tilbakestillKontorAvstand.useMutation({
    onSuccess: onInvalider,
    onError: (e) => alert(e.message),
  });

  const par = useMemo(() => {
    const celler = new Map(
      (data ?? []).map((r) => [`${r.fraOppmotestedId}|${r.tilOppmotestedId}`, r]),
    );
    const sortert = [...oppmotesteder].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const ut: Array<{ a: (typeof oppmotesteder)[number]; b: (typeof oppmotesteder)[number]; celle: Celle | null }> = [];
    for (let i = 0; i < sortert.length; i++) {
      for (let j = i + 1; j < sortert.length; j++) {
        const a = sortert[i]!;
        const b = sortert[j]!;
        ut.push({ a, b, celle: celler.get(`${a.id}|${b.id}`) ?? null });
      }
    }
    return ut;
  }, [data, oppmotesteder]);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <p className="text-sm font-medium text-gray-900">{t("firma.avstander.kontor.tittel")}</p>
        {par.some((p) => !p.celle) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => beregn.mutate({ organizationId: orgId })}
            disabled={beregn.isPending}
          >
            {t("firma.avstander.beregn")}
          </Button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
            <th className="px-3 py-3">{t("firma.avstander.kontor.mellom")}</th>
            {enhet === "km" ? (
              <>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.avstand")}</th>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.kjoretidKolonne")}</th>
              </>
            ) : (
              <>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.kjoretidKolonne")}</th>
                <th className="px-3 py-3 text-right">{t("firma.avstander.felt.avstand")}</th>
              </>
            )}
            <th className="px-3 py-3">{t("firma.avstander.felt.kilde")}</th>
            <th className="px-3 py-3 text-right">{t("handling.handlinger")}</th>
          </tr>
        </thead>
        <tbody>
          {par.map(({ a, b, celle: c }) => {
            const uoppnaaelig = !!c && !erManuell(c.kilde) && c.kjoretidMin < 0;
            const km = c && c.avstandM != null && c.avstandM >= 0 ? formaterKm(c.avstandM) : null;
            const min = c && c.kjoretidMin >= 0 ? formaterKjoretid(t, c.kjoretidMin) : null;
            const hoved = enhet === "km" ? km : min;
            const sekundaer = enhet === "km" ? min : km;
            const navn = `${a.navn} ↔ ${b.navn}`;
            return (
              <tr key={`${a.id}|${b.id}`} className="border-b border-gray-100 last:border-b-0">
                <td className="px-3 py-2.5 font-medium text-gray-900">{navn}</td>
                {!c ? (
                  <td colSpan={2} className="px-3 py-2.5 text-right text-gray-400">
                    {t("firma.avstander.ikkeBeregnet")}
                  </td>
                ) : uoppnaaelig ? (
                  <td colSpan={2} className="px-3 py-2.5 text-right text-gray-500">
                    {t("firma.avstander.ingenRute")}
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums text-gray-900">
                      {hoved ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums text-gray-400">
                      {sekundaer ?? "—"}
                    </td>
                  </>
                )}
                <td className="px-3 py-2.5 text-gray-600">
                  {!c
                    ? null
                    : erManuell(c.kilde)
                      ? t("firma.avstander.kilde.manuell")
                      : t("firma.avstander.kilde.beregnet")}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() =>
                        onRediger({
                          undertittel: navn,
                          celle: c,
                          maal: { type: "kontor", oppmotestedIdA: a.id, oppmotestedIdB: b.id },
                        })
                      }
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title={t("handling.rediger")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {c && erManuell(c.kilde) && (
                      <button
                        onClick={() =>
                          tilbakestill.mutate({
                            organizationId: orgId,
                            oppmotestedIdA: a.id,
                            oppmotestedIdB: b.id,
                          })
                        }
                        disabled={tilbakestill.isPending}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title={t("firma.avstander.tilbakestill")}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RedigerAvstandModal({
  orgId,
  enhet,
  redigering,
  onLukk,
  onLagret,
}: {
  orgId: string;
  enhet: Enhet;
  redigering: Redigering;
  onLukk: () => void;
  onLagret: () => void;
}) {
  const { t } = useTranslation();
  const c = redigering.celle;
  const maal = redigering.maal;
  const kjentMin = c && c.kjoretidMin >= 0 ? c.kjoretidMin : null;
  const kjentKm = c && c.avstandM != null && c.avstandM >= 0 ? c.avstandM / 1000 : null;
  // Kjøretid er påkrevd i matrisen. Måles det i km og kjøretiden er ukjent,
  // må den oppgis også (ellers kan raden ikke lagres).
  const trengerMin = enhet === "km" && kjentMin == null;

  const [hoved, setHoved] = useState(
    enhet === "km" ? (kjentKm != null ? String(kjentKm) : "") : kjentMin != null ? String(kjentMin) : "",
  );
  const [ekstraMin, setEkstraMin] = useState("");
  // (16) punkt 3: kontor ↔ kontor viser alltid både km og kjøretid, forhåndsutfylt.
  const erKontor = maal.type === "kontor";
  const kontorStart = kontorAvstandStartverdier(c);
  const [kontorKm, setKontorKm] = useState(kontorStart.km);
  const [kontorMin, setKontorMin] = useState(kontorStart.min);
  const [feil, setFeil] = useState<string | null>(null);

  const lagreByggeplass = trpc.oppmotested.oppdaterAvstand.useMutation({
    onSuccess: onLagret,
    onError: (e) => setFeil(e.message),
  });
  const lagreKontor = trpc.oppmotested.oppdaterKontorAvstand.useMutation({
    onSuccess: onLagret,
    onError: (e) => setFeil(e.message),
  });
  const lagrer = lagreByggeplass.isPending || lagreKontor.isPending;
  const mutate = (v: { avstandKm?: number; kjoretidMin?: number }) => {
    if (maal.type === "kontor") {
      lagreKontor.mutate({
        organizationId: orgId,
        oppmotestedIdA: maal.oppmotestedIdA,
        oppmotestedIdB: maal.oppmotestedIdB,
        ...v,
      });
    } else {
      lagreByggeplass.mutate({
        organizationId: orgId,
        oppmotestedId: maal.oppmotestedId,
        byggeplassId: maal.byggeplassId,
        ...v,
      });
    }
  };

  function send() {
    if (erKontor) {
      const v = tolkKontorAvstand(kontorKm, kontorMin);
      if (!v) {
        setFeil(t("firma.avstander.ugyldig"));
        return;
      }
      mutate(v);
      return;
    }
    const tall = Number(hoved.replace(",", "."));
    if (!Number.isFinite(tall) || tall <= 0) {
      setFeil(t("firma.avstander.ugyldig"));
      return;
    }
    if (enhet === "km") {
      const min = trengerMin ? Number(ekstraMin) : undefined;
      if (trengerMin && (!Number.isInteger(min) || (min ?? 0) <= 0)) {
        setFeil(t("firma.avstander.ugyldig"));
        return;
      }
      mutate({ avstandKm: tall, kjoretidMin: min });
    } else {
      if (!Number.isInteger(tall)) {
        setFeil(t("firma.avstander.ugyldig"));
        return;
      }
      mutate({ kjoretidMin: tall });
    }
  }

  return (
    <Modal open onClose={onLukk} title={t("firma.avstander.redigerTittel")}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {redigering.undertittel}
        </p>
        {erKontor ? (
          <>
            <Input
              label={t("firma.avstander.felt.avstand")}
              value={kontorKm}
              onChange={(e) => setKontorKm(e.target.value)}
              inputMode="decimal"
            />
            <Input
              label={t("firma.avstander.felt.kjoretid")}
              value={kontorMin}
              onChange={(e) => setKontorMin(e.target.value)}
              inputMode="numeric"
            />
          </>
        ) : (
          <Input
            label={enhet === "km" ? t("firma.avstander.felt.avstand") : t("firma.avstander.felt.kjoretid")}
            value={hoved}
            onChange={(e) => setHoved(e.target.value)}
            inputMode="decimal"
          />
        )}
        {!erKontor && trengerMin && (
          <Input
            label={t("firma.avstander.felt.kjoretid")}
            value={ekstraMin}
            onChange={(e) => setEkstraMin(e.target.value)}
            inputMode="numeric"
          />
        )}
        <p className="text-xs text-gray-500">{t("firma.avstander.redigerHjelp")}</p>
        {feil && <p className="text-xs text-sitedoc-error">{feil}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onLukk}>
          {t("handling.avbryt")}
        </Button>
        <Button onClick={send} disabled={lagrer}>
          {t("handling.lagre")}
        </Button>
      </div>
    </Modal>
  );
}
