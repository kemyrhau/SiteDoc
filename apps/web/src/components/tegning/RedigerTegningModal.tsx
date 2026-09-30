"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Input, Select, Textarea, Button } from "@sitedoc/ui";
import { DRAWING_DISCIPLINES, DRAWING_TYPES, DRAWING_STATUSES, type DrawingStatus } from "@sitedoc/shared";
import {
  byggRedigerTegningInput,
  type RedigerTegningFelt,
} from "@/lib/tegningMutasjonEffekter";

/**
 * Redigeringsflate for tegningsdetaljer. Kobler de metadata-feltene som fylles ved
 * OPPRETTELSE til den eksisterende `tegning.oppdater`-mutasjonen (ordre 2026-09-30,
 * reparasjon: knappen ble aldri koblet).
 *
 * Speiler opprettelsesflaten (`byggeplasser/page.tsx`) + `status` (TILLEGG 1 2026-09-30 —
 * settes til «utkast» ved opprettelse, kunne før bare endres via ny revisjon), MINUS:
 *  - `scale`/`scaleKilde` → målestokk-kalibrering har egen flate på tegningssiden («Ikke rør»).
 *  - `revision` → egen revisjonsflyt (`lastOppRevisjon` bygger historikk).
 *  - `issuedAt` → revisjonsflyten eier den. `byggeplassId` → byggeplass-oppsettet eier den.
 */

/** Statusverdiene leses fra enumet (`DRAWING_STATUSES`); labelen kommer fra i18n per verdi. */
const STATUS_NOKKEL: Record<DrawingStatus, string> = {
  utkast: "tegninger.statusUtkast",
  delt: "tegninger.statusDelt",
  under_behandling: "tegninger.statusUnderBehandling",
  godkjent: "tegninger.statusGodkjent",
  for_bygging: "tegninger.statusForBygging",
  som_bygget: "tegninger.statusSomBygget",
};

/** Bare feltene flaten leser/skriver — unngår kobling til hele Drawing-typen. */
export interface RedigerbarTegning {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  drawingType: string | null;
  status: string | null;
  floor: string | null;
  originator: string | null;
  description: string | null;
}

interface RedigerTegningModalProps {
  open: boolean;
  onClose: () => void;
  tegning: RedigerbarTegning;
  /** Kalles med ferdig `oppdater`-input når brukeren lagrer. */
  onLagre: (input: ReturnType<typeof byggRedigerTegningInput>) => void;
  lagrer: boolean;
  feil?: string | null;
}

export function RedigerTegningModal({
  open,
  onClose,
  tegning,
  onLagre,
  lagrer,
  feil,
}: RedigerTegningModalProps) {
  const { t } = useTranslation();
  const [felt, setFelt] = useState<RedigerTegningFelt>(() => tilFelt(tegning));

  // Fyll skjemaet på nytt hver gang modalen åpnes eller en annen tegning velges,
  // slik at ubekreftede endringer ikke henger igjen.
  useEffect(() => {
    if (open) setFelt(tilFelt(tegning));
  }, [open, tegning]);

  const oppdater = <K extends keyof RedigerTegningFelt>(key: K, verdi: string) =>
    setFelt((f) => ({ ...f, [key]: verdi }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLagre(byggRedigerTegningInput(tegning.id, felt));
  };

  return (
    <Modal open={open} onClose={onClose} title={t("tegninger.redigerTittel")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500">{t("tegninger.redigerHjelp")}</p>

        <Input
          label={t("tegninger.feltNavn")}
          value={felt.name}
          onChange={(e) => oppdater("name", e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("tegninger.feltTegningsnummer")}
            value={felt.drawingNumber}
            onChange={(e) => oppdater("drawingNumber", e.target.value)}
            placeholder={t("tegninger.tegningsnummerPlaceholder")}
          />
          <Select
            label={t("tegninger.feltFagdisiplin")}
            value={felt.discipline}
            onChange={(e) => oppdater("discipline", e.target.value)}
            placeholder={t("tegninger.velgDisiplin")}
            options={DRAWING_DISCIPLINES.map((d) => ({ value: d, label: d }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t("tegninger.feltTegningstype")}
            value={felt.drawingType}
            onChange={(e) => oppdater("drawingType", e.target.value)}
            placeholder={t("tegninger.velgType")}
            options={DRAWING_TYPES.map((type) => ({
              value: type,
              label: type.charAt(0).toUpperCase() + type.slice(1),
            }))}
          />
          <Input
            label={t("tegninger.feltEtasje")}
            value={felt.floor}
            onChange={(e) => oppdater("floor", e.target.value)}
            placeholder={t("tegninger.etasjePlaceholder")}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t("tegninger.feltStatus")}
            value={felt.status}
            onChange={(e) => oppdater("status", e.target.value)}
            placeholder={t("tegninger.velgStatus")}
            options={DRAWING_STATUSES.map((s) => ({ value: s, label: t(STATUS_NOKKEL[s]) }))}
          />
          <Input
            label={t("tegninger.feltOpphav")}
            value={felt.originator}
            onChange={(e) => oppdater("originator", e.target.value)}
          />
        </div>
        <Textarea
          label={t("tegninger.feltBeskrivelse")}
          value={felt.description}
          onChange={(e) => oppdater("description", e.target.value)}
          rows={2}
        />

        {feil && <p className="text-sm text-sitedoc-error">{feil}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={lagrer}>
            {lagrer ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Null → tom streng, så de kontrollerte feltene aldri blir `undefined`. */
function tilFelt(tegning: RedigerbarTegning): RedigerTegningFelt {
  return {
    name: tegning.name ?? "",
    drawingNumber: tegning.drawingNumber ?? "",
    discipline: tegning.discipline ?? "",
    drawingType: tegning.drawingType ?? "",
    status: tegning.status ?? "",
    floor: tegning.floor ?? "",
    originator: tegning.originator ?? "",
    description: tegning.description ?? "",
  };
}
