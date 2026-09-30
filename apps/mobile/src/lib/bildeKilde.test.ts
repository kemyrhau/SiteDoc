import { describe, it, expect, vi } from "vitest";

// Host-forankringen leser AUTH_CONFIG.apiUrl + hentWebUrl(). Mock dem her så
// begge verter er deterministiske (uavhengig av EXPO_PUBLIC_API_URL i miljøet)
// og vi slipper å dra inn `react-native` via config/auth.
vi.mock("../config/auth", () => ({
  AUTH_CONFIG: { apiUrl: "http://localhost:3001" },
  hentWebUrl: () => "https://test.sitedoc.no",
}));

import { byggBildeKilde, erServerUpload } from "./bildeKilde";

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
