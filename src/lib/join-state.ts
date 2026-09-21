/**
 * The signup form's state, kept apart from `join.ts` on purpose: `join.ts`
 * reaches the database, and the form is a client component. Importing the two
 * together drags the Postgres driver into the browser bundle.
 */

export type JoinError = { field: string; message: string };

export type JoinState =
  | { status: "idle" }
  | { status: "failed"; errors: JoinError[] }
  | { status: "joined"; memberId: string };

export const INITIAL_JOIN_STATE: JoinState = { status: "idle" };
