"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal } from "@sitedoc/ui";
import { Upload, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { nesteRevisjon } from "@/lib/tegningSerieOpplasting";

const ACCEPT = ".pdf,.dwg,.dxf,.ifc,.png,.jpg,.jpeg";

type OpplastetFil = {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

/**
 * R8: «Last opp ny revisjon» på en tegning. Laster ny fil til `/api/upload`,
 * foreslår neste revisjonskode (redigerbar), og kaller `tegning.lastOppRevisjon`
 * — som nå starter konvertering for den nye fila (api), så ny revisjon aldri viser
 * gammel PNG. Gjenbrukes på tegningsraden og i rediger-dialogen.
 */
export function LastOppRevisjonKnapp({
  drawingId,
  gjeldendeRevisjon,
  variant = "secondary",
  size = "sm",
  onFerdig,
}: {
  drawingId: string;
  gjeldendeRevisjon: string | null | undefined;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  onFerdig?: () => void;
}) {
  const { t } = useTranslation();
  const filInput = useRef<HTMLInputElement>(null);
  const [lasterOpp, setLasterOpp] = useState(false);
  const [valgt, setValgt] = useState<OpplastetFil | null>(null);
  const [revisjon, setRevisjon] = useState("");

  const mutation = trpc.tegning.lastOppRevisjon.useMutation({
    onSuccess: () => {
      setValgt(null);
      setRevisjon("");
      onFerdig?.();
    },
  });

  async function handleFil(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    e.target.value = "";
    if (!fil) return;
    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? t("tegninger.serie.opplastingFeilet"));
        return;
      }
      const data = (await res.json()) as OpplastetFil;
      setValgt(data);
      setRevisjon(nesteRevisjon(gjeldendeRevisjon));
    } catch {
      alert(t("tegninger.serie.opplastingFeilet"));
    } finally {
      setLasterOpp(false);
    }
  }

  function bekreft() {
    if (!valgt) return;
    mutation.mutate({
      drawingId,
      revision: revisjon.trim() || nesteRevisjon(gjeldendeRevisjon),
      fileUrl: valgt.fileUrl,
      fileType: valgt.fileType,
      fileSize: valgt.fileSize,
    });
  }

  return (
    <>
      <input
        ref={filInput}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFil}
      />
      <Button
        variant={variant}
        size={size}
        onClick={() => filInput.current?.click()}
        disabled={lasterOpp}
      >
        {lasterOpp ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-4 w-4" />
        )}
        {t("tegninger.revisjon.lastOpp")}
      </Button>

      <Modal
        open={!!valgt}
        onClose={() => setValgt(null)}
        title={t("tegninger.revisjon.tittel")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {t("tegninger.revisjon.fil", { navn: valgt?.fileName ?? "" })}
          </p>
          <Input
            label={t("tegninger.revisjon.kode")}
            value={revisjon}
            onChange={(e) => setRevisjon(e.target.value)}
          />
          {mutation.error && (
            <p className="text-sm text-sitedoc-error">
              {t("tegninger.revisjon.feil")}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setValgt(null)}>
              {t("handling.avbryt")}
            </Button>
            <Button onClick={bekreft} disabled={mutation.isPending}>
              {mutation.isPending
                ? t("handling.lagrer")
                : t("tegninger.revisjon.lastOpp")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
