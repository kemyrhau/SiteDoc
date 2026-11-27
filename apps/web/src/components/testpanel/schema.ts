import { z } from "zod";

/**
 * Testpanel (lokal testflate, kun dev). Fil-schema for én testrunde:
 * agenten skriver plan + `agentSa`/`agentVurdering`; panelet skriver kun
 * `kenneth` og setter `status`. Se docs/claude/lokal-dev.md § 7 «Testpanel».
 */

export const vurderingSchema = z.enum(["godkjent", "avvik"]);
export type Vurdering = z.infer<typeof vurderingSchema>;

export const stegStatusSchema = z.enum(["venter_agent", "venter_kenneth", "ferdig"]);

const kennethSvarSchema = z.object({
  vurdering: vurderingSchema,
  merknad: z.string(),
  forbedring: z.string(),
  tid: z.string().datetime(),
});

/** Element agenten skal klikke neste gang. Tekst (synlig tekst / aria-label) er hovedveien, selektor reserve. */
export const markeringSchema = z.union([
  z.object({ tekst: z.string().min(1) }).strict(),
  z.object({ selektor: z.string().min(1) }).strict(),
]);
export type Markering = z.infer<typeof markeringSchema>;

const forbedringSchema = z.object({ tekst: z.string().min(1), tid: z.string().datetime() });

export const stegSchema = z
  .object({
    nr: z.number().int().positive(),
    hvaTestes: z.string(),
    handling: z.string(),
    forventet: z.string(),
    agentSa: z.string().nullable(),
    agentVurdering: vurderingSchema.nullable(),
    status: stegStatusSchema,
    kenneth: kennethSvarSchema.nullable(),
    markering: markeringSchema.nullable().optional(),
    forbedringer: z.array(forbedringSchema).optional(),
  })
  .superRefine((s, ctx) => {
    if ((s.status === "ferdig") !== (s.kenneth !== null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "status «ferdig» krever kenneth-svar, og kun da",
      });
    }
    if (s.kenneth && !kanNeste(s.kenneth.vurdering, s.kenneth.merknad)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "avvik krever merknad" });
    }
  });
export type Steg = z.infer<typeof stegSchema>;

export const rundeSchema = z
  .object({
    runde: z.string().min(1),
    hash: z.string().regex(/^[0-9a-f]{7,40}$/),
    steg: z.array(stegSchema).min(1),
    pause: z.boolean().optional(),
    agentNaa: z.string().nullable().optional(),
  })
  .superRefine((r, ctx) => {
    const nr = r.steg.map((s) => s.nr);
    if (new Set(nr).size !== nr.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "steg.nr må være unike" });
    }
  });
export type Runde = z.infer<typeof rundeSchema>;

export const aktivSchema = z.object({
  fil: z.string().regex(/^[a-z0-9-]+\.json$/),
});

/** POST fra panelet. `type` er påkrevd; panelet er eneste klient. */
export const postSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("svar"),
      nr: z.number().int().positive(),
      vurdering: vurderingSchema,
      merknad: z.string().default(""),
      forbedring: z.string().default(""),
    }),
    z.object({ type: z.literal("pause"), pause: z.boolean() }),
    z.object({
      type: z.literal("forbedring"),
      nr: z.number().int().positive(),
      tekst: z.string().refine((t) => t.trim().length > 0, "forbedring kan ikke være tom"),
    }),
  ])
  .superRefine((p, ctx) => {
    if (p.type === "svar" && !kanNeste(p.vurdering, p.merknad)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "avvik krever merknad" });
    }
  });
export type Post = z.infer<typeof postSchema>;
export type Svar = Extract<Post, { type: "svar" }>;

/** Neste er åpen når en vurdering er valgt, og ved avvik kun med utfylt merknad. Forbedring påvirker aldri. */
export function kanNeste(vurdering: Vurdering | null, merknad: string): boolean {
  if (!vurdering) return false;
  if (vurdering === "avvik") return merknad.trim().length > 0;
  return true;
}

/** Aktivt steg = laveste nr som ikke er ferdig; null når runden er ferdig. */
export function aktivtSteg(runde: Runde): Steg | null {
  return [...runde.steg].sort((a, b) => a.nr - b.nr).find((s) => s.status !== "ferdig") ?? null;
}

/** Felles vilkår for panel og rute. Leses på kjøretid i ruten, inlines ved bygg i klienten. */
export function testpanelPå(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SITEDOC_TESTPANEL === "1"
  );
}
