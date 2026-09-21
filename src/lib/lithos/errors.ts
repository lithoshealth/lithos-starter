import type { ApiError } from "./types";

const FALLBACK_ERROR: ApiError = {
  code: "api.unexpected_response",
  message: "The Lithos API returned an unexpected error response.",
};

export class LithosApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errors: ApiError[],
  ) {
    super(`Lithos API request failed with status ${status}`);
    this.name = "LithosApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseApiErrors(value: unknown): ApiError[] {
  if (!isRecord(value) || !Array.isArray(value.errors)) return [FALLBACK_ERROR];

  const errors = value.errors.flatMap((entry): ApiError[] => {
    if (!isRecord(entry) || typeof entry.code !== "string" || typeof entry.message !== "string") {
      return [];
    }

    const error: ApiError = { code: entry.code, message: entry.message };
    if (isRecord(entry.source)) {
      const source = {
        ...(typeof entry.source.pointer === "string" ? { pointer: entry.source.pointer } : {}),
        ...(typeof entry.source.parameter === "string" ? { parameter: entry.source.parameter } : {}),
        ...(typeof entry.source.header === "string" ? { header: entry.source.header } : {}),
      };
      if (Object.keys(source).length > 0) error.source = source;
    }
    if (isRecord(entry.meta)) error.meta = entry.meta;
    return [error];
  });

  return errors.length > 0 ? errors : [FALLBACK_ERROR];
}

export function safeIntegrationError(message = "The sample app could not complete the request."): ApiError {
  return { code: "sample_app.integration_error", message };
}
