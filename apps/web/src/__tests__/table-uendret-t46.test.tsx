// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { Table, type KolonneHode } from "@sitedoc/ui";

/**
 * T46 (spec prosjektkort-kortid § 12.7, ordre d2b-1): hodets verktøy (sorterpil,
 * filternedtrekk, bredde-håndtak) løftes ut av `Table` til delte deler som også
 * `TimerRadTabell` bruker. Sjekklister, oppgaver, HMS, mapper og faggrupper skal
 * tegne NØYAKTIG det samme som før: ingen ny rad, ingen endret overskrift, samme
 * norske tekst i filteret.
 *
 * Fasiten (`__snapshots__/table-t46.html`) ble skrevet av denne testen på koden
 * FØR løftet (develop @ d2b-1-start). Endres HTML-en, er det en endring for de
 * fem sidene — ikke oppdater snapshotet uten ordre.
 */

type Rad = { id: string; navn: string; status: string; tall: number | null };
const data: Rad[] = [
  { id: "a", navn: "Bærum", status: "sent", tall: 2 },
  { id: "b", navn: "Asker", status: "draft", tall: null },
];
const kolonner = [
  { id: "navn", header: "Navn", celle: (r: Rad) => r.navn, sorterbar: true, sorterVerdi: (r: Rad) => r.navn },
  {
    id: "status", header: "Status", celle: (r: Rad) => r.status, bredde: "120px",
    filtrerbar: true,
    filterAlternativer: [{ value: "sent", label: "Sendt" }, { value: "draft", label: "Utkast" }],
    filterSnarveier: [{ label: "Åpne", verdier: ["sent", "draft"] }],
  },
  { id: "tall", header: "Tall", celle: (r: Rad) => r.tall ?? "", sorterbar: true, sorterVerdi: (r: Rad) => r.tall },
];
const props = {
  kolonner, data, radNokkel: (r: Rad) => r.id,
  velgbar: true, valgteRader: new Set(["b"]), onValgEndring: () => {},
  filterVerdier: { status: "sent" }, onFilterEndring: () => {},
  kolonneBredder: { navn: 200 }, onKolonneBreddeEndring: () => {},
};

afterEach(cleanup);

describe("T46 — Table tegner det samme etter at hodets verktøy er løftet ut", () => {
  it("HTML-en er lik fasiten fra før løftet (alle fem sidenes funksjoner: velg, sorter, filter, bredde)", async () => {
    const html = renderToString(<Table {...props} />);
    await expect(html).toMatchFileSnapshot("./__snapshots__/table-t46.html");
  });

  it("renderKolonneHode (flyttbare kolonner i sjekklister/oppgaver) får samme hode-innhold", async () => {
    const hode = (h: KolonneHode) => <th key={h.kolonneId} {...h.thProps} data-flytt={h.kolonneId}>{h.innhold}</th>;
    const html = renderToString(<Table {...props} renderKolonneHode={hode} />);
    await expect(html).toMatchFileSnapshot("./__snapshots__/table-t46-flytt.html");
  });

  it("tom tabell viser samme norske tekst", () => {
    expect(renderToString(<Table {...props} data={[]} />)).toContain("Ingen data å vise");
  });

  it("filteret har samme norske tekst: «Filtrer» på ikonet, «Alle» øverst, snarvei og valg under", () => {
    const { container, getByTitle, getByText } = render(<Table {...props} />);
    fireEvent.click(getByTitle("Filtrer"));
    const knapper = Array.from(container.querySelectorAll("thead button, thead label")).map((e) => e.textContent?.trim());
    expect(knapper).toEqual(["", "Alle", "Åpne", "Sendt", "Utkast"]);
    expect(getByText("Alle")).toBeTruthy();
  });

  it("sortering: klikk gir pil opp, nytt klikk pil ned, og radrekkefølgen følger", () => {
    const { container, getByText } = render(<Table {...props} />);
    const rader = () => Array.from(container.querySelectorAll("tbody tr")).map((tr) => tr.textContent);
    fireEvent.click(getByText("Navn"));
    expect(container.querySelector("thead svg path")?.getAttribute("d")).toBe("M18 15l-6-6-6 6");
    expect(rader()).toEqual(["Askerdraft", "Bærumsent2"]);
    fireEvent.click(getByText("Navn"));
    expect(container.querySelector("thead svg path")?.getAttribute("d")).toBe("M6 9l6 6 6-6");
    expect(rader()).toEqual(["Bærumsent2", "Askerdraft"]);
  });

  it("bredde-dragning: håndtaket gir ny bredde til onKolonneBreddeEndring", () => {
    let lagret: Record<string, number> | null = null;
    const { container } = render(<Table {...props} onKolonneBreddeEndring={(b) => { lagret = b; }} />);
    const th = container.querySelectorAll("thead th")[1] as HTMLElement;
    Object.defineProperty(th, "offsetWidth", { value: 200 });
    const handtak = th.querySelector("div.cursor-col-resize") as HTMLElement;
    fireEvent.mouseDown(handtak, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 150 });
    fireEvent.mouseUp(document);
    expect(lagret).toEqual({ navn: 250 });
  });

  it("de fem sidene bruker fortsatt Table fra @sitedoc/ui uten nye tekst-props", () => {
    const rot = resolve(__dirname, "..");
    for (const fil of [
      "app/dashbord/[prosjektId]/faggrupper/page.tsx",
      "app/dashbord/[prosjektId]/mapper/page.tsx",
      "app/dashbord/[prosjektId]/oppgaver/page.tsx",
      "app/dashbord/[prosjektId]/sjekklister/page.tsx",
      "components/hms/tabeller.tsx",
    ]) {
      const kilde = readFileSync(resolve(rot, fil), "utf8");
      expect(kilde, fil).toMatch(/import \{[^}]*\bTable\b[^}]*\} from "@sitedoc\/ui"/);
      expect(kilde, fil).not.toMatch(/<Table[^>]*\btekster=/);
    }
  });
});
