import { describe, expect, it } from "vitest";
import { APP_NAME } from "./app-meta";

describe("app metadata", () => {
  it("identifies the app", () => {
    expect(APP_NAME).toBe("Eucardia Health");
  });
});
