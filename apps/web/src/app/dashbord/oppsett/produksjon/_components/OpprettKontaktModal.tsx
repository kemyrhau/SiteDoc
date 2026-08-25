"use client";

/**
 * OpprettKontaktModal — flyt-first opprett-kontakt (Spor 1 v2.1, mockup-fasit).
 *
 * Hierarki: 1. Faggruppe (fargeprikk-pille) → 2. Dokumentflyt (kun valgt
 * faggruppes flyter) → 3. Rolle(r) valgt i selve leddrekka (flervalg = ett
 * flytmedlemskap per rolle). «+ Legg til flere flyter» gir flere rader.
 *
 * Gjenbrukbar: `forhandsvalgtFaggruppeId`/`forhandsvalgtFlytId` lar flyt-oppsettet
 * åpne samme modal med faggruppe + flyt forhåndsvalgt (ikke en kopi).
 *
 * Skriver vanlig flytmedlemskap: `medlem.leggTil`/`leggTilEksisterende` (oppretter
 * kontakten + faggruppe-kobling) og deretter `dokumentflyt.leggTilMedlem` per rolle.
 * Valgfri tilgangsgruppe via `gruppe.leggTilMedlem`. Ingen ny tilgangsberegning.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { ArrowRight, Plus, X } from "lucide-react";

const ROLLE_REKKEFOLGE = ["registrator", "bestiller", "utforer", "godkjenner"] as const;
type DokumentflytRolle = (typeof ROLLE_REKKEFOLGE)[number];

const FARGE_DOT: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", amber: "bg-amber-500",
  yellow: "bg-yellow-500", lime: "bg-lime-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", cyan: "bg-cyan-500",
  sky: "bg-sky-500", blue: "bg-blue-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", purple: "bg-purple-500", fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

export interface FaggruppeForModal {
  id: string;
  name: string;
  color: string | null;
}

export interface FlytForModal {
  id: string;
  name: string;
  faggruppeId: string | null;
  roller: Array<{ rolle: string; label?: string | null }>;
}

export interface TilgangsgruppeForModal {
  id: string;
  name: string;
}

export interface FirmaBrukerForModal {
  id: string;
  name: string | null;
  email: string;
}

interface FlytRad {
  faggruppeId: string;
  flytId: string;
  roller: string[];
}

export function OpprettKontaktModal({
  open,
  onClose,
  prosjektId,
  faggrupper,
  dokumentflyter,
  tilgangsgrupper,
  ledigeFirmaBrukere,
  forhandsvalgtFaggruppeId,
  forhandsvalgtFlytId,
  onFerdig,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  faggrupper: FaggruppeForModal[];
  dokumentflyter: FlytForModal[];
  tilgangsgrupper: TilgangsgruppeForModal[];
  ledigeFirmaBrukere: FirmaBrukerForModal[];
  forhandsvalgtFaggruppeId?: string;
  forhandsvalgtFlytId?: string;
  onFerdig: () => void;
}) {
  const { t } = useTranslation();

  const startRad = (): FlytRad => ({
    faggruppeId: forhandsvalgtFaggruppeId ?? "",
    flytId: forhandsvalgtFlytId ?? "",
    roller: [],
  });

  const [modus, setModus] = useState<"ny-person" | "fra-firma">("ny-person");
  const [navn, setNavn] = useState("");
  const [epost, setEpost] = useState("");
  const [firmaBrukerId, setFirmaBrukerId] = useState("");
  const [flytRader, setFlytRader] = useState<FlytRad[]>([startRad()]);
  const [tilgangsgruppeId, setTilgangsgruppeId] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  // Nullstill ved åpning
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open !== forrigeOpen) {
    setForrigeOpen(open);
    if (open) {
      setModus("ny-person");
      setNavn("");
      setEpost("");
      setFirmaBrukerId("");
      setFlytRader([startRad()]);
      setTilgangsgruppeId("");
      setFeil(null);
    }
  }

  // (b) Admin-status kjent i klienten FØR første skriving (se handleOpprett): flyt-plassering er
  // admin-gatet server-side, så vi må avvise ikke-admin før kontakten opprettes — ellers halv tilstand.
  const { data: minTilgang } = trpc.gruppe.hentMinTilgang.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const erAdmin = minTilgang?.erAdmin ?? false;

  const leggTilMedlemMutation = trpc.medlem.leggTil.useMutation();
  const leggTilEksisterendeMutation = trpc.medlem.leggTilEksisterende.useMutation();
  const leggTilFlytMedlemMutation = trpc.dokumentflyt.leggTilMedlem.useMutation();
  const leggTilGruppeMedlemMutation = trpc.gruppe.leggTilMedlem.useMutation();

  const sender =
    leggTilMedlemMutation.isPending ||
    leggTilEksisterendeMutation.isPending ||
    leggTilFlytMedlemMutation.isPending ||
    leggTilGruppeMedlemMutation.isPending;

  function flytForFaggruppe(faggruppeId: string): FlytForModal[] {
    return dokumentflyter.filter((df) => df.faggruppeId === faggruppeId);
  }

  function rolleLabel(flyt: FlytForModal | undefined, rolle: string): string {
    const egen = flyt?.roller.find((r) => r.rolle === rolle)?.label;
    return egen ?? t(`dokumentflyt.${rolle}`);
  }

  function settRad(idx: number, endring: Partial<FlytRad>) {
    setFlytRader((rader) => rader.map((r, i) => (i === idx ? { ...r, ...endring } : r)));
  }

  function toggleRolle(idx: number, rolle: string) {
    setFlytRader((rader) =>
      rader.map((r, i) =>
        i === idx
          ? { ...r, roller: r.roller.includes(rolle) ? r.roller.filter((x) => x !== rolle) : [...r.roller, rolle] }
          : r,
      ),
    );
  }

  const kanOpprette =
    (modus === "ny-person" ? navn.trim() !== "" && epost.trim() !== "" : firmaBrukerId !== "") && !sender;

  async function handleOpprett() {
    setFeil(null);
    if (modus === "ny-person" && (!navn.trim() || !epost.trim())) return;
    if (modus === "fra-firma" && !firmaBrukerId) return;

    // Faggrupper som skal kobles til kontakten (fra flyt-radene)
    const faggruppeIder = [...new Set(flytRader.map((r) => r.faggruppeId).filter(Boolean))];

    // (b) Rett-sjekk FØR første skriving (Tillegg 1, Kenneth-vedtak 2026-08-22): flyt-plassering
    // (`dokumentflyt.leggTilMedlem`) er admin-gatet server-side. Ville vi skrevet flyt-medlemskap
    // uten å være admin, ville kontakten blitt OPPRETTET (`medlem.leggTil` er ikke gatet) og
    // plasseringen avvist → foreldreløs kontakt uten flyttilknytning, i stillhet. Vi forhindrer
    // tilstanden i stedet for å rydde etter den. Kontakt UTEN flyt-plassering (ingen rad med rolle)
    // er fortsatt tillatt for ikke-admin — vi blokkerer kun når en flyt-skriving faktisk ville skjedd.
    const skalPlassereIFlyt = flytRader.some((r) => r.flytId && r.roller.length > 0);
    if (skalPlassereIFlyt && !erAdmin) {
      setFeil(
        "Bare administratorer kan plassere en kontakt i en dokumentflyt. Be en prosjektadmin gjøre det, eller opprett kontakten uten flyt-plassering.",
      );
      return;
    }

    try {
      let projectMemberId: string;
      let epostForGruppe: string;
      let fornavn: string;
      let etternavn: string;

      if (modus === "ny-person") {
        const deler = navn.trim().split(/\s+/);
        fornavn = deler[0] || navn.trim();
        etternavn = deler.slice(1).join(" ") || "-";
        epostForGruppe = epost.trim();
        const ny = await leggTilMedlemMutation.mutateAsync({
          projectId: prosjektId,
          email: epostForGruppe,
          firstName: fornavn,
          lastName: etternavn,
          role: "member",
          faggruppeIder,
        });
        if (!ny) throw new Error(t("kontaktside.opprettFeilet"));
        projectMemberId = ny.id;
      } else {
        const bruker = ledigeFirmaBrukere.find((b) => b.id === firmaBrukerId);
        const deler = (bruker?.name ?? bruker?.email ?? "").trim().split(/\s+/);
        fornavn = deler[0] || (bruker?.email ?? "-");
        etternavn = deler.slice(1).join(" ") || "-";
        epostForGruppe = bruker?.email ?? "";
        const ny = await leggTilEksisterendeMutation.mutateAsync({
          projectId: prosjektId,
          userId: firmaBrukerId,
          role: "member",
          faggruppeIder,
        });
        if (!ny) throw new Error(t("kontaktside.opprettFeilet"));
        projectMemberId = ny.id;
      }

      // Flytmedlemskap — ett kall per (flyt × rolle)
      for (const rad of flytRader) {
        if (!rad.flytId || rad.roller.length === 0) continue;
        for (const rolle of rad.roller) {
          await leggTilFlytMedlemMutation.mutateAsync({
            dokumentflytId: rad.flytId,
            projectId: prosjektId,
            projectMemberId,
            rolle: rolle as DokumentflytRolle,
            steg: 1,
          });
        }
      }

      // Valgfri tilgangsgruppe
      if (tilgangsgruppeId && epostForGruppe) {
        await leggTilGruppeMedlemMutation.mutateAsync({
          groupId: tilgangsgruppeId,
          projectId: prosjektId,
          email: epostForGruppe,
          firstName: fornavn,
          lastName: etternavn,
        });
      }

      onFerdig();
      onClose();
    } catch (e) {
      setFeil((e as Error).message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("kontaktside.nyKontakt")}>
      <div className="flex flex-col gap-3">
        {/* Modus: ny person / fra firma */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 text-xs">
          {(["ny-person", "fra-firma"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModus(m)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                modus === m ? "bg-white text-sitedoc-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m === "ny-person" ? t("kontaktside.modusNyPerson") : t("kontaktside.modusFraFirma")}
            </button>
          ))}
        </div>

        {/* Navn/e-post eller firmabruker-velger */}
        {modus === "ny-person" ? (
          <>
            <Input label={t("kontaktside.navn")} value={navn} onChange={(e) => setNavn(e.target.value)} />
            <Input
              label={t("kontaktside.epost")}
              type="email"
              placeholder="navn@firma.no"
              value={epost}
              onChange={(e) => setEpost(e.target.value)}
            />
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">{t("kontaktside.velgFirmaBruker")}</span>
            <select
              value={firmaBrukerId}
              onChange={(e) => setFirmaBrukerId(e.target.value)}
              className="rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">{t("handling.velg")}…</option>
              {ledigeFirmaBrukere.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name ? `${b.name} — ${b.email}` : b.email}
                </option>
              ))}
            </select>
            {ledigeFirmaBrukere.length === 0 && (
              <span className="text-[11px] text-gray-400">{t("brukere.ingenLedigeFirmaBrukere")}</span>
            )}
          </div>
        )}

        {/* Delta i dokumentflyt — hierarki-rader */}
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            {t("kontaktside.deltaIFlyt")}
          </span>

          {flytRader.map((rad, idx) => {
            const flyterHer = flytForFaggruppe(rad.faggruppeId);
            const valgtFlyt = flyterHer.find((f) => f.id === rad.flytId);
            const rollerIFlyt = ROLLE_REKKEFOLGE.filter((r) =>
              (valgtFlyt?.roller ?? []).some((rk) => rk.rolle === r),
            );

            return (
              <div key={idx} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                {flytRader.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFlytRader((rader) => rader.filter((_, i) => i !== idx))}
                      className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title={t("kontaktside.fjernFlyt")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* 1. Faggruppe */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-gray-500">{t("kontaktside.stegFaggruppe")}</span>
                  <div className="flex items-center gap-2">
                    {rad.faggruppeId && (
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          FARGE_DOT[faggrupper.find((f) => f.id === rad.faggruppeId)?.color ?? ""] ?? "bg-gray-400"
                        }`}
                      />
                    )}
                    <select
                      value={rad.faggruppeId}
                      onChange={(e) => settRad(idx, { faggruppeId: e.target.value, flytId: "", roller: [] })}
                      className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">{t("kontaktside.velgFaggruppe")}…</option>
                      {faggrupper.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Dokumentflyt */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-gray-500">{t("kontaktside.stegDokumentflyt")}</span>
                  <select
                    value={rad.flytId}
                    onChange={(e) => settRad(idx, { flytId: e.target.value, roller: [] })}
                    disabled={!rad.faggruppeId}
                    className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">
                      {!rad.faggruppeId
                        ? t("kontaktside.velgFaggruppeForst")
                        : flyterHer.length === 0
                          ? t("kontaktside.ingenFlyterForFaggruppe")
                          : `${t("kontaktside.velgDokumentflyt")}…`}
                    </option>
                    {flyterHer.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Rolle(r) i leddrekka */}
                {valgtFlyt && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10.5px] font-semibold text-gray-500">{t("kontaktside.stegRolle")}</span>
                    {rollerIFlyt.length === 0 ? (
                      <span className="text-[11px] italic text-gray-400">{t("kontaktside.flytUtenRoller")}</span>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
                          {rollerIFlyt.map((rolle, rIdx) => {
                            const valgt = rad.roller.includes(rolle);
                            return (
                              <div key={rolle} className="flex items-center gap-1">
                                {rIdx > 0 && <ArrowRight className="h-3 w-3 text-gray-300" />}
                                <button
                                  type="button"
                                  onClick={() => toggleRolle(idx, rolle)}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                                    valgt
                                      ? "border-violet-600 bg-violet-600 text-white"
                                      : "border-gray-300 bg-white text-gray-600 hover:border-violet-300"
                                  }`}
                                >
                                  {valgt && <span className="text-[10px]">✓</span>}
                                  {rolleLabel(valgtFlyt, rolle)}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-[10.5px] text-gray-400">{t("kontaktside.rolleHint")}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setFlytRader((rader) => [...rader, { faggruppeId: "", flytId: "", roller: [] }])}
              className="self-start text-xs font-semibold text-sitedoc-primary hover:underline"
            >
              {t("kontaktside.leggTilFlereFlyter")}
            </button>
            <span className="text-[10.5px] text-gray-400">{t("kontaktside.flytValgfritt")}</span>
          </div>
        </div>

        {/* Tilgangsgruppe (valgfri) */}
        <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
          <span className="text-xs font-medium text-gray-600">{t("kontaktside.tilgangsgruppe")}</span>
          <select
            value={tilgangsgruppeId}
            onChange={(e) => setTilgangsgruppeId(e.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          >
            <option value="">{t("kontaktside.ingenTilgangsgruppe")}</option>
            {tilgangsgrupper.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <span className="text-[10.5px] text-gray-400">{t("kontaktside.tilgangsgruppeHint")}</span>
        </div>

        {feil && <p className="text-sm text-sitedoc-error">{feil}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("handling.avbryt")}
          </Button>
          <Button type="button" onClick={handleOpprett} loading={sender} disabled={!kanOpprette}>
            <Plus className="mr-1 h-4 w-4" />
            {t("handling.opprett")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
