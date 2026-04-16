"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { LandingSpraakVelger } from "./LandingSpraakVelger";
import {
  ClipboardCheck,
  CheckSquare,
  Camera,
  MapPin,
  WifiOff,
  Shield,
  Building2,
  Users,
  Monitor,
  Smartphone,
  ArrowRight,
  Layers,
  Check,
  Send,
  Printer,
  GripVertical,
  ChevronRight,
  Box,
  Search,
  Globe,
  BarChart3,
  FolderOpen,
} from "lucide-react";

export function LandingInnhold() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigasjon */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#0f1b3d]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="text-xl font-bold text-white tracking-wide hover:text-blue-200 transition">
            SiteDoc
          </a>
          <div className="flex items-center gap-6">
            <a href="#funksjoner" className="hidden text-sm text-blue-200/80 transition hover:text-white sm:block">
              {t("landing.funksjoner")}
            </a>
            <a href="#plattform" className="hidden text-sm text-blue-200/80 transition hover:text-white sm:block">
              {t("landing.plattform")}
            </a>
            <a href="#arbeidsflyt" className="hidden text-sm text-blue-200/80 transition hover:text-white sm:block">
              {t("landing.arbeidsflyt")}
            </a>
            <a href="#priser" className="hidden text-sm text-blue-200/80 transition hover:text-white sm:block">
              {t("landing.priser")}
            </a>
            <LandingSpraakVelger />
            <a href="/logg-inn" className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-[#0f1b3d] transition hover:bg-blue-50">
              {t("landing.loggInn")}
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f1b3d] via-[#162550] to-[#1e3a6e] pt-28 pb-8 sm:pt-36 sm:pb-16">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-1.5 text-sm text-blue-200">
              <Building2 className="h-4 w-4" />
              {t("landing.forByggebransjen")}
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
              {t("landing.heroTittel1")}
              <br />
              <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                {t("landing.heroTittel2")}
              </span>
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-blue-100/70">
              {t("landing.heroBeskrivelse")}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a href="/logg-inn" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#0f1b3d] shadow-lg shadow-black/20 transition hover:bg-blue-50">
                {t("landing.komIGang")}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#funksjoner" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-3.5 text-base font-medium text-white transition hover:border-white/40 hover:bg-white/5">
                {t("landing.seFunksjoner")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Nøkkeltall */}
      <section className="relative z-10 -mt-1 py-14">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { tall: "13", label: t("landing.spraak"), ikon: <Globe className="h-5 w-5" /> },
              { tall: "3D", label: "IFC", ikon: <Box className="h-5 w-5" /> },
              { tall: "100%", label: t("landing.offline"), ikon: <WifiOff className="h-5 w-5" /> },
              { tall: "AI", label: t("landing.aiSok"), ikon: <Search className="h-5 w-5" /> },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm">
                <div className="mx-auto mb-2 inline-flex rounded-lg bg-blue-50 p-2 text-sitedoc-primary">{item.ikon}</div>
                <div className="text-2xl font-bold text-gray-900">{item.tall}</div>
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
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-sitedoc-primary">{t("landing.funksjoner")}</div>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">{t("landing.funksjonerTittel")}</h2>
            <p className="mx-auto max-w-2xl text-gray-500">{t("landing.funksjonerBeskrivelse")}</p>
          </div>

          {/* Rad 1 — Sjekklister + Tegninger */}
          <div className="mb-8 grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-blue-50/30 border-blue-100 p-6">
              <div className="mb-3 inline-flex rounded-xl p-2.5 bg-blue-100 text-blue-700"><ClipboardCheck className="h-6 w-6" /></div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{t("landing.sjekklister")}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{t("landing.sjekklisterBeskrivelse")}</p>
            </div>
            <div className="rounded-2xl border bg-gradient-to-br from-cyan-50 to-cyan-50/30 border-cyan-100 p-6">
              <div className="mb-3 inline-flex rounded-xl p-2.5 bg-cyan-100 text-cyan-700"><Layers className="h-6 w-6" /></div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{t("landing.tegninger")}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{t("landing.tegningerBeskrivelse")}</p>
            </div>
          </div>

          {/* Rad 2 — 3D + AI-søk */}
          <div className="mb-8 grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border bg-gradient-to-br from-cyan-50 to-cyan-50/30 border-cyan-100 p-6">
              <div className="mb-3 inline-flex rounded-xl p-2.5 bg-cyan-100 text-cyan-700"><Box className="h-6 w-6" /></div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{t("landing.3d")}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{t("landing.3dBeskrivelse")}</p>
            </div>
            <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-blue-50/30 border-blue-100 p-6">
              <div className="mb-3 inline-flex rounded-xl p-2.5 bg-blue-100 text-blue-700"><Search className="h-6 w-6" /></div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{t("landing.aiSok")}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{t("landing.aiSokBeskrivelse")}</p>
            </div>
          </div>

          {/* Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { ikon: <CheckSquare className="h-5 w-5" />, tittel: t("landing.oppgaver"), beskrivelse: t("landing.oppgaverBeskrivelse") },
              { ikon: <Users className="h-5 w-5" />, tittel: t("landing.dokumentflyt"), beskrivelse: t("landing.dokumentflytBeskrivelse") },
              { ikon: <Globe className="h-5 w-5" />, tittel: t("landing.spraak"), beskrivelse: t("landing.spraakBeskrivelse") },
              { ikon: <BarChart3 className="h-5 w-5" />, tittel: t("landing.okonomi"), beskrivelse: t("landing.okonomiBeskrivelse") },
              { ikon: <Camera className="h-5 w-5" />, tittel: t("landing.bilder"), beskrivelse: t("landing.bilderBeskrivelse") },
              { ikon: <FolderOpen className="h-5 w-5" />, tittel: t("landing.dokumenter"), beskrivelse: t("landing.dokumenterBeskrivelse") },
              { ikon: <Shield className="h-5 w-5" />, tittel: t("landing.tilgang"), beskrivelse: t("landing.tilgangBeskrivelse") },
              { ikon: <MapPin className="h-5 w-5" />, tittel: t("landing.gps"), beskrivelse: t("landing.gpsBeskrivelse") },
            ].map((item) => (
              <div key={item.tittel} className="group rounded-xl border border-gray-100 bg-white p-5 transition hover:border-blue-200 hover:shadow-md hover:shadow-blue-500/5">
                <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-2 text-gray-600 transition group-hover:bg-blue-50 group-hover:text-sitedoc-primary">{item.ikon}</div>
                <h3 className="mb-1.5 font-semibold text-gray-900">{item.tittel}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{item.beskrivelse}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plattform */}
      <section id="plattform" className="bg-gradient-to-b from-gray-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-sitedoc-primary">{t("landing.plattform")}</div>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">{t("landing.plattformTittel")}</h2>
            <p className="mx-auto max-w-2xl text-gray-500">{t("landing.plattformBeskrivelse")}</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <Plattformkort ikon={<Monitor className="h-7 w-7" />} tittel={t("landing.pc")} beskrivelse={t("landing.pcBeskrivelse")} funksjoner={[
              t("landing.sjekklister"), t("landing.3d"), t("landing.aiSok"), t("landing.okonomi"), t("landing.tilgang"), "PDF"
            ]} />
            <Plattformkort ikon={<Smartphone className="h-7 w-7" />} tittel={t("landing.mobil")} beskrivelse={t("landing.mobilBeskrivelse")} funksjoner={[
              t("landing.offline"), t("landing.bilder"), t("landing.gps"), t("landing.spraak"), "GPS-tagging"
            ]} fremhevet />
            <Plattformkort ikon={<WifiOff className="h-7 w-7" />} tittel={t("landing.offline")} beskrivelse={t("landing.offlineBeskrivelse")} funksjoner={[
              "SQLite", "Auto-sync", t("landing.bilder"), "100% offline"
            ]} />
          </div>
        </div>
      </section>

      {/* Arbeidsflyt */}
      <section id="arbeidsflyt" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-sitedoc-primary">{t("landing.arbeidsflyt")}</div>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">{t("landing.arbeidsflytTittel")}</h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-0 sm:grid-cols-4 sm:gap-4">
            {[
              { steg: "1", tittel: t("landing.steg1"), beskrivelse: t("landing.steg1Beskrivelse"), ikon: <GripVertical className="h-5 w-5" /> },
              { steg: "2", tittel: t("landing.steg2"), beskrivelse: t("landing.steg2Beskrivelse"), ikon: <Smartphone className="h-5 w-5" /> },
              { steg: "3", tittel: t("landing.steg3"), beskrivelse: t("landing.steg3Beskrivelse"), ikon: <Send className="h-5 w-5" /> },
              { steg: "4", tittel: t("landing.steg4"), beskrivelse: t("landing.steg4Beskrivelse"), ikon: <Printer className="h-5 w-5" /> },
            ].map((item, idx) => (
              <div key={item.steg} className="flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 py-4 sm:py-0 sm:text-center">
                <div className="relative">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sitedoc-primary to-blue-600 text-white shadow-lg shadow-blue-500/20">{item.ikon}</div>
                  <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-sitedoc-primary shadow ring-2 ring-sitedoc-primary">{item.steg}</div>
                </div>
                {idx < 3 && <div className="hidden sm:block mx-auto mt-3 mb-3"><ChevronRight className="h-4 w-4 text-gray-300" /></div>}
                {idx >= 3 && <div className="hidden sm:block h-7" />}
                <div className="sm:mt-2">
                  <h3 className="font-semibold text-gray-900">{item.tittel}</h3>
                  <p className="mt-1 text-sm text-gray-500">{item.beskrivelse}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Priser */}
      <section id="priser" className="bg-gradient-to-b from-white to-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-sitedoc-primary">{t("landing.priser")}</div>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">{t("landing.priserTittel")}</h2>
            <p className="mx-auto max-w-2xl text-gray-500">{t("landing.priserBeskrivelse")}</p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h3 className="text-lg font-semibold text-gray-900">{t("landing.proveperiode")}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">{t("landing.gratis14")}</span>
                <span className="text-gray-500">{t("landing.per14dager")}</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">{t("landing.proveBeskrivelse")}</p>
              <a href="/logg-inn" className="mt-8 block rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-semibold text-gray-900 transition hover:border-gray-300 hover:bg-gray-50">
                {t("landing.startProveperiode")}
              </a>
            </div>
            <div className="rounded-2xl border-2 border-sitedoc-primary/30 bg-gradient-to-b from-blue-50/50 to-white p-8 shadow-lg shadow-blue-500/10">
              <h3 className="text-lg font-semibold text-gray-900">{t("landing.prosjektlisens")}</h3>
              <div className="mt-2"><span className="text-4xl font-bold text-gray-900">{t("landing.kontaktOss")}</span></div>
              <p className="mt-3 text-sm text-gray-500">{t("landing.lisensBeskrivelse")}</p>
              <a href="mailto:post@sitedoc.no" className="mt-8 block rounded-xl bg-sitedoc-primary px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700">
                {t("landing.kontaktOss")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f1b3d] via-[#162550] to-[#1e3a6e] py-20">
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">{t("landing.ctaTittel")}</h2>
          <p className="mb-8 text-lg text-blue-200/70">{t("landing.ctaBeskrivelse")}</p>
          <a href="/logg-inn" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#0f1b3d] shadow-lg shadow-black/20 transition hover:bg-blue-50">
            {t("landing.komIGangGratis")}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <span className="text-base font-bold text-sitedoc-primary">SiteDoc</span>
              <p className="mt-1 text-sm text-gray-400">{t("landing.footer")}</p>
            </div>
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SiteDoc</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Plattformkort({ ikon, tittel, beskrivelse, funksjoner, fremhevet }: {
  ikon: React.ReactNode; tittel: string; beskrivelse: string; funksjoner: string[]; fremhevet?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-8 transition ${fremhevet ? "border-sitedoc-primary/30 bg-gradient-to-b from-blue-50/80 to-white shadow-lg shadow-blue-500/10 ring-1 ring-sitedoc-primary/20 scale-[1.02]" : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"}`}>
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${fremhevet ? "bg-sitedoc-primary text-white" : "bg-gray-100 text-gray-500"}`}>{ikon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{tittel}</h3>
      <p className="mb-4 text-sm text-gray-500">{beskrivelse}</p>
      <ul className="space-y-2.5">
        {funksjoner.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
            <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${fremhevet ? "text-sitedoc-primary" : "text-gray-400"}`} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
