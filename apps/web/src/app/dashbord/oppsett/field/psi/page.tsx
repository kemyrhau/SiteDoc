"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Spinner, Card } from "@sitedoc/ui";
import { ShieldCheck, QrCode, RefreshCw, FileText, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function PsiOppsettSide() {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const { data: psi, isLoading } = trpc.psi.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const opprettMut = trpc.psi.opprett.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const byttMalMut = trpc.psi.byttMal.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const bumpMut = trpc.psi.bumpVersjon.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const [valgtMal, setValgtMal] = useState("");
  const [visQR, setVisQR] = useState(false);

  // Filtrer maler — vis alle for PSI (admin velger selv)
  const tilgjengeligeMaler = (maler ?? []) as Array<{ id: string; name: string; prefix: string | null; category: string }>;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const qrUrl = psi
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/psi/${prosjektId}`
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-sitedoc-primary" />
        <h1 className="text-xl font-bold text-gray-900">PSI — Sikkerhetsinstruks</h1>
      </div>

      {/* Veiledning — alltid synlig */}
      <Card className="mb-6 border-blue-200 bg-blue-50 p-5">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">Hva bør en PSI inneholde?</h3>
        <p className="mb-3 text-xs text-blue-800">
          Byggherreforskriften krever at alle arbeidere gjennomfører prosjektspesifikk sikkerhetsinstruks.
          Bygg malen i malbyggeren med disse seksjonene:
        </p>
        <div className="grid gap-2 text-xs text-blue-800 sm:grid-cols-2">
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">1. Velkommen og prosjektinfo</p>
            <p className="mt-0.5 text-blue-700">Prosjektnavn, adresse, nøkkelpersoner (KU, HMS-ansvarlig), kontaktinfo</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">2. Nødprosedyrer</p>
            <p className="mt-0.5 text-blue-700">Nødnummer (110/112/113), møteplass, evakueringsruter, førstehjelpsutstyr, AED-plassering</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">3. Verneutstyr (PPE)</p>
            <p className="mt-0.5 text-blue-700">Alltid påkrevd: hjelm, vernesko, refleksvest, briller. Aktivitetsbasert: hørselsvern, fallsikring, åndedrettsvern</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">4. Rigg og adkomst</p>
            <p className="mt-0.5 text-blue-700">Inngang/utgang, parkering, gangveier, besøksprosedyre, fartsgrense</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">5. Sikkerhetsregler</p>
            <p className="mt-0.5 text-blue-700">Rusmiddelpolitikk, arbeidstid, ryddighet, arbeid i høyden, varme arbeider, graving, avviksrapportering</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">6. Spesifikke risikoforhold</p>
            <p className="mt-0.5 text-blue-700">Prosjektspesifikke farer: kran, grøfter, asbest, trafikk, tunge løft — bruk bilder!</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">7. Video (anbefalt)</p>
            <p className="mt-0.5 text-blue-700">3–5 min video som viser byggeplassen, nødutganger og spesifikke farer. Bruk «video»-feltet i malbyggeren</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">8. Kontrollspørsmål + Signatur</p>
            <p className="mt-0.5 text-blue-700">2–5 quiz-spørsmål for å verifisere forståelse. Avslutt med signatur-felt</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-600">
          Tips: Bruk felttyper <strong>heading</strong> (seksjonstittel), <strong>info_text</strong> (lesetekst), <strong>info_image</strong> (bilde), <strong>video</strong>, <strong>quiz</strong> og <strong>signature</strong> i malbyggeren.
        </p>
      </Card>

      {!psi ? (
        /* Ingen PSI opprettet ennå */
        <Card className="p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">Opprett PSI for prosjektet</h2>
          <p className="mb-4 text-sm text-gray-500">
            Velg en mal som inneholder sikkerhetsinstruksen. Malen kan bygges i malbyggeren med tekst, bilder, video, quiz og signatur.
          </p>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Velg mal</label>
            <select
              value={valgtMal}
              onChange={(e) => setValgtMal(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Velg mal —</option>
              {tilgjengeligeMaler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.prefix ? `${m.prefix} — ` : ""}{m.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => {
              if (!valgtMal || !prosjektId) return;
              opprettMut.mutate({ projectId: prosjektId, templateId: valgtMal });
            }}
            disabled={!valgtMal || opprettMut.isPending}
          >
            {opprettMut.isPending ? "Oppretter..." : "Opprett PSI"}
          </Button>
        </Card>
      ) : (
        /* PSI finnes — vis status og handlinger */
        <>
          <Card className="mb-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {(psi as unknown as { template: { name: string } }).template.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Versjon {psi.version} — opprettet {new Date(psi.createdAt).toLocaleDateString("nb-NO")}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Aktiv
              </span>
            </div>
          </Card>

          {/* Handlinger */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Ny versjon */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <RefreshCw className="h-5 w-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Ny versjon</h3>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Har du oppdatert innholdet i PSI-malen? Krev at alle arbeidere gjennomfører og signerer på nytt.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!prosjektId) return;
                  if (confirm("Alle som allerede har signert vil få beskjed om å gjennomføre PSI på nytt. Er du sikker?")) {
                    bumpMut.mutate({ projectId: prosjektId });
                  }
                }}
                disabled={bumpMut.isPending}
              >
                Krev ny signering</Button>
            </Card>

            {/* QR-kode */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <QrCode className="h-5 w-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">QR-kode for gjester</h3>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Skriv ut og heng opp ved porten. Arbeidere skanner med mobilen for å gjennomføre PSI.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setVisQR(!visQR)}>
                {visQR ? "Skjul" : "Vis QR-kode"}
              </Button>
              {visQR && (
                <>
                  {/* Utskriftsvennlig QR-plakat */}
                  <div id="psi-qr-print" className="mt-4 rounded-xl border-2 border-gray-200 bg-white p-8 text-center print:border-none print:p-0">
                    <div className="mb-4">
                      <ShieldCheck className="mx-auto h-10 w-10 text-sitedoc-primary print:text-black" />
                      <h2 className="mt-2 text-2xl font-bold text-gray-900">Sikkerhetsinstruks (PSI)</h2>
                      <p className="mt-1 text-base text-gray-600">Skann QR-koden for å gjennomføre</p>
                    </div>
                    <div className="mx-auto my-6 inline-block rounded-xl border-4 border-gray-900 p-4">
                      <QRCodeSVG value={qrUrl} size={200} level="H" />
                    </div>
                    <p className="text-sm text-gray-500">
                      Alle arbeidere, besøkende og underleverandører<br />
                      <strong>MÅ</strong> gjennomføre og signere før arbeid kan starte.
                    </p>
                    <p className="mt-4 break-all text-xs font-mono text-gray-400">{qrUrl}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        const el = document.getElementById("psi-qr-print");
                        if (!el) return;
                        const w = window.open("", "_blank");
                        if (!w) return;
                        w.document.write(`<html><head><title>PSI QR-kode</title><style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}div{text-align:center}h2{font-size:28px;margin:8px 0}p{margin:6px 0;color:#555}.qr{border:4px solid #000;border-radius:12px;padding:16px;display:inline-block;margin:24px 0}.url{font-family:monospace;font-size:10px;color:#999;word-break:break-all}.must{font-weight:bold}</style></head><body>${el.innerHTML}</body></html>`);
                        w.document.close();
                        w.print();
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Skriv ut QR-plakat
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(qrUrl)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Kopier lenke
                    </button>
                  </div>
                </>
              )}
            </Card>

            {/* Bytt mal */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="h-5 w-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Bytt mal</h3>
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value || !prosjektId) return;
                  if (confirm("Når du bytter mal må alle arbeidere gjennomføre og signere den nye PSI-en på nytt. Vil du bytte?")) {
                    byttMalMut.mutate({ projectId: prosjektId, templateId: e.target.value });
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="">— Velg ny mal —</option>
                {tilgjengeligeMaler.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.prefix ? `${m.prefix} — ` : ""}{m.name}
                  </option>
                ))}
              </select>
            </Card>
          </div>

          {/* Dashboard-lenke */}
          <div className="mt-6">
            <a
              href={`/dashbord/${prosjektId}/psi`}
              className="text-sm text-sitedoc-primary hover:underline"
            >
              → Åpne PSI-dashboard (signaturoversikt)
            </a>
          </div>
        </>
      )}
    </div>
  );
}
