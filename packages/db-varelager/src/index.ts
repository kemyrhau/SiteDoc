import { PrismaClient } from ".prisma/varelager-client";

const globalForPrismaVarelager = globalThis as unknown as {
  prismaVarelager: PrismaClient | undefined;
};

export const prismaVarelager = globalForPrismaVarelager.prismaVarelager ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaVarelager.prismaVarelager = prismaVarelager;
}

export { PrismaClient, Prisma } from ".prisma/varelager-client";
export type * from ".prisma/varelager-client";
