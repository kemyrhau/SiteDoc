/**
 * Enkelt-kilde for hub-underlenkenes ruter (pålegg 3, K13).
 *
 * REN modul — ingen React/trpc/lucide-import — så BÅDE `useInnstillingerKort`
 * OG dekningstesten (`sok-dekning.test.ts`) kan lese herfra uten å dra inn
 * klient-modulgrafen. Ingen parallell kopi som kan drifte.
 *
 * `[prosjektId]` er placeholder for prosjekt-scopede ruter (byttes med faktisk
 * id i hooken; dekningstesten matcher mønsteret som det er).
 */
export const HUB_LENKER = {
  firmainfo: "/dashbord/firma/innstillinger",
  fakturering: "/dashbord/firma/fakturering",
  ansatte: "/dashbord/firma/ansatte",
  avdelinger: "/dashbord/firma/avdelinger",
  matrise: "/dashbord/firma/kompetanse",
  kalender: "/dashbord/firma/kalender",
  varelagerKatalog: "/dashbord/firma/varelager",
  varelagerImport: "/dashbord/firma/varelager/import",
  lonnsarter: "/dashbord/firma/timer/lonnsarter",
  aktiviteter: "/dashbord/firma/timer/aktiviteter",
  tillegg: "/dashbord/firma/timer/tillegg",
  timerOnboarding: "/dashbord/firma/timer",
  timerOppsett: "/dashbord/firma/timer/oppsett",
  maskinregister: "/dashbord/maskin",
  maskinImport: "/dashbord/maskin/import",
  hmsDashbord: "/dashbord/firma/hms",
  generelt: "/dashbord/oppsett/prosjektoppsett",
  byggeplasser: "/dashbord/oppsett/byggeplasser",
  mappeoppsett: "/dashbord/oppsett/produksjon/box",
  eierFirma: "/dashbord/oppsett/firma",
  moduler: "/dashbord/oppsett/produksjon/moduler",
  medlemmer: "/dashbord/oppsett/brukere",
  faggrupper: "/dashbord/[prosjektId]/faggrupper",
  sjekklistemaler: "/dashbord/oppsett/produksjon/sjekklistemaler",
  oppgavemaler: "/dashbord/oppsett/produksjon/oppgavemaler",
  psiMal: "/dashbord/oppsett/produksjon/psi",
  dokumentflyt: "/dashbord/oppsett/produksjon/dokumentflyt",
  aiSok: "/dashbord/oppsett/ai-sok",
} as const;

/** Alle hub-ruter (normaliserte mønstre) — dekningstesten leser denne (pålegg 3). */
export const HUB_RUTER: string[] = Object.values(HUB_LENKER);
