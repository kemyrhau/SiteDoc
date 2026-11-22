"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@sitedoc/ui";
import {
  effektivKortByggeplass,
  finnOverlappendeTidsrom,
  klokkeTilMin,
  manuellReiseForklaringTekst,
  manuellReiseTerskelTekst,
  medOverforingPeriodeId,
  periodeDatoFraOverforing,
  tilFraAntall,
  fraFraTilOgAntall,
  jobbManglerBeskrivelse,
  type ReiseKategori,
  type ReiseKortSperre,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { KnappMedForklaring } from "@/components/KnappMedForklaring";
import { RadByggeplassFelt, useRadByggeplass } from "@/components/timer/RadByggeplassFelt";
import { byggeplasserForProsjekt, velgStandardByggeplass, type ByggeplassValg } from "@/lib/timerByggeplass";
import {
  reiseHavnerI,
  useManuellReiseWeb,
  type ReiseHavnerAnnenRad,
  type ReiseHavnerRad,
  type ReiseKortValg,
} from "@/hooks/useManuellReiseWeb";

/* ============================================================================
 *  POST 2026-11-15 (13) L2 § 7 C: reise-kortet («+ Reise») på web.
 *
 *  Erstatter `TimerRadDialog` med låst reise-lønnsart for NY reise-rad — samme
 *  kort som mobilens `ReiseKort`: Tur / Retur, oppmøtestedet som tekst (bare når
 *  firmaet har flere), én resultatlinje og underprosjekt. Tid, kjøretid, lønnsart og
 *  aktivitet utledes — den ansatte velger aldri oppmøtested.
 *
 *  Lagre sperres (KnappMedForklaring) når resultatet har en sperre, når
 *  oppslagene ikke er lastet, eller når sedelen mangler aktivitet.
 *
 *  § 8.22 punkt 2 (Kenneth 2026-11-21, svar 1A): ingen egen kontorreise. Ved
 *  oppmøtestedet kan arbeideren velge «Fra et annet kontor fra i dag» (≥ 2 aktive
 *  kontorer): `oppmotePeriode.overforing` setter perioden fra sedeldatoen FØR raden,
 *  og reisen lagres som vanlig reise fra det kontoret. Kortlinjen «Midlertidig: X fra
 *  dd.mm · Avslutt» avslutter perioden.
 *
 *  w15b (B42 A, presiseringen 2026-11-21): systemet foreslår, arbeideren retter.
 *  «Hvor kjørte du til?» (prosjekt + byggeplass), «Start kl.» og «Slutt kl.» fylt
 *  ut av forslaget og rettbare.
 *  Retter han starten, følger slutten (start + kjøretid); en rettet slutt står.
 *  Bytter han valg, kontor, prosjekt eller byggeplass, regnes forslaget på nytt.
 *  Linja «havner i» regner kortet før lagring (`reiseHavnerI`). Overlapp med en
 *  annen rad og slutt før start sperrer Lagre (serveren avviser overlapp uansett).
 *
 *  O10 (§ 8.22, Kenneth 2026-11-22): «Arbeidstid» er som før O8 — tider, antall,
 *  underprosjekt, sperretekstene og «Avbryt» + «Lagre», som fører arbeidsraden på jobben.
 *
 *  O12 (docs/claude/vedtak-timer-web.md § Reisevinduet):
 *   - pkt 3: i prosjektkort-visning (`kortModus`) er prosjekt og byggeplass kortets, vist som
 *     tekst; reisen lagres i kortet vinduet ble åpnet fra (Reisetid og Arbeidstid).
 *   - pkt 9: over terskel + «Arbeidstid» → gult varsel. Minutt-firma: målt på tiden i vinduet,
 *     og «Lagre» spør «Føre turen som reisetid?». Km-firma: avhukingen «Reisen er mer enn X km».
 *   - pkt 10: forslaget er firmaets kjøretid uten avrunding.
 *   - pkt 12: «Til byggeplass» i et annet kort enn dagens første (Fra: siste) → «Lagre» spør.
 *   - pkt 14: mangler kjøretid (eller byggeplass), skriver arbeideren tiden selv.
 *   - pkt 16: Arbeidstid-reisen lagrer retningen (`arbeidReiseRetning`).
 * ============================================================================ */

/** w15b: en rad på sedelen — dagsrammen, overlapp-sperren og linja «havner i». */
export type ReiseKortDagsrad = ReiseHavnerRad & {
  tilTid: string | null;
  /** O12 pkt 12: reise ført som arbeidstid — ingen jobb, teller ikke som dagens første/siste kort. */
  arbeidReise?: boolean;
  /** O14 pkt 4 (R5): radens «Hva gjorde du?» — om kortet alt har en beskrivelse. */
  beskrivelse?: string | null;
};

/** O1 TILLEGG: «1», «1,5», «0.75» → timer; tomt, 0 eller ugyldig → null. */
function tolkAntall(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : null;
}

/**
 * O6 (§ 8.22): «Antall timer» følger retningen. «Til byggeplass»: slutten (ankomsten, altså
 * jobbstart) står fast, og Start = Slutt − antall. «Fra byggeplass»: Start står fast, og
 * Slutt = Start + antall. Reise bærer aldri matpausen (pause 0). Klemmes ved døgnkanten
 * som før (00:00 / 23:59). null = tiden som skal stå fast, mangler.
 */
export function reiseTiderFraAntall(
  retning: "tur" | "retur",
  fra: string | null,
  til: string | null,
  antall: number,
): { start: string; slutt: string } | null {
  if (retning === "tur") return til ? { start: fraFraTilOgAntall(til, antall), slutt: til } : null;
  return fra ? { start: fra, slutt: tilFraAntall(fra, antall, fra, 0) } : null;
}

/** YYYY-MM-DD → dd.mm */
function kortDato(d: string): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
}

/** O14 pkt 2 (R2): reisen pennen åpner i «Reise»-vinduet. */
export type ReiseKortRedigerRad = {
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  erReise: boolean;
  reiseRetning: string | null;
  arbeidReiseRetning: string | null;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  kortId: string | null;
  beskrivelse: string | null;
};

/** Reisens retning: reisetid bærer `reiseRetning`, arbeidstid `arbeidReiseRetning`. */
export function reiseRadRetning(r: Pick<ReiseKortRedigerRad, "erReise" | "reiseRetning" | "arbeidReiseRetning">): "ut" | "retur" {
  return (r.erReise ? r.reiseRetning : r.arbeidReiseRetning) === "retur" ? "retur" : "ut";
}

/** Start og slutt slik arbeideren har skrevet dem → timer (reise bærer aldri pause). */
function tidFraStartSlutt(fra: string | null, til: string | null): { fraTid: string | null; tilTid: string | null; timer: number } {
  const f = klokkeTilMin(fra);
  const ti = klokkeTilMin(til);
  return { fraTid: fra, tilTid: til, timer: f != null && ti != null && ti > f ? (ti - f) / 60 : 0 };
}

export const SPERRE_NOKKEL: Record<ReiseKortSperre, string> = {
  byggeplassPeriode: "timer.reiseKort.sperre.byggeplassPeriode",
  oppmoteIkkeValgt: "timer.reiseKort.sperre.oppmoteIkkeValgt",
  manglerKjoretid: "timer.reiseKort.sperre.manglerKjoretid",
  manglerDagstid: "timer.reiseKort.sperre.manglerDagstid",
  utenforDognet: "timer.reiseKort.sperre.utenforDognet",
  manglerArt: "timer.reiseTerskel.manglerArt",
  manglerRegel: "timer.reiseKort.sperre.manglerRegel",
};

export function ReiseKort({
  sheetId,
  organizationId,
  dato,
  projectId,
  prosjekter,
  sedelByggeplassId,
  byggeplasser,
  prosjektNavn,
  aktivitetId,
  dagsrader,
  andreRader,
  eierId,
  resolverLonnsartId,
  erFirmaAdmin,
  forvalgtByggeplassId,
  forvalgtEcoId,
  jobbKortId,
  kortModus = false,
  rad,
  onLukk,
}: {
  sheetId: string;
  organizationId: string;
  /** Sedelens dato (YYYY-MM-DD). */
  dato: string;
  projectId: string;
  /** w15b: prosjektene arbeideren kan føre timer på («Hvor kjørte du til?»). */
  prosjekter: readonly { id: string }[];
  /** w15b: sedelens byggeplass — jobbenes effektive byggeplass i linja «havner i». */
  sedelByggeplassId: string | null;
  /** Firmaets byggeplasser (alle prosjekter). */
  byggeplasser: readonly ByggeplassValg[] | undefined;
  prosjektNavn: (projectId: string) => string;
  /** Sedelens aktivitet — reise-raden får den automatisk. null → Lagre sperret. */
  aktivitetId: string | null;
  dagsrader: readonly ReiseKortDagsrad[];
  /** w15f (F55): maskin, tillegg og utlegg på sedelen — linja «havner i» ser kort uten arbeid. */
  andreRader?: readonly ReiseHavnerAnnenRad[];
  /** w15f (F55): sedelens eier — reisens egen kort-id regnes som på serveren. */
  eierId?: string;
  resolverLonnsartId: string | null;
  /** Firmaadmin får lenke til reise-regelsettet ved manglende art. */
  erFirmaAdmin: boolean;
  /** w3a (S6 A, B34 B): «+ Reise» fra en jobb — jobbens byggeplass og underprosjekt er
   *  forvalgt. Feltene står og kan endres. Utelatt = som før. */
  forvalgtByggeplassId?: string | null;
  forvalgtEcoId?: string | null;
  /** O1 (§ 8.22): kort-id-en til jobben vinduet ble åpnet fra. Under terskel føres turen
   *  som arbeid i DEN jobben når nøkkelen er lik. Utelatt = som før (serveren velger). */
  jobbKortId?: string | null;
  /** O12 pkt 3: vinduet er åpnet fra et prosjektkort (prosjektkort-visning). Prosjekt og
   *  byggeplass er kortets og vises som tekst; reisen lagres i kortet `jobbKortId`. */
  kortModus?: boolean;
  /** O14 pkt 2 (R2): reisen pennen åpnet — vinduet redigerer den i stedet for å føre en ny.
   *  Utelatt = ny reise (som før). */
  rad?: ReiseKortRedigerRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  // O14 pkt 2: i redigering fylles feltene fra raden.
  const redigering = rad ?? null;
  const [valg, setValg] = useState<ReiseKortValg | null>(
    redigering ? { type: reiseRadRetning(redigering) === "retur" ? "retur" : "tur" } : null,
  );
  const [ecoId, setEcoId] = useState<string | null>(
    redigering ? redigering.externalCostObjectId : (forvalgtEcoId ?? null),
  );
  const [feil, setFeil] = useState<string | null>(null);
  // O14 pkt 4 (R5): «Hva gjorde du?» — påkrevd når reisen står alene i kortet.
  const [beskrivelse, setBeskrivelse] = useState(redigering?.beskrivelse ?? "");
  // w15b: «Hvor kjørte du til?» — fylt ut fra jobben, kan byttes.
  const [prosjektId, setProsjektId] = useState(projectId);
  // § 8.22 (svar 1A): «Fra et annet kontor fra i dag». null = oppmøtestedet perioden gir.
  const [annetKontorId, setAnnetKontorId] = useState<string | null>(null);
  // w15b: arbeiderens rettede tider. null = forslaget.
  const [rettetStart, setRettetStart] = useState<string | null>(redigering?.fraTid ?? null);
  const [rettetSlutt, setRettetSlutt] = useState<string | null>(redigering?.tilTid ?? null);
  // O1 TILLEGG: arbeiderens valg reisetid/arbeidstid (null = terskelen foreslår) og
  // «Antall timer» slik han skrev det (null = vises fra start og slutt).
  const [kategoriValg, setKategoriValg] = useState<ReiseKategori | null>(
    redigering ? (redigering.erReise ? "reisetid" : "arbeidstid") : null,
  );
  const [antallTekst, setAntallTekst] = useState<string | null>(null);
  // O12 pkt 9: km-firmaets avhuking «Reisen er mer enn X km». null = som firmaets tabell sier.
  const [kmAvhuket, setKmAvhuket] = useState<boolean | null>(null);
  // O12 pkt 9 og 12: dialogen «Lagre» åpner (kortet, terskelen). null = ingen.
  const [dialog, setDialog] = useState<"kort" | "terskel" | null>(null);
  const [lagreSignal, setLagreSignal] = useState(0);
  // O12 pkt 3: i prosjektkort-visning er kortet stedet — bare når det finnes en jobb å lagre i.
  // O14 pkt 2: en reise som redigeres, står alt i kortet sitt.
  const iKort = kortModus && (!!jobbKortId || !!redigering);
  const nullstillTider = () => {
    setRettetStart(null);
    setRettetSlutt(null);
    setAntallTekst(null);
    setKategoriValg(null);
    setKmAvhuket(null);
  };
  const reiseProsjektId = prosjektId;

  // Forvalgt byggeplass fra jobben erstatter auto-forslaget (jobben er stedet).
  const bp = useRadByggeplass({
    byggeplasser,
    projectId: prosjektId,
    rad: redigering
      ? { byggeplassId: redigering.byggeplassId }
      : forvalgtByggeplassId !== undefined
        ? { byggeplassId: forvalgtByggeplassId }
        : undefined,
  });
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({ projectId: reiseProsjektId, organizationId });

  const reise = useManuellReiseWeb({
    organizationId,
    dato,
    projectId: reiseProsjektId,
    byggeplassId: bp.byggeplassId,
    dagsrader,
    resolverLonnsartId,
    valg,
    annetKontorId,
    startTid: rettetStart,
    sluttTid: rettetSlutt,
    kategoriValg,
  });
  const { aktivtValg, resultat, oppmotestedNavn, regelStatus } = reise;
  const { kontorOppsett, kontorKall, kontorKonflikt, apenOverforing } = reise;
  // O14 pkt 2: i redigering er tiden arbeiderens (radens) — forslag og sperrer om kjøretid
  // gjelder ikke en reise som finnes.
  const tid = redigering ? tidFraStartSlutt(rettetStart, rettetSlutt) : resultat;
  const kategoriEndret = !!redigering && kategoriValg !== (redigering.erReise ? "reisetid" : "arbeidstid");

  const overforingMut = trpc.oppmotePeriode.overforing.useMutation({
    onSettled: () => utils.oppmotePeriode.hentMine.invalidate(),
  });

  const oppdater = trpc.timer.dagsseddel.oppdaterTimerRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const tilfoy = trpc.timer.dagsseddel.tilfoyTimerRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const sperre = regelStatus === "klar" ? resultat.sperre : null;
  const lagretByggeplassId = bp.byggeplassId;

  // w15b: slutt før start, og overlapp med en annen rad på sedelen (samme delte regel som
  // timerad-vinduet; serveren avviser overlapp i `tilfoyTimerRad`).
  const fraMin = klokkeTilMin(tid.fraTid);
  const tilMin = klokkeTilMin(tid.tilTid);
  const sluttForStart = fraMin != null && tilMin != null && tilMin <= fraMin;
  const overlapp = sluttForStart ? null : finnOverlappendeTidsrom(tid.fraTid, tid.tilTid, dagsrader);
  const tidSperre = sluttForStart
    ? t("timer.feil.sluttForStart")
    : overlapp
      ? overlapp.projectId
        ? t("timer.feil.overlappKort", {
            fra: tid.fraTid,
            til: tid.tilTid,
            annenFra: overlapp.fraTid,
            annenTil: overlapp.tilTid,
            kort: prosjektNavn(overlapp.projectId),
          })
        : t("timer.feil.overlapp", {
            fra: tid.fraTid,
            til: tid.tilTid,
            annenFra: overlapp.fraTid,
            annenTil: overlapp.tilTid,
          })
      : null;

  // w15b: hvilket kort reisen havner i — samme regel serveren kjører etter lagring.
  const sedelByggeplass = sedelByggeplassId
    ? ((byggeplasser ?? []).find((b) => b.id === sedelByggeplassId) ?? null)
    : null;
  // O12 pkt 12: linja «havner i» finnes ikke i prosjektkort-visning — reisen står i kortet.
  const havner =
    !iKort && regelStatus === "klar" && resultat.spor && tid.fraTid
      ? reiseHavnerI({
          rader: dagsrader,
          andreRader,
          eier: eierId ? { userId: eierId, dato } : null,
          sedelByggeplass,
          jobbKortId,
          reise: {
            projectId: reiseProsjektId,
            ecoId,
            byggeplassId: lagretByggeplassId,
            retning: resultat.spor.reiseRetning,
            fraTid: tid.fraTid,
            erReise: resultat.spor.erReise,
          },
        })
      : null;
  const havnerTekst = !havner
    ? null
    : havner.type === "jobb"
      ? t("timer.reiseKort.havnerJobb", {
          sted:
            (havner.byggeplassId && (byggeplasser ?? []).find((b) => b.id === havner.byggeplassId)?.name) ||
            prosjektNavn(havner.projectId),
        })
      : havner.type === "kort"
        ? t("timer.reiseKort.havnerKort", {
            sted:
              (havner.byggeplassId && (byggeplasser ?? []).find((b) => b.id === havner.byggeplassId)?.name) ||
              prosjektNavn(havner.projectId),
          })
        : t("timer.reiseKort.havnerEget", { prosjekt: prosjektNavn(havner.projectId) });

  // O1 (§ 8.22): under terskel er turen arbeid — den står i jobben vinduet ble åpnet fra
  // (regel 1) når linja «havner i» peker dit, altså når nøkkelen er lik. Ellers ingen kort-id.
  // O12 pkt 3: i prosjektkort-visning står turen alltid i kortet, Reisetid som Arbeidstid.
  const arbeidKortId = iKort
    ? (jobbKortId ?? null)
    : jobbKortId && resultat.spor && !resultat.spor.erReise && havner?.type === "jobb" && havner.kortId === jobbKortId
      ? jobbKortId
      : null;

  // O12 pkt 9: terskelen. Minutt-firma: målt på tiden som står i vinduet. Km-firma: avhukingen,
  // forhåndsavhuket når firmaets tabell er over terskelen.
  const regel = reise.regel;
  const kl = resultat.klassifisering;
  const kmFirma = regel?.reiseTerskelEnhet === "km" && regel.reiseTerskelM != null;
  const tabellOverKm = kl?.forklaring.type === "over" && kl.forklaring.enhet === "km";
  const avhuket = kmAvhuket ?? tabellOverKm;
  const vinduMin = tid.fraTid && tid.tilTid ? Math.round(tid.timer * 60) : null;
  const overTerskel = kmFirma
    ? avhuket
    : regel != null && regel.reiseTerskelEnhet === "minutter" && vinduMin != null && vinduMin >= regel.reiseTerskelMin;
  const visTerskelVarsel = regelStatus === "klar" && kl?.kategori === "arbeidstid" && overTerskel;
  const terskelTekst = !regel
    ? ""
    : kmFirma
      ? manuellReiseTerskelTekst(t, { type: "over", enhet: "km", terskelM: regel.reiseTerskelM! })
      : manuellReiseTerskelTekst(t, { type: "over", enhet: "minutter", terskelMin: regel.reiseTerskelMin });
  const kreverTerskelDialog = visTerskelVarsel && !kmFirma;

  // O12 pkt 12: dagens første og siste kort (jobber med arbeid, klokke fra arbeidsradene).
  const kortPaaDagen = new Map<string, { projectId: string | null; byggeplassId: string | null; fra: number | null; til: number | null; fraTid: string | null; tilTid: string | null }>();
  for (const r of dagsrader) {
    if (r.erReise || r.arbeidReise || !r.kortId || r.attestertStatus === "erstattet") continue;
    const k = kortPaaDagen.get(r.kortId) ?? {
      projectId: r.projectId ?? null,
      byggeplassId: effektivKortByggeplass(r.projectId ?? null, r.byggeplassId ?? null, sedelByggeplass),
      fra: null,
      til: null,
      fraTid: null,
      tilTid: null,
    };
    const f = klokkeTilMin(r.fraTid);
    const ti = klokkeTilMin(r.tilTid);
    if (f != null && (k.fra == null || f < k.fra)) {
      k.fra = f;
      k.fraTid = r.fraTid;
    }
    if (ti != null && (k.til == null || ti > k.til)) {
      k.til = ti;
      k.tilTid = r.tilTid;
    }
    kortPaaDagen.set(r.kortId, k);
  }
  const kortListe = [...kortPaaDagen.entries()].map(([kortId, k]) => ({ kortId, ...k }));
  const dagensKort =
    aktivtValg.type === "tur"
      ? [...kortListe].sort((a, b) => (a.fra ?? 1e9) - (b.fra ?? 1e9))[0]
      : [...kortListe].sort((a, b) => (b.til ?? -1) - (a.til ?? -1))[0];
  const kortSjekk = iKort && !!dagensKort && dagensKort.kortId !== jobbKortId ? dagensKort : null;
  const kortSjekkTekst = kortSjekk
    ? [
        kortSjekk.projectId ? prosjektNavn(kortSjekk.projectId) : null,
        kortSjekk.byggeplassId ? ((byggeplasser ?? []).find((b) => b.id === kortSjekk.byggeplassId)?.name ?? null) : null,
        kortSjekk.fraTid && kortSjekk.tilTid ? `${kortSjekk.fraTid}–${kortSjekk.tilTid}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  // O14 pkt 4 (R5): kortet reisen står i etter lagring. Nytt underprosjekt i redigering gir eget
  // kort. Reisen står alene når kortet ikke har arbeid; da er beskrivelsen påkrevd når ingen annen
  // reise i kortet har en (samme delte regel som merket «Mangler beskrivelse» og `send`).
  const maalKortId = redigering
    ? ecoId !== redigering.externalCostObjectId
      ? null
      : redigering.kortId
    : iKort
      ? (jobbKortId ?? null)
      : null;
  const kortRader = maalKortId == null ? [] : dagsrader.filter((r) => r.kortId === maalKortId);
  const reiseErReiseEtter = redigering ? kategoriValg === "reisetid" : resultat.spor?.erReise === true;
  const reiseAlene = kortRader.every((r) => r.erReise || r.arbeidReise || r.attestertStatus === "erstattet" || r.projectId == null);
  const somRad = (tekst: string) => ({
    projectId: reiseProsjektId,
    erReise: reiseErReiseEtter,
    attestertStatus: "pending",
    beskrivelse: tekst,
  });
  const kortRaderBeskrivelse = kortRader.map((r) => ({
    projectId: r.projectId ?? null,
    erReise: r.erReise,
    attestertStatus: r.attestertStatus ?? null,
    beskrivelse: r.beskrivelse ?? null,
  }));
  const beskrivelsePakrevd =
    iKort &&
    reiseAlene &&
    jobbManglerBeskrivelse([...kortRaderBeskrivelse, somRad("")]) &&
    !jobbManglerBeskrivelse([...kortRaderBeskrivelse, somRad("x")]);
  const beskrivelseMangler = beskrivelsePakrevd && beskrivelse.trim() === "";

  // O14 pkt 2: redigering lagrer radens tid; lønnsarten trengs bare når «Føres som» byttes.
  const kanLagreRedigering =
    !!redigering &&
    tidSperre == null &&
    tid.timer > 0 &&
    !!tid.fraTid &&
    !!tid.tilTid &&
    !beskrivelseMangler &&
    (!kategoriEndret || (regelStatus === "klar" && !!resultat.klassifisering?.lonnsartId));
  const kanLagre = redigering
    ? kanLagreRedigering
    : !beskrivelseMangler &&
      regelStatus === "klar" &&
    sperre == null &&
    tidSperre == null &&
    tid.timer > 0 &&
    !kontorKonflikt &&
    !overforingMut.isPending &&
    !!aktivitetId &&
    !!resultat.spor &&
    !!resultat.klassifisering?.lonnsartId &&
    !!tid.fraTid &&
    !!tid.tilTid;

  const forklaring = redigering
    ? (tidSperre ??
      (kategoriEndret && !resultat.klassifisering?.lonnsartId
        ? regelStatus === "feilet"
          ? t("sperret.reiseRegelFeilet")
          : regelStatus === "laster"
            ? t("sperret.reiseRegelLaster")
            : sperre
              ? t(SPERRE_NOKKEL[sperre])
              : ""
        : beskrivelseMangler
          ? t("sperret.beskrivelse")
          : ""))
    : regelStatus === "feilet"
      ? t("sperret.reiseRegelFeilet")
      : regelStatus === "laster"
        ? t("sperret.reiseRegelLaster")
        : sperre === "manglerArt" && erFirmaAdmin
          ? t("timer.reiseTerskel.manglerStandardArt")
          : sperre
          ? t(SPERRE_NOKKEL[sperre])
          : tidSperre
          ? tidSperre
          : kontorKonflikt
            ? t("timer.reiseKort.sperre.adminMidlertidig")
            : !aktivitetId
            ? t("timer.feil.aktivitetPaakrevd")
            : beskrivelseMangler
            ? t("sperret.beskrivelse")
            : "";

  /** O14 pkt 2 (R2): «Lagre» i redigering skriver raden — ingen ny rad, ingen overføring. */
  function lagreRedigering() {
    if (!redigering || !kanLagreRedigering || !tid.fraTid || !tid.tilTid) return;
    setFeil(null);
    const retning = aktivtValg.type === "retur" ? ("retur" as const) : ("ut" as const);
    oppdater.mutate({
      id: redigering.id,
      fraTid: tid.fraTid,
      tilTid: tid.tilTid,
      timer: tid.timer,
      pauseMin: 0,
      externalCostObjectId: ecoId,
      ...(kategoriEndret && resultat.klassifisering?.lonnsartId ? { lonnsartId: resultat.klassifisering.lonnsartId } : {}),
      ...(kategoriValg === "arbeidstid" ? { arbeidReiseRetning: retning } : { reiseRetning: retning }),
      ...((beskrivelse.trim() || null) !== (redigering.beskrivelse?.trim() || null)
        ? { beskrivelse: beskrivelse.trim() || null }
        : {}),
    });
  }

  async function lagre() {
    if (!kanLagre || !aktivitetId || !resultat.spor || !resultat.klassifisering?.lonnsartId) return;
    setFeil(null);
    let s = resultat.spor;
    if (kontorKall) {
      // Perioden skrives FØR raden, så raden bærer periodens id i reiseRegel.
      try {
        const r = await overforingMut.mutateAsync({
          id: crypto.randomUUID(),
          organizationId,
          handling: kontorKall.handling,
          oppmotestedId: kontorKall.oppmotestedId,
          dato: kontorKall.dato,
        });
        // Ny ved «opprettet», åpen ved «ingen».
        s = medOverforingPeriodeId(s, r.periode?.id ?? null);
      } catch (e) {
        setFeil(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    tilfoy.mutate({
      sheetId,
      projectId: reiseProsjektId,
      lonnsartId: resultat.klassifisering.lonnsartId,
      aktivitetId,
      timer: tid.timer,
      externalCostObjectId: ecoId,
      vehicleId: null,
      // O14 pkt 4 (R5): «Hva gjorde du?» (tomt = ingen).
      beskrivelse: beskrivelse.trim() || null,
      fraTid: tid.fraTid,
      tilTid: tid.tilTid,
      // Reise bærer aldri matpausen (pauseFraForRad hopper over erReise).
      pauseMin: 0,
      byggeplassId: lagretByggeplassId,
      ...(arbeidKortId ? { kortId: arbeidKortId } : {}),
      // O12 pkt 3: Reisetid lagres også i kortet vinduet ble åpnet fra.
      ...(iKort && s.erReise ? { reiseIKort: true } : {}),
      // O12 pkt 16: en reise ført som arbeidstid lagrer at den er en reise (retningen).
      ...(!s.erReise ? { arbeidReiseRetning: aktivtValg.type === "retur" ? ("retur" as const) : ("ut" as const) } : {}),
      // Sporet kun når regelen sier reise; under terskel er raden ordinær
      // (reiseKilde null → serveren nuller sporet).
      ...(s.erReise && s.reiseKilde
        ? {
            reiseKilde: s.reiseKilde,
            reiseRetning: s.reiseRetning,
            reiseOppmotestedId: s.reiseOppmotestedId,
            reiseKjoretidMin: s.reiseKjoretidMin,
            reiseAvstandM: s.reiseAvstandM,
            reiseRegel: s.reiseRegel as unknown as Record<string, unknown> | null,
          }
        : {}),
    });
  }

  // O12 pkt 9 og 12: «Lagre» spør først om kortet, så om terskelen; begge svar lagrer.
  function trykkLagre() {
    if (!kanLagre) return;
    if (redigering) {
      lagreRedigering();
      return;
    }
    if (kortSjekk) setDialog("kort");
    else if (kreverTerskelDialog) setDialog("terskel");
    else void lagre();
  }
  function jaLagreIKortet() {
    if (kreverTerskelDialog) {
      setDialog("terskel");
      return;
    }
    setDialog(null);
    void lagre();
  }
  function forSomReisetid() {
    setDialog(null);
    setKategoriValg("reisetid");
    // Lagres når resultatet er regnet på nytt med «Reisetid» (neste render).
    setLagreSignal((n) => n + 1);
  }
  function beholdArbeidstid() {
    setDialog(null);
    void lagre();
  }
  useEffect(() => {
    if (lagreSignal > 0) void lagre();
    // Bare signalet: lagringen bruker resultatet fra renderen etter byttet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lagreSignal]);

  // O12 pkt 9: km-avhukingen — avhuket gir «Reisetid», ellers det firmaet fører under terskelen.
  function settKmAvhuket(v: boolean) {
    setKmAvhuket(v);
    setKategoriValg(v ? "reisetid" : (regel?.reiseUnderTerskelType ?? "arbeidstid"));
  }

  /** Avslutt uten reise: perioden slutter dagen før sedeldatoen (slettes om den startet i dag). */
  function avsluttOverforing() {
    setFeil(null);
    overforingMut.mutate(
      {
        id: crypto.randomUUID(),
        organizationId,
        handling: "slutt",
        dato: periodeDatoFraOverforing(dato, "00:00", "retur"),
      },
      {
        onSuccess: () => {
          setAnnetKontorId(null);
          nullstillTider();
        },
        onError: (e: { message: string }) => setFeil(e.message),
      },
    );
  }

  // w15b: forslaget regnes på nytt når valget endres — rettede tider forkastes.
  function velg(v: ReiseKortValg) {
    setValg(v);
    // O14 pkt 2: en reise som redigeres, beholder tidene sine når retningen rettes.
    if (redigering) return;
    nullstillTider();
  }
  function byttProsjekt(id: string) {
    setProsjektId(id);
    // Underprosjektet hører til prosjektet; byggeplassen foreslås på nytt for det nye.
    setEcoId(null);
    bp.setByggeplassId(
      velgStandardByggeplass({ gjeldende: null, kandidater: byggeplasserForProsjekt(byggeplasser, id), toppbar: null }),
    );
    nullstillTider();
  }

  const valgKnapp = (v: ReiseKortValg, tekst: string, key: string) => {
    const aktiv = v.type === aktivtValg.type;
    return (
      <button
        key={key}
        type="button"
        onClick={() => {
          if (!aktiv) velg(v);
        }}
        aria-pressed={aktiv}
        className={`rounded-lg border px-3 py-2 text-sm ${
          aktiv ? "border-blue-600 bg-blue-50 font-medium text-blue-800" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
        }`}
      >
        {tekst}
      </button>
    );
  };

  return (
    <Modal open={true} onClose={onLukk} title={t("timer.reiseKort.tittel")}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {valgKnapp({ type: "tur" }, t("timer.reiseKort.tur"), "tur")}
          {valgKnapp({ type: "retur" }, t("timer.reiseKort.retur"), "retur")}
        </div>

        {!redigering && apenOverforing && apenOverforing.oppmotestedId && (
          <p className="text-sm text-gray-700">
            {t("timer.reiseKort.midlertidigLinje", {
              navn: reise.kontorNavn(apenOverforing.oppmotestedId),
              dato: kortDato(apenOverforing.fraDato),
            })}
            <span className="mx-1 text-gray-400">·</span>
            <button
              type="button"
              onClick={avsluttOverforing}
              disabled={overforingMut.isPending}
              className="font-medium text-blue-700 hover:underline disabled:opacity-50"
            >
              {t("timer.reiseKort.avslutt")}
            </button>
          </p>
        )}

        {oppmotestedNavn && (
          <p className="text-sm text-gray-700">
            {/* O14 pkt 7 (R6): «Fra byggeplass» går til oppmøtestedet. */}
            {t(aktivtValg.type === "retur" ? "timer.reiseKort.tilOppmotested" : "timer.reiseKort.fraOppmotested", {
              navn: oppmotestedNavn,
            })}
          </p>
        )}

        {/* § 8.22 (svar 1A): midlertidig oppmøtested satt av arbeideren selv — reisen
            regnes fra kontoret, perioden gjelder fra i dag. */}
        {/* O14 pkt 2: skjult i redigering — overføringen hører til en ny reise. */}
        {!redigering && kontorOppsett && kontorOppsett.andre.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-annet-kontor">
              {t("timer.reiseKort.annetKontorFraIDag")}
            </label>
            <select
              id="reise-annet-kontor"
              value={annetKontorId ?? ""}
              onChange={(e) => {
                setAnnetKontorId(e.target.value || null);
                nullstillTider();
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {kontorOppsett.andre.map((id) => (
                <option key={id} value={id}>
                  {reise.kontorNavn(id)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* w15b: «Hvor kjørte du til?» — prosjekt og byggeplass. */}
        <div>
            <p className="mb-2 text-sm font-medium text-gray-900">
              {aktivtValg.type === "retur" ? t("timer.reiseKort.hvorFra") : t("timer.reiseKort.hvorTil")}
            </p>
            {iKort ? (
              /* O12 pkt 3: kortets prosjekt og byggeplass — tekst, ingen nedtrekk. */
              <div data-testid="reise-kort-sted">
                <p className="text-sm text-gray-800">
                  {[
                    prosjektNavn(prosjektId),
                    bp.byggeplassId ? ((byggeplasser ?? []).find((b) => b.id === bp.byggeplassId)?.name ?? null) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-gray-500">{t("timer.reiseKort.foresIKortet")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-prosjekt">
                    {t("timer.felt.prosjekt")}
                  </label>
                  <select
                    id="reise-prosjekt"
                    value={prosjektId}
                    onChange={(e) => byttProsjekt(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    {!prosjekter.some((p) => p.id === prosjektId) && (
                      <option value={prosjektId}>{prosjektNavn(prosjektId)}</option>
                    )}
                    {prosjekter.map((p) => (
                      <option key={p.id} value={p.id}>
                        {prosjektNavn(p.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <RadByggeplassFelt
                  kandidater={bp.kandidater}
                  verdi={bp.byggeplassId}
                  onEndre={(id) => {
                    bp.setByggeplassId(id);
                    nullstillTider();
                  }}
                />
              </div>
            )}
          </div>

        {/* w15b: start og slutt er forslaget og kan rettes. Skjult bare når det ikke finnes
            noe å foreslå fra (byggeplass-periode, oppmøtested ikke valgt, kjøretid mangler). */}
        {/* O12 pkt 14: mangler kjøretid (eller byggeplass) skriver arbeideren tiden selv. */}
        {!redigering && regelStatus === "klar" && resultat.utenKjoretid && (
          <p data-testid="reise-uten-kjoretid" className="text-xs text-gray-500">
            {t(resultat.utenKjoretid === "utenByggeplass" ? "timer.reiseKort.utenByggeplass" : "timer.reiseKort.utenKjoretid")}
          </p>
        )}
        {(redigering ||
          (regelStatus === "klar" &&
            sperre !== "byggeplassPeriode" &&
            sperre !== "oppmoteIkkeValgt" &&
            sperre !== "manglerKjoretid")) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-start">
                  {t("timer.reiseKort.startKl")}
                </label>
                <input
                  id="reise-start"
                  type="time"
                  value={rettetStart ?? tid.fraTid ?? ""}
                  onChange={(e) => {
                    const start = e.target.value || null;
                    setRettetStart(start);
                    // O7 (§ 8.22 punkt 4): «Til byggeplass» — slutten (ankomsten, jobbstart)
                    // står fast, og antall timer regnes på nytt som Slutt − Start (fra
                    // `resultat.timer`, altså det som lagres).
                    // O14 pkt 2: i redigering står slutten også ved «Fra byggeplass» (som O7 i
                    // «Rediger reise»): antall timer regnes av start og slutt.
                    if (aktivtValg.type === "tur" || redigering) {
                      setRettetSlutt(rettetSlutt ?? tid.tilTid ?? null);
                      setAntallTekst(null);
                      return;
                    }
                    // «Fra byggeplass»: slutten følger starten — start + skrevet antall timer,
                    // ellers start + kjøretid, til den rettes igjen.
                    const antall = tolkAntall(antallTekst);
                    setRettetSlutt(start && antall != null ? tilFraAntall(start, antall, start, 0) : null);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-slutt">
                  {t("timer.reiseKort.sluttKl")}
                </label>
                <input
                  id="reise-slutt"
                  type="time"
                  value={rettetSlutt ?? tid.tilTid ?? ""}
                  onChange={(e) => {
                    setRettetSlutt(e.target.value || null);
                    // Rettet slutt → antall timer regnes av start og slutt.
                    setAntallTekst(null);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {/* O1 TILLEGG: antall timer regner tiden ut (og omvendt). O6: retningen avgjør
                  hvilken ende som står fast — se `reiseTiderFraAntall`. */}
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-antall">
                  {t("timer.felt.antallTimer")}
                </label>
                <input
                  id="reise-antall"
                  type="number"
                  step="0.25"
                  min={0}
                  max={24}
                  value={antallTekst ?? (tid.fraTid && tid.tilTid ? String(Math.round(tid.timer * 100) / 100) : "")}
                  onChange={(e) => {
                    setAntallTekst(e.target.value);
                    const antall = tolkAntall(e.target.value);
                    const tider =
                      antall != null
                        ? reiseTiderFraAntall(aktivtValg.type, tid.fraTid, tid.tilTid, antall)
                        : null;
                    if (tider && antall != null) {
                      // O6: «Til byggeplass» flytter Start; «Fra byggeplass» flytter Slutt.
                      if (aktivtValg.type === "tur") setRettetStart(tider.start);
                      setRettetSlutt(tider.slutt);
                      // Gate (136) vilkår 1: klemmes tiden ved døgnkanten (00:00 / 23:59),
                      // viser feltet det som faktisk lagres (`resultat.timer`), ikke det skrevne.
                      const startMin = klokkeTilMin(tider.start);
                      const sluttMin = klokkeTilMin(tider.slutt);
                      if (startMin != null && sluttMin != null && Math.abs(sluttMin - startMin - antall * 60) > 0.5) {
                        setAntallTekst(null);
                      }
                    }
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

        {/* O1 TILLEGG (§ 8.22): terskelen foreslår, arbeideren velger reisetid eller arbeidstid. */}
        {(redigering || (regelStatus === "klar" && resultat.klassifisering)) && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">{t("timer.reiseKort.foresSom")}</p>
            <div className="flex flex-wrap gap-2">
              {(["reisetid", "arbeidstid"] as const).map((k) => {
                const aktiv = redigering ? kategoriValg === k : resultat.klassifisering!.kategori === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKategoriValg(k)}
                    aria-pressed={aktiv}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      aktiv
                        ? "border-blue-600 bg-blue-50 font-medium text-blue-800"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {t(k === "reisetid" ? "timer.reisetid" : "timer.reiseKort.arbeidstid")}
                  </button>
                );
              })}
            </div>
            {/* O12 pkt 9: km-firma — arbeideren huker av om reisen var lengre enn terskelen. */}
            {kmFirma && !redigering && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  data-testid="reise-mer-enn-km"
                  checked={avhuket}
                  onChange={(e) => settKmAvhuket(e.target.checked)}
                />
                {t("timer.reiseKort.merEnnKm", { terskel: terskelTekst })}
              </label>
            )}
          </div>
        )}

        {/* O12 pkt 9: over terskel og «Arbeidstid» — gult varsel, uten lenke. */}
        {visTerskelVarsel && (
          <p
            data-testid="reise-over-terskel-varsel"
            className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {t("timer.reiseKort.overTerskelVarsel", { terskel: terskelTekst })}
          </p>
        )}

        {/* Forslaget: firmaets kjøretid, deretter hvorfor arbeid/reise. */}
        {!redigering && regelStatus === "klar" && resultat.kjoretidMin != null && (
          <div>
            <p className="text-sm text-gray-700">{t("timer.reiseKort.forslag", { min: resultat.kjoretidMin })}</p>
            {resultat.klassifisering && resultat.klassifisering.lonnsartId != null && (
              <p className="mt-1 text-xs text-gray-500">
                {/* O1: turen føres som arbeid i jobben vinduet ble åpnet fra — si det. */}
                {/* O12 pkt 3: Reisetid står også i kortet, men er ikke arbeidstid — da den delte linja. */}
                {arbeidKortId &&
                resultat.klassifisering.kategori === "arbeidstid" &&
                resultat.klassifisering.forklaring.type !== "ukjentAvstand"
                  ? t(
                      resultat.klassifisering.forklaring.type === "under"
                        ? "timer.reiseKort.underTerskelPaaJobb"
                        : "timer.reiseKort.overTerskelPaaJobb",
                      {
                        terskel: manuellReiseTerskelTekst(t, resultat.klassifisering.forklaring),
                        art: reise.lonnsartNavn(resultat.klassifisering.lonnsartId) ?? "",
                      },
                    )
                  : manuellReiseForklaringTekst(
                      t,
                      resultat.klassifisering,
                      reise.lonnsartNavn(resultat.klassifisering.lonnsartId),
                    )}
              </p>
            )}
          </div>
        )}

        {/* Ordre (11) C: mangler lønnsart → rød tekst; firmaadmin får lenke til
            reise-regelsettet (firmaadmin skal ikke bes om å spørre firmaadmin). */}
        {!redigering && sperre === "manglerArt" && (
          <p className="text-xs font-medium text-red-700">
            {erFirmaAdmin ? t("timer.reiseTerskel.manglerStandardArt") : t("timer.reiseTerskel.manglerArt")}
            {erFirmaAdmin && (
              <>
                {" "}
                <Link href="/dashbord/firma/innstillinger#reise-regelsett" className="underline hover:text-red-900">
                  {t("timer.reiseTerskel.settStandardArt")}
                </Link>
              </>
            )}
          </p>
        )}
        {/* Øvrige sperrer (mangler kjøretid, utenfor døgnet …) vises synlig i
            kortet — tooltipen alene når ikke berøringsskjerm og havner bak modalen. */}
        {redigering && forklaring && <p className="text-xs font-medium text-red-700">{forklaring}</p>}
        {!redigering && sperre && sperre !== "manglerArt" && forklaring && (
          <p className="text-xs font-medium text-red-700">{forklaring}</p>
        )}
        {!redigering && !sperre && tidSperre && <p className="text-xs font-medium text-red-700">{tidSperre}</p>}
        {!redigering && !sperre && !tidSperre && kontorKonflikt && (
          <p className="text-xs font-medium text-red-700">{t("timer.reiseKort.sperre.adminMidlertidig")}</p>
        )}

        {ecoer && ecoer.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.underprosjekt")}{" "}
              <span className="text-xs text-gray-400">({t("label.valgfritt")})</span>
            </label>
            <select
              value={ecoId ?? ""}
              onChange={(e) => setEcoId(e.target.value || null)}
              aria-label={t("timer.felt.underprosjekt")}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {ecoer.map((eco) => (
                <option key={eco.id} value={eco.id}>
                  {eco.proAdmId} — {eco.kortNavn}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* O14 pkt 4 (R5): «Hva gjorde du?» — påkrevd når reisen står alene i kortet. */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-beskrivelse">
            {t("timer.felt.radBeskrivelse")}{" "}
            {beskrivelsePakrevd ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs text-gray-400">({t("label.valgfritt")})</span>
            )}
          </label>
          <textarea
            id="reise-beskrivelse"
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            placeholder={t("timer.radBeskrivelsePlaceholder")}
            rows={2}
            aria-invalid={beskrivelseMangler || undefined}
            className={`w-full rounded border px-3 py-2 text-sm ${beskrivelseMangler ? "border-red-400" : "border-gray-300"}`}
          />
        </div>

        {/* w15b: hvor reisen havner før han lagrer — samme regel som serveren. */}
        {havnerTekst && (
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">{havnerTekst}</p>
        )}

        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <KnappMedForklaring sperret={!kanLagre && !tilfoy.isPending && !oppdater.isPending} forklaring={forklaring}>
            <Button type="button" onClick={trykkLagre} disabled={!kanLagre || tilfoy.isPending || oppdater.isPending}>
              {tilfoy.isPending || overforingMut.isPending || oppdater.isPending ? t("handling.lagrer") : t("handling.lagre")}
            </Button>
          </KnappMedForklaring>
        </div>
      </div>
      {/* O12 pkt 12: reisen føres i et annet kort enn dagens første (Til) / siste (Fra). */}
      {dialog === "kort" && kortSjekk && (
        <Modal open={true} onClose={() => setDialog(null)} title={t("timer.reiseKort.kortSjekk.tittel")}>
          <div className="space-y-4" data-testid="reise-kort-sjekk">
            <p className="text-sm text-gray-800">
              {t(aktivtValg.type === "tur" ? "timer.reiseKort.kortSjekk.tekstTur" : "timer.reiseKort.kortSjekk.tekstRetur", {
                kort: kortSjekkTekst,
              })}
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
                {t("handling.avbryt")}
              </Button>
              <Button type="button" onClick={jaLagreIKortet}>
                {t("timer.reiseKort.kortSjekk.jaLagre")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {/* O12 pkt 9: minutt-firma over terskel med «Arbeidstid» — begge svar lagrer; X lukker. */}
      {dialog === "terskel" && (
        <Modal open={true} onClose={() => setDialog(null)} title={t("timer.reiseKort.terskelDialog.tittel")}>
          <div className="space-y-4" data-testid="reise-terskel-dialog">
            <p className="text-sm text-gray-800">{t("timer.reiseKort.overTerskelVarsel", { terskel: terskelTekst })}</p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={beholdArbeidstid}>
                {t("timer.reiseKort.terskelDialog.beholdArbeidstid")}
              </Button>
              <Button type="button" onClick={forSomReisetid}>
                {t("timer.reiseKort.terskelDialog.forSomReisetid")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
