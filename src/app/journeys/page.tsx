import { JourneysDirectory } from "./directory";
import { getLithosClient } from "@/lib/lithos/client";
import { loadJourneyDirectory } from "@/lib/journeys";

export const dynamic = "force-dynamic";

export default async function JourneysPage() {
  const directory = await loadJourneyDirectory(getLithosClient());
  return <JourneysDirectory directory={directory} />;
}