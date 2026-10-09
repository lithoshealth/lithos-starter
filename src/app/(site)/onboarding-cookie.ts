/**
 * The first-run pop-up's state in this browser: "later" (look around first,
 * this session) or "done:<tag>" (set up, for this connection — see
 * onboarding-done.ts). Its own file because both the server
 * (which decides whether to show the pop-up) and the client (which closes it)
 * read it, and a value imported from a "use client" file isn't a value on
 * the server.
 */
export const ONBOARDING_COOKIE = "lithos_onboarding";
