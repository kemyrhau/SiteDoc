import { describe, it, expect, beforeAll } from "vitest";
import i18next from "i18next";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@sitedoc/api/src/trpc/router";
import nb from "@sitedoc/shared/src/i18n/nb.json";
import { klientfeilLink } from "../klientfeil";

/**
 * Ordre 2026-11-05: nettverks- og innloggingsfeil får forståelig tekst i tRPC-klienten.
 * Kjører hele lenkekjeden (klientfeilLink → httpBatchLink) mot en falsk fetch, så testen
 * dekker feilene slik nettleseren faktisk leverer dem. Rød før fiksen: rå melding.
 */

const KONTAKT = nb["feil.ingenKontaktServer"];
const LOGGET_UT = nb["feil.loggetUt"];

beforeAll(async () => {
  await i18next.init({ lng: "nb", resources: { nb: { translation: nb } } });
});

function klientMed(fetch: () => Promise<Response>) {
  return createTRPCClient<AppRouter>({
    links: [klientfeilLink, httpBatchLink({ url: "http://test/trpc", fetch })],
  });
}

function trpcFeil(code: string, message: string, httpStatus: number) {
  return async () =>
    new Response(
      JSON.stringify([{ error: { message, code: -32000, data: { code, httpStatus } } }]),
      { status: httpStatus, headers: { "content-type": "application/json" } },
    );
}

async function feilmelding(fetch: () => Promise<Response>): Promise<string> {
  const err = await klientMed(fetch).organisasjon.hentMineMedlemskap.query().catch((e: Error) => e);
  if (!(err instanceof Error)) throw new Error("forventet feil");
  return err.message;
}

describe("klientfeilLink — forståelig tekst", () => {
  it.each(["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."])(
    "🔴 nettverksfeil «%s» → ingen kontakt med serveren",
    async (melding) => {
      expect(await feilmelding(async () => { throw new TypeError(melding); })).toBe(KONTAKT);
    },
  );

  it.each([502, 503, 504])("🔴 %i fra proxyen uten tRPC-kropp → ingen kontakt", async (status) => {
    expect(await feilmelding(async () => new Response("<html>Bad Gateway</html>", { status }))).toBe(KONTAKT);
    expect(await feilmelding(async () => new Response("", { status }))).toBe(KONTAKT);
  });

  it("🔴 UNAUTHORIZED → logget ut", async () => {
    expect(await feilmelding(trpcFeil("UNAUTHORIZED", "Du må være innlogget for å utføre denne handlingen", 401)))
      .toBe(LOGGET_UT);
  });

  it("serverens egne meldinger slipper gjennom uendret", async () => {
    expect(await feilmelding(trpcFeil("FORBIDDEN", "Kan ikke endre systemadministrator", 403)))
      .toBe("Kan ikke endre systemadministrator");
    expect(await feilmelding(trpcFeil("BAD_REQUEST", "Ugyldig dato", 400))).toBe("Ugyldig dato");
  });

  it("andre klientfeil (ikke nettverk) slipper gjennom uendret", async () => {
    expect(await feilmelding(async () => { throw new TypeError("x is not a function"); }))
      .toBe("x is not a function");
  });
});
