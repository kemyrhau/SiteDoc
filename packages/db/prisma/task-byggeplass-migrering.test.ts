import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regresjonsvakt for migreringen 20261106120000_task_byggeplass (ORDRE 28).
 *
 * Legger til `tasks.byggeplass_id` — ADDITIVT og NULLABLE, FK ON DELETE SET NULL — og
 * backfiller fra tegningen. Låser formen (ingen DROP/NOT NULL, to-stegs-policy) og at
 * backfillen har den diskriminerende WHERE-en: kun rader uten egen byggeplass, med tegning,
 * og der tegningen selv har byggeplass. Tester teksten, ikke en levende DB — den ekte kjøringen
 * står i api/task-byggeplass.integration.test.ts.
 */
const sql = readFileSync(
  join(__dirname, "migrations", "20261106120000_task_byggeplass", "migration.sql"),
  "utf8",
);
const kjørbar = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migrering 20261106120000_task_byggeplass", () => {
  it("legger til byggeplass_id på tasks som nullable TEXT", () => {
    expect(kjørbar).toMatch(/ALTER TABLE "tasks" ADD COLUMN "byggeplass_id" TEXT;/);
  });

  it("FK til byggeplasser er ON DELETE SET NULL (som checklists)", () => {
    expect(kjørbar).toMatch(
      /ADD CONSTRAINT "tasks_byggeplass_id_fkey" FOREIGN KEY \("byggeplass_id"\) REFERENCES "byggeplasser"\("id"\) ON DELETE SET NULL/,
    );
  });

  it("indekserer byggeplass_id", () => {
    expect(kjørbar).toMatch(/CREATE INDEX "tasks_byggeplass_id_idx" ON "tasks"\("byggeplass_id"\);/);
  });

  it("er ADDITIV: ingen DROP, ingen DELETE, aldri NOT NULL", () => {
    expect(kjørbar).not.toMatch(/DROP\s/i);
    expect(kjørbar).not.toMatch(/DELETE\s+FROM/i);
    expect(kjørbar).not.toMatch(/"byggeplass_id"\s+TEXT\s+NOT NULL/i);
  });

  it("backfill fra tegning har diskriminerende WHERE (overskriver aldri egen byggeplass)", () => {
    const update = kjørbar.match(/UPDATE "tasks"[\s\S]*?;/)?.[0] ?? "";
    expect(update).toMatch(/SET "byggeplass_id" = d\."byggeplass_id"/);
    expect(update).toMatch(/t\."byggeplass_id" IS NULL/);
    expect(update).toMatch(/t\."drawing_id" IS NOT NULL/);
    expect(update).toMatch(/t\."drawing_id" = d\."id"/);
    expect(update).toMatch(/d\."byggeplass_id" IS NOT NULL/);
  });
});
