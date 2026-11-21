// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Plan § 8.22 L1 (Kenneth: «maskinkortet er for lite -> benytt dynamiske vinduer»):
 * maskinlista i `MaskinVelger` legges i flyten uten høydetak når `iVindu` er satt, så vinduet
 * vokser til skjermhøyden og ruller inni. Uten `iVindu` er lista svevende med `max-h-64`
 * (dagskort-modus uendret). På i prosjektkort-modus på dagssiden og i attesteringen
 * (`RedigerMaskinRad` → «Del opp»/`AttesteringDetalj_Edit`, og `RedigerRadModal`).
 */

const h = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: data[navn], isLoading: false });
        if (p === "useMutation") return () => ({ mutate: () => {}, isPending: false });
        if (p === "useUtils") return () => lag([]);
        return lag([...sti, p]);
      },
    });
  return { data, trpc: lag([]), iVinduKall: [] as Array<boolean | undefined> };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { name: "Kari Leder" } } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "nb" } }),
}));
// Ekte MaskinVelger, men hvert kall noterer `iVindu` — så kallstedene kan måles.
vi.mock("@/components/timer/MaskinVelger", async (importOriginal) => {
  const ekte = await importOriginal<typeof import("@/components/timer/MaskinVelger")>();
  return {
    ...ekte,
    MaskinVelger: (p: Parameters<typeof ekte.MaskinVelger>[0]) => {
      h.iVinduKall.push(p.iVindu);
      return ekte.MaskinVelger(p);
    },
  };
});

// jsdom har ikke <dialog>.showModal (Modal i @sitedoc/ui bruker den).
const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
proto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
proto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

import { MaskinVelger } from "@/components/timer/MaskinVelger";
import { RedigerMaskinRad } from "@/components/timer/RedigerMaskinRad";
import { RedigerRadModal } from "@/components/attestering/RedigerRadModal";

afterEach(() => {
  cleanup();
  h.iVinduKall.length = 0;
});

const UTSTYR = Array.from({ length: 12 }, (_, i) => ({
  id: `v${i}`, merke: "Volvo", modell: `EC${i}`, internNavn: null, internNummer: String(i), kategori: "anleggsmaskin",
}));

function aapneListe(iVindu?: boolean) {
  const { container } = render(<MaskinVelger utstyr={UTSTYR} valgtId="" onVelg={() => {}} iVindu={iVindu} />);
  fireEvent.click(container.querySelector("button")!);
  return {
    liste: container.querySelector("[data-testid=maskinvelger-liste]")!,
    rader: container.querySelector("[data-testid=maskinvelger-rader]")!,
  };
}

describe("§ 8.22 L1 — MaskinVelger i full høyde", () => {
  it("med iVindu: lista i flyten, verken absolute eller max-h-64, alle maskinene vises", () => {
    const { liste, rader } = aapneListe(true);
    expect(liste.className).not.toMatch(/\babsolute\b/);
    expect(rader.className).not.toMatch(/\bmax-h-64\b/);
    expect(rader.className).not.toMatch(/\boverflow-y-auto\b/);
    expect(rader.querySelectorAll("button")).toHaveLength(12);
  });

  it("vakt dagskort: uten iVindu er lista svevende med høydetak som før", () => {
    const { liste, rader } = aapneListe();
    expect(liste.className).toMatch(/\babsolute\b/);
    expect(liste.className).toMatch(/\bz-30\b/);
    expect(rader.className).toMatch(/\bmax-h-64\b/);
    expect(rader.className).toMatch(/\boverflow-y-auto\b/);
  });
});

describe("§ 8.22 L1 — attesteringen sender iVindu (begge firmavalg)", () => {
  it("RedigerMaskinRad (Del opp / AttesteringDetalj_Edit)", () => {
    render(
      <RedigerMaskinRad
        organizationId="o1"
        rad={{ key: "k1", originalId: "m1", projectId: "p1", externalCostObjectId: null, vehicleId: "", fraTid: null, tilTid: null, timer: 2, mengde: null, enhet: null } as never}
        prosjekter={[{ id: "p1", name: "P1" }] as never}
        tidsrundingMinutter={null}
        onChange={() => {}}
        onSlett={() => {}}
      />,
    );
    expect(h.iVinduKall).toContain(true);
    expect(h.iVinduKall).not.toContain(undefined);
    // Prosjekt-nedtrekket ved siden av strekkes ikke til listas høyde.
    expect(document.querySelector("select")!.className).toMatch(/\bself-start\b/);
  });

  it("RedigerRadModal (Rediger maskin i attesteringen)", () => {
    h.data["timer.dagsseddel.hentForAttestering"] = {
      id: "s1", organizationId: "o1", ansatt: { id: "u1", name: "Ola", email: "ola@x", ansattnummer: null },
      prosjekt: { name: "P1" }, timer: [], tillegg: [], pauseFra: null, pauseTil: null,
      maskiner: [{ id: "m1", projectId: "p1", externalCostObjectId: null, vehicleId: "v1", fraTid: null, tilTid: null, timer: "2", mengde: null, enhet: null, attestertStatus: "pending" }],
    };
    h.data["maskin.equipment.list"] = UTSTYR;
    render(<RedigerRadModal sheetId="s1" projectId="p1" ecoId={null} onLukk={() => {}} />);
    expect(h.iVinduKall.length).toBeGreaterThan(0);
    expect(h.iVinduKall.every((v) => v === true)).toBe(true);
    // Raden sentrerer ikke feltene mot den åpne lista — de står øverst.
    const rad = document.querySelector("[data-testid=maskin-hoyst]")?.previousElementSibling
      ?? document.querySelector(".grid-cols-\\[80px_80px_1fr_80px_auto\\]");
    expect(rad!.className).toMatch(/\bitems-start\b/);
    expect(rad!.className).not.toMatch(/\bitems-center\b/);
  });
});

describe("§ 8.22 L1 — dagssiden: bare prosjektkort-modus", () => {
  const kilde = readFileSync(join(__dirname, "../app/dashbord/timer/[id]/page.tsx"), "utf-8");
  // Hvert <MaskinVelger …/>-kall på dagssiden, med 2500 tegn foran for å se hvilken del det står i.
  const kall = [...kilde.matchAll(/<MaskinVelger[\s\S]*?\/>/g)].map((m) => ({
    tekst: m[0],
    foran: kilde.slice(Math.max(0, m.index! - 2500), m.index!),
  }));

  it("tre kall: kortdelen og MaskinRadDialog gates på kortModus, dagskortdelen har ikke iVindu", () => {
    expect(kall).toHaveLength(3);
    const iKort = kall.filter((k) => /iVindu=\{!!kortModus\}/.test(k.tekst));
    const iDialog = kall.filter((k) => /iVindu=\{kortModus\}/.test(k.tekst));
    const uten = kall.filter((k) => !/iVindu/.test(k.tekst));
    expect(iKort).toHaveLength(1);
    expect(iDialog).toHaveLength(1);
    expect(uten).toHaveLength(1);
    // Kallet uten iVindu er maskin-delen for dagskort-modus i TimerRadDialog.
    expect(uten[0]!.foran).toMatch(/!kortModus && !rad && maskinAktiv/);
  });

  it("MaskinRadDialog får prosjektkortModus fra siden", () => {
    expect(kilde).toMatch(/<MaskinRadDialog[\s\S]*?kortModus=\{prosjektkortModus\}[\s\S]*?\/>/);
  });
});
