import { describe, expect, it } from "vitest";
import { generateInviteCode } from "@/lib/invites/code";

const CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

describe("generateInviteCode", () => {
  it("returns a code in XXXX-XXXX format from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).toMatch(CODE_PATTERN);
    }
  });

  it("generates distinct codes", () => {
    const codes = new Set(
      Array.from({ length: 1000 }, () => generateInviteCode()),
    );
    expect(codes.size).toBe(1000);
  });
});