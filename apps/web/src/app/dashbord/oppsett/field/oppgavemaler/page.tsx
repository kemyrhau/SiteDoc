import { MalListe } from "../_components/MalListe";

export default function OppgavemalerSide() {
  return (
    <MalListe
      kategori="oppgave"
      tittel="Oppgavemaler"
      opprettTekst="Ny oppgavemal"
      tomTittel="Ingen oppgavemaler"
      tomBeskrivelse="Opprett en oppgavemal for å definere oppgavetyper i prosjektet."
    />
  );
}
