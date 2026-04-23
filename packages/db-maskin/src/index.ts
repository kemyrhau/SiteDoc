import { PrismaClient } from "../prisma/generated/client";

const globalForPrismaMaskin = globalThis as unknown as {
  prismaMaskin: PrismaClient | undefined;
};

export const prismaMaskin = globalForPrismaMaskin.prismaMaskin ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaMaskin.prismaMaskin = prismaMaskin;
}

export { PrismaClient, Prisma } from "../prisma/generated/client";
export type * from "../prisma/generated/client";
