import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@sitedoc/db";

// Per B.7 Fase 0 minimum: email er ikke lenger globalt unique (composite
// @@unique([email, organizationId])). PrismaAdapter.getUserByEmail bruker
// findUnique, som krever globalt unique-felt. Override til findFirst med
// canLogin=true filter og deterministisk eldste-først ordering.
const baseAdapter = PrismaAdapter(prisma);
baseAdapter.getUserByEmail = async (email: string) => {
  const bruker = await prisma.user.findFirst({
    where: { email, canLogin: true },
    orderBy: { createdAt: "asc" },
  });
  // PrismaAdapter forventer AdapterUser med name/email/emailVerified/image-felter
  return bruker as unknown as Awaited<ReturnType<NonNullable<typeof baseAdapter.getUserByEmail>>>;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: baseAdapter,
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
            allowDangerousEmailAccountLinking: true,
            authorization: { params: { scope: "openid profile email" } },
            checks: ["state"],
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/logg-inn",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Auto-aksepter ventende invitasjoner for denne e-posten
      if (user.email) {
        await prisma.projectInvitation.updateMany({
          where: {
            email: { equals: user.email, mode: "insensitive" },
            status: "pending",
          },
          data: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        });
      }
    },
  },
});
