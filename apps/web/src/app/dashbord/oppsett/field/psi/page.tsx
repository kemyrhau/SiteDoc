"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Spinner, Card } from "@sitedoc/ui";
import {
  ShieldCheck,
  QrCode,
  RefreshCw,
  FileText,
  Printer,
  Pencil,
  Copy,
  Trash2,
  Plus,
  Building2,
  Globe,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function PsiOppsettSide() {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const { data: psiListe, isLoading } = trpc.psi.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const opprettMut = trpc.psi.opprett.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const bumpMut = trpc.psi.bumpVersjon.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const byttMalMut = trpc.psi.byttMal.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const slettMut = trpc.psi.slett.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const kopierMut = trpc.psi.kopier.useMutation({
    onSuccess: () => utils.psi.hentForProsjekt.invalidate(),
  });

  const [visOpprettSkjema, setVisOpprettSkjema] = useState(false);
  const [nyMalId, setNyMalId] = useState("");
  const [nyBygningId, setNyBygningId] = useState("");
  const [visQRForPsi, setVisQRForPsi] = useState<string | null>(null);
  const [visKopierForPsi, setVisKopierForPsi] = useState<string | null>(null);
  const [kopierMålBygning, setKopierMålBygning] = useState("");

  type PsiRad = NonNullable<typeof psiListe>[number];
  const tilgjengeligeMaler = (maler ?? []) as Array<{ id: string; name: string; prefix: string | null; category: string }>;
  type BygningData = { id: string; name: string };
  const bygningsListe = (bygninger ?? []) as BygningData[];

  // Hvilke bygninger har allerede PSI?
  const bygningerMedPsi = new Set((psiListe ?? []).map((p: PsiRad) => p.buildingId).filter(Boolean));
  const harProsjektnivaPsi = (psiListe ?? []).some((p: PsiRad) => !p.buildingId);

  // Bygninger tilgjengelig for opprettelse
  const tilgjengeligeBygninger = bygningsListe.filter((b) => !bygningerMedPsi.has(b.id));

  // Bygninger tilgjengelig for kopiering (ekskluder de som allerede har PSI)
  const tilgjengeligeKopierBygninger = bygningsListe.filter((b) => !bygningerMedPsi.has(b.id));

  const qrUrl = typeof window !== "undefined"
    ? `${window.location.origin}/psi/${prosjektId}`
    : "";

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-sitedoc-primary" />
        <h1 className="text-xl font-bold text-gray-900">{t("psi.tittel")}</h1>
      </div>

      {/* Veiledning */}
      <Card className="mb-6 border-blue-200 bg-blue-50 p-5">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">Hva bør en PSI inneholde?</h3>
        <p className="mb-3 text-xs text-blue-800">
          Byggherreforskriften krever at alle arbeidere gjennomfører prosjektspesifikk sikkerhetsinstruks.
          Bygg malen i malbyggeren med disse seksjonene:
        </p>
        <div className="grid gap-2 text-xs text-blue-800 sm:grid-cols-2">
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">1. Velkommen og prosjektinfo</p>
            <p className="mt-0.5 text-blue-700">Prosjektnavn, adresse, nøkkelpersoner, kontaktinfo</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">2. Nødprosedyrer</p>
            <p className="mt-0.5 text-blue-700">Nødnummer, møteplass, evakueringsruter, førstehjelpsutstyr</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">3. Verneutstyr (PPE)</p>
            <p className="mt-0.5 text-blue-700">Hjelm, vernesko, refleksvest, briller, hørselsvern, fallsikring</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">4. Rigg og adkomst</p>
            <p className="mt-0.5 text-blue-700">Inngang/utgang, parkering, gangveier, besøksprosedyre</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">5. Sikkerhetsregler</p>
            <p className="mt-0.5 text-blue-700">Rusmiddelpolitikk, arbeidstid, ryddighet, avviksrapportering</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">6. Spesifikke risikoforhold</p>
            <p className="mt-0.5 text-blue-700">Prosjektspesifikke farer — bruk bilder!</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">7. Video (anbefalt)</p>
            <p className="mt-0.5 text-blue-700">3–5 min video av byggeplassen og farer</p>
          </div>
          <div className="rounded-lg bg-white/60 p-3">
            <p className="font-semibold">8. Kontrollspørsmål + Signatur</p>
            <p className="mt-0.5 text-blue-700">2–5 quiz-spørsmål + signatur-felt</p>
          </div>
        </div>
      </Card>

      {/* QR-kode — én per prosjekt */}
      {(psiListe ?? []).length > 0 && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="h-5 w-5 text-gray-500" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t("psi.qrKode")}</h3>
                <p className="text-xs text-gray-500">{t("psi.qrBeskrivelse")}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setVisQRForPsi(visQRForPsi ? null : "prosjekt")}>
              {visQRForPsi ? t("psi.skjulQR") : t("psi.visQR")}
            </Button>
          </div>
          {visQRForPsi && (
            <>
              <div id="psi-qr-print" className="mt-4 rounded-xl border-2 border-gray-200 bg-white p-8 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-sitedoc-primary" />
                <h2 className="mt-2 text-2xl font-bold text-gray-900">Sikkerhetsinstruks (PSI)</h2>
                <p className="mt-1 text-base text-gray-600">Skann QR-koden for å gjennomføre</p>
                <div className="mx-auto my-6 inline-block rounded-xl border-4 border-gray-900 p-4">
                  <QRCodeSVG value={qrUrl} size={200} level="H" />
                </div>
                <p className="text-sm text-gray-500">
                  Alle arbeidere, besøkende og underleverandører<br />
                  <strong>MÅ</strong> gjennomføre og signere før arbeid kan starte.
                </p>
                <p className="mt-4 break-all font-mono text-xs text-gray-400">{qrUrl}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    const el = document.getElementById("psi-qr-print");
                    if (!el) return;
                    const w = window.open("", "_blank");
                    if (!w) return;
                    w.document.write(`<html><head><title>PSI QR-kode</title><style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}div{text-align:center}h2{font-size:28px;margin:8px 0}p{margin:6px 0;color:#555}.qr{border:4px solid #000;border-radius:12px;padding:16px;display:inline-block;margin:24px 0}.url{font-family:monospace;font-size:10px;color:#999;word-break:break-all}</style></head><body>${el.innerHTML}</body></html>`);
                    w.document.close();
                    w.print();
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {t("psi.skrivUtQR")}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(qrUrl)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  {t("psi.kopierLenke")}
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* PSI-liste */}
      {(psiListe ?? []).length > 0 && (
        <div className="mb-6">
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">{t("psi.bygning")}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">{t("psi.mal")}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">{t("psi.versjon")}</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">{t("psi.handlinger")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(psiListe as PsiRad[]).map((psi) => (
                  <tr key={psi.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {psi.building ? (
                          <>
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{psi.building.name}</span>
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{t("psi.heleProsjektet")}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{psi.template.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        v{psi.version}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/dashbord/oppsett/field/sjekklistemaler/${psi.templateId}`}
                          className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                          title={t("psi.redigerMal")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            if (confirm(t("psi.bekreftNySignering"))) {
                              bumpMut.mutate({ psiId: psi.id });
                            }
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                          title={t("psi.krevNySignering")}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setVisKopierForPsi(visKopierForPsi === psi.id ? null : psi.id);
                            setKopierMålBygning("");
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                          title={t("psi.kopierTilBygning")}
                          disabled={tilgjengeligeKopierBygninger.length === 0}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t("psi.bekreftSlett"))) {
                              slettMut.mutate({ psiId: psi.id });
                            }
                          }}
                          className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                          title={t("psi.slettPsi")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Kopier-velger */}
                      {visKopierForPsi === psi.id && tilgjengeligeKopierBygninger.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={kopierMålBygning}
                            onChange={(e) => setKopierMålBygning(e.target.value)}
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="">{t("psi.velgBygning")}</option>
                            {tilgjengeligeKopierBygninger.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              if (!kopierMålBygning) return;
                              kopierMut.mutate({ psiId: psi.id, targetBuildingId: kopierMålBygning });
                              setVisKopierForPsi(null);
                            }}
                            disabled={!kopierMålBygning || kopierMut.isPending}
                          >
                            {kopierMut.isPending ? "..." : t("psi.kopierTilBygning")}
                          </Button>
                        </div>
                      )}
                      {/* Bytt mal */}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                          {t("psi.byttMal")}
                        </summary>
                        <div className="mt-1.5">
                          <select
                            value=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              if (confirm(t("psi.bekreftByttMal"))) {
                                byttMalMut.mutate({ psiId: psi.id, templateId: e.target.value });
                              }
                            }}
                            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="">— {t("psi.velgMal")} —</option>
                            {tilgjengeligeMaler.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.prefix ? `${m.prefix} — ` : ""}{m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Opprett ny PSI */}
      {!visOpprettSkjema ? (
        <Button onClick={() => setVisOpprettSkjema(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("psi.opprettNy")}
        </Button>
      ) : (
        <Card className="p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">{t("psi.opprettNy")}</h2>
          <p className="mb-4 text-sm text-gray-500">{t("psi.opprettBeskrivelse")}</p>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("psi.bygning")}</label>
            <select
              value={nyBygningId}
              onChange={(e) => setNyBygningId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled={harProsjektnivaPsi}>
                {t("psi.heleProsjektet")} {harProsjektnivaPsi ? `(${t("psi.bygningHarPsi")})` : ""}
              </option>
              {bygningsListe.map((b) => (
                <option key={b.id} value={b.id} disabled={bygningerMedPsi.has(b.id)}>
                  {b.name} {bygningerMedPsi.has(b.id) ? `(${t("psi.bygningHarPsi")})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("psi.velgMal")}</label>
            <select
              value={nyMalId}
              onChange={(e) => setNyMalId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— {t("psi.velgMal")} —</option>
              {tilgjengeligeMaler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.prefix ? `${m.prefix} — ` : ""}{m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (!nyMalId || !prosjektId) return;
                opprettMut.mutate({
                  projectId: prosjektId,
                  templateId: nyMalId,
                  ...(nyBygningId ? { buildingId: nyBygningId } : {}),
                });
                setVisOpprettSkjema(false);
                setNyMalId("");
                setNyBygningId("");
              }}
              disabled={!nyMalId || opprettMut.isPending}
            >
              {opprettMut.isPending ? "..." : t("psi.opprettNy")}
            </Button>
            <Button variant="secondary" onClick={() => { setVisOpprettSkjema(false); setNyMalId(""); setNyBygningId(""); }}>
              {t("handling.avbryt")}
            </Button>
          </div>
        </Card>
      )}

      {/* Dashboard-lenke */}
      {(psiListe ?? []).length > 0 && (
        <div className="mt-6">
          <a
            href={`/dashbord/${prosjektId}/psi`}
            className="text-sm text-sitedoc-primary hover:underline"
          >
            → {t("psi.signaturoversikt")}
          </a>
        </div>
      )}
    </div>
  );
}
