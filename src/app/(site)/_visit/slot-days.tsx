"use client";

import { useState } from "react";
import type { SlotDay } from "@/lib/sync-visits";

/**
 * One day of times at a time: a row of day tabs, then that day's starts. A
 * week of five-minute starts is hundreds of buttons; nobody scans that.
 * Render inside a form — each time is a submit button carrying `slot_token`.
 */
export function SlotDays({ days, disabled }: { days: SlotDay[]; disabled: boolean }) {
  const [selected, setSelected] = useState(0);
  const day = days[Math.min(selected, days.length - 1)];
  if (!day) return null;
  return (
    <div className="stack">
      <div className="day-tabs" role="tablist" aria-label="Day">
        {days.map((d, index) => (
          <button
            key={d.label}
            type="button"
            role="tab"
            aria-selected={d === day}
            className={`btn day-tab${d === day ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setSelected(index)}
          >
            {d.label} <span className="day-tab-count">{d.slots.length}</span>
          </button>
        ))}
      </div>
      <fieldset className="slot-day" disabled={disabled} role="tabpanel" aria-label={day.label}>
        <div className="slot-grid">
          {day.slots.map((slot) => (
            <button key={slot.token} type="submit" name="slot_token" value={slot.token} className="btn btn-ghost slot">
              {slot.time}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
