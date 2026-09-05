"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, Input } from "@sitedoc/ui";
import { PenLine, UserPlus, Lock, CheckCircle2, AlertTriangle } from "lucide-react";
import { signaturTidspunktNaa, formaterSignaturTidspunkt } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import type { RapportObjektProps } from "./typer";

/** Visningstid: veggklokke fra signertTidspunkt, fallback completedAt (UTC). */
function visTid(sig: { signertTidspunkt?: string | null; completedAt?: string | Date | null } | undefined): string {
  if (!sig) return "";
  const lokal = formaterSignaturTidspunkt(sig.signertTidspunkt ?? null);
  if (lokal) return lokal;
  return sig.completedAt ? new Date(sig.completedAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }) : "";
}

interface Medlem {
  id: string;
  user: { id: string; name: string | null; email: string };
}

/**
 * Signaturliste (SJA/HMS-runder). Fabel-ordre 2026-09-06.
 * Leder med «X av Y signert»; manko FØRST (amber) med «Signer» på egen rad
 * (gated: innlogget bruker = deltakerens userId), gjest-rad «signer på
 * ansvarliges enhet». Signerte under m/tidspunkt + HMS-kort. Låst runde vises
 * i lesemodus. Data bor server-side (trpc.signatur), ikke i felt.verdi.
 */
export function SignaturListeObjekt({ objekt, dokumentRef, prosjektId, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const ref = dokumentRef ?? {};
  const harRef = !!ref.checklistId || !!ref.taskId;

  const [visLeggTil, setVisLeggTil] = useState(false);
  const [visNyRunde, setVisNyRunde] = useState(false);
  const [gjestNavn, setGjestNavn] = useState("");
  const [gjestFirma, setGjestFirma] = useState("");
  const [gjestTelefon, setGjestTelefon] = useState("");
  const [valgtMedlem, setValgtMedlem] = useState("");
  const [nyRundeAarsak, setNyRundeAarsak] = useState("");

  const { data, isLoading } = trpc.signatur.hentRunder.useQuery(ref, { enabled: harRef });
  const { data: råMedlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId && visLeggTil },
  );
  const medlemmer = råMedlemmer as Medlem[] | undefined;

  function invalider() {
    utils.signatur.hentRunder.invalidate(ref);
    utils.signatur.hentManko.invalidate(ref);
  }

  const signerMut = trpc.signatur.signer.useMutation({ onSuccess: invalider });
  const startRundeMut = trpc.signatur.startRunde.useMutation({
    onSuccess: () => {
      invalider();
      setVisNyRunde(false);
      setNyRundeAarsak("");
    },
  });
  const avsluttMut = trpc.signatur.avsluttRunde.useMutation({ onSuccess: invalider });
  const leggTilMut = trpc.signatur.deltakerLeggTil.useMutation({
    onSuccess: () => {
      invalider();
      setVisLeggTil(false);
      setGjestNavn("");
      setGjestFirma("");
      setGjestTelefon("");
      setValgtMedlem("");
    },
  });
  const fjernMut = trpc.signatur.deltakerFjern.useMutation({ onSuccess: invalider });

  if (!harRef) return null;
  if (isLoading || !data) {
    return <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">{t("felt.laster", "Laster …")}</div>;
  }

  const { status, runder, deltakere, kanRedigere, minDeltakerId, gjeldendeRundeLaast } = data;
  const gjeldende = runder.find((r) => r.erGjeldende) ?? null;
  const aktive = deltakere.filter((d) => d.aktiv);

  // Ikke tatt i bruk ennå: tom tilstand + evt. «Start signaturrunde» for ansvarlig.
  if (!gjeldende) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <PenLine className="h-4 w-4" /> {objekt.label}
        </div>
        <p className="text-sm text-gray-500">{t("signaturliste.ingenRunde", "Ingen signaturrunde startet")}</p>
        {kanRedigere && !leseModus && (
          <Button className="mt-3" size="sm" loading={startRundeMut.isPending} onClick={() => startRundeMut.mutate(ref)}>
            {t("signaturliste.startRunde", "Start signaturrunde")}
          </Button>
        )}
      </div>
    );
  }

  const signertIds = new Set(gjeldende.signaturer.map((s) => s.deltakerId));
  const sigFor = new Map(gjeldende.signaturer.map((s) => [s.deltakerId, s]));
  const manko = aktive.filter((d) => !signertIds.has(d.id));
  const signerte = aktive.filter((d) => signertIds.has(d.id));

  // Forrige-runde-signaturer (teller ikke i X) — amber.
  const forrigeSignaturer = runder
    .filter((r) => !r.erGjeldende)
    .flatMap((r) =>
      r.signaturer.map((s) => ({
        rundeNr: r.rundeNr,
        deltaker: deltakere.find((d) => d.id === s.deltakerId),
        sig: s,
      })),
    )
    .filter((x) => x.deltaker && !signertIds.has(x.deltaker.id));

  function hmsKortTekst(sig: { hmsKortNr: string | null; harIkkeHmsKort: boolean } | undefined): string {
    if (!sig) return "";
    if (sig.hmsKortNr) return sig.hmsKortNr;
    if (sig.harIkkeHmsKort) return t("signaturliste.harIkkeHmsKort", "Har ikke HMS-kort");
    return "";
  }

  const rundeEtikett = t("signaturliste.runde", "Runde {{nr}}", { nr: gjeldende.rundeNr });

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      {/* Leder: label + status «X av Y signert» */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <PenLine className="h-4 w-4" /> {objekt.label}
          <span className="text-xs font-normal text-gray-500">· {rundeEtikett}</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            status.status === "komplett" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {status.status === "komplett" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {t("signaturliste.status", "{{signert}} av {{av}} signert", { signert: status.signert, av: status.av })}
        </span>
      </div>

      {/* Låst runde: vis låsen (aldri stille avvisning) */}
      {gjeldendeRundeLaast && (
        <div className="mb-3 flex items-start gap-2 rounded-md bg-gray-100 p-3 text-sm text-gray-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t("signaturliste.laast", "Låst — runde {{nr}} avsluttet {{dato}}. Endring krever ny runde", {
              nr: gjeldende.rundeNr,
              dato: gjeldende.avsluttetAt ? new Date(gjeldende.avsluttetAt).toLocaleDateString("nb-NO") : "",
            })}
          </span>
        </div>
      )}

      {/* Manko FØRST — amber */}
      {manko.length > 0 && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            {t("signaturliste.mangler", "Mangler")} ({manko.length})
          </div>
          <ul className="flex flex-col gap-2">
            {manko.map((d) => {
              const egenRad = minDeltakerId === d.id;
              const kanSignere = !leseModus && !gjeldendeRundeLaast && (egenRad || (d.erGjest && kanRedigere));
              return (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-900">
                    {d.navn}
                    {d.firma && <span className="text-gray-500"> · {d.firma}</span>}
                    {d.erGjest && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({t("signaturliste.signerPaaAnsvarlig", "signer på ansvarliges enhet")})
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {kanSignere && (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={signerMut.isPending && signerMut.variables?.deltakerId === d.id}
                        onClick={() => signerMut.mutate({ deltakerId: d.id, signertTidspunkt: signaturTidspunktNaa() })}
                      >
                        {t("signaturliste.signer", "Signer")}
                      </Button>
                    )}
                    {kanRedigere && !leseModus && (
                      <button
                        type="button"
                        onClick={() => fjernMut.mutate({ deltakerId: d.id })}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        {t("signaturliste.fjern", "Fjern")}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Signerte — gjeldende runde */}
      {signerte.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5">
          {signerte.map((d) => {
            const sig = sigFor.get(d.id);
            return (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-gray-900">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {d.navn}
                  {d.firma && <span className="text-gray-500"> · {d.firma}</span>}
                </span>
                <span className="text-xs text-gray-500">
                  {visTid(sig)}
                  {hmsKortTekst(sig) && <span className="ml-2">· {hmsKortTekst(sig)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Forrige-runde-signaturer — amber, teller ikke i X */}
      {forrigeSignaturer.length > 0 && (
        <div className="mb-3 border-t border-gray-100 pt-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            {t("signaturliste.tidligereRunder", "Tidligere runder")}
          </div>
          <ul className="flex flex-col gap-1">
            {forrigeSignaturer.map((x, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm text-amber-700">
                <span>
                  {x.deltaker!.navn}
                  {x.deltaker!.firma && <span className="opacity-70"> · {x.deltaker!.firma}</span>}
                </span>
                <span className="text-xs">
                  {t("signaturliste.runde", "Runde {{nr}}", { nr: x.rundeNr })}
                  {visTid(x.sig) && ` · ${visTid(x.sig)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ansvarlig-handlinger */}
      {kanRedigere && !leseModus && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {!gjeldendeRundeLaast && (
            <Button size="sm" variant="secondary" onClick={() => setVisLeggTil(true)}>
              <UserPlus className="mr-1 h-4 w-4" /> {t("signaturliste.leggTilDeltaker", "Legg til deltaker")}
            </Button>
          )}
          {!gjeldendeRundeLaast && (
            <Button
              size="sm"
              variant="secondary"
              loading={avsluttMut.isPending}
              onClick={() => avsluttMut.mutate({ rundeId: gjeldende.id })}
            >
              {t("signaturliste.avsluttRunde", "Avslutt runde")}
            </Button>
          )}
          {gjeldendeRundeLaast && (
            <Button size="sm" variant="primary" onClick={() => setVisNyRunde(true)}>
              {t("signaturliste.startNyRunde", "Start ny runde")}
            </Button>
          )}
        </div>
      )}

      {/* Modal: legg til deltaker */}
      <Modal open={visLeggTil} onClose={() => setVisLeggTil(false)} title={t("signaturliste.leggTilDeltaker", "Legg til deltaker")}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("signaturliste.prosjektmedlem", "Prosjektmedlem")}</label>
            <div className="flex gap-2">
              <select
                value={valgtMedlem}
                onChange={(e) => setValgtMedlem(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">{t("signaturliste.velgMedlem", "Velg medlem …")}</option>
                {medlemmer?.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name ?? m.user.email}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!valgtMedlem}
                loading={leggTilMut.isPending}
                onClick={() => leggTilMut.mutate({ ...ref, userId: valgtMedlem })}
              >
                {t("signaturliste.leggTil", "Legg til")}
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("signaturliste.gjest", "Gjest")}</label>
            <div className="flex flex-col gap-2">
              <Input placeholder={t("signaturliste.gjestNavn", "Navn")} value={gjestNavn} onChange={(e) => setGjestNavn(e.target.value)} />
              <Input placeholder={t("signaturliste.gjestFirma", "Firma")} value={gjestFirma} onChange={(e) => setGjestFirma(e.target.value)} />
              <Input placeholder={t("signaturliste.gjestTelefon", "Telefon")} value={gjestTelefon} onChange={(e) => setGjestTelefon(e.target.value)} />
              <Button
                size="sm"
                disabled={!gjestNavn.trim()}
                loading={leggTilMut.isPending}
                onClick={() =>
                  leggTilMut.mutate({
                    ...ref,
                    guestName: gjestNavn.trim(),
                    guestCompany: gjestFirma.trim() || undefined,
                    guestPhone: gjestTelefon.trim() || undefined,
                  })
                }
              >
                {t("signaturliste.leggTilGjest", "Legg til gjest")}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setVisLeggTil(false)}>
              {t("handling.avbryt", "Avbryt")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: start ny runde (bekreft + valgfri årsak) */}
      <Modal open={visNyRunde} onClose={() => setVisNyRunde(false)} title={t("signaturliste.startNyRunde", "Start ny runde")}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {t("signaturliste.nyRundeForklaring", "Innholdet gjenåpnes for et nytt signatursett. Forrige runde består urørt i loggen.")}
          </p>
          <Input
            placeholder={t("signaturliste.aarsakValgfri", "Årsak (valgfritt)")}
            value={nyRundeAarsak}
            onChange={(e) => setNyRundeAarsak(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setVisNyRunde(false)}>
              {t("handling.avbryt", "Avbryt")}
            </Button>
            <Button
              size="sm"
              loading={startRundeMut.isPending}
              onClick={() => startRundeMut.mutate({ ...ref, aarsak: nyRundeAarsak.trim() || undefined })}
            >
              {t("signaturliste.startNyRunde", "Start ny runde")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
