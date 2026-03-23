export interface EdgeChannelHealth {
  connected: boolean;
  consumerActive?: boolean;
  publisherActive?: boolean;
  timestamp: string;
  details?: Record<string, unknown>;
}

export function createHealthSnapshot(overrides: Partial<EdgeChannelHealth> = {}): EdgeChannelHealth {
  return {
    connected: false,
    consumerActive: false,
    publisherActive: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}