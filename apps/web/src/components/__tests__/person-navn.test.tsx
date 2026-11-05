// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Ordre 2026-11-05 (2): to personer heter «Kenneth Myrhaug» i dokumentflyten — hover
 * viser e-posten, klikk åpner PersonKort for nettopp den personen. Grupper får ikke
 * oppførselen (de rendres ikke via PersonNavn), og en person uten prosjektmedlemskap
 * kan ikke åpne et kort som ikke finnes.
 */

const MEDLEMMER = [
  { id: "pm-1", user: { id: "u-1", name: "Kenneth Myrhaug", email: "kemyrhau@gmail.com" } },
  { id: "pm-2", user: { id: "u-2", name: "Kenneth Myrhaug", email: "kenneth@sitedoc.no" } },
];

vi.mock("@/lib/trpc", () => {
  const tom = { useQuery: () => ({ data: undefined }) };
  return {
    trpc: {
      medlem: { hentForProsjekt: { useQuery: () => ({ data: MEDLEMMER }) } },
      faggruppe: { hentForProsjekt: tom },
      dokumentflyt: { hentForProsjekt: tom },
      gruppe: { hentForProsjekt: tom, hentMinFlytInfo: tom },
    },
  };
});

// Kortet selv er dekket på Kontakter-siden; her holder det å se HVEM det åpnes for.
vi.mock("@/app/dashbord/oppsett/brukere/_components/PersonKort", () => ({
  PersonKort: ({ medlem }: { medlem: { user: { email: string } } }) => (
    <div role="dialog">{medlem.user.email}</div>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: { navn?: string }) => `${k}:${o?.navn ?? ""}` }),
}));

import { PersonNavn } from "../PersonNavn";

afterEach(cleanup);

describe("PersonNavn — e-post på hover, personkort på klikk", () => {
  it("🔴 hover-teksten er personens e-post", () => {
    render(<PersonNavn prosjektId="p" navn="Kenneth Myrhaug" projectMemberId="pm-2" />);
    const knapp = screen.getByRole("button");
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("kenneth@sitedoc.no");
    expect(knapp.closest("[aria-describedby]")?.getAttribute("aria-describedby") ?? knapp.getAttribute("aria-describedby"))
      .toContain(tip.id);
  });

  it("🔴 klikk åpner riktig person når to har samme navn", () => {
    render(
      <>
        <PersonNavn prosjektId="p" navn="Kenneth Myrhaug" projectMemberId="pm-1" />
        <PersonNavn prosjektId="p" navn="Kenneth Myrhaug" projectMemberId="pm-2" />
      </>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button")[1]!);
    expect(screen.getByRole("dialog").textContent).toBe("kenneth@sitedoc.no");
  });

  it("klikket bobler ikke til raden rundt (f.eks. gruppe-ekspansjon)", () => {
    const rad = vi.fn();
    render(
      <div onClick={rad}>
        <PersonNavn prosjektId="p" navn="Kenneth Myrhaug" projectMemberId="pm-1" />
      </div>,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("dialog"));
    expect(rad).not.toHaveBeenCalled();
  });

  it("person utenfor prosjektet: e-post på hover, men ingen knapp og intet kort", () => {
    render(<PersonNavn prosjektId="p" navn="Malin" userId="u-ukjent" epost="malin@firma.no" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("tooltip").textContent).toContain("malin@firma.no");
  });

  it("🔴 gruppe-id gir ikke kort (bare prosjektmedlemmer kan åpnes)", () => {
    render(<PersonNavn prosjektId="p" navn="A.Markussen Ansatte" projectMemberId="gruppe-1" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("dokumentflyt og HMS-flyt: PersonNavn brukes kun på personer, aldri på grupper", () => {
    const filer = [
      "../../app/dashbord/oppsett/produksjon/dokumentflyt/page.tsx",
      "../hms/HmsFlytKort.tsx",
    ].map((f) => readFileSync(resolve(__dirname, f), "utf8"));
    const bruk = filer.flatMap((s) => s.match(/<PersonNavn [^>]*\/>/g) ?? []);
    expect(bruk.length).toBe(4);
    for (const b of bruk) {
      expect(b).toMatch(/projectMemberId=|userId=/);
      expect(b).not.toMatch(/group/);
    }
  });
});
