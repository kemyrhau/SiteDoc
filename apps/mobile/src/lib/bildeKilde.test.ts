import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Host-forankringen leser AUTH_CONFIG.apiUrl + hentWebUrl(). Mock dem her så
// begge verter er deterministiske (uavhengig av EXPO_PUBLIC_API_URL i miljøet)
// og vi slipper å dra inn `react-native` via config/auth.
vi.mock("../config/auth", () => ({
  AUTH_CONFIG: { apiUrl: "http://localhost:3001" },
  hentWebUrl: () => "https://test.sitedoc.no",
}));

import {
  byggBildeKilde,
  bildeRenderTilstand,
  erServerUpload,
  origin,
  stiForFornyelse,
  vurderBildeFornyelse,
} from "./bildeKilde";
import { lagInvalideringsDebounce, SIGNERT_BILDE_DEBOUNCE_MS } from "@sitedoc/shared";

// Dekker begge URL-formene mobilen bygger for /uploads/:
//   api-host:   `${AUTH_CONFIG.apiUrl}/uploads/…`
//   web-proxy:  `${hentWebUrl()}/api/uploads/…`
const API_UPLOAD = "http://localhost:3001/uploads/privat/abc.jpg?sig=xyz";
const WEBPROXY_UPLOAD = "https://test.sitedoc.no/api/uploads/bilde.jpg";

describe("erServerUpload — hvilke URI-er skal bære Bearer", () => {
  it("api-host /uploads/ er en server-upload", () => {
    expect(erServerUpload(API_UPLOAD)).toBe(true);
  });

  it("web-proxy /api/uploads/ er også en server-upload (inneholder /uploads/)", () => {
    expect(erServerUpload(WEBPROXY_UPLOAD)).toBe(true);
  });

  it("lokal file://-sti er IKKE server-upload (trenger ikke token)", () => {
    expect(erServerUpload("file:///var/mobile/.../foto.jpg")).toBe(false);
  });

  it("lokal absolutt sti (/var/…) er IKKE server-upload", () => {
    expect(erServerUpload("/var/mobile/Containers/foto.jpg")).toBe(false);
  });

  it("tredjeparts-http UTEN /uploads/ er IKKE server-upload (unngår token-lekkasje)", () => {
    expect(erServerUpload("https://tredjepart.example.com/bilde.png")).toBe(false);
  });

  it("tredjeparts-http MED /uploads/ er IKKE server-upload (token skal ikke til fremmed host)", () => {
    expect(erServerUpload("https://tredjepart.example.com/uploads/bilde.png")).toBe(false);
  });

  it("host som utvider vår (suffiks-angrep) er IKKE server-upload", () => {
    expect(erServerUpload("https://test.sitedoc.no.fremmed.example/uploads/b.png")).toBe(false);
  });

  it("data:-URI er IKKE server-upload", () => {
    expect(erServerUpload("data:image/png;base64,AAAA")).toBe(false);
  });
});

// Testes DIREKTE (ikke bare via den mockede AUTH_CONFIG): den ekte kjeden
// env → AUTH_CONFIG.apiUrl → origin() er der fail-open-kanten bodde. Særlig tom base.
describe("origin — host-forankring feiler LUKKET på ugyldig/tom base", () => {
  it("beholder porten (sti kuttes)", () => {
    expect(origin("https://api.x.no:3001/trpc")).toBe("https://api.x.no:3001");
  });

  it("etterfølgende skråstrek gir ren origin", () => {
    expect(origin("https://api.x.no/")).toBe("https://api.x.no");
  });

  it("base uten protokoll → null (kan ikke bli en match)", () => {
    expect(origin("api.x.no")).toBeNull();
  });

  it("🔴 tom base → null (ellers ble vakten uri.startsWith('/') = fail-open)", () => {
    expect(origin("")).toBeNull();
  });
});

describe("byggBildeKilde — Bearer legges KUN på server-uploads, KUN med token", () => {
  it("server-upload + token → headeren følger med", () => {
    const kilde = byggBildeKilde(API_UPLOAD, "hemmelig-token");
    expect(kilde).toEqual({
      uri: API_UPLOAD,
      headers: { Authorization: "Bearer hemmelig-token" },
    });
  });

  it("web-proxy-upload + token → headeren følger med", () => {
    const kilde = byggBildeKilde(WEBPROXY_UPLOAD, "t");
    expect(kilde.headers).toEqual({ Authorization: "Bearer t" });
  });

  it("server-upload UTEN token → naken URI (atferd som før endringen)", () => {
    expect(byggBildeKilde(API_UPLOAD, null)).toEqual({ uri: API_UPLOAD });
  });

  it("lokal fil (selv med token) → naken URI, ingen header", () => {
    const kilde = byggBildeKilde("file:///var/foto.jpg", "hemmelig-token");
    expect(kilde).toEqual({ uri: "file:///var/foto.jpg" });
    expect(kilde.headers).toBeUndefined();
  });

  it("tredjeparts-http (selv med token) → naken URI, token lekker ikke", () => {
    const kilde = byggBildeKilde("https://tredjepart.example.com/b.png", "hemmelig-token");
    expect(kilde.headers).toBeUndefined();
  });

  it("tredjeparts-http MED /uploads/ (selv med token) → naken URI, token lekker ikke", () => {
    const kilde = byggBildeKilde(
      "https://tredjepart.example.com/uploads/b.png",
      "hemmelig-token",
    );
    expect(kilde.headers).toBeUndefined();
  });
});

// Signerte URI-er for fornyelses-vurderingen. Med naa=5000: exp=1000 er UTLØPT
// (401 → fornybar), exp=9000 er GYLDIG signatur men bildet feilet likevel (404 →
// terminal). Full mobil-form med VÅR api-host foran + `?exp=&sig=`-query.
const NAA = 5000;
const UTLOPT_URI = "http://localhost:3001/uploads/privat/abc.jpg?exp=1000&sig=xyz";
const GYLDIG_URI = "http://localhost:3001/uploads/privat/abc.jpg?exp=9000&sig=xyz";

describe("stiForFornyelse — full URI → /uploads/-form, MED query beholdt", () => {
  it("api-host: VÅR origin strippes, query beholdes", () => {
    expect(stiForFornyelse(UTLOPT_URI)).toBe("/uploads/privat/abc.jpg?exp=1000&sig=xyz");
  });

  it("web-proxy: origin OG ledende /api strippes, query beholdes", () => {
    expect(
      stiForFornyelse("https://test.sitedoc.no/api/uploads/bilde.jpg?exp=1000&sig=xyz"),
    ).toBe("/uploads/bilde.jpg?exp=1000&sig=xyz");
  });

  it("🔴 query (?exp=) OVERLEVER — regresjonsvakt mot shared raaUploadsSti (som dropper den)", () => {
    // Uten `exp` i resultatet ville `erUtloptSignatur` lest exp=null → «utløpt» for
    // ALT, og 404-vakten (gyldig signatur → terminal) hadde falt.
    expect(stiForFornyelse(GYLDIG_URI)).toContain("exp=9000");
  });

  it("lokal file:// slipper uendret gjennom (starter ikke med /uploads/ → ikke fornybar)", () => {
    expect(stiForFornyelse("file:///var/foto.jpg")).toBe("file:///var/foto.jpg");
  });
});

describe("vurderBildeFornyelse — KRAV (c): 401 fornyes, 4. forsøk aldri, 404 terminal", () => {
  it("forsøk 1 etter 401: umiddelbart (ventMs 0, kun koalescering)", () => {
    expect(vurderBildeFornyelse(UTLOPT_URI, 0, NAA)).toEqual({
      type: "forny",
      nyttForsok: 1,
      ventMs: 0,
    });
  });

  it("🔴 KRAV (c)-1: FORSØK 2 gjøres etter et 401 (med backoff 1000 ms)", () => {
    expect(vurderBildeFornyelse(UTLOPT_URI, 1, NAA)).toEqual({
      type: "forny",
      nyttForsok: 2,
      ventMs: 1000,
    });
  });

  it("forsøk 3 etter et 401 (backoff 2000 ms)", () => {
    expect(vurderBildeFornyelse(UTLOPT_URI, 2, NAA)).toEqual({
      type: "forny",
      nyttForsok: 3,
      ventMs: 2000,
    });
  });

  it("🔴 KRAV (c)-2: ALDRI et fjerde forsøk — taket (3) nådd → gi-opp", () => {
    expect(vurderBildeFornyelse(UTLOPT_URI, 3, NAA)).toEqual({ type: "gi-opp" });
  });

  it("🔴 KRAV (c)-3: 404 (gyldig signatur, borte fil) gjenforsøkes ALDRI — gi-opp fra forsøk 0", () => {
    expect(vurderBildeFornyelse(GYLDIG_URI, 0, NAA)).toEqual({ type: "gi-opp" });
  });

  it("ikke-server-URI (lokal fil som feiler) → gi-opp, ingen invalideringsløkke", () => {
    expect(vurderBildeFornyelse("file:///var/foto.jpg", 0, NAA)).toEqual({ type: "gi-opp" });
  });
});

describe("bildeRenderTilstand — 🔴 fallback hører KUN til terminal, ALDRI til lasting", () => {
  it("🔴 kilde=null + feilet=false → «laster» (token hentes) — NULL rendres, IKKE fallback", () => {
    // Den viktigste testen: uten dette skillet blinker fallbacken på hvert server-
    // bilde i de hundre ms token-hentingen varer.
    expect(bildeRenderTilstand(false, false)).toBe("laster");
  });

  it("feilet=true → «terminal» — her, og bare her, vises fallbacken", () => {
    expect(bildeRenderTilstand(true, true)).toBe("terminal");
  });

  it("kilde satt + ingen feil → «vis» (Image rendres)", () => {
    expect(bildeRenderTilstand(true, false)).toBe("vis");
  });

  it("feilet vinner over manglende kilde (entydig rekkefølge)", () => {
    expect(bildeRenderTilstand(false, true)).toBe("terminal");
  });
});

describe("🔴 KRAV (c)-4: koalescering — tre bilder samtidig → ÉN invalidering pr. forsøksnivå", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("tre samtidige kall i vinduet → ett kall; neste nivå → ett nytt", () => {
    const spion = vi.fn();
    const planlegg = lagInvalideringsDebounce(SIGNERT_BILDE_DEBOUNCE_MS);

    // Forsøksnivå 1: tre bilder feiler nær-samtidig.
    planlegg(spion);
    planlegg(spion);
    planlegg(spion);
    expect(spion).toHaveBeenCalledTimes(0); // ennå ikke fyrt (fast-vindu)
    vi.advanceTimersByTime(SIGNERT_BILDE_DEBOUNCE_MS);
    expect(spion).toHaveBeenCalledTimes(1); // ÉN invalidering for hele bursten

    // Forsøksnivå 2 (etter backoff): tre nye feil → nøyaktig én til.
    planlegg(spion);
    planlegg(spion);
    planlegg(spion);
    vi.advanceTimersByTime(SIGNERT_BILDE_DEBOUNCE_MS);
    expect(spion).toHaveBeenCalledTimes(2);
  });
});
