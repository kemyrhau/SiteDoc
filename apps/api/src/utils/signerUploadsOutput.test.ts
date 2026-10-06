import { describe, it, expect } from "vitest";
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { signerUploadsOutput, signerOutputHvisQuery } from "./signerUploadsOutput";

/**
 * Kontrakt for den sentrale `/uploads/`-output-signeringen (S1 Fase 1b).
 *
 * Tre lag testes:
 *  1. `signerUploadsOutput` — den type-bevarende dyp-signeringen.
 *  2. `signerOutputHvisQuery` — query-vs-mutasjon-grensen (D1-vernet).
 *  3. Ende-til-ende via en EKTE tRPC-middleware — beviset på DEFAULT-PÅ (§4):
 *     en query-prosedyre som returnerer en RÅ `/uploads/`-URL kommer ut signert
 *     UTEN at resolveren la til et signeringskall.
 */

const erSignert = (u: string) => /\?exp=\d+&sig=/.test(u);

describe("signerUploadsOutput — type-bevarende dyp signering", () => {
  it("signerer ethvert /uploads/-strengfelt uansett feltnavn, dypt nestet", () => {
    const ut = signerUploadsOutput({
      fileUrl: "/uploads/privat/a.jpg",
      thumbnailUrl: "/uploads/apen.png",
      nested: { rader: [{ originalFileUrl: "/uploads/b.dwg" }] },
      ekstern: "https://cdn/x.jpg",
      tekst: "ikke en url",
    }) as Record<string, unknown>;
    expect(erSignert(ut.fileUrl as string)).toBe(true);
    expect(erSignert(ut.thumbnailUrl as string)).toBe(true);
    expect(erSignert((ut.nested as { rader: { originalFileUrl: string }[] }).rader[0]!.originalFileUrl)).toBe(true);
    expect(ut.ekstern).toBe("https://cdn/x.jpg"); // ekstern/absolutt urørt
    expect(ut.tekst).toBe("ikke en url");
  });

  it("🔴 bevarer Date, klasse-instanser og andre ikke-rene typer (ingen `{}`-rekonstruksjon)", () => {
    class Decimal {
      constructor(public verdi: string) {}
    }
    const dato = new Date("2026-09-24T10:00:00Z");
    const dec = new Decimal("140.5");
    const buf = Buffer.from("x");
    const ut = signerUploadsOutput({
      opprettet: dato,
      belop: dec,
      data: buf,
      url: "/uploads/privat/a.jpg",
    }) as Record<string, unknown>;
    expect(ut.opprettet).toBeInstanceOf(Date);
    expect((ut.opprettet as Date).toISOString()).toBe("2026-09-24T10:00:00.000Z");
    expect(ut.belop).toBeInstanceOf(Decimal);
    expect((ut.belop as Decimal).verdi).toBe("140.5");
    expect(Buffer.isBuffer(ut.data)).toBe(true);
    expect(erSignert(ut.url as string)).toBe(true);
  });

  it("🔴 muterer ALDRI input (dyp kopi kun langs endret sti)", () => {
    const input = { a: { url: "/uploads/privat/a.jpg" }, tall: 5 };
    const ut = signerUploadsOutput(input) as typeof input;
    expect(input.a.url).toBe("/uploads/privat/a.jpg"); // original uendret
    expect(erSignert(ut.a.url)).toBe(true);
    expect(ut).not.toBe(input);
    expect(ut.a).not.toBe(input.a);
  });

  it("🔴 idempotent: alt signerte URL-er dobbeltsigneres ikke", () => {
    const engang = signerUploadsOutput({ url: "/uploads/privat/a.jpg" }) as { url: string };
    const togang = signerUploadsOutput(engang) as { url: string };
    expect(togang.url).toBe(engang.url);
    expect((togang.url.match(/sig=/g) ?? []).length).toBe(1);
  });

  it("skalar/null/undefined returneres uendret", () => {
    expect(signerUploadsOutput(null)).toBeNull();
    expect(signerUploadsOutput(undefined)).toBeUndefined();
    expect(signerUploadsOutput(42)).toBe(42);
    expect(signerUploadsOutput("/uploads/x.jpg")).toMatch(/\?exp=\d+&sig=/);
  });
});

describe("signerOutputHvisQuery — D1: KUN queries signeres, aldri mutasjoner", () => {
  const rå = { ok: true as const, marker: Symbol("m"), data: { fileUrl: "/uploads/privat/a.jpg" } };

  it("query-output signeres", () => {
    const ut = signerOutputHvisQuery("query", rå);
    expect(erSignert((ut.data as { fileUrl: string }).fileUrl)).toBe(true);
  });

  it("🔴 mutasjon-output signeres IKKE (D1: den farlige lagre-tilbake-veien)", () => {
    const ut = signerOutputHvisQuery("mutation", rå);
    expect((ut.data as { fileUrl: string }).fileUrl).toBe("/uploads/privat/a.jpg");
    expect(erSignert((ut.data as { fileUrl: string }).fileUrl)).toBe(false);
  });

  it("feil-resultat (ok=false) røres ikke", () => {
    const feil = { ok: false as const, marker: Symbol("m") };
    expect(signerOutputHvisQuery("query", feil)).toBe(feil);
  });
});

describe("🔴 DEFAULT-PÅ-bevis (§4): rå /uploads/-URL kommer ut signert uten et kall", () => {
  // Bygg en EKTE tRPC-instans med NØYAKTIG samme middleware som prod (trpc.ts):
  //   t.middleware(async ({ type, next }) => signerOutputHvisQuery(type, await next()))
  const t = initTRPC.create();
  const signering = t.middleware(async ({ type, next }) => signerOutputHvisQuery(type, await next()));
  const proc = t.procedure.use(signering);

  // Resolverne under legger ALDRI til et signeringskall — de returnerer råe URL-er.
  const router = t.router({
    // Merk: `nyRute` simulerer en fremtidig rute forfatteren glemte å signere.
    nyRute: proc.query(() => ({ fileUrl: "/uploads/privat/glemt.jpg", tekst: "hei" })),
    lagreRute: proc
      .input(z.object({ fileUrl: z.string() }))
      .mutation(({ input }) => ({ fileUrl: input.fileUrl })),
  });
  const caller = router.createCaller({});

  it("en glemt query-rute får signaturen automatisk (opt-in-hullet fra 15.08 kan ikke gjenta seg)", async () => {
    const ut = await caller.nyRute();
    expect(erSignert(ut.fileUrl)).toBe(true);
    expect(ut.fileUrl.startsWith("/uploads/privat/glemt.jpg?")).toBe(true);
    expect(ut.tekst).toBe("hei"); // ikke-url urørt
  });

  it("en mutasjon som lagrer klient-URL får den UENDRET tilbake (ingen forgiftning)", async () => {
    const ut = await caller.lagreRute({ fileUrl: "/uploads/privat/lagret.jpg" });
    expect(ut.fileUrl).toBe("/uploads/privat/lagret.jpg");
    expect(erSignert(ut.fileUrl)).toBe(false);
  });
});
