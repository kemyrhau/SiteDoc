export interface PrintHeaderProps {
  prosjektnavn: string;
  prosjektnummer: string;
  eksterntNummer?: string | null;
  sjekklisteTittel: string;
  sjekklisteNummer?: string | null;
  oppretter?: string | null;
  oppretterBruker?: string | null;
  svarer?: string | null;
  vaerTekst?: string | null;
  logoUrl?: string | null;
  prosjektAdresse?: string | null;
  status?: string | null;
}

function logoSrc(url: string): string {
  if (url.startsWith("/uploads/")) return `/api/uploads${url.replace("/uploads", "")}`;
  return url;
}

export function PrintHeader({
  prosjektnavn,
  prosjektnummer,
  eksterntNummer,
  sjekklisteTittel,
  sjekklisteNummer,
  oppretter,
  oppretterBruker,
  svarer,
  vaerTekst,
  logoUrl,
  prosjektAdresse,
}: PrintHeaderProps) {
  const dato = new Date().toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="print-header mb-6 border border-gray-300">
      {/* Rad 1: Prosjekt med logo */}
      <div className="flex items-start justify-between border-b border-gray-300 px-4 py-2">
        <div className="flex items-start gap-4">
          {logoUrl && (
            <img
              src={logoSrc(logoUrl)}
              alt="Firmalogo"
              className="max-h-[60px] max-w-[120px] object-contain"
            />
          )}
          <div>
            <p className="text-base font-bold text-gray-900">{prosjektnavn}</p>
            <p className="text-xs text-gray-600">
              Prosjektnr: {prosjektnummer}
              {eksterntNummer && <> &middot; Ekst: {eksterntNummer}</>}
            </p>
            {prosjektAdresse && (
              <p className="text-xs text-gray-500">Adresse: {prosjektAdresse}</p>
            )}
          </div>
        </div>
        <p className="whitespace-nowrap text-xs text-gray-600">Dato: {dato}</p>
      </div>

      {/* Rad 2: Sjekkliste */}
      <div className="flex items-center justify-between border-b border-gray-300 px-4 py-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Sjekkliste: {sjekklisteTittel}
          </p>
          <p className="text-xs text-gray-600">
            {oppretter && (
              <>
                Oppretter: {oppretter}
                {oppretterBruker && ` (${oppretterBruker})`}
              </>
            )}
            {oppretter && svarer && <> &middot; </>}
            {svarer && <>Svarer: {svarer}</>}
          </p>
        </div>
        {sjekklisteNummer && (
          <p className="text-sm font-medium text-gray-700">
            Nr: {sjekklisteNummer}
          </p>
        )}
      </div>

      {/* Rad 3: Vær (kun hvis data finnes) */}
      {vaerTekst && (
        <div className="px-4 py-2">
          <p className="text-xs text-gray-600">Vær: {vaerTekst}</p>
        </div>
      )}
    </div>
  );
}
