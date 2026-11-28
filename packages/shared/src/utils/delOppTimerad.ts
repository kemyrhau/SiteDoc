/**
 * Runde 8 timer — arbeideren deler opp en timerad (Kenneth 2026-11-27: «del opp en timerad,
 * må ha mulighet å tillegne underprosjekt på hver av valgene -> vi må samtidig dele opp
 * tilhørende maskin, varer, tillegg/utlegg. reise må tilordnes rett prosjekt/underprosjekt»).
 * Kenneth 2026-11-28 «Ja, begge»:
 *  (a) maskintimer og vareantall fordeles forholdsmessig etter delenes timer — et forslag
 *      arbeideren kan justere. Tillegg og utlegg flyttes hele, forslaget er delen med flest timer.
 *  (b) reise ut følger delen som starter først, reise hjem delen som slutter sist.
 *
 * ÉN regel for server (`splittRadEier`), web og mobil (vinduet «Del opp», «Følger med»).
 *
 * Maskin og vare følger bare deler i timeradens eget prosjekt: en koblet maskin følger raden
 * bare innen samme prosjekt (K6), og en koblet vare kan ikke bytte prosjekt (w15f). Deler i et
 * annet prosjekt får 0 i forslaget, og et tall over 0 der avvises. Tillegg, utlegg og reise kan
 * gå til alle deler (de følger timeradens prosjekt, runde 6 svar 1).
 */

export type DelOppDel = {
  projectId: string | null;
  fraTid?: string | null;
  tilTid?: string | null;
  timer: number;
};

export type DelOppKoblet = {
  maskiner: readonly { id: string; timer: number }[];
  varer: readonly { id: string; antall: number }[];
  tillegg: readonly { id: string }[];
  utlegg: readonly { id: string }[];
  /** Reisene i timeradens kort. `retning`: `"ut"` | `"retur"`; alt annet er «uten retning». */
  reiser: readonly { id: string; retning: string | null; fraTid: string | null }[];
};

/** Pr. koblet rad: tall pr. del (maskin, vare) eller delens indeks (tillegg, utlegg, reise). */
export type DelOppFordeling = {
  maskiner: { id: string; timer: number[] }[];
  varer: { id: string; antall: number[] }[];
  tillegg: { id: string; del: number }[];
  utlegg: { id: string; del: number }[];
  reiser: { id: string; del: number }[];
};

export type DelOppFeil =
  | { type: "maskinSum"; id: string; sum: number; skal: number }
  | { type: "vareSum"; id: string; sum: number; skal: number }
  | { type: "maskinAnnetProsjekt"; id: string; del: number }
  | { type: "vareAnnetProsjekt"; id: string; del: number }
  | { type: "negativ"; id: string; del: number }
  | { type: "ukjentDel"; id: string; del: number }
  | { type: "mangler"; id: string }
  | { type: "ukjentRad"; id: string };

const rund = (n: number): number => Math.round(n * 100) / 100;

/** Delene maskin og vare kan gå til: samme prosjekt som timeraden. */
function delerISammeProsjekt(deler: readonly DelOppDel[], projectId: string | null): number[] {
  return deler.map((d, i) => (d.projectId === projectId ? i : -1)).filter((i) => i >= 0);
}

/**
 * Forholdsmessig etter delenes timer, avrundet til hundredeler. Siste del med timer tar resten,
 * så summen alltid stemmer. Ingen del i samme prosjekt → alt på første del (avvises av vakten).
 */
function forholdsmessig(total: number, deler: readonly DelOppDel[], tillatte: number[]): number[] {
  const ut = deler.map(() => 0);
  const medTimer = tillatte.filter((i) => deler[i]!.timer > 0);
  if (medTimer.length === 0) {
    ut[tillatte[0] ?? 0] = rund(total);
    return ut;
  }
  const sumTimer = medTimer.reduce((s, i) => s + deler[i]!.timer, 0);
  let fordelt = 0;
  medTimer.forEach((i, n) => {
    if (n === medTimer.length - 1) {
      ut[i] = rund(total - fordelt);
    } else {
      ut[i] = rund((total * deler[i]!.timer) / sumTimer);
      fordelt += ut[i]!;
    }
  });
  return ut;
}

/** Delen med flest timer; første ved likhet. */
function delenMedFlestTimer(deler: readonly DelOppDel[]): number {
  let best = 0;
  deler.forEach((d, i) => {
    if (d.timer > deler[best]!.timer) best = i;
  });
  return best;
}

/** Første del i tid (tidligste fra-tid); uten klokkeslett → første del. */
function forsteDel(deler: readonly DelOppDel[]): number {
  let best = -1;
  deler.forEach((d, i) => {
    if (!d.fraTid) return;
    if (best < 0 || d.fraTid < deler[best]!.fraTid!) best = i;
  });
  return best < 0 ? 0 : best;
}

/** Siste del i tid (seneste til-tid); uten klokkeslett → siste del. */
function sisteDel(deler: readonly DelOppDel[]): number {
  let best = -1;
  deler.forEach((d, i) => {
    if (!d.tilTid) return;
    if (best < 0 || d.tilTid >= deler[best]!.tilTid!) best = i;
  });
  return best < 0 ? deler.length - 1 : best;
}

/**
 * (b) Reise ut → første del, reise hjem → siste del. Uten retning: starter reisen før første
 * del, er den en utreise; ellers en hjemreise (samme lesning som `velgReiseKort`).
 */
function delForReise(deler: readonly DelOppDel[], reise: { retning: string | null; fraTid: string | null }): number {
  if (reise.retning === "ut") return forsteDel(deler);
  if (reise.retning === "retur") return sisteDel(deler);
  const forste = deler[forsteDel(deler)]!;
  if (!reise.fraTid || !forste.fraTid || reise.fraTid <= forste.fraTid) return forsteDel(deler);
  return sisteDel(deler);
}

/** Forslaget vinduet viser ferdig utfylt, og serveren bruker når klienten ikke sender noe for en rad. */
export function foreslaDelOppFordeling(
  deler: readonly DelOppDel[],
  koblet: DelOppKoblet,
  timeradProjectId: string | null,
): DelOppFordeling {
  const tillatte = delerISammeProsjekt(deler, timeradProjectId);
  const flest = delenMedFlestTimer(deler);
  return {
    maskiner: koblet.maskiner.map((m) => ({ id: m.id, timer: forholdsmessig(m.timer, deler, tillatte) })),
    varer: koblet.varer.map((v) => ({ id: v.id, antall: forholdsmessig(v.antall, deler, tillatte) })),
    tillegg: koblet.tillegg.map((t) => ({ id: t.id, del: flest })),
    utlegg: koblet.utlegg.map((u) => ({ id: u.id, del: flest })),
    reiser: koblet.reiser.map((r) => ({ id: r.id, del: delForReise(deler, r) })),
  };
}

/**
 * Fyller inn forslaget for rader klienten ikke sendte (eldre klient, eller rad lagt til etter
 * at vinduet ble åpnet), og lar sendte verdier stå. Ukjente rader i det sendte stoppes av vakten.
 */
export function fullforDelOppFordeling(
  deler: readonly DelOppDel[],
  koblet: DelOppKoblet,
  timeradProjectId: string | null,
  sendt: Partial<DelOppFordeling> | undefined,
): DelOppFordeling {
  const forslag = foreslaDelOppFordeling(deler, koblet, timeradProjectId);
  const flett = <T extends { id: string }>(f: T[], s: T[] | undefined): T[] => {
    const pr = new Map((s ?? []).map((r) => [r.id, r] as const));
    const kjente = new Set(f.map((r) => r.id));
    return [...f.map((r) => pr.get(r.id) ?? r), ...(s ?? []).filter((r) => !kjente.has(r.id))];
  };
  return {
    maskiner: flett(forslag.maskiner, sendt?.maskiner),
    varer: flett(forslag.varer, sendt?.varer),
    tillegg: flett(forslag.tillegg, sendt?.tillegg),
    utlegg: flett(forslag.utlegg, sendt?.utlegg),
    reiser: flett(forslag.reiser, sendt?.reiser),
  };
}

/** Summvakten: hver maskin og vare fordelt fullt, bare i tillatte deler; hver rad til én gyldig del. */
export function validerDelOppFordeling(
  deler: readonly DelOppDel[],
  koblet: DelOppKoblet,
  timeradProjectId: string | null,
  fordeling: DelOppFordeling,
): DelOppFeil[] {
  const feil: DelOppFeil[] = [];
  const tillatte = new Set(delerISammeProsjekt(deler, timeradProjectId));
  const mengde = (
    kilde: readonly { id: string; verdi: number }[],
    gitt: { id: string; tall: number[] }[],
    sumType: "maskinSum" | "vareSum",
    prosjektType: "maskinAnnetProsjekt" | "vareAnnetProsjekt",
  ) => {
    const pr = new Map(gitt.map((g) => [g.id, g.tall] as const));
    for (const k of kilde) {
      const tall = pr.get(k.id);
      if (!tall) {
        feil.push({ type: "mangler", id: k.id });
        continue;
      }
      if (tall.length !== deler.length) {
        feil.push({ type: "ukjentDel", id: k.id, del: tall.length });
        continue;
      }
      tall.forEach((t, i) => {
        if (t < 0) feil.push({ type: "negativ", id: k.id, del: i });
        else if (t > 0 && !tillatte.has(i)) feil.push({ type: prosjektType, id: k.id, del: i });
      });
      const sum = rund(tall.reduce((s, t) => s + t, 0));
      if (Math.abs(sum - k.verdi) >= 0.005) feil.push({ type: sumType, id: k.id, sum, skal: rund(k.verdi) });
    }
    const kjente = new Set(kilde.map((k) => k.id));
    for (const g of gitt) if (!kjente.has(g.id)) feil.push({ type: "ukjentRad", id: g.id });
  };
  mengde(
    koblet.maskiner.map((m) => ({ id: m.id, verdi: m.timer })),
    fordeling.maskiner.map((m) => ({ id: m.id, tall: m.timer })),
    "maskinSum",
    "maskinAnnetProsjekt",
  );
  mengde(
    koblet.varer.map((v) => ({ id: v.id, verdi: v.antall })),
    fordeling.varer.map((v) => ({ id: v.id, tall: v.antall })),
    "vareSum",
    "vareAnnetProsjekt",
  );
  const valg = (kilde: readonly { id: string }[], gitt: { id: string; del: number }[]) => {
    const pr = new Map(gitt.map((g) => [g.id, g.del] as const));
    for (const k of kilde) {
      const d = pr.get(k.id);
      if (d === undefined) feil.push({ type: "mangler", id: k.id });
      else if (!Number.isInteger(d) || d < 0 || d >= deler.length) feil.push({ type: "ukjentDel", id: k.id, del: d });
    }
    const kjente = new Set(kilde.map((k) => k.id));
    for (const g of gitt) if (!kjente.has(g.id)) feil.push({ type: "ukjentRad", id: g.id });
  };
  valg(koblet.tillegg, fordeling.tillegg);
  valg(koblet.utlegg, fordeling.utlegg);
  valg(koblet.reiser, fordeling.reiser);
  return feil;
}

/**
 * Det vinduet «Del opp» viser og sender (web og mobil): arbeiderens valg der de passer antallet
 * deler, ellers forslaget. Et tall-valg med feil antall deler (en del lagt til eller fjernet)
 * faller bort, og det samme gjør et del-valg som peker på en del som ikke finnes lenger.
 */
export function beregnDelOppFordeling(
  deler: readonly DelOppDel[],
  koblet: DelOppKoblet,
  timeradProjectId: string | null,
  valg: Partial<DelOppFordeling>,
): { fordeling: DelOppFordeling; feil: DelOppFeil[] } {
  const passer: Partial<DelOppFordeling> = {
    maskiner: valg.maskiner?.filter((m) => m.timer.length === deler.length),
    varer: valg.varer?.filter((v) => v.antall.length === deler.length),
    tillegg: valg.tillegg?.filter((v) => v.del < deler.length),
    utlegg: valg.utlegg?.filter((v) => v.del < deler.length),
    reiser: valg.reiser?.filter((v) => v.del < deler.length),
  };
  const fordeling = fullforDelOppFordeling(deler, koblet, timeradProjectId, passer);
  return { fordeling, feil: validerDelOppFordeling(deler, koblet, timeradProjectId, fordeling) };
}
