"use client";

import Link from "next/link";
import { useState } from "react";

/** The card's two buttons, and the details "View details" opens beneath them. */
export function RxActions({ primary, rows }: { primary: { href: string; label: string }; rows: Array<[label: string, value: string]> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="rx-actions">
        <Link href={primary.href} className="btn rx-btn-primary">{primary.label}</Link>
        <button type="button" className="btn rx-btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide details" : "View details"}
        </button>
      </div>
      {open && (
        <dl className="rx-details">
          {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
    </>
  );
}
