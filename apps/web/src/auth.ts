import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@sitedoc/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
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
