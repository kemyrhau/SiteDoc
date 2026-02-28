export default function Hjem() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-siteflow-primary">
          SiteFlow
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Rapport- og kvalitetsstyringssystem for byggeprosjekter
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">Prosjekter</h2>
            <p className="text-sm text-gray-500">
              Opprett og administrer byggeprosjekter
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">Sjekklister</h2>
            <p className="text-sm text-gray-500">
              Bygg maler og fyll ut sjekklister
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">Oppgaver</h2>
            <p className="text-sm text-gray-500">
              Tildel og følg opp arbeidsoppgaver
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
