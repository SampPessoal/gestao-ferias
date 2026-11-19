import { describe, expect, it } from "vitest";
import { diasEntre } from "./folgas";
describe("diasEntre", () => {
  it("conta as duas pontas", () => {
    expect(diasEntre("2026-11-10", "2026-11-10")).toBe(1);
    expect(diasEntre("2026-11-13", "2026-11-14")).toBe(2);
    expect(diasEntre("2026-12-31", "2027-01-02")).toBe(3);
  });
});
