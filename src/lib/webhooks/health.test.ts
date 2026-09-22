import { describe, expect, it } from "vitest";
import { classifyDeliveries, describeFailure, type Delivery } from "./health";
import { pingProof } from "../setup/reachability";

const d = (status: string, created_at: string, code: number | null = null, attempt_count = 1): Delivery =>
  ({ status, created_at, last_response_code: code, last_error_class: code && code >= 300 ? "non_2xx" : null, attempt_count });

describe("classifyDeliveries", () => {
  it("is ok when there's nothing yet", () => {
    expect(classifyDeliveries([])).toEqual({ state: "ok" });
  });

  it("judges by the newest delivery — a success after failures means it's fixed", () => {
    expect(classifyDeliveries([d("exhausted", "2026-09-22T10:00:00Z", 405), d("succeeded", "2026-09-22T11:00:00Z", 200)]).state).toBe("ok");
  });

  it("flags the MDChat pattern: every delivery exhausted with a 405", () => {
    const health = classifyDeliveries([d("exhausted", "2026-09-10T00:35:00Z", 405), d("exhausted", "2026-09-10T00:36:00Z", 405), d("succeeded", "2026-09-09T00:00:00Z", 200)]);
    expect(health).toEqual({ state: "failing", code: 405, errorClass: "non_2xx", failing: 2 });
    if (health.state === "failing") expect(describeFailure(health)).toBe("The last 2 deliveries failed — Lithos got HTTP 405 from your endpoint.");
  });

  it("counts a delivery still retrying after a non-2xx answer as failing", () => {
    expect(classifyDeliveries([d("pending", "2026-09-22T12:00:00Z", 502, 3)]).state).toBe("failing");
  });

  it("doesn't count a delivery that hasn't been attempted yet", () => {
    expect(classifyDeliveries([d("pending", "2026-09-22T12:00:00Z", null, 0)]).state).toBe("ok");
  });
});

describe("pingProof", () => {
  it("is stable for one secret and different for another, and never the secret itself", () => {
    const a = pingProof("secret_a");
    expect(a).toBe(pingProof("secret_a"));
    expect(a).not.toBe(pingProof("secret_b"));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(pingProof(undefined)).toBeNull();
  });
});
