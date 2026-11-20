/**
 * w3a: testdagene fra planen (web-timeforing-plan § 4.13) — dagen fra Kenneths bilde #7 og
 * lastebilen fra del F. Brukes av vakt-testen for dagskort-modus og testene for kortet pr. jobb.
 *
 * #7: prosjekt 2041 Skole. Jobb 1 07:00–15:00 uten underprosjekt (k1). Jobb 2 15:00–16:00 på
 * TILL-001 (k2) med gravemaskinen koblet til raden. Pluss et tillegg og et utlegg i jobb 1, en
 * vare på jobb 2 og en eldre maskinrad uten kort-id.
 */

export const DAG7_SEDEL = {
  id: "s1",
  organizationId: "o1",
  dato: "2026-11-20T00:00:00.000Z",
  status: "draft",
  startAt: "2026-11-20T06:00:00.000Z",
  endAt: "2026-11-20T15:00:00.000Z",
  pauseMin: 30,
  beskrivelse: null,
  aktivitetId: "a1",
  aktivitet: { id: "a1", navn: "Arbeid" },
  attestertVed: null,
  lederKommentar: null,
  manglerMaskinforerbevis: false,
  byggeplassId: null,
  timer: [
    {
      id: "r1",
      projectId: "p1",
      lonnsartId: "l1",
      aktivitetId: "a1",
      externalCostObjectId: null,
      vehicleId: null,
      byggeplassId: null,
      fraTid: "07:00",
      tilTid: "15:00",
      timer: "7.5",
      pauseMin: 30,
      beskrivelse: "Forskaling",
      attestertStatus: "pending",
      erReise: false,
      kortId: "k1",
      createdAt: "2026-11-20T07:00:00.000Z",
    },
    {
      id: "r2",
      projectId: "p1",
      lonnsartId: "l1",
      aktivitetId: "a1",
      externalCostObjectId: "e1",
      vehicleId: null,
      byggeplassId: null,
      fraTid: "15:00",
      tilTid: "16:00",
      timer: "1",
      pauseMin: 0,
      beskrivelse: null,
      attestertStatus: "pending",
      erReise: false,
      kortId: "k2",
      createdAt: "2026-11-20T15:00:00.000Z",
    },
  ],
  maskiner: [
    {
      id: "m1",
      projectId: "p1",
      externalCostObjectId: "e1",
      vehicleId: "v1",
      byggeplassId: null,
      fraTid: null,
      tilTid: null,
      timer: "1",
      mengde: null,
      enhet: null,
      attestertStatus: "pending",
      sheetTimerId: "r2",
      kortId: "k2",
      createdAt: "2026-11-20T15:01:00.000Z",
    },
    {
      id: "m0",
      projectId: "p1",
      externalCostObjectId: null,
      vehicleId: "v1",
      byggeplassId: null,
      fraTid: null,
      tilTid: null,
      timer: "0.5",
      mengde: null,
      enhet: null,
      attestertStatus: "pending",
      sheetTimerId: null,
      kortId: null,
      createdAt: "2026-11-20T06:00:00.000Z",
    },
  ],
  tillegg: [
    {
      id: "t1",
      projectId: "p1",
      tilleggId: "ti1",
      antall: "1",
      kommentar: null,
      attestertStatus: "pending",
      byggeplassId: null,
      externalCostObjectId: null,
      kortId: "k1",
      createdAt: "2026-11-20T08:00:00.000Z",
    },
  ],
  utlegg: [
    {
      id: "u1",
      projectId: "p1",
      expenseCategoryId: "c1",
      belop: "45",
      kommentar: "Parkering",
      ordningVedFoering: "refusjon",
      attestertStatus: "pending",
      byggeplassId: null,
      externalCostObjectId: null,
      kortId: "k1",
      createdAt: "2026-11-20T09:00:00.000Z",
    },
  ],
};

export const DAG7_VARER = [
  {
    id: "f1",
    projectId: "p1",
    byggeplassId: null,
    externalCostObjectId: "e1",
    dagsseddelId: "s1",
    sheetTimerId: "r2",
    kortId: "k2",
    createdAt: "2026-11-20T15:02:00.000Z",
    antall: 5,
    attestert: false,
    vare: { id: "va1", navn: "Pukk 6-32", enhet: "m3" },
  },
];

/** Spørringene siden leser, med #7-dagen. Modus settes av kalleren. */
export function dag7Data(modus: string | undefined): Record<string, unknown> {
  return {
    "timer.dagsseddel.hentMedId": DAG7_SEDEL,
    "prosjekt.hentForTimer": [{ id: "p1", name: "Skole", internalProjectNumber: "2041" }],
    "organisasjon.hentArbeidstidDefaults": modus === undefined ? {} : { timerRegistreringsmodus: modus },
    "vareforbruk.hentMineForDato": DAG7_VARER,
    "vareforbruk.katalogForFirma": {
      varer: [{ id: "va1", navn: "Pukk 6-32", enhet: "m3", varenummer: null }],
      prosjektIderMedVarelager: ["p1"],
    },
    "eksternKostObjekt.list": [{ id: "e1", proAdmId: "TILL-001", kortNavn: "Tillegg 1", navn: "Tillegg 1", status: "aktiv" }],
    "maskin.equipment.list": [{ id: "v1", kategori: "anleggsmaskin", type: "gravemaskin", merke: "Volvo", modell: "EC140", internNavn: "Gravemaskin G-12", utleieEnhet: null }],
    "timer.lonnsart.list": [{ id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time" }],
    "timer.aktivitet.list": [{ id: "a1", navn: "Arbeid", aktiv: true }],
    "timer.tillegg.list": [{ id: "ti1", navn: "Smusstillegg", aktiv: true, enhet: "stk" }],
    "timer.expenseCategory.list": [{ id: "c1", navn: "Parkering", aktiv: true, ordning: "refusjon" }],
  };
}
