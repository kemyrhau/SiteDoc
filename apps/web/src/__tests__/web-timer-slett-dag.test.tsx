// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent, cleanup } from "@testing-library/react";

/**
 * S1 (plan § 8.22): bekreftelsen før «Slett dagsseddel» lister alt som slettes, med antall, og
 * knappen «Slett dagen» vises bare når serveren sier at dagen kan slettes. Knappen for å åpne
 * vinduet vises bare på utkast (en returnert dag rettes og sendes på nytt).
 *
 * Negativkontroll: med develops vindu (bare «Er du sikker …?») finnes ingen liste; med
 * develops vakt (`returned && !attestertVed`) er kildesjekken nederst rød.
 */

type Oversikt = {
  innhold: { timer: number; reise: number; maskin: number; varer: number; tillegg: number; utlegg: number };
  kanSlettes: boolean;
  grunn: string | null;
};
const h = vi.hoisted(() => ({ oversikt: undefined as unknown, spurt: [] as unknown[] }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    timer: {
      dagsseddel: {
        slettOversikt: {
          useQuery: (input: unknown) => {
            h.spurt.push(input);
            return { data: h.oversikt, isLoading: false, error: null };
          },
        },
      },
    },
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "nb" } }),
}));

import { SlettDagModal } from "@/components/timer/SlettDagModal";

// jsdom har ikke <dialog>.showModal (Modal i @sitedoc/ui bruker den).
const dialogProto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
dialogProto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
dialogProto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const ID = "22222222-2222-2222-2222-222222222222";
function vis(oversikt: Oversikt, onBekreft = vi.fn()) {
  h.oversikt = oversikt;
  const r = render(
    <SlettDagModal sheetId={ID} overskrift="ingress" onClose={() => {}} onBekreft={onBekreft} sletter={false} feil={null} />,
  );
  return { ...r, onBekreft };
}

afterEach(cleanup);

describe("SlettDagModal", () => {
  it("lister det som slettes med antall, bare linjer over 0, i fast rekkefølge", () => {
    const { getByTestId, getByText, onBekreft } = vis({
      innhold: { timer: 3, reise: 1, maskin: 0, varer: 2, tillegg: 1, utlegg: 0 },
      kanSlettes: true,
      grunn: null,
    });
    expect(h.spurt.at(-1)).toEqual({ id: ID });
    const linjer = Array.from(getByTestId("slett-dag-innhold").querySelectorAll("li")).map((li) => li.textContent);
    expect(linjer).toEqual([
      "timer.slettDag.timer3",
      "timer.slettDag.varer2",
      "timer.slettDag.tillegg1",
      "timer.slettDag.reise1",
    ]);
    fireEvent.click(getByText("timer.slettDag.knapp"));
    expect(onBekreft).toHaveBeenCalledOnce();
  });

  it("tom dag: sier at ingenting er ført", () => {
    const { getByText } = vis({
      innhold: { timer: 0, reise: 0, maskin: 0, varer: 0, tillegg: 0, utlegg: 0 },
      kanSlettes: true,
      grunn: null,
    });
    expect(getByText("timer.slettDag.tom")).toBeTruthy();
  });

  it("kan ikke slettes: grunnen vises og «Slett dagen» er borte", () => {
    const grunn = "En returnert dag kan ikke slettes. Rett den og send den på nytt.";
    const { getByText, queryByText } = vis({
      innhold: { timer: 1, reise: 0, maskin: 0, varer: 0, tillegg: 0, utlegg: 0 },
      kanSlettes: false,
      grunn,
    });
    expect(getByText(grunn)).toBeTruthy();
    expect(queryByText("timer.slettDag.knapp")).toBeNull();
  });
});

describe("knappen vises bare på utkast (kilde)", () => {
  const les = (sti: string) => readFileSync(resolve(__dirname, "..", sti), "utf8");
  it("dagssiden og Mine timer slipper ikke en returnert dag gjennom", () => {
    const dagsside = les("app/dashbord/timer/[id]/page.tsx");
    const mine = les("app/dashbord/timer/mine/page.tsx");
    expect(dagsside).not.toMatch(/status === "returned" && !sheet\.attestertVed/);
    expect(mine).not.toMatch(/status === "returned" && !r\.attestertVed/);
    expect(dagsside).toMatch(/kanSlette=\{sheet\.status === "draft"\}/);
    expect(mine).toMatch(/const kanSlettes = \(r: ListeRad\) => r\.status === "draft";/);
    expect(dagsside.match(/<SlettDagModal/g)).toHaveLength(1);
    expect(mine.match(/<SlettDagModal/g)).toHaveLength(1);
  });
});
