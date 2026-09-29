import { describe, expect, it } from "vitest";
import { maskCredential } from "./action-state";

describe("maskCredential", () => {
  it("keeps only the ends of a credential", () => {
    expect(maskCredential("client_01M3PW7A7CKABCDEFGHJK4F2", { head: 14, tail: 4 })).toBe("client_01M3PW7••••••••••••K4F2");
  });

  it("shows only the last four of a secret", () => {
    const masked = maskCredential("sk_sandbox_abcdefghijklmnop3f9a", { head: 0, tail: 4 });
    expect(masked).toBe("••••••••••••3f9a");
    expect(masked).not.toContain("sk_sandbox");
  });

  it("hides a value too short to show any of", () => {
    expect(maskCredential("short", { head: 2, tail: 4 })).toBe("••••••••");
  });
});
