import { EmptyState } from "@siteflow/ui";

export default function LokasjonerSide() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Lokasjoner</h2>
      <EmptyState
        title="Lokasjoner"
        description="Her kan du administrere lokasjoner og bygninger for prosjektet. Denne funksjonen er under utvikling."
      />
    </div>
  );
}
