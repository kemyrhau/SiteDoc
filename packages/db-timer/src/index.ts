import { PrismaClient } from ".prisma/timer-client";

const globalForPrismaTimer = globalThis as unknown as {
  prismaTimer: PrismaClient | undefined;
};

export const prismaTimer = globalForPrismaTimer.prismaTimer ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaTimer.prismaTimer = prismaTimer;
}

export { PrismaClient, Prisma } from ".prisma/timer-client";
export type * from ".prisma/timer-client";
