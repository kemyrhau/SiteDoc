import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc/trpc";
import { randomUUID } from "crypto";

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const MICROSOFT_USERINFO_URL = "https://graph.microsoft.com/v1.0/me";

const providerSchema = z.enum(["google", "microsoft"]);

interface UserInfo {
  email: string;
  name: string | null;
  image: string | null;
  providerAccountId: string;
}

async function hentGoogleBrukerinfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Kunne ikke verifisere Google-token");
  }

  const data = (await res.json()) as {
    email: string;
    name?: string;
    picture?: string;
    sub: string;
  };
  return {
    email: data.email,
    name: data.name ?? null,
    image: data.picture ?? null,
    providerAccountId: data.sub,
  };
}

async function hentMicrosoftBrukerinfo(
  accessToken: string,
): Promise<UserInfo> {
  const res = await fetch(MICROSOFT_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Kunne ikke verifisere Microsoft-token");
  }

  const data = (await res.json()) as {
    mail?: string;
    userPrincipalName: string;
    displayName?: string;
    id: string;
  };
  return {
    email: data.mail ?? data.userPrincipalName,
    name: data.displayName ?? null,
    image: null,
    providerAccountId: data.id,
  };
}

export const mobilAuthRouter = router({
  /**
   * Bytt OAuth access_token fra mobil mot en sesjonstoken.
   * 1. Verifiser token mot provider (Google/Microsoft)
   * 2. Finn eller opprett bruker + account
   * 3. Opprett sesjon i databasen
   * 4. Returner sesjonstoken + brukerinfo
   */
  byttToken: publicProcedure
    .input(
      z.object({
        provider: providerSchema,
        accessToken: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Verifiser mot provider
      const brukerinfo =
        input.provider === "google"
          ? await hentGoogleBrukerinfo(input.accessToken)
          : await hentMicrosoftBrukerinfo(input.accessToken);

      // 2. Finn eller opprett bruker
      let bruker = await ctx.prisma.user.findUnique({
        where: { email: brukerinfo.email },
      });

      if (!bruker) {
        bruker = await ctx.prisma.user.create({
          data: {
            email: brukerinfo.email,
            name: brukerinfo.name,
            image: brukerinfo.image,
          },
        });
      }

      // 3. Finn eller opprett account-kobling
      const eksisterendeKonto = await ctx.prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: input.provider === "google" ? "google" : "microsoft-entra-id",
            providerAccountId: brukerinfo.providerAccountId,
          },
        },
      });

      if (!eksisterendeKonto) {
        await ctx.prisma.account.create({
          data: {
            userId: bruker.id,
            type: "oauth",
            provider: input.provider === "google" ? "google" : "microsoft-entra-id",
            providerAccountId: brukerinfo.providerAccountId,
            access_token: input.accessToken,
          },
        });
      }

      // 4. Opprett sesjon (30 dager)
      const sessionToken = randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);

      await ctx.prisma.session.create({
        data: {
          sessionToken,
          userId: bruker.id,
          expires,
        },
      });

      return {
        sessionToken,
        user: {
          id: bruker.id,
          name: bruker.name,
          email: bruker.email,
          image: bruker.image,
        },
      };
    }),

  /**
   * Verifiser at sesjonen er gyldig + forny utløpstid.
   * Lett endepunkt for mobilapp-oppstart (ingen tung data).
   */
  verifiser: protectedProcedure.query(async ({ ctx }) => {
    // Forny sesjonen med 30 nye dager ved aktiv bruk
    const sessionToken =
      ctx.req.headers.authorization?.replace("Bearer ", "") ?? null;

    if (sessionToken) {
      const nyUtloper = new Date();
      nyUtloper.setDate(nyUtloper.getDate() + 30);
      await ctx.prisma.session.updateMany({
        where: { sessionToken, userId: ctx.userId },
        data: { expires: nyUtloper },
      });
    }

    const bruker = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, image: true },
    });

    return { valid: true, user: bruker };
  }),
});
