import { EmptyState } from "@siteflow/ui";

export default function BrukereSide() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Brukere</h2>
      <EmptyState
        title="Brukeradministrasjon"
        description="Her kan du administrere brukere og tilganger for prosjektet. Denne funksjonen er under utvikling."
      />
    </div>
  );
}
