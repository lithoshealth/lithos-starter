/** DATABASE_URL, or the running app's embedded database; null when there's neither. */
export function databaseUrl(root?: string): string | null;
/** The same, or a message saying how to get one — and the process exits. */
export function requireDatabaseUrl(root?: string): string;
