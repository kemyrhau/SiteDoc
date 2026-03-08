import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  ClipboardCheck,
  CheckSquare,
  FileText,
  Camera,
  MapPin,
  WifiOff,
  Shield,
  Building2,
  Users,
  Monitor,
  Smartphone,
  ArrowRight,
  CloudSun,
  Layers,
  Check,
  Send,
  CircleDot,
  Printer,
  GripVertical,
  ChevronRight,
} from "lucide-react";

export default async function Hjem() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashbord");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigasjon */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#0f1b3d]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-white tracking-wide">
            SiteDoc
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#funksjoner"
              className="hidden text-sm text-blue-200/80 transition hover:text-white sm:block"
            >
              Funksjoner
            </a>
            <a
              href="#plattform"
              className="hidden text-sm text-blue-200/80 transition hover:text-white sm:block"
            >
              Plattform
            </a>
            <a
              href="#arbeidsflyt"
              className="hidden text-sm text-blue-200/80 transition hover:text-white sm:block"
            >
              Arbeidsflyt
            </a>
            <a
              href="/logg-inn"
              className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-[#0f1b3d] transition hover:bg-blue-50"
            >
              Logg inn
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f1b3d] via-[#162550] to-[#1e3a6e] pt-28 pb-8 sm:pt-36 sm:pb-16">
        {/* Bakgrunnsmønster */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Tekst */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-1.5 text-sm text-blue-200">
                <Building2 className="h-4 w-4" />
                For byggebransjen
              </div>
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                Kvalitetsstyring
                <br />
                <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                  enklere enn noensinne
                </span>
              </h1>
              <p className="mb-8 max-w-lg text-lg leading-relaxed text-blue-100/70">
                SiteDoc er et komplett rapport- og kvalitetsstyringssystem for
                byggeprosjekter. Sjekklister, oppgaver, tegninger og
                dokumenthåndtering — alt samlet på én plattform.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href="/logg-inn"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#0f1b3d] shadow-lg shadow-black/20 transition hover:bg-blue-50"
                >
                  Kom i gang
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#funksjoner"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-3.5 text-base font-medium text-white transition hover:border-white/40 hover:bg-white/5"
                >
                  Se funksjoner
                </a>
              </div>
            </div>

            {/* App-forhåndsvisning */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Skjermvisning — dashbord */}
                <div className="rounded-xl border border-white/10 bg-[#0a1328] p-1.5 shadow-2xl">
                  <div className="rounded-lg bg-[#f8fafc] overflow-hidden">
                    {/* Toppbar */}
                    <div className="flex items-center gap-3 bg-[#1e40af] px-4 py-2.5">
                      <span className="text-xs font-bold text-white">SiteDoc</span>
                      <div className="ml-2 rounded bg-white/20 px-2 py-0.5 text-[10px] text-white/90">Test Prosjekt</div>
                      <div className="ml-auto h-5 w-5 rounded-full bg-white/20" />
                    </div>
                    {/* Innhold */}
                    <div className="flex">
                      {/* Sidebar */}
                      <div className="w-10 shrink-0 border-r border-gray-200 bg-white py-3">
                        {[1,2,3,4,5].map((i) => (
                          <div key={i} className={`mx-auto mb-2 h-5 w-5 rounded ${i === 1 ? 'bg-blue-100' : 'bg-gray-100'}`} />
                        ))}
                      </div>
                      {/* Panel */}
                      <div className="w-36 shrink-0 border-r border-gray-200 bg-white p-3">
                        <div className="mb-2 h-2 w-16 rounded bg-gray-200" />
                        {["Utkast", "Sendt", "Godkjent"].map((s, i) => (
                          <div key={s} className={`mb-1.5 flex items-center gap-1.5 rounded px-1.5 py-1 ${i === 0 ? 'bg-blue-50' : ''}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-amber-400' : 'bg-green-500'}`} />
                            <span className="text-[8px] text-gray-600">{s}</span>
                            <span className="ml-auto text-[8px] text-gray-400">{[3,7,12][i]}</span>
                          </div>
                        ))}
                        <div className="mt-3 mb-2 h-2 w-12 rounded bg-gray-200" />
                        {["BHO-001", "BHO-002", "S-BET-003"].map((nr) => (
                          <div key={nr} className="mb-1 rounded border border-gray-100 bg-gray-50 px-1.5 py-1">
                            <div className="text-[7px] font-medium text-gray-700">{nr}</div>
                            <div className="mt-0.5 h-1 w-14 rounded bg-gray-200" />
                          </div>
                        ))}
                      </div>
                      {/* Hovedinnhold */}
                      <div className="flex-1 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-2.5 w-24 rounded bg-gray-300" />
                          <div className="rounded bg-green-100 px-1.5 py-0.5 text-[7px] font-medium text-green-700">Godkjent</div>
                        </div>
                        <div className="space-y-2">
                          {[1,2,3].map((i) => (
                            <div key={i} className="rounded-lg border border-gray-100 bg-white p-2.5">
                              <div className="mb-1.5 h-1.5 w-20 rounded bg-gray-200" />
                              <div className="h-6 w-full rounded border border-gray-200 bg-gray-50" />
                            </div>
                          ))}
                          {/* Trafikklys */}
                          <div className="rounded-lg border border-gray-100 bg-white p-2.5">
                            <div className="mb-1.5 h-1.5 w-16 rounded bg-gray-200" />
                            <div className="flex gap-2">
                              <div className="h-5 w-5 rounded-full bg-green-500" />
                              <div className="h-5 w-5 rounded-full bg-amber-400 opacity-30" />
                              <div className="h-5 w-5 rounded-full bg-red-500 opacity-30" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobil — flytende over */}
                <div className="absolute -right-4 -bottom-6 w-[120px] rounded-2xl border-2 border-white/10 bg-[#0a1328] p-1 shadow-2xl">
                  <div className="rounded-xl bg-white overflow-hidden">
                    <div className="bg-[#1e40af] px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <ChevronRight className="h-2.5 w-2.5 text-white/60 rotate-180" />
                        <span className="text-[7px] font-bold text-white">BHO-001</span>
                      </div>
                    </div>
                    <div className="p-2 space-y-1.5">
                      <div className="rounded border border-gray-100 bg-gray-50 p-1.5">
                        <div className="mb-1 h-1 w-10 rounded bg-gray-300" />
                        <div className="h-4 rounded border border-gray-200 bg-white" />
                      </div>
                      <div className="rounded border border-gray-100 bg-gray-50 p-1.5">
                        <div className="mb-1 h-1 w-8 rounded bg-gray-300" />
                        <div className="flex gap-1">
                          <div className="h-6 w-6 rounded bg-gray-200" />
                          <div className="h-6 w-6 rounded bg-gray-200" />
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#1e40af] px-2 py-1.5 text-center">
                        <span className="text-[7px] font-medium text-white">Lagre</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nøkkeltall */}
      <section className="relative z-10 -mt-1 py-14">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { tall: "23", label: "Felttyper", ikon: <GripVertical className="h-5 w-5" /> },
              { tall: "9", label: "Statusnivåer", ikon: <CircleDot className="h-5 w-5" /> },
              { tall: "100%", label: "Offline-støtte", ikon: <WifiOff className="h-5 w-5" /> },
              { tall: "3", label: "Plattformer", ikon: <Smartphone className="h-5 w-5" /> },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm">
                <div className="mx-auto mb-2 inline-flex rounded-lg bg-blue-50 p-2 text-sitedoc-primary">
                  {item.ikon}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {item.tall}
                </div>
                <div className="mt-0.5 text-sm text-gray-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hovedfunksjoner */}
      <section id="funksjoner" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-sitedoc-primary">
              Funksjoner
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Alt du trenger for kvalitetsstyring
            </h2>
            <p className="mx-auto max-w-2xl text-gray-500">
              Fra sjekklister og oppgaver til tegningsmarkering og
              entrepriseflyt — SiteDoc dekker hele arbeidsflyten.
            </p>
          </div>

          {/* Topp-rad — store kort med illustrasjon */}
          <div className="mb-8 grid gap-8 lg:grid-cols-2">
            <StortFunksjonskort
              ikon={<ClipboardCheck className="h-6 w-6" />}
              tittel="Sjekklister"
              beskrivelse="Strukturerte sjekklister med 23 rapportobjekttyper. Bygg maler med drag-and-drop på PC, fyll ut på mobil med bilder og GPS."
              farge="blue"
            >
              {/* Mini sjekkliste-illustrasjon */}
              <div className="mt-4 rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">BHO-001</div>
                  <div className="h-1.5 w-20 rounded bg-gray-200" />
                  <div className="ml-auto rounded bg-green-100 px-1.5 py-0.5 text-[9px] text-green-700">Godkjent</div>
                </div>
                {["Dato", "Ansvarlig", "Kontrollpunkt 1"].map((f, i) => (
                  <div key={f} className="flex items-center gap-2 border-t border-gray-50 py-1.5">
                    <span className="text-[9px] text-gray-500 w-20">{f}</span>
                    <div className={`h-4 flex-1 rounded ${i === 2 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                      {i === 2 && <div className="flex items-center justify-center h-full"><Check className="h-2.5 w-2.5 text-green-600" /></div>}
                    </div>
                  </div>
                ))}
              </div>
            </StortFunksjonskort>

            <StortFunksjonskort
              ikon={<Layers className="h-6 w-6" />}
              tittel="Tegninger og markører"
              beskrivelse="Last opp tegninger med metadata. Plasser oppgaver direkte på tegningen — mobilappen bruker GPS for automatisk posisjonering."
              farge="cyan"
            >
              {/* Mini tegning-illustrasjon */}
              <div className="mt-4 rounded-lg border border-cyan-100 bg-white p-3 shadow-sm">
                <div className="relative h-24 rounded bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200">
                  {/* Tegningslinjer */}
                  <div className="absolute inset-2">
                    <div className="h-full w-full border border-dashed border-gray-300 rounded" />
                    <div className="absolute top-1/4 left-1/4 right-1/4 bottom-1/4 border border-gray-300 rounded" />
                  </div>
                  {/* Markører */}
                  <div className="absolute top-3 right-6 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 shadow-sm">
                    <span className="text-[6px] font-bold text-white">1</span>
                  </div>
                  <div className="absolute bottom-5 left-8 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 shadow-sm">
                    <span className="text-[6px] font-bold text-white">2</span>
                  </div>
                  <div className="absolute top-8 left-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 shadow-sm animate-pulse">
                    <span className="text-[6px] font-bold text-white">+</span>
                  </div>
                </div>
              </div>
            </StortFunksjonskort>
          </div>

          {/* Resten som grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Funksjonsort
              ikon={<CheckSquare className="h-5 w-5" />}
              tittel="Oppgaver"
              beskrivelse="Opprett fra sjekklister, tegninger eller frittstående. Full sporbarhet med entrepriseflyt."
            />
            <Funksjonsort
              ikon={<Users className="h-5 w-5" />}
              tittel="Entrepriseflyt"
              beskrivelse="Dokumenter flyter mellom oppretter og svarer med 9 statusnivåer og full sporbarhet."
            />
            <Funksjonsort
              ikon={<Camera className="h-5 w-5" />}
              tittel="Bildedokumentasjon"
              beskrivelse="Kamera med komprimering, GPS-tagging og annotering. Synkroniseres i bakgrunnen."
            />
            <Funksjonsort
              ikon={<FileText className="h-5 w-5" />}
              tittel="PDF-eksport"
              beskrivelse="Profesjonelle PDF-er med firmalogo, prosjektinfo, bilder og all utfylt data."
            />
            <Funksjonsort
              ikon={<Shield className="h-5 w-5" />}
              tittel="Tilgangskontroll"
              beskrivelse="Brukergrupper, entreprise-tilgang og fagområder. Admin ser alt, brukere ser sitt."
            />
            <Funksjonsort
              ikon={<CloudSun className="h-5 w-5" />}
              tittel="Automatisk vær"
              beskrivelse="Værdata hentes automatisk fra prosjektlokasjon. Temperatur, vind og forhold."
            />
            <Funksjonsort
              ikon={<MapPin className="h-5 w-5" />}
              tittel="Georeferanse"
              beskrivelse="Kalibrer tegninger med GPS. Mobilappen plasserer markører automatisk."
            />
          </div>
        </div>
      </section>

      {/* Plattform */}
      <section id="plattform" className="bg-gradient-to-b from-gray-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-sitedoc-primary">
              Plattform
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Én plattform, alle enheter
            </h2>
            <p className="mx-auto max-w-2xl text-gray-500">
              Bruk SiteDoc på PC for maler og administrasjon, på mobil og
              nettbrett for utfylling i felt. Alt synkroniseres automatisk.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <Plattformkort
              ikon={<Monitor className="h-7 w-7" />}
              tittel="PC / Nettleser"
              beskrivelse="Administrasjon og malbygging"
              funksjoner={[
                "Malbygger med drag-and-drop",
                "Entreprise- og arbeidsforløp",
                "Tegningsvisning med zoom",
                "Brukergrupper og tilgang",
                "PDF-eksport og utskrift",
              ]}
            />
            <Plattformkort
              ikon={<Smartphone className="h-7 w-7" />}
              tittel="Mobil / Nettbrett"
              beskrivelse="Utfylling i felt"
              funksjoner={[
                "Offline-first med lokal lagring",
                "Kamera med komprimering",
                "GPS-tagging og posisjonering",
                "Oppgaver fra tegninger",
                "Bakgrunnssynkronisering",
              ]}
              fremhevet
            />
            <Plattformkort
              ikon={<WifiOff className="h-7 w-7" />}
              tittel="Offline-modus"
              beskrivelse="Fungerer uten nett"
              funksjoner={[
                "Full utfylling uten nett",
                "SQLite lokal database",
                "Automatisk synk ved nett",
                "Bilder lagres lokalt",
                "Ingen data går tapt",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Arbeidsflyt */}
      <section id="arbeidsflyt" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-sitedoc-primary">
              Arbeidsflyt
            </div>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Fra mal til ferdig rapport
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-0 sm:grid-cols-4 sm:gap-4">
            {[
              {
                steg: "1",
                tittel: "Bygg maler",
                beskrivelse: "Drag-and-drop med 23 felttyper og rekursiv nesting.",
                ikon: <GripVertical className="h-5 w-5" />,
              },
              {
                steg: "2",
                tittel: "Fyll ut i felt",
                beskrivelse: "Mobil med bilder, GPS, signatur og offline-støtte.",
                ikon: <Smartphone className="h-5 w-5" />,
              },
              {
                steg: "3",
                tittel: "Send og følg opp",
                beskrivelse: "Entrepriseflyt med 9 statusnivåer og sporbarhet.",
                ikon: <Send className="h-5 w-5" />,
              },
              {
                steg: "4",
                tittel: "Eksporter",
                beskrivelse: "PDF med all data, bilder og metadata.",
                ikon: <Printer className="h-5 w-5" />,
              },
            ].map((item, idx) => (
              <div key={item.steg} className="flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 py-4 sm:py-0 sm:text-center">
                <div className="relative">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sitedoc-primary to-blue-600 text-white shadow-lg shadow-blue-500/20">
                    {item.ikon}
                  </div>
                  <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-sitedoc-primary shadow ring-2 ring-sitedoc-primary">
                    {item.steg}
                  </div>
                </div>
                {idx < 3 && (
                  <div className="hidden sm:block mx-auto mt-3 mb-3">
                    <ChevronRight className="h-4 w-4 text-gray-300 rotate-90 sm:rotate-0" />
                  </div>
                )}
                {idx >= 3 && <div className="hidden sm:block h-7" />}
                <div className="sm:mt-2">
                  <h3 className="font-semibold text-gray-900">{item.tittel}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {item.beskrivelse}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f1b3d] via-[#162550] to-[#1e3a6e] py-20">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Klar til å komme i gang?
          </h2>
          <p className="mb-8 text-lg text-blue-200/70">
            Logg inn med Google eller Microsoft 365 og start ditt første
            prosjekt i dag.
          </p>
          <a
            href="/logg-inn"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#0f1b3d] shadow-lg shadow-black/20 transition hover:bg-blue-50"
          >
            Kom i gang gratis
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <span className="text-base font-bold text-sitedoc-primary">
                SiteDoc
              </span>
              <p className="mt-1 text-sm text-gray-400">
                Kvalitetsstyring for byggebransjen
              </p>
            </div>
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} SiteDoc
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StortFunksjonskort({
  ikon,
  tittel,
  beskrivelse,
  farge,
  children,
}: {
  ikon: React.ReactNode;
  tittel: string;
  beskrivelse: string;
  farge: "blue" | "cyan";
  children: React.ReactNode;
}) {
  const farger = {
    blue: "from-blue-50 to-blue-50/30 border-blue-100",
    cyan: "from-cyan-50 to-cyan-50/30 border-cyan-100",
  };
  const ikonFarger = {
    blue: "bg-blue-100 text-blue-700",
    cyan: "bg-cyan-100 text-cyan-700",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-6 ${farger[farge]}`}>
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${ikonFarger[farge]}`}>
        {ikon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{tittel}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{beskrivelse}</p>
      {children}
    </div>
  );
}

function Funksjonsort({
  ikon,
  tittel,
  beskrivelse,
}: {
  ikon: React.ReactNode;
  tittel: string;
  beskrivelse: string;
}) {
  return (
    <div className="group rounded-xl border border-gray-100 bg-white p-5 transition hover:border-blue-200 hover:shadow-md hover:shadow-blue-500/5">
      <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-2 text-gray-600 transition group-hover:bg-blue-50 group-hover:text-sitedoc-primary">
        {ikon}
      </div>
      <h3 className="mb-1.5 font-semibold text-gray-900">{tittel}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{beskrivelse}</p>
    </div>
  );
}

function Plattformkort({
  ikon,
  tittel,
  beskrivelse,
  funksjoner,
  fremhevet,
}: {
  ikon: React.ReactNode;
  tittel: string;
  beskrivelse: string;
  funksjoner: string[];
  fremhevet?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-8 transition ${
        fremhevet
          ? "border-sitedoc-primary/30 bg-gradient-to-b from-blue-50/80 to-white shadow-lg shadow-blue-500/10 ring-1 ring-sitedoc-primary/20 scale-[1.02]"
          : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      <div
        className={`mb-3 inline-flex rounded-xl p-2.5 ${fremhevet ? "bg-sitedoc-primary text-white" : "bg-gray-100 text-gray-500"}`}
      >
        {ikon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{tittel}</h3>
      <p className="mb-4 text-sm text-gray-500">{beskrivelse}</p>
      <ul className="space-y-2.5">
        {funksjoner.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
            <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${fremhevet ? 'text-sitedoc-primary' : 'text-gray-400'}`} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
