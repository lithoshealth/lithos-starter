import Link from "next/link";
import type { ReactNode } from "react";
import { getBrand } from "@/lib/app-meta";

/** Developer chrome: says what this is, and gets out of the way. */
export default async function DevLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { name } = await getBrand();
  return (
    <>
      <header className="dev-header">
        <div className="header-inner">
          <span className="dev-brand">Lithos sandbox <span className="muted">· {name} starter</span></span>
          <nav className="site-nav" aria-label="Developer navigation">
            <Link href="/">Open your site</Link>
            <Link href="/events">Webhook log</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
