// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { nb, type AnnoteringsLag } from "@sitedoc/shared";
import type { Vedlegg } from "../typer";

// BildeAnnotering (iframe/Fabric) mockes bort — vi tester FeltDokumentasjons
// lagrings-wiring, ikke tegnemotoren. Mocken fanger props og eksponerer
// Ferdig/Avbryt så vi kan utløse onFerdig/onAvbryt deterministisk.
let sisteProps: { bildeUrl: string; lag?: AnnoteringsLag } | null = null;
const PROVE_LAG: AnnoteringsLag = { fabricVersion: "5.3.1", bredde: 400, hoyde: 300, objekter: [{ type: "group" }] };
vi.mock("../BildeAnnotering", () => ({
  BildeAnnotering: (props: { bildeUrl: string; lag?: AnnoteringsLag; onFerdig: (d: string, l: AnnoteringsLag) => void; onAvbryt: () => void }) => {
    sisteProps = { bildeUrl: props.bildeUrl, lag: props.lag };
    return (
      <div>
        <button onClick={() => props.onFerdig("data:image/jpeg;base64," + btoa("XYZ"), PROVE_LAG)}>MOCK_FERDIG</button>
        <button onClick={() => props.onAvbryt()}>MOCK_AVBRYT</button>
      </div>
    );
  },
}));
vi.mock("../TegningsModal", () => ({ TegningsModal: () => null }));
vi.mock("@/components/SignertBilde", () => ({
  SignertBilde: (p: { url: string; alt?: string; onClick?: (e: unknown) => void; className?: string }) => (
    <img src={p.url} alt={p.alt ?? ""} onClick={p.onClick} className={p.className} />
  ),
  byggBildeSrc: (u: string) => u,
}));

import { FeltDokumentasjon } from "../FeltDokumentasjon";

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: "nb",
      fallbackLng: "nb",
      resources: { nb: { translation: nb as Record<string, string> } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  }
});

const fetchMock = vi.fn();
beforeEach(() => {
  sisteProps = null;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ fileUrl: "/uploads/privat/ny.jpg", fileName: "annotert.jpg" }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

const original: Vedlegg = { id: "v1", type: "bilde", url: "/uploads/privat/original.jpg?sig=abc", filnavn: "original.jpg" };

function setup(vedlegg: Vedlegg, ekstra?: { onOppdaterVedlegg?: ReturnType<typeof vi.fn> }) {
  const onOppdaterVedlegg = ekstra?.onOppdaterVedlegg ?? vi.fn();
  render(
    <FeltDokumentasjon
      kommentar=""
      vedlegg={[vedlegg]}
      onEndreKommentar={vi.fn()}
      onLeggTilVedlegg={vi.fn()}
      onFjernVedlegg={vi.fn()}
      onOppdaterVedlegg={onOppdaterVedlegg}
    />,
  );
  return { onOppdaterVedlegg };
}

function åpneAnnotering() {
  // Åpne lightbox (klikk thumbnail) → klikk «Annoter»
  fireEvent.click(screen.getAllByAltText("original.jpg")[0]!);
  fireEvent.click(screen.getByText(nb["felt.annoter"] as string));
}

describe("FeltDokumentasjon — bildeannotering (tre-artefakt-modellen)", () => {
  it("TEST 5 — avbryt uten å tegne skriver INGENTING (ingen opplasting, ingen patch)", async () => {
    const { onOppdaterVedlegg } = setup(original);
    åpneAnnotering();
    fireEvent.click(screen.getByText("MOCK_AVBRYT"));
    // Ingen skriving: verken opplasting eller vedlegg-oppdatering.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onOppdaterVedlegg).not.toHaveBeenCalled();
    // Annoteringsflaten er lukket igjen.
    expect(screen.queryByText("MOCK_FERDIG")).toBeNull();
  });

  it("TEST 1 — Ferdig laster opp utflatet JPEG og patcher vedlegget; originalUrl bevares", async () => {
    const { onOppdaterVedlegg } = setup(original);
    åpneAnnotering();
    fireEvent.click(screen.getByText("MOCK_FERDIG"));

    await waitFor(() => expect(onOppdaterVedlegg).toHaveBeenCalledTimes(1));
    // Opplasting gikk til privat-stien.
    expect(fetchMock).toHaveBeenCalledWith("/api/upload?privat=1", expect.objectContaining({ method: "POST" }));
    const [id, patch] = onOppdaterVedlegg.mock.calls[0]!;
    expect(id).toBe("v1");
    expect(patch.url).toBe("/uploads/privat/ny.jpg"); // utflatet JPEG
    expect(patch.originalUrl).toBe(original.url); // 🔴 originalen bevart
    expect(patch.annotering).toEqual(PROVE_LAG); // laget lagret
  });

  it("TEST 2 — gjenåpning av annotert bilde åpner på ORIGINALEN og sender laget", () => {
    const annotert: Vedlegg = { ...original, url: "/uploads/privat/annotert.jpg", originalUrl: original.url, annotering: PROVE_LAG };
    setup(annotert);
    // Klikk thumbnail (alt = original.jpg) → «Annoter»
    fireEvent.click(screen.getAllByAltText("original.jpg")[0]!);
    fireEvent.click(screen.getByText(nb["felt.annoter"] as string));
    expect(sisteProps?.bildeUrl).toBe(original.url); // ikke den utflatede
    expect(sisteProps?.lag).toEqual(PROVE_LAG);
    // «Annotert — kan redigeres»-indikator finnes (badge-title).
    expect(screen.getAllByTitle(nb["annotering.kanRedigeres"] as string).length).toBeGreaterThan(0);
  });

  it("TEST 4 — bakover: mobil-annotert bilde uten lag åpner på url, uten lag, uten feil", () => {
    const flatt: Vedlegg = { id: "v2", type: "bilde", url: "/uploads/privat/mobil.jpg", filnavn: "original.jpg" };
    setup(flatt);
    fireEvent.click(screen.getAllByAltText("original.jpg")[0]!);
    fireEvent.click(screen.getByText(nb["felt.annoter"] as string));
    expect(sisteProps?.bildeUrl).toBe(flatt.url);
    expect(sisteProps?.lag).toBeUndefined();
    // Ingen «kan redigeres»-indikator på et flatt bilde.
    expect(screen.queryByTitle(nb["annotering.kanRedigeres"] as string)).toBeNull();
  });
});
