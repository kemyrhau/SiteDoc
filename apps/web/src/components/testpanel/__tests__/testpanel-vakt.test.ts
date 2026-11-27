import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kanNeste, rundeSchema, type Runde } from "../schema";

/** Vakttester for testpanelet (ordre 2026-11-27): (a) port, (b) 404, (c) kanNeste, (d) POST-schema. */

function lagRunde(): Runde {
  return {
    runde: "eksempel",
    hash: "99aa02d4",
    steg: [
      {
        nr: 1,
        hvaTestes: "Reisevinduet åpnes",
        handling: "Klikk Reise",
        forventet: "Vinduet vises",
        agentSa: "Vinduet vises",
        agentVurdering: "godkjent",
        status: "venter_kenneth",
        kenneth: null,
      },
      {
        nr: 2,
        hvaTestes: "Hjemreise-knappen",
        handling: "Åpne vinduet onsdag",
        forventet: "Knappen vises",
        agentSa: null,
        agentVurdering: null,
        status: "venter_agent",
        kenneth: null,
      },
    ],
  };
}

describe("(c) kanNeste", () => {
  it("låst uten vurdering", () => {
    expect(kanNeste(null, "")).toBe(false);
    expect(kanNeste(null, "noe")).toBe(false);
  });
  it("låst ved avvik uten merknad, også bare mellomrom", () => {
    expect(kanNeste("avvik", "")).toBe(false);
    expect(kanNeste("avvik", "   \n")).toBe(false);
  });
  it("åpen ved avvik med merknad", () => {
    expect(kanNeste("avvik", "feil tekst")).toBe(true);
  });
  it("åpen ved godkjent med tom merknad (forbedring påvirker ikke)", () => {
    expect(kanNeste("godkjent", "")).toBe(true);
  });
});

describe("(a) TestpanelPort", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function port() {
    vi.resetModules();
    return (await import("../TestpanelPort")).TestpanelPort;
  }

  it("rendrer null i production, også med flagget satt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITEDOC_TESTPANEL", "1");
    expect((await port())()).toBeNull();
  });
  it("rendrer null i development uten flagget", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITEDOC_TESTPANEL", "");
    expect((await port())()).toBeNull();
  });
  it("rendrer panelet i development med flagget (negativkontroll)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITEDOC_TESTPANEL", "1");
    expect((await port())()).not.toBeNull();
  });
});

describe("API-ruten", () => {
  let dir: string;
  let rundeFil: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "testpanel-"));
    rundeFil = path.join(dir, "eksempel.json");
    await writeFile(rundeFil, JSON.stringify(lagRunde()));
    await writeFile(path.join(dir, "aktiv.json"), JSON.stringify({ fil: "eksempel.json" }));
    vi.stubEnv("SITEDOC_TESTPANEL_DIR", dir);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  const rute = () => import("@/app/api/testpanel/route");
  const post = (body: unknown) =>
    new Request("http://x/api/testpanel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const påDev = () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITEDOC_TESTPANEL", "1");
  };

  describe("(b) 404 utenfor dev+flagg", () => {
    it("GET og POST gir 404 i production med flagget satt", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITEDOC_TESTPANEL", "1");
      const { GET, POST } = await rute();
      expect((await GET()).status).toBe(404);
      expect((await POST(post({ type: "svar", nr: 1, vurdering: "godkjent" }))).status).toBe(404);
      expect(rundeSchema.parse(JSON.parse(await readFile(rundeFil, "utf8"))).steg[0]!.kenneth).toBeNull();
    });
    it("GET og POST gir 404 i development uten flagget", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("NEXT_PUBLIC_SITEDOC_TESTPANEL", "0");
      const { GET, POST } = await rute();
      expect((await GET()).status).toBe(404);
      expect((await POST(post({ type: "svar", nr: 1, vurdering: "godkjent" }))).status).toBe(404);
    });
    it("GET gir runden i dev med flagget (negativkontroll)", async () => {
      påDev();
      const { GET } = await rute();
      const svar = await GET();
      expect(svar.status).toBe(200);
      expect(((await svar.json()) as { runde: Runde }).runde.runde).toBe("eksempel");
    });
  });

  describe("(d) POST avviser ugyldig svar", () => {
    const uendret = async () =>
      expect(JSON.parse(await readFile(rundeFil, "utf8"))).toEqual(lagRunde());

    it.each([
      ["ugyldig JSON", "{ikke json"],
      ["ukjent vurdering", { type: "svar", nr: 1, vurdering: "kanskje" }],
      ["nr mangler", { type: "svar", vurdering: "godkjent" }],
      ["type mangler", { nr: 1, vurdering: "godkjent" }],
      ["ukjent type", { type: "slett", nr: 1 }],
      ["tom forbedring", { type: "forbedring", nr: 2, tekst: "  " }],
      ["avvik uten merknad", { type: "svar", nr: 1, vurdering: "avvik", merknad: "  " }],
    ])("%s → 400, fila uendret", async (_navn, body) => {
      påDev();
      const { POST } = await rute();
      expect((await POST(post(body))).status).toBe(400);
      await uendret();
    });

    it("steg som venter på agenten → 409, fila uendret", async () => {
      påDev();
      const { POST } = await rute();
      expect((await POST(post({ type: "svar", nr: 2, vurdering: "godkjent" }))).status).toBe(409);
      await uendret();
    });

    it("aktiv.json som peker ut av mappa avvises", async () => {
      påDev();
      await writeFile(path.join(dir, "aktiv.json"), JSON.stringify({ fil: "../x.json" }));
      const { GET } = await rute();
      expect((await GET()).status).toBe(500);
    });

    it("VILKÅR 1: POST bevarer ukjente nøkler i runde og steg (rå JSON)", async () => {
      påDev();
      const rå = lagRunde() as Runde & { agentNotat?: string };
      const medEkstra = {
        ...rå,
        agentNotat: "notat på toppnivå",
        steg: rå.steg.map((s) => ({ ...s, skjermbilde: `steg-${s.nr}.png` })),
      };
      await writeFile(rundeFil, JSON.stringify(medEkstra));
      const { POST } = await rute();
      expect((await POST(post({ type: "svar", nr: 1, vurdering: "godkjent" }))).status).toBe(200);
      const lagret = JSON.parse(await readFile(rundeFil, "utf8")) as Record<string, unknown> & {
        steg: Record<string, unknown>[];
      };
      expect(lagret.agentNotat).toBe("notat på toppnivå");
      expect(lagret.steg[0]!.skjermbilde).toBe("steg-1.png");
      expect(lagret.steg[1]!.skjermbilde).toBe("steg-2.png");
      expect(lagret.steg[0]!.status).toBe("ferdig");
      const { kenneth: _k, status: _s, ...før0 } = medEkstra.steg[0]!;
      const { kenneth: _k2, status: _s2, ...etter0 } = lagret.steg[0]!;
      expect(etter0).toEqual(før0);
      expect(lagret.steg[1]).toEqual(medEkstra.steg[1]);
    });

    it("RETUR 2: pause-POST endrer kun runde.pause og bevarer alt annet (rå JSON)", async () => {
      påDev();
      const medEkstra = { ...lagRunde(), agentNotat: "x", agentNaa: "går til Timer" };
      await writeFile(rundeFil, JSON.stringify(medEkstra));
      const { POST } = await rute();
      expect((await POST(post({ type: "pause", pause: true }))).status).toBe(200);
      const lagret = JSON.parse(await readFile(rundeFil, "utf8")) as Record<string, unknown>;
      expect(lagret).toEqual({ ...medEkstra, pause: true });
      expect((await POST(post({ type: "pause", pause: false }))).status).toBe(200);
      expect(JSON.parse(await readFile(rundeFil, "utf8"))).toEqual({ ...medEkstra, pause: false });
    });

    it("RETUR 2: forbedring lagres mens agenten kjører, uten å endre status", async () => {
      påDev();
      const { POST } = await rute();
      expect((await POST(post({ type: "forbedring", nr: 2, tekst: " Større knapp " }))).status).toBe(200);
      expect((await POST(post({ type: "forbedring", nr: 2, tekst: "Kortere tekst" }))).status).toBe(200);
      const lagret = JSON.parse(await readFile(rundeFil, "utf8")) as Runde;
      const før = lagRunde();
      expect(lagret.steg[0]).toEqual(før.steg[0]);
      const { forbedringer, ...resten } = lagret.steg[1]!;
      expect(resten).toEqual(før.steg[1]);
      expect(resten.status).toBe("venter_agent");
      expect(forbedringer?.map((f) => f.tekst)).toEqual(["Større knapp", "Kortere tekst"]);
    });

    it("RETUR 2: forbedring på ferdig steg → 409, fila uendret", async () => {
      påDev();
      const { POST } = await rute();
      expect((await POST(post({ type: "svar", nr: 1, vurdering: "godkjent" }))).status).toBe(200);
      const etterSvar = await readFile(rundeFil, "utf8");
      expect((await POST(post({ type: "forbedring", nr: 1, tekst: "for sent" }))).status).toBe(409);
      expect(await readFile(rundeFil, "utf8")).toBe(etterSvar);
    });

    it("gyldig svar lagres: kun kenneth + status på steget, resten uendret", async () => {
      påDev();
      const { POST } = await rute();
      const svar = await POST(
        post({ type: "svar", nr: 1, vurdering: "avvik", merknad: " Feil tekst ", forbedring: "" }),
      );
      expect(svar.status).toBe(200);
      const lagret = rundeSchema.parse(JSON.parse(await readFile(rundeFil, "utf8")));
      const før = lagRunde();
      const { kenneth: _k, ...uten } = før.steg[0]!;
      expect(lagret.steg[0]).toMatchObject({ ...uten, status: "ferdig" });
      expect(lagret.steg[0]!.kenneth).toMatchObject({
        vurdering: "avvik",
        merknad: "Feil tekst",
        forbedring: "",
      });
      expect(lagret.steg[1]).toEqual(før.steg[1]);
    });
  });
});
