export type {
  EdgeChannelConfig,
  ExchangeConfig,
  QueueNamingStrategy,
  RoutingKeySelector,
  RoutingKeyStrategy,
} from './config/index.js';
export {
  buildConsumerQueueName,
  buildJobBindingKeys,
  buildJobRoutingKey,
  buildRoutingKey,
  defaultExchangeConfig,
  defaultQueueNamingStrategy,
  defaultRoutingKeyStrategy,
  resolveConfig,
  validateConfig,
} from './config/index.js';

export type {
  BaseEdgeEnvelope,
  CompatibilityMetadata,
  CompatibilityValidationOptions,
  CompatibilityValidationResult,
  EdgeEnvelope,
  EdgeMessageType,
  ExecutionAttemptMetadata,
  ExecutionJobEnvelope,
  ExecutionJobPayload,
  JobAckMessage,
  JobAckPayload,
  JobFailureEvent,
  JobFailurePayload,
  JobProgressEvent,
  JobProgressPayload,
  JobResultEvent,
  JobResultPayload,
  MessageEnvelopeVersion,
  TargetSelector,
} from './contracts/index.js';
export { assertCompatibleEnvelope, edgeMessageTypes, isEdgeMessageType, validateCompatibility, validateEnvelope } from './contracts/index.js';

export type { EdgeJobHandler, JobDeliveryContext } from './consumer/index.js';
export { EdgeJobConsumer } from './consumer/index.js';
export { EdgeEventPublisher } from './publisher/index.js';

export type { EdgeChannel } from './connection/index.js';
export { createEdgeChannel, EdgeChannelConnectionManager } from './connection/index.js';

export type { EdgeChannelHealth } from './health/index.js';
export { createHealthSnapshot } from './health/index.js';

export type { MockDeliveryRecord, MockEdgeChannel, MockPublishedEvent } from './testing/index.js';
export { createMockEdgeChannel } from './testing/index.js';