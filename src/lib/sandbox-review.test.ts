import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LithosApiError } from "./lithos/errors";
import type { LithosClient } from "./lithos/client";
import { signOffAsClinician } from "./sandbox-review";

const CATALOG = {
  data: [
    { id: "dutasteride", name: "Dutasteride", categories: ["hair_loss"], dosages: [{ id: "dose_dut" }] },
    { id: "finasteride", name: "Finasteride 1 mg", categories: ["hair_loss"], dosages: [{ id: "dose_fin" }] },
    { id: "wegovy", name: "Wegovy", categories: ["weight_management"], dosages: [{ id: "dose_weg" }] },
  ],
};

const pending = {
  id: "enc_1", status: "in_review", patient_id: "pat_1", care_plan_id: "cpl_1",
  requested_treatments: [{ id: "rqt_1", catalog_treatment_id: null, status: "pending" }],
};

function client(complete: (body: unknown) => unknown, category = "hair_loss") {
  const post = vi.fn(async (path: string, body: unknown) => (path.endsWith("/complete") ? complete(body) : {}));
  const get = vi.fn(async (path: string) => {
    if (path.startsWith("/v1/encounters/")) return pending;
    if (path === "/v1/catalog_treatments") return CATALOG;
    if (path.startsWith("/v1/care_plans/")) return { category };
    throw new Error(`unexpected GET ${path}`);
  });
  return { get, post } as unknown as LithosClient & { post: typeof post };
}

describe("signOffAsClinician on a clinician's-choice request", () => {
  beforeEach(() => vi.stubEnv("LITHOS_API_BASE_URL", "https://api.sandbox.lithoshealth.com"));
  afterEach(() => vi.unstubAllEnvs());

  it("lets the sandbox pick the protocol's first-line treatment", async () => {
    const c = client(() => ({
      ...pending, status: "completed",
      requested_treatments: [{ id: "rqt_1", catalog_treatment_id: null, status: "approved", treatments: [{ catalog_treatment_id: "finasteride" }] }],
    }));

    await expect(signOffAsClinician(c, "enc_1")).resolves.toEqual({ chose: "Finasteride 1 mg" });
    expect(c.post).toHaveBeenCalledWith("/v1/sandbox/encounters/enc_1/complete", {});
  });

  it("reports the reason when the protocol leaves nothing to prescribe", async () => {
    const c = client(() => ({
      ...pending, status: "completed",
      requested_treatments: [{ id: "rqt_1", catalog_treatment_id: null, status: "rejected", ineligibility_reason_code: "criteria_not_met" }],
    }));

    await expect(signOffAsClinician(c, "enc_1")).resolves.toEqual({ declined: "criteria_not_met" });
  });

  it("chooses itself when the program has no first-line treatment for the sandbox to pick", async () => {
    const c = client((body) => {
      if (JSON.stringify(body) === "{}") {
        throw new LithosApiError(422, [{
          code: "sandbox.completion_invalid",
          message: "treatment_decision[rqt_1] is a provider-choice add and must name at least one treatment",
        }]);
      }
      return { ...pending, status: "completed" };
    }, "weight_management");

    await expect(signOffAsClinician(c, "enc_1")).resolves.toEqual({ chose: "Wegovy" });
    expect(c.post).toHaveBeenLastCalledWith("/v1/sandbox/encounters/enc_1/complete", {
      treatments: [{ requested_treatment_id: "rqt_1", status: "approved", dosage_ids: ["dose_weg"] }],
    });
  });
});
