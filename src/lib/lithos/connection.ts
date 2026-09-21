/**
 * Is this app connected to Lithos yet?
 *
 * The app is meant to be explored before it's set up: click around, fill in a
 * form, submit it — and find out that the one thing missing is the connection
 * to actual care. So nothing is gated up front; every place that would call
 * Lithos asks this first and, if the answer is no, explains instead of
 * crashing. The failed submit is the lesson.
 */

const REQUIRED = ["LITHOS_API_BASE_URL", "LITHOS_TOKEN_URL", "LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET"] as const;

export type LithosConnection = { connected: true } | { connected: false; missing: string[] };

export function lithosConnection(env: NodeJS.ProcessEnv = process.env): LithosConnection {
  const missing = REQUIRED.filter((name) => !env[name]);
  return missing.length === 0 ? { connected: true } : { connected: false, missing };
}

/** The error code every action returns when it has nowhere to send a request. */
export const NOT_CONNECTED_CODE = "lithos.not_connected";

export function notConnectedError() {
  return {
    code: NOT_CONNECTED_CODE,
    message: "This app isn't connected to Lithos yet, so there's nowhere to send this. The setup walkthrough at /setup connects it.",
  };
}
