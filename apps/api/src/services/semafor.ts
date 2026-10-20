/**
 * Enkel tellende semafor (FIFO), ingen ny pakke. Trukket ut av embedding-service.ts
 * (NorBERT-køen) 2026-10-16 slik at tegningskøen (arbeidstegning-rekonvertering,
 * maks 2 samtidig mot DWG/DXF-konverteringen) kan bruke SAMME implementasjon i
 * stedet for en kopi — to steder som begrenser samtidighet mot en ekstern/tung
 * prosess er nøyaktig det samme problemet, løst én gang.
 */
export class Semafor {
  private aktive = 0;
  private kø: Array<() => void> = [];
  constructor(private readonly maks: number) {}

  /** Antall kall i flukt akkurat nå (for test/observasjon). */
  get iFlukt(): number {
    return this.aktive;
  }

  async kjør<T>(fn: () => Promise<T>): Promise<T> {
    await this.ta();
    try {
      return await fn();
    } finally {
      this.frigi();
    }
  }

  private ta(): Promise<void> {
    if (this.aktive < this.maks) {
      this.aktive++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.kø.push(resolve));
  }

  private frigi(): void {
    const neste = this.kø.shift();
    if (neste) {
      // Overfør slotten direkte til neste i kø (aktive forblir uendret).
      neste();
    } else {
      this.aktive--;
    }
  }

  /**
   * Nullstiller teller og kø. KUN for test-isolasjon: modul-singletonene
   * (`tegningRekonverteringKø`, NorBERT-køen) gjenbrukes mellom tester i samme fil, og en
   * test som bevisst lar en jobb aldri resolve ville ellers holdt en slot okkupert for de
   * neste testene. Et billig alternativ til `vi.resetModules()` + re-import av den store
   * `tegning.ts`-modulen pr. test, som ble en teststabilitets-felle: re-importen tok 5+ s
   * under parallell turbo-last og sprengte 5 s-testgrensen (`fix/ustabil-api-test`).
   */
  nullstill(): void {
    this.aktive = 0;
    this.kø = [];
  }
}
