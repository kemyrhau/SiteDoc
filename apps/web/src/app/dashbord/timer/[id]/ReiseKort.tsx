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
  avsluttSisteDagForslag,
  minTilKlokke,
  delVedMidnatt,
  lesMidnattDel,
  finnReiseSomEnderPaaKontor,
  jobbManglerBeskrivelse,
  erEgenOverforing,
  type OverforingPeriode,
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
 *  O16 (vedtak-timer-web.md § Reisevinduet pkt 1–2): linja «Fra → Til» med oppmøtestedet som
 *  ett nedtrekk (under «Fra» ved «Til byggeplass», under «Til» ved «Fra byggeplass»), og et
 *  tredje valg «Til annet oppmøtested» (kontor → kontor, ≥ 2 aktive kontorer). Et annet kontor
 *  gir den blå boksen med «Gjelder fra» / «Til og med»; det faste kontoret mens et eget
 *  midlertidig gjelder gir «Siste dag». `oppmotePeriode.overforing` skriver perioden FØR raden.
 *  Under feltet står perioden som gjelder, med «Avslutt» når den er arbeiderens egen.
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
 *   - pkt 16: Arbeidstid-reisen lagrer retningen (`arbeidReiseRetning`) — gjelder nå bare lagrede rader.
 *
 *  O18 (vedtak-timer-web.md § Reisevinduet pkt 20): en ny reise under terskel føres ikke som reise.
 *  Vinduet sier «Under terskel: før tiden som arbeidstid i jobbens Fra–til» og har knappen «Før som
 *  reisetid likevel», som lagrer Reisetid med samme regler og lønnsart som over terskel. «Arbeidstid»
 *  er ikke et valg for ny reise; ingen ny rad får `arbeidReiseRetning`. Feltene står (O10). Med den
 *  blå boksen lagrer «Lagre oppmøtested» bare stedsbyttet (S1). Minuttfirma: tiden i vinduet over
 *  terskelen gir et gult hint (S4). Firmaets under/over-type styrer (S3). En lagret arbeidstid-reise
 *  redigeres som før (S5 A).
 *
 *  O19 (vedtak-timer-web.md § Reisevinduet pkt 20, 23–25):
 *   - pkt 20: teksten under terskel står i en blå boks.
 *   - pkt 23–24: en ny reise over midnatt deles ved 24:00 (`delVedMidnatt`). Den blå boksen sier
 *     hvilke tider som føres hvilken dag; «Lagre» kaller `tilfoyDeltReise` (begge delene i én
 *     transaksjon). Overlapp sjekkes her på delen som står på vinduets sedel; serveren sjekker begge.
 *   - En delt rad som redigeres: midnattsgrensen står som låst tekst (B2). Endres underprosjekt,
 *     beskrivelse eller «Føres som», spør «Lagre» om delen den andre dagen skal rettes også.
 *   - pkt 25: «Til byggeplass» som overlapper en kontorreise (kontor → kontor) stoppes med lenke
 *     til «Sted og aktivitet» (`onAapneSted`).
 * ============================================================================ */

/** w15b: en rad på sedelen — dagsrammen, overlapp-sperren og linja «havner i». */
export type ReiseKortDagsrad = ReiseHavnerRad & {
  tilTid: string | null;
  /** O12 pkt 12: reise ført som arbeidstid — ingen jobb, teller ikke som dagens første/siste kort. */
  arbeidReise?: boolean;
  /** O14 pkt 4 (R5): radens «Hva gjorde du?» — om kortet alt har en beskrivelse. */
  beskrivelse?: string | null;
  /** O19 pkt 25: sporet — en kontorreise (kontor → kontor) stopper «Til byggeplass». */
  reiseRegel?: unknown;
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
 * Slutt = Start + antall. Reise bærer aldri matpausen (pause 0). O19 pkt 23: tiden klemmes ikke
 * lenger ved døgnkanten — klokka går rundt midnatt, og reisen deles ved 24:00 når den lagres.
 * null = tiden som skal stå fast, mangler.
 */
export function reiseTiderFraAntall(
  retning: "tur" | "retur",
  fra: string | null,
  til: string | null,
  antall: number,
): { start: string; slutt: string } | null {
  const min = Math.round(antall * 60);
  if (retning === "tur") return til ? { start: flyttKlokke(til, -min), slutt: til } : null;
  return fra ? { start: fra, slutt: flyttKlokke(fra, min) } : null;
}

/** O19: klokkeslett + minutter, rundt midnatt (24:00 regnes som 00:00). */
function flyttKlokke(klokke: string, min: number): string {
  const m = (klokkeTilMin(klokke) ?? 0) + min;
  return minTilKlokke(((m % 1440) + 1440) % 1440);
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
  /** O16 R5: sporet — en kontoroverføring (kontor → kontor) åpnes som «Til annet oppmøtested». */
  reiseKilde?: string | null;
  reiseRegel?: unknown;
};

/** O16 R5: kontor→kontor-ruten i en lagret overføringsrad, ellers null. */
export function kontorRute(r: Pick<ReiseKortRedigerRad, "reiseKilde" | "reiseRegel">): { fra: string; til: string } | null {
  if (r.reiseKilde !== "overforing" || r.reiseRegel == null || typeof r.reiseRegel !== "object") return null;
  const ovf = (r.reiseRegel as { overforing?: { fra?: { type?: string; oppmotestedId?: string }; til?: { type?: string; oppmotestedId?: string } } }).overforing;
  if (ovf?.fra?.type !== "kontor" || ovf.til?.type !== "kontor" || !ovf.fra.oppmotestedId || !ovf.til.oppmotestedId) return null;
  return { fra: ovf.fra.oppmotestedId, til: ovf.til.oppmotestedId };
}

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
  onAapneSted,
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
  /** O19 pkt 25: åpner «Sted og aktivitet» for kortet vinduet ble åpnet fra. Utelatt = ingen lenke. */
  onAapneSted?: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  // O14 pkt 2: i redigering fylles feltene fra raden.
  const redigering = rad ?? null;
  // O16 R5: en lagret kontoroverføring åpnes som «Til annet oppmøtested»; retningen står.
  const redigertRute = redigering ? kontorRute(redigering) : null;
  const [valg, setValg] = useState<ReiseKortValg | null>(
    redigering
      ? redigertRute
        ? { type: "kontor" }
        : { type: reiseRadRetning(redigering) === "retur" ? "retur" : "tur" }
      : null,
  );
  const [ecoId, setEcoId] = useState<string | null>(
    redigering ? redigering.externalCostObjectId : (forvalgtEcoId ?? null),
  );
  const [feil, setFeil] = useState<string | null>(null);
  // O14 pkt 4 (R5): «Hva gjorde du?» — påkrevd når reisen står alene i kortet.
  const [beskrivelse, setBeskrivelse] = useState(redigering?.beskrivelse ?? "");
  // w15b: «Hvor kjørte du til?» — fylt ut fra jobben, kan byttes.
  const [prosjektId, setProsjektId] = useState(projectId);
  // O16 pkt 1: kontoret i oppmøtested-feltet. null = dagens oppmøtested.
  const [annetKontorId, setAnnetKontorId] = useState<string | null>(null);
  // O16 pkt 2: arbeiderens datoer i den blå boksen. null = forslaget.
  const [gjelderFra, setGjelderFra] = useState<string | null>(null);
  const [tilOgMed, setTilOgMed] = useState<string | null>(null);
  const [sisteDag, setSisteDag] = useState<string | null>(null);
  const nullstillDatoer = () => {
    setGjelderFra(null);
    setTilOgMed(null);
    setSisteDag(null);
  };
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
  // O12 pkt 12: dialogen «Lagre» åpner (kortet). null = ingen.
  const [dialog, setDialog] = useState<"kort" | "rettDel" | null>(null);
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
    // O14 R2 / O16 pkt 5: redigering skriver ingen periode — kontoret byttes ikke.
    annetKontorId: redigering ? null : annetKontorId,
    gjelderFra,
    tilOgMed,
    sisteDag,
    startTid: rettetStart,
    sluttTid: rettetSlutt,
    kategoriValg,
  });
  const { aktivtValg, resultat, regelStatus } = reise;
  const { kontorOppsett, kontorKall, kontorKonflikt, apenOverforing, bytte, gjeldende, dagensKontorId, valgtKontor } = reise;
  const erKontorValg = aktivtValg.type === "kontor";
  // O16 pkt 4: «Til annet oppmøtested» legges før dagens første arbeid (hjemreisen til fast: etter siste).
  const tidRetning: "tur" | "retur" = aktivtValg.type === "retur" || (erKontorValg && reise.kontorRetning === "retur") ? "retur" : "tur";
  // O16 pkt 1: perioden under feltet — den som gjelder, ellers arbeiderens åpne (som før).
  const periodeUnder: OverforingPeriode | null = (gjeldende as OverforingPeriode | null) ?? (apenOverforing as OverforingPeriode | null);
  const periodeTekst = (p: { fraDato: string; tilDato: string | null }) =>
    p.tilDato ? `${kortDato(p.fraDato)}–${kortDato(p.tilDato)}` : t("timer.reiseKort.periodeFra", { dato: kortDato(p.fraDato) });
  const kontorMedMerke = (id: string) => {
    const navn = reise.kontorNavn(id);
    if (id === dagensKontorId && gjeldende) return t("timer.reiseKort.kontorMidlertidig", { navn });
    if (id === kontorOppsett?.fastKontorId) return t("timer.reiseKort.kontorFast", { navn });
    return navn;
  };
  // R3 / R8 / ugyldig dato: teksten som sperrer «Lagre».
  const kontorSperreTekst =
    bytte.type === "admin"
      ? t("timer.reiseKort.sperre.adminAvsluttesIkke", { navn: reise.kontorNavn(bytte.periode.oppmotestedId ?? ""), periode: periodeTekst(bytte.periode) })
      : bytte.type === "start" && bytte.ugyldig
        ? t("timer.reiseKort.sperre.tilFoerFra")
        : bytte.type === "start" && bytte.konflikt
          ? t(erEgenOverforing(bytte.konflikt) ? "timer.reiseKort.sperre.overlapperEgen" : "timer.reiseKort.sperre.overlapperFirma", {
              navn: reise.kontorNavn(bytte.konflikt.oppmotestedId ?? ""),
              periode: periodeTekst(bytte.konflikt),
            })
          : null;
  const manglerKontor = erKontorValg && !redigering && !valgtKontor;
  // O14 pkt 2: i redigering er tiden arbeiderens (radens) — forslag og sperrer om kjøretid
  // gjelder ikke en reise som finnes.
  const tid = redigering ? tidFraStartSlutt(rettetStart, rettetSlutt) : resultat;
  const kategoriEndret = !!redigering && kategoriValg !== (redigering.erReise ? "reisetid" : "arbeidstid");

  // O19 pkt 23–24: en ny reise over midnatt deles ved 24:00. `dagensDel` er delen som står på
  // vinduets sedel — den overlapp, «havner i» og kontorsjekken (pkt 25) regnes på.
  const deling =
    !redigering && resultat.deles && tid.fraTid && tid.tilTid
      ? delVedMidnatt({ dato, vei: resultat.deles, fraTid: tid.fraTid, tilTid: tid.tilTid })
      : null;
  const dagensDel = deling ? (deling.vei === "fram" ? deling.del1 : deling.del2) : null;
  const dFra = dagensDel ? dagensDel.fraTid : tid.fraTid;
  const dTil = dagensDel ? dagensDel.tilTid : tid.tilTid;
  // O19 (B2): en delt rad som redigeres — midnattsgrensen står fast; den andre delen slås opp.
  const midnattDel = redigering ? lesMidnattDel(redigering.reiseRegel) : null;
  const { data: delPartner } = trpc.timer.dagsseddel.finnReiseDel.useQuery(
    { radId: redigering?.id ?? "" },
    { enabled: !!midnattDel && !!redigering },
  );
  const partnerLaast = !!delPartner && delPartner.status !== "draft" && delPartner.status !== "returned";

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
  // O19: «Rett også delen …» — den andre delen skrives først; vinduet lukkes av `oppdater`.
  const oppdaterDel = trpc.timer.dagsseddel.oppdaterTimerRad.useMutation({
    onError: (e: { message: string }) => setFeil(e.message),
  });
  // O19 pkt 23: begge delene av en reise over midnatt i én transaksjon.
  const tilfoyDelt = trpc.timer.dagsseddel.tilfoyDeltReise.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const lagrerNy = tilfoy.isPending || tilfoyDelt.isPending;

  const sperre = regelStatus === "klar" ? resultat.sperre : null;
  const lagretByggeplassId = bp.byggeplassId;

  // w15b: slutt før start, og overlapp med en annen rad på sedelen (samme delte regel som
  // timerad-vinduet; serveren avviser overlapp i `tilfoyTimerRad`).
  const fraMin = klokkeTilMin(tid.fraTid);
  const tilMin = klokkeTilMin(tid.tilTid);
  const sluttForStart = !deling && fraMin != null && tilMin != null && tilMin <= fraMin;
  // O19 pkt 25: «Til byggeplass» som overlapper en kontorreise — arbeideren er på kontoret.
  const paaKontor =
    !redigering &&
    !(regelStatus === "klar" && resultat.klassifisering?.kategori === "arbeidstid") &&
    aktivtValg.type === "tur" && !!bp.byggeplassId && !sluttForStart
      ? finnReiseSomEnderPaaKontor({ fraTid: dFra, tilTid: dTil }, dagsrader)
      : null;
  const overlapp = sluttForStart ? null : finnOverlappendeTidsrom(dFra, dTil, dagsrader);
  const tidSperre = sluttForStart
    ? t("timer.feil.sluttForStart")
    : paaKontor
      ? t("timer.reiseKort.sperre.paaKontor", {
          kontor: reise.kontorNavn(paaKontor.kontorId),
          tid: paaKontor.tilTid,
          byggeplass: (byggeplasser ?? []).find((b) => b.id === bp.byggeplassId)?.name ?? prosjektNavn(prosjektId),
        })
    : overlapp
      ? overlapp.projectId
        ? t("timer.feil.overlappKort", {
            fra: dFra,
            til: dTil,
            annenFra: overlapp.fraTid,
            annenTil: overlapp.tilTid,
            kort: prosjektNavn(overlapp.projectId),
          })
        : t("timer.feil.overlapp", {
            fra: dFra,
            til: dTil,
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
            // O18: en ny rad fra vinduet er alltid reise — under terskel viser linja hvor
            // «Før som reisetid likevel» legger den.
            retning: resultat.spor.reiseRetning ?? (tidRetning === "retur" ? "retur" : "ut"),
            fraTid: dFra ?? tid.fraTid,
            erReise: true,
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

  // O12 pkt 3: i prosjektkort-visning står reisen i kortet vinduet ble åpnet fra.
  // O18: en ny rad fra vinduet er alltid reise — kort-id-en settes bare i prosjektkort-visning.
  const reiseKortId = iKort ? (jobbKortId ?? null) : null;

  // O12 pkt 9: km-firmaets avhuking, forhåndsavhuket når firmaets tabell er over terskelen.
  const regel = reise.regel;
  const kl = resultat.klassifisering;
  const kmFirma = regel?.reiseTerskelEnhet === "km" && regel.reiseTerskelM != null;
  const tabellOverKm = kl?.forklaring.type === "over" && kl.forklaring.enhet === "km";
  const avhuket = kmAvhuket ?? tabellOverKm;
  const vinduMin = tid.fraTid && tid.tilTid ? Math.round(tid.timer * 60) : null;
  const terskelTekst = !regel
    ? ""
    : kmFirma
      ? manuellReiseTerskelTekst(t, { type: "over", enhet: "km", terskelM: regel.reiseTerskelM! })
      : manuellReiseTerskelTekst(t, { type: "over", enhet: "minutter", terskelMin: regel.reiseTerskelMin });
  // O18 (pkt 20, S3): firmaets regel sier arbeidstid → turen føres ikke som reise. Vinduet viser
  // teksten og knappen «Før som reisetid likevel» i stedet for «Lagre».
  const underTerskel = !redigering && regelStatus === "klar" && kl?.kategori === "arbeidstid";
  // O18 S4: minuttfirma — tiden i vinduet er over terskelen, men firmaets kjøretid under.
  const vinduOverTerskel =
    underTerskel &&
    !kmFirma &&
    regel != null &&
    regel.reiseTerskelEnhet === "minutter" &&
    vinduMin != null &&
    vinduMin >= regel.reiseTerskelMin;

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
    aktivtValg.type !== "retur"
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
  // O18: en ny rad fra vinduet er alltid reise.
  const reiseErReiseEtter = redigering ? kategoriValg === "reisetid" : true;
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
    !manglerKontor &&
    !overforingMut.isPending &&
    !!aktivitetId &&
    !!resultat.spor &&
    !!resultat.klassifisering?.lonnsartId &&
    !!tid.fraTid &&
    !!tid.tilTid &&
    // O19: en delt reise lagres alltid med spor.
    (!deling || !!resultat.spor.reiseKilde);
  // O18: «Før som reisetid likevel» — samme sperrer som «Lagre» i dag (pkt 13). Lønnsarten
  // regnes etter byttet til Reisetid.
  const kanForeLikevel =
    underTerskel &&
    !beskrivelseMangler &&
    sperre == null &&
    tidSperre == null &&
    tid.timer > 0 &&
    !kontorKonflikt &&
    !manglerKontor &&
    !overforingMut.isPending &&
    !!aktivitetId &&
    !!resultat.spor &&
    !!tid.fraTid &&
    !!tid.tilTid;
  // O18 S1: under terskel med den blå boksen lagrer «Lagre oppmøtested» bare stedsbyttet.
  const kanLagreOppmotested = underTerskel && !!kontorKall && !kontorKonflikt && !manglerKontor && !overforingMut.isPending;

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
          : manglerKontor
            ? t("timer.reiseKort.sperre.velgKontor")
          : kontorKonflikt && kontorSperreTekst
            ? kontorSperreTekst
            : !aktivitetId
            ? t("timer.feil.aktivitetPaakrevd")
            : beskrivelseMangler
            ? t("sperret.beskrivelse")
            : "";

  // O19: felt som gjelder hele reisen — endres de på en delt rad, spør «Lagre» om den andre delen.
  const beskrivelseEndret = !!redigering && (beskrivelse.trim() || null) !== (redigering.beskrivelse?.trim() || null);
  const ecoEndret = !!redigering && ecoId !== redigering.externalCostObjectId;
  const felles = () => ({
    externalCostObjectId: ecoId,
    ...(kategoriEndret && resultat.klassifisering?.lonnsartId ? { lonnsartId: resultat.klassifisering.lonnsartId } : {}),
    ...(beskrivelseEndret ? { beskrivelse: beskrivelse.trim() || null } : {}),
  });
  const sporRettDel = !!delPartner && !partnerLaast && (beskrivelseEndret || ecoEndret || kategoriEndret);

  /** O14 pkt 2 (R2): «Lagre» i redigering skriver raden — ingen ny rad, ingen overføring.
   *  O19: `rettDel` skriver de felles feltene på delen den andre dagen også (tidene står). */
  async function lagreRedigering(rettDel = false) {
    if (!redigering || !kanLagreRedigering || !tid.fraTid || !tid.tilTid) return;
    setFeil(null);
    const retning = aktivtValg.type === "retur" ? ("retur" as const) : ("ut" as const);
    try {
      if (rettDel && delPartner) await oppdaterDel.mutateAsync({ id: delPartner.id, ...felles() });
      oppdater.mutate({
        id: redigering.id,
        fraTid: tid.fraTid,
        tilTid: tid.tilTid,
        timer: tid.timer,
        pauseMin: 0,
        ...felles(),
        // O16 R5: en kontoroverføring beholder retning og spor — bare tiden (og «Føres som») skrives.
        ...(redigertRute ? {} : kategoriValg === "arbeidstid" ? { arbeidReiseRetning: retning } : { reiseRetning: retning }),
      });
    } catch {
      // Feilen er satt av mutasjonens onError.
    }
  }

  async function lagre() {
    if (!kanLagre || !aktivitetId || !resultat.spor || !resultat.klassifisering?.lonnsartId) return;
    // O18 (pkt 20): en ny rad fra vinduet er alltid reise — under terskel lagres ingenting her.
    if (!resultat.spor.erReise) return;
    setFeil(null);
    let s = resultat.spor;
    if (kontorKall) {
      // Perioden skrives FØR raden. Bare «Til annet oppmøtested» (O16 R6) bærer periodens id i
      // reiseRegel.overforing; for tur 1/2/4 gjør medOverforingPeriodeId ingenting.
      try {
        const r = await overforingMut.mutateAsync({
          id: crypto.randomUUID(),
          organizationId,
          ...kontorKall,
        });
        // Ny ved «opprettet», den egne ved «ingen»/«lukket».
        s = medOverforingPeriodeId(s, r.periode?.id ?? null);
      } catch (e) {
        // O16 R3: serverens avvisning av overlapp som lesbar tekst (reserve for klientens sjekk).
        const kode = (e as { data?: { code?: string } } | null)?.data?.code;
        setFeil(kode === "CONFLICT" ? t("timer.reiseKort.sperre.overlappServer") : e instanceof Error ? e.message : String(e));
        return;
      }
    }
    // O19 pkt 23–24: over midnatt → to rader, del 1 til 24:00 og del 2 fra 00:00.
    if (deling) {
      if (!s.reiseKilde || !s.reiseRegel) return;
      tilfoyDelt.mutate({
        sheetId,
        vei: deling.vei,
        del1: { fraTid: deling.del1.fraTid, tilTid: "24:00" },
        del2: { fraTid: "00:00", tilTid: deling.del2.tilTid },
        projectId: reiseProsjektId,
        byggeplassId: erKontorValg ? null : lagretByggeplassId,
        lonnsartId: resultat.klassifisering.lonnsartId,
        aktivitetId,
        beskrivelse: beskrivelse.trim() || null,
        externalCostObjectId: ecoId,
        reiseKilde: s.reiseKilde,
        reiseRetning: s.reiseRetning,
        reiseOppmotestedId: s.reiseOppmotestedId,
        reiseKjoretidMin: s.reiseKjoretidMin,
        reiseAvstandM: s.reiseAvstandM,
        reiseRegel: s.reiseRegel as unknown as Record<string, unknown>,
        ...(reiseKortId ? { kortId: reiseKortId } : {}),
        ...(iKort ? { reiseIKort: true } : {}),
      });
      return;
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
      // O16 R6: kontor → kontor har ingen byggeplass (som mobil).
      byggeplassId: erKontorValg ? null : lagretByggeplassId,
      ...(reiseKortId ? { kortId: reiseKortId } : {}),
      // O12 pkt 3: Reisetid lagres også i kortet vinduet ble åpnet fra.
      ...(iKort ? { reiseIKort: true } : {}),
      // Sporet når regelen gir det (reiseKilde null → serveren nuller sporet).
      ...(s.reiseKilde
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

  // O12 pkt 12: «Lagre» spør først om kortet; svaret lagrer.
  function trykkLagre() {
    if (!kanLagre) return;
    if (redigering) {
      if (sporRettDel) setDialog("rettDel");
      else void lagreRedigering();
      return;
    }
    if (kortSjekk) setDialog("kort");
    else void lagre();
  }
  function jaLagreIKortet() {
    setDialog(null);
    if (underTerskel) forSomReisetid();
    else void lagre();
  }
  function forSomReisetid() {
    setKategoriValg("reisetid");
    // Lagres når resultatet er regnet på nytt med «Reisetid» (neste render).
    setLagreSignal((n) => n + 1);
  }
  // O18 (pkt 20): «Før som reisetid likevel» — kortsjekken (pkt 12) gjelder som for «Lagre».
  function trykkForeLikevel() {
    if (!kanForeLikevel) return;
    if (kortSjekk) setDialog("kort");
    else forSomReisetid();
  }
  // O18 S1: bare stedsbyttet (perioden), ingen rad — tiden føres i jobbens Fra–til.
  async function lagreOppmotested() {
    if (!kanLagreOppmotested || !kontorKall) return;
    setFeil(null);
    try {
      await overforingMut.mutateAsync({ id: crypto.randomUUID(), organizationId, ...kontorKall });
      onLukk();
    } catch (e) {
      const kode = (e as { data?: { code?: string } } | null)?.data?.code;
      setFeil(kode === "CONFLICT" ? t("timer.reiseKort.sperre.overlappServer") : e instanceof Error ? e.message : String(e));
    }
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

  /** Avslutt uten reise. R7b (Kenneth «ja»): spør om «Siste dag», forslaget er dagen før sedeldatoen
   *  (slettes om den er før periodens start); arbeideren kan rette. */
  const [avsluttDag, setAvsluttDag] = useState<string | null>(null);
  // O17 pkt 22: kallet og «… fjernes» regnes fra samme plan (V2: nettopp perioden linja viser).
  const avsluttPlan = avsluttDag != null && periodeUnder ? reise.avsluttPlan(avsluttDag, periodeUnder.id) : null;
  function avsluttOverforing() {
    if (!avsluttPlan) return;
    setFeil(null);
    overforingMut.mutate(
      {
        id: crypto.randomUUID(),
        organizationId,
        ...avsluttPlan.kall,
      },
      {
        onSuccess: () => {
          setAnnetKontorId(null);
          setAvsluttDag(null);
          nullstillDatoer();
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
    // O16: kontoret og datoene hører til retningen.
    setAnnetKontorId(null);
    nullstillDatoer();
    nullstillTider();
  }
  function velgKontor(id: string | null) {
    setAnnetKontorId(id && id !== dagensKontorId ? id : null);
    nullstillDatoer();
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

  // ── O16: delene av «Fra → Til» ──────────────────────────────────────────────
  const prosjektFelt = (
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
        {!prosjekter.some((p) => p.id === prosjektId) && <option value={prosjektId}>{prosjektNavn(prosjektId)}</option>}
        {prosjekter.map((p) => (
          <option key={p.id} value={p.id}>
            {prosjektNavn(p.id)}
          </option>
        ))}
      </select>
    </div>
  );
  // w15b / O12 pkt 3: byggeplassen — kortets som tekst, i dagskort-visning prosjekt og byggeplass.
  const stedBlokk = iKort ? (
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
    <div className={`grid grid-cols-1 gap-3 ${kontorOppsett || redigertRute ? "" : "sm:grid-cols-2"}`}>
      {prosjektFelt}
      <RadByggeplassFelt
        kandidater={bp.kandidater}
        verdi={bp.byggeplassId}
        onEndre={(id) => {
          bp.setByggeplassId(id);
          nullstillTider();
        }}
      />
    </div>
  );
  // Perioden som gjelder, under feltet: egen med «Avslutt», firmaadmins uten (R8).
  const periodeLinje =
    !redigering && periodeUnder && periodeUnder.oppmotestedId ? (
      <p data-testid="reise-oppmote-periode" className="mt-1 text-xs text-gray-600">
        {t("timer.reiseKort.midlertidigPeriode", { periode: periodeTekst(periodeUnder) })}
        <span className="mx-1 text-gray-400">·</span>
        {erEgenOverforing(periodeUnder) ? (
          avsluttDag == null && (
            <button
              type="button"
              onClick={() => setAvsluttDag(avsluttSisteDagForslag(dato))}
              className="font-medium text-blue-700 hover:underline"
            >
              {t("timer.reiseKort.avslutt")}
            </button>
          )
        ) : (
          t("timer.reiseKort.sattAvFirmaet")
        )}
      </p>
    ) : null;
  // R7b: «Avslutt» spør om «Siste dag» før perioden lukkes.
  const avsluttSporsmal =
    periodeLinje && avsluttDag != null ? (
      <div data-testid="reise-avslutt" className="mt-2 flex flex-wrap items-end gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-blue-900" htmlFor="reise-avslutt-siste-dag">
            {t("timer.reiseKort.sisteDag")}
          </label>
          <input
            id="reise-avslutt-siste-dag"
            type="date"
            value={avsluttDag}
            onChange={(e) => setAvsluttDag(e.target.value || avsluttSisteDagForslag(dato))}
            className="rounded border border-blue-200 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <Button type="button" size="sm" onClick={avsluttOverforing} disabled={overforingMut.isPending}>
          {t("timer.reiseKort.avslutt")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setAvsluttDag(null)}>
          {t("handling.avbryt")}
        </Button>
        {/* O17 pkt 22: «Siste dag» før periodens start — perioden fjernes; sagt før arbeideren trykker. */}
        {avsluttPlan?.fjernes && (
          <p data-testid="reise-oppmote-fjernes" className="basis-full text-xs font-medium text-blue-900">
            {t("timer.reiseKort.periodeFjernes", {
              navn: reise.kontorNavn(avsluttPlan.fjernes.oppmotestedId ?? ""),
              periode: periodeTekst(avsluttPlan.fjernes),
            })}
          </p>
        )}
      </div>
    ) : null;
  // O16 pkt 1: oppmøtestedet som ett nedtrekk; redigering (pkt 5) viser det som tekst.
  const oppmoteFelt =
    redigering || !kontorOppsett ? (
      <p className="text-sm text-gray-800">{dagensKontorId ? kontorMedMerke(dagensKontorId) : "—"}</p>
    ) : (
      <div>
        <select
          id="reise-oppmotested"
          aria-label={t("timer.reiseKort.oppmotested")}
          value={valgtKontor ?? dagensKontorId ?? ""}
          onChange={(e) => velgKontor(e.target.value || null)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {dagensKontorId && <option value={dagensKontorId}>{kontorMedMerke(dagensKontorId)}</option>}
          {kontorOppsett.andre.map((id) => (
            <option key={id} value={id}>
              {kontorMedMerke(id)}
            </option>
          ))}
        </select>
        {periodeLinje}
        {avsluttSporsmal}
      </div>
    );
  const fraKontorTekst = (
    <div>
      <p data-testid="reise-fra-kontor" className="text-sm text-gray-800">
        {redigertRute ? reise.kontorNavn(redigertRute.fra) : dagensKontorId ? kontorMedMerke(dagensKontorId) : "—"}
      </p>
      {periodeLinje}
      {avsluttSporsmal}
    </div>
  );
  const tilKontorFelt = redigertRute ? (
    <p data-testid="reise-til-kontor-tekst" className="text-sm text-gray-800">
      {reise.kontorNavn(redigertRute.til)}
    </p>
  ) : (
    <select
      id="reise-til-kontor"
      aria-label={t("timer.reiseKort.tilKontorFelt")}
      value={valgtKontor ?? ""}
      onChange={(e) => velgKontor(e.target.value || null)}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
    >
      <option value="">{t("timer.reiseKort.velgKontor")}</option>
      {(kontorOppsett?.andre ?? []).map((id) => (
        <option key={id} value={id}>
          {kontorMedMerke(id)}
        </option>
      ))}
    </select>
  );
  const datoFelt = (id: string, label: string, verdi: string | null, endre: (v: string | null) => void, valgfritt = false) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-blue-900" htmlFor={id}>
        {label} {valgfritt && <span className="text-blue-700/70">({t("label.valgfritt")})</span>}
      </label>
      <input
        id={id}
        type="date"
        value={verdi ?? ""}
        onChange={(e) => endre(e.target.value || null)}
        className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-sm text-gray-900"
      />
    </div>
  );
  const oppmoteBoks =
    bytte.type === "start" ? (
      <div data-testid="reise-oppmote-boks" className="space-y-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        <p>{t("timer.reiseKort.blirMidlertidig", { navn: reise.kontorNavn(bytte.kontorId) })}</p>
        <div className="grid grid-cols-2 gap-3">
          {datoFelt("reise-gjelder-fra", t("timer.reiseKort.gjelderFra"), bytte.gjelderFra, setGjelderFra)}
          {datoFelt("reise-til-og-med", t("timer.reiseKort.tilOgMed"), bytte.tilOgMed, setTilOgMed, true)}
        </div>
        {bytte.forkortes && (
          <p data-testid="reise-oppmote-forkortes" className="text-xs">
            {t("timer.reiseKort.periodeForkortes", {
              navn: reise.kontorNavn(bytte.forkortes.periode.oppmotestedId ?? ""),
              periode: periodeTekst(bytte.forkortes.periode),
              til: kortDato(bytte.forkortes.til),
            })}
          </p>
        )}
        {bytte.fjernes && (
          <p data-testid="reise-oppmote-fjernes" className="text-xs font-medium">
            {t("timer.reiseKort.periodeFjernes", {
              navn: reise.kontorNavn(bytte.fjernes.oppmotestedId ?? ""),
              periode: periodeTekst(bytte.fjernes),
            })}
          </p>
        )}
      </div>
    ) : bytte.type === "slutt" ? (
      <div data-testid="reise-oppmote-boks" className="space-y-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        <p>{t("timer.reiseKort.avsluttesMidlertidig", { navn: reise.kontorNavn(bytte.periode.oppmotestedId ?? "") })}</p>
        <div className="grid grid-cols-2 gap-3">
          {datoFelt("reise-siste-dag", t("timer.reiseKort.sisteDag"), bytte.sisteDag, setSisteDag)}
        </div>
        {bytte.fjernes && (
          <p data-testid="reise-oppmote-fjernes" className="text-xs font-medium">
            {t("timer.reiseKort.periodeFjernes", {
              navn: reise.kontorNavn(bytte.fjernes.oppmotestedId ?? ""),
              periode: periodeTekst(bytte.fjernes),
            })}
          </p>
        )}
      </div>
    ) : null;

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
          {redigertRute ? (
            valgKnapp({ type: "kontor" }, t("timer.reiseKort.tilAnnetOppmotested"), "kontor")
          ) : (
            <>
              {valgKnapp({ type: "tur" }, t("timer.reiseKort.tur"), "tur")}
              {valgKnapp({ type: "retur" }, t("timer.reiseKort.retur"), "retur")}
              {/* O16 pkt 4: tredje retning, bare når firmaet har flere kontorer. */}
              {!redigering && kontorOppsett && kontorOppsett.andre.length > 0 &&
                valgKnapp({ type: "kontor" }, t("timer.reiseKort.tilAnnetOppmotested"), "kontor")}
            </>
          )}
        </div>

        {/* O16 pkt 1: «Fra → Til». Oppmøtestedet vises bare når firmaet har flere kontorer (§ 7 C). */}
        {kontorOppsett || redigertRute ? (
          <div data-testid="reise-fra-til" className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <div className="min-w-0">
              <p className="mb-1 text-sm font-medium text-gray-700">{t("timer.reiseKort.fra")}</p>
              {aktivtValg.type === "retur" ? stedBlokk : erKontorValg ? fraKontorTekst : oppmoteFelt}
            </div>
            <span aria-hidden className="hidden pt-7 text-gray-400 sm:block">
              →
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-sm font-medium text-gray-700">{t("timer.reiseKort.til")}</p>
              {aktivtValg.type === "retur" ? oppmoteFelt : erKontorValg ? tilKontorFelt : stedBlokk}
            </div>
          </div>
        ) : (
          stedBlokk
        )}
        {/* O16 pkt 4: «Til annet oppmøtested» i dagskort-visning — raden trenger et prosjekt. */}
        {erKontorValg && !iKort && !redigering && prosjektFelt}

        {/* O16 pkt 2: den blå boksen — hva kontorvalget gjør med oppmøtestedet, og fra hvilken dag. */}
        {!redigering && oppmoteBoks}

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
                {/* O19 (B2): del 2 av en delt reise starter ved midnatt — grensen står fast. */}
                {midnattDel?.del === 2 ? (
                  <p id="reise-start" data-testid="reise-midnatt-laast" className="px-3 py-2 text-sm text-gray-800">
                    00:00
                  </p>
                ) : (
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
                    if (tidRetning === "tur" || redigering) {
                      setRettetSlutt(rettetSlutt ?? tid.tilTid ?? null);
                      setAntallTekst(null);
                      return;
                    }
                    // «Fra byggeplass»: slutten følger starten — start + skrevet antall timer,
                    // ellers start + kjøretid, til den rettes igjen.
                    const antall = tolkAntall(antallTekst);
                    setRettetSlutt(start && antall != null ? flyttKlokke(start, Math.round(antall * 60)) : null);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reise-slutt">
                  {t("timer.reiseKort.sluttKl")}
                </label>
                {/* O19 (B2): del 1 slutter ved midnatt (24:00) — grensen står fast. Et tidsfelt kan
                    ikke vise 24:00, og en lagret retur som slutter 24:00 vises også som tekst. */}
                {midnattDel?.del === 1 || (redigering && redigering.tilTid === "24:00") ? (
                  <p id="reise-slutt" data-testid="reise-midnatt-laast" className="px-3 py-2 text-sm text-gray-800">
                    24:00
                  </p>
                ) : (
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
                )}
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
                        ? reiseTiderFraAntall(tidRetning, tid.fraTid, tid.tilTid, antall)
                        : null;
                    if (tider && antall != null) {
                      // O6: «Til byggeplass» flytter Start; «Fra byggeplass» flytter Slutt.
                      if (tidRetning === "tur") setRettetStart(tider.start);
                      setRettetSlutt(tider.slutt);
                      // Gate (136) vilkår 1: viser feltet det som faktisk lagres (`resultat.timer`).
                      // O19: klokka går rundt midnatt — 24 timer gir start = slutt (0 timer).
                      const startMin = klokkeTilMin(tider.start);
                      const sluttMin = klokkeTilMin(tider.slutt);
                      if (startMin != null && sluttMin != null && Math.abs((((sluttMin - startMin) % 1440) + 1440) % 1440 - antall * 60) > 0.5) {
                        setAntallTekst(null);
                      }
                    }
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

        {/* O19 pkt 23–24: reisen deles ved midnatt — hvilke tider som føres hvilken dag. «Til
            byggeplass» med rettet start kvelden før (pkt 24) spør i stedet «Startet du kvelden før?». */}
        {/* Står også under terskel: «Før som reisetid likevel» deler reisen på samme måte. */}
        {deling && (
          <p data-testid="reise-midnatt-boks" className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {t(
              deling.vei === "bak" && rettetStart != null ? "timer.reiseKort.startetKveldenFoer" : "timer.reiseKort.delesVedMidnatt",
              {
                fra: deling.del1.fraTid,
                dato1: kortDato(deling.del1.dato),
                til: deling.del2.tilTid,
                dato2: kortDato(deling.del2.dato),
              },
            )}
          </p>
        )}
        {/* O19: en delt rad — den andre delen er sendt eller attestert og rettes ikke herfra. */}
        {redigering && delPartner && partnerLaast && (
          <p data-testid="reise-del-laast" className="text-xs text-gray-600">
            {t("timer.reiseKort.delLaast", { dato: kortDato(delPartner.dato) })}
          </p>
        )}

        {/* O1 TILLEGG / O18 S5 A: «Føres som» står bare når pennen åpner en lagret arbeidstid-reise —
            byttet går først når arbeideren trykker. Ny reise og lagret Reisetid har ingen «Arbeidstid». */}
        {redigering && !redigering.erReise && !redigertRute && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">{t("timer.reiseKort.foresSom")}</p>
            <div className="flex flex-wrap gap-2">
              {(["reisetid", "arbeidstid"] as const).map((k) => {
                const aktiv = kategoriValg === k;
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
          </div>
        )}
        {/* O12 pkt 9: km-firma — arbeideren huker av om reisen var lengre enn terskelen. */}
        {!redigering && kmFirma && regelStatus === "klar" && resultat.klassifisering && (
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              data-testid="reise-mer-enn-km"
              checked={avhuket}
              onChange={(e) => settKmAvhuket(e.target.checked)}
            />
            {t("timer.reiseKort.merEnnKm", { terskel: terskelTekst })}
          </label>
        )}

        {/* O18 (pkt 20): under terskel føres turen i jobbens Fra–til. O19 (pkt 20): i en blå boks. S3: firma som fører også
            over terskel som arbeidstid, får teksten uten «Under terskel:». */}
        {underTerskel && (
          <p data-testid="reise-under-terskel" className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {t(kl?.forklaring.type === "over" ? "timer.reiseKort.arbeidstidInfo" : "timer.reiseKort.underTerskelInfo")}
          </p>
        )}
        {/* O18 S4: tiden i vinduet er over terskelen — gult hint ved knappen. */}
        {vinduOverTerskel && (
          <p
            data-testid="reise-under-terskel-over-vindu"
            className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {t("timer.reiseKort.underTerskelOverVindu", { terskel: terskelTekst })}
          </p>
        )}

        {/* Forslaget: firmaets kjøretid, deretter hvorfor arbeid/reise. */}
        {!redigering && regelStatus === "klar" && resultat.kjoretidMin != null && (
          <div>
            <p className="text-sm text-gray-700">{t("timer.reiseKort.forslag", { min: resultat.kjoretidMin })}</p>
            {/* O18: under terskel sier teksten over hvor tiden føres — ingen forklaring om arbeidstid-art. */}
            {!underTerskel && resultat.klassifisering && resultat.klassifisering.lonnsartId != null && (
              <p className="mt-1 text-xs text-gray-500">
                {manuellReiseForklaringTekst(t, resultat.klassifisering, reise.lonnsartNavn(resultat.klassifisering.lonnsartId))}
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
        {!redigering && !sperre && tidSperre && (
          <p data-testid={paaKontor ? "reise-paa-kontor" : undefined} className="text-xs font-medium text-red-700">
            {tidSperre}
            {/* O19 pkt 25: byggeplassen byttes i kortet, ikke her. */}
            {paaKontor && onAapneSted && (
              <>
                {" "}
                <button type="button" onClick={onAapneSted} className="underline hover:text-red-900">
                  {t("timer.jobbSkjema.aapneVindu")}
                </button>
              </>
            )}
          </p>
        )}
        {!redigering && !sperre && !tidSperre && (kontorSperreTekst || manglerKontor) && (
          <p data-testid="reise-oppmote-sperre" className="text-xs font-medium text-red-700">
            {kontorSperreTekst ?? t("timer.reiseKort.sperre.velgKontor")}
          </p>
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
          {underTerskel ? (
            <>
              {/* O18 S1: stedsbyttet alene, uten reiserad. */}
              {kontorKall && (
                <Button type="button" variant="secondary" onClick={() => void lagreOppmotested()} disabled={!kanLagreOppmotested}>
                  {t("timer.reiseKort.lagreOppmotested")}
                </Button>
              )}
              <KnappMedForklaring sperret={!kanForeLikevel && !lagrerNy} forklaring={forklaring}>
                <Button type="button" onClick={trykkForeLikevel} disabled={!kanForeLikevel || tilfoy.isPending}>
                  {lagrerNy || overforingMut.isPending ? t("handling.lagrer") : t("timer.reiseKort.forSomReisetidLikevel")}
                </Button>
              </KnappMedForklaring>
            </>
          ) : (
            <KnappMedForklaring sperret={!kanLagre && !lagrerNy && !oppdater.isPending} forklaring={forklaring}>
              <Button type="button" onClick={trykkLagre} disabled={!kanLagre || lagrerNy || oppdater.isPending}>
                {lagrerNy || overforingMut.isPending || oppdater.isPending ? t("handling.lagrer") : t("handling.lagre")}
              </Button>
            </KnappMedForklaring>
          )}
        </div>
      </div>
      {/* O19: delt rad — skal underprosjekt/beskrivelse/«Føres som» rettes på den andre delen også? */}
      {dialog === "rettDel" && delPartner && (
        <Modal open={true} onClose={() => setDialog(null)} title={t("timer.reiseKort.rettDel.tittel")}>
          <div className="space-y-4" data-testid="reise-rett-del">
            <p className="text-sm text-gray-800">{t("timer.reiseKort.rettDel.tekst", { dato: kortDato(delPartner.dato) })}</p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDialog(null);
                  void lagreRedigering(false);
                }}
              >
                {t("nei")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDialog(null);
                  void lagreRedigering(true);
                }}
              >
                {t("ja")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {/* O12 pkt 12: reisen føres i et annet kort enn dagens første (Til) / siste (Fra). */}
      {dialog === "kort" && kortSjekk && (
        <Modal open={true} onClose={() => setDialog(null)} title={t("timer.reiseKort.kortSjekk.tittel")}>
          <div className="space-y-4" data-testid="reise-kort-sjekk">
            <p className="text-sm text-gray-800">
              {t(aktivtValg.type !== "retur" ? "timer.reiseKort.kortSjekk.tekstTur" : "timer.reiseKort.kortSjekk.tekstRetur", {
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
    </Modal>
  );
}
