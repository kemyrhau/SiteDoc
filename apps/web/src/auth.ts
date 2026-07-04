import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@sitedoc/db";

// getUserByEmail-overstyring: filtrer på canLogin=true (utelukk deaktiverte
// brukere fra e-post-basert innloggingsoppslag) + deterministisk eldste-først
// rekkefølge. Merk: User.email er globalt unik (@unique) — den tidligere
// composite-unikheten (@@unique([email, organizationId])) ble droppet i O-5c
// 2026-05-13, så det er ikke lenger grunnen til overstyringen.
//
// Case-insensitivt (mode: "insensitive"): Fix A 2026-07-04 (split-identitet
// mobil↔web). PrismaAdapters e-post-kobling skjer via denne metoden; et
// case-sensitivt oppslag (default) fant IKKE en eksisterende User når
// providers casing avvek (mobil lagret Graph-`userPrincipalName` med blandet
// case, web fikk lowercase) → Auth.js opprettet en DUPLIKAT User i stedet for
// å koble den nye kontoen til den eksisterende. Nå matcher denne metoden
// signIn-guarden (:89) og mobil (mobilAuth.ts:104) som allerede er
// case-insensitive + eldste-først.
const baseAdapter = PrismaAdapter(prisma);
baseAdapter.getUserByEmail = async (email: string) => {
  const bruker = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, canLogin: true },
    orderBy: { createdAt: "asc" },
  });
  // PrismaAdapter forventer AdapterUser med name/email/emailVerified/image-felter
  return bruker as unknown as Awaited<ReturnType<NonNullable<typeof baseAdapter.getUserByEmail>>>;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: baseAdapter,
  session: {
    strategy: "database",
    maxAge: 24 * 60 * 60, // 24 timer
    updateAge: 60 * 60, // forny ved aktivitet hver time
  },
  providers: [
    // allowDangerousEmailAccountLinking: true — lar bruker logge inn med
    // ENTEN Google eller Microsoft 365 på samme e-post og lande på samme
    // konto. Trygt her fordi BEGGE tilbydere verifiserer e-post-eierskap;
    // den klassiske konto-overtakelse-vektoren (useriøs tilbyder som ikke
    // verifiserer e-post) gjelder ikke. Reverserer H3-audit 2026-05-27.
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
            // Se kommentar over Google-tilbyderen — samme begrunnelse.
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
    // Kvalitetssikring (2026-06-05): hindre at vilkårlige OAuth-pålogginger
    // oppretter tomme orphan-kontoer som «låser» e-poster (jf. Mathias/Malin
    // som logget inn med privat Gmail i stedet for invitert jobb-e-post →
    // tomme kontoer uten firma/prosjekt som blokkerte korrekt invitasjon).
    // Slipp KUN gjennom hvis bruker er invitert/eksisterende eller allerede
    // koblet. Returnerer false → Auth.js oppretter IKKE bruker, og sender til
    // /logg-inn?error=AccessDenied (vises som auth.feil.AccessDenied).
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      // (c) Returnerende bruker med allerede koblet OAuth-konto — slå opp via
      // provider-kobling, IKKE e-post. Kritisk: en e-postendring i DB skal
      // ikke låse ute en eksisterende bruker hvis tilbyderen hevder gammel
      // e-post (koblingen ligger på provider+providerAccountId).
      if (account?.provider && account.providerAccountId) {
        const koblet = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { userId: true },
        });
        if (koblet) return true;
      }

      // (a) Eksisterende canLogin-bruker på e-posten (case-insensitiv).
      // Innstramming (sak #2 2026-07-04): slipp KUN gjennom hvis brukeren
      // faktisk har en tilknytning — (d) sitedoc_admin (org-løs, må slippe
      // inn), OrganizationMember eller ProjectMember. En bruker fjernet fra
      // alle firma/prosjekt avvises ved neste innlogging (ønsket bivirkning).
      // company_admin dekkes av OrganizationMember (hentBrukersOrg leser kun
      // derfra). En canLogin-bruker uten tilknytning faller gjennom til
      // invitasjons-sjekken (b). Case-insensitiv er trygt: tilbyderen har
      // verifisert eierskap til e-postadressen.
      const eksisterende = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, canLogin: true },
        select: {
          role: true,
          _count: { select: { organizationMembers: true, projects: true } },
        },
      });
      if (
        eksisterende &&
        (eksisterende.role === "sitedoc_admin" ||
          eksisterende._count.organizationMembers > 0 ||
          eksisterende._count.projects > 0)
      ) {
        return true;
      }

      // (b) Ventende invitasjon på e-posten. Streng lowercase-equals — samme
      // som events.signIn (invitasjoner normaliseres til lowercase ved
      // opprettelse), unngår case-folding-vektoren lukket 2026-05-27.
      const invitasjon = await prisma.projectInvitation.findFirst({
        where: { email, status: "pending" },
        select: { id: true },
      });
      if (invitasjon) return true;

      // Ikke invitert → nekt. Ingen User opprettes, e-posten forblir fri.
      return false;
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Auto-aksepter ventende invitasjoner for denne e-posten.
      // Streng equals mot lowercase — invitasjoner normaliseres til lowercase
      // ved opprettelse (medlem.ts, gruppe.ts). mode: "insensitive" var
      // sårbar mot case-folding-vektor (JOHN@x.com-invitasjon kunne matche
      // john@x.com-Google-konto opprettet av angriper). Lukket 2026-05-27.
      if (user.email) {
        await prisma.projectInvitation.updateMany({
          where: {
            email: user.email.toLowerCase(),
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
