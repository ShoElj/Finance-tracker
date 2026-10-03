import { describe, expect, it } from "vitest";
import { validateDisplayName } from "../moderation";

describe("display names", () => {
  it("accepts normal student names", () => {
    for (const name of ["Amaka", "Dickson", "Mr. Okafor", "Chi-chi", "Tunde 2", "Grace O'Neil"]) {
      expect(validateDisplayName(name)).toBeNull();
    }
  });

  it("enforces length and characters", () => {
    expect(validateDisplayName("")).toBe("Please enter your name.");
    expect(validateDisplayName("A")).toBe("Name is too short.");
    expect(validateDisplayName("A".repeat(17))).toMatch(/16 characters/);
    expect(validateDisplayName("<script>")).toMatch(/letters, numbers/);
  });

  it("blocks rude names, including leetspeak", () => {
    for (const name of ["idiot", "Stup1d boy", "sh1t", "big ass", "mumu"]) {
      expect(validateDisplayName(name)).toBe("Please choose a friendlier name.");
    }
  });
});
