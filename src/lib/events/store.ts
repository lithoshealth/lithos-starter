export type WebhookPayload = Record<string, unknown> & { id: string };

export type StoredEvent = {
  id: string;
  receivedAt: string;
  payload: WebhookPayload;
};

export type RecordEventResult = { inserted: boolean };

export interface EventStore {
  record(event: StoredEvent): Promise<RecordEventResult>;
  list(limit: number): Promise<StoredEvent[]>;
}
