import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app-meta";

/** Developer chrome: says what this is, and gets out of the way. */
export default function DevLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <header className="dev-header">
        <div className="header-inner">
          <span className="dev-brand">Lithos sandbox <span className="muted">· {APP_NAME} starter</span></span>
          <nav className="site-nav" aria-label="Developer navigation">
            <Link href="/">Open the app</Link>
            <Link href="/events">Webhook log</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
