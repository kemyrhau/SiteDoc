/**
 * Enhetstester (vitest.config.ts) kjører rutene mot mockede Prisma-klienter. Kort-id-
 * tjenesten (services/timer/kortId.ts) gjør rå SQL og leser hele sedelen — det kan ikke en
 * mock bære, og den testes derfor mot ekte Postgres i `kortid-*.integration.test.ts`
 * (prosjektkort-kortid-spec § 9 T3–T9). Her byttes bare DB-delene ut; de rene funksjonene
 * (`kortIdForSkriving`, `radNokkel`) er ekte. Integrasjonskonfigen laster ikke denne fila.
 */
import { vi } from "vitest";

vi.mock("../services/timer/kortId", async (importOriginal) => {
  const ekte = await importOriginal<typeof import("../services/timer/kortId")>();
  return {
    ...ekte,
    lastSedelKortKontekst: vi.fn(async (_tx: unknown, sheetId: string) => ({
      sheetId,
      userId: "",
      dato: "",
      byggeplass: null,
    })),
    lastLagretKort: vi.fn(async () => new Map()),
    sikreKortId: vi.fn(async () => ({ brudd: [], kortIdFor: new Map() })),
    validerOppgittKortId: vi.fn(async () => undefined),
    kortIdPaaAnnenSedel: vi.fn(async () => []),
    vareKortIdForSkriving: vi.fn(async () => null),
  };
});
