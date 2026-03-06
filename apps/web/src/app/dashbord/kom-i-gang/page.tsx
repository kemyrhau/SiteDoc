"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, Button } from "@sitedoc/ui";
import { CheckCircle, Building2, Users, ClipboardCheck } from "lucide-react";

const FUNKSJONER = [
  {
    ikon: Building2,
    tittel: "Prosjektstyring",
    beskrivelse: "Opprett og administrer byggeprosjekter med full oversikt",
  },
  {
    ikon: ClipboardCheck,
    tittel: "Sjekklister og oppgaver",
    beskrivelse: "Strukturerte maler med 23 felttyper og entrepriseflyt",
  },
  {
    ikon: Users,
    tittel: "Samarbeid",
    beskrivelse: "Inviter brukere, tildel roller og styr tilgang per entreprise",
  },
];

export default function KomIGangSide() {
  const router = useRouter();
  const { data: session } = useSession();

  function handleAktiver() {
    router.push("/dashbord/nytt-prosjekt");
  }

  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Velkommen til SiteDoc
          </h1>
          <p className="mt-2 text-gray-500">
            {session?.user?.name
              ? `Hei, ${session.user.name}!`
              : "Hei!"}{" "}
            Kom i gang med ditt første prosjekt.
          </p>
        </div>

        <div className="mb-8 grid gap-4">
          {FUNKSJONER.map((f) => (
            <Card key={f.tittel} className="flex flex-row items-start gap-4">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <f.ikon className="h-5 w-5 text-sitedoc-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{f.tittel}</h3>
                <p className="text-sm text-gray-500">{f.beskrivelse}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="text-center">
          <div className="mb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Gratis prøveperiode
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Prøv SiteDoc gratis i 30 dager. Ingen betalingsinformasjon kreves.
            </p>
          </div>
          <Button onClick={handleAktiver} className="w-full">
            Start gratis prøveperiode
          </Button>
        </Card>
      </div>
    </main>
  );
}
