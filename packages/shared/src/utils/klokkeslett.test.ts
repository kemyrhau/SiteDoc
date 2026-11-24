import { describe, expect, it } from "vitest";
import { tolkKlokkeslett } from "./klokkeslett";

// O15 pkt 3 (K4): «Del ved kl.» godtar vanlige skrivemåter.
describe("tolkKlokkeslett", () => {
  it.each([
    ["10", "10:00"],
    ["9", "09:00"],
    ["930", "09:30"],
    ["1030", "10:30"],
    ["10.30", "10:30"],
    ["10,30", "10:30"],
    ["10:30", "10:30"],
    [" 7:05 ", "07:05"],
    ["0", "00:00"],
    ["2359", "23:59"],
  ])("%s → %s", (inn, ut) => expect(tolkKlokkeslett(inn)).toBe(ut));

  it.each(["", "kl 10", "10.3", "24", "2400", "1060", "10:60", "12345", "1:2", "-1"])("avviser «%s»", (inn) =>
    expect(tolkKlokkeslett(inn)).toBeNull(),
  );
});
