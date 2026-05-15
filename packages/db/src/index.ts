import { PrismaClient } from "@prisma/client";

export {
  krypter,
  dekrypter,
  verifiserKrypteringsKonfig,
  IntegrationEncryptionError,
} from "./encryption";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient, Prisma } from "@prisma/client";
export type * from "@prisma/client";

export { beregnNorskeHelligdager } from "./seed/helligdager";
export type { Helligdag } from "./seed/helligdager";
