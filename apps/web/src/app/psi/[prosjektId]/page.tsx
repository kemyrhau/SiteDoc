"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { ShieldCheck, ChevronRight, Check, Globe, CheckCircle, XCircle, RotateCcw, Play } from "lucide-react";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

interface Objekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
  parentId: string | null;
}

interface Seksjon {
  tittel: string;
  objekter: Objekt[];
  harQuiz: boolean;
  harVideo: boolean;
  harSignatur: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                           */
/* ------------------------------------------------------------------ */

export default function PsiGjestSide() {
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  // Steg: bygningsvalg → registrering → gjennomføring → ferdig
  const [steg, setSteg] = useState<"bygningsvalg" | "registrering" | "gjennomforing" | "ferdig">("bygningsvalg");
  const [valgtPsiId, setValgtPsiId] = useState<string | null>(null);
  const [gjestNavn, setGjestNavn] = useState("");
  const [gjestFirma, setGjestFirma] = useState("");
  const [gjestTlf, setGjestTlf] = useState("");
  const [hmsKortNr, setHmsKortNr] = useState("");
  const [harIkkeHmsKort, setHarIkkeHmsKort] = useState(false);
  const [gjesteBeskjed, setGjesteBeskjed] = useState<string | null>(null);
  const [spraak, setSpraak] = useState("nb");
  const [signaturId, setSignaturId] = useState<string | null>(null);
  const [malObjekter, setMalObjekter] = useState<Objekt[]>([]);
  const [malNavn, setMalNavn] = useState("");

  // Hent PSI-er for bygningsvalg (public endpoint)
  const { data: psiListe, isLoading: psiLaster } = trpc.psi.hentForProsjektPublic.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  type PsiPublic = NonNullable<typeof psiListe>[number];

  // Auto-skip bygningsvalg hvis kun én PSI
  useEffect(() => {
    if (steg !== "bygningsvalg" || !psiListe) return;
    const liste = psiListe as PsiPublic[];
    if (liste.length === 1) {
      setValgtPsiId(liste[0]!.id);
      setSteg("registrering");
    }
  }, [psiListe, steg]);

  const guestStartMut = trpc.psi.guestStart.useMutation({
    onSuccess: (_data: unknown) => {
      const data = _data as { signaturId: string; psiVersjon: number; template: { name: string; objects: Objekt[] }; guestMessage?: string | null };
      setSignaturId(data.signaturId);
      setMalObjekter(data.template.objects ?? []);
      setMalNavn(data.template.name ?? "PSI");
      if (data.guestMessage && harIkkeHmsKort) setGjesteBeskjed(data.guestMessage);
      setSteg("gjennomforing");
    },
  });

  const hmsGyldig = harIkkeHmsKort || /^\d{7}$/.test(hmsKortNr.trim());

  const startPsi = () => {
    if (!gjestNavn.trim() || !gjestFirma.trim() || !valgtPsiId || !hmsGyldig) return;
    guestStartMut.mutate({
      psiId: valgtPsiId,
      name: gjestNavn.trim(),
      company: gjestFirma.trim(),
      phone: gjestTlf.trim() || undefined,
      hmsKortNr: harIkkeHmsKort ? undefined : hmsKortNr.trim() || undefined,
      harIkkeHmsKort,
      language: spraak,
    });
  };

  if (steg === "ferdig") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-green-50 px-4">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">PSI fullført</h1>
        <p className="mt-2 text-center text-gray-600">
          Du har gjennomført og signert sikkerhetsinstruksen.
        </p>
        <p className="mt-1 text-sm text-gray-500">{gjestNavn} — {gjestFirma}</p>
      </div>
    );
  }

  if (steg === "gjennomforing" && signaturId) {
    return (
      <>
        {gjesteBeskjed && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
            <strong>Viktig:</strong> {gjesteBeskjed}
          </div>
        )}
        <PsiGjennomforing
          signaturId={signaturId}
          objekter={malObjekter}
          malNavn={malNavn}
          onFullfort={() => setSteg("ferdig")}
        />
      </>
    );
  }

  // Bygningsvalg-skjerm (kun hvis >1 PSI)
  if (steg === "bygningsvalg") {
    if (psiLaster) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <Spinner size="lg" />
        </div>
      );
    }
    const liste = (psiListe ?? []) as PsiPublic[];
    if (liste.length === 0) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <ShieldCheck className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-gray-500">Ingen PSI er tilgjengelig for dette prosjektet.</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-sitedoc-primary" />
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Sikkerhetsinstruks</h1>
            <p className="mt-1 text-sm text-gray-500">Hvilken bygning skal du jobbe på?</p>
          </div>
          <div className="space-y-3">
            {liste.map((psi) => (
              <button
                key={psi.id}
                onClick={() => { setValgtPsiId(psi.id); setSteg("registrering"); }}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm transition-colors hover:border-sitedoc-primary hover:bg-blue-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  {psi.building ? (
                    <span className="text-lg">🏗️</span>
                  ) : (
                    <Globe className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {psi.building?.name ?? "Hele prosjektet"}
                  </p>
                  <p className="text-xs text-gray-500">{psi.template.name}</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Registreringsskjerm
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-sitedoc-primary" />
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Sikkerhetsinstruks</h1>
          <p className="mt-1 text-sm text-gray-500">Fyll ut informasjonen din for å starte</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          {/* Språkvalg */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <Globe className="mr-1 inline h-4 w-4" />
              Språk
            </label>
            <select
              value={spraak}
              onChange={(e) => setSpraak(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {STOETTEDE_SPRAAK.map((s) => (
                <option key={s.kode} value={s.kode}>{s.flagg} {s.navn}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Fullt navn *</label>
            <input
              type="text"
              value={gjestNavn}
              onChange={(e) => setGjestNavn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ola Nordmann"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Firma *</label>
            <input
              type="text"
              value={gjestFirma}
              onChange={(e) => setGjestFirma(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Firma AS"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Telefon</label>
            <input
              type="tel"
              value={gjestTlf}
              onChange={(e) => setGjestTlf(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="+47 ..."
            />
          </div>

          {/* HMS-kort */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-gray-700">HMS-kortnummer</label>
            {!harIkkeHmsKort && (
              <input
                type="text"
                inputMode="numeric"
                maxLength={7}
                value={hmsKortNr}
                onChange={(e) => setHmsKortNr(e.target.value.replace(/\D/g, "").slice(0, 7))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="7 siffer"
              />
            )}
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={harIkkeHmsKort}
                onChange={(e) => { setHarIkkeHmsKort(e.target.checked); if (e.target.checked) setHmsKortNr(""); }}
                className="rounded border-gray-300"
              />
              Har ikke HMS-kort
            </label>
          </div>

          <button
            onClick={startPsi}
            disabled={!gjestNavn.trim() || !gjestFirma.trim() || !hmsGyldig || guestStartMut.isPending}
            className="w-full rounded-lg bg-sitedoc-primary py-3 text-sm font-semibold text-white hover:bg-sitedoc-secondary disabled:bg-gray-300 disabled:text-gray-500"
          >
            {guestStartMut.isPending ? "Starter..." : "Start PSI"}
          </button>

          {guestStartMut.isError && (
            <p className="mt-3 text-center text-sm text-red-500">
              Kunne ikke starte PSI. Prøv igjen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gjennomføring (seksjon-for-seksjon)                                 */
/* ------------------------------------------------------------------ */

function PsiGjennomforing({
  signaturId,
  objekter,
  malNavn,
  onFullfort,
}: {
  signaturId: string;
  objekter: Objekt[];
  malNavn: string;
  onFullfort: () => void;
}) {
  const [aktivSeksjon, setAktivSeksjon] = useState(0);
  const [fullforte, setFullforte] = useState<Set<number>>(new Set());
  const [feltVerdier, setFeltVerdier] = useState<Record<string, unknown>>({});
  const [signaturBilde, setSignaturBilde] = useState<string | null>(null);
  const [harScrolletNed, setHarScrolletNed] = useState(false);
  const innholdRef = useRef<HTMLDivElement>(null);

  const oppdaterMut = trpc.psi.guestOppdaterProgresjon.useMutation();
  const fullforMut = trpc.psi.guestFullfør.useMutation({ onSuccess: onFullfort });

  // Del inn i seksjoner
  const seksjoner = useMemo((): Seksjon[] => {
    const rot = objekter.filter((o) => !o.parentId);
    const result: Seksjon[] = [];
    let gjeldende: Seksjon | null = null;

    for (const obj of rot) {
      if (obj.type === "heading") {
        if (gjeldende) result.push(gjeldende);
        gjeldende = { tittel: obj.label, objekter: [], harQuiz: false, harVideo: false, harSignatur: false };
      } else {
        if (!gjeldende) gjeldende = { tittel: "Introduksjon", objekter: [], harQuiz: false, harVideo: false, harSignatur: false };
        gjeldende.objekter.push(obj);
        if (obj.type === "quiz") gjeldende.harQuiz = true;
        if (obj.type === "video") gjeldende.harVideo = true;
        if (obj.type === "signature") gjeldende.harSignatur = true;
      }
    }
    if (gjeldende) result.push(gjeldende);
    return result;
  }, [objekter]);

  const seksjon = seksjoner[aktivSeksjon];
  const erSignatur = seksjon?.harSignatur ?? false;

  // Kan gå videre?
  const kanVidere = useMemo(() => {
    if (!seksjon) return false;
    if (seksjon.harQuiz) {
      return seksjon.objekter.filter((o) => o.type === "quiz").every((o) => feltVerdier[o.id] !== undefined);
    }
    if (seksjon.harVideo) {
      return seksjon.objekter.filter((o) => o.type === "video").every((o) => feltVerdier[o.id] === "watched");
    }
    if (erSignatur) return !!signaturBilde;
    return harScrolletNed;
  }, [seksjon, feltVerdier, harScrolletNed, signaturBilde, erSignatur]);

  // Scroll-tracking
  useEffect(() => {
    const el = innholdRef.current;
    if (!el) return;
    const handler = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
        setHarScrolletNed(true);
      }
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [aktivSeksjon]);

  const neste = useCallback(async () => {
    const nyeFullforte = new Set(fullforte);
    nyeFullforte.add(aktivSeksjon);
    setFullforte(nyeFullforte);

    if (erSignatur && signaturBilde) {
      await fullforMut.mutateAsync({
        signaturId,
        signatureData: signaturBilde,
        data: feltVerdier as Record<string, unknown>,
      });
      return;
    }

    const ny = aktivSeksjon + 1;
    oppdaterMut.mutate({ signaturId, progress: ny, data: feltVerdier as Record<string, unknown> });
    setAktivSeksjon(ny);
    setHarScrolletNed(false);
    innholdRef.current?.scrollTo({ top: 0 });
  }, [fullforte, aktivSeksjon, erSignatur, signaturBilde, signaturId, feltVerdier, fullforMut, oppdaterMut]);

  if (seksjoner.length === 0) return <div className="p-8 text-center text-gray-500">Ingen innhold</div>;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-semibold text-gray-900">{malNavn}</h1>
        {/* Progresjon */}
        <div className="mt-2 flex gap-1">
          {seksjoner.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                fullforte.has(i) ? "bg-green-500" : i === aktivSeksjon ? "bg-sitedoc-primary" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Seksjonstittel */}
      <div className="border-b border-gray-100 px-4 py-3">
        <span className="text-xs text-gray-400">{aktivSeksjon + 1} / {seksjoner.length}</span>
        <h2 className="mt-0.5 text-lg font-semibold text-gray-900">{seksjon?.tittel}</h2>
      </div>

      {/* Innhold */}
      <div ref={innholdRef} className="flex-1 overflow-y-auto px-4 py-6" style={{ maxHeight: "calc(100vh - 200px)" }}>
        <div className="mx-auto max-w-2xl">
          {seksjon?.objekter.map((obj) => (
            <WebObjektRenderer
              key={obj.id}
              objekt={obj}
              verdi={feltVerdier[obj.id]}
              onEndre={(v) => setFeltVerdier((prev) => ({ ...prev, [obj.id]: v }))}
              signatur={signaturBilde}
              onSignatur={setSignaturBilde}
            />
          ))}
        </div>
      </div>

      {/* Bunnknapp */}
      <div className="shrink-0 border-t border-gray-200 px-4 py-3">
        <button
          onClick={neste}
          disabled={!kanVidere || fullforMut.isPending}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold ${
            kanVidere
              ? erSignatur ? "bg-green-600 text-white hover:bg-green-700" : "bg-sitedoc-primary text-white hover:bg-sitedoc-secondary"
              : "bg-gray-200 text-gray-400"
          }`}
        >
          {fullforMut.isPending ? (
            <Spinner size="sm" />
          ) : (
            <>
              {erSignatur ? "Bekreft og signer" : "Neste"}
              {erSignatur ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Web objekt-renderer (forenklet for PSI-gjest)                       */
/* ------------------------------------------------------------------ */

function WebObjektRenderer({
  objekt,
  verdi,
  onEndre,
  signatur,
  onSignatur,
}: {
  objekt: Objekt;
  verdi: unknown;
  onEndre: (v: unknown) => void;
  signatur: string | null;
  onSignatur: (v: string | null) => void;
}) {
  switch (objekt.type) {
    case "info_text":
      return <p className="mb-4 whitespace-pre-wrap text-base leading-7 text-gray-800">{(objekt.config.content as string) ?? ""}</p>;

    case "info_image": {
      const url = (objekt.config.imageUrl as string) ?? "";
      const caption = (objekt.config.caption as string) ?? "";
      if (!url) return null;
      const fullUrl = url.startsWith("http") ? url : `/api${url}`;
      return (
        <figure className="my-4">
          <img src={fullUrl} alt={caption} className="mx-auto max-w-full rounded-lg" loading="lazy" />
          {caption && <figcaption className="mt-1.5 text-center text-sm italic text-gray-500">{caption}</figcaption>}
        </figure>
      );
    }

    case "video": {
      const url = (objekt.config.url as string) ?? (objekt.config.fileUrl as string) ?? "";
      if (!url) return null;
      const fullUrl = url.startsWith("http") ? url : `/api${url}`;
      const erFerdig = verdi === "watched";
      return (
        <div className="my-4">
          <video
            src={fullUrl}
            controls
            className="w-full rounded-lg"
            onEnded={() => onEndre("watched")}
          />
          {erFerdig && <p className="mt-2 text-center text-sm text-green-600">✓ Video fullført</p>}
        </div>
      );
    }

    case "quiz": {
      const spørsmål = (objekt.config.question as string) ?? objekt.label;
      const alternativer = (objekt.config.options as string[]) ?? [];
      const riktigIdx = (objekt.config.correctIndex as number) ?? 0;
      return (
        <QuizWeb
          spørsmål={spørsmål}
          alternativer={alternativer}
          riktigIndex={riktigIdx}
          verdi={verdi as number | undefined}
          onRiktig={(v) => onEndre(v)}
        />
      );
    }

    case "signature":
      return (
        <div className="my-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Signatur</p>
          <SignaturWeb verdi={signatur} onEndre={onSignatur} />
        </div>
      );

    case "subtitle":
      return <p className="mb-2 text-sm font-medium text-gray-600">{objekt.label}</p>;

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Quiz-komponent (web)                                                */
/* ------------------------------------------------------------------ */

function QuizWeb({
  spørsmål,
  alternativer,
  riktigIndex,
  verdi,
  onRiktig,
}: {
  spørsmål: string;
  alternativer: string[];
  riktigIndex: number;
  verdi: number | undefined;
  onRiktig: (v: number) => void;
}) {
  const [valgt, setValgt] = useState<number | null>(verdi ?? null);
  const [sjekket, setSjekket] = useState(verdi !== undefined);
  const erRiktig = valgt === riktigIndex;

  return (
    <div className="my-4 rounded-xl border border-gray-200 bg-white p-5">
      <p className="mb-3 text-base font-semibold text-gray-900">{spørsmål}</p>
      {alternativer.map((alt, i) => {
        const erValgt = valgt === i;
        const visOk = sjekket && i === riktigIndex;
        const visFeil = sjekket && erValgt && !erRiktig;
        return (
          <button
            key={i}
            onClick={() => { if (!(sjekket && erRiktig)) { setValgt(i); setSjekket(false); } }}
            className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm ${
              visOk ? "border-green-500 bg-green-50" : visFeil ? "border-red-400 bg-red-50" : erValgt ? "border-sitedoc-primary bg-blue-50" : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${erValgt ? "border-sitedoc-primary bg-sitedoc-primary" : "border-gray-300"}`}>
              {erValgt && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <span className={visOk ? "font-medium text-green-700" : visFeil ? "text-red-600" : "text-gray-800"}>{alt}</span>
            {visOk && <CheckCircle className="ml-auto h-4 w-4 text-green-500" />}
            {visFeil && <XCircle className="ml-auto h-4 w-4 text-red-400" />}
          </button>
        );
      })}
      {!sjekket && valgt !== null && (
        <button onClick={() => { setSjekket(true); if (valgt === riktigIndex) onRiktig(valgt); }} className="mt-1 w-full rounded-lg bg-sitedoc-primary py-2.5 text-sm font-medium text-white">
          Sjekk svar
        </button>
      )}
      {sjekket && !erRiktig && <p className="mt-2 text-center text-sm text-red-600">Feil svar — prøv igjen</p>}
      {sjekket && erRiktig && <p className="mt-2 text-center text-sm text-green-600">✓ Riktig!</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Signatur-komponent (web — enkel canvas)                             */
/* ------------------------------------------------------------------ */

function SignaturWeb({ verdi, onEndre }: { verdi: string | null; onEndre: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tegner, setTegner] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    let erNede = false;
    const start = (e: MouseEvent | TouchEvent) => {
      erNede = true;
      setTegner(true);
      const rect = canvas.getBoundingClientRect();
      const x = ("touches" in e ? e.touches[0]!.clientX : e.clientX) - rect.left;
      const y = ("touches" in e ? e.touches[0]!.clientY : e.clientY) - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const flytt = (e: MouseEvent | TouchEvent) => {
      if (!erNede) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = ("touches" in e ? e.touches[0]!.clientX : e.clientX) - rect.left;
      const y = ("touches" in e ? e.touches[0]!.clientY : e.clientY) - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const stopp = () => {
      if (erNede) {
        erNede = false;
        onEndre(canvas.toDataURL());
      }
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", flytt);
    canvas.addEventListener("mouseup", stopp);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", flytt, { passive: false });
    canvas.addEventListener("touchend", stopp);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", flytt);
      canvas.removeEventListener("mouseup", stopp);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", flytt);
      canvas.removeEventListener("touchend", stopp);
    };
  }, [onEndre]);

  const tøm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onEndre(null);
    setTegner(false);
  };

  return (
    <div className="rounded-lg border border-gray-300 bg-gray-50 p-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={150}
        className="w-full cursor-crosshair rounded border border-gray-200 bg-white"
        style={{ touchAction: "none" }}
      />
      {tegner && (
        <button onClick={tøm} className="mt-2 text-xs text-gray-500 hover:text-red-500">
          Tøm signatur
        </button>
      )}
    </div>
  );
}
