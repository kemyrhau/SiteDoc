/**
 * Prosjektkort L1: sedelen rendres i begge moduser med samme data. Dagskort
 * skal ikke vise noe av prosjektkort-flaten (og omvendt), og modusen leses fra
 * hentArbeidstidDefaults.timerRegistreringsmodus.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useParams: () => ({ id: "s1" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashbord/timer/s1",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));

// w2: dagssiden leser prosjektet fra toppen (useProsjekt) for «+ Registrer timer».
vi.mock("@/kontekst/prosjekt-kontekst", () => ({
  useProsjekt: () => ({ prosjektId: null }),
}));

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        if (navn === "useQuery") {
          const key = sti.join(".");
          return (_i: unknown, opt?: { enabled?: boolean }) => ({
            data: opt?.enabled === false ? undefined : h.data[key],
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import Side from "./page";
import { DAG7_SEDEL, DAG7_VARER, dag7Data } from "./testdata-dag7";
import { fjernRunde3 } from "./fjern-runde3";

const sheet = {
  id: "s1",
  organizationId: "o1",
  dato: "2026-11-05T00:00:00.000Z",
  status: "draft",
  startAt: "2026-11-05T06:00:00.000Z",
  endAt: "2026-11-05T14:30:00.000Z",
  pauseMin: 30,
  beskrivelse: null,
  aktivitetId: "a1",
  aktivitet: { id: "a1", navn: "Arbeid" },
  attestertVed: null,
  lederKommentar: null,
  manglerMaskinforerbevis: false,
  byggeplassId: null,
  tillegg: [],
  maskiner: [],
  utlegg: [],
  timer: [
    {
      id: "r1",
      projectId: "p1",
      lonnsartId: "l1",
      aktivitetId: "a1",
      externalCostObjectId: null,
      vehicleId: null,
      byggeplassId: null,
      fraTid: "07:00",
      tilTid: "11:00",
      timer: "4",
      pauseMin: 0,
      beskrivelse: null,
      attestertStatus: "pending",
      erReise: false,
      kortId: "k1",
    },
    {
      id: "r2",
      projectId: "p2",
      lonnsartId: "l1",
      aktivitetId: "a1",
      externalCostObjectId: null,
      vehicleId: null,
      byggeplassId: null,
      fraTid: "11:00",
      tilTid: "15:30",
      timer: "4",
      pauseMin: 30,
      beskrivelse: null,
      attestertStatus: "pending",
      erReise: false,
      kortId: "k2",
    },
  ],
};

function rendre(
  modus: string | undefined,
  overstyr: Partial<typeof sheet> = {},
  ekstra: Record<string, unknown> = {},
) {
  h.data = {
    "timer.dagsseddel.hentMedId": { ...sheet, ...overstyr },
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Barnehage", internalProjectNumber: "2050" },
      { id: "p3", name: "Ledig", internalProjectNumber: "2060" },
    ],
    "organisasjon.hentArbeidstidDefaults":
      modus === undefined ? {} : { timerRegistreringsmodus: modus },
    "vareforbruk.hentMineForDato": [],
    ...ekstra,
  };
  return renderToStaticMarkup(<Side />);
}

describe("timer-sedel — visningsmodus", () => {
  beforeEach(() => {
    h.data = {};
  });

  it("dagskort (default/ukjent) viser dagskortets flate og ingen prosjektkort-elementer", () => {
    for (const modus of [undefined, "dagskort", "tull"]) {
      const html = rendre(modus);
      expect(html).toContain("timer.leggTilProsjekt");
      expect(html).toContain("timer.summering");
      expect(html).toContain("timer.detalj.sendTilLeder");
      expect(html).not.toContain("timer.prosjektkort.");
    }
  });

  it("dagskort-markup er lik uansett om modus mangler eller er dagskort", () => {
    expect(rendre("dagskort")).toBe(rendre(undefined));
  });

  it("prosjektkort viser samleside med kort, ramme og send dagen", () => {
    const html = rendre("prosjektkort");
    expect(html).toContain("timer.prosjektkort.overskrift{&quot;antall&quot;:2}");
    expect(html).toContain("2041 — Skole");
    expect(html).toContain("2050 — Barnehage");
    expect(html).toContain("timer.prosjektkort.ramme");
    expect(html).toContain("timer.prosjektkort.pauseBaeres{&quot;kort&quot;:&quot;2050 — Barnehage&quot;}");
    expect(html).toContain("timer.prosjektkort.sendDagen{&quot;timer&quot;:&quot;8,0&quot;}");
    // w2: knappen nederst er «+ Registrer timer» (neste jobb, samme eller annet prosjekt).
    expect(html).toContain("timer.prosjektkort.registrerTimer");
    expect(html).toContain("timer.prosjektkort.registrerTimerHint");
    expect(html).not.toContain("timer.prosjektkort.nyttKort");
    expect(html).not.toContain("timer.summering");
    expect(html).not.toContain("timer.leggTilProsjekt");
    expect(html).not.toContain("timer.detalj.sendTilLeder");
  });

  it("w3a: jobb 2 på samme prosjekt (egen kortId) er eget kort på PC", () => {
    const [r1, r2] = sheet.timer;
    const html = rendre("prosjektkort", {
      timer: [r1!, { ...r2!, projectId: "p1" }],
    });
    expect(html).toContain("timer.prosjektkort.overskrift{&quot;antall&quot;:2}");
    expect(html.split(">2041 — Skole</span>").length - 1).toBe(2);
    expect(html).not.toContain("2050 — Barnehage");
    // Knappen for neste jobb vises selv om alle prosjektene med timer har kort.
    expect(html).toContain("timer.prosjektkort.registrerTimer");
  });

  it("dagskortets Detaljer-seksjon er skjult i prosjektkort-modus", () => {
    expect(rendre("dagskort")).toContain("timer.detalj.detaljer");
    expect(rendre("prosjektkort")).not.toContain("timer.detalj.detaljer");
  });

  it("reise vises i bunnlinja bare når den er > 0", () => {
    expect(rendre("prosjektkort")).not.toContain("timer.prosjektkort.sumReise");
    const medReise = rendre("prosjektkort", {
      timer: [sheet.timer[0]!, { ...sheet.timer[1]!, erReise: true }],
    });
    expect(medReise).toContain("timer.prosjektkort.sumReise{&quot;timer&quot;:&quot;4,0&quot;}");
  });

  it("returnert sedel: knappen sier «Send på nytt» som i dagskortet", () => {
    const html = rendre("prosjektkort", { status: "returned" });
    expect(html).toContain("timer.detalj.sendPaaNytt");
    expect(html).not.toContain("timer.prosjektkort.sendDagen");
  });
});

describe("timer-sedel — L3 «+ Vareforbruk» på kortet", () => {
  const ettKort = { timer: [sheet.timer[0]!] };
  const katalog = (prosjekter: string[]) => ({
    "vareforbruk.katalogForFirma": {
      varer: [{ id: "v1", navn: "Grus", enhet: "m3", varenummer: null }],
      prosjektIderMedVarelager: prosjekter,
    },
  });

  it("vises i åpent kort når Varelager er på for prosjektet", () => {
    expect(rendre("prosjektkort", ettKort, katalog(["p1"]))).toContain(
      "timer.prosjektkort.nyVareKort",
    );
  });

  it("skjult når Varelager er av for prosjektet eller katalogen feiler", () => {
    expect(rendre("prosjektkort", ettKort, katalog(["p2"]))).not.toContain(
      "timer.prosjektkort.nyVareKort",
    );
    // Ingen katalog (FORBIDDEN/av for firmaet) → kortet er som i L2.
    expect(rendre("prosjektkort", ettKort)).not.toContain("timer.prosjektkort.nyVareKort");
  });

  it("skjult på sendt sedel", () => {
    expect(
      rendre("prosjektkort", { ...ettKort, status: "submitted" }, katalog(["p1"])),
    ).not.toContain("timer.prosjektkort.nyVareKort");
  });

  // w3a (snudd fra L3): varelinja i jobben har blyant og søppelkasse; attestert vare er låst.
  const vareLinje = (html: string) =>
    html.match(/<li[^>]*>(?:(?!<\/li>).)*?timer\.prosjektkort\.vareMerke.*?<\/li>/)?.[0] ?? "";
  it("varelinjer i jobben har rediger/slett, attestert vare har ingen", () => {
    const vare = { id: "f1", projectId: "p1", byggeplassId: null, dagsseddelId: "s1", kortId: "k1", antall: 2, vare: { id: "v1", navn: "Grus", enhet: "m3" } };
    const aapen = rendre("prosjektkort", ettKort, {
      ...katalog(["p1"]),
      "vareforbruk.hentMineForDato": [{ ...vare, attestert: false }],
    });
    expect(vareLinje(aapen)).toContain("Grus");
    expect(vareLinje(aapen)).toContain('title="handling.rediger"');
    expect(vareLinje(aapen)).toContain('title="handling.slett"');
    const laast = rendre("prosjektkort", ettKort, {
      ...katalog(["p1"]),
      "vareforbruk.hentMineForDato": [{ ...vare, attestert: true }],
    });
    expect(vareLinje(laast)).toContain("Grus");
    expect(vareLinje(laast)).not.toContain("<button");
  });

  // Runde 3 timer (2026-11-27): dagskortet får «+ Vare» når katalogen finnes. Utenom
  // runde 3-elementene (`data-runde3`, variant A) er dagskortet fortsatt uendret.
  it("dagskort er uendret når katalogen finnes, utenom runde 3-elementene", () => {
    const med = rendre("dagskort", {}, katalog(["p1", "p2"]));
    expect(med).toContain("timer.detalj.tilfoyVare");
    expect(fjernRunde3(med)).toBe(fjernRunde3(rendre("dagskort")));
  });
});

describe("dagskort — banneret holder reise utenfor dekningen (post (7) punkt 6)", () => {
  const ren = (html: string) => html.replace(/&quot;/g, '"');
  const medReise = () =>
    rendre("dagskort", {
      timer: [sheet.timer[0]!, { ...sheet.timer[1]!, timer: "2", erReise: true }],
    });

  it("dag med reise: dekning = arbeid uten reise, reise vises separat", () => {
    const html = ren(medReise());
    expect(html).toContain('timer.summering{"registrert":"4,0"');
    expect(html).toContain('timer.summeringReise{"reise":"2,0"}');
  });

  it("dag uten reise: ingen reise-del i banneret", () => {
    const html = ren(rendre("dagskort"));
    expect(html).toContain('timer.summering{"registrert":"8,0"');
    expect(html).not.toContain("timer.summeringReise");
  });

  it("dagskortet får IKKE «+ Reise» (isolasjonen løftes kun for banneret)", () => {
    expect(medReise()).not.toContain("timer.prosjektkort.nyReise");
  });
});

describe("w3a — ett kort pr. jobb (dagen fra #7)", () => {
  const dag7 = (sedel: Record<string, unknown> = {}) => {
    h.data = { ...dag7Data("prosjektkort"), "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, ...sedel } };
    return renderToStaticMarkup(<Side />);
  };
  const kunJobb2 = {
    timer: [DAG7_SEDEL.timer[1]!],
    maskiner: [DAG7_SEDEL.maskiner[0]!],
    tillegg: [],
    utlegg: [],
  };

  it("to jobber på samme prosjekt = to kort, og eldre rader i samlekortet sist", () => {
    const html = dag7();
    expect(html).toContain("timer.prosjektkort.overskrift{&quot;antall&quot;:2}");
    expect(html.split(">2041 — Skole</span>").length - 1).toBe(2);
    // Hodet summerer bare jobben: 7,5 t i jobb 1, 1,0 t arbeid + 1,0 t maskin i jobb 2.
    expect(html).toContain("7,5 timer.timerEnhet");
    expect(html).toContain("TILL-001 Tillegg 1");
    const samlekort = html.indexOf("timer.prosjektkort.utenJobb");
    expect(samlekort).toBeGreaterThan(html.lastIndexOf(">2041 — Skole</span>"));
  });

  it("maskinen står i TILL-001-kortet under timelinja den er koblet til, med varen", () => {
    const html = dag7(kunJobb2);
    expect(html).toContain("timer.prosjektkort.overskrift{&quot;antall&quot;:1}");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("timer.gruppe.tilByggherre");
    const timelinje = html.indexOf("15:00–16:00");
    const maskin = html.indexOf("timer.maskinSeksjon.merke");
    const vare = html.indexOf("timer.prosjektkort.vareMerke");
    expect(timelinje).toBeGreaterThan(-1);
    expect(maskin).toBeGreaterThan(timelinje);
    expect(vare).toBeGreaterThan(maskin);
    expect(html).toContain("Volvo EC140");
    expect(html).toContain("Pukk 6-32");
    expect(DAG7_VARER[0]!.kortId).toBe("k2");
  });

  it("ingen bøtteboks, «Arbeidstimer (N t)» eller «Maskin X t» i kortmodus", () => {
    for (const html of [dag7(), dag7(kunJobb2)]) {
      expect(html).not.toContain("timer.gruppe.arbeidstimer");
      expect(html).not.toContain("timer.gruppe.maskin{");
      expect(html).not.toContain("timer.detalj.tilfoyTimer");
    }
  });

  it("L3a: lenkene står i skjemaets rader — + Maskin (4), + Vare (5), Legg til (7), så + Timer under skjemaet", () => {
    const html = dag7(kunJobb2);
    const plass = ["nyMaskin", "nyVareKort", "leggTil", "nyTimer"].map((k) =>
      html.indexOf(`timer.prosjektkort.${k}<`),
    );
    expect(plass.every((p) => p > -1)).toBe(true);
    expect([...plass].sort((a, b) => a - b)).toEqual(plass);
  });
});

describe("O19b — «Dagens ramme» slutter 24:00 på del 1 av en delt reise", () => {
  const [r1, r2] = sheet.timer;
  const reise = (tilTid: string, reiseRegel: unknown) => ({
    ...r2!,
    id: "r3",
    fraTid: "21:00",
    tilTid,
    timer: "3",
    pauseMin: 0,
    erReise: true,
    kortId: "k1",
    reiseRegel,
  });
  const ramme = (html: string) => html.match(/timer\.prosjektkort\.ramme\{[^}]*\}/)?.[0] ?? "";

  it("del 1 som slutter 24:00 → rammen viser 24:00, ikke 23:59", () => {
    const html = rendre("prosjektkort", {
      timer: [r1!, r2!, reise("24:00", { midnatt: { delId: "d1", del: 1 } })] as typeof sheet.timer,
    });
    expect(ramme(html)).toContain("&quot;til&quot;:&quot;24:00&quot;");
    expect(ramme(html)).not.toContain("23:59");
  });

  it("negativkontroll: dag uten delt reise viser seneste til-tid som før", () => {
    expect(ramme(rendre("prosjektkort"))).toContain("&quot;til&quot;:&quot;15:30&quot;");
    const html = rendre("prosjektkort", {
      timer: [r1!, r2!, reise("23:59", null)] as typeof sheet.timer,
    });
    expect(ramme(html)).toContain("&quot;til&quot;:&quot;23:59&quot;");
  });

  it("negativkontroll: del 2 (00:00–) på dagen etter endrer ikke rammens slutt", () => {
    const del2 = { ...reise("02:00", { midnatt: { delId: "d1", del: 2 } }), fraTid: "00:00" };
    const html = rendre("prosjektkort", { timer: [r1!, r2!, del2] as typeof sheet.timer });
    expect(ramme(html)).toContain("&quot;til&quot;:&quot;15:30&quot;");
  });
});

describe("O19b F4 — ingen del av en delt reise strekker «Arbeidstid i dag»", () => {
  const [r1, r2] = sheet.timer;
  const reise = (fraTid: string, tilTid: string, reiseRegel: unknown) => ({
    ...r2!,
    id: "r3",
    fraTid,
    tilTid,
    timer: "2",
    pauseMin: 0,
    erReise: true,
    kortId: "k1",
    reiseRegel,
  });
  const del1 = reise("21:00", "24:00", { midnatt: { delId: "d1", del: 1 } });
  const del2 = reise("00:00", "02:00", { midnatt: { delId: "d1", del: 2 } });
  // «Arbeidstid i dag» (dagskort): Start, Slutt, Pause i rekkefølge etter overskriften.
  const arbeidstid = (html: string) => {
    const blokk = html.slice(html.indexOf("timer.arbeidstidIDag"));
    const dd = [...blokk.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map((m) => m[1]);
    return { start: dd[0], slutt: dd[1], pause: dd[2] };
  };
  const ramme = (html: string) => html.match(/timer\.prosjektkort\.ramme\{[^}]*\}/)?.[0] ?? "";

  it("dagskort: del 1 (21:00–24:00) strekker ikke slutt", () => {
    const html = rendre("dagskort", { timer: [r1!, r2!, del1] as typeof sheet.timer });
    expect(arbeidstid(html)).toEqual({ start: "07:00", slutt: "15:30", pause: "30 min" });
  });

  it("dagskort: del 2 (00:00–02:00) strekker ikke start", () => {
    const html = rendre("dagskort", { timer: [r1!, r2!, del2] as typeof sheet.timer });
    expect(arbeidstid(html)).toEqual({ start: "07:00", slutt: "15:30", pause: "30 min" });
  });

  it("prosjektkort: del 2 strekker rammens start som før (valg a); del 1 gir fortsatt 24:00 (O19b)", () => {
    expect(ramme(rendre("prosjektkort", { timer: [r1!, r2!, del2] as typeof sheet.timer })))
      .toContain("&quot;fra&quot;:&quot;00:00&quot;");
    const r = ramme(rendre("prosjektkort", { timer: [r1!, r2!, del1] as typeof sheet.timer }));
    expect(r).toContain("&quot;fra&quot;:&quot;07:00&quot;");
    expect(r).toContain("&quot;til&quot;:&quot;24:00&quot;");
  });

  // B75 (Kenneth 8A): en dag som bare har deler av reise over midnatt, viser «—», ikke prefyllet tid.
  it("B75: dag med bare deler — «—» i Start, Slutt og Pause, ikke sedelens prefylte ramme", () => {
    for (const del of [del1, del2]) {
      expect(arbeidstid(rendre("dagskort", { timer: [del] as typeof sheet.timer }))).toEqual({
        start: "—",
        slutt: "—",
        pause: "—",
      });
    }
  });

  it("B75 negativkontroll: dag uten rader med tid viser fortsatt sedelens prefylte ramme", () => {
    expect(arbeidstid(rendre("dagskort", { timer: [] as typeof sheet.timer }))).toEqual({
      start: "07:00",
      slutt: "15:30",
      pause: "30 min",
    });
  });

  it("negativkontroll: dag uten delt reise viser det samme som før i dagskort-modus", () => {
    expect(arbeidstid(rendre("dagskort"))).toEqual({ start: "07:00", slutt: "15:30", pause: "30 min" });
    const html = rendre("dagskort", {
      timer: [r1!, r2!, reise("21:00", "23:59", null), { ...reise("05:00", "07:00", null), id: "r4" }] as typeof sheet.timer,
    });
    expect(arbeidstid(html)).toEqual({ start: "05:00", slutt: "23:59", pause: "30 min" });
  });
});
