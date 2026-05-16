"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Save, HelpCircle, X, Search } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";

export default function FirmaInnstillinger() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: org, isLoading } = trpc.organisasjon.hentMedId.useQuery(
    { id: orgId! },
    { enabled: !!orgId },
  );
  const utils = trpc.useUtils();

  const [navn, setNavn] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [fakturaAdresse, setFakturaAdresse] = useState("");
  const [fakturaEpost, setFakturaEpost] = useState("");
  const [ehf, setEhf] = useState(false);
  const [hjelpÅpen, setHjelpÅpen] = useState(false);

  // Fyll skjema når data lastes
  useEffect(() => {
    if (org) {
      setNavn(org.name);
      setOrgNr(org.organizationNumber ?? "");
      setFakturaAdresse(org.invoiceAddress ?? "");
      setFakturaEpost(org.invoiceEmail ?? "");
      setEhf(org.ehfEnabled);
    }
  }, [org]);

  const oppdater = trpc.organisasjon.oppdater.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentMedId.invalidate();
      utils.organisasjon.hentMin.invalidate();
      utils.organisasjon.hentTilgjengelige.invalidate();
    },
  });

  const [brregFeil, setBrregFeil] = useState<string | null>(null);
  const orgNrRenset = orgNr.replace(/\s/g, "");
  const orgNrErNiSiffer = /^\d{9}$/.test(orgNrRenset);
  const brregOppslag = trpc.organisasjon.hentFraBrreg.useQuery(
    { orgnr: orgNrRenset },
    { enabled: false, retry: false },
  );

  async function hentFraBrreg() {
    setBrregFeil(null);
    const resultat = await brregOppslag.refetch();
    if (resultat.error) {
      setBrregFeil(resultat.error.message);
      return;
    }
    if (resultat.data) {
      setNavn(resultat.data.navn);
      const adresseDeler = [
        resultat.data.adresse,
        [resultat.data.postnummer, resultat.data.poststed].filter(Boolean).join(" "),
      ].filter(Boolean);
      if (adresseDeler.length > 0) {
        setFakturaAdresse(adresseDeler.join("\n"));
      }
    }
  }

  const harEndringer =
    org != null &&
    (navn !== org.name ||
      orgNr !== (org.organizationNumber ?? "") ||
      fakturaAdresse !== (org.invoiceAddress ?? "") ||
      fakturaEpost !== (org.invoiceEmail ?? "") ||
      ehf !== org.ehfEnabled);

  const navnGyldig = navn.trim().length > 0;
  const epostGyldig =
    fakturaEpost === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fakturaEpost);

  function lagre() {
    if (!navnGyldig || !epostGyldig) return;

    oppdater.mutate({
      organizationId: orgId!,
      name: navn.trim(),
      organizationNumber: orgNr.trim() || null,
      invoiceAddress: fakturaAdresse.trim() || null,
      invoiceEmail: fakturaEpost.trim() || null,
      ehfEnabled: ehf,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Innstillinger</h1>
        <button
          onClick={() => setHjelpÅpen(true)}
          className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Hjelp"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Firmainformasjon
        </h2>

        <div className="space-y-4">
          {/* Firmanavn */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Firmanavn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                !navnGyldig && navn !== ""
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              }`}
            />
          </div>

          {/* Org.nr */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Organisasjonsnummer
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={orgNr}
                onChange={(e) => {
                  setOrgNr(e.target.value);
                  setBrregFeil(null);
                }}
                placeholder="123 456 789"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={hentFraBrreg}
                disabled={!orgNrErNiSiffer || brregOppslag.isFetching}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {brregOppslag.isFetching ? t("brreg.henter") : t("brreg.hent")}
              </button>
            </div>
            {brregFeil && (
              <p className="mt-1 text-xs text-red-500">{brregFeil}</p>
            )}
          </div>

          {/* Fakturaadresse */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fakturaadresse
            </label>
            <textarea
              value={fakturaAdresse}
              onChange={(e) => setFakturaAdresse(e.target.value)}
              rows={3}
              placeholder="Gateadresse, postnummer og sted"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Faktura-e-post */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Faktura-e-post
            </label>
            <input
              type="email"
              value={fakturaEpost}
              onChange={(e) => setFakturaEpost(e.target.value)}
              placeholder="faktura@firma.no"
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                !epostGyldig
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              }`}
            />
            {!epostGyldig && (
              <p className="mt-1 text-xs text-red-500">
                Ugyldig e-postadresse
              </p>
            )}
          </div>

          {/* EHF */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEhf(!ehf)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                ehf ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  ehf ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
            <label className="text-sm font-medium text-gray-700">
              EHF-faktura (elektronisk faktura)
            </label>
          </div>
        </div>

        {/* Lagre-knapp */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={lagre}
            disabled={!harEndringer || !navnGyldig || !epostGyldig || oppdater.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {oppdater.isPending ? "Lagrer..." : "Lagre endringer"}
          </button>
          {oppdater.isSuccess && (
            <p className="text-sm text-green-600">Endringer lagret</p>
          )}
          {oppdater.isError && (
            <p className="text-sm text-red-500">
              Kunne ikke lagre: {oppdater.error.message}
            </p>
          )}
        </div>
      </div>

      {/* Tidssone */}
      <TidssoneSeksjon />

      {/* Tilgang-defaulter — Timer/Vareforbruk/Maskinbruk */}
      <TilgangPolicySeksjon
        felt="timerTilgangDefault"
        tittelNoekkel="firma.innstillinger.tilgangTimer.tittel"
        beskrivelseNoekkel="firma.innstillinger.tilgangTimer.beskrivelse"
      />
      <TilgangPolicySeksjon
        felt="vareforbrukTilgangDefault"
        tittelNoekkel="firma.innstillinger.tilgangVareforbruk.tittel"
        beskrivelseNoekkel="firma.innstillinger.tilgangVareforbruk.beskrivelse"
      />
      <TilgangPolicySeksjon
        felt="maskinbrukTilgangDefault"
        tittelNoekkel="firma.innstillinger.tilgangMaskinbruk.tittel"
        beskrivelseNoekkel="firma.innstillinger.tilgangMaskinbruk.beskrivelse"
      />

      {/* Kompetansematrise — registreringspolicy */}
      <KompetansePolicySeksjon />

      {/* Rediger ved attestering (T7-2b3) */}
      <RedigerVedAttesteringSeksjon />

      {/* Standard arbeidstid (T4-c) */}
      <StandardArbeidstidSeksjon />

      {/* Hjelp-modal */}
      {hjelpÅpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setHjelpÅpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Innstillinger — Hjelp
              </h2>
              <button
                onClick={() => setHjelpÅpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Hva er dette?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Her redigerer du firmainformasjonen til organisasjonen din i
                  SiteDoc. Endringer vises for alle brukere i organisasjonen.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Hvem kan redigere?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Kun firmaadministratorer (org-admin) kan endre disse
                  innstillingene. Vanlige brukere ser organisasjonsnavnet men
                  kan ikke redigere.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Felter
                </h3>
                <ul className="mt-1 space-y-1 text-sm text-gray-600">
                  <li>
                    <strong>Firmanavn</strong> — vises i toppmenyen og i
                    prosjektrapporter
                  </li>
                  <li>
                    <strong>Org.nr</strong> — norsk organisasjonsnummer (9
                    siffer)
                  </li>
                  <li>
                    <strong>Fakturaadresse</strong> — brukes ved fakturering
                  </li>
                  <li>
                    <strong>Faktura-e-post</strong> — e-postadresse for
                    mottak av fakturaer
                  </li>
                  <li>
                    <strong>EHF</strong> — aktiver for elektronisk faktura
                    via Aksesspunkt
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KompetansePolicySeksjon — Fase 0.5 § 2 RBAC-toggle                  */
/* ------------------------------------------------------------------ */

function KompetansePolicySeksjon() {
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: setting, isLoading } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const utils = trpc.useUtils();

  const oppdater = trpc.organisasjon.oppdaterSetting.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentSetting.invalidate();
    },
  });

  function endre(verdi: "firma_admin" | "bruker_egen" | "alle") {
    oppdater.mutate({ kompetanseRegistreringTilgang: verdi, organizationId: orgId! });
  }

  if (isLoading || !setting) {
    return null;
  }

  const valg: Array<{
    verdi: "firma_admin" | "bruker_egen" | "alle";
    tittel: string;
    beskrivelse: string;
  }> = [
    {
      verdi: "firma_admin",
      tittel: "Kun firma-admin",
      beskrivelse:
        "Kun firma-administratorer kan registrere og endre kompetanse-data. Mest restriktivt.",
    },
    {
      verdi: "bruker_egen",
      tittel: "Bruker registrerer egne",
      beskrivelse:
        "Hver ansatt kan registrere og oppdatere sine egne kompetanser. Firma-admin kan endre alle.",
    },
    {
      verdi: "alle",
      tittel: "Alle ansatte",
      beskrivelse:
        "Alle ansatte i firmaet kan registrere og endre kompetanse for hverandre. Mest fleksibelt.",
    },
  ];

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Kompetansematrise — registreringspolicy
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        Bestem hvem som kan registrere og endre kompetanse-data for ansatte i firmaet.
      </p>

      <div className="space-y-2">
        {valg.map((v) => (
          <label
            key={v.verdi}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
              setting.kompetanseRegistreringTilgang === v.verdi
                ? "border-sitedoc-primary bg-sitedoc-primary/5"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="kompetansePolicy"
              value={v.verdi}
              checked={setting.kompetanseRegistreringTilgang === v.verdi}
              onChange={() => endre(v.verdi)}
              disabled={oppdater.isPending}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">{v.tittel}</div>
              <div className="text-xs text-gray-600">{v.beskrivelse}</div>
            </div>
          </label>
        ))}
      </div>

      {oppdater.isError && (
        <p className="mt-3 text-sm text-red-500">
          Kunne ikke lagre: {oppdater.error.message}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TidssoneSeksjon — OrganizationSetting.timezone                       */
/* ------------------------------------------------------------------ */

const TIDSSONER = [
  "Europe/Oslo",
  "Europe/Stockholm",
  "Europe/Copenhagen",
  "Europe/Helsinki",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
] as const;

function TidssoneSeksjon() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: setting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const utils = trpc.useUtils();

  const oppdater = trpc.organisasjon.oppdaterSetting.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentSetting.invalidate();
    },
  });

  if (!setting || !orgId) return null;

  function endre(verdi: string) {
    oppdater.mutate({ timezone: verdi, organizationId: orgId! });
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        {t("firma.innstillinger.tidssone.tittel")}
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        {t("firma.innstillinger.tidssone.beskrivelse")}
      </p>
      <select
        value={setting.timezone}
        onChange={(e) => endre(e.target.value)}
        disabled={oppdater.isPending}
        className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary disabled:opacity-50"
      >
        {TIDSSONER.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      {oppdater.isError && (
        <p className="mt-3 text-sm text-red-500">
          Kunne ikke lagre: {oppdater.error.message}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TilgangPolicySeksjon — generisk for timer/vareforbruk/maskinbruk     */
/* ------------------------------------------------------------------ */

type TilgangFelt =
  | "timerTilgangDefault"
  | "vareforbrukTilgangDefault"
  | "maskinbrukTilgangDefault";
type TilgangVerdi = "alle-ansatte" | "kun-prosjektmedlemmer" | "sertifiserte";

interface TilgangPolicyProps {
  felt: TilgangFelt;
  tittelNoekkel: string;
  beskrivelseNoekkel: string;
}

function TilgangPolicySeksjon({ felt, tittelNoekkel, beskrivelseNoekkel }: TilgangPolicyProps) {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: setting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const utils = trpc.useUtils();

  const oppdater = trpc.organisasjon.oppdaterSetting.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentSetting.invalidate();
    },
  });

  if (!setting || !orgId) return null;

  function endre(verdi: TilgangVerdi) {
    oppdater.mutate({ [felt]: verdi, organizationId: orgId! });
  }

  const verdier: TilgangVerdi[] = ["alle-ansatte", "kun-prosjektmedlemmer", "sertifiserte"];
  const aktivVerdi = setting[felt] as TilgangVerdi;

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        {t(tittelNoekkel)}
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        {t(beskrivelseNoekkel)}
      </p>

      <div className="space-y-2">
        {verdier.map((v) => (
          <label
            key={v}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
              aktivVerdi === v
                ? "border-sitedoc-primary bg-sitedoc-primary/5"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name={felt}
              value={v}
              checked={aktivVerdi === v}
              onChange={() => endre(v)}
              disabled={oppdater.isPending}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {t(`firma.innstillinger.tilgangVerdi.${v}.tittel`)}
              </div>
              <div className="text-xs text-gray-600">
                {t(`firma.innstillinger.tilgangVerdi.${v}.beskrivelse`)}
              </div>
            </div>
          </label>
        ))}
      </div>

      {oppdater.isError && (
        <p className="mt-3 text-sm text-red-500">
          Kunne ikke lagre: {oppdater.error.message}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RedigerVedAttesteringSeksjon — T7-2b3 (2026-05-14)                */
/*  Toggle for OrganizationSetting.tillattRedigerVedAttestering       */
/* ------------------------------------------------------------------ */

function RedigerVedAttesteringSeksjon() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: setting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const utils = trpc.useUtils();

  const oppdater = trpc.organisasjon.oppdaterSetting.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentSetting.invalidate();
    },
  });

  if (!setting || !orgId) return null;

  const aktiv = setting.tillattRedigerVedAttestering;

  function endre(nyVerdi: boolean) {
    oppdater.mutate({
      organizationId: orgId!,
      tillattRedigerVedAttestering: nyVerdi,
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        {t("firma.innstillinger.redigerVedAttestering.tittel")}
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        {t("firma.innstillinger.redigerVedAttestering.beskrivelse")}
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={aktiv}
          onChange={(e) => endre(e.target.checked)}
          disabled={oppdater.isPending}
          className="mt-0.5"
        />
        <div>
          <div className="text-sm font-medium text-gray-900">
            {t("firma.innstillinger.redigerVedAttestering.toggle")}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {t("firma.innstillinger.redigerVedAttestering.warning")}
          </div>
        </div>
      </label>

      {oppdater.isError && (
        <p className="mt-3 text-sm text-red-500">
          {t("firma.innstillinger.redigerVedAttestering.feil", {
            melding: oppdater.error.message,
          })}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StandardArbeidstidSeksjon — T4-c (2026-05-16)                     */
/*  Firma-default for normal arbeidsdag — brukes som forhåndsutfylling */
/*  i mobil TimerRadModal og fallback i hentEffektivArbeidstid.       */
/* ------------------------------------------------------------------ */

function StandardArbeidstidSeksjon() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: setting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const utils = trpc.useUtils();

  const oppdater = trpc.organisasjon.oppdaterSetting.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentSetting.invalidate();
    },
  });

  const [startTid, setStartTid] = useState<string>("");
  const [sluttTid, setSluttTid] = useState<string>("");
  const [pauseMin, setPauseMin] = useState<string>("");
  // T.5: "none" = null = ingen avrunding. Andre verdier er 15/30/60 (string i UI).
  const [tidsrunding, setTidsrunding] = useState<string>("15");
  const [skitten, setSkitten] = useState(false);

  useEffect(() => {
    if (setting) {
      setStartTid(setting.standardStartTid);
      setSluttTid(setting.standardSluttTid);
      setPauseMin(String(setting.standardPauseMin));
      setTidsrunding(
        setting.tidsrundingMinutter === null ? "none" : String(setting.tidsrundingMinutter),
      );
      setSkitten(false);
    }
  }, [setting]);

  if (!setting || !orgId) return null;

  function lagre() {
    const pause = Number(pauseMin);
    if (Number.isNaN(pause) || pause < 0 || pause > 480) return;
    if (startTid >= sluttTid) return;
    // T.5: konverter UI-state til API-format.
    const tidsrundingVerdi: 15 | 30 | 60 | null =
      tidsrunding === "none" ? null : (Number(tidsrunding) as 15 | 30 | 60);
    oppdater.mutate(
      {
        organizationId: orgId!,
        standardStartTid: startTid,
        standardSluttTid: sluttTid,
        standardPauseMin: pause,
        tidsrundingMinutter: tidsrundingVerdi,
      },
      { onSuccess: () => setSkitten(false) },
    );
  }

  const validBeløp =
    startTid && sluttTid && startTid < sluttTid && Number(pauseMin) >= 0;

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        {t("firma.innstillinger.standardArbeidstid.tittel")}
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        {t("firma.innstillinger.standardArbeidstid.beskrivelse")}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {t("firma.innstillinger.standardArbeidstid.startTid")}
          </label>
          <input
            type="time"
            value={startTid}
            onChange={(e) => {
              setStartTid(e.target.value);
              setSkitten(true);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {t("firma.innstillinger.standardArbeidstid.sluttTid")}
          </label>
          <input
            type="time"
            value={sluttTid}
            onChange={(e) => {
              setSluttTid(e.target.value);
              setSkitten(true);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {t("firma.innstillinger.standardArbeidstid.pauseMin")}
          </label>
          <input
            type="number"
            min={0}
            max={480}
            value={pauseMin}
            onChange={(e) => {
              setPauseMin(e.target.value);
              setSkitten(true);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none"
          />
        </div>
      </div>

      {/* T.5: Tidsrunding for picker-input på timer- og maskin-rader. */}
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-gray-700">
          {t("firma.innstillinger.standardArbeidstid.tidsrunding")}
        </label>
        <select
          value={tidsrunding}
          onChange={(e) => {
            setTidsrunding(e.target.value);
            setSkitten(true);
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none sm:max-w-xs"
        >
          <option value="none">
            {t("firma.innstillinger.standardArbeidstid.tidsrundingIngen")}
          </option>
          <option value="15">
            {t("firma.innstillinger.standardArbeidstid.tidsrunding15")}
          </option>
          <option value="30">
            {t("firma.innstillinger.standardArbeidstid.tidsrunding30")}
          </option>
          <option value="60">
            {t("firma.innstillinger.standardArbeidstid.tidsrunding60")}
          </option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {t("firma.innstillinger.standardArbeidstid.tidsrundingBeskrivelse")}
        </p>
      </div>

      {skitten && startTid >= sluttTid && (
        <p className="mt-2 text-xs text-red-500">
          {t("firma.innstillinger.standardArbeidstid.feilRekkefolge")}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={lagre}
          disabled={!skitten || !validBeløp || oppdater.isPending}
          className="rounded-md bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {oppdater.isPending
            ? t("handling.lagrer")
            : t("handling.lagre")}
        </button>
      </div>

      {oppdater.isError && (
        <p className="mt-3 text-sm text-red-500">
          {t("firma.innstillinger.standardArbeidstid.feil", {
            melding: oppdater.error.message,
          })}
        </p>
      )}
    </div>
  );
}
