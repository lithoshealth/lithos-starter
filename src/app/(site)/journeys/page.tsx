import { sandboxOpsOnly } from "@/lib/ops-guard";
import { JourneysDirectory } from "./directory";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection } from "@/lib/lithos/connection";
import { loadJourneyDirectory } from "@/lib/journeys";
import { NotConnected } from "../not-connected";

export const dynamic = "force-dynamic";

export default async function JourneysPage() {
  sandboxOpsOnly();
  if (!lithosConnection().connected) {
    return (
      <section className="panel stack">
        <h1>Journeys</h1>
        <NotConnected
          action="This page lists every patient journey your organization has started"
          outcome="it keeps the record of each patient, care plan and encounter"
        />
      </section>
    );
  }
  const directory = await loadJourneyDirectory(getLithosClient());
  return <JourneysDirectory directory={directory} />;
}