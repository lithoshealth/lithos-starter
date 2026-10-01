import type { ReactNode } from "react";

/**
 * The patient's app has its own chrome — a header band and a tab bar, like a
 * phone app — rather than the marketing site's. Each page brings its shell
 * (portal/shell.tsx), so the header can say something different per tab.
 */
export default function PortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="app">{children}</div>;
}
