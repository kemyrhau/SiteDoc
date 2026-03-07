import { redirect } from "next/navigation";
import { prisma } from "@sitedoc/db";
import { auth } from "@/auth";
import { InnloggingsKnapper } from "./InnloggingsKnapper";

export default async function AksepterInvitasjonSide({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <FeilSide
        tittel="Ugyldig lenke"
        melding="Invitasjonslenken mangler token. Sjekk at du brukte riktig lenke fra e-posten."
      />
    );
  }

  const invitasjon = await prisma.projectInvitation.findUnique({
    where: { token },
    include: {
      project: { select: { id: true, name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitasjon) {
    return (
      <FeilSide
        tittel="Invitasjon ikke funnet"
        melding="Denne invitasjonslenken er ugyldig. Den kan ha blitt trukket tilbake."
      />
    );
  }

  if (invitasjon.status === "accepted") {
    redirect(`/dashbord/${invitasjon.projectId}`);
  }

  if (invitasjon.expiresAt < new Date()) {
    return (
      <FeilSide
        tittel="Invitasjonen har utløpt"
        melding="Denne invitasjonen er ikke lenger gyldig. Be avsenderen sende en ny invitasjon."
      />
    );
  }

  // Sjekk om brukeren er innlogget
  const session = await auth();

  if (session?.user?.email?.toLowerCase() === invitasjon.email.toLowerCase()) {
    // Innlogget med riktig e-post → aksepter og redirect
    await prisma.projectInvitation.update({
      where: { id: invitasjon.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    redirect(`/dashbord/${invitasjon.projectId}`);
  }

  // Ikke innlogget (eller innlogget med feil e-post) → vis innloggingsknapper
  const redirectUrl = `/aksepter-invitasjon?token=${token}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-sitedoc-primary">
          SiteDoc
        </h1>
        <p className="mb-1 text-center text-sm text-gray-500">
          Du er invitert til prosjektet
        </p>
        <p className="mb-1 text-center text-lg font-semibold text-gray-900">
          {invitasjon.project.name}
        </p>
        {invitasjon.invitedBy.name && (
          <p className="mb-6 text-center text-sm text-gray-500">
            av {invitasjon.invitedBy.name}
          </p>
        )}

        <p className="mb-4 text-center text-sm text-gray-600">
          Logg inn med <strong>{invitasjon.email}</strong> for å akseptere:
        </p>

        <InnloggingsKnapper callbackUrl={redirectUrl} />
      </div>
    </main>
  );
}

function FeilSide({ tittel, melding }: { tittel: string; melding: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
        <h1 className="mb-2 text-2xl font-bold text-sitedoc-primary">
          SiteDoc
        </h1>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{tittel}</h2>
        <p className="mb-6 text-sm text-gray-500">{melding}</p>
        <a
          href="/logg-inn"
          className="inline-block rounded-lg bg-sitedoc-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-opacity-90"
        >
          Gå til innlogging
        </a>
      </div>
    </main>
  );
}
