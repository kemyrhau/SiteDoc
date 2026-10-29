import { createContext, useContext } from "react";

// Skjemaets lagring, nådd fra annoteringseditoren dypt i feltene (ORDRE 3, F1b). En rå
// `originalUrl` kan bare signeres når serveren har den, så editoren sender ventende autolagring
// før den fornyer. Uten tilbyder (kamera utenfor skjema, mappedokument) lagres ingenting.
export interface SkjemaLagring {
  /** Ikke lesemodus og ikke låst (godkjent). */
  kanRedigere: boolean;
  /** Sender bare felt som avviker fra serveren; ingen serverrunde når ingenting avviker. */
  lagre: () => Promise<void>;
}

const SkjemaLagringContext = createContext<SkjemaLagring | null>(null);

export const SkjemaLagringProvider = SkjemaLagringContext.Provider;

export function useSkjemaLagring(): SkjemaLagring | null {
  return useContext(SkjemaLagringContext);
}
