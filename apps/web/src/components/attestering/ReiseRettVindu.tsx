"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@sitedoc/ui";
import { effektiveTimerFraSpenn } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import { byggeplasserForProsjekt, velgStandardByggeplass } from "@/lib/timerByggeplass";
import { RadByggeplassFelt } from "@/components/timer/RadByggeplassFelt";
import { reiseHavnerI, type ReiseHavnerAnnenRad } from "@/hooks/useManuellReiseWeb";
import { UnderprosjektValg, tillatteLonnsarter } from "./RegistreringPanel";
import type { ErReiseKontekst } from "@sitedoc/shared";
import type { AttSedel, AttTimer } from "./attestering-tabell";
import { SokbarNedtrekk } from "@/components/timer/SokbarNedtrekk";

type Eco = { id: string; proAdmId: string; kortNavn: string };
type Prosjekt = { id: string; name: string; internalProjectNumber: string | null };
type Byggeplass = { id: string; projectId: string; name: string };

const KL = /^([01]\d|2[0-3]):[0-5]\d$/;
// O19 pkt 23: del 1 av en reise delt ved midnatt slutter 24:00 — gyldig til-tid, aldri fra-tid.
const KL_TIL = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const ms = (v: Date | string | null | undefined) => (v ? new Date(v).getTime() : 0);

/** Kallet vinduet gjør ved «Lagre» — rent, så testen kan måle det uten nettleser. */
export type ReiseRettKall =
  | { type: "ingen" }
  | { type: "eco"; externalCostObjectId: string | null }
  | { type: "rett"; felter: Record<string, string | number | null> };

/**
 * w15f: hva «Lagre» sender. Firmavalget av (`redigerTillatt` false): bare underprosjektet, med
 * `flyttTimerRadEco`. Endres bare underprosjektet: også `flyttTimerRadEco` (som før). Ellers ett
 * `rettRadFelt` med feltene som er endret (tid, prosjekt, byggeplass, lønnsart); byttes prosjektet,
 * sendes byggeplass og underprosjekt med. `ny.fraTid`/`ny.tilTid` er allerede rundet der de er rørt.
 */
export function reiseRettKall(args: {
  lagret: { fraTid: string | null; tilTid: string | null; pauseMin: number; projectId: string | null; byggeplassId: string | null; ecoId: string | null; lonnsartId: string };
  ny: { fraTid: string; tilTid: string; projectId: string | null; byggeplassId: string | null; ecoId: string | null; lonnsartId: string };
  redigerTillatt: boolean;
}): ReiseRettKall {
  const { lagret, ny, redigerTillatt } = args;
  const ecoEndret = ny.ecoId !== lagret.ecoId;
  if (!redigerTillatt) return ecoEndret ? { type: "eco", externalCostObjectId: ny.ecoId } : { type: "ingen" };
  const tidEndret = ny.fraTid !== (lagret.fraTid ?? "") || ny.tilTid !== (lagret.tilTid ?? "");
  const prosjektEndret = ny.projectId !== lagret.projectId;
  const byggeplassEndret = ny.byggeplassId !== lagret.byggeplassId;
  const lonnsartEndret = ny.lonnsartId !== lagret.lonnsartId;
  if (!tidEndret && !prosjektEndret && !byggeplassEndret && !lonnsartEndret) {
    return ecoEndret ? { type: "eco", externalCostObjectId: ny.ecoId } : { type: "ingen" };
  }
  const felter: Record<string, string | number | null> = {};
  if (tidEndret) {
    felter.fraTid = ny.fraTid;
    felter.tilTid = ny.tilTid;
    felter.timer = effektiveTimerFraSpenn(ny.fraTid, ny.tilTid, ny.fraTid, lagret.pauseMin);
  }
  if (prosjektEndret) {
    felter.projectId = ny.projectId;
    felter.byggeplassId = ny.byggeplassId;
    felter.externalCostObjectId = ny.ecoId;
  } else {
    if (byggeplassEndret) felter.byggeplassId = ny.byggeplassId;
    if (ecoEndret) felter.externalCostObjectId = ny.ecoId;
  }
  if (lonnsartEndret) felter.lonnsartId = ny.lonnsartId;
  return { type: "rett", felter };
}

/**
 * w15f — «Rett reisen» i attesteringen (plan § 4.15 del E, bilde v17): start, slutt, lønnsart (bare
 * reisearter, RETUR w15f B48 A), prosjekt, byggeplass, underprosjekt — og linja «havner i» før lagring. Prosjektlista er
 * prosjektene attestanten kan attestere (`prosjektKontekst`; `undefined` = alle i firmaet).
 * Firmavalget «Rediger ved attestering» av: bare underprosjektet er åpent. «Avbryt» sender ingenting;
 * etter lagring lukkes vinduet og tabellen hentes på nytt.
 */
export function ReiseRettVindu({ rad, sedel, orgId, lonnsarter, reiseKtx, prosjektKontekst, tidsrunding = null, onLagret, onAvbryt }: {
  rad: AttTimer;
  lonnsarter: readonly { id: string; navn: string }[];
  reiseKtx: ErReiseKontekst | null;
  sedel: AttSedel;
  orgId: string;
  prosjektKontekst?: ReadonlySet<string>;
  tidsrunding?: number | null;
  onLagret: () => void;
  onAvbryt: () => void;
}) {
  const { t } = useTranslation();
  const redigerTillatt = sedel.redigerTillatt;
  const [fra, setFra] = useState(rad.fraTid ?? "");
  const [til, setTil] = useState(rad.tilTid ?? "");
  const [projectId, setProjectId] = useState<string | null>(rad.projectId);
  const [byggeplassId, setByggeplassId] = useState<string | null>(rad.byggeplassId ?? null);
  const [ecoId, setEcoId] = useState<string | null>(rad.externalCostObjectId ?? null);
  const [lonnsartId, setLonnsartId] = useState<string>(rad.lonnsartId);
  const artValg = tillatteLonnsarter({ erReise: true }, lonnsarter, reiseKtx, rad.lonnsartId);
  const [feil, setFeil] = useState<string | null>(null);

  const { data: prosjekterRaw } = trpc.prosjekt.hentForTimer.useQuery({ organizationId: orgId });
  const prosjekter = useMemo(() => {
    const alle = (prosjekterRaw ?? []) as unknown as Prosjekt[];
    return alle.filter((p) => !prosjektKontekst || prosjektKontekst.has(p.id) || p.id === rad.projectId);
  }, [prosjekterRaw, prosjektKontekst, rad.projectId]);
  const { data: byggeplasserRaw } = trpc.bygning.hentForFirma.useQuery({ organizationId: orgId });
  const byggeplasser = (byggeplasserRaw ?? []) as unknown as Byggeplass[];
  const kandidater = byggeplasserForProsjekt(byggeplasser, projectId ?? "");
  const { data: ecoRaw } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: projectId ?? "", organizationId: orgId },
    { enabled: !!projectId },
  );
  const ecoListe = (ecoRaw ?? []) as Eco[];

  const flytt = trpc.timer.dagsseddel.flyttTimerRadEco.useMutation();
  const rett = trpc.timer.dagsseddel.rettRadFelt.useMutation();
  const opptatt = flytt.isPending || rett.isPending;

  function byttProsjekt(id: string) {
    setProjectId(id);
    setEcoId(null); // underprosjektet hører til det gamle prosjektet
    setByggeplassId(velgStandardByggeplass({ gjeldende: null, kandidater: byggeplasserForProsjekt(byggeplasser, id), toppbar: null }));
  }

  // Linja «havner i»: samme funksjon som dagssiden, med sedelens rader.
  const sedelBp = (sedel as { byggeplassId?: string | null }).byggeplassId ?? null;
  const eierId = (sedel as { userId?: string }).userId ?? sedel.ansatt?.id ?? null;
  const havner = projectId
    ? reiseHavnerI({
        rader: sedel.timer.filter((r) => r.id !== rad.id && r.projectId).map((r) => ({
          fraTid: r.fraTid,
          erReise: r.erReise === true,
          kortId: r.kortId ?? null,
          projectId: r.projectId,
          ecoId: r.externalCostObjectId,
          byggeplassId: r.byggeplassId,
          opprettet: ms(r.createdAt),
          attestertStatus: r.attestertStatus,
        })),
        andreRader: [...sedel.maskiner, ...sedel.tillegg, ...sedel.utlegg].map((r): ReiseHavnerAnnenRad => {
          const x = r as { kortId: string | null; projectId?: string | null; externalCostObjectId?: string | null; byggeplassId?: string | null; createdAt?: Date | string | null };
          return { kortId: x.kortId ?? null, projectId: x.projectId ?? null, ecoId: x.externalCostObjectId ?? null, byggeplassId: x.byggeplassId ?? null, opprettet: ms(x.createdAt) };
        }),
        eier: eierId ? { userId: eierId, dato: new Date(sedel.dato).toISOString().slice(0, 10) } : null,
        sedelByggeplass: sedelBp ? (byggeplasser.find((b) => b.id === sedelBp) ?? null) : null,
        reise: {
          projectId,
          ecoId,
          byggeplassId,
          retning: rad.reiseRetning ?? null,
          fraTid: fra || null,
          erReise: true,
        },
        // § 8.22 punkt 3: reisen blir i kortet sitt til prosjekt/byggeplass/underprosjekt rettes.
        lagret: {
          kortId: rad.kortId ?? null,
          projectId: rad.projectId,
          byggeplassId: rad.byggeplassId,
          ecoId: rad.externalCostObjectId,
          erReise: true,
        },
      })
    : null;
  const prosjektNavn = (id: string) => {
    const p = prosjekter.find((x) => x.id === id) ?? ((prosjekterRaw ?? []) as unknown as Prosjekt[]).find((x) => x.id === id);
    return p ? [p.internalProjectNumber, p.name].filter(Boolean).join(" — ") : "";
  };
  const stedNavn = (bp: string | null, p: string) => (bp && byggeplasser.find((b) => b.id === bp)?.name) || prosjektNavn(p);
  const havnerTekst = !havner
    ? null
    : havner.type === "jobb"
      ? t("timer.reiseKort.havnerJobb", { sted: stedNavn(havner.byggeplassId, havner.projectId) })
      : havner.type === "kort"
        ? t("timer.reiseKort.havnerKort", { sted: stedNavn(havner.byggeplassId, havner.projectId) })
        : t("timer.reiseKort.havnerEget", { prosjekt: prosjektNavn(havner.projectId) });

  function lagre() {
    setFeil(null);
    // Rund bare feltene som er rørt — urørt lagret tid sendes aldri som ny tid (RETUR w15f, merknad).
    const f = fra !== (rad.fraTid ?? "") ? rundTilNarmeste(fra, tidsrunding) : fra;
    const ti = til !== (rad.tilTid ?? "") ? rundTilNarmeste(til, tidsrunding) : til;
    if (redigerTillatt && (!KL.test(f) || !KL_TIL.test(ti) || ti <= f)) { setFeil(t("timer.attestering.registrering.ugyldigTid")); return; }
    const kall = reiseRettKall({
      lagret: { fraTid: rad.fraTid, tilTid: rad.tilTid, pauseMin: rad.pauseMin ?? 0, projectId: rad.projectId, byggeplassId: rad.byggeplassId ?? null, ecoId: rad.externalCostObjectId ?? null, lonnsartId: rad.lonnsartId },
      ny: { fraTid: f, tilTid: ti, projectId, byggeplassId, ecoId, lonnsartId },
      redigerTillatt,
    });
    const ok = { onSuccess: (_d: unknown) => onLagret(), onError: (e: { message: string }) => setFeil(e.message) };
    if (kall.type === "ingen") { onAvbryt(); return; }
    if (kall.type === "eco") {
      flytt.mutate({ timerRadId: rad.id, radType: "timer", externalCostObjectId: kall.externalCostObjectId }, ok);
      return;
    }
    rett.mutate({ radType: "timer", radId: rad.id, felter: kall.felter } as Parameters<typeof rett.mutate>[0], ok);
  }

  const inp = "w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500";
  const laast = !redigerTillatt;
  return (
    <Modal open onClose={onAvbryt} title={t("timer.attestering.reiseRett.tittel")} className="w-full max-w-lg">
      <div data-reise-rett-vindu="" className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block font-medium text-gray-700">{t("timer.attestering.reiseRett.start")}</span>
            <input aria-label={t("timer.attestering.reiseRett.start")} value={fra} inputMode="numeric" placeholder="07:00" disabled={laast} onChange={(e) => setFra(e.target.value)} className={`${inp} tabular-nums`} />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-gray-700">{t("timer.attestering.reiseRett.slutt")}</span>
            <input aria-label={t("timer.attestering.reiseRett.slutt")} value={til} inputMode="numeric" placeholder="15:00" disabled={laast} onChange={(e) => setTil(e.target.value)} className={`${inp} tabular-nums`} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">{t("timer.attestering.registrering.lonnsart")}</span>
          <SokbarNedtrekk aria-label={t("timer.attestering.registrering.lonnsart")} value={lonnsartId} disabled={laast} onChange={(e) => setLonnsartId(e.target.value)} className={inp}>
            {artValg.map((x) => <option key={x.id} value={x.id}>{x.navn}</option>)}
          </SokbarNedtrekk>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">{t("timer.felt.prosjekt")}</span>
          <SokbarNedtrekk aria-label={t("timer.felt.prosjekt")} value={projectId ?? ""} disabled={laast} onChange={(e) => byttProsjekt(e.target.value)} className={inp}>
            {prosjekter.map((p) => (
              <option key={p.id} value={p.id}>{[p.internalProjectNumber, p.name].filter(Boolean).join(" — ")}</option>
            ))}
          </SokbarNedtrekk>
        </label>
        {laast ? (
          <label className="block">
            <span className="mb-1 block font-medium text-gray-700">{t("timer.felt.byggeplass")}</span>
            <input aria-label={t("timer.felt.byggeplass")} value={(byggeplassId && byggeplasser.find((b) => b.id === byggeplassId)?.name) || "—"} disabled className={inp} readOnly />
          </label>
        ) : (
          <RadByggeplassFelt kandidater={kandidater} verdi={byggeplassId} onEndre={setByggeplassId} />
        )}
        <div>
          <span className="mb-1 block font-medium text-gray-700">{t("timer.attestering.registrering.underprosjekt")}</span>
          <UnderprosjektValg eco={ecoListe} valgt={ecoId} disabled={opptatt} onVelg={setEcoId} />
        </div>
        {havnerTekst && (
          <p data-havner-i="" className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{havnerTekst}</p>
        )}
        {laast && <p className="text-xs text-gray-500">{t("timer.attestering.reiseRett.bareUnderprosjekt")}</p>}
        {feil && <p role="alert" className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onAvbryt} disabled={opptatt}>{t("handling.avbryt")}</Button>
          <Button onClick={lagre} disabled={opptatt}>{t("handling.lagre")}</Button>
        </div>
      </div>
    </Modal>
  );
}
