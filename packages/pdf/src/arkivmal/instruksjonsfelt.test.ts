import { describe, it, expect } from "vitest";
import {
  byggInstruksjonstekst,
  byggInstruksjonsbilde,
  byggInstruksjonsvideo,
  byggQuiz,
  byggInstruksjonsfelt,
} from "./instruksjonsfelt";
import { byggInnhold } from "./innhold";
import type { TreObjekt, FeltVerdi, PdfConfig } from "../typer";

function obj(type: string, config: Record<string, unknown>, label = "Felt"): TreObjekt {
  return { id: `${type}-1`, type, label, required: false, config, sortOrder: 0, parentId: null } as TreObjekt;
}
const fv = (verdi: unknown): FeltVerdi => ({ verdi, kommentar: "", vedlegg: [] });
const CFG: PdfConfig = { bildeBaseUrl: "/api" };

describe("byggInstruksjonstekst (info_text)", () => {
  it("tekst → grå instruksjonsblokk med innholdet", () => {
    const html = byggInstruksjonstekst(obj("info_text", { content: "Les HMS-planen før oppstart." }, "Sikkerhet"));
    expect(html).toContain("ark-instruksjon");
    expect(html).toContain("Les HMS-planen før oppstart.");
    expect(html).toContain("Sikkerhet");
  });
  it("tom tekst → \"\" (ingen tom boks)", () => {
    expect(byggInstruksjonstekst(obj("info_text", { content: "   " }))).toBe("");
    expect(byggInstruksjonstekst(obj("info_text", {}))).toBe("");
  });
});

describe("byggInstruksjonsbilde (info_image)", () => {
  it("inlinet data-URI → embeddes med bildetekst", () => {
    const html = byggInstruksjonsbilde(
      obj("info_image", { imageUrl: "data:image/png;base64,ABC", caption: "Riktig verneutstyr" }),
    );
    expect(html).toContain("data:image/png;base64,ABC");
    expect(html).toContain("Riktig verneutstyr");
  });
  it("ikke-inlinet URL → bildetekst som kontekst, ingen nettverks-<img>", () => {
    const html = byggInstruksjonsbilde(
      obj("info_image", { imageUrl: "/api/uploads/x.jpg", caption: "Verneutstyr" }),
    );
    expect(html).toContain("Verneutstyr");
    expect(html).not.toContain("/api/uploads/x.jpg");
    expect(html).not.toContain("<img");
  });
  it("verken url eller caption → \"\"", () => {
    expect(byggInstruksjonsbilde(obj("info_image", {}))).toBe("");
  });
});

describe("byggInstruksjonsvideo (video)", () => {
  it("URL → referanselinje med tittel + URL", () => {
    const html = byggInstruksjonsvideo(obj("video", { url: "https://youtu.be/abc" }, "Opplæringsvideo"));
    expect(html).toContain("Opplæringsvideo");
    expect(html).toContain("https://youtu.be/abc");
  });
  it("eldre fileUrl-nøkkel støttes", () => {
    expect(byggInstruksjonsvideo(obj("video", { fileUrl: "/uploads/v.mp4" }))).toContain("/uploads/v.mp4");
  });
  it("tom URL → \"\"", () => {
    expect(byggInstruksjonsvideo(obj("video", {}))).toBe("");
  });
});

describe("byggQuiz (quiz) — dokumentasjonsdata", () => {
  const quizObj = obj(
    "quiz",
    { question: "Hva er første steg?", options: ["Ring 110", "Varsle nabo", "Fortsett"], correctIndex: 0 },
    "Kontrollspørsmål",
  );
  it("riktig svar avgitt → spørsmål + svar + (riktig) + fasit", () => {
    const html = byggQuiz(quizObj, fv(0));
    expect(html).toContain("Hva er første steg?");
    expect(html).toContain("Ring 110");
    expect(html).toContain("ark-quiz-rett");
    expect(html).toContain("Riktig svar: Ring 110");
  });
  it("feil svar → (feil)-markør + korrekt fasit vises fortsatt", () => {
    const html = byggQuiz(quizObj, fv(2));
    expect(html).toContain("Fortsett");
    expect(html).toContain("ark-quiz-feil");
    expect(html).toContain("Riktig svar: Ring 110");
  });
  it("ubesvart → «Ikke besvart» + fasit", () => {
    const html = byggQuiz(quizObj, fv(null));
    expect(html).toContain("Ikke besvart");
    expect(html).toContain("Riktig svar: Ring 110");
  });
  it("manglende correctIndex → default 0", () => {
    const html = byggQuiz(obj("quiz", { question: "Q", options: ["A", "B"] }), fv(1));
    expect(html).toContain("ark-quiz-feil"); // 1 ≠ default 0
  });
});

describe("byggInstruksjonsfelt (dispatcher) + innhold.ts-intercept", () => {
  it("ukjent type → null (kalleren faller til renderFelt)", () => {
    expect(byggInstruksjonsfelt(obj("text_field", {}), fv("x"))).toBeNull();
  });
  it("byggInnhold rendrer alle fire via override, ikke felt.ts-tomstreng", () => {
    const objekter: TreObjekt[] = [
      obj("info_text", { content: "Lesetekst" }),
      obj("video", { url: "https://v/1" }, "Video A"),
      obj("quiz", { question: "Q?", options: ["Ja", "Nei"], correctIndex: 1 }, "Q"),
    ];
    const data: Record<string, FeltVerdi> = { "quiz-1": fv(1) };
    const html = byggInnhold(objekter, data, CFG);
    expect(html).toContain("Lesetekst");
    expect(html).toContain("Video A");
    expect(html).toContain("Q?");
    expect(html).toContain("ark-quiz-rett");
  });
});
