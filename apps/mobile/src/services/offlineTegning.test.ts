import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Offline tegningsvisning (ordre fix/offline-tegning). Rød-først: viseren skal lese
 * LOKAL kopi før nett, og gi en tydelig tilstand når tegningen ikke er forberedt og
 * enheten er uten nett.
 *
 * H1 — flymodus ETTER «Forbered til offline» gir den lokale fila (data-URI, lokal=true).
 * H2 — IKKE forberedt + uten nett gir `offlineUtilgjengelig` (uri=null), ikke brutt bilde.
 *
 * Harnessen mocker `expo-file-system/legacy` med et minne-filsystem: nedlasting
 * «skriver» fila, getInfo/les leser fra samme lager. Rød-først verifisert ved å
 * kjøre H1 FØR implementasjonen (hentTegningKilde fantes ikke → import kastet).
 */

// Minne-filsystem delt av mock + test.
const fs = vi.hoisted(() => ({
  store: new Map<string, string>(), // sti → rå innhold (utf-8)
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///doc/",
  EncodingType: { Base64: "base64", UTF8: "utf8" },
  getInfoAsync: async (sti: string) => ({
    exists: fs.store.has(sti),
    size: fs.store.get(sti)?.length ?? 0,
    uri: sti,
  }),
  makeDirectoryAsync: async () => undefined,
  deleteAsync: async (sti: string) => {
    // Mappeslett: fjern alt under prefikset.
    for (const k of [...fs.store.keys()]) if (k === sti || k.startsWith(sti)) fs.store.delete(k);
  },
  readDirectoryAsync: async (mappe: string) =>
    [...fs.store.keys()].filter((k) => k.startsWith(mappe)).map((k) => k.slice(mappe.length)),
  readAsStringAsync: async (sti: string, opts?: { encoding?: string }) => {
    const innhold = fs.store.get(sti);
    if (innhold == null) throw new Error("ENOENT");
    return opts?.encoding === "base64" ? Buffer.from(innhold, "utf-8").toString("base64") : innhold;
  },
  writeAsStringAsync: async (sti: string, data: string) => {
    fs.store.set(sti, data);
  },
  createDownloadResumable: (_url: string, dest: string) => ({
    downloadAsync: async () => {
      // «Last ned» = skriv et markør-innhold til destinasjonen.
      fs.store.set(dest, `INNHOLD:${dest}`);
      return { status: 200, uri: dest };
    },
  }),
}));

vi.mock("../config/auth", () => ({
  hentWebUrl: () => "https://web.test",
  AUTH_CONFIG: { apiUrl: "https://api.test" },
}));
vi.mock("./auth", () => ({ hentSessionToken: async () => "tok" }));
vi.mock("./ifcCache", () => ({
  lastNedIfc: async () => "file:///doc/sitedoc-ifc/x.ifc",
  erCachet: async () => false,
}));

import {
  forberedTegning,
  erTegningForberedt,
  hentTegningKilde,
} from "./offlineKlargjoring";

beforeEach(() => {
  fs.store.clear();
});

describe("offline tegningsvisning", () => {
  it("H1 — etter forberedelse gir flymodus den lokale fila (data-URI)", async () => {
    const tegning = { fileUrl: "/uploads/aaa.svg", mobilFileUrl: "/uploads/bbb-mobil.svg" };

    expect(await erTegningForberedt(tegning)).toBe(false);

    await forberedTegning(tegning);
    expect(await erTegningForberedt(tegning)).toBe(true);

    // Uten nett: skal gi lokal kopi, ikke nett-URL.
    const kilde = await hentTegningKilde(tegning, false, "https://api.test");
    expect(kilde.lokal).toBe(true);
    expect(kilde.offlineUtilgjengelig).toBe(false);
    expect(kilde.uri?.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("H1b — effektiv kilde er mobilvarianten når den finnes", async () => {
    const tegning = { fileUrl: "/uploads/aaa.svg", mobilFileUrl: "/uploads/bbb-mobil.svg" };
    // Forbered KUN fileUrl manuelt ved å laste ned via forberedTegning (laster begge),
    // så fjern mobil for å bevise at nøkkelen følger mobilFileUrl.
    await forberedTegning(tegning);
    // Mobilvarianten er den som vises → forberedt-status følger mobilFileUrl.
    expect(await erTegningForberedt({ fileUrl: "/uploads/aaa.svg", mobilFileUrl: "/uploads/mangler.svg" })).toBe(false);
  });

  it("H2 — ikke forberedt + uten nett gir offlineUtilgjengelig (ingen brutt bilde)", async () => {
    const tegning = { fileUrl: "/uploads/ccc.svg", mobilFileUrl: null };
    const kilde = await hentTegningKilde(tegning, false, "https://api.test");
    expect(kilde.uri).toBe(null);
    expect(kilde.lokal).toBe(false);
    expect(kilde.offlineUtilgjengelig).toBe(true);
  });

  it("H2b — ikke forberedt MEN på nett gir nett-URL (ikke utilgjengelig)", async () => {
    const tegning = { fileUrl: "/uploads/ccc.svg", mobilFileUrl: null };
    const kilde = await hentTegningKilde(tegning, true, "https://api.test");
    expect(kilde.uri).toBe("https://api.test/uploads/ccc.svg");
    expect(kilde.lokal).toBe(false);
    expect(kilde.offlineUtilgjengelig).toBe(false);
  });

  it("ny revisjon (ny fil-URL) matcher ikke gammel lokal kopi", async () => {
    const gammel = { fileUrl: "/uploads/rev-a.svg", mobilFileUrl: null };
    await forberedTegning(gammel);
    expect(await erTegningForberedt(gammel)).toBe(true);
    // Ny revisjon = nytt UUID-filnavn → egen nøkkel, ikke cachet.
    const ny = { fileUrl: "/uploads/rev-b.svg", mobilFileUrl: null };
    expect(await erTegningForberedt(ny)).toBe(false);
    const kilde = await hentTegningKilde(ny, false, "https://api.test");
    expect(kilde.offlineUtilgjengelig).toBe(true);
  });
});
