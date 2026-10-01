import Link from "next/link";
import type { ReactNode } from "react";
import { getBrand } from "@/lib/app-meta";
import { isSandboxBaseUrl } from "@/lib/sandbox-review";
import { awaitingPatient, type PortalData } from "@/lib/portal/view";
import { signOutAction, signOutToSiteAction } from "./actions";
import { DemoControls } from "./demo-controls";
import { Icon } from "./icons";

export type Tab = "home" | "messages" | "support";

const TABS: Array<{ tab: Tab; href: string; label: string; icon: "home" | "messages" | "support" }> = [
  { tab: "home", href: "/portal", label: "Home", icon: "home" },
  { tab: "messages", href: "/portal/messages", label: "Messages", icon: "messages" },
  { tab: "support", href: "/portal/support", label: "Support", icon: "support" },
];

export const initials = (first: string, last: string) => `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();

/**
 * The patient app's frame: a header band in the brand colour that says where
 * you are, the page, and a tab bar fixed to the bottom like a phone app's.
 * Without `data` (signed out) there's no tab bar — there's nowhere to go yet.
 */
export async function PortalShell({ tab, eyebrow, title, lede, data, children }: {
  tab?: Tab; eyebrow: string; title: string; lede?: string; data?: PortalData; children: ReactNode;
}) {
  const brand = await getBrand();
  const unread = data ? awaitingPatient(data).length : 0;
  // Moving a sample patient along on a call: a local sandbox copy only, never a real build.
  const demo = data && process.env.NODE_ENV === "development" && isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL);

  return (
    <>
      <header className="app-band">
        <div className="app-band-inner">
          <div className="app-bar">
            <Link href="/" className="app-brand">
              {/* eslint-disable-next-line @next/next/no-img-element -- a user-uploaded logo of unknown size */}
              {brand.logo ? <img src={brand.logo} alt="" className="app-logo" /> : null}
              <span className={brand.logo && brand.logoWide ? "visually-hidden" : undefined}>{brand.name}</span>
            </Link>
            {data && (
              <div className="app-bar-end">
                <Link href="/portal/messages" className="app-bell" aria-label={unread ? `${unread} message waiting` : "Messages"}>
                  <Icon name="bell" />{unread > 0 && <span className="app-dot" />}
                </Link>
                <details className="app-menu">
                  <summary className="app-avatar" aria-label="Your account">{initials(data.patient.first_name, data.patient.last_name)}</summary>
                  <div className="app-menu-panel">
                    <p className="app-menu-name">{data.patient.first_name} {data.patient.last_name}</p>
                    <form action={signOutToSiteAction}><button className="app-menu-item">Sign out</button></form>
                  </div>
                </details>
              </div>
            )}
          </div>
          <p className="app-eyebrow">{eyebrow}</p>
          <h1 className="app-title">{title}</h1>
          {lede && <p className="app-lede">{lede}</p>}
        </div>
      </header>

      <main className={`app-main${data ? " app-main-tabbed" : ""}`}>
        {children}
        <p className="app-trust">Care from licensed clinicians · Powered by Lithos</p>
        <div className="app-demo-note">
          Demo sign-in. In your app, patients sign in with your own login — Lithos has no patient accounts.
          {data && <form action={signOutAction}><button className="link-button">Switch patient</button></form>}
        </div>
        {demo && <DemoControls data={data} />}
      </main>

      {data && (
        <nav className="app-tabs" aria-label="Your account">
          {TABS.map((t) => (
            <Link key={t.tab} href={t.href} className={t.tab === tab ? "app-tab app-tab-on" : "app-tab"} aria-current={t.tab === tab ? "page" : undefined}>
              <span className="app-tab-icon">
                <Icon name={t.icon} size={22} />
                {t.tab === "messages" && unread > 0 && <span className="app-badge">{unread}</span>}
              </span>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
