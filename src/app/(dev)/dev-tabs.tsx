"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/setup", label: "Your app" },
  { href: "/setup/webhooks", label: "Webhooks" },
  { href: "/setup/settings", label: "Settings" },
];

/** The Developer pages, with the one you're on marked. */
export function DevTabs() {
  const path = usePathname();
  return (
    <>
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={path === tab.href ? "page" : undefined} className={path === tab.href ? "dev-tab dev-tab-on" : "dev-tab"}>
          {tab.label}
        </Link>
      ))}
    </>
  );
}
