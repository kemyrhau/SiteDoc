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

export const svarSchema = z
  .object({
    nr: z.number().int().positive(),
    vurdering: vurderingSchema,
    merknad: z.string().default(""),
    forbedring: z.string().default(""),
  })
  .refine((s) => kanNeste(s.vurdering, s.merknad), { message: "avvik krever merknad" });
export type Svar = z.infer<typeof svarSchema>;

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
