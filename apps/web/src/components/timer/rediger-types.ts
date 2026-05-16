// T7-2b2 (2026-05-14): Felles types for rediger-modus i AttesteringDetalj.

export type RedigerTimerRadData = {
  key: string;
  originalId: string | null;
  projectId: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: number;
};

export type RedigerTilleggRadData = {
  key: string;
  originalId: string | null;
  projectId: string;
  tilleggId: string;
  antall: number;
  kommentar: string | null;
};

export type RedigerMaskinRadData = {
  key: string;
  originalId: string | null;
  projectId: string;
  // T7-4d (2026-05-16): maskin følger samme prosjekt+ECO-gruppe som arbeidstimer.
  externalCostObjectId: string | null;
  vehicleId: string;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: number;
  mengde: number | null;
  enhet: string | null;
};

export type ProsjektValg = { id: string; name: string };
