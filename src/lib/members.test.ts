import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "./db";
import { startEmbeddedDb, type EmbeddedDb } from "./embedded-db";
import { AlreadyAMember, createMember } from "./join";
import { findOrCreateMemberForCare, linkMemberToLithos } from "./members";

// Against the real schema, in an embedded database of its own.
const root = mkdtempSync(path.join(tmpdir(), "members-"));
cpSync(path.join(process.cwd(), "db", "schema.sql"), path.join(root, "db", "schema.sql"), { recursive: true });
let db: EmbeddedDb;
beforeAll(async () => {
  db = await startEmbeddedDb(root);
  process.env.DATABASE_URL = db.url;
  process.env.LITHOS_EMBEDDED_DB = "1";
}, 30_000);
afterAll(async () => {
  await getDb().end();
  await db.stop();
  rmSync(root, { recursive: true, force: true });
});

const person = (email: string) => ({
  first_name: "Sample", last_name: "Door", date_of_birth: "1985-04-12", sex: "female" as const,
  email, phone: "+12125550188", enrolled_in_government_insurance: false,
  address: { line1: "410 Sample Street", line2: null, city: "Brooklyn", state: "NY", postal_code: "11201" },
});

describe("findOrCreateMemberForCare", () => {
  it("is one person, whatever door and however they type their email", async () => {
    const first = await findOrCreateMemberForCare(person("sample.door@example.com"));
    expect(first).toMatchObject({ lithos_patient_id: null });
    expect(first.id).toMatch(/^eu_mem_/);

    await linkMemberToLithos(first.id, "pat_test_1");
    const again = await findOrCreateMemberForCare(person("Sample.Door@Example.com"));
    expect(again).toEqual({ id: first.id, lithos_patient_id: "pat_test_1" });

    const [row] = await getDb()`SELECT plan, email FROM members WHERE id = ${first.id}`;
    expect(row).toEqual({ plan: null, email: "sample.door@example.com" });
  });

  it("joining later gives the same person a membership — same member, same Lithos patient — and only once", async () => {
    const cared = await findOrCreateMemberForCare(person("sample.later@example.com"));
    await linkMemberToLithos(cared.id, "pat_test_2");
    const join = {
      plan: "complete" as const, firstName: "Sample", lastName: "Door", email: "sample.later@example.com", phone: "+12125550188",
      dateOfBirth: "1985-04-12", sex: "female" as const,
      address: { line1: "410 Sample Street", line2: null, city: "Brooklyn", state: "NY", postalCode: "11201" },
      priorPanel: null, currentLipidMedication: null,
    };
    const joined = await createMember(join);
    expect(joined.memberId).toBe(cared.id);
    const [row] = await getDb()`SELECT plan, lithos_patient_id FROM members WHERE id = ${cared.id}`;
    expect(row).toEqual({ plan: "complete", lithos_patient_id: "pat_test_2" });
    await expect(createMember(join)).rejects.toBeInstanceOf(AlreadyAMember);
  });
});
