import { MalListe } from "../_components/MalListe";

export default function SjekklistemalerSide() {
  return (
    <MalListe
      kategori="sjekkliste"
      tittel="Sjekklistemaler"
      opprettTekst="Ny sjekklistemal"
      tomTittel="Ingen sjekklistemaler"
      tomBeskrivelse="Opprett en sjekklistemal for å bygge sjekklister i prosjektet."
    />
  );
}
