// Delte typer for HMS-visning (prosjekt-nivå + firma-nivå).

export interface DokumentRad {
  id: string;
  title: string;
  number: number | null;
  status: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown> | null;
  template: {
    id: string;
    prefix: string | null;
    name: string;
    subdomain: string | null;
    objects?: Array<{ id: string; label: string; type: string }>;
    project?: { id: string; name: string } | null;
  };
  bestiller?: { name: string | null } | null;
  // For HMS-avvik (Task) — byggeplass utledes via drawing.byggeplass
  drawing?: { byggeplass?: { id: string; name: string } | null } | null;
  // For SJA/RUH (Checklist) — byggeplass direkte
  byggeplass?: { id: string; name: string } | null;
}
