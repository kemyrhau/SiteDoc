import { describe, it, expect } from "vitest";
import {
  erLokalVedleggUrl,
  erServerVedleggUrl,
  bevarOriginalUrl,
  vedleggEndret,
  harLokaltVedlegg,
  sammenstillMedLokaleVedlegg,
  utelatFeltMedLokaleVedlegg,
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

describe("erServerVedleggUrl", () => {
  it("/uploads/ og http(s) er server-URL-er, lokale filer er ikke", () => {
    expect(erServerVedleggUrl("/uploads/privat/abc.jpg")).toBe(true);
    expect(erServerVedleggUrl("/uploads/privat/abc.jpg?sig=xyz")).toBe(true);
    expect(erServerVedleggUrl("https://api.sitedoc.no/uploads/x.jpg")).toBe(true);
    expect(erServerVedleggUrl("file:///var/mobile/IMG_1.jpg")).toBe(false);
    expect(erServerVedleggUrl("/var/mobile/IMG_1.jpg")).toBe(false);
    expect(erServerVedleggUrl(undefined)).toBe(false);
  });
});

// Funn d (Kenneth 2026-10-21): annotering skal være ikke-destruktiv. Den opprinnelige
// SERVER-URL-en bevares som originalUrl første gang et server-vedlegg annoteres, slik at
// visningen aldri står uten gyldig kilde om den annoterte URL-en blir utilgjengelig.
describe("bevarOriginalUrl — ikke-destruktiv annotering", () => {
  it("bevarer server-originalen når et server-vedlegg annoteres første gang", () => {
    expect(bevarOriginalUrl(undefined, "/uploads/privat/orig.jpg?sig=a")).toBe(
      "/uploads/privat/orig.jpg?sig=a",
    );
  });
  it("bevarer INGEN original når gjeldende url er en lokal fil (ikke en trygg reserve)", () => {
    expect(bevarOriginalUrl(undefined, "file:///var/mobile/IMG_1.jpg")).toBeUndefined();
  });
  it("beholder den FØRSTE bevarte originalen ved re-annotering", () => {
    // Andre annotering: gjeldende url er nå den forrige annoterte fila, men originalUrl står fast.
    expect(
      bevarOriginalUrl("/uploads/privat/orig.jpg", "file:///var/mobile/annotert_2.jpg"),
    ).toBe("/uploads/privat/orig.jpg");
    expect(
      bevarOriginalUrl("/uploads/privat/orig.jpg", "/uploads/privat/annotert_1.jpg"),
    ).toBe("/uploads/privat/orig.jpg");
  });
});

// Godkjent-lås (Kenneth-vedtak 2026-10-21): server avviser vedlegg-endring på en avsluttet
// rapport. Sammenligningen er på id+filnavn, så ren URL-resignering ikke slår ut som endring.
describe("vedleggEndret — identitet/filnavn, ikke URL-signatur", () => {
  const v = (id: string, filnavn: string, url: string) => ({ id, filnavn, url, type: "bilde" });

  it("ulik URL-signatur på samme vedlegg er IKKE en endring", () => {
    const a = [v("1", "foto.jpg", "/uploads/privat/foto.jpg?sig=aaa")];
    const b = [v("1", "foto.jpg", "/uploads/privat/foto.jpg?sig=bbb")];
    expect(vedleggEndret(a, b)).toBe(false);
  });
  it("annotering (nytt filnavn) ER en endring", () => {
    const a = [v("1", "foto.jpg", "/uploads/privat/foto.jpg")];
    const b = [v("1", "annotert_123.jpg", "/uploads/privat/annotert_123.jpg")];
    expect(vedleggEndret(a, b)).toBe(true);
  });
  it("sletting og tillegg ER endringer", () => {
    const a = [v("1", "foto.jpg", "/u/a"), v("2", "foto2.jpg", "/u/b")];
    expect(vedleggEndret(a, [v("1", "foto.jpg", "/u/a")])).toBe(true); // slettet
    expect(vedleggEndret([v("1", "foto.jpg", "/u/a")], a)).toBe(true); // lagt til
  });
  it("tom/manglende liste håndteres", () => {
    expect(vedleggEndret(undefined, undefined)).toBe(false);
    expect(vedleggEndret([], undefined)).toBe(false);
    expect(vedleggEndret(undefined, [v("1", "foto.jpg", "/u/a")])).toBe(true);
  });
  it("rekkefølge (omstokking) er IKKE en endring (sortert sett)", () => {
    const a = [v("1", "a.jpg", "/u/a"), v("2", "b.jpg", "/u/b")];
    const b = [v("2", "b.jpg", "/u/b"), v("1", "a.jpg", "/u/a")];
    expect(vedleggEndret(a, b)).toBe(false);
  });
  it("tar hele feltobjektet: topp-nivå-vedlegg fanges, verdi-endring alene ikke", () => {
    const før = { verdi: "x", vedlegg: [v("1", "foto.jpg", "/u/a")] };
    const etterVerdi = { verdi: "y", vedlegg: [v("1", "foto.jpg", "/u/a?sig=z")] };
    const etterAnnotert = { verdi: "x", vedlegg: [v("1", "annotert_9.jpg", "/u/ann")] };
    expect(vedleggEndret(før, etterVerdi)).toBe(false); // kun verdi + sig endret
    expect(vedleggEndret(før, etterAnnotert)).toBe(true); // vedlegg annotert
  });
  it("fanger repeater-nestede vedlegg", () => {
    const før = { verdi: [{ _radId: "r1", felter: { b: { vedlegg: [v("9", "r.jpg", "/u/r")] } } }] };
    const etter = { verdi: [{ _radId: "r1", felter: { b: { vedlegg: [v("9", "annotert_r.jpg", "/u/r2")] } } }] };
    expect(vedleggEndret(før, etter)).toBe(true);
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
    const server = { bilde1: { verdi: null, kommentar: "", vedlegg: [] as { id: string; type: string; url: string }[] } };
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

// Lagrings-siden av funn C. `utelatFeltMedLokaleVedlegg` erstatter en lokal kopi
// som lå i useSjekklisteSkjema (funn: tre kopier av samme deteksjon ville oppstått
// om oppgave fikk sin egen). Sjekkliste er i PROD — shared-versjonen må være
// atferdsmessig identisk. Produksjonsformen ({ _radId, felter }) testes FØRST:
// det var den formen fire bilder gjemte seg bak i to døgn.
describe("utelatFeltMedLokaleVedlegg (lagrings-utelatelse)", () => {
  it("utelater et repeater-felt med lokalt vedlegg i { _radId, felter }-form", () => {
    const data = {
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
    const ut = utelatFeltMedLokaleVedlegg(data);
    // Repeater-feltet med de fire file://-bildene er holdt utenfor payloaden.
    expect("rep1" in ut).toBe(false);
    // Felt uten lokale vedlegg er urørt (samme referanse).
    expect(ut.tekst1).toBe(data.tekst1);
  });

  it("utelater et topp-nivå-felt med lokalt vedlegg (flat form)", () => {
    const data = {
      bilde1: { verdi: null, kommentar: "", vedlegg: [{ id: "v1", type: "bilde", url: "file:///a.jpg" }] },
      tekst1: { verdi: "ok", kommentar: "", vedlegg: [] },
    };
    const ut = utelatFeltMedLokaleVedlegg(data);
    expect("bilde1" in ut).toBe(false);
    expect(ut.tekst1).toBe(data.tekst1);
  });

  it("beholder felt hvis vedlegget alt har en server-URL", () => {
    const data = {
      bilde1: { verdi: null, kommentar: "", vedlegg: [{ id: "v1", type: "bilde", url: "/uploads/privat/a.jpg" }] },
    };
    // Ingen lokale vedlegg → SAMME referanse (ingen state-churn).
    expect(utelatFeltMedLokaleVedlegg(data)).toBe(data);
  });

  it("blander: kun felt MED lokalt vedlegg faller ut, resten består", () => {
    const data = {
      lokal: { vedlegg: [{ id: "v1", url: "file:///x.jpg" }] },
      server: { vedlegg: [{ id: "v2", url: "/uploads/privat/y.jpg" }] },
      tekst: { verdi: "beholdes" },
    };
    const ut = utelatFeltMedLokaleVedlegg(data);
    expect(Object.keys(ut).sort()).toEqual(["server", "tekst"]);
  });
});
