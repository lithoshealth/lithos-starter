import type { ApiError } from "@/lib/lithos/types";

/** Lithos's error envelope as it came back: status, code, message, pointer. */
export function ApiErrors({ title, httpStatus, errors }: { title: string; httpStatus?: number; errors: ApiError[] }) {
  return (
    <div className="error-box" role="alert">
      <h2>{title}</h2>
      {httpStatus && <p className="muted">Lithos answered HTTP {httpStatus}.</p>}
      <ul>
        {errors.map((error, index) => (
          <li key={`${error.code}-${index}`}>
            {error.message} <code className="muted">{error.code}</code>
            {(error.source?.pointer ?? error.source?.parameter ?? error.source?.header) && (
              <code className="muted"> {error.source?.pointer ?? error.source?.parameter ?? error.source?.header}</code>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
