import { describe, it, expect } from "vitest";
import {
  erLokalVedleggUrl,
  harLokaltVedlegg,
  sammenstillMedLokaleVedlegg,
} from "./vedleggLokal";

describe("erLokalVedleggUrl", () => {
  it("file:// og /var/ er lokale, /uploads/ og https er ikke", () => {
    expect(erLokalVedleggUrl("file:///var/mobile/IMG_1.jpg")).toBe(true);
    expect(erLokalVedleggUrl("/var/mobile/Containers/.../IMG_1.jpg")).toBe(true);
    expect(erLokalVedleggUrl("/uploads/privat/abc.jpg")).toBe(false);
    expect(erLokalVedleggUrl("https://api.sitedoc.no/uploads/x.jpg")).toBe(false);
    expect(erLokalVedleggUrl(undefined)).toBe(false);
  });
});

describe("harLokaltVedlegg", () => {
  it("finner lokalt vedlegg på topp-nivå-felt", () => {
    const felt = { verdi: null, vedlegg: [{ type: "bilde", url: "file:///x.jpg" }] };
    expect(harLokaltVedlegg(felt)).toBe(true);
  });
  it("finner lokalt vedlegg inne i en repeater-rad", () => {
    const felt = {
      verdi: [{ _radId: "r1", felter: { b: { vedlegg: [{ url: "file:///y.jpg" }] } } }],
    };
    expect(harLokaltVedlegg(felt)).toBe(true);
  });
  it("felt med kun server-URL-er er ikke lokalt", () => {
    const felt = { verdi: null, vedlegg: [{ type: "bilde", url: "/uploads/privat/z.jpg" }] };
    expect(harLokaltVedlegg(felt)).toBe(false);
  });
});

// Vaktpost 2: bevis HELE runden — legg vedlegg → lagre med utelatelse (feltet
// mangler/tomt på server) → init sammenstiller server + SQLite → vedlegget er der.
// Dette er runden ingen test dekket, og som slapp datatapet gjennom en grønn gate.
describe("sammenstillMedLokaleVedlegg (init-sammenstilling)", () => {
  it("beholder et felt med lokalt vedlegg når serveren mangler det (repeater)", () => {
    // Server: feltet ble holdt tilbake (utelatFeltMedLokaleVedlegg) → mangler helt.
    const server = {
      tekst1: { verdi: "notat", kommentar: "", vedlegg: [] },
    };
    // SQLite: full lokal tilstand med de fire bildene i en repeater-rad.
    const sqlite = {
      tekst1: { verdi: "notat", kommentar: "", vedlegg: [] },
      rep1: {
        verdi: [
          {
            _radId: "r1",
            felter: {
              bilde: {
                vedlegg: [1, 2, 3, 4].map((n) => ({
                  id: `v${n}`,
                  type: "bilde",
                  url: `file:///IMG_${n}.jpg`,
                  bildeNr: n,
                })),
              },
            },
          },
        ],
      },
    };
    const ut = sammenstillMedLokaleVedlegg(server, sqlite);
    // Repeater-feltet er hentet inn fra SQLite — de fire bildene er der.
    expect((ut as typeof sqlite).rep1).toBeDefined();
    const rad = (ut as typeof sqlite).rep1.verdi[0]!;
    expect(rad.felter.bilde!.vedlegg.map((v) => v.id)).toEqual(["v1", "v2", "v3", "v4"]);
    // Server vinner for felt UTEN lokale vedlegg (tekst1 uendret referanse fra base).
    expect(ut.tekst1).toBe(server.tekst1);
  });

  it("overskriver et felt med tom server-versjon når SQLite har lokalt vedlegg", () => {
    // Server har feltet, men tomt (klobbet av en tidligere feil-init).
    const server = { bilde1: { verdi: null, kommentar: "", vedlegg: [] } };
    const sqlite = {
      bilde1: { verdi: null, kommentar: "", vedlegg: [{ id: "v1", type: "bilde", url: "file:///a.jpg" }] },
    };
    const ut = sammenstillMedLokaleVedlegg(server, sqlite);
    expect(ut.bilde1.vedlegg).toHaveLength(1);
    expect(ut.bilde1.vedlegg[0]!.url).toBe("file:///a.jpg");
  });

  it("returnerer SAMME referanse når ingen lokale vedlegg finnes", () => {
    const server = { a: { verdi: "x", vedlegg: [{ url: "/uploads/x.jpg" }] } };
    const sqlite = { a: { verdi: "x", vedlegg: [{ url: "/uploads/x.jpg" }] } };
    expect(sammenstillMedLokaleVedlegg(server, sqlite)).toBe(server);
  });

  it("null/tom SQLite → server uendret", () => {
    const server = { a: { verdi: 1 } };
    expect(sammenstillMedLokaleVedlegg(server, null)).toBe(server);
    expect(sammenstillMedLokaleVedlegg(server, {})).toBe(server);
  });
});
