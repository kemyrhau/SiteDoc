import { describe, it, expect } from "vitest";
import {
  kilderFor,
  kildeModus,
  synligeSeksjoner,
  tellelinje,
  seksjonsUtvalg,
  velgMappeMotor,
  grupperPerDokument,
  flettUtvidet,
  byggLeser,
  nesteEnhet,
  startEnhet,
  MAKS_RADER_ALLE,
  type KildeModus,
  type Kilde,
} from "./sokLogikk";

/** Mobilsøk MVP — ren logikk bak søkeskjermen og chunk-leseren (spec-sok-mobil rev. 2 § 2, § 3, § 6, § 9). */

describe("omfang → kilder (§ 9.4 A)", () => {
  it("«Alle» gir Mapper → Sjekklister → Oppgaver, ellers én kilde", () => {
    expect(kilderFor("alle")).toEqual(["mapper", "sjekklister", "oppgaver"]);
    expect(kilderFor("sjekklister")).toEqual(["sjekklister"]);
  });
});

describe("kildeModus — offline-matrisen (§ 9.3)", () => {
  const liste = { serverBekreftet: true, serverAntall: 3, lokalAntall: 3 };

  it("Mapper: server med nett, «krever nett» uten", () => {
    expect(kildeModus("mapper", { erPaaNettet: true, ...liste })).toBe("server");
    expect(kildeModus("mapper", { erPaaNettet: false, ...liste })).toBe("krever-nett");
  });

  it("Sjekklister/oppgaver: server-svar med nett, lokal katalog uten", () => {
    for (const k of ["sjekklister", "oppgaver"] as const) {
      expect(kildeModus(k, { erPaaNettet: true, ...liste })).toBe("server");
      expect(kildeModus(k, { erPaaNettet: false, ...liste })).toBe("lokal");
    }
  });

  it("med nett men uten bekreftet server-svar faller listene til lokal katalog", () => {
    expect(kildeModus("oppgaver", { erPaaNettet: true, serverBekreftet: false, serverAntall: 0, lokalAntall: 4 })).toBe("lokal");
  });
});

describe("seksjoner og tellelinje", () => {
  const antall = (m: number, s: number, o: number): Record<Kilde, number> => ({ mapper: m, sjekklister: s, oppgaver: o });
  const online: Record<Kilde, KildeModus> = { mapper: "server", sjekklister: "server", oppgaver: "server" };
  const offline: Record<Kilde, KildeModus> = { mapper: "krever-nett", sjekklister: "lokal", oppgaver: "lokal" };

  it("«Alle» skjuler tomme seksjoner", () => {
    expect(synligeSeksjoner("alle", antall(7, 0, 1), online)).toEqual(["mapper", "oppgaver"]);
  });

  it("«Alle» offline viser alltid Mapper-seksjonen («krever nett»)", () => {
    expect(synligeSeksjoner("alle", antall(0, 3, 1), offline)).toEqual(["mapper", "sjekklister", "oppgaver"]);
  });

  it("enkelt omfang viser sin seksjon også når den er tom", () => {
    expect(synligeSeksjoner("oppgaver", antall(0, 0, 0), online)).toEqual(["oppgaver"]);
  });

  it("tellelinje «4 treff · mapper krever nett» i «Alle» offline", () => {
    expect(tellelinje("alle", antall(0, 3, 1), offline)).toEqual({ treff: 4, mapperKreverNett: true });
  });

  it("tellelinje online summerer kildene i omfanget", () => {
    expect(tellelinje("alle", antall(7, 3, 1), online)).toEqual({ treff: 11, mapperKreverNett: false });
    expect(tellelinje("sjekklister", antall(7, 3, 1), online)).toEqual({ treff: 3, mapperKreverNett: false });
  });

  it("maks 10 rader pr. seksjon i «Alle», alle i enkelt omfang", () => {
    const rader = Array.from({ length: 14 }, (_, i) => i);
    expect(seksjonsUtvalg(rader, "alle")).toEqual({ rader: rader.slice(0, MAKS_RADER_ALLE), totalt: 14 });
    expect(seksjonsUtvalg(rader, "oppgaver")).toEqual({ rader, totalt: 14 });
  });
});

describe("velgMappeMotor (§ 6, samme regel som web sok/page.tsx)", () => {
  it("AI når embeddings finnes, AI svarte uten feil og ga treff", () => {
    expect(velgMappeMotor({ harEmbeddings: true, aiFeilet: false, aiAntall: 2, aiSøkUtilgjengelig: false })).toEqual({
      motor: "ai",
      aiUtilgjengelig: false,
    });
  });

  it("leksikalsk uten embeddings, ved feil, og når AI gir 0 treff", () => {
    expect(velgMappeMotor({ harEmbeddings: false, aiFeilet: false, aiAntall: 0, aiSøkUtilgjengelig: false }).motor).toBe("leksikalsk");
    expect(velgMappeMotor({ harEmbeddings: true, aiFeilet: true, aiAntall: 0, aiSøkUtilgjengelig: false }).motor).toBe("leksikalsk");
    expect(velgMappeMotor({ harEmbeddings: true, aiFeilet: false, aiAntall: 0, aiSøkUtilgjengelig: false }).motor).toBe("leksikalsk");
  });

  it("aiSøkUtilgjengelig meldes kun når AI var aktiv og ikke feilet", () => {
    expect(velgMappeMotor({ harEmbeddings: true, aiFeilet: false, aiAntall: 2, aiSøkUtilgjengelig: true }).aiUtilgjengelig).toBe(true);
    expect(velgMappeMotor({ harEmbeddings: false, aiFeilet: false, aiAntall: 0, aiSøkUtilgjengelig: true }).aiUtilgjengelig).toBe(false);
  });
});

describe("grupperPerDokument / flettUtvidet (§ 2, som web treff-liste)", () => {
  const t = (id: string, documentId: string, antallIDok?: number) => ({ id, documentId, filename: `${documentId}.pdf`, antallIDok });

  it("grupperer i rekkefølge, «vist av antall» og antall flere", () => {
    const g = grupperPerDokument([t("1", "A", 9), t("2", "B"), t("3", "A", 9)]);
    expect(g.map((x) => x.documentId)).toEqual(["A", "B"]);
    expect(g[0]).toMatchObject({ filename: "A.pdf", vist: 2, antallIDok: 9, flere: 7 });
    expect(g[1]).toMatchObject({ vist: 1, antallIDok: 1, flere: 0 });
  });

  it("utvidede rader erstatter dokumentets rader på dokumentets plass", () => {
    const grunn = [t("1", "A"), t("2", "B"), t("3", "A")];
    const ut = flettUtvidet(grunn, { A: [t("1", "A"), t("3", "A"), t("4", "A")] });
    expect(ut.map((x) => x.id)).toEqual(["1", "3", "4", "2"]);
  });
});

describe("byggLeser — chunk-leser (§ 3, M3 som web Fulltekst)", () => {
  const felles = "felles overlapp som gjentas i neste chunk ";
  const chunks = [
    { id: "c0", chunkIndex: 0, pageNumber: 1, sectionTitle: "Tak", chunkText: `Membran legges først. ${felles}` },
    { id: "c1", chunkIndex: 1, pageNumber: 1, sectionTitle: "Tak", chunkText: `${felles}deretter membran nr to.` },
    { id: "c2", chunkIndex: 2, pageNumber: 2, sectionTitle: null, chunkText: "Side to uten treff." },
  ];
  const tekst = (seg: { deler: Array<{ tekst: string }> }) => seg.deler.map((d) => d.tekst).join("");

  it("grupperer pr. side og kapper overlappet fra neste chunk når den ikke er valgt", () => {
    const { sider } = byggLeser(chunks, 0, "membran");
    expect(sider.map((s) => s.side)).toEqual([1, 2]);
    expect(tekst(sider[0]!.segmenter[1]!)).toBe("deretter membran nr to.");
  });

  it("valgt chunk vises hel — forgjengerens hale kappes i stedet", () => {
    const { sider } = byggLeser(chunks, 1, "membran");
    expect(tekst(sider[0]!.segmenter[0]!)).toBe("Membran legges først. ");
    expect(tekst(sider[0]!.segmenter[1]!)).toBe(`${felles}deretter membran nr to.`);
    expect(sider[0]!.segmenter[1]!.erValgt).toBe(true);
  });

  it("forekomster nummereres i dokumentrekkefølge med chunkIndex", () => {
    const { forekomster, sider } = byggLeser(chunks, 1, "membran");
    expect(forekomster).toEqual([{ chunkIndex: 0 }, { chunkIndex: 1 }]);
    const merket = sider[0]!.segmenter.flatMap((s) => s.deler.filter((d) => d.forekomst != null).map((d) => d.forekomst));
    expect(merket).toEqual([0, 1]);
  });

  it("tom chunk-liste gir ingen sider", () => {
    expect(byggLeser([], 0, "x")).toEqual({ sider: [], forekomster: [] });
  });
});

describe("nesteEnhet — ▲▼ med rundgang (som web)", () => {
  it("går fram og tilbake med rundgang", () => {
    expect(nesteEnhet(0, 1, 3)).toBe(1);
    expect(nesteEnhet(2, 1, 3)).toBe(0);
    expect(nesteEnhet(0, -1, 3)).toBe(2);
  });

  it("fra «–» går neste til første og forrige til siste; 0 enheter gir null", () => {
    expect(nesteEnhet(null, 1, 3)).toBe(0);
    expect(nesteEnhet(null, -1, 3)).toBe(2);
    expect(nesteEnhet(null, 1, 0)).toBeNull();
  });
});

describe("startEnhet — ▲▼ starter ved valgt treff (som web liste-klikk)", () => {
  const enheter = [{ chunkIndex: 0 }, { chunkIndex: 3 }, { chunkIndex: 3 }, { chunkIndex: 7 }];

  it("første enhet i valgt chunk, ikke dokumentets første", () => {
    expect(startEnhet(enheter, 3)).toBe(1);
    expect(startEnhet(enheter, 7)).toBe(3);
  });

  it("valgt chunk uten enhet eller uten valgt chunk gir «–» (null)", () => {
    expect(startEnhet(enheter, 5)).toBeNull();
    expect(startEnhet(enheter, null)).toBeNull();
    expect(startEnhet([], 3)).toBeNull();
  });
});
