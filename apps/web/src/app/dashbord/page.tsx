import { auth } from "@/auth";

export default async function DashbordSide() {
  const session = await auth();

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">
        Velkommen, {session?.user?.name ?? "bruker"}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-xl font-semibold">Prosjekter</h3>
          <p className="text-sm text-gray-500">
            Opprett og administrer byggeprosjekter
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-xl font-semibold">Sjekklister</h3>
          <p className="text-sm text-gray-500">
            Bygg maler og fyll ut sjekklister
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-xl font-semibold">Oppgaver</h3>
          <p className="text-sm text-gray-500">
            Tildel og følg opp arbeidsoppgaver
          </p>
        </div>
      </div>
    </div>
  );
}
