import { describe, it, expect, vi } from "vitest";

// w10b (S3, B6): én attestering på /dashbord/attestering — gamle adresser sender dit,
// ruta er firma-kontekst, og menyen viser «Attestering» for prosjektleder og firma-admin.

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("@/kontekst/firma-kontekst", () => ({ useFirma: () => ({}) }));
vi.mock("@/lib/trpc", () => ({ trpc: {} }));

import GammelListe from "@/app/dashbord/firma/timer/attestering/page";
import GammelDetalj from "@/app/dashbord/firma/timer/attestering/[id]/page";
import { attesteringRedirectUrl } from "@/lib/attestering-ruter";
import { ruteErFirmaKontekst } from "@/lib/ruteKontekst";
import { firmaNavElementer, gateFirmaNav, type FirmaNavTilgang } from "@/components/layout/firma-nav";

describe("gamle attesteringsadresser omdirigerer", () => {
  it("lista: visning/uke/fane følger med", () => {
    expect(() => GammelListe({ searchParams: { visning: "ansatt", uke: "-2", fane: "accepted" } })).toThrow(
      "NEXT_REDIRECT:/dashbord/attestering?visning=ansatt&uke=-2&fane=accepted",
    );
    expect(() => GammelListe({ searchParams: {} })).toThrow("NEXT_REDIRECT:/dashbord/attestering");
  });
  it("detaljen: id og retur-konteksten følger med", () => {
    expect(() =>
      GammelDetalj({ params: { id: "s1" }, searchParams: { fraVisning: "prosjekt", fraUke: "1", fraFane: "sent" } }),
    ).toThrow("NEXT_REDIRECT:/dashbord/attestering/s1?fraVisning=prosjekt&fraUke=1&fraFane=sent");
  });
  it("bare det lukkede settet av parametre følger med (ingen open redirect)", () => {
    expect(attesteringRedirectUrl("/dashbord/attestering", { neste: "https://ondsinnet.example", uke: ["3", "4"], firma: "f1" })).toBe(
      "/dashbord/attestering?uke=3&firma=f1",
    );
  });
});

describe("rutekontekst", () => {
  it("/dashbord/attestering er firma-kontekst, også detaljen", () => {
    expect(ruteErFirmaKontekst("/dashbord/attestering")).toBe(true);
    expect(ruteErFirmaKontekst("/dashbord/attestering/s1")).toBe(true);
    expect(ruteErFirmaKontekst("/dashbord/attesteringer")).toBe(false);
  });
});

describe("menyen — «Attestering» i FIRMA-sonen", () => {
  const ingen: FirmaNavTilgang = {
    kanAdministrereFirma: false,
    erSitedocAdmin: false,
    harTimerModul: false,
    harVarelagerModul: false,
    harHmsTilgang: false,
    attesteringsFirmaer: [],
  };
  const hrefs = (t: FirmaNavTilgang) => gateFirmaNav(firmaNavElementer, t).map((e) => e.href);

  it("prosjektleder uten firma-admin får bare Attestering", () => {
    expect(hrefs({ ...ingen, attesteringsFirmaer: [{ harTimerModul: true }] })).toEqual(["/dashbord/attestering"]);
  });
  it("vanlig ansatt, og leder i firma uten Timer, får ingenting", () => {
    expect(hrefs(ingen)).toEqual([]);
    expect(hrefs({ ...ingen, attesteringsFirmaer: [{ harTimerModul: false }] })).toEqual([]);
  });
  it("firma-admin med Timer får Attestering i tillegg til firmamenyen (også uten ansettelse)", () => {
    const admin = hrefs({ ...ingen, kanAdministrereFirma: true, erSitedocAdmin: true, harTimerModul: true });
    expect(admin).toContain("/dashbord/attestering");
    expect(admin).toContain("/dashbord/firma/timer");
    expect(admin.indexOf("/dashbord/attestering")).toBe(admin.indexOf("/dashbord/firma/timer/rapport") + 1);
  });
  it("firma-admin uten Timer får ikke Attestering", () => {
    expect(hrefs({ ...ingen, kanAdministrereFirma: true })).not.toContain("/dashbord/attestering");
  });
});
